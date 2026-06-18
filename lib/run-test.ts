import { FinalResults, Parser } from 'tap-parser'
// eslint-disable-next-line
const tee = require('tee')
import * as streams from 'stream-buffers'
import { spawn } from 'child_process'
import { createWriteStream } from 'fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, dirname } from 'path'
import { Writable } from 'stream'
import { TapEvent, buildXunitFromTapEvents, prematureXunit } from './xunit'

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
    timedOut?: boolean
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

    const [tapResult, exitCode] = await Promise.all([
        new Promise<FinalResults>((resolve) => {
            const p = new Parser(resolve)
            proc.stdout.pipe(p)
        }),
        new Promise<number>((resolve) => {
            proc.on('close', (code: number | null) => resolve(code ?? 1))
        }),
    ])

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
    retryNumber: number = 0,
    runner: string = 'node'
): Promise<Result> {
    const extraEnv = {} as Record<string, string>
    if (executor !== undefined) {
        extraEnv.MULTI_TAPE_EXECUTOR = executor
    }

    const startTime = Date.now()
    const xmlStartTime = new Date()

    const proc = spawn(runner, [...nodeArgs, filename, ...extraArgs], {
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

            proc.on('close', (exitCode: number, signal: string) => {
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
    const xmlFilename = junitOutput
        ? outputDir
            ? `${outputDir}${filename}${retrySuffix}.xml`
            : `${filename}${retrySuffix}.xml`
        : undefined
    const tapEvents: TapEvent[] = []

    // Create directory structure if needed
    if (outputToFile && outputDir) {
        const tapFilename = `${outputDir}${filename}${retrySuffix}.tap`
        const tapDir = dirname(tapFilename)
        await mkdir(tapDir, { recursive: true })
    }

    if (xmlFilename) {
        await mkdir(dirname(xmlFilename), { recursive: true })
        await writeFile(
            xmlFilename,
            prematureXunit(basename(filename), xmlStartTime)
        )
    }

    const parsed = new Promise<FinalResults>((resolve) => {
        const p = new Parser(resolve)

        if (junitOutput) {
            p.on('comment', (comment: string) => {
                tapEvents.push({ type: 'comment', data: comment })
            })
            p.on('assert', (result) => {
                tapEvents.push({ type: 'assert', data: result })
            })
        }

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

    if (xmlFilename) {
        await writeFile(
            xmlFilename,
            buildXunitFromTapEvents(tapEvents, basename(filename), xmlStartTime)
        )
    }

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
        timedOut: aborted,
    }
}
