#! /usr/bin/env node

import { spawn } from 'child_process'
import { globArgs } from './lib/glob'
import { Result, runTest } from './lib/run-test'
import parseArgs from 'minimist'

const argv = parseArgs<{
    o: boolean
    O: string
    p: number
    j: boolean
    t: number
    q: boolean
    e: boolean
}>(process.argv.slice(2), {
    boolean: ['o', 'j', 'q', 'e'],
    string: ['O'],
    default: { p: 1, t: 0 },
})

const results = new Map<string, Result>()

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
  -j                  Generate JUnit XML output (.xml extension)
  -t <ms>             Timeout in milliseconds for each test file
  -q                  Quiet mode - only show test results as they complete
  -e                  Errors-only mode - only show output from failing tests
  --controller=<cmd>  Run a command before tests, kill it when done

Examples:
  multi-tape test/*.js
  multi-tape -p 4 test/*.js
  multi-tape -e -p 2 test/*.js
  multi-tape -o test/*.js

For more information, visit: https://github.com/mattiash/node-multi-tape
`)
}

const files = globArgs(argv._).sort()

if (files.length === 0) {
    printHelp()
    process.exit(0)
}

const inProgress = new Set<string>()

const aborted = new Set<string>()

function printInProgress() {
    inProgress.forEach((file) => {
        aborted.add(file)
    })
}

function printTestResult(file: string, res: Result) {
    const { exitCode, result: r, executionTime } = res
    const timeStr = `${(executionTime / 1000).toFixed(1)}s`

    if (exitCode === 0 && r.ok) {
        console.log(`OK   ${file} (${timeStr}) ${r.pass}/${r.count}`)
    } else {
        if (!r.ok) {
            console.log(
                `FAIL ${file} (${timeStr}) ${r.pass || 0}/${r.count || 0}`
            )
        } else {
            console.log(`FAIL ${file} exited with error ${exitCode}`)
        }
        if (argv.o || argv.O) {
            const tapFile = argv.O ? `${argv.O}${file}.tap` : `${file}.tap`
            console.log(`     See ${tapFile}`)
        }
    }
}

async function thread() {
    let file: string | undefined
    // tslint:disable-next-line:no-conditional-assignment
    while ((file = files.shift())) {
        inProgress.add(file)
        const result = await runTest(
            file,
            nodeArgs,
            argv.p === 1,
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

async function run() {
    let controller: ReturnType<typeof spawn> | undefined
    let controllerRunning = false
    if (argv.controller) {
        await new Promise<void>((resolve, reject) => {
            controller = spawn(argv.controller, [], {
                shell: true,
                stdio: ['ignore', 'pipe', 'pipe'],
            })

            controller.stdout?.on('data', (data) => {
                if (!argv.q && !argv.e) {
                    console.log(`controller: ${data}`)
                }
                controllerRunning = true
                resolve()
            })

            controller.stderr?.on('data', (data) => {
                if (!argv.q && !argv.e) {
                    console.error(`controller: ${data}`)
                }
            })

            controller.on('error', (code) => {
                reject()
                console.log(`controller error ${code}`)
            })

            controller.on('close', () => {
                controllerRunning = false
            })
        })
    }

    await Promise.all(new Array(argv.p).fill(0).map(() => thread()))
    if (controller && controllerRunning) {
        if (!argv.q && !argv.e) {
            console.log('controller: stopping')
        }
        controller.once('close', () => printSummary())
        controller.kill()
    } else {
        printSummary()
    }
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
        console.log('\nmulti-tape aborted. Tests in progress: ')
        aborted.forEach((file) => console.log(`  ${file}`))
        success = false
    }

    if (!success) {
        process.exit(1)
    }
}

process.on('SIGTERM', printInProgress)
process.on('SIGINT', printInProgress)

if (process.env.MT_DEBUG_INTERVAL) {
    setInterval(() => {
        console.log(`## Queued: ${files.length}`)
        console.log(`## Running: ${[...inProgress.keys()]}`)
    }, parseInt(process.env.MT_DEBUG_INTERVAL)).unref()
}

void run()
