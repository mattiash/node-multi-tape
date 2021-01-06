import 'source-map-support/register'
import { test } from 'purple-tape'
import { globArgs } from '../lib/glob'

test("Glob parses this project's test/*.ts", async t => {
    let arg = ['test/test*.ts']
    let result = globArgs(arg)

    t.deepEqual(
        result.sort(),
        [
            'test/test-aaa-large-output.ts',
            'test/test-glob.ts',
            'test/test-never-exit.ts',
        ],
        'shall return an array of filenames'
    )
})

test('Glob still parses an actual file', t => {
    let arg = ['test/test-glob.ts']
    let result = globArgs(arg)
    t.deepEqual(result, arg, 'shall return the name of a file that exists')
})

test('A combination of different inputs', t => {
    let arg = [
        'test/test-glob.ts',
        'test/test-*.ts',
        'wibble/wibble123.example',
        'wibble/*.wibblet',
    ]

    // NOTE: Wibble-related paths do not exist. These should still be passed to the test runner,
    // in order to comply with the previous implementation.

    let result = globArgs(arg)

    t.deepEqual(result.sort(), [
        'test/test-aaa-large-output.ts',
        'test/test-glob.ts',
        'test/test-glob.ts',
        'test/test-never-exit.ts',
        'wibble/*.wibblet',
        'wibble/wibble123.example',
    ])
})
