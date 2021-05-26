
import * as libTsServer from 'typescript/lib/tsserverlibrary';
import { parse } from './import-map';
import NodeUrl from 'url';

export = function ({
    typescript: ts,
}: {
    typescript: typeof libTsServer;
}) {
    return { create };

    function create (info: libTsServer.server.PluginCreateInfo) {
        const config = info.config as MyConfig;

        const proxy: ts.LanguageService = Object.create(null);
        for (const k of Object.keys(info.languageService) as (keyof ts.LanguageService)[]) {
            const x = info.languageService[k];
            proxy[k] = (...args: {}[]) => x!.apply(info.languageService, args);
        }

        const moduleResolver = createModuleResolver({
            baseDir: info.project,
            config: info.config,
        });

        const vendorResolve = info.languageServiceHost.resolveModuleNames;
        info.languageServiceHost.resolveModuleNames = resolveModuleNames;

        function resolveModuleNames (
            this: typeof info.languageServiceHost,
            moduleNames: string[],
            containingFile: string,
            reusedNames: string[] | undefined,
            redirectedReference: ts.ResolvedProjectReference | undefined,
            options: ts.CompilerOptions,
        ) {
            console.log(`Resolving ${moduleNames} from ${containingFile}`);

            return vendorResolve ?
                vendorResolve.call(this, moduleNames, containingFile, reusedNames, redirectedReference, options) :
                new Array(moduleNames.length);
        }

        return proxy;
    }
};

interface ImportMap {
    imports?: Record<string, string>;
    scopes?: Record<string, string>;
}

interface MyConfig {
    importMap?: ImportMap;
}

function createModuleResolver ({
    baseDir,
    config,
}: {
    baseDir: string;
    config: MyConfig;
}) {
    const parsedImportMap = parse(config.importMap, NodeUrl.pathToFileURL("X:\\Repos\\Cocos\\engine\\tsconfig.json"));
    return parsedImportMap;
}
