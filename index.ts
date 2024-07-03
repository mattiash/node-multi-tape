#! /usr/bin/env node

import { spawn } from 'child_process'
import { globArgs } from './lib/glob'
import { Result, runTest } from './lib/run-test'
import parseArgs = require('minimist')

const argv = parseArgs<{
    o: boolean
    p: number
    j: boolean
    t: number
}>(process.argv.slice(2), {
    boolean: ['o', 'j'],
    default: {
        p: 1,
        t: 0,
    },
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

const files = globArgs(argv._).sort()
const inProgress = new Set<string>()

const aborted = new Set<string>()

function printInProgress() {
    inProgress.forEach((file) => {
        aborted.add(file)
    })
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
            argv.o,
            argv.j,
            argv.t
        )
        inProgress.delete(file)
        results.set(file, result)
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
                console.log(`controller: ${data}`)
                controllerRunning = true
                resolve()
            })

            controller.stderr?.on('data', (data) => {
                console.error(`controller: ${data}`)
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
        console.log('controller: stopping')
        controller.once('close', () => printSummary())
        controller.kill()
    } else {
        printSummary()
    }
}

function printSummary() {
    let success = true
    console.log('')
    for (const [file, res] of [...results.entries()].sort(
        (a, b) => a[1].executionTime - b[1].executionTime
    )) {
        const { exitCode, result: r, executionTime } = res

        const timeStr = `${(executionTime / 1000).toFixed(1)}s`
        if (exitCode === 0 && r.ok) {
            console.log(`OK   ${file} (${timeStr}) ${r.pass}/${r.count}`)
        } else if (!r.ok) {
            success = false
            console.log(
                `FAIL ${file} (${timeStr}) ${r.pass || 0}/${r.count || 0}`
            )
        } else {
            success = false
            console.log(`FAIL ${file} exited with error ${exitCode}`)
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
