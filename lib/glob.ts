import * as glob from 'glob'

export function globArgs(fileSpecs: string[]) {
    let globbedFiles = new Array<string>()
    for (const fileSpec of fileSpecs) {
        const globResult = glob.sync(fileSpec)

        if (globResult.length < 1) {
            // Glob found nothing. Just add this argument as-is.
            globbedFiles.push(fileSpec)
        } else {
            globbedFiles = globbedFiles.concat(globResult)
        }
    }
    return globbedFiles
}
