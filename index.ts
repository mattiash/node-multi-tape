#! /usr/bin/env node

import { globArgs } from './lib/glob'
import { runTest } from './lib/run-test'

const argv: {
    o: boolean
    p: number
    'node-arg': string | string[]
    _: string[]
} = require('minimist')(process.argv.slice(2), {
    boolean: ['o'],
    default: {
        p: 1,
    },
})

const results = new Map<string, any>()
const exitCodes = new Map<string, number>()

const nodeArgs = new Array<string>()

if (argv['node-arg']) {
    if (Array.isArray(argv['node-arg'])) {
        nodeArgs.push(...argv['node-arg'])
    } else {
        nodeArgs.push(argv['node-arg'])
    }
}

const files = globArgs(argv._).sort()

async function thread() {
    let file: string | undefined
    while ((file = files.shift())) {
        console.log('file', file)
        const result = await runTest(file, nodeArgs, argv.p === 1, argv.o)
        results.set(file, result.result)
        exitCodes.set(file, result.exitCode)
    }
}

async function run() {
    await Promise.all(new Array(argv.p).fill(0).map(() => thread()))
    printSummary()
}

function printSummary() {
    let success = true
    for (let file of results.keys()) {
        const exitCode = exitCodes.get(file)
        const r = results.get(file)

        if (exitCode === 0 && r.ok) {
            console.log(`OK   ${file} ${r.pass}/${r.count}`)
        } else if (!r.ok) {
            success = false
            console.log(`FAIL ${file} ${r.pass}/${r.count}`)
        } else {
            success = false
            console.log(`FAIL ${file} exited with error ${exitCode}`)
        }
    }

    if (!success) {
        process.exit(1)
    }
}

run()
