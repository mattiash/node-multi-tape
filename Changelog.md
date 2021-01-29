# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

-   Add MT_DEBUG_INTERVAL setting

## [1.6.0] 2021-01-06

-   Timeout for test execution

## [1.5.0] 2020-12-14

-   Build with github actions
-   Update dependencies
-   Print execution time for each test in summary and order entries by execution time

## [1.4.0] 2020-04-15

-   Add -j option to generate junit xml with purple-tape

## [1.3.1] 2019-12-13

### Fixes

-   Split up output in smaller chunks to avoid overflowing stdout
    buffers which will terminate node with
    `write /dev/stdout: resource temporarily unavailable`
    Fix by @zommarin.

## [1.3.0] 2019-06-28

Rewritten in typescript using async/await

### New features

-   Show which tests were running if multi-tape is
    terminated with a signal

### Fixes

-   Updated outdated dependencies

## [1.2.1] 2018-09-05

### Fixes

-   Fix #3 Hangs with too much output on stdout

## [1.2.0] - 2018-04-15

### Features

-   Add support for file globbing on windows. Fixes #1. Patch by @LordScree.
