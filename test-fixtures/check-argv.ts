const found = process.argv.slice(2).includes('passthrough-test-value')
process.stdout.write(
    `TAP version 13\n1..1\n${found ? 'ok' : 'not ok'} 1 argv contains passthrough-test-value\n`
)
if (!found) process.exit(1)
