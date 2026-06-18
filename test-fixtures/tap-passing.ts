process.stdout.write(
    [
        'TAP version 13',
        '# test one',
        'ok 1 first check',
        '# test two',
        'ok 2 second check',
        '1..2',
        '# tests 2',
        '# pass  2',
        '',
    ].join('\n')
)
