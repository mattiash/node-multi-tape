const test = require('tape')
const path = require('path')
const multi_tape = require('../index.js')

const FILES_IN_TEST_DIR = 2

test("Glob parses this project's test/*.js", function(t) {
    t.plan(3)

    let arg = ['test/*.js']
    let result = multi_tape.globArgs(arg)

    let expected = true
    let actual = Array.isArray(result)
    t.equal(
        Array.isArray(result),
        true,
        'Is result array - Expected: ' + expected + ', Actual: ' + actual
    )

    expected = FILES_IN_TEST_DIR
    actual = result.length
    t.equal(
        actual,
        expected,
        'Number of .js files found by glob - Expected: ' +
            expected +
            ', Actual: ' +
            actual
    )

    expected = 'test/' + path.basename(__filename)
    actual = result[0]
    t.ok(result.includes(expected), 'result includes expected file')
})

test('Glob still parses an actual file', function(t) {
    t.plan(2)

    let arg = ['test/test-glob.js']
    let result = multi_tape.globArgs(arg)

    let expected = true
    let actual = Array.isArray(result)
    t.equal(
        Array.isArray(result),
        true,
        'Is result array - Expected: ' + expected + ', Actual: ' + actual
    )

    expected = 'test/' + path.basename(__filename)
    actual = result[0]
    t.equal(
        actual,
        expected,
        'Is result expected filename - Expected: ' +
            expected +
            '; Actual: ' +
            actual
    )
})

test('A combination of different inputs', function(t) {
    t.plan(6)

    let arg = [
        'test/test-glob.js',
        'test/*.js',
        'wibble/wibble123.example',
        'wibble/*.wibblet',
    ]

    // NOTE: Wibble-related paths do not exist. These should still be passed to the test runner,
    // in order to comply with the previous implementation.

    let result = multi_tape.globArgs(arg)

    t.equal(Array.isArray(result), true, 'result is an Array')

    // We're expecting 1 for each of the test-files, 1 for the explicit test-files and 2 for the wibble arguments, which will remain untouched.
    t.equal(
        result.length,
        FILES_IN_TEST_DIR + 3,
        'Correct number of .js files found by glob'
    )

    t.equal(
        result[0],
        'test/' + path.basename(__filename),
        'Expected filename first in array'
    )

    t.equal(
        result.filter(e => e === 'test/' + path.basename(__filename)).length,
        2,
        'test-glob.js found twice'
    )

    t.ok(
        result.includes('wibble/wibble123.example'),
        'Explicitly named file included'
    )

    t.ok(result.includes('wibble/*.wibblet'), 'Non-matching wildcard included')
})
