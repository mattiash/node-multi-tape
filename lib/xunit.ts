import type { Result } from 'tap-parser'

export interface TapCommentEvent {
    type: 'comment'
    data: string
}

export interface TapAssertEvent {
    type: 'assert'
    data: Result
}

export type TapEvent = TapCommentEvent | TapAssertEvent

interface XunitTestCase {
    name: string
    assertions: number
    status: 'success' | 'failed' | 'error' | 'skipped'
    durationMs: number
    message?: string
}

function attr(v: string): string {
    return v
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
}

function isSummaryComment(comment: string): boolean {
    return /^#\s+(tests|pass|fail)\s/.test(comment.trim())
}

function formatDiag(diag: unknown): string {
    if (!diag) return ''
    if (typeof diag !== 'object') return String(diag)
    return Object.entries(diag as Record<string, unknown>)
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join('\n')
}

export function buildXunitFromTapEvents(
    events: TapEvent[],
    suiteName: string,
    startTime: Date
): string {
    const testCases: XunitTestCase[] = []
    let currentCase: XunitTestCase | null = null

    for (const event of events) {
        if (event.type === 'comment') {
            const comment = event.data.trim()
            if (isSummaryComment(comment)) continue

            if (currentCase) {
                testCases.push(currentCase)
                currentCase = null
            }

            const skipMatch = comment.match(/^#\s+SKIP\s+(.+)$/)
            if (skipMatch) {
                testCases.push({
                    name: skipMatch[1].trim(),
                    assertions: 0,
                    status: 'skipped',
                    durationMs: 0,
                })
            } else {
                const title = comment.replace(/^#\s*/, '').trim()
                if (title) {
                    currentCase = {
                        name: title,
                        assertions: 0,
                        status: 'success',
                        durationMs: 0,
                    }
                }
            }
        } else {
            const result = event.data
            if (!currentCase) {
                currentCase = {
                    name: suiteName,
                    assertions: 0,
                    status: 'success',
                    durationMs: 0,
                }
            }
            currentCase.assertions++
            if (!result.ok && !result.skip && !result.todo) {
                if (currentCase.status === 'success') {
                    currentCase.status = 'failed'
                    const diagMsg = formatDiag(result.diag)
                    currentCase.message = diagMsg
                        ? `${result.name}\n${diagMsg}`
                        : result.name
                }
            }
        }
    }

    if (currentCase) {
        testCases.push(currentCase)
    }

    if (testCases.length === 0) {
        testCases.push({
            name: suiteName,
            assertions: 1,
            status: 'error',
            durationMs: 0,
            message: 'No test results found in TAP output',
        })
    }

    return generateXml(testCases, suiteName, startTime)
}

function generateXml(
    testCases: XunitTestCase[],
    suiteName: string,
    startTime: Date
): string {
    let tests = 0
    let skipped = 0
    let errors = 0
    let failures = 0
    let totalDurationMs = 0

    for (const tc of testCases) {
        tests++
        totalDurationMs += tc.durationMs
        if (tc.status === 'error') errors++
        else if (tc.status === 'skipped') skipped++
        else if (tc.status === 'failed') failures++
    }

    let r = '<?xml version="1.0" encoding="UTF-8"?>'
    r += `<testsuites tests="${tests}" skipped="${skipped}" errors="${errors}" failures="${failures}" name="${attr(suiteName)}" time="${(totalDurationMs / 1000).toFixed(3)}">`
    r += `<testsuite tests="${tests}" skipped="${skipped}" errors="${errors}" failures="${failures}" name="${attr(suiteName)}" time="${(totalDurationMs / 1000).toFixed(3)}" timestamp="${startTime.toISOString()}">`

    for (const tc of testCases) {
        r += `<testcase name="${attr(tc.name)}" classname="${attr(suiteName)}" assertions="${tc.assertions}" status="${tc.status}" time="${(tc.durationMs / 1000).toFixed(3)}">`
        if (tc.status === 'failed') {
            r += `<failure message="not used" type="notUsed"><![CDATA[${tc.message ?? ''}]]></failure>`
        } else if (tc.status === 'error') {
            r += `<error message="not used" type="notUsed"><![CDATA[${tc.message ?? ''}]]></error>`
        } else if (tc.status === 'skipped') {
            r += '<skipped/>'
        }
        r += '</testcase>'
    }

    r += '</testsuite>'
    r += '</testsuites>'
    return r
}

export function prematureXunit(name: string, startTime: Date): string {
    const safeName = attr(name)
    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites tests="1" skipped="0" errors="1" failures="0" name="${safeName}" time="0">
<testsuite tests="1" skipped="0" errors="1" failures="0" name="${safeName}" time="0" timestamp="${startTime.toISOString()}">
<testcase name="no premature exit" classname="${safeName}" assertions="1" status="error" time="0">
<error message="not used" type="notUsed"><![CDATA[Test exited without writing a proper xml-file]]></error>
</testcase>
</testsuite>
</testsuites>`
}
