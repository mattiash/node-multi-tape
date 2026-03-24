/**
 * Bug condition exploration test for controller early exit.
 *
 * Property 1: Bug Condition - Controller Early Exit Is Not Detected
 *
 * This test MUST FAIL on unfixed code — that failure confirms the bug exists.
 * When the fix is applied, this test will pass.
 *
 * Validates: Requirements 1.1, 1.2, 1.3
 */

import { spawn } from 'child_process'

/**
 * Run multi-tape with the given arguments and return exit code + combined output.
 */
function runMultiTape(
    args: string[]
): Promise<{ exitCode: number; output: string }> {
    return new Promise((resolve) => {
        const chunks: Buffer[] = []
        const proc = spawn('node', ['build/index.js', ...args], {
            stdio: ['ignore', 'pipe', 'pipe'],
        })

        proc.stdout.on('data', (d: Buffer) => chunks.push(d))
        proc.stderr.on('data', (d: Buffer) => chunks.push(d))

        proc.on('close', (code) => {
            resolve({
                exitCode: code ?? 1,
                output: Buffer.concat(chunks).toString(),
            })
        })
    })
}

/**
 * Returns true if all assertions pass (bug is fixed), false if any fail (bug exists).
 * Does NOT call process.exit — callers decide the final exit code.
 */
async function runBugConditionTest(): Promise<boolean> {
    console.log(
        'Property 1: Bug Condition — controller exits immediately while slow test is running'
    )
    console.log(
        'Expected on UNFIXED code: multi-tape exits 0 and prints no error (BUG)'
    )
    console.log(
        'Expected on FIXED code:   multi-tape exits non-zero and prints "controller exited unexpectedly"'
    )
    console.log('')

    // Controller exits immediately after emitting stdout (the handshake line).
    // The slow test file takes 30 seconds, so the controller is guaranteed to
    // have exited long before the test suite finishes.
    const { exitCode, output } = await runMultiTape([
        '--controller',
        'echo ready && exit 0',
        'build/test-fail/test-30s.js',
    ])

    console.log(`Exit code: ${exitCode}`)
    console.log(`Output:\n${output}`)

    let passed = true

    // Assertion 1: multi-tape must exit non-zero when controller exits early
    if (exitCode === 0) {
        console.error(
            'FAIL: Expected non-zero exit code, but got 0. ' +
                'multi-tape exited successfully even though the controller died mid-run. ' +
                'Counterexample: multi-tape exits 0 even though controller died mid-run.'
        )
        passed = false
    } else {
        console.log(`PASS: Exit code is non-zero (${exitCode})`)
    }

    // Assertion 2: output must contain the error message
    if (!output.includes('controller exited unexpectedly')) {
        console.error(
            'FAIL: Expected output to contain "controller exited unexpectedly", but it did not. ' +
                'Counterexample: no error message printed about controller exiting unexpectedly.'
        )
        passed = false
    } else {
        console.log('PASS: Output contains "controller exited unexpectedly"')
    }

    if (!passed) {
        console.error(
            '\nBug confirmed: multi-tape does not detect or report controller early exit.'
        )
    } else {
        console.log('\nAll assertions passed — bug is fixed.')
    }

    return passed
}

