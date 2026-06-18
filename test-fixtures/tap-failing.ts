process.stdout.write(
    [
        'TAP version 13',
        '# test one',
        'ok 1 first check passes',
        '# test two',
        'not ok 2 second check fails',
        '  ---',
        '  operator: equal',
        '  expected: 1',
        '  actual: 2',
        '  ...',
        '1..2',
        '# tests 2',
        '# pass  1',
        '# fail  1',
        '',
    ].join('\n')
)
process.exit(1)
