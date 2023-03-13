import { EDITOR } from 'internal:constants';
import { ccclass, serializable } from '../../../../core/data/decorators';
import { blendPoseInto, Pose } from '../../../core/pose';
import { CLASS_NAME_PREFIX_ANIM } from '../../../define';
import { PoseNode, PoseNodeBindingContext, PoseNodeEvaluationContext, PoseNodeSettleContext, PoseNodeUpdateContext, PoseTransformSpaceRequirement } from '../pose-node';
import { poseInput } from '../pose-node-binding';
import { xNodeInput } from '../x-node-binding';
import { AnimationGraphUpdateContextGenerator } from '../../animation-graph-context';
import { poseGraphNodeMenu } from '../pose-graph-node-common';
import { POSE_GRAPH_NODE_MENU_PREFIX_POSE_BLEND } from './menu-common';
import {
    insertPoseGraphNodeArrayElement,
    deletePoseGraphNodeArrayElement,
} from '../protected';

function insertItem (this: BlendInProportion, hint: number) {
    insertPoseGraphNodeArrayElement(this, { propertyKey: 'poses', elementIndex: hint }, null);
    insertPoseGraphNodeArrayElement(this, { propertyKey: 'proportions', elementIndex: hint }, 0.0);
}

function deleteItem (this: BlendInProportion, index: number) {
    deletePoseGraphNodeArrayElement(this, { propertyKey: 'poses', elementIndex: index });
    deletePoseGraphNodeArrayElement(this, { propertyKey: 'proportions', elementIndex: index });
}

@ccclass(`${CLASS_NAME_PREFIX_ANIM}BlendInProportion`)
@poseGraphNodeMenu(`${POSE_GRAPH_NODE_MENU_PREFIX_POSE_BLEND}按比例混合`)
export class BlendInProportion extends PoseNode {
    @serializable
    @poseInput({
        displayName: 'Poses',
        arrayLike: !EDITOR ? undefined : {
            insert: insertItem,
            delete: deleteItem,
        },
    })
    public readonly poses: Array<PoseNode | null> = [];

    @serializable
    @xNodeInput({
        arrayLike: !EDITOR ? undefined : {
            insert: insertItem,
            delete: deleteItem,
        },
    })
    public readonly proportions: number[] = [];

    public bind (context: PoseNodeBindingContext) {
        for (const pose of this.poses) {
            pose?.bind(context);
        }
    }

    public settle (context: PoseNodeSettleContext): void {
        for (const pose of this.poses) {
            pose?.settle(context);
        }
    }

    public reenter () {
        for (const pose of this.poses) {
            pose?.reenter();
        }
    }

    protected doUpdate (context: PoseNodeUpdateContext): void {
        const {
            _updateContextGenerator: updateContextGenerator,
        } = this;
        const nInputPoses = this.poses.length;
        for (let iInputPose = 0; iInputPose < nInputPoses; ++iInputPose) {
            const inputPoseWeight = this.proportions[iInputPose];
            const inputPoseUpdateContext = updateContextGenerator.generate(
                context.deltaTime,
                context.directiveAbsoluteWeight * inputPoseWeight,
            );
            this.poses[iInputPose]?.update(inputPoseUpdateContext);
        }
    }

    public selfEvaluate (context: PoseNodeEvaluationContext) {
        const nInputPoses = this.poses.length;
        let sumWeight = 0.0;
        let finalPose: Pose | null = null;
        for (let iInputPose = 0; iInputPose < nInputPoses; ++iInputPose) {
            const inputPoseWeight = this.proportions[iInputPose];
            if (!inputPoseWeight) {
                continue;
            }
            const inputPose = this.poses[iInputPose]?.evaluate(context, PoseTransformSpaceRequirement.LOCAL);
            if (!inputPose) {
                continue;
            }
            sumWeight += inputPoseWeight;
            if (!finalPose) {
                finalPose = inputPose;
            } else {
                if (sumWeight) {
                    const t = inputPoseWeight / sumWeight;
                    blendPoseInto(finalPose, inputPose, t);
                }
                context.popPose();
            }
        }
        if (finalPose) {
            return finalPose;
        }

        // TODO: cause wired behavior in additive layer.
        return context.pushDefaultedPose();
    }

    private _updateContextGenerator = new AnimationGraphUpdateContextGenerator();
}
