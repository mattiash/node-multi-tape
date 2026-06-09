process.stdout.write(
    `TAP version 13\n1..1\n${process.env.CUSTOM_RUNNER_USED === '1' ? 'ok' : 'not ok'} 1 custom runner was used\n`
)
