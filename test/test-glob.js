const test = require('tape')
const path = require('path')
const multi_tape = require('../index.js')

test("Glob parses this project's test/*.js", function(t) {
    t.plan(3)

    let arg = ['test/*.js']
    let result = multi_tape.globArgs(arg)

    let expected = true
    let actual = Array.isArray(result)
    t.equal(
        Array.isArray(result),
        true,
        'Is result array - Expected: ' + expected + ', Actual: ' + actual,
    )

    // TODO: There's probably an easy way to count the number of JS files in the test/ directory to make this test future-proof...
    expected = 1
    actual = result.length
    t.equal(
        actual,
        expected,
        'Number of .js files found by glob - Expected: ' +
            expected +
            ', Actual: ' +
            actual,
    )

    expected = 'test/' + path.basename(__filename)
    actual = result[0]
    t.equal(
        actual,
        expected,
        'Is result expected filename - Expected: ' +
            expected +
            '; Actual: ' +
            actual,
    )
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
        'Is result array - Expected: ' + expected + ', Actual: ' + actual,
    )

    expected = 'test/' + path.basename(__filename)
    actual = result[0]
    t.equal(
        actual,
        expected,
        'Is result expected filename - Expected: ' +
            expected +
            '; Actual: ' +
            actual,
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

    let expected = true
    let actual = Array.isArray(result)
    t.equal(
        Array.isArray(result),
        true,
        'Is result array - Expected: ' + expected + ', Actual: ' + actual,
    )

    // We're expecting 4 - 1 for each of the "legal" files and 2 for the wibble arguments, which will remain untouched.
    // TODO: If the number of test files changes, this test will fail...
    expected = 4
    actual = result.length
    t.equal(
        actual,
        expected,
        'Number of .js files found by glob - Expected: ' +
            expected +
            ', Actual: ' +
            actual,
    )

    expected = 'test/' + path.basename(__filename)
    actual = result[0]
    t.equal(
        actual,
        expected,
        'Is result expected filename - Expected: ' +
            expected +
            '; Actual: ' +
            actual,
    )

    expected = 'test/' + path.basename(__filename)
    actual = result[1]
    t.equal(
        actual,
        expected,
        'Is result expected filename - Expected: ' +
            expected +
            '; Actual: ' +
            actual,
    )

    expected = 'wibble/wibble123.example'
    actual = result[2]
    t.equal(
        actual,
        expected,
        'Is result expected filename - Expected: ' +
            expected +
            '; Actual: ' +
            actual,
    )

    expected = 'wibble/*.wibblet'
    actual = result[3]
    t.equal(
        actual,
        expected,
        'Is result expected filename - Expected: ' +
            expected +
            '; Actual: ' +
            actual,
    )
})
