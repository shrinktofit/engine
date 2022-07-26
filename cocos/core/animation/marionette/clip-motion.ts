import { editorExtrasTag } from '../../data';
import { ccclass, type } from '../../data/class-decorator';
import { EditorExtendable } from '../../data/editor-extendable';
import { AnimationClip, AnimationClipEvalContext } from '../animation-clip';
import { AnimationOutput, AnimationOutputContext, calculateDeltaAnimationOutput } from '../animation-output-context';
import { createEval } from './create-eval';
import { getMotionRuntimeID, RUNTIME_ID_ENABLED } from './graph-debug';
import { ClipStatus } from './graph-eval';
import { MotionEvalContext, Motion, MotionEval } from './motion';
import { wrap } from '../wrap';
import { WrapModeMask, WrappedInfo } from '../types';
import { __StatsText } from './__print_stats';

@ccclass('cc.animation.ClipMotion')
export class ClipMotion extends EditorExtendable implements Motion {
    @type(AnimationClip)
    public clip: AnimationClip | null = null;

    public [createEval] (context: MotionEvalContext) {
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

    public declare readonly duration: number;

    constructor (context: MotionEvalContext, clip: AnimationClip) {
        this.duration = clip.duration / clip.speed;
        const clipEval = clip.createEvaluatorX({
            bindContext: context.bindContext,
            additive: false,
        });
        this._clipEval = clipEval;
        if (clip.containsAnyEmbeddedPlayer()) {
            this._clipEmbeddedPlayerEval = clip.createEmbeddedPlayerEvaluator(context.bindContext.origin);
        }
        this._clip = clip;
        if (context.additive) {
            // TODO: use base clip
            this._baseClipEval = clip.createEvaluatorX({
                bindContext: context.bindContext,
                additive: false,
            });
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
                            clip: this._clip,
                            weight: baseWeight,
                        },
                    };
                }
            },
        };
    }

    get progress () {
        return this._lastProgress;
    }

    public sample (progress: number, outputContext: AnimationOutputContext) {
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

        // Evaluate tracks.
        const output = outputContext.createDefaultedOutput();
        clipEval.evaluate(wrapInfo.time, output);

        if (baseClipEval) {
            const baseOutput = outputContext.createDefaultedOutput();
            baseClipEval.evaluate(0.0, baseOutput);
            calculateDeltaAnimationOutput(output, baseOutput);
            outputContext.deleteOutput(baseOutput);
        }

        // Evaluate root motions.
        // TODO:
        // const rootMotionLength = (progress - lastProgress) * duration;
        // clipEval.evaluateRootMotion(time, rootMotionLength, weight);

        // Evaluate embedded players.
        // TODO:
        // this._clipEmbeddedPlayerEval?.evaluate();

        this._lastProgress = progress;

        return output;
    }

    __printStats (): __StatsText {
        return {
            0: `[[M]]ClipMotion ${this._clip.name}`,
        };
    }

    private _clip: AnimationClip;
    private _clipEval: ReturnType<AnimationClip['createEvaluatorX']>;
    private _clipEmbeddedPlayerEval: ReturnType<AnimationClip['createEmbeddedPlayerEvaluator']> | null = null;
    private _lastProgress = 0.0;
    private _wrapInfo = new WrappedInfo();
    private _baseClipEval: ReturnType<AnimationClip['createEvaluatorX']> | null = null;
}
