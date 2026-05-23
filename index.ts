#! /usr/bin/env node

import { spawn } from 'child_process'
import { availableParallelism } from 'os'
import { globArgs } from './lib/glob'
import { Result, runTest } from './lib/run-test'
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
}>(process.argv.slice(2), {
    boolean: ['o', 'j', 'q', 'e'],
    string: ['O'],
    default: { p: 1, t: 0 },
})

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
    PValue: number | undefined
): number {
    // Validate mutual exclusivity
    if (pValue !== undefined && PValue !== undefined) {
        console.error('Error: Cannot specify both -p and -P flags.')
        console.error(
            'Use -p for absolute parallelism or -P for per-core parallelism.'
        )
        process.exit(1)
    }

    // Calculate per-core parallelism
    if (PValue !== undefined) {
        const cpuCount = getCpuCount()
        return Math.max(1, Math.floor(PValue * cpuCount))
    }

    // Use absolute parallelism or default
    return pValue ?? 1
}

const results = new Map<string, Result>()

// Calculate effective parallelism based on -p or -P flags
const parallelism = calculateParallelism(
    argv.p !== 1 ? argv.p : undefined,
    argv.P
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
  -j                  Generate JUnit XML output (.xml extension)
  -t <ms>             Timeout in milliseconds for each test file
  -q                  Quiet mode - only show test results as they complete
  -e                  Errors-only mode - only show output from failing tests
  --controller=<cmd>  Run a command before tests, kill it when done

Examples:
  multi-tape test/*.js
  multi-tape -p 4 test/*.js
  multi-tape -P 1.5 test/*.js
  multi-tape -e -p 2 test/*.js
  multi-tape -o test/*.js

For more information, visit: https://github.com/mattiash/node-multi-tape
`)
}

const files = globArgs(argv._)

if (files.length === 0) {
    printHelp()
    process.exit(0)
}

const inProgress = new Set<string>()

const okPrefix = process.env.MT_NO_EMOJI ? '' : '✅ '
const failPrefix = process.env.MT_NO_EMOJI ? '' : '❌ '
const emptyPrefix = process.env.MT_NO_EMOJI ? '' : '   '
const aborted = new Set<string>()
let abortInProgress = false

function printTestResult(file: string, res: Result) {
    const { exitCode, result: r, executionTime, signal } = res
    const timeStr = `${(executionTime / 1000).toFixed(1)}s`

    if (exitCode === 0 && r.ok) {
        console.log(`${okPrefix}OK   ${file} (${timeStr}) ${r.pass}/${r.count}`)
    } else {
        if (!r.ok) {
            console.log(
                `${failPrefix}FAIL ${file} (${timeStr}) ${r.pass || 0}/${r.count || 0}`
            )
        } else if (signal) {
            console.log(
                `${failPrefix}FAIL ${file} exited with signal ${signal}`
            )
        } else {
            console.log(
                `${failPrefix}FAIL ${file} exited with error ${exitCode}`
            )
        }
        if (argv.o || argv.O) {
            const tapFile = argv.O ? `${argv.O}${file}.tap` : `${file}.tap`
            console.log(`${emptyPrefix}     See ${tapFile}`)
        }
    }
}

async function thread() {
    let file: string | undefined
    // tslint:disable-next-line:no-conditional-assignment
    while ((file = files.shift())) {
        if (!abortInProgress) {
            inProgress.add(file)
            const result = await runTest(
                file,
                nodeArgs,
                parallelism === 1,
                argv.o || !!argv.O,
                argv.j,
                argv.t,
                argv.q,
                argv.e,
                argv.O
            )
            inProgress.delete(file)
            results.set(file, result)
            if (argv.q) {
                printTestResult(file, result)
            }
        }
    }
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

    await Promise.all(new Array(parallelism).fill(0).map(() => thread()))

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
        for (const [file, res] of [...results.entries()].sort(
            (a, b) => a[1].executionTime - b[1].executionTime
        )) {
            printTestResult(file, res)
            if (res.exitCode !== 0 || !res.result.ok) {
                success = false
            }
        }
    } else {
        // In quiet mode, just check for failures
        for (const [, res] of results.entries()) {
            if (res.exitCode !== 0 || !res.result.ok) {
                success = false
            }
        }
    }

    if (aborted.size > 0) {
        console.log(`\n${failPrefix}multi-tape aborted. Tests in progress: `)
        aborted.forEach((file) => console.log(`  ${file}`))
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
