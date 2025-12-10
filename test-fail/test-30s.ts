import { test } from 'purple-tape'

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms))

test('succeeds after 30s', async (t) => {
    await sleep(30_000)
    t.pass()
})
