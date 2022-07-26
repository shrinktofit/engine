import { AnimationFunctor } from './functors/animation-functor';
import { InteractiveState } from './state';

export class FunctorState extends InteractiveState {
    constructor (functor: AnimationFunctor | null) {
        super();
        this.functor = functor;
    }

    public declare name: string;

    /**
     * If null, indicate there is no functor connected to output.
     */
    public functor: AnimationFunctor | null = null;
}
