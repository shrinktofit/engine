import { AnimationFunctor } from './functors/animation-functor';
import { InteractiveState } from './state';

export class PseudoFunctorState {
    constructor (name: string, functor: AnimationFunctor | null, componentHost: InteractiveState) {
        this.name = name;
        this.functor = functor;
        this.componentHost = componentHost;
    }

    public declare name: string;

    public declare functor: AnimationFunctor | null;

    public declare componentHost: InteractiveState;

    public duration = 0.3;
}
