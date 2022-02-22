import {
    RawModule,
    setLoaderBase,
    loadInternalSource,
    internalBindingsModule,
    setImportHandler,
    log,
} from 'internal_bindings_namespace';

import { LoaderBase } from './loader-base';

setLoaderBase(LoaderBase);

const INTERNAL_BINDINGS_MODULE_ID = 'internal_bindings';

const PREFIX = 'creator-internal:';

function logResolve(specifier: string, parent: string | undefined, result: string) {
    log(`[FirstLoader] Resolve ${specifier} from ${parent}: ${result}`);
}

class FirstLoader extends LoaderBase {
    public resolveModule(specifier: string, parent?: string) {
        if (specifier === INTERNAL_BINDINGS_MODULE_ID) {
            logResolve(specifier, parent, INTERNAL_BINDINGS_MODULE_ID);
            return INTERNAL_BINDINGS_MODULE_ID;
        }

        const resolved = minimalResolve(specifier, parent);
        logResolve(specifier, parent, resolved);
        return resolved;
    }

    public fetchSource(id: string) {
        if (!id.startsWith(PREFIX)) {
            throw new Error(`Unable to fetch module source: ${id}`);
        }

        const path = id.slice(PREFIX.length);

        const source = loadInternalSource(path);
        if (!source) {
            // TODO: empty string?
            throw new Error(`Unable to fetch module source ${id}`);
        }

        return source;
    }

    public loadRawModule(id: string): Promise<RawModule> | RawModule {
        if (id === INTERNAL_BINDINGS_MODULE_ID) {
            return internalBindingsModule;
        } else {
            return super.loadRawModule(id);
        }
    }
}

const firstLoader = new FirstLoader();

let bootstrapped = false;
let bootstrapPromise: Promise<void> | undefined;
let appModuleLoader: LoaderBase | null = null;

async function bootstrap() {
    if (bootstrapped) {
        return;
    }
    if (!bootstrapPromise) {
        bootstrapPromise = (async () => {
            const bootstrapModule = await firstLoader.import('libs/bootstrap.js') as any;
            log(`Bootstrap module: ${Object.keys(bootstrapModule)}`);
            appModuleLoader = bootstrapModule.appModuleLoader;
            bootstrapPromise = undefined;
            bootstrapped = true;
        })();
    }
    await bootstrapPromise;
}

const importHandler = async (specifier: string) => {
    await bootstrap();
    debugger;
    return appModuleLoader.import(specifier);
};

setImportHandler(importHandler);

function minimalResolve(specifier: string, from?: string) {
    if (!from) {
        return PREFIX + specifier;
    }

    if (!from.startsWith(PREFIX)) {
        throw new Error(`The module request was not fired from internal module.`);
    }

    if (!(specifier.startsWith('./') || specifier.startsWith('../'))) {
        throw new Error(`Only relative specifiers are allowed.`);
    }

    const fromPath = from.slice(PREFIX.length);

    const parts = fromPath.split('/');
    parts.pop();

    const specifierParts = specifier.split('/');
    for (const specifierPart of specifierParts) {
        if (!specifierPart) {
            // Empty. eg: a//b
            continue;
        } else if (specifierPart === '.') {
            continue;
        } else if (specifierPart === '..') {
            parts.pop();
        } else {
            parts.push(specifierPart);
        }
    }

    return PREFIX + parts.join('/');
}
