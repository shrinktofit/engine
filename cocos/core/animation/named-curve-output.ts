import { lerp } from '../math';

export class NamedCurveOutput {
    constructor (curveCount: number) {
        this._curves = new Float64Array(curveCount);
    }

    public get (index: number) {
        return this._curves[index];
    }

    public set (index: number, value: number) {
        this._curves[index] = value;
    }

    public clear () {
        this._curves.fill(0.0);
    }

    public __zeroClear () {
        this._curves.fill(0.0);
    }

    private _curves: Float64Array;

    public static copy (target: NamedCurveOutput, source: NamedCurveOutput) {
        target._curves.set(source._curves);
    }

    public static blendInto (target: NamedCurveOutput, source: NamedCurveOutput, t: number) {
        for (let i = 0; i < target._curves.length; ++i) {
            target._curves[i] = lerp(target._curves[i], source._curves[i], t);
        }
    }

    public static calculateDelta (target: NamedCurveOutput, base: NamedCurveOutput) {
        for (let i = 0; i < target._curves.length; ++i) {
            target._curves[i] -= base._curves[i];
        }
    }

    public static applyDelta (target: NamedCurveOutput, delta: NamedCurveOutput, t: number) {
        for (let i = 0; i < target._curves.length; ++i) {
            target._curves[i] += delta._curves[i] * t;
        }
    }
}
