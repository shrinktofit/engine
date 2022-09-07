import { Node } from '../../core';
import { assertIsTrue } from '../../core/data/utils/asserts';
import { Pose } from '../core/pose';
import { PoseAllocator } from '../core/pose-allocator';
import { TransformArray } from '../core/transform-array';
import { TransformHandle, MetaValueHandle } from '../core/animation-handle';
import { Transform } from '../core/transform';
import { VarInstance } from './variable';

function findBoneByNameRecurse (from: Node, name: string): Node | null {
    if (from.name === name) {
        return from;
    }
    const nChildren = from.children.length;
    for (let iChild = 0; iChild < nChildren; ++iChild) {
        const found = findBoneByNameRecurse(from.children[iChild], name);
        if (found) {
            return found;
        }
    }
    return null;
}

export interface AnimationGraphLayerWideBindingContext {
    additive: boolean;

    up: AnimationGraphBindingContext;
}

export type VarRegistry = Record<string, VarInstance>;

export class AnimationGraphBindingContext {
    constructor (origin: Node, poseLayoutMaintainer: AnimationGraphPoseLayoutMaintainer, varRegistry: VarRegistry) {
        this._origin = origin;
        this._layoutMaintainer = poseLayoutMaintainer;
        this._varRegistry = varRegistry;
    }

    get origin () {
        return this._origin;
    }

    public bindTransform (bone: string): TransformHandle | null {
        const boneNode = this._origin.getChildByPath(bone);
        if (!boneNode) {
            return null;
        }
        return this._layoutMaintainer.getOrCreateTransformBinding(boneNode);
    }

    public bindTransformByName (bone: string): TransformHandle | null {
        const boneNode = findBoneByNameRecurse(this._origin, bone);
        if (!boneNode) {
            return null;
        }
        return this._layoutMaintainer.getOrCreateTransformBinding(boneNode);
    }

    public getBoneChildren (bone: string): string[] {
        const boneNode = findBoneByNameRecurse(this._origin, bone);
        if (!boneNode) {
            return [];
        }
        return boneNode.children.map((childNode) => childNode.name);
    }

    public bineMetaValue (name: string): MetaValueHandle {
        return this._layoutMaintainer.getOrCreateMetaValueBinding(name);
    }

    public getVar (id: string): VarInstance | undefined {
        return this._varRegistry[id];
    }

    private _origin: Node;

    private _layoutMaintainer: AnimationGraphPoseLayoutMaintainer;

    private _varRegistry: VarRegistry
}

const cacheTransform = new Transform();

export class MetaValueRegistry {
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

export class AnimationGraphPoseLayoutMaintainer {
    constructor (metaValueRegistry: MetaValueRegistry) {
        this._metaValueRegistry = metaValueRegistry;
    }

    get transformCount () {
        return this._transformRecords.length;
    }

    get metaValueCount () {
        return this._metaValueRecords.length;
    }

    public getOrCreateTransformBinding (node: Node) {
        const { _transformRecords: transformRecords } = this;

        const transformIndex = transformRecords.findIndex((transformRecord) => transformRecord.node === node);
        if (transformIndex >= 0) {
            return transformRecords[transformIndex].handle;
        }

        // Ensure parent is preceding to children.
        let newNodeIndex = 0;
        for (let parent = node.parent; parent; parent = parent.parent) {
            const parentIndex = transformRecords.findIndex((transformRecord) => transformRecord.node === parent);
            if (parentIndex >= 0) {
                newNodeIndex = parentIndex + 1;
                break;
            }
        }

        // Update necessary bone handle.
        for (let transformIndex = newNodeIndex; transformIndex < transformRecords.length; ++transformIndex) {
            ++transformRecords[transformIndex].handle.index;
        }

        // Insert new transform record.
        const transformRecord: TransformRecord = {
            node,
            handle: { index: newNodeIndex } as unknown as TransformHandleInternal,
        };
        transformRecords.splice(newNodeIndex, 0, transformRecord);

        return transformRecord.handle;
    }

    public getOrCreateMetaValueBinding (name: string) {
        const metaValueIndex = this._metaValueRecords.indexOf(name);
        if (metaValueIndex >= 0) {
            return {
                index: metaValueIndex,
            } as MetaValueHandle;
        } else {
            const newMetaValueIndex = this._metaValueRecords.length;
            this._metaValueRecords.push(name);
            return {
                index: newMetaValueIndex,
            } as MetaValueHandle;
        }
    }

    public captureCurrent (transforms: TransformArray) {
        const nTransforms = this._transformRecords.length;
        assertIsTrue(transforms.length === nTransforms);
        for (let iTransform = 0; iTransform < nTransforms; ++iTransform) {
            const { node } = this._transformRecords[iTransform];
            transforms.setPosition(iTransform, node.position);
            transforms.setRotation(iTransform, node.rotation);
            transforms.setScale(iTransform, node.scale);
        }
    }

    public apply (pose: Pose) {
        const {
            transforms,
            metaValues,
        } = pose;

        const nTransforms = this._transformRecords.length;
        assertIsTrue(transforms.length === nTransforms);
        for (let iTransform = 0; iTransform < nTransforms; ++iTransform) {
            const transform = transforms.getTransform(iTransform, cacheTransform);
            const { node } = this._transformRecords[iTransform];
            node.setRTS(
                transform.rotation,
                transform.position,
                transform.scale,
            );
        }

        const nMetaValues = this._metaValueRecords.length;
        for (let iMetaValue = 0; iMetaValue < nMetaValues; ++iMetaValue) {
            const curveName = this._metaValueRecords[iMetaValue];
            const curveValue = metaValues[iMetaValue];
            this._metaValueRegistry.set(curveName, curveValue);
        }
    }

    private _metaValueRegistry: MetaValueRegistry;
    private _metaValueRecords: string[] = [];
    private _transformRecords: TransformRecord[] = [];
}

interface TransformRecord {
    node: Node;

    handle: TransformHandleInternal;
}

export class AnimationGraphEvaluationContext {
    constructor (layout: PoseLayout) {
        assertIsTrue(layout.defaultTransforms.length === layout.transformCount);
        this._poseAllocator = new PoseAllocator(layout.transformCount, layout.transformCount);
        this._defaultTransforms = layout.defaultTransforms;
    }

    public createDefaultedPose () {
        const pose = this._poseAllocator.allocatePose();
        pose.transforms.set(this._defaultTransforms);
        pose.metaValues.fill(0.0);
        return pose;
    }

    public createZeroPose () {
        const pose = this._poseAllocator.allocatePose();
        pose.transforms.fillZero();
        pose.metaValues.fill(0.0);
        return pose;
    }

    public duplicatePose (src: Pose) {
        const pose = this._poseAllocator.allocatePose();
        pose.transforms.set(src.transforms);
        pose.metaValues.set(src.metaValues);
        return pose;
    }

    public deletePose (pose: Pose) {
        this._poseAllocator.destroyPose(pose);
    }

    private _poseAllocator: PoseAllocator;

    private _defaultTransforms: TransformArray;
}

export interface PoseLayout {
    transformCount: number;

    metaValueCount: number;

    defaultTransforms: TransformArray;
}

interface TransformHandleInternal extends TransformHandle {
    index: number;
}

interface MetaValueHandleInternal extends TransformHandle {
    index: number;
}
