import { test } from 'purple-tape'
import { runMultiTape } from './helpers'
import { existsSync, readFileSync } from 'fs'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const PASS = 'build/test-fixtures/print-executor.js'

test('before-each: passing before-each allows test to run', async (t) => {
    const { exitCode } = await runMultiTape([
        '--before-each=printf "TAP version 13\\n1..1\\nok 1 setup\\n"',
        PASS,
    ])
    t.equal(exitCode, 0, 'exits 0 when before-each passes')
})

test('before-each: non-zero exit blocks test', async (t) => {
    const { exitCode, output } = await runMultiTape([
        '--before-each=exit 1',
        PASS,
    ])
    t.equal(exitCode, 1, 'exits 1 when before-each fails')
    t.ok(output.includes('before-each command failed'), 'failure reason in output')
})

test('before-each: TAP not-ok exit blocks test', async (t) => {
    const { exitCode, output } = await runMultiTape([
        '--before-each=printf "TAP version 13\\n1..1\\nnot ok 1 setup failed\\n"',
        PASS,
    ])
    t.equal(exitCode, 1, 'exits 1 when before-each TAP fails')
    t.ok(output.includes('before-each command failed'), 'failure reason in output')
})

test('before-each: MULTI_TAPE_EXECUTOR is set in before-each env', async (t) => {
    const { exitCode, output } = await runMultiTape([
        '--executors=exec1',
        '--before-each=printf "EXECUTOR=$MULTI_TAPE_EXECUTOR\\n"; exit 1',
        PASS,
    ])
    t.equal(exitCode, 1, 'exits 1 (before-each fails)')
    t.ok(output.includes('EXECUTOR=exec1'), 'executor name appears in inline before-each output')
})

test('before-each: output written to file when -O is set', async (t) => {
    const outDir = mkdtempSync(join(tmpdir(), 'mt-before-each-'))
    try {
        const { exitCode } = await runMultiTape([
            `-O${outDir}/`,
            '--before-each=printf "UNIQUE_MARKER_12345\\n"; exit 1',
            PASS,
        ])
        t.equal(exitCode, 1, 'exits 1')
        const tapFile = join(outDir, `${PASS}.before-each.tap`)
        t.ok(existsSync(tapFile), '.before-each.tap file created')
        const contents = readFileSync(tapFile, 'utf8')
        t.ok(contents.includes('UNIQUE_MARKER_12345'), 'before-each output in tap file')
    } finally {
        rmSync(outDir, { recursive: true, force: true })
    }
})

test('before-each: output printed inline when no -O/-o flag', async (t) => {
    const { exitCode, output } = await runMultiTape([
        '--before-each=printf "INLINE_MARKER_67890\\n"; exit 1',
        PASS,
    ])
    t.equal(exitCode, 1, 'exits 1')
    t.ok(output.includes('INLINE_MARKER_67890'), 'before-each output appears inline')
})
