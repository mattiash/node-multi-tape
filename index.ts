#! /usr/bin/env node

'use strict'

const argv = require('minimist')(process.argv.slice(2), {
    boolean: ['o'],
    default: {
        p: 1,
    },
})

const Parser = require('tap-parser')
const tee = require('tee')
import * as streams from 'stream-buffers'
import { spawn } from 'child_process'
import { createWriteStream } from 'fs'
const async = require('async-p')
import * as glob from 'glob'

let results = new Map<string, any>()
let exitCodes = new Map<string, number>()

let nodeArgs: any = []
if (argv['node-arg']) {
    if (Array.isArray(argv['node-arg'])) {
        nodeArgs = argv['node-arg']
    } else {
        nodeArgs.push(argv['node-arg'])
    }
}

// Use glob to parse any test file args for patterns.
export function globArgs(argv_: any) {
    let globbedFiles = new Array<string>()
    for (var i = 0; i < argv_.length; i++) {
        let globResult = glob.sync(argv_[i])

        if (globResult.length < 1) {
            // Glob found nothing. Just add this argument as-is.
            globbedFiles.push(argv_[i])
        } else {
            globbedFiles = globbedFiles.concat(globResult)
        }
    }
    return globbedFiles
}
module.exports.globArgs = globArgs

let files = globArgs(argv._).sort()

// Start argv.p tests in parallel
async
    .eachLimit(files, runTest, argv.p)
    .then(printSummary)
    .catch(console.dir) // eslint-disable-line no-console

// Returns a promise that resolves whe the test has been run
function runTest(filename: string) {
    let proc = spawn('node', nodeArgs.concat(filename))
    let exited = new Promise(function(resolve) {
        proc.on('exit', (exitCode: number) => resolve(exitCode))
    })

    let output: NodeJS.WriteStream | streams.WritableStreamBuffer

    let parsed = new Promise(function(resolve) {
        let p = new Parser(resolve)
        if (argv.p === 1) {
            output = process.stdout
        } else {
            output = new streams.WritableStreamBuffer()
        }

        output.write('\n#\n# ' + filename + '\n#\n')

        if (argv.o) {
            proc.stdout
                .pipe(tee(p, createWriteStream(filename + '.tap')))
                .pipe(output)
        } else {
            proc.stdout.pipe(tee(p)).pipe(output)
        }
        proc.stderr.pipe(output)
    })

    return Promise.all([exited, parsed])
        .then(function(values) {
            exitCodes.set(filename, values[0] as number)
            results.set(filename, values[1])
            if (argv.p > 1) {
                console.log(
                    (output as streams.WritableStreamBuffer).getContentsAsString(
                        'utf8'
                    )
                )
            }
        })
        .catch(console.dir)
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
