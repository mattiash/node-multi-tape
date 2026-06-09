# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Features

- Add `--runner=<cmd>` option to specify the command used to run test files (default: `node`). For example, `--runner=tsx` runs each test as `tsx <testfile>`.

### Dependencies

- Update glob 13.0.0 → 13.0.6
- Update tap-parser 18.0.3 → 18.3.4

## [1.13.2] 2026-06-01

### Fixes

- Fix race condition where the TAP plan line could be missed if the child process emitted `exit` before all stdout data was flushed: switched from `exit` to `close` event, which fires only after all stdio streams are fully closed
- Fix race condition in `runBeforeEach` on Linux where the `exit` event fired before stdout was fully drained, causing before-each failures to be silently ignored: use `Promise.all` to register both the TAP-parser and process-close listeners before any `await`

## [1.13.1] 2026-05-26

### Fixes

- Write JUnit XML file to the `-O` output directory when both `-j` and `-O` are used

## [1.13.0] 2026-05-23

### Features

- `--retry=N` retries each failing test up to N times. A `🔄 RETRY` status line is printed immediately when a retry is triggered. Tap files from each attempt are preserved with distinct names: `.tap` for the first attempt, `.retry1.tap`, `.retry2.tap`, … for subsequent ones.
- `--before-each="command"` runs a shell command before each test (and before each retry attempt). The command must produce TAP output; a failure blocks the test from running. The `MULTI_TAPE_EXECUTOR` environment variable is set when `--executors` is also active. On failure, output is printed inline or written to `<test>.before-each.tap` when `-o`/`-O` is in use.
- `--executors=exec1,exec2,...` runs tests with a fixed set of named executors instead of a numeric parallelism count. The executor name is passed to each test and its before-each command as `MULTI_TAPE_EXECUTOR`. Cannot be combined with `-p` or `-P`.
- `-- arg1 arg2 ...` passes extra arguments to every spawned test process.

## [1.12.1] 2026-05-23

### Fixes

- Fix race condition where controller early exit was not detected as a failure when no tests had started yet: exit code was 0 instead of 1
- Update transitive dependencies to resolve Dependabot security alerts (minimatch, flatted, yaml, picomatch, js-yaml, brace-expansion, ajv)

## [1.12.0] 2026-05-23 [RETRACTED]

### Features

- Print total wall-clock runtime at end of every run
- Print per-executor idle times at end of run when using `-p` or `-P` (helps identify scheduling imbalance)
- Auto-read `.multi-tape-timing.json` from the working directory and reorder tests slowest-first to minimise wall time; unknown tests run last
- `--update-timings` flag writes `.multi-tape-timing.json` with per-test runtimes after a clean run (alphabetically sorted, human-readable JSON)

### Fixes

- Fix double-printing of controller stdout/stderr on early exit: in default mode output was already printed live, so skip the buffer dump; only dump buffers in -q/-e mode where live output was suppressed. Also print the "controller exited unexpectedly" message before the buffer dump.

## [1.11.4] 2026-03-24

### Fixes

- Detect controller early exit as a fatal error: print buffered stdout/stderr, print "controller exited unexpectedly", abort remaining tests, and exit non-zero

## [1.11.3] 2026-02-10

### Fixes

- Improve robustness for --controller process handling

## [1.11.2] 2025-12-10

### Features

- Run tests in the order specified by arguments
- Abort tests properly on SIGTERM/SIGINT

## [1.11.1] 2025-11-23

### Fixes

- Update tap-parser to fix https://github.com/tapjs/tapjs/issues/1056
- Update glob to resolve security warning.

## [1.11.0] 2025-11-23

### Features

- Add -P option for per-core parallelism (e.g., -P 1.5 on 4 cores = 6 parallel tests)

## [1.10.1] 2024-11-16

### Features

- Add emojis to test summary output (✅ for OK, ❌ for FAIL)
- Add MT_NO_EMOJI environment variable to disable emoji output

## [1.10.0] 2025-11-15

### Features

- Show output file name for failing tests when using -o option
- Add -O option to specify output directory for tap files

## [1.9.0] 2025-11-14

### Features

- Add -e option for errors-only mode that only prints output from failing tests plus the summary
- Show help message when run without arguments

## [1.8.0] 2025-11-14

### Features

- Add -q option for quiet mode that suppresses all output except test results, which are printed immediately as each test completes

## [1.7.2] 2025-11-09

### Features

- Update all dependencies to latest versions
- Upgrade to ESLint 9 and typescript-eslint 8
- Upgrade glob to v11 and tap-parser to v18
- Upgrade @types/node to v24

### Fixes

- Modernize import syntax to use standard ES module imports
- Add esModuleInterop to TypeScript configuration for better module compatibility

## [1.7.1] 2024-07-03

- Update dependencies and github actions

## [1.7.0] 2022-06-20

- Add a --controller argument

## [1.6.1] 2021-01-29

- Add MT_DEBUG_INTERVAL setting
- Send SIGKILL if SIGTERM does not cause test to exit

## [1.6.0] 2021-01-06

- Timeout for test execution

## [1.5.0] 2020-12-14

- Build with github actions
- Update dependencies
- Print execution time for each test in summary and order entries by execution time

## [1.4.0] 2020-04-15

- Add -j option to generate junit xml with purple-tape

## [1.3.1] 2019-12-13

### Fixes

- Split up output in smaller chunks to avoid overflowing stdout
  buffers which will terminate node with
  `write /dev/stdout: resource temporarily unavailable`
  Fix by @zommarin.

## [1.3.0] 2019-06-28

Rewritten in typescript using async/await

### New features

- Show which tests were running if multi-tape is
  terminated with a signal

### Fixes

- Updated outdated dependencies

## [1.2.1] 2018-09-05

### Fixes

- Fix #3 Hangs with too much output on stdout

## [1.2.0] - 2018-04-15

### Features

- Add support for file globbing on windows. Fixes #1. Patch by @LordScree.
