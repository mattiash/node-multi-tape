#! /usr/bin/env node

var argv = require('minimist')(process.argv.slice(2),{
    boolean: ['o']
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

runTests(argv._.sort())

function runTests(files) {
    if(files.length) {
        var file = files.shift()
        runTest(file, function(res) {
            runTests(files)
        })
    }
    else {
        printSummary()
    }
}

function runTest(filename, cb) {
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

    Promise.all([exited, parsed]).then(function(values) {
        exitCodes[filename] = values[0]
        results[filename] = values[1]
        cb()
    }).catch(console.dir)
}

function printSummary() {
    var success = true
    for(file of Object.keys(results).sort()) {
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
