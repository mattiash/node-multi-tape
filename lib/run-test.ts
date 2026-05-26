import { FinalResults, Parser } from 'tap-parser'
// eslint-disable-next-line
const tee = require('tee')
import * as streams from 'stream-buffers'
import { spawn } from 'child_process'
import { createWriteStream } from 'fs'
import { mkdir } from 'node:fs/promises'
import { basename, dirname } from 'path'
import { Writable } from 'stream'

const failPrefix = process.env.MT_NO_EMOJI ? '' : '❌ '

export interface FailedAttempt {
    executionTime: number
    result: FinalResults
    tapFile: string
}

export interface Result {
    exitCode: number
    executionTime: number
    result: FinalResults
    signal: string
    beforeEachFailed?: boolean
    beforeEachFile?: string
    retries?: FailedAttempt[]
}

export interface BeforeEachResult {
    ok: boolean
    output: string
}

export async function runBeforeEach(
    cmd: string,
    executor: string | undefined
): Promise<BeforeEachResult> {
    const env: Record<string, string> = { ...process.env } as Record<
        string,
        string
    >
    if (executor !== undefined) {
        env.MULTI_TAPE_EXECUTOR = executor
    }

    const proc = spawn(cmd, [], { shell: true, env })

    let output = ''
    proc.stdout.on('data', (data: Buffer) => {
        output += data
    })
    proc.stderr.on('data', (data: Buffer) => {
        output += data
    })

    const tapResult = await new Promise<FinalResults>((resolve) => {
        const p = new Parser(resolve)
        proc.stdout.pipe(p)
    })

    const exitCode = await new Promise<number>((resolve) => {
        proc.on('exit', (code: number | null) => resolve(code ?? 1))
    })

    const ok = tapResult.ok && exitCode === 0
    return { ok, output }
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
    errorsOnly: boolean = false,
    outputDir?: string,
    extraArgs: string[] = [],
    executor?: string,
    retryNumber: number = 0
): Promise<Result> {
    const extraEnv = {} as Record<string, string>
    if (junitOutput) {
        extraEnv.PT_XUNIT_FILE = outputDir
            ? `${outputDir}${filename}.xml`
            : filename + '.xml'
        extraEnv.PT_XUNIT_NAME = basename(filename)
    }
    if (executor !== undefined) {
        extraEnv.MULTI_TAPE_EXECUTOR = executor
    }

    const startTime = Date.now()

    const proc = spawn('node', [...nodeArgs, filename, ...extraArgs], {
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
                              `multi-tape: ${failPrefix}Timeout for ${basename(
                                  filename
                              )}. Sending SIGTERM`
                          )
                          proc.kill('SIGTERM')
                          aborted = true
                          timer = setTimeout(() => {
                              console.log(
                                  `multi-tape: ${failPrefix}Second timeout for ${basename(
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

    if (!quiet) {
        if (process.env.MT_NO_EMOJI) {
            output.write(`\n#\n# ${filename}\n#\n`)
        } else {
            output.write(`\n#\n# 🚀 ${filename}\n#\n`)
        }
    }

    const retrySuffix = retryNumber > 0 ? `.retry${retryNumber}` : ''

    // Create directory structure if needed
    if (outputToFile && outputDir) {
        const tapFilename = `${outputDir}${filename}${retrySuffix}.tap`
        const tapDir = dirname(tapFilename)
        await mkdir(tapDir, { recursive: true })
    }

    const parsed = new Promise<FinalResults>((resolve) => {
        const p = new Parser(resolve)

        if (outputToFile) {
            const tapFilename = outputDir
                ? `${outputDir}${filename}${retrySuffix}.tap`
                : `${filename}${retrySuffix}.tap`

            proc.stdout
                .pipe(tee(p, createWriteStream(tapFilename)))
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

    return {
        exitCode,
        executionTime: endTime - startTime,
        result,
        signal,
    }
}
