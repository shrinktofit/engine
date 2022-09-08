import { ccclass, type } from '../../core/data/class-decorator';
import { EditorExtendable } from '../../core/data/editor-extendable';
import { AnimationClip } from '../animation-clip';
import { AnimationClipGraphEvaluationContext } from '../animation-clip-evaluation-for-graph';
import { AnimationState } from '../animation-state';
import { WrapModeMask, WrappedInfo } from '../types';
import { AnimationGraphEvaluationContext, AnimationGraphLayerWideBindingContext } from './animation-graph-context';
import { createEval } from './create-eval';
import { getMotionRuntimeID, GRAPH_DEBUG_ENABLED, pushWeight, RUNTIME_ID_ENABLED } from './graph-debug';
import { ClipStatus } from './graph-eval';
import { Motion, MotionEval } from './motion';
import { wrap } from '../wrap';
import { calculateDeltaPose, Pose } from '../core/pose';
import { animationEmscripten } from './animation-graph.wasm';

@ccclass('cc.animation.ClipMotion')
export class ClipMotion extends EditorExtendable implements Motion {
    @type(AnimationClip)
    public clip: AnimationClip | null = null;

    public [createEval] (context: AnimationGraphLayerWideBindingContext) {
        if (!this.clip) {
            return null;
        }
        const clipMotionEval = new ClipMotionEval(context, this.clip);
        if (RUNTIME_ID_ENABLED) {
            clipMotionEval.runtimeId = getMotionRuntimeID(this);
        }
        return clipMotionEval;
    }

    public clone () {
        const that = new ClipMotion();
        that.clip = this.clip;
        return that;
    }
}

class ClipMotionEval implements MotionEval {
    /**
     * @internal
     */
    public declare __DEBUG__ID__?: string;

    public declare runtimeId?: number;

    private declare _state: AnimationState;

    public declare readonly duration: number;

    constructor (context: AnimationGraphLayerWideBindingContext, clip: AnimationClip) {
        this.duration = clip.duration / clip.speed;
        const clipEval = clip.createEvaluatorForAnimationGraph(context.up);
        this._clipEval = clipEval;
        if (clip.containsAnyEmbeddedPlayer()) {
            this._clipEmbeddedPlayerEval = clip.createEmbeddedPlayerEvaluator(context.up.origin);
        }
        this._clip = clip;
        if (context.additive) {
            // TODO: base clip may be another clip?
            this._baseClipEval = clip.createEvaluatorForAnimationGraph(context.up);
        }
    }

    public getClipStatuses (baseWeight: number): Iterator<ClipStatus, any, undefined> {
        let got = false;
        return {
            next: () => {
                if (got) {
                    return {
                        done: true,
                        value: undefined,
                    };
                } else {
                    got = true;
                    return {
                        done: false,
                        value: {
                            __DEBUG_ID__: this.__DEBUG__ID__,
                            clip: this._state.clip,
                            weight: baseWeight,
                        },
                    };
                }
            },
        };
    }

    get progress () {
        return this._state.time / this.duration;
    }

    public evaluate (progress: number, context: AnimationGraphEvaluationContext) {
        const {
            duration,
            _clipEval: clipEval,
            _baseClipEval: baseClipEval,
        } = this;

        const elapsedTime = duration * progress;

        const { wrapMode } = this._clip;
        const repeatCount = (wrapMode & WrapModeMask.Loop) === WrapModeMask.Loop
            ? Infinity : 1;
        const wrapInfo = wrap(
            elapsedTime,
            duration,
            wrapMode,
            repeatCount,
            false,
            this._wrapInfo,
        );

        const evaluate = (clipEvaluator: ReturnType<AnimationClip['createEvaluatorForAnimationGraph']>, time: number, pose: Pose) => {
            if (animationEmscripten) {
                clipEvaluator.evaluate(time, pose as unknown as AnimationClipGraphEvaluationContext);
            } else {
                clipEvaluator.evaluate(time, { pose });
            }
        };

        // Evaluate this clip.
        const pose = context.createDefaultedPose();
        evaluate(clipEval, wrapInfo.time, pose);

        if (baseClipEval) {
            const basePose = context.createDefaultedPose();
            evaluate(baseClipEval, 0.0, basePose);
            calculateDeltaPose(pose, basePose);
            context.deletePose(basePose);
        }

        // TODO: Evaluate root motions.

        // TODO: Evaluate embedded players.
        // this._clipEmbeddedPlayerEval?.evaluate();

        return pose;
    }

    private _clip: AnimationClip;
    private _clipEval: ReturnType<AnimationClip['createEvaluatorForAnimationGraph']>;
    private _clipEmbeddedPlayerEval: ReturnType<AnimationClip['createEmbeddedPlayerEvaluator']> | null = null;
    private _wrapInfo = new WrappedInfo();
    private _baseClipEval: ReturnType<AnimationClip['createEvaluatorForAnimationGraph']> | null = null;
}