/**
 * Preservation property tests for controller early exit bugfix.
 *
 * Property 2: Preservation - Normal Controller Shutdown and No-Controller Runs Are Unchanged
 *
 * These tests MUST PASS on unfixed code — they capture baseline behavior to preserve.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

// A fast passing test file to use in preservation tests.
// Using build/test/test-aaa-large-output.js (compiled, exits 0 quickly).
const FAST_PASSING_TEST = 'build/test/test-aaa-large-output.js'

async function runPreservationTests() {
    let allPassed = true

    // -------------------------------------------------------------------------
    // Preservation 1 (Req 3.2): No --controller flag — exit code is 0 and all
    // tests run for any set of passing test files.
    // Parameterised over: single file, multiple files.
    // -------------------------------------------------------------------------
    console.log(
        'Preservation 1 (Req 3.2): No --controller flag — exit 0 and all tests run'
    )

    const noControllerCases: Array<{ label: string; files: string[] }> = [
        { label: 'single passing file', files: [FAST_PASSING_TEST] },
        {
            label: 'two passing files',
            files: [FAST_PASSING_TEST, FAST_PASSING_TEST],
        },
    ]

    for (const { label, files } of noControllerCases) {
        const { exitCode, output } = await runMultiTape([...files])
        if (exitCode !== 0) {
            console.error(
                `FAIL [${label}]: Expected exit code 0 without --controller, got ${exitCode}`
            )
            console.error(`Output:\n${output}`)
            allPassed = false
        } else {
            console.log(`PASS [${label}]: exit code 0`)
        }
        if (output.includes('controller exited unexpectedly')) {
            console.error(
                `FAIL [${label}]: Output unexpectedly contains "controller exited unexpectedly"`
            )
            allPassed = false
        } else {
            console.log(
                `PASS [${label}]: no "controller exited unexpectedly" in output`
            )
        }
    }

    // -------------------------------------------------------------------------
    // Preservation 2 (Req 3.1): Normal controller lifetime — controller outlives
    // tests, is killed by multi-tape. Exit code determined solely by test results.
    // No "exited unexpectedly" message.
    // -------------------------------------------------------------------------
    console.log(
        '\nPreservation 2 (Req 3.1): Normal controller lifetime — killed by multi-tape, exit based on test results'
    )

    // Controller sleeps 30s — guaranteed to outlive the fast test file.
    const { exitCode: normalExitCode, output: normalOutput } =
        await runMultiTape([
            '--controller',
            'sh -c "echo ready && sleep 30"',
            FAST_PASSING_TEST,
        ])

    if (normalExitCode !== 0) {
        console.error(
            `FAIL: Expected exit code 0 for passing tests with long-lived controller, got ${normalExitCode}`
        )
        console.error(`Output:\n${normalOutput}`)
        allPassed = false
    } else {
        console.log(`PASS: exit code 0 (test results determine exit code)`)
    }

    if (normalOutput.includes('controller exited unexpectedly')) {
        console.error(
            'FAIL: Output contains "controller exited unexpectedly" for a normal controller run'
        )
        console.error(`Output:\n${normalOutput}`)
        allPassed = false
    } else {
        console.log('PASS: no "controller exited unexpectedly" in output')
    }

    // Verify controller was stopped (multi-tape kills it)
    if (!normalOutput.includes('controller: stopping')) {
        console.error(
            'FAIL: Expected "controller: stopping" in output when multi-tape kills controller'
        )
        console.error(`Output:\n${normalOutput}`)
        allPassed = false
    } else {
        console.log(
            'PASS: "controller: stopping" present — controller killed cleanly'
        )
    }

    // -------------------------------------------------------------------------
    // Preservation 3 (Req 3.4): Controller stdout/stderr forwarding — output
    // from a healthy controller appears in multi-tape output (unless -q/-e).
    // -------------------------------------------------------------------------
    console.log(
        '\nPreservation 3 (Req 3.4): Controller stdout forwarding — healthy controller output appears in multi-tape output'
    )

    const UNIQUE_MARKER = 'PRESERVATION_MARKER_12345'

    // Controller emits a known unique string to stdout, then sleeps until killed.
    const { exitCode: fwdExitCode, output: fwdOutput } = await runMultiTape([
        '--controller',
        `sh -c "echo ready && echo ${UNIQUE_MARKER} && sleep 30"`,
        FAST_PASSING_TEST,
    ])

    if (fwdExitCode !== 0) {
        console.error(
            `FAIL: Expected exit code 0 for output-forwarding test, got ${fwdExitCode}`
        )
        console.error(`Output:\n${fwdOutput}`)
        allPassed = false
    } else {
        console.log('PASS: exit code 0')
    }

    if (!fwdOutput.includes(UNIQUE_MARKER)) {
        console.error(
            `FAIL: Expected controller stdout marker "${UNIQUE_MARKER}" to appear in multi-tape output`
        )
        console.error(`Output:\n${fwdOutput}`)
        allPassed = false
    } else {
        console.log(
            `PASS: controller stdout marker "${UNIQUE_MARKER}" forwarded to output`
        )
    }

    // Verify -q suppresses controller output (Req 3.4 "unless -q/-e")
    console.log(
        '\nPreservation 3b (Req 3.4): With -q flag, controller stdout is suppressed'
    )

    const { exitCode: quietExitCode, output: quietOutput } = await runMultiTape(
        [
            '-q',
            '--controller',
            `sh -c "echo ready && echo ${UNIQUE_MARKER} && sleep 30"`,
            FAST_PASSING_TEST,
        ]
    )

    if (quietExitCode !== 0) {
        console.error(
            `FAIL: Expected exit code 0 with -q flag, got ${quietExitCode}`
        )
        console.error(`Output:\n${quietOutput}`)
        allPassed = false
    } else {
        console.log('PASS: exit code 0 with -q')
    }

    if (quietOutput.includes(UNIQUE_MARKER)) {
        console.error(
            `FAIL: Controller stdout marker "${UNIQUE_MARKER}" should be suppressed with -q`
        )
        console.error(`Output:\n${quietOutput}`)
        allPassed = false
    } else {
        console.log(
            `PASS: controller stdout marker suppressed with -q as expected`
        )
    }

    // -------------------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------------------
    console.log('')
    if (allPassed) {
        console.log(
            'All preservation tests PASSED — baseline behavior confirmed on unfixed code.'
        )
    } else {
        console.error(
            'Some preservation tests FAILED — baseline behavior is not as expected.'
        )
        process.exit(1)
    }
}

async function main() {
    // Run preservation tests first — these MUST pass on unfixed code.
    console.log('=== Preservation Tests (Property 2) ===\n')
    await runPreservationTests()

    // Run bug condition test — this is EXPECTED to fail on unfixed code.
    console.log('\n=== Bug Condition Test (Property 1) ===\n')
    const bugConditionPassed = await runBugConditionTest()

    if (!bugConditionPassed) {
        // Bug confirmed on unfixed code — expected outcome.
        // Preservation tests already passed (or they would have exited non-zero above).
        console.log(
            '\nSummary: Preservation tests PASSED, bug condition confirmed (expected on unfixed code).'
        )
        process.exit(1)
    } else {
        console.log(
            '\nSummary: All tests passed — bug is fixed and preservation holds.'
        )
    }
}

void main()
