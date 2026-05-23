import { test } from 'purple-tape'

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms))

test('succeeds after 5s', async (t) => {
    await sleep(5_000)
    t.pass()
})
