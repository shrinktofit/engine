import { EDITOR } from 'internal:constants';
import { ccclass, displayName, editable, serializable } from '../../../../core/data/decorators';
import { CLASS_NAME_PREFIX_ANIM } from '../../../define';
import { ClipMotion } from '../../motion/clip-motion';
import { createEval } from '../../create-eval';
import { Motion, MotionEval, MotionPort } from '../../motion/motion';
import { PoseNode } from '../pose-node';
import { MotionCoordination } from '../coordination/motion-coordination';
import { RuntimeCoordinationRecord } from '../coordination/runtime-coordinator';
import { poseGraphCreateNodeFactory, poseGraphNodeAppearance } from '../decorator/node';
import { POSE_GRAPH_NODE_MENU_PREFIX_POSE } from './menu-common';
import { getEnterInfo, makeCreateNodeFactory } from './play-or-sample-motion-pose-node-shared';
import { AnimationGraphBindingContext, AnimationGraphEvaluationContext,
    AnimationGraphSettleContext, AnimationGraphUpdateContext,
} from '../../animation-graph-context';

@ccclass(`${CLASS_NAME_PREFIX_ANIM}MotionNode`)
@poseGraphCreateNodeFactory(makeCreateNodeFactory(
    (motionText) => `${POSE_GRAPH_NODE_MENU_PREFIX_POSE}播放动画/播放 ${motionText}`,
    (motion) => {
        const node = new MotionNode();
        node.motion = motion;
        return node;
    },
))
@poseGraphNodeAppearance({
    themeColor: '#FFFFFF',
})
export class MotionNode extends PoseNode {
    @serializable
    @editable
    public motion: Motion | null = new ClipMotion();

    @serializable
    @editable
    @displayName(`协调`)
    public readonly coordination = new MotionCoordination();

    public bind (context: AnimationGraphBindingContext) {
        const { motion } = this;
        if (!motion) {
            return;
        }
        const motionEval = motion[createEval](context, context.clipOverrides ?? null);
        if (!motionEval) {
            return;
        }
        this._workspace = new Workspace(motionEval, motionEval.createPort());
        if (this.coordination.group) {
            this._runtimeCoordination = context.coordinator.register(this.coordination);
        }
    }

    public settle (context: AnimationGraphSettleContext): void {

    }

    public reenter () {
        if (this._workspace) {
            const { _runtimeCoordination: runtimeCoordination } = this;
            if (runtimeCoordination) {
                runtimeCoordination.notifyRenter();
            } else {
                this._workspace.normalizedTime = 0.0;
            }
        }
    }

    protected doUpdate (context: AnimationGraphUpdateContext): void {
        if (this._workspace) {
            const { deltaTime } = context;
            const { _runtimeCoordination: runtimeCoordination } = this;
            const normalizedDeltaTime = deltaTime / this._workspace.motionEval.duration; // TODO: handle duration 0.0
            if (runtimeCoordination) {
                runtimeCoordination.notifyUpdate(normalizedDeltaTime, context.indicativeWeight);
            } else {
                this._workspace.normalizedTime += normalizedDeltaTime;
            }
        }
    }

    public doEvaluate (context: AnimationGraphEvaluationContext) {
        if (!this._workspace) {
            return context.pushDefaultedPose();
        } else {
            const normalizedTime = this._runtimeCoordination
                ? this._runtimeCoordination.getCoordinatedEnterTime()
                : this._workspace.normalizedTime;
            return this._workspace.motionEvalPort.evaluate(normalizedTime, context);
        }
    }

    private _workspace: Workspace | null = null;
    private _runtimeCoordination: RuntimeCoordinationRecord | undefined = undefined;
}

class Workspace {
    constructor (
        public motionEval: MotionEval,
        public motionEvalPort: MotionPort,
    ) {

    }

    public normalizedTime = 0.0;
}

if (EDITOR) {
    MotionNode.prototype.getTitle = function getTitle (this: MotionNode) {
        const motionName = this.motion instanceof ClipMotion ? this.motion.clip?.name ?? '' : `混合动作`;
        return motionName ? `播放 ${motionName}` : `播放动作`;
    };

    MotionNode.prototype.getEnterInfo = getEnterInfo;
}
