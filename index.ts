#! /usr/bin/env node

import { globArgs } from './lib/glob'
import { Result, runTest } from './lib/run-test'

const argv: {
    o: boolean
    p: number
    j: boolean
    t: number
    'node-arg': string | string[]
    _: string[]
} = require('minimist')(process.argv.slice(2), {
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

let aborted = new Set<string>()

function printInProgress() {
    inProgress.forEach(file => {
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
    await Promise.all(new Array(argv.p).fill(0).map(() => thread()))
    printSummary()
}

function printSummary() {
    let success = true
    console.log('')
    for (let [file, res] of [...results.entries()].sort(
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
        aborted.forEach(file => console.log(`  ${file}`))
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
