import { assertIsTrue } from '../../data/utils/asserts';
import { Pool } from '../../memop';
import { Node } from '../../scene-graph';
import {
    AnimationBindContext,
    AnimationOutput, AnimationOutputContext, nullPoseBoneBinding, zeroClearAnimationOutput,
} from '../animation-output-context';
import { NamedCurveOutput } from '../named-curve-output';
import { Pose, PoseFilter } from '../pose';
import { Transform } from '../transform';
import { AnimationMask } from './animation-mask';
import { NamedCurveHost } from './named-curve-host';

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

export class AnimationGraphBindContext extends AnimationBindContext {
    constructor (root: Node, layout: AnimationGraphOutputLayout) {
        super(root);
        this._layout = layout;
    }

    public isValidBone (path: string): boolean {
        return true;
    }

    public bindBone (bone: string): number {
        const boneNode = this.origin.getChildByPath(bone);
        if (!boneNode) {
            return nullPoseBoneBinding;
        }
        return this._layout.getOrCreateBoneBinding(boneNode);
    }

    public bindBoneByName (bone: string): number {
        const boneNode = findBoneByNameRecurse(this.origin, bone);
        if (!boneNode) {
            return nullPoseBoneBinding;
        }
        return this._layout.getOrCreateBoneBinding(boneNode);
    }

    public getBoneChildren (bone: string): string[] {
        const boneNode = findBoneByNameRecurse(this.origin, bone);
        if (!boneNode) {
            return [];
        }
        return boneNode.children.map((childNode) => childNode.name);
    }
    public bindNamedCurve (name: string): number {
        return this._layout.getOrCreateNamedCurveBinding(name);
    }

    private _layout: AnimationGraphOutputLayout;
}

export class AnimationGraphOutputLayout {
    constructor (namedCurveHost: NamedCurveHost) {
        this._namedCurveHost = namedCurveHost;
    }

    get boneCount () {
        return this._bones.length;
    }

    get namedCurveCount () {
        return this._curves.length;
    }

    public getOrCreateBoneBinding (node: Node) {
        const { _bones: boneTable } = this;
        const nodeIndex = boneTable.findIndex((boneBindInfo) => boneBindInfo.node === node);
        if (nodeIndex >= 0) {
            return nodeIndex;
        }
        const newNodeIndex = boneTable.length;
        boneTable.push({
            node,
        });
        return newNodeIndex;
    }

    public getOrCreateNamedCurveBinding (name: string) {
        const curveIndex = this._curves.indexOf(name);
        if (curveIndex >= 0) {
            return curveIndex;
        } else {
            const newCurveIndex = this._curves.length;
            this._curves.push(name);
            return newCurveIndex;
        }
    }

    public createPoseFilter (mask: AnimationMask, origin: Node) {
        const {
            _bones: bones,
        } = this;
        const poseFilter = new PoseFilter(this.boneCount);
        for (const { path, enabled } of mask.joints) {
            const boneNode = origin.getChildByPath(path);
            if (!boneNode) {
                // Nonexisting bone
                continue;
            }
            const boneIndex = bones.findIndex(({ node }) => boneNode === node);
            if (boneIndex < 0) {
                // The bone is not in layout.
                continue;
            }
            poseFilter.enabled[boneIndex] = enabled;
        }
        return poseFilter;
    }

    public captureCurrent (pose: Pose) {
        const nBones = this._bones.length;
        assertIsTrue(pose.transforms.length === nBones);
        for (let iBone = 0; iBone < nBones; ++iBone) {
            const { node: boneNode } = this._bones[iBone];
            pose.transforms.setPosition(iBone, boneNode.position);
            pose.transforms.setRotation(iBone, boneNode.rotation);
            pose.transforms.setScale(iBone, boneNode.scale);
        }
    }

    public apply (output: AnimationOutput) {
        const {
            pose,
            namedCurveOutput,
        } = output;
        const TRANSFORM_CACHE = new Transform();
        const nBones = this._bones.length;
        assertIsTrue(pose.transforms.length === nBones);
        for (let iBone = 0; iBone < nBones; ++iBone) {
            const transform = pose.transforms.get(iBone, TRANSFORM_CACHE);
            const { node: boneNode } = this._bones[iBone];
            boneNode.setRTS(
                transform.rotation,
                transform.position,
                transform.scale,
            );
        }
        const nCurves = this._curves.length;
        for (let iCurve = 0; iCurve < nCurves; ++iCurve) {
            const curveName = this._curves[iCurve];
            const curveValue = namedCurveOutput.get(iCurve);
            this._namedCurveHost.set(curveName, curveValue);
        }
    }

    private _namedCurveHost: NamedCurveHost;
    private _curves: string[] = [];
    private _bones: BoneBindInfo[] = [];
}

interface BoneBindInfo {
    node: Node;
}

export class AnimationGraphOutputContext implements AnimationOutputContext {
    constructor (layout: AnimationGraphOutputLayout, defaultPose: Pose) {
        this._layout = layout;
        this._defaultPose = defaultPose;
        this._outputPool = new Pool(() => this._constructAnimationOutput(), 1);
    }

    get outputCount () {
        return this._outputCount;
    }

    public createOutput (): AnimationOutput {
        ++this._outputCount;
        return this._outputPool.alloc();
    }

    public createDefaultedOutput (): AnimationOutput {
        const output = this.createOutput();
        output.clear();
        return output;
    }

    createZeroOutput (): AnimationOutput {
        const output = this.createOutput();
        zeroClearAnimationOutput(output);
        return output;
    }

    public deleteOutput (output: AnimationOutput): void {
        assertIsTrue(this._outputCount > 0, 'Output create/delete in an incorrect way.');
        --this._outputCount;
        this._outputPool.free(output);
    }

    private _layout: AnimationGraphOutputLayout;

    private _defaultPose: Pose;

    private _outputPool: Pool<AnimationOutput>;

    private _outputCount = 0;

    private _constructAnimationOutput (): AnimationOutput {
        const context = new AnimationGraphOutput(
            this._layout,
            this._defaultPose,
        );
        return context;
    }
}

export class AnimationGraphOutput implements AnimationOutput {
    constructor (
        layout: AnimationGraphOutputLayout,
        defaultPose: Readonly<Pose>,
    ) {
        this._pose = new Pose(layout.boneCount);
        this._defaultPose = defaultPose;
        this._namedCurveOutput = new NamedCurveOutput(layout.namedCurveCount);
    }

    clear (): void {
        this._defaultPose.transforms.copyInto(this._pose.transforms);
        this._namedCurveOutput.clear();
    }

    get namedCurveOutput () {
        return this._namedCurveOutput;
    }

    get pose () {
        return this._pose;
    }

    private _pose: Pose;
    private _defaultPose: Readonly<Pose>;
    private _namedCurveOutput: NamedCurveOutput;
}

export type ForkCallback = (caller: AnimationOutput) => AnimationOutput;
