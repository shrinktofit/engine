import moduleFactory from '../../../native/emscripten/build/cc_wasm.js';

export { moduleFactory as underlying };

export function wait (): Promise<void>;