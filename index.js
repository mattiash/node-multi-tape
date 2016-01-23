#! /usr/bin/env node

'use strict'

var argv = require('minimist')(process.argv.slice(2),{
    boolean: ['o'],
    default: {
        p: 1
    }
})

var parser = require('tap-parser')
var tee = require('tee')
var spawn = require('child_process').spawn
var fs = require('fs')

var results = {}
var exitCodes = {}

var nodeArgs = []
if(argv['node-arg']) {
    if(Array.isArray(argv['node-arg'])) {
        nodeArgs = argv['node-arg']
    }
    else {
        nodeArgs.push(argv['node-arg'])
    }
}

var files = argv._.sort()

// Start argv.p tests in parallel
let runners = []
for(let n=0; n<argv.p; n++) {
    runners.push(runTests())
}

Promise.all( runners )
  .then(printSummary).catch(console.dir)

function runTests() {
    if(files.length) {
        return new Promise(function(resolve) {
            var file = files.shift()
            resolve(runTest(file).then(runTests))
        })
    }
    else {
        return Promise.resolve(true)
    }
}

// Returns a promise that resolves whe the test has been run
function runTest(filename) {
    var proc = spawn('node', nodeArgs.concat(filename))
    var exited = new Promise( function(resolve) {
        proc.on('exit', function (exitCode) {
            resolve(exitCode)
        });
    })

    var parsed = new Promise(function(resolve) {
        var p = parser( resolve );

        console.log('')
        console.log('#')
        console.log('# ' + filename)
        console.log('#')

        if(argv.o) {

            proc.stdout.pipe(tee(p, fs.createWriteStream(filename + '.tap') ))
                .pipe(process.stdout)
        }
        else {
            proc.stdout.pipe(tee(p)).pipe(process.stdout)
        }
        proc.stderr.pipe(process.stderr)
    })

    return Promise.all([exited, parsed]).then(function(values) {
        exitCodes[filename] = values[0]
        results[filename] = values[1]
    }).catch(console.dir)
}

function printSummary() {
    var success = true
    for(let file of Object.keys(results).sort()) {
        if(exitCodes[file] !== 0) {
            success = false
            console.log(file + ' exited with error ' + exitCodes[file])
        }
        else {
            var r = results[file]
            if( !r.ok ) {
                success = false
            }
            console.log(file + (r.ok ? ' ok ' : ' fail ') + r.pass + '/' + r.count)
        }
    }

    if(!success) {
        process.exit(1)
    }
}
