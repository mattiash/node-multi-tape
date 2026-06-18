import { test } from 'purple-tape'
import { runMultiTape } from './helpers'
import { existsSync, readFileSync, unlinkSync } from 'fs'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const PASSING = 'build/test-fixtures/tap-passing.js'
const FAILING = 'build/test-fixtures/tap-failing.js'
const CRASH = 'build/test-fixtures/tap-crash.js'
const FAIL_ONCE = 'build/test-fixtures/fail-once.js'

test('xunit: xml file is created for passing test', async (t) => {
    const outDir = mkdtempSync(join(tmpdir(), 'mt-xunit-'))
    try {
        const { exitCode } = await runMultiTape(['-j', `-O${outDir}/`, PASSING])
        t.equal(exitCode, 0, 'exits 0')
        const xmlPath = join(outDir, `${PASSING}.xml`)
        t.ok(existsSync(xmlPath), 'xml file created')
        const xml = readFileSync(xmlPath, 'utf8')
        t.ok(xml.includes('<?xml'), 'has xml declaration')
        t.ok(xml.includes('<testsuites'), 'has testsuites element')
        t.ok(xml.includes('<testsuite'), 'has testsuite element')
        t.ok(xml.includes('<testcase'), 'has testcase element')
        t.ok(xml.includes('status="success"'), 'testcase status is success')
        t.ok(xml.includes('name="test one"'), 'first test case name present')
        t.ok(xml.includes('name="test two"'), 'second test case name present')
        t.ok(!xml.includes('<failure'), 'no failure elements')
    } finally {
        rmSync(outDir, { recursive: true, force: true })
    }
})

test('xunit: xml file contains failure element for failing test', async (t) => {
    const outDir = mkdtempSync(join(tmpdir(), 'mt-xunit-'))
    try {
        const { exitCode } = await runMultiTape(['-j', `-O${outDir}/`, FAILING])
        t.equal(exitCode, 1, 'exits 1')
        const xmlPath = join(outDir, `${FAILING}.xml`)
        t.ok(existsSync(xmlPath), 'xml file created')
        const xml = readFileSync(xmlPath, 'utf8')
        t.ok(xml.includes('status="failed"'), 'has failed testcase')
        t.ok(xml.includes('<failure'), 'has failure element')
        t.ok(xml.includes('status="success"'), 'passing test also present')
    } finally {
        rmSync(outDir, { recursive: true, force: true })
    }
})

test('xunit: xml file is created when test crashes with no output', async (t) => {
    const outDir = mkdtempSync(join(tmpdir(), 'mt-xunit-'))
    try {
        const { exitCode } = await runMultiTape(['-j', `-O${outDir}/`, CRASH])
        t.equal(exitCode, 1, 'exits 1')
        const xmlPath = join(outDir, `${CRASH}.xml`)
        t.ok(existsSync(xmlPath), 'xml file created even for crash')
        const xml = readFileSync(xmlPath, 'utf8')
        t.ok(xml.includes('<?xml'), 'has xml declaration')
        t.ok(xml.includes('<testcase'), 'has testcase element')
    } finally {
        rmSync(outDir, { recursive: true, force: true })
    }
})

test('xunit: xml files created for all retry attempts', async (t) => {
    const outDir = mkdtempSync(join(tmpdir(), 'mt-xunit-'))
    const marker = join(tmpdir(), `mt-xunit-fail-once-${Date.now()}`)
    if (existsSync(marker)) unlinkSync(marker)
    try {
        const { exitCode } = await runMultiTape(
            ['--retry=1', '-j', `-O${outDir}/`, FAIL_ONCE],
            { FAIL_ONCE_MARKER: marker }
        )
        t.equal(exitCode, 0, 'exits 0 after passing on retry')
        t.ok(
            existsSync(join(outDir, `${FAIL_ONCE}.xml`)),
            'xml for first attempt created'
        )
        t.ok(
            existsSync(join(outDir, `${FAIL_ONCE}.retry1.xml`)),
            'xml for retry1 created'
        )
    } finally {
        if (existsSync(marker)) unlinkSync(marker)
        rmSync(outDir, { recursive: true, force: true })
    }
})

test('xunit: -j with -O creates both xml and tap files', async (t) => {
    const outDir = mkdtempSync(join(tmpdir(), 'mt-xunit-'))
    try {
        const { exitCode } = await runMultiTape(['-j', `-O${outDir}/`, PASSING])
        t.equal(exitCode, 0, 'exits 0')
        const xmlPath = join(outDir, `${PASSING}.xml`)
        t.ok(existsSync(xmlPath), 'xml file created')
        const tapPath = join(outDir, `${PASSING}.tap`)
        t.ok(existsSync(tapPath), 'tap file also created with -O')
    } finally {
        rmSync(outDir, { recursive: true, force: true })
    }
})

test('xunit: xml filename uses test filename as suite name', async (t) => {
    const outDir = mkdtempSync(join(tmpdir(), 'mt-xunit-'))
    try {
        await runMultiTape(['-j', `-O${outDir}/`, PASSING])
        const xmlPath = join(outDir, `${PASSING}.xml`)
        const xml = readFileSync(xmlPath, 'utf8')
        t.ok(
            xml.includes('name="tap-passing.js"'),
            'suite name is the test filename'
        )
    } finally {
        rmSync(outDir, { recursive: true, force: true })
    }
})
