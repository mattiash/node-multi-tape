import { test } from 'purple-tape'
import { runMultiTape } from './helpers'

const FIXTURE = 'build/test-fixtures/check-argv.js'

test('passthrough: sentinel arg reaches test process', async (t) => {
    const { exitCode } = await runMultiTape([FIXTURE, '--', 'passthrough-test-value'])
    t.equal(exitCode, 0, 'multi-tape exits 0 when fixture finds the sentinel in argv')
})

test('passthrough: no phantom args without --', async (t) => {
    const { exitCode } = await runMultiTape([FIXTURE])
    t.equal(exitCode, 1, 'multi-tape exits 1 when fixture does not find the sentinel')
})
