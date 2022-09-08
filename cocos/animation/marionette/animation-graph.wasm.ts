import { EDITOR, NATIVE } from 'internal:constants';
import moduleFactory from '../../../native/emscripten/build/cc_wasm.js';

const ENABLE_WASM = true && !EDITOR && !NATIVE;

// eslint-disable-next-line import/no-mutable-exports
let emscriptenModule: undefined | typeof moduleFactory;

// eslint-disable-next-line import/no-mutable-exports
export let moduleFactoryReady: undefined | Promise<void>;

if (NATIVE) {
    emscriptenModule = globalThis.animation;

    moduleFactoryReady = Promise.resolve(undefined);
} else if (ENABLE_WASM) {
    emscriptenModule = {} as any;

    moduleFactoryReady = (async () => {
        const wasmBinary = await (async () => {
            const url = 'http://127.0.0.1:12138/cc_wasm.wasm';
            const res = await fetch(url);
            const buffer = await res.arrayBuffer();
            return new Uint8Array(buffer);
        })();

        return new Promise((resolve, reject) => {
            emscriptenModule.wasmBinary = wasmBinary;

            // @ts-ignore
            moduleFactory(emscriptenModule).then((m) => {
                resolve(m);
            }).catch((err) => {
                reject(err);
            });
        });
    })();
}

export {
    emscriptenModule as animationEmscripten,
};

console.log(emscriptenModule);
