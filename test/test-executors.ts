import { test } from 'purple-tape'
import { runMultiTape } from './helpers'

const FIXTURE = 'build/test-fixtures/print-executor.js'
const PASS = 'build/test/test-aaa-large-output.js'

test('executors: MULTI_TAPE_EXECUTOR is set to executor name', async (t) => {
    const { exitCode, output } = await runMultiTape([
        '--executors=worker1',
        FIXTURE,
    ])
    t.equal(exitCode, 0, 'exits 0')
    t.ok(output.includes('MULTI_TAPE_EXECUTOR=worker1'), 'executor name appears in output')
})

test('executors: each executor name appears when running multiple tests', async (t) => {
    const { exitCode, output } = await runMultiTape([
        '--executors=alpha,beta',
        FIXTURE,
        FIXTURE,
    ])
    t.equal(exitCode, 0, 'exits 0')
    t.ok(output.includes('MULTI_TAPE_EXECUTOR=alpha'), 'alpha appears in output')
    t.ok(output.includes('MULTI_TAPE_EXECUTOR=beta'), 'beta appears in output')
})

test('executors: mutually exclusive with -p', async (t) => {
    const { exitCode, output } = await runMultiTape([
        '-p', '2',
        '--executors=a',
        PASS,
    ])
    t.equal(exitCode, 1, 'exits 1')
    t.ok(output.includes('Cannot'), 'error message mentions conflict')
})

test('executors: mutually exclusive with -P', async (t) => {
    const { exitCode, output } = await runMultiTape([
        '-P', '1',
        '--executors=a',
        PASS,
    ])
    t.equal(exitCode, 1, 'exits 1')
    t.ok(output.includes('Cannot'), 'error message mentions conflict')
})
