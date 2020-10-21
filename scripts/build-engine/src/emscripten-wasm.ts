
import * as babel from '@babel/core';
import { CCConfig } from '../@types/cc-config';
import ps from 'path';
import { filePathToModuleRequest, nodeResolveAsync } from './utils';

/**
 * Create helper modules for use of Emscripten generated WebAssembly modules.
 * See `./emscripten-wasm.md` for details of this function
 * @param emscriptenWasmModules 
 * @param engineRoot 
 * @param wasmOption 
 */
export async function createEmscriptenWasmModulesHelperModules (
    emscriptenWasmModules: NonNullable<CCConfig['emscriptenWasmModules']>,
    engineRoot: string,
    wasmOption?: boolean | 'fallback',
    makeModuleRequest?: (moduleName: string, fromModuleName: string) => string,
    moduleId?: (moduleName: string) => string,
) {
    // const moduleRequestCreateEmscriptenWasmModule = filePathToModuleRequest(ps.resolve(
    //     engineRoot, 'external', 'emscripten-wasm', 'index.ts'));
    const moduleRequestCreateEmscriptenWasmModule = './external/emscripten-wasm';
    const moduleRequestLoadBinary = 'cc.load-wasm';
    const helperModules: Record<string, { source: string; manualDeps?: string[] }> = {};
    for (const [name, { wasm, fallback }] of Object.entries(emscriptenWasmModules)) {
        const toModuleRequest = async (id: string) => id; // filePathToModuleRequest(await nodeResolveAsync(id, engineRoot));
        const moduleName = name;
        const instantiationModuleName = `cc.instantiate-${name}.js`;
        const instantiationModuleSource = makeEmscriptenWasmInstantiationModule(
            moduleName,
            moduleName,
            moduleRequestCreateEmscriptenWasmModule,
            moduleRequestLoadBinary,
            (wasmOption === 'fallback' || wasmOption) ? (await toModuleRequest(wasm)) : undefined,
            (wasmOption === 'fallback' || wasmOption) ? (await toModuleRequest(fallback)) : undefined,
        );
        helperModules[instantiationModuleName] = { source: instantiationModuleSource };
        helperModules[moduleName] = {
            source: createAwaiterModule(
                makeModuleRequest?.(instantiationModuleName, moduleName) ?? instantiationModuleName,
                moduleId?.(moduleName)),
            manualDeps: [instantiationModuleName],
        };
    }
    return {
        helperModules,
        baseDir: engineRoot,
    };
}

function makeEmscriptenWasmInstantiationModule (
    targetModuleName: string,
    moduleRequestTargetModule: string,
    moduleRequestCreateEmscriptenWasmModule: string,
    moduleRequestLoadBinary: string,
    moduleRequestWasm?: string,
    moduleRequestJs?: string,
) {
    if (moduleRequestJs && moduleRequestWasm) {
        return makeBoth(
            targetModuleName,
            moduleRequestTargetModule,
            moduleRequestCreateEmscriptenWasmModule,
            moduleRequestLoadBinary,
            moduleRequestWasm,
            moduleRequestJs,
        );
    } else if (moduleRequestWasm) {
        return makeWasm(
            targetModuleName,
            moduleRequestTargetModule,
            moduleRequestCreateEmscriptenWasmModule,
            moduleRequestLoadBinary,
            moduleRequestWasm,
        );
    } else if (moduleRequestJs) {
        return makeJs(
            targetModuleName,
            moduleRequestTargetModule,
            moduleRequestCreateEmscriptenWasmModule,
            moduleRequestJs,
        );
    } else {
        return `export default Promise.resolve()`;
    }
}

function makeBoth (
    targetModuleName: string,
    moduleRequestTargetModule: string,
    moduleRequestCreateEmscriptenWasmModule: string,
    moduleRequestLoadBinary: string,
    moduleRequestWasmVersion: string,
    moduleRequestJsVersion: string,
) {
    return `\
// ${makeTitle(targetModuleName)}

import mod from '${moduleRequestTargetModule}';
import { createEmscriptenWasmModule } from '${moduleRequestCreateEmscriptenWasmModule}';
import { loadBinary } from '${moduleRequestLoadBinary}';

const useWebAssemblyVersion = typeof WebAssembly !== 'undefined';

export default Promise.all([
    useWebAssemblyVersion ? import('${moduleRequestWasmVersion}') : import('${moduleRequestJsVersion}'),
    useWebAssemblyVersion ? loadBinary('${targetModuleName}'): undefined,
]).then(([closure, wasmBinary]) => {
    return createEmscriptenWasmModule(closure, mod)({ wasmBinary });
});
`;
}

function makeWasm (
    targetModuleName: string,
    moduleRequestTargetModule: string,
    moduleRequestCreateEmscriptenWasmModule: string,
    moduleRequestLoadBinary: string,
    moduleRequestClosure: string,
) {
    return `\
// ${makeTitle(targetModuleName)}

import mod from '${moduleRequestTargetModule}';
import { createEmscriptenWasmModule } from '${moduleRequestCreateEmscriptenWasmModule}';
import { loadBinary } from '${moduleRequestLoadBinary}';
import closure from '${moduleRequestClosure}';

export default Promise.resolve(loadBinary('${targetModuleName}')).then((wasmBinary) => createEmscriptenWasmModule(closure, mod)({
    wasmBinary: loadBinary('${targetModuleName}'),
}));
`;
}

function makeJs (
    targetModuleName: string,
    moduleRequestTargetModule: string,
    moduleRequestCreateEmscriptenWasmModule: string,
    moduleRequestClosure: string,
) {
    return `\
// ${makeTitle(targetModuleName)}

import mod from '${moduleRequestTargetModule}';
import { createEmscriptenWasmModule } from '${moduleRequestCreateEmscriptenWasmModule}';
import closure from '${moduleRequestClosure}';

export default createEmscriptenWasmModule(closure, mod)({});
`;
}

function makeTitle (targetModuleName: string) {
    return `Instantiate ${targetModuleName}`;
}

function createAwaiterModule(targetModuleRequest: string, moduleId?: string) {
return `
"use strict";

System.register(${moduleId ? `'${moduleId}', ` : ''}["${targetModuleRequest}"], function (_export, _context) {
  "use strict";

  var promise;
  return {
    setters: [function (_asyncEwm) {
      promise = _asyncEwm.promise;
    }],
    execute: function () {
      return Promise.resolve(promise).then(function (resolved) { _export("default", resolved) });
    }
  };
});
`;
}
