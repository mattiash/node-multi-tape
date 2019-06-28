import * as glob from 'glob'

export function globArgs(argv_: any) {
    let globbedFiles = new Array<string>()
    for (var i = 0; i < argv_.length; i++) {
        let globResult = glob.sync(argv_[i])

        if (globResult.length < 1) {
            // Glob found nothing. Just add this argument as-is.
            globbedFiles.push(argv_[i])
        } else {
            globbedFiles = globbedFiles.concat(globResult)
        }
    }
    return globbedFiles
}
