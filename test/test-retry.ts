import { test } from 'purple-tape'
import { runMultiTape } from './helpers'
import { existsSync, unlinkSync, readFileSync } from 'fs'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const FAIL = 'build/test-fail/test-fail.js'
const FAIL_ONCE = 'build/test-fixtures/fail-once.js'

test('retry: always-failing test is retried N times then exits 1', async (t) => {
    const { exitCode, output } = await runMultiTape(['--retry=2', FAIL])
    t.equal(exitCode, 1, 'exits 1 after all retries exhausted')
    const retryCount = (output.match(/RETRY/g) ?? []).length
    t.equal(retryCount, 2, 'RETRY appears once per retry decision (2 retries = 2 lines)')
})

test('retry: correct tap files created for each attempt', async (t) => {
    const outDir = mkdtempSync(join(tmpdir(), 'mt-retry-'))
    try {
        const { exitCode } = await runMultiTape([
            '--retry=2',
            `-O${outDir}/`,
            FAIL,
        ])
        t.equal(exitCode, 1, 'exits 1')
        t.ok(existsSync(join(outDir, `${FAIL}.tap`)), 'original attempt .tap created')
        t.ok(existsSync(join(outDir, `${FAIL}.retry1.tap`)), '.retry1.tap created')
        t.ok(existsSync(join(outDir, `${FAIL}.retry2.tap`)), '.retry2.tap created')
    } finally {
        rmSync(outDir, { recursive: true, force: true })
    }
})

test('retry: RETRY lines include See links when -O is set', async (t) => {
    const outDir = mkdtempSync(join(tmpdir(), 'mt-retry-'))
    try {
        const { output } = await runMultiTape([
            '--retry=1',
            `-O${outDir}/`,
            FAIL,
        ])
        t.ok(output.includes('See'), 'See link present in output')
        t.ok(output.includes('.tap'), 'tap file path present in See line')
    } finally {
        rmSync(outDir, { recursive: true, force: true })
    }
})

test('retry: test that fails once then passes exits 0 with RETRY then OK', async (t) => {
    const marker = join(tmpdir(), `mt-fail-once-${Date.now()}`)
    if (existsSync(marker)) unlinkSync(marker)
    try {
        const { exitCode, output } = await runMultiTape(
            ['--retry=1', FAIL_ONCE],
            { FAIL_ONCE_MARKER: marker }
        )
        t.equal(exitCode, 0, 'exits 0 after passing on retry')
        t.ok(output.includes('RETRY'), 'RETRY line present for the failed first attempt')
        t.ok(output.includes('OK'), 'OK line present in summary')
    } finally {
        if (existsSync(marker)) unlinkSync(marker)
    }
})

test('retry: before-each re-runs on each retry attempt', async (t) => {
    const counter = join(tmpdir(), `mt-before-each-counter-${Date.now()}`)
    if (existsSync(counter)) unlinkSync(counter)
    try {
        // before-each appends to counter file, then emits valid TAP so the test runs
        const { exitCode } = await runMultiTape([
            '--retry=2',
            `--before-each=(echo x >> "${counter}"; printf "TAP version 13\\n1..1\\nok 1 counted\\n")`,
            FAIL,
        ])
        t.equal(exitCode, 1, 'exits 1 (test always fails)')
        const lines = readFileSync(counter, 'utf8').trim().split('\n')
        t.equal(lines.length, 3, 'before-each ran 3 times (original + 2 retries)')
    } finally {
        if (existsSync(counter)) unlinkSync(counter)
    }
})
