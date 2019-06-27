import * as test from 'purple-tape'
import * as multi_tape from '../index'

test("Glob parses this project's test/*.ts", async t => {
    let arg = ['test/*.ts']
    let result = multi_tape.globArgs(arg)

    t.deepEqual(
        result.sort(),
        ['test/test-aaa-large-output.ts', 'test/test-glob.ts'],
        'shall return an array of filenames'
    )
})

test('Glob still parses an actual file', function(t) {
    let arg = ['test/test-glob.ts']
    let result = multi_tape.globArgs(arg)
    t.deepEqual(result, arg, 'shall return the name of a file that exists')
})

test('A combination of different inputs', function(t) {
    let arg = [
        'test/test-glob.ts',
        'test/*.ts',
        'wibble/wibble123.example',
        'wibble/*.wibblet',
    ]

    // NOTE: Wibble-related paths do not exist. These should still be passed to the test runner,
    // in order to comply with the previous implementation.

    let result = multi_tape.globArgs(arg)

    t.deepEqual(result, [
        'test/test-glob.ts',
        'test/test-aaa-large-output.ts',
        'test/test-glob.ts',
        'wibble/wibble123.example',
        'wibble/*.wibblet',
    ])
})
