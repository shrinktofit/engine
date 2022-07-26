
export class NamedCurveHost {
    public names () {
        return this._namedCurves.keys();
    }

    public has (name: string) {
        return this._namedCurves.has(name);
    }

    public get (name: string) {
        return this._namedCurves.get(name) ?? 0.0;
    }

    public set (name: string, value: number) {
        this._namedCurves.set(name, value);
    }

    private _namedCurves: Map<string, number> = new Map();
}
