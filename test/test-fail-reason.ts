import { test } from 'purple-tape'
import { runMultiTape } from './helpers'

const NO_PLAN = 'build/test-fixtures/tap-no-plan.js'
const FAILING = 'build/test-fixtures/tap-failing.js'

test('fail reason: missing plan shows [no TAP plan in output]', async (t) => {
    const { exitCode, output } = await runMultiTape([NO_PLAN])
    t.equal(exitCode, 1, 'exits 1')
    t.ok(
        output.includes('[no TAP plan in output]'),
        'FAIL line includes reason'
    )
})

test('fail reason: assertion failures show no reason bracket', async (t) => {
    const { exitCode, output } = await runMultiTape([FAILING])
    t.equal(exitCode, 1, 'exits 1')
    t.notOk(
        /FAIL.*\[/.test(output),
        'FAIL line has no reason bracket when assertions failed'
    )
})
