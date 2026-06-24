import { test } from 'purple-tape'
import { runMultiTape } from './helpers'

const NO_PLAN = 'build/test-fixtures/tap-no-plan.js'
const FAILING = 'build/test-fixtures/tap-failing.js'
const NEVER_EXIT = 'build/test/never-exit.js'

test('fail reason: missing plan shows [no TAP plan in output]', async (t) => {
    const { exitCode, output } = await runMultiTape([NO_PLAN])
    t.equal(exitCode, 1, 'exits 1')
    t.ok(
        output.includes('[no TAP plan in output]'),
        'FAIL line includes reason'
    )
})

test('fail reason: timeout shows [timed out]', async (t) => {
    const { exitCode, output } = await runMultiTape(['-t', '500', NEVER_EXIT])
    t.equal(exitCode, 1, 'exits 1')
    t.ok(output.includes('[timed out]'), 'FAIL line includes [timed out]')
})

test('fail reason: assertion failures show no reason bracket', async (t) => {
    const { exitCode, output } = await runMultiTape([FAILING])
    t.equal(exitCode, 1, 'exits 1')
    t.notOk(
        /FAIL.*\[/.test(output),
        'FAIL line has no reason bracket when assertions failed'
    )
})
