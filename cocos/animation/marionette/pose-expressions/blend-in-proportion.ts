import { EDITOR } from 'internal:constants';
import { ccclass, serializable } from '../../../core/data/decorators';
import { blendPoseInto, Pose } from '../../core/pose';
import { CLASS_NAME_PREFIX_ANIM } from '../../define';
import { PoseExpr, PoseExprBindingContext, PoseExprEvaluationContext, PoseExprSettleContext, PoseExprUpdateContext } from './pose-expr';
import { disconnectPose, poseInput, deletePoseArrayElement, insertPoseArrayElement } from './pose-expr-binding';
import { disconnectXNode, deleteXNodeArrayElement, insertXNodeArrayElement, xNodeInput } from '../x-node/x-node-binding';
import { AnimationGraphUpdateContextGenerator } from '../animation-graph-context';

function insertItem (this: BlendInProportion, hint: number) {
    insertPoseArrayElement(this, { propertyKey: 'poses', elementIndex: hint }, null);
    insertXNodeArrayElement(this, { propertyKey: 'proportions', elementIndex: hint }, 0.0);
}

function deleteItem (this: BlendInProportion, index: number) {
    deletePoseArrayElement(this, { propertyKey: 'poses', elementIndex: index });
    deleteXNodeArrayElement(this, { propertyKey: 'proportions', elementIndex: index });
}

@ccclass(`${CLASS_NAME_PREFIX_ANIM}BlendInProportion`)
export class BlendInProportion extends PoseExpr {
    @serializable
    @poseInput({
        displayName: 'Poses',
        arrayLike: !EDITOR ? undefined : {
            insert: insertItem,
            delete: deleteItem,
        },
    })
    public readonly poses: Array<PoseExpr | null> = [];

    @serializable
    @xNodeInput({
        arrayLike: !EDITOR ? undefined : {
            insert: insertItem,
            delete: deleteItem,
        },
    })
    public readonly proportions: number[] = [];

    public bind (context: PoseExprBindingContext) {
        for (const pose of this.poses) {
            pose?.bind(context);
        }
    }

    public settle (context: PoseExprSettleContext): void {
        for (const pose of this.poses) {
            pose?.settle(context);
        }
    }

    public reenter () {
        for (const pose of this.poses) {
            pose?.reenter();
        }
    }

    public update (context: PoseExprUpdateContext): void {
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

    public selfEvaluate (context: PoseExprEvaluationContext) {
        const nInputPoses = this.poses.length;
        let sumWeight = 0.0;
        let finalPose: Pose | null = null;
        for (let iInputPose = 0; iInputPose < nInputPoses; ++iInputPose) {
            const inputPoseWeight = this.proportions[iInputPose];
            if (!inputPoseWeight) {
                continue;
            }
            const inputPose = this.poses[iInputPose]?.evaluate(context);
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
