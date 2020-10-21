
// @ts-check

import ps from 'path';

/**
 * 
 * @param {import('./scripts/build-engine/@types/cc-config').CCConfigContext} context
 * @returns  {import('./scripts/build-engine/@types/cc-config').CCConfig}
 */
export default function (context) {
    const transformExcludes = [
        /node_modules[\/\\]@cocos[\/\\]ammo/g,
        /node_modules[\/\\]@cocos[\/\\]cannon/g,
    ];

    const namedExports = {
        '@cocos/ammo': ['AMMO'],
        '@cocos/cannon': ['CANNON']
    };

    /** @type {Record<string, string>} */
    const moduleOverrides = { };

    if (context.constants && context.constants['NATIVE'] === true) {
        Object.assign(moduleOverrides, {
            "cocos/core/pipeline/index.ts": "cocos/core/pipeline/index.jsb.ts",
                    "cocos/core/renderer/core/native-pools.ts": "cocos/core/renderer/core/native-pools.jsb.ts",
                    "cocos/core/gfx/index.ts": "cocos/core/gfx/index.jsb.ts"
        });
    }

    /** @type {NonNullable<import('./scripts/build-engine/@types/cc-config').CCConfig['emscriptenWasmModules']>} */
    const emscriptenWasmModules = {
        '@cocos/ammo': {
            wasm: '@cocos/ammo/builds/ammo.wasm.js',
            fallback: '@cocos/ammo/builds/ammo.full.js',
            binary: ps.join(ps.dirname(require.resolve('@cocos/ammo/builds/ammo.wasm.js')), 'ammo.wasm.wasm'),
        },
    };

    return {
        transformExcludes,
        namedExports,
        moduleOverrides,
        emscriptenWasmModules,
    };
};
