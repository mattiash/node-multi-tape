import { exec } from 'child_process'
import { promisify } from 'util'
const execP = promisify(exec)

async function run() {
    try {
        await execP('node build/index.js -t 1000 build/test/never-exit.js')
        console.log("Execution succeeded when it shouldn't have")
        process.exit(1)
    } catch (err:any) {
        if (err.code === 1) {
            console.log(`Execution interrupted with timeout.\nok 1
1..1
# tests 1
# pass 1

# ok
`)
        }
    }
}

void run()
