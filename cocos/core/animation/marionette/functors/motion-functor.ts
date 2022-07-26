import { AnimationOutput, AnimationOutputContext } from '../../animation-output-context';
import { createEval } from '../create-eval';
import { Motion, MotionEval } from '../motion';
import { AnimationFunctor, FunctorCreateEvalContext, FunctorEval } from './animation-functor';

export class MotionFunctor extends AnimationFunctor {
    public motion: Motion | null = null;

    public createEval (context: FunctorCreateEvalContext): FunctorEval {
        const { motion } = this;
        if (!motion) {
            throw new Error('No motion specified!');
        }
        const motionEval = motion[createEval](context);
        if (!motionEval) {
            throw new Error('Failed to create motion eval.');
        }
        return new MotionFunctorEval(motionEval);
    }
}

class MotionFunctorEval implements FunctorEval {
    constructor (private _motionEval: MotionEval) {

    }

    public resetTime (): void {
        this._time = 0.0;
    }

    public update (deltaTime: number): void {
        this._time += deltaTime;
    }

    public evaluate (outputContext: AnimationOutputContext): AnimationOutput {
        return this._motionEval.sample(this._time / this._motionEval.duration, outputContext);
    }

    public __printStats () {
        return this._motionEval.__printStats();
    }

    private _time = 0.0;
}
