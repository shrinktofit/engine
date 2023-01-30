import { ccclass, editable, serializable } from '../../../core/data/decorators';
import { CLASS_NAME_PREFIX_ANIM } from '../../define';
import { ClipMotion } from '../clip-motion';
import { createEval } from '../create-eval';
import { Motion, MotionEval, MotionPort } from '../motion';
import { PoseExpr, PoseExprBindingContext, PoseExprEvaluationContext } from './pose-expr';

@ccclass(`${CLASS_NAME_PREFIX_ANIM}MotionExpr`)
export class MotionExpr extends PoseExpr {
    @serializable
    @editable
    public motion: Motion | null = new ClipMotion();

    public bind (context: PoseExprBindingContext) {
        const { motion } = this;
        if (!motion) {
            return;
        }
        const motionEval = motion[createEval](context, context.clipOverrides ?? null);
        if (!motionEval) {
            return;
        }
        this._workspace = new Workspace(motionEval, motionEval.createPort());
    }

    public update (deltaTime: number): void {
        if (this._workspace) {
            this._workspace.normalizedTime += deltaTime / this._workspace.motionEval.duration; // TODO: handle duration 0.0
        }
    }

    public selfEvaluate (context: PoseExprEvaluationContext) {
        if (!this._workspace) {
            return context.pushDefaultedPose();
        } else {
            return this._workspace.motionEvalPort.evaluate(this._workspace.normalizedTime, context);
        }
    }

    private _workspace: Workspace | null = null;
}

class Workspace {
    constructor (
        public motionEval: MotionEval,
        public motionEvalPort: MotionPort,
    ) {

    }

    public normalizedTime = 0.0;
}
