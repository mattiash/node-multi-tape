#! /usr/bin/env node

import { spawn } from 'child_process'
import { availableParallelism } from 'os'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { globArgs } from './lib/glob'
import { Result, FailedAttempt, runTest, runBeforeEach } from './lib/run-test'
import type { FinalResults } from 'tap-parser'
import parseArgs from 'minimist'

const argv = parseArgs<{
    o: boolean
    O: string
    p: number
    P: number
    j: boolean
    t: number
    q: boolean
    e: boolean
    'update-timings': boolean
    executors: string
    'before-each': string
    retry: number
    runner: string
    '--': string[]
}>(process.argv.slice(2), {
    boolean: ['o', 'j', 'q', 'e', 'update-timings'],
    string: ['O', 'executors', 'before-each', 'runner'],
    default: { p: 1, t: 0, retry: 0, runner: 'node' },
    '--': true,
})

const passthroughArgs: string[] = argv['--'] ?? []

const TIMINGS_FILE = '.multi-tape-timing.json'

function getCpuCount(): number {
    try {
        return availableParallelism()
    } catch {
        if (!argv.q) {
            console.warn('Warning: Error detecting CPU cores, defaulting to 1')
        }
        return 1
    }
}

function calculateParallelism(
    pValue: number | undefined,
    PValue: number | undefined,
    executorsValue: string | undefined
): number {
    const flagCount = [pValue, PValue, executorsValue].filter(
        (v) => v !== undefined
    ).length
    if (flagCount > 1) {
        console.error(
            'Error: Cannot specify more than one of -p, -P, and --executors.'
        )
        process.exit(1)
    }

    if (PValue !== undefined) {
        const cpuCount = getCpuCount()
        return Math.max(1, Math.floor(PValue * cpuCount))
    }

    if (executorsValue !== undefined) {
        return executorsValue.split(',').length
    }

    return pValue ?? 1
}

const executorList: string[] | undefined = argv.executors
    ? argv.executors.split(',')
    : undefined

const results = new Map<string, Result>()

let runStartTime = 0
let runEndTime = 0
let threadLastCompletionTimes: number[] = []

// Calculate effective parallelism based on -p, -P, or --executors
const parallelism = calculateParallelism(
    argv.p !== 1 ? argv.p : undefined,
    argv.P,
    argv.executors
)

const nodeArgs = new Array<string>()

if (argv['node-arg']) {
    if (Array.isArray(argv['node-arg'])) {
        nodeArgs.push(...argv['node-arg'])
    } else {
        nodeArgs.push(argv['node-arg'])
    }
}

function printHelp() {
    console.log(`
multi-tape - Run tape tests in multiple files

Usage: multi-tape [options] <test-files...>

Options:
  -o                  Send output to one file per test-file (.tap extension)
  -O <dir>            Send output to directory (e.g., -O tapFiles/)
  --node-arg=<arg>    Pass an option to node (can be used multiple times)
  -p=<N>              Run N tests in parallel (default: 1)
  -P=<N>              Run N tests per CPU core (e.g., -P 1.5 on 4 cores = 6 parallel tests)
                      Cannot be used together with -p
  --executors=<list>  Comma-separated named executors (e.g., --executors=a,b,c); sets parallelism
                      to the number of executors and passes MULTI_TAPE_EXECUTOR to each test.
                      Cannot be used together with -p or -P
  -j                  Generate JUnit XML output (.xml extension)
  -t <ms>             Timeout in milliseconds for each test file
  -q                  Quiet mode - only show test results as they complete
  -e                  Errors-only mode - only show output from failing tests
  --retry=<N>         Retry failing tests up to N times (tap files: .tap, .retry1.tap, ...)
  --runner=<cmd>      Command used to run each test file (default: node); e.g. --runner=tsx
  --before-each=<cmd> Run a command before each test; test is skipped if the command fails
  --controller=<cmd>  Run a command before tests, kill it when done
  --update-timings    Write .multi-tape-timing.json with per-test runtimes after a clean run
  -- <args>           Pass remaining arguments to each test file

Examples:
  multi-tape test/*.js
  multi-tape -p 4 test/*.js
  multi-tape -P 1.5 test/*.js
  multi-tape -e -p 2 test/*.js
  multi-tape -o test/*.js
  multi-tape test/*.js -- --grep "my test"

For more information, visit: https://github.com/mattiash/node-multi-tape
`)
}

const files = globArgs(argv._)

if (files.length === 0) {
    printHelp()
    process.exit(0)
}

const inProgress = new Set<string>()
let controllerExitedUnexpectedly = false

const okPrefix = process.env.MT_NO_EMOJI ? '' : '✅ '
const failPrefix = process.env.MT_NO_EMOJI ? '' : '❌ '
const retryPrefix = process.env.MT_NO_EMOJI ? '' : '🔄 '
const emptyPrefix = process.env.MT_NO_EMOJI ? '' : '   '
const aborted = new Set<string>()
let abortInProgress = false

