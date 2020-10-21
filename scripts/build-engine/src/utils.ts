import nodeResolve from 'resolve';

export function filePathToModuleRequest (path: string) {
    return path.replace(/\\/g, '\\\\');
}

export async function nodeResolveAsync (specifier: string, baseDir: string) {
    return new Promise<string>((r, reject) => {
        nodeResolve(specifier, {
            basedir: baseDir,
        }, (err, resolved, pkg) => {
            if (err) {
                reject(err);
            } else {
                r(resolved);
            }
        });
    });
}