import moduleFactory from '../../../native/emscripten/build/cc_wasm.js';

const emscriptenModule = {};

export {
    emscriptenModule as underlying,
};

const moduleFactoryReady = new Promise((resolve, reject) => {
    // @ts-ignore
    moduleFactory(emscriptenModule).then((m) => {
        resolve(m);
    }).catch((err) => {
        reject(err);
    });
});

export async function wait () {
    return await moduleFactoryReady;
}
