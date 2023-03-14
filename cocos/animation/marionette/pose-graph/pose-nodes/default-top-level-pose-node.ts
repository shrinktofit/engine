import { applyDeltaPose, blendPoseInto, Pose, TransformFilter } from '../../../core/pose';
import { AnimationGraphEvaluationContext } from '../../animation-graph-context';
import { AnimationMask } from '../../animation-mask';
import { RuntimeCoordinator } from '../coordination/runtime-coordinator';
import { TopLevelStateMachineEvaluation } from '../../graph-eval';
import { RuntimeStashManager } from '../stash/runtime-stash';
import {
    PoseNode, PoseNodeBindingContext, PoseNodeEvaluationContext, PoseNodeSettleContext, PoseNodeUpdateContext,
    AllPreviousLayersResultManager,
} from '../pose-node';
import { assertIsTrue } from '../../../../core';

export class DefaultTopLevelPose extends PoseNode {
    constructor (
        private _layerRecords: readonly LayerEvaluationRecord[],
        private _allPreviousLayersResultManager: AllPreviousLayersResultManagerImpl,
    ) {
        super();
    }

    public bind (context: PoseNodeBindingContext): void {
        // ...
    }

    public settle (context: PoseNodeSettleContext): void {
        for (const layer of this._layerRecords) {
            if (layer.mask) {
                layer.transformFilter = context.createTransformFilter(layer.mask, context.origin);
            }
        }
    }

    protected doUpdate (context: PoseNodeUpdateContext): void {
        for (const layer of this._layerRecords) {
            layer.stateMachineEvaluation.update(context);
            layer.coordinator.coordinate();
        }
    }

    public selfEvaluate (context: AnimationGraphEvaluationContext): Pose {
        const { _allPreviousLayersResultManager: allPreviousLayersResultManager } = this;
        const finalPose = context.pushDefaultedPose();
        for (const layer of this._layerRecords) {
            allPreviousLayersResultManager.set(finalPose);
            const layerPose = layer.stateMachineEvaluation.evaluate(context);
            const layerActualWeight = layer.weight * layer.stateMachineEvaluation.passthroughWeight;
            const { transformFilter } = layer;
            if (layer.additive) {
                applyDeltaPose(finalPose, layerPose, layerActualWeight, transformFilter);
            } else {
                blendPoseInto(finalPose, layerPose, layerActualWeight, transformFilter);
            }
            context.popPose();
            // Reset stash resources.
            layer.stashManager.reset();
            allPreviousLayersResultManager.delete();
        }
        return finalPose;
    }
}

export class LayerEvaluationRecord {
    constructor (
        public stashManager: RuntimeStashManager,

        public coordinator: RuntimeCoordinator,

        public stateMachineEvaluation: TopLevelStateMachineEvaluation,

        /** Used by top level eval. */
        public weight: number,

        /** Used by top level eval. */
        public readonly additive: boolean,

        /** Used by top level eval. */
        public mask: AnimationMask | undefined = undefined,

        /** Used by top level eval. */
        public transformFilter: TransformFilter | undefined = undefined,
    ) {

    }
}

export class AllPreviousLayersResultManagerImpl implements AllPreviousLayersResultManager {
    public retrieve (context: PoseNodeEvaluationContext): Pose {
        const { _pose: pose } = this;
        assertIsTrue(pose, `Can not retrieve previous layers pose. You're doing things in wrong order.`);
        return context.pushDuplicatedPose(pose);
    }

    public set (pose: Pose) {
        assertIsTrue(!this._pose);
        this._pose = pose;
    }

    public delete () {
        assertIsTrue(this._pose);
        this._pose = null;
    }

    private _pose: Pose | null = null;
}
