import { DEBUG } from 'internal:constants';
import { AnimationClip } from '../../animation-clip';
import { AnimationOutput, AnimationOutputContext, calculateDeltaAnimationOutput } from '../../animation-output-context';
import { __StatsText } from '../__print_stats';
import { AnimationFunctor, FunctorCreateEvalContext, FunctorEval } from './animation-functor';
import { EmptyFunctorEval } from './empty-functor-eval';

export class SingleFrameClipFunctor extends AnimationFunctor {
    public clip: AnimationClip | null = null;

    public time = 0.0;

    public createEval (context: FunctorCreateEvalContext): FunctorEval {
        const {
            clip,
        } = this;
        if (!clip) {
            return new EmptyFunctorEval(context);
        }
        return new SingleFrameClipFunctorEval(clip, this.time, context);
    }
}

class SingleFrameClipFunctorEval implements FunctorEval {
    constructor (clip: AnimationClip, private _time: number, context: FunctorCreateEvalContext) {
        const clipEval = clip.createEvaluatorX({
            bindContext: context.bindContext,
            additive: false,
        });
        this._clipEval = clipEval;
        if (context.additive) {
            // TODO: use base clip
            this._baseClipEval = clip.createEvaluatorX({
                bindContext: context.bindContext,
                additive: false,
            });
        }
        if (DEBUG) {
            this.__debugName = clip.name;
        }
    }

    public resetTime (): void {
    }

    public update (_deltaTime: number): void {
    }

    public evaluate (outputContext: AnimationOutputContext): AnimationOutput {
        const output = outputContext.createDefaultedOutput();
        this._clipEval?.evaluate(this._time, output);
        if (this._baseClipEval) {
            const baseOutput = outputContext.createDefaultedOutput();
            this._baseClipEval.evaluate(0.0, baseOutput);
            calculateDeltaAnimationOutput(output, baseOutput);
            outputContext.deleteOutput(baseOutput);
        }
        return output;
    }

    __printStats (): __StatsText {
        return {
            0: `[[F]]SingleFrameClip ${this.__debugName}@${+this._time.toFixed(2)}s`,
        };
    }

    private _clipEval: ReturnType<AnimationClip['createEvaluatorX']> | null = null;
    private _baseClipEval: ReturnType<AnimationClip['createEvaluatorX']> | null = null;
    private declare __debugName: string;
}
