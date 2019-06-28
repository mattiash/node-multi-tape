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
        if (exitCodes.get(file) !== 0) {
            success = false
            console.log(file + ' exited with error ' + exitCodes.get(file))
        } else {
            let r = results.get(file)
            if (!r.ok) {
                success = false
            }
            console.log(
                file + (r.ok ? ' ok ' : ' fail ') + r.pass + '/' + r.count
            )
        }
    }

    if (!success) {
        process.exit(1)
    }
}

run()
