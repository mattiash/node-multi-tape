#! /usr/bin/env node

'use strict'

const argv = require('minimist')(process.argv.slice(2),{
    boolean: ['o'],
    default: {
        p: 1
    }
})

const parser = require('tap-parser')
const tee = require('tee')
const streams = require('memory-streams')
const spawn = require('child_process').spawn
const fs = require('fs')
const async = require('async-p')
const glob = require('glob')

let results = {}
let exitCodes = {}

let nodeArgs = []
if(argv['node-arg']) {
    if(Array.isArray(argv['node-arg'])) {
        nodeArgs = argv['node-arg']
    }
    else {
        nodeArgs.push(argv['node-arg'])
    }
}

// Use glob to parse any test file args for patterns.
function globArgs(argv_) {
    let globbedFiles = []

    if(!Array.isArray(argv_))
    {
        globbedFiles = glob.sync(argv_, {cwd: __dirname})
    }
    else
    {
        for (var i = 0; i < argv_.length; i++) {
            globbedFiles.concat(glob.sync(argv_[i], { cwd: __dirname }))
        }
    }

    return globbedFiles
}
module.exports.globArgs = globArgs

let files = globArgs(argv._).sort()

// Start argv.p tests in parallel
async.eachLimit(files, runTest, argv.p)
    .then(printSummary)
    .catch(console.dir) // eslint-disable-line no-console

// Returns a promise that resolves whe the test has been run
function runTest(filename) {
    let proc = spawn('node', nodeArgs.concat(filename))
    let exited = new Promise( function(resolve) {
        proc.on('exit', function (exitCode) {
            resolve(exitCode)
        })
    })

    let output

    let parsed = new Promise(function(resolve) {
        let p = parser( resolve )
        if(argv.p === 1) {
            output = process.stdout
        }
        else {
            output = new streams.WritableStream()
        }

        output.write('\n#\n# ' + filename + '\n#\n')

        if(argv.o) {
            proc.stdout.pipe(tee(p, fs.createWriteStream(filename + '.tap') ))
                .pipe(output)
        }
        else {
            proc.stdout.pipe(tee(p)).pipe(output)
        }
        proc.stderr.pipe(output)
    })

    return Promise.all([exited, parsed]).then(function(values) {
        exitCodes[filename] = values[0]
        results[filename] = values[1]
        if( argv.p > 1 ) {
            console.log(output.toString()) // eslint-disable-line no-console
        }

    }).catch(console.dir) // eslint-disable-line no-console
}

function printSummary() {
    let success = true
    for(let file of Object.keys(results).sort()) {
        if(exitCodes[file] !== 0) {
            success = false
            console.log(file + ' exited with error ' + exitCodes[file]) // eslint-disable-line no-console
        }
        else {
            let r = results[file]
            if( !r.ok ) {
                success = false
            }
            console.log(file + (r.ok ? ' ok ' : ' fail ') + r.pass + '/' + r.count) // eslint-disable-line no-console
        }
    }

    if(!success) {
        process.exit(1)
    }
}
