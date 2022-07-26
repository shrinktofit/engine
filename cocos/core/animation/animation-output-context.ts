import { Quat, Vec3 } from '../math';
import { Node } from '../scene-graph';
import { applyDeltaPose, blendInto, blendIntoAt, calculateDeltaPose, copyPose, Pose, PoseFilter } from './pose';
import { RuntimeBinding, RuntimeBindingX } from './runtime-binding';
import { NamedCurveOutput } from './named-curve-output';

export interface AnimationOutputContext {
    createOutput(): AnimationOutput;

    createDefaultedOutput(): AnimationOutput;

    createZeroOutput(): AnimationOutput;

    deleteOutput(output: AnimationOutput): void;
}

export interface AnimationOutput {
    readonly pose: Pose;

    readonly namedCurveOutput: NamedCurveOutput;

    /**
     * Resets this output to default.
     */
    clear(): void;
}

export function copyAnimationOutput (target: AnimationOutput, source: AnimationOutput) {
    copyPose(target.pose, source.pose);
    NamedCurveOutput.copy(target.namedCurveOutput, source.namedCurveOutput);
}

export function blendAnimationOutputInto (
    target: AnimationOutput,
    source: AnimationOutput,
    t: number,
    poseFilter: PoseFilter | null = null,
) {
    blendInto(target.pose, source.pose, t, poseFilter);
    NamedCurveOutput.blendInto(target.namedCurveOutput, source.namedCurveOutput, t);
}

export function blendAnimationOutputAtBone (
    target: AnimationOutput,
    source: AnimationOutput,
    t: number,
    bone: PoseBoneBindingPoint,
) {
    blendIntoAt(target.pose, source.pose, t, bone);
}

export function calculateDeltaAnimationOutput (target: AnimationOutput, base: AnimationOutput) {
    calculateDeltaPose(target.pose, base.pose);
    NamedCurveOutput.calculateDelta(target.namedCurveOutput, base.namedCurveOutput);
}

export function applyDeltaAnimationOutput (target: AnimationOutput, delta: AnimationOutput, t: number, poseFilter: PoseFilter | null = null) {
    applyDeltaPose(target.pose, delta.pose, t, poseFilter);
    NamedCurveOutput.applyDelta(target.namedCurveOutput, delta.namedCurveOutput, t);
}

export function zeroClearAnimationOutput (target: AnimationOutput) {
    target.pose.transforms.__zeroClear();
    target.namedCurveOutput.__zeroClear();
}

export abstract class AnimationBindContext {
    constructor (origin: Node) {
        this._origin = origin;
    }

    get origin () {
        return this._origin;
    }

    public abstract isValidBone(path: string): boolean;

    public abstract bindBone(bone: string): PoseBoneBindingPoint;

    public abstract bindBoneByName(bone: string): PoseBoneBindingPoint;

    public abstract bindNamedCurve(name: string): NamedCurveBindingPoint;

    private _origin: Node;
}

export type PoseBoneBindingPoint = number;

export const nullPoseBoneBinding = -1;

export class PoseBonePositionBinding implements RuntimeBindingX<Vec3> {
    constructor (boneBinding: PoseBoneBindingPoint) {
        this._boneBindingPoint = boneBinding;
    }

    public setValue (value: Vec3, outputContext: AnimationOutput): void {
        outputContext.pose.transforms.setPosition(this._boneBindingPoint, value);
    }

    private declare _boneBindingPoint: PoseBoneBindingPoint;
}

export class PoseBoneRotationBinding implements RuntimeBindingX<Quat> {
    constructor (boneBinding: PoseBoneBindingPoint) {
        this._boneBindingPoint = boneBinding;
    }

    public setValue (value: Quat, outputContext: AnimationOutput): void {
        outputContext.pose.transforms.setRotation(this._boneBindingPoint, value);
    }

    private declare _boneBindingPoint: PoseBoneBindingPoint;
}

export class PoseBoneRotationEulerAnglesBinding implements RuntimeBindingX<Vec3> {
    constructor (boneBinding: PoseBoneBindingPoint) {
        this._boneBindingPoint = boneBinding;
    }

    public setValue (value: Vec3, outputContext: AnimationOutput): void {
        const quat = Quat.fromEuler(PoseBoneRotationEulerAnglesBinding._EULER_TO_QUAT_CACHE, value.x, value.y, value.z);
        outputContext.pose.transforms.setRotation(this._boneBindingPoint, quat);
    }

    private static _EULER_TO_QUAT_CACHE = new Quat();

    private declare _boneBindingPoint: PoseBoneBindingPoint;
}

export class PoseBoneScaleBinding implements RuntimeBindingX<Vec3> {
    constructor (boneBinding: PoseBoneBindingPoint) {
        this._boneBindingPoint = boneBinding;
    }

    public setValue (value: Vec3, outputContext: AnimationOutput): void {
        outputContext.pose.transforms.setScale(this._boneBindingPoint, value);
    }

    private declare _boneBindingPoint: PoseBoneBindingPoint;
}

export type NamedCurveBindingPoint = number;

export class NamedCurveBinding implements RuntimeBindingX<number> {
    constructor (bindingPoint: NamedCurveBindingPoint) {
        this._bindingPoint = bindingPoint;
    }

    public setValue (value: number, outputContext: AnimationOutput): void {
        outputContext.namedCurveOutput.set(this._bindingPoint, value);
    }

    private declare _bindingPoint: PoseBoneBindingPoint;
}
