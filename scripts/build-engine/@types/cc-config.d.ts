
export interface CCConfig {
    /**
     * Files to be excluded from transforming.
     */
    transformExcludes?: RegExp[];

    /**
     * Manually specified CommonJs module named exports.
     */
    namedExports?: Record<string, string[]>;

    /**
     * Module overrides.
     */
    moduleOverrides?: Record<string, string>;

    /**
     * Describe WebAssembly modules.
     */
    emscriptenWasmModules?: Record<string, {
        /**
         * The WebAssembly version of this module. Should be module specifier.
         */
        wasm: string;

        /**
         * The fallback version of this module. Should be module specifier.
         */
        fallback: string;

        /**
         * The WebAssembly binary of this module. Should be file path.
         */
        binary: string;
    }>;
}

export interface CCConfigContext {
    /**
     * Is performing minified-building.
     */
    minified?: boolean;

    /**
     * Is build target support WebAssembly.
     */
    wasm?: boolean | 'fallback';

    /**
     * Entries.
     */
    entries?: string[];

    /**
     * Build-time constants.
     */
    constants?: Record<string, string | number | boolean>;
}

export type CCConfigFn = (context: CCConfigContext) => Promise<CCConfig> | CCConfig;