import { ccclass } from 'cc.decorator';
import { QuatCurve } from '../../curves';
import { CLASS_NAME_PREFIX_ANIM, createEvalSymbol } from '../define';
import { SingleChannelTrack } from './track';
import { Quat } from '../../math';
import { deltaQuat } from '../math';

/**
 * @en
 * A quaternion track animates a quaternion(rotation) attribute of target.
 * @zh
 * 四元数轨道描述目标上某个四元数（旋转）属性的动画。
 */
@ccclass(`${CLASS_NAME_PREFIX_ANIM}QuatTrack`)
export class QuatTrack extends SingleChannelTrack<QuatCurve> {
    /**
     * @internal
     */
    protected createCurve () {
        return new QuatCurve();
    }

    /**
     * @internal
     */
    public [createEvalSymbol] (_, additive: boolean) {
        return new (additive ? AdditiveQuatTrackEval : QuatTrackEval)(this.channels()[0].curve);
    }
}

export class QuatTrackEval {
    constructor (private _curve: QuatCurve) {

    }

    public evaluate (time: number) {
        this._curve.evaluate(time, this._result);
        return this._result;
    }

    private _result: Quat = new Quat();
}

class AdditiveQuatTrackEval {
    constructor (private _curve: QuatCurve) {
        _curve.evaluate(0.0, this._base);
    }

    public evaluate (time: number) {
        this._curve.evaluate(time, this._result);
        deltaQuat(this._result, this._base, this._result);
        return this._result;
    }

    private _result: Quat = new Quat();
    private _base: Quat = new Quat();
}
