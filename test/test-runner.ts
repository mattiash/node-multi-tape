import { test } from 'purple-tape'
import { runMultiTape } from './helpers'

const PASS = 'build/test-fixtures/print-executor.js'
const CHECK_RUNNER = 'build/test-fixtures/check-runner-env.js'

test('runner: default (node) runs tests normally', async (t) => {
    const { exitCode } = await runMultiTape([PASS])
    t.equal(exitCode, 0, 'exits 0 with default runner')
})

test('runner: explicit --runner=node runs tests normally', async (t) => {
    const { exitCode } = await runMultiTape(['--runner=node', PASS])
    t.equal(exitCode, 0, 'exits 0 with explicit node runner')
})

test('runner: custom runner is used to run test files', async (t) => {
    const { exitCode } = await runMultiTape([
        '--runner=test-fixtures/env-setting-runner.sh',
        CHECK_RUNNER,
    ])
    t.equal(exitCode, 0, 'exits 0 when custom runner sets expected env var')
})