function tapFailReason(
    r: FinalResults,
    exitCode: number,
    timedOut: boolean
): string {
    if (timedOut) return ' [timed out]'
    const parts: string[] = []
    if (r.bailout) {
        parts.push('bailed out')
    } else if (r.plan.start === null) {
        parts.push('no TAP plan in output')
    } else if (r.fail === 0) {
        parts.push('TAP validation failed')
    } else {
        // Assertion failures with a valid plan are self-evident in the TAP output
        return ''
    }
    if (exitCode !== 0) {
        parts.push(`exit code ${exitCode}`)
    }
    return ` [${parts.join(', ')}]`
}

function printTestResult(file: string, res: Result) {
    const { exitCode, result: r, executionTime, signal, timedOut } = res
    const timeStr = `${(executionTime / 1000).toFixed(1)}s`

    if (res.beforeEachFailed) {
        console.log(`${failPrefix}FAIL ${file} (before-each command failed)`)
        if (res.beforeEachFile) {
            console.log(`${emptyPrefix}     See ${res.beforeEachFile}`)
        }
        return
    }

    if (exitCode === 0 && r.ok) {
        console.log(`${okPrefix}OK   ${file} (${timeStr}) ${r.pass}/${r.count}`)
    } else {
        if (!r.ok) {
            console.log(
                `${failPrefix}FAIL ${file} (${timeStr}) ${r.pass || 0}/${r.count || 0}${tapFailReason(r, exitCode, timedOut ?? false)}`
            )
        } else if (signal) {
            console.log(
                `${failPrefix}FAIL ${file} exited with signal ${signal}${timedOut ? ' [timed out]' : ''}`
            )
        } else {
            console.log(
                `${failPrefix}FAIL ${file} exited with error ${exitCode}`
            )
        }
        if (argv.o || argv.O) {
            const retryCount = res.retries?.length ?? 0
            const tapFile =
                retryCount > 0
                    ? argv.O
                        ? `${argv.O}${file}.retry${retryCount}.tap`
                        : `${file}.retry${retryCount}.tap`
                    : argv.O
                      ? `${argv.O}${file}.tap`
                      : `${file}.tap`
            console.log(`${emptyPrefix}     See ${tapFile}`)
        }
    }
}

async function thread(executorName?: string): Promise<number> {
    let file: string | undefined
    let lastCompletionTime = Date.now()
    // tslint:disable-next-line:no-conditional-assignment
    while ((file = files.shift())) {
        if (!abortInProgress) {
            inProgress.add(file)

            const priorAttempts: FailedAttempt[] = []
            let result!: Result
            let retryNumber = 0

            while (true) {
                // Run before-each before every attempt, including retries
                if (argv['before-each']) {
                    const beforeEach = await runBeforeEach(
                        argv['before-each'],
                        executorName
                    )
                    if (!beforeEach.ok) {
                        let beforeEachFile: string | undefined
                        if (argv.o || argv.O) {
                            beforeEachFile = argv.O
                                ? `${argv.O}${file}.before-each.tap`
                                : `${file}.before-each.tap`
                            await mkdir(dirname(beforeEachFile), {
                                recursive: true,
                            })
                            await writeFile(beforeEachFile, beforeEach.output)
                        } else {
                            process.stdout.write(beforeEach.output)
                        }
                        result = {
                            exitCode: 1,
                            executionTime: 0,
                            result: { ok: false } as FinalResults,
                            signal: '',
                            beforeEachFailed: true,
                            beforeEachFile,
                        }
                        break
                    }
                }

                result = await runTest(
                    file,
                    nodeArgs,
                    parallelism === 1,
                    argv.o || !!argv.O,
                    argv.j,
                    argv.t,
                    argv.q,
                    argv.e,
                    argv.O,
                    passthroughArgs,
                    executorName,
                    retryNumber,
                    argv.runner
                )

                const failed = result.exitCode !== 0 || !result.result.ok
                if (failed && retryNumber < argv.retry) {
                    const tapFile =
                        retryNumber === 0
                            ? argv.O
                                ? `${argv.O}${file}.tap`
                                : `${file}.tap`
                            : argv.O
                              ? `${argv.O}${file}.retry${retryNumber}.tap`
                              : `${file}.retry${retryNumber}.tap`
                    priorAttempts.push({
                        executionTime: result.executionTime,
                        result: result.result,
                        tapFile,
                    })
                    const timeStr = `${(result.executionTime / 1000).toFixed(1)}s`
                    const r = result.result
                    console.log(
                        `${retryPrefix}RETRY ${file} (${timeStr}) ${r.pass || 0}/${r.count || 0}`
                    )
                    if (argv.o || argv.O) {
                        console.log(`${emptyPrefix}     See ${tapFile}`)
                    }
                    retryNumber++
                } else {
                    break
                }
            }

            if (!result.beforeEachFailed && priorAttempts.length > 0) {
                result = { ...result, retries: priorAttempts }
            }

            inProgress.delete(file)
            results.set(file, result)
            lastCompletionTime = Date.now()
            if (argv.q) {
                printTestResult(file, result)
            }
        }
    }
    return lastCompletionTime
}

