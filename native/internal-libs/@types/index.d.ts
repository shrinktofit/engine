declare module 'internal_bindings_namespace' {
    export const internalBindingsModule: RawModule;

    export function log(message: string): void;

    export function error(message: string): void;

    export class RawModule {
        constructor(url: string, source: string, lineOffset: number, columnOffset: number);

        link<T>(linker: (specifier: string) => Promise<T>): Array<Promise<T>>;

        instantiate(): void;

        evaluate(): void;

        namespace(): unknown;
    }

    export interface ModuleLoader {
        resolve(specifier: string, parent?: string): string | Promise<string>;

        import(specifier: string, parent?: string): Promise<unknown>;
    }

    class LoaderBase implements ModuleLoader {
        constructor();

        public resolve(specifier: string, parent?: string): string | Promise<string>;

        public import(specifier: string, parent?: string): Promise<unknown>;

        public resolveModule(specifier: string, parent?: string): string | Promise<string>;

        public fetchSource(url: string): string | Promise<string>;

        public loadRawModule(url: string): RawModule | Promise<RawModule>;
    }

    export { LoaderBase };

    export function setLoaderBase(loaderBase: typeof LoaderBase): void;

    export function loadInternalSource(id: string): string;

    export function getStringFromFile(path: string): string;

    export function setImportHandler(handler: (specifier: string) => Promise<unknown>): void;
}

declare module 'internal_bindings' {
    import * as internalBindings from 'internal_bindings_namespace';

    export default internalBindings;
}
