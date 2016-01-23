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
var streams = require('memory-streams')
var spawn = require('child_process').spawn
var fs = require('fs')

var results = {}
var exitCodes = {}
var outputs = {}

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

    var output

    var parsed = new Promise(function(resolve) {
        var p = parser( resolve );
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
            outputs[filename] = output.toString()
            console.log(outputs[filename])
        }

    }).catch(console.dir)
}

function streamToString(stream, cb) {
    const chunks = [];
    stream.on('data', (chunk) => {
        chunks.push(chunk);
    });
    stream.on('end', () => {
        cb(chunks.join(''));
    });
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
