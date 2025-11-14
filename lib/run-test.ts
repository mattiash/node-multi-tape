import { FinalResults, Parser } from 'tap-parser'
// eslint-disable-next-line
const tee = require('tee')
import * as streams from 'stream-buffers'
import { spawn } from 'child_process'
import { createWriteStream } from 'fs'
import { basename } from 'path'
import { Writable } from 'stream'

export interface Result {
    exitCode: number
    executionTime: number
    result: FinalResults
}

// Returns a promise that resolves whe the test has been run
// logConsole = argv.p === 1
export async function runTest(
    filename: string,
    nodeArgs: string[],
    logConsole: boolean,
    outputToFile: boolean,
    junitOutput: boolean,
    timeout: number,
    quiet: boolean = false,
    errorsOnly: boolean = false
): Promise<Result> {
    const extraEnv = {} as Record<string, string>
    if (junitOutput) {
        extraEnv.PT_XUNIT_FILE = filename + '.xml'
        extraEnv.PT_XUNIT_NAME = basename(filename)
    }

    const startTime = Date.now()

    const proc = spawn('node', nodeArgs.concat(filename), {
        env: {
            ...process.env,
            ...extraEnv,
        },
    })

    let aborted = false
    const exited = new Promise<{ exitCode: number; signal: string }>(
        (resolve) => {
            let timer =
                timeout > 0
                    ? setTimeout(() => {
                          console.log(
                              `## multi-tape: Timeout for ${basename(
                                  filename
                              )}. Sending SIGTERM`
                          )
                          proc.kill('SIGTERM')
                          aborted = true
                          timer = setTimeout(() => {
                              console.log(
                                  `## multi-tape: Second timeout for ${basename(
                                      filename
                                  )}. Sending SIGKILL`
                              )
                              proc.kill('SIGKILL')
                          }, 10_000)
                      }, timeout)
                    : undefined

            proc.on('exit', (exitCode: number, signal: string) => {
                if (timer) {
                    clearTimeout(timer)
                }
                resolve({ exitCode, signal })
            })
        }
    )

    const output: Writable =
        logConsole && !quiet && !errorsOnly
            ? process.stdout
            : new streams.WritableStreamBuffer()

    if (!quiet && !errorsOnly) {
        output.write(`\n#\n# ${filename}\n#\n`)
    } else if (errorsOnly) {
        output.write(`\n#\n# ${filename}\n#\n`)
    }

    const parsed = new Promise<FinalResults>((resolve) => {
        const p = new Parser(resolve)

        if (outputToFile) {
            proc.stdout
                .pipe(tee(p, createWriteStream(filename + '.tap')))
                .pipe(output)
        } else {
            proc.stdout.pipe(tee(p)).pipe(output)
        }
        proc.stderr.pipe(output)
    })

    const exitedResult = await exited
    let { exitCode } = exitedResult
    const { signal } = exitedResult
    const endTime = Date.now()
    const result = await parsed
    if (aborted) {
        exitCode = exitCode || 1
    }
    const shouldPrintOutput =
        (!logConsole && !quiet && !errorsOnly) ||
        (errorsOnly && (exitCode !== 0 || !result.ok))

    if (shouldPrintOutput) {
        const lines = (
            output as streams.WritableStreamBuffer
        ).getContentsAsString('utf8')
        if (lines) {
            for (const line of lines.split('\n')) {
                console.log(line)
            }
        }
    }

    if (signal && !quiet && !errorsOnly) {
        console.log(`${filename} exited with signal ${signal}`)
    } else if (signal && errorsOnly && (exitCode !== 0 || !result.ok)) {
        console.log(`${filename} exited with signal ${signal}`)
    }
    return {
        exitCode,
        executionTime: endTime - startTime,
        result,
    }
}
