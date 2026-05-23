const executor = process.env.MULTI_TAPE_EXECUTOR ?? 'undefined'
process.stdout.write(
    `TAP version 13\n# MULTI_TAPE_EXECUTOR=${executor}\n1..1\nok 1 executor env var present\n`
)
