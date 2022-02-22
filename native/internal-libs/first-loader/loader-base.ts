
import { RawModule, log, ModuleLoader } from 'internal_bindings_namespace';

export class LoaderBase implements ModuleLoader {
    constructor() {

    }

    public resolve(specifier: string, parent?: string): string | Promise<string> {
        return this.resolveModule(specifier, parent);
    }

    public async import(specifier: string, parent?: string): Promise<unknown> {
        const record = await this._getOrCreateRecord(specifier, parent);
        const module = await record.load();
        return module.namespace();
    }

    public resolveModule(specifier: string, parent?: string): string | Promise<string> {
        throw new Error(`resolveModule() does implemented.`);
    }

    public loadRawModule(url: string): RawModule | Promise<RawModule> {
        return (async () => {
            const source = await this.fetchSource(url);
            return new RawModule(
                url,
                source,
                0,
                0,
            );
        })();
    }

    public fetchSource(url: string): string | Promise<string> {
        throw new Error(`fetchSource() does implemented.`);
    }

    private _registry = new Map<string, LoadRecord>();

    private async _getOrCreateRecord(specifier: string, parentURL?: string): Promise<LoadRecord> {
        const url = await this.resolve(specifier, parentURL);

        const loaded = this._registry.get(url);
        if (loaded) {
            return loaded;
        }

        const newRecord = this._createRecord(url);
        this._registry.set(url, newRecord);
        return newRecord;
    }

    private _createRecord(url: string) {
        const modulePromise = Promise.resolve(this.loadRawModule(url));
        const record = new LoadRecord(
            url,
            modulePromise,
            (specifier, parentURL) => this._getOrCreateRecord(
                specifier,
                parentURL,
            ),
        );
        return record;
    }
}

class LoadRecord {
    constructor(
        url: string,
        modulePromise: Promise<RawModule>,
        getOrCreateRecord: (specifier: string, url: string) => Promise<LoadRecord>,
    ) {
        this._url = url;
        this._module = undefined;
        this._modulePromise = modulePromise;

        const linkDependencies = async () => {
            const module = await this._modulePromise;
            this._module = module;

            const dependencyRecordPromises: Array<Promise<LoadRecord>> = [];
            const promises = module.link(async (specifier) => {
                // log(`Linking ${specifier} from ${url}`);
                const dependencyRecordPromise = getOrCreateRecord(specifier, url);
                dependencyRecordPromises.push(dependencyRecordPromise);
                const record = await dependencyRecordPromise;
                return record._modulePromise;
            });

            await Promise.all(promises);
            return await Promise.all(dependencyRecordPromises);
        };

        this._dependencyRecords = linkDependencies();
    }

    async instantiate() {
        if (!this._instantiated) {
            this._instantiated = this._instantiate();
        }
        return this._instantiated;
    }

    async load() {
        await this._instantiate();
        this._module.evaluate();
        return this._module;
    }

    private _url: string; // Debug Only

    private _module: RawModule;

    private _modulePromise: Promise<RawModule>;

    private _instantiated: undefined | Promise<void>;

    private _dependencyRecords: Promise<LoadRecord[]>;

    async _instantiate() {
        const records = await this._link();
        this._module.instantiate();
        for (const record of records) {
            record._instantiated = Promise.resolve();
        }
    }

    async _link() {
        const records = new Set<LoadRecord>();
        const addRecord = async (record: LoadRecord) => {
            if (records.has(record)) {
                return;
            }
            records.add(record);
            const dependencyRecords = await record._dependencyRecords;
            await Promise.all(dependencyRecords.map(addRecord));
        };
        await addRecord(this);
        return records;
    }
}
