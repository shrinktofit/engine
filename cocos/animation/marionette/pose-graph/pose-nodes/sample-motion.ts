import { EDITOR } from 'internal:constants';
import { clamp01 } from '../../../../core';
import { ccclass, editable, serializable } from '../../../../core/data/decorators';
import { CLASS_NAME_PREFIX_ANIM } from '../../../define';
import { ClipMotion } from '../../motion/clip-motion';
import { createEval } from '../../create-eval';
import { Motion, MotionEval, MotionPort } from '../../motion/motion';
import { PoseNode } from '../pose-node';
import { Pose } from '../../../core/pose';
import { AnimationGraphBindingContext, AnimationGraphEvaluationContext, AnimationGraphSettleContext, AnimationGraphUpdateContext } from '../../animation-graph-context';
import { input } from '../decorator/input';
import { poseGraphCreateNodeFactory } from '../decorator/node';
import { POSE_GRAPH_NODE_MENU_PREFIX_POSE } from './menu-common';
import { getEnterInfo, makeCreateNodeFactory } from './play-or-sample-motion-pose-node-shared';
import { PoseGraphType } from '../foundation/type-system';

@ccclass(`${CLASS_NAME_PREFIX_ANIM}SampleMotionNode`)
@poseGraphCreateNodeFactory(makeCreateNodeFactory(
    (motionText) => `${POSE_GRAPH_NODE_MENU_PREFIX_POSE}采样动画/采样 ${motionText}`,
    (motion) => {
        const node = new SampleMotionNode();
        node.motion = motion;
        return node;
    },
))
export class SampleMotionNode extends PoseNode {
    @serializable
    @editable
    public motion: Motion | null = new ClipMotion();

    @serializable
    @editable
    @input({ type: PoseGraphType.FLOAT })
    public time = 0.0;

    @serializable
    @editable
    public useNormalizedTime = false;

    public bind (context: AnimationGraphBindingContext) {
        const { motion } = this;
        if (!motion) {
            return;
        }
        const motionEval = motion[createEval](context, context.clipOverrides ?? null);
        if (!motionEval) {
            return;
        }
        const workspace = new SampleMotionNodeWorkspace(motionEval, motionEval.createPort());
        this._workspace = workspace;
    }

    public settle (context: AnimationGraphSettleContext): void { }

    public reenter (): void { }

    protected doUpdate (context: AnimationGraphUpdateContext): void {
    }

    protected doEvaluate (context: AnimationGraphEvaluationContext): Pose {
        const { _workspace: workspace } = this;

        if (!workspace) {
            return context.pushDefaultedPose();
        }

        const time = this.time;
        const normalizedTime = this.useNormalizedTime
            ? time
            : time / workspace.motionEval.duration;
        return workspace.motionEvalPort.evaluate(clamp01(normalizedTime), context);
    }

    private _workspace: SampleMotionNodeWorkspace | null = null;
}

class SampleMotionNodeWorkspace {
    constructor (
        public motionEval: MotionEval,
        public motionEvalPort: MotionPort,
    ) {
    }
}

if (EDITOR) {
    SampleMotionNode.prototype.getTitle = function getTitle (this: SampleMotionNode) {
        const motionName = this.motion instanceof ClipMotion ? this.motion.clip?.name ?? '' : `混合动作`;
        return motionName ? `采样 ${motionName}` : `采样动作`;
    };

    SampleMotionNode.prototype.getEnterInfo = getEnterInfo;
}
