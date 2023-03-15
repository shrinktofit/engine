import { ccenum } from '../../../../core';
import { ccclass, editable, serializable, type, visible } from '../../../../core/data/decorators';
import { AuxiliaryCurveHandle } from '../../../core/animation-handle';
import { Pose } from '../../../core/pose';
import { CLASS_NAME_PREFIX_ANIM } from '../../../define';
import { AnimationGraphBindingContext } from '../../animation-graph-context';

enum IntensityType {
    VALUE,

    AUXILIARY_CURVE,
}
ccenum(IntensityType);

@ccclass(`${CLASS_NAME_PREFIX_ANIM}IntensitySpecification`)
export class IntensitySpecification {
    @type(IntensityType)
    @serializable
    @editable
    public type = IntensityType.VALUE;

    @serializable
    @editable
    @visible(function visible (this: IntensitySpecification) { return this.type === IntensityType.VALUE; })
    public value = 0.0;

    @serializable
    @editable
    @visible(function visible (this: IntensitySpecification) { return this.type === IntensityType.AUXILIARY_CURVE; })
    public auxiliaryCurveName = '';

    public bind (context: AnimationGraphBindingContext) {
        if (this.type === IntensityType.AUXILIARY_CURVE) {
            if (this.auxiliaryCurveName) {
                const handle = context.bindAuxiliaryCurve(this.auxiliaryCurveName);
                return new IntensityFromAuxiliaryCurve(handle);
            } else {
                return new IntensityValue(0.0);
            }
        }
        return new IntensityValue(this.value);
    }
}

export interface IntensityEvaluation {
    evaluate(pose: Readonly<Pose>): number;
}

class IntensityValue implements IntensityEvaluation {
    constructor (private _value: number) {
    }

    public evaluate (pose: Readonly<Pose>): number {
        return this._value;
    }
}

class IntensityFromAuxiliaryCurve implements IntensityEvaluation {
    constructor (private _handle: AuxiliaryCurveHandle) {
    }

    public evaluate (pose: Readonly<Pose>): number {
        const value = pose.metaValues[this._handle.index];
        return value;
    }
}
