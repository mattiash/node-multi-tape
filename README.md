# multi-tape

[![Build Status](https://travis-ci.org/mattiash/node-multi-tape.svg?branch=master)](https://travis-ci.org/mattiash/node-multi-tape)

A tool for running [tape](https://github.com/substack/tape) tests in multiple files

## Background

tape is a very useful framework for doing unit tests in node.js. It is normally
used to run tests with

    tape test/*.js

This has one very nasty gotcha however. Since it runs all tests in a single node
instance, global variables and mocks will spread between the tests in an
uncontrolled manner.

multi-tape solves this by running each js-file in a separate node-process.

## Basic usage

Write your tape-based tests in several js-files. Then run

    npm install multi-tape
    ./node_modules/.bin/multi-tape test/*.js

to actually run the tests. This will run the test-files in alphabetical order,
with output sent to stdout and print a summary at the end

## Options

-   -o send output to one file per test-file. The output filename will be the name
    of the test-file with '.tap' appended. The result will still be printed to
    STDOUT.

-   --node-arg=--opt Send an option to node when invoking the test-file. Can be
    used more than once.

-   -p=X Run X tests in parallel. If X > 1, the output from each test is buffered
    until the test is finished. Without this, the output from different tests would
    be mixed.

-   -j Pass in environment variables to purple-tape to make it produce
    a junit xml-file. The output filename will be the name
    of the test-file with '.xml' appended.

## Exit code

multi-tape exits with code 1 if any test failed as shown by the tap-results or
if any test-script exited with a non-zero code.

# License

MIT License

Copyright (c) 2018-2020, Mattias Holmlund, <mattias@holmlund.se>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