async function run() {
    let controller: ReturnType<typeof spawn> | undefined
    let controllerRunning = false
    let controllerKilledByUs = false
    let stdoutBuffer = ''
    let stderrBuffer = ''
    if (argv.controller) {
        await new Promise<void>((resolve, reject) => {
            controller = spawn(argv.controller, [], {
                shell: true,
                stdio: ['ignore', 'pipe', 'pipe'],
            })

            controller.stdout?.on('data', (data) => {
                stdoutBuffer += data
                if (!argv.q && !argv.e) {
                    console.log(`controller: ${data}`)
                }
                if (!controllerRunning) {
                    controllerRunning = true
                    resolve()
                }
            })

            controller.stderr?.on('data', (data) => {
                stderrBuffer += data
                if (!argv.q && !argv.e) {
                    console.error(`controller: ${data}`)
                }
            })

            controller.on('error', (code) => {
                reject()
                console.log(`controller error ${code}`)
            })

            controller.on('close', () => {
                if (controllerRunning && !controllerKilledByUs) {
                    controllerExitedUnexpectedly = true
                    console.error('controller exited unexpectedly')
                    if (argv.q || argv.e) {
                        if (stderrBuffer) {
                            console.error(stderrBuffer)
                        }
                        if (stdoutBuffer) {
                            console.log(stdoutBuffer)
                        }
                    }
                    abort()
                }
                controllerRunning = false
            })
        })
    }

    try {
        const content = await readFile(TIMINGS_FILE, 'utf8')
        const timings: Record<string, number> = JSON.parse(content)
        files.sort((a, b) => (timings[b] ?? -1) - (timings[a] ?? -1))
    } catch {
        // No timings file or unreadable — proceed with original order
    }

    runStartTime = Date.now()
    threadLastCompletionTimes = await Promise.all(
        executorList
            ? executorList.map((name) => thread(name))
            : new Array(parallelism).fill(0).map(() => thread())
    )
    runEndTime = Date.now()

    if (argv['update-timings'] && !abortInProgress) {
        const timings: Record<string, number> = {}
        for (const key of [...results.keys()].sort()) {
            timings[key] = results.get(key)!.executionTime
        }
        await writeFile(TIMINGS_FILE, JSON.stringify(timings, null, 2) + '\n')
    }

    if (controller && controllerRunning) {
        if (!argv.q && !argv.e) {
            console.log('controller: stopping')
        }

        // Set up a timeout in case the controller doesn't exit cleanly
        const killTimeout = setTimeout(() => {
            if (!argv.q && !argv.e) {
                console.warn(
                    'controller: did not exit after SIGTERM, sending SIGKILL'
                )
            }
            controller?.kill('SIGKILL')
        }, 5000).unref()

        controller.once('close', () => {
            clearTimeout(killTimeout)
        })

        controllerKilledByUs = true
        controller.kill()
        controller.stdout?.destroy()
        controller.stderr?.destroy()
    }

    printSummary()
}

function printSummary() {
    let success = true
    if (!argv.q) {
        console.log('')
        let totalPass = 0;
        let totalCount = 0;
        for (const [file, res] of [...results.entries()].sort(
            (a, b) => a[1].executionTime - b[1].executionTime
        )) {
            printTestResult(file, res)
            if (res.exitCode !== 0 || !res.result.ok) {
                success = false
            }
            const { result: r } = res
            totalPass += r.pass;
            totalCount += r.count;
        }
        if (success && totalPass === totalCount) {
          console.log(`${okPrefix}OK   Total ${totalPass}/${totalCount}`)
        } else {
          console.log(`${failPrefix}FAIL Total ${totalPass}/${totalCount}`)
        }

    } else {
        // In quiet mode, just check for failures
        for (const [, res] of results.entries()) {
            if (res.exitCode !== 0 || !res.result.ok) {
                success = false
            }
        }
    }

    if (runStartTime > 0) {
        const displayEnd = runEndTime || Date.now()
        const wallTime = displayEnd - runStartTime
        console.log(`\nTotal: ${(wallTime / 1000).toFixed(1)}s`)
        if (parallelism > 1 && threadLastCompletionTimes.length > 0) {
            const idleStrs = threadLastCompletionTimes
                .map((t) => `${((displayEnd - t) / 1000).toFixed(1)}s`)
                .join(', ')
            console.log(`Executor idle times: ${idleStrs}`)
        }
    }

    if (aborted.size > 0) {
        console.log(`\n${failPrefix}multi-tape aborted. Tests in progress: `)
        aborted.forEach((file) => console.log(`  ${file}`))
        success = false
    }

    if (controllerExitedUnexpectedly) {
        success = false
    }

    if (!success) {
        process.exit(1)
    }
}

function abort() {
    abortInProgress = true
    inProgress.forEach((p) => {
        aborted.add(p)
    })
    setTimeout(printSummary, 5000).unref()
}

process.on('SIGTERM', abort)
process.on('SIGINT', abort)

if (process.env.MT_DEBUG_INTERVAL) {
    setInterval(() => {
        console.log(`## Queued: ${files.length}`)
        console.log(`## Running: ${[...inProgress.keys()]}`)
    }, parseInt(process.env.MT_DEBUG_INTERVAL)).unref()
}

void run()
