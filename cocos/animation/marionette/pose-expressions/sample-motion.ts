import { clamp01 } from '../../../core';
import { ccclass, editable, serializable } from '../../../core/data/decorators';
import { CLASS_NAME_PREFIX_ANIM } from '../../define';
import { ClipMotion } from '../clip-motion';
import { createEval } from '../create-eval';
import { Motion, MotionEval, MotionPort } from '../motion';
import { PoseExpr, PoseExprBindingContext } from './pose-expr';
import { Pose } from '../../core/pose';
import { AnimationGraphEvaluationContext } from '../animation-graph-context';
import { xLink } from '../x-node/x-node-link';

@ccclass(`${CLASS_NAME_PREFIX_ANIM}SampleMotionExpr`)
export class SampleMotionExpr extends PoseExpr {
    @serializable
    @editable
    public motion: Motion | null = new ClipMotion();

    @serializable
    @editable
    @xLink
    public time = 0.0;

    @serializable
    @editable
    public useNormalizedTime = false;

    public bind (context: PoseExprBindingContext) {
        const { motion } = this;
        if (!motion) {
            return;
        }
        const motionEval = motion[createEval](context, context.clipOverrides ?? null);
        if (!motionEval) {
            return;
        }
        const workspace = new SampleMotionExprWorkspace(motionEval, motionEval.createPort());
        this._workspace = workspace;
    }

    public selfEvaluate (context: AnimationGraphEvaluationContext): Pose {
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

    private _workspace: SampleMotionExprWorkspace | null = null;
}

class SampleMotionExprWorkspace {
    constructor (
        public motionEval: MotionEval,
        public motionEvalPort: MotionPort,
    ) {
    }
}
