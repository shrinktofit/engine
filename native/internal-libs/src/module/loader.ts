import internalBindings from 'internal_bindings';
import { URL } from '../url.js';

const FILE_URL_PROTOCOL = 'file:///';

export class AppModuleLoader extends internalBindings.LoaderBase {
    public resolveModule (specifier: string, parent?: string): string | Promise<string> {
        if (!(specifier.startsWith('./') || specifier.startsWith('../'))) {
            throw new Error(`Only relative specifiers are allowed.`);
        }

        const urlResolved = new URL(specifier, parent ?? new URL('file:///'));

        return urlResolved.href;
    }

    public fetchSource (href: string): string {
        if (!href.startsWith(FILE_URL_PROTOCOL)) {
            throw new Error(`Unsupported module URL: ${href}`);
        }

        const url = new URL(href);

        const pathname = url.pathname;
        const path = pathname.startsWith('/') ? pathname.slice(1) : pathname;

        internalBindings.log(`Fetching file: ${path}`);

        const source = internalBindings.getStringFromFile(path);

        if (!source) {
            // TODO: empty string?
            throw new Error(`Unable to fetch module source ${path}`);
        }

        return source;
    }
}

function throwUnresolved (id: string, parentUrl?: string): never {
    throw Error(`Unable to resolve bare specifier '${id}${parentUrl ? `' from ${parentUrl}` : '\''}`);
}
