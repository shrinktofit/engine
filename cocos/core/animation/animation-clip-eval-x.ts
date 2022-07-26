import { AnimationBindContext, AnimationOutput } from './animation-output-context';
import { ExoticAnimation } from './exotic-animation/exotic-animation';
import { RuntimeBinding, RuntimeBindingX } from './runtime-binding';
import { TrackEval } from './tracks/track';

type ExoticAnimationEvaluatorX = ReturnType<ExoticAnimation['createEvaluatorX']>;

export interface AnimationClipCreateEvalContextX {
    bindContext: AnimationBindContext;

    additive: boolean;
}

export interface TrackEvalStatusX {
    binding: RuntimeBinding | RuntimeBindingX<unknown>;
    trackEval: TrackEval;
}

export class AnimationClipEvaluationX {
    constructor (
        trackEvalStatuses: TrackEvalStatusX[],
        exoticAnimationEvaluator: ExoticAnimationEvaluatorX | undefined,
    ) {
        this._trackEvalStatues = trackEvalStatuses;
        this._exoticAnimationEvaluator = exoticAnimationEvaluator;
    }

    /**
     * Evaluates this animation.
     * @param time The time.
     */
    public evaluate (time: number, output: AnimationOutput) {
        const {
            _trackEvalStatues: trackEvalStatuses,
            _exoticAnimationEvaluator: exoticAnimationEvaluator,
        } = this;

        const nTrackEvalStatuses = trackEvalStatuses.length;
        for (let iTrackEvalStatus = 0; iTrackEvalStatus < nTrackEvalStatuses; ++iTrackEvalStatus) {
            const { trackEval, binding } = trackEvalStatuses[iTrackEvalStatus];
            const value = trackEval.evaluate(time, binding as RuntimeBinding);
            binding.setValue(value, output);
        }

        if (exoticAnimationEvaluator) {
            exoticAnimationEvaluator.evaluate(time, output.pose);
        }
    }

    private _exoticAnimationEvaluator: ExoticAnimationEvaluatorX | undefined;
    private _trackEvalStatues:TrackEvalStatusX[] = [];
}
