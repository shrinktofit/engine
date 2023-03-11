import { assertIsTrue, EditorExtendable } from '../../../core';
import { ccclass } from '../../../core/data/decorators';
import { Node } from '../../../scene-graph';
import { Pose, PoseTransformSpace, TransformFilter } from '../../core/pose';
import { CLASS_NAME_PREFIX_ANIM } from '../../define';
import type { AnimationController, ReadonlyClipOverrideMap } from '../animation-controller';
import { AnimationGraphBindingContext, AnimationGraphEvaluationContext, AnimationGraphUpdateContext } from '../animation-graph-context';
import { AnimationMask } from '../animation-mask';
import { PoseGraphNodeBase } from './pose-graph-node-base';
import { RuntimeStashView } from './stash/runtime-stash';
import { RuntimeCoordinator } from './coordination/runtime-coordinator';
import { poseGraphNodeHide } from './pose-graph-node-common';
import { PoseNodeDependencyEvaluation } from './instantiation';

export interface AllPreviousLayersResultManager {
    retrieve(context: PoseNodeEvaluationContext): Pose;
}

export class PoseNodeBindingContext {
    constructor (
        public readonly outerContext: AnimationGraphBindingContext,
        public readonly controller: AnimationController,
        public readonly clipOverrides: ReadonlyClipOverrideMap | undefined,
        additive: boolean,
        public readonly triggerResetFn: (name: string) => void,
        public readonly stashView: RuntimeStashView,
        public readonly coordinator: RuntimeCoordinator,
        public readonly allPreviousLayersResultManager: AllPreviousLayersResultManager,
    ) {
        this._additiveFlagStack.push(additive);
    }

    public get additive () {
        const { _additiveFlagStack: additiveFlagStack } = this;
        return additiveFlagStack[additiveFlagStack.length - 1];
    }

    /** @internal */
    public _pushAdditiveFlag (additive: boolean) {
        this._additiveFlagStack.push(additive);
    }

    /** @internal */
    public _popAdditiveFlag () {
        assertIsTrue(this._additiveFlagStack.length > 1);
        this._additiveFlagStack.pop();
    }

    /** At least has one. */
    private _additiveFlagStack: boolean[] = [];
}

export type PoseNodeEvaluationContext = AnimationGraphEvaluationContext;

type PoseNodeUpdateContext = AnimationGraphUpdateContext;

export type { AnimationGraphUpdateContext as PoseNodeUpdateContext };

export enum PoseTransformSpaceRequirement {
    NO,

    LOCAL,

    SKELETAL,
}

@ccclass(`${CLASS_NAME_PREFIX_ANIM}PoseNode`)
export abstract class PoseNode extends PoseGraphNodeBase {
    public abstract bind(context: PoseNodeBindingContext): void;

    public settle (context: PoseNodeSettleContext): void {
    }

    public reenter () {
    }

    public update (context: PoseNodeUpdateContext) {
        this._dependencyEvaluation?.evaluate();
        this.doUpdate(context);
    }

    public evaluate (context: PoseNodeEvaluationContext) {
        return this.selfEvaluate(context);
    }

    public static evaluateDefaultPose (context: PoseNodeEvaluationContext, poseTransformSpaceRequirement: PoseTransformSpaceRequirement) {
        switch (poseTransformSpaceRequirement) {
        default:
            assertIsTrue(false);
            // fallthrough
        case PoseTransformSpaceRequirement.NO:
        case PoseTransformSpaceRequirement.LOCAL:
            return context.pushDefaultedPose();
        case PoseTransformSpaceRequirement.SKELETAL:
            return context.pushDefaultedPoseInSkeletalSpace();
        }
    }

    /** @internal */
    public _setDependencyEvaluation (dependency: PoseNodeDependencyEvaluation) {
        this._dependencyEvaluation = dependency;
    }

    protected doUpdate (context: PoseNodeUpdateContext): void {
    }

    protected abstract selfEvaluate(context: PoseNodeEvaluationContext): Pose;

    private _dependencyEvaluation: PoseNodeDependencyEvaluation | undefined = undefined;
}

export abstract class PoseNodeSettleContext {
    public abstract origin: Node;

    public abstract createTransformFilter (mask: Readonly<AnimationMask>, origin: Node): TransformFilter;
}
