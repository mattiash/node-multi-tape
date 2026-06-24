process.stdout.write(
    [
        'TAP version 13',
        'ok 1 first check',
        'ok 2 second check',
        '',
    ].join('\n')
)
// No plan line — simulates a process that exits before the exit handler writes 1..N
