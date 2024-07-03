import 'source-map-support/register'
import { test } from 'purple-tape'
import { globArgs } from '../lib/glob'

test("Glob parses this project's test/*.ts", async (t) => {
    const arg = ['test/test*.ts']
    const result = globArgs(arg)

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

test('Glob still parses an actual file', (t) => {
    const arg = ['test/test-glob.ts']
    const result = globArgs(arg)
    t.deepEqual(result, arg, 'shall return the name of a file that exists')
})

test('A combination of different inputs', (t) => {
    const arg = [
        'test/test-glob.ts',
        'test/test-*.ts',
        'wibble/wibble123.example',
        'wibble/*.wibblet',
    ]

    // NOTE: Wibble-related paths do not exist. These should still be passed to the test runner,
    // in order to comply with the previous implementation.

    const result = globArgs(arg)

    t.deepEqual(result.sort(), [
        'test/test-aaa-large-output.ts',
        'test/test-glob.ts',
        'test/test-glob.ts',
        'test/test-never-exit.ts',
        'wibble/*.wibblet',
        'wibble/wibble123.example',
    ])
})
