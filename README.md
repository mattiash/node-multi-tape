# multi-tape

![Build master](https://github.com/mattiash/node-multi-tape/workflows/Build%20master/badge.svg)
![Publish to npm](https://github.com/mattiash/node-multi-tape/workflows/Publish%20Package/badge.svg)
![npm version](https://badge.fury.io/js/multi-tape.svg)

A tool for running [tape](https://github.com/substack/tape) tests in multiple files. Goes well together with [purple-tape](https://www.npmjs.com/package/purple-tape)

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

- -O <dir> send output to a specified directory. For example, `-O tapFiles/` will
  write the output for `build/test/test-file.js` to `tapFiles/build/test/test-file.js.tap`.

- --node-arg=--opt Send an option to node when invoking the test-file. Can be
  used more than once.

- -p=X Run X tests in parallel. If X > 1, the output from each test is buffered
  until the test is finished. Without this, the output from different tests would
  be mixed.

- -P=X Run X tests per CPU core. For example, `-P 1.5` on a 4-core machine will run
  6 tests in parallel (1.5 × 4 = 6). The result is rounded down and will always be
  at least 1. Cannot be used together with `-p`.

- -j Generate a JUnit XML file for each test file. The output filename is the name
  of the test-file with '.xml' appended (e.g. `test/foo.js.xml`). When combined
  with `-O`, XML files are written into the output directory alongside the `.tap`
  files. XML files are always written — including for each retry attempt and even
  if the test process crashes with no TAP output.

- -t 10000 Timeout in ms for how long each test-file is allowed to run. Default is no timeout.

- -q Quiet mode. Suppresses all output except the final summary of which test-files
  succeeded and which failed. Can be combined with -o to write output to files
  without printing to stdout.

- -e Errors-only mode. Only prints output from failing tests, plus the summary at the end.
  Useful for CI environments where you only want to see failures.

- --controller="command with parameters" Run a command before starting the tests. Wait for the command to print something on stdout before starting the tests. Kill the command when all tests are done.

- --update-timings Write `.multi-tape-timing.json` in the working directory with the runtime of each test file after a clean run. The file is human-readable JSON, sorted alphabetically. Add it to `.gitignore` to avoid committing it on every run.

  If `.multi-tape-timing.json` already exists it is read automatically at startup and tests are reordered slowest-first to minimise total wall time. Test files not present in the file are assumed to be fast and run last.

- --failures-last Change the sort order of test results in the summary so that results for failed tests appear after results for passing tests.

- --retry=N Retry each failing test up to N times. A `🔄 RETRY` status line is printed immediately when a test fails and will be retried. Tap files for each attempt are named differently to preserve them all: the original attempt uses the normal `.tap` name, and retries use `.retry1.tap`, `.retry2.tap`, and so on.

- --before-each="command" Run a shell command before each test file (and before each retry attempt). The command must produce TAP output. If it exits non-zero or its TAP output contains a failure, the test is not run and is reported as failed. The environment variable `MULTI_TAPE_EXECUTOR` is set when `--executors` is also in use.

  Without `-o`/`-O`, a failing before-each command's output is printed inline. With `-o`/`-O`, it is written to a sidecar file named `<test-file>.before-each.tap`.

- --executors=exec1,exec2,... Run tests using a fixed set of named executors instead of a numeric parallelism count. Each executor runs one test at a time, so the number of executors determines how many tests run in parallel. The executor name is passed to each test and its before-each command as the `MULTI_TAPE_EXECUTOR` environment variable. Cannot be combined with `-p` or `-P`.

  Executors are just strings to multi-tape — their meaning is entirely up to the test and before-each command.

- `-- arg1 arg2 ...` Pass extra arguments to every test file. Arguments after `--` are appended to the command line of each spawned test process.

  ```
  multi-tape test/*.js -- --grep "my test"
  ```

## Summary output

At the end of every run multi-tape prints the total wall-clock runtime. When running with `-p` or `-P`, it also prints how long each executor was idle at the end — a large idle time indicates that reordering tests with `--update-timings` could reduce the total runtime. With `--failures-last` results for failed tests are printed after results for passed tests.

## Exit code

multi-tape exits with code 1 if any test failed as shown by the tap-results or
if any test-script exited with a non-zero code.

# License

MIT License

Copyright (c) 2018-2026, Mattias Holmlund, <mattias@holmlund.se>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
