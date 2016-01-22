# multi-tape

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

- -o send output to one file per test-file. The output filename will be the name
of the test-file with '.tap' appended. The result will still be printed to
STDOUT.

- --node-arg=--opt Send an option to node when invoking the test-file. Can be
used more than once.
