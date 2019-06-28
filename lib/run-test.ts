const Parser = require('tap-parser')
const tee = require('tee')
import * as streams from 'stream-buffers'
import { spawn } from 'child_process'
import { createWriteStream } from 'fs'

interface Result {
    exitCode: number
    result: any
}

// Returns a promise that resolves whe the test has been run
// logConsole = argv.p === 1
export async function runTest(
    filename: string,
    nodeArgs: string[],
    logConsole: boolean,
    outputToFile: boolean
): Promise<Result> {
    let proc = spawn('node', nodeArgs.concat(filename))
    let exited = new Promise<number>(resolve => {
        proc.on('exit', (exitCode: number) => resolve(exitCode))
    })

    const output = logConsole
        ? process.stdout
        : new streams.WritableStreamBuffer()
    output.write('\n#\n# ' + filename + '\n#\n')

    let parsed = new Promise<any>(resolve => {
        let p = new Parser(resolve)

        if (outputToFile) {
            proc.stdout
                .pipe(tee(p, createWriteStream(filename + '.tap')))
                .pipe(output)
        } else {
            proc.stdout.pipe(tee(p)).pipe(output)
        }
        proc.stderr.pipe(output)
    })

    const exitCode = await exited
    const result = await parsed

    if (!logConsole) {
        console.log(
            (output as streams.WritableStreamBuffer).getContentsAsString('utf8')
        )
    }

    return {
        exitCode,
        result,
    }
}