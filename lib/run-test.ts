const Parser = require('tap-parser')
const tee = require('tee')
import * as streams from 'stream-buffers'
import { spawn } from 'child_process'
import { createWriteStream } from 'fs'
import { basename } from 'path'
import { Writable } from 'stream'

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
    outputToFile: boolean,
    junitOutput: boolean
): Promise<Result> {
    const extraEnv = {} as any
    if (junitOutput) {
        extraEnv.PT_XUNIT_FILE = filename + '.xml'
        extraEnv.PT_XUNIT_NAME = basename(filename)
    }

    let proc = spawn('node', nodeArgs.concat(filename), {
        env: {
            ...process.env,
            ...extraEnv,
        },
    })
    let exited = new Promise<{ exitCode: number; signal: string }>(resolve => {
        proc.on('exit', (exitCode: number, signal: string) => {
            resolve({ exitCode, signal })
        })
    })

    const output: Writable = logConsole
        ? process.stdout
        : new streams.WritableStreamBuffer()

    output.write(`\n#\n# ${filename}\n#\n`)

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

    const { exitCode, signal } = await exited
    const result = await parsed

    if (!logConsole) {
        const lines = (output as streams.WritableStreamBuffer).getContentsAsString(
            'utf8'
        )
        if (lines) {
            for (const line of lines.split('\n')) {
                console.log(line)
            }
        }
    }

    if (signal) {
        console.log(`${filename} exited with signal ${signal}`)
    }
    return {
        exitCode,
        result,
    }
}
