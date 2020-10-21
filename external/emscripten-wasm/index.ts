
interface EmscriptenModule {
    then: (callback: () => void) => void;
}

type EmscriptenModuleClosure = (this: unknown, wasmModule: unknown) => EmscriptenModule;

export function createEmscriptenWasmModule<TModule> (closure: EmscriptenModuleClosure, module?: TModule) {
    return ({
        wasmBinary,
    }: {
        wasmBinary?: ArrayBuffer;
    }) => {
        const wasmModule = module ?? {} as TModule;

        // `this` needed by WASM closure.
        const wasmModuleClosureThis = { };
        if (typeof wasmBinary !== 'undefined') {
            // See https://emscripten.org/docs/compiling/WebAssembly.html#wasm-files-and-compilation
            wasmModule['wasmBinary'] = wasmBinary;
        }

        return new Promise<TModule>((resolve, reject) => {
            closure.call(wasmModuleClosureThis, wasmModule).then(() => {
                resolve(wasmModule);
            });
        });
    };
}
