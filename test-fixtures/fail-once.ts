import { existsSync, writeFileSync, unlinkSync } from 'fs'

const marker = process.env.FAIL_ONCE_MARKER
if (!marker) {
    process.stdout.write(
        'TAP version 13\n1..1\nnot ok 1 FAIL_ONCE_MARKER env var not set\n'
    )
    process.exit(1)
}

if (existsSync(marker)) {
    unlinkSync(marker)
    process.stdout.write('TAP version 13\n1..1\nok 1 passed on retry\n')
} else {
    writeFileSync(marker, '')
    process.stdout.write('TAP version 13\n1..1\nnot ok 1 first attempt fails\n')
    process.exit(1)
}
