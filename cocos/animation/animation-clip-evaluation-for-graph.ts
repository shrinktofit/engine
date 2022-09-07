import { TransformHandle } from './core/animation-handle';
import { Pose } from './core/pose';
import { ExoticTrsAnimationEvaluatorX } from './exotic-animation/exotic-animation';

export interface AnimationClipGraphBindingContext {
    bindTransform(path: string): TransformHandle | null;
}

export interface AnimationClipGraphEvaluationContext {
    readonly pose: Pose;
}

// TODO
export type TrackEvalStatusX = null;

export class AnimationClipEvaluationForGraph {
    constructor (
        trackEvalStatuses: TrackEvalStatusX[],
        exoticAnimationEvaluator: ExoticTrsAnimationEvaluatorX | undefined,
    ) {
        this._trackEvalStatues = trackEvalStatuses;
        this._exoticAnimationEvaluator = exoticAnimationEvaluator;
    }

    /**
     * Evaluates this animation.
     * @param time The time.
     */
    public evaluate (time: number, output: AnimationClipGraphEvaluationContext) {
        const {
            _exoticAnimationEvaluator: exoticAnimationEvaluator,
        } = this;

        if (exoticAnimationEvaluator) {
            exoticAnimationEvaluator.evaluate(time, output.pose);
        }
    }

    private _exoticAnimationEvaluator: ExoticTrsAnimationEvaluatorX | undefined;
    private _trackEvalStatues:TrackEvalStatusX[] = [];
}
