import { spawn } from 'child_process'

export function runMultiTape(
    args: string[],
    extraEnv?: Record<string, string>
): Promise<{ exitCode: number; output: string }> {
    return new Promise((resolve) => {
        const chunks: Buffer[] = []
        const proc = spawn('node', ['build/index.js', ...args], {
            env: { ...process.env, ...extraEnv },
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
