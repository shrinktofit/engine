import { StateMachine, State, SubStateMachine, EmptyState, Layer, FunctorStash, Transition } from '../animation-graph';
import { MotionState } from '../motion-state';
import { AnimationFunctor } from './animation-functor';
import { ModifyNamedCurvesFunctor, NamedCurveModifyItem } from './modify-named-curves-functor';
import { MotionFunctor } from './motion-functor';
import { StateMachineFunctor } from './state-machine-functor';
import { PseudoFunctorState } from '../pseudo-functor-state';
import { UseStashFunctor } from './use-stash-functor';
import { BlendBonesFunctor, BlendItem } from './blend-bones-functor';
import { SingleFrameClipFunctor } from './single-frame-clip-functor';
import { DirectBlendFunctor } from './direct-blend-functor';
import { ClipMotion } from '../clip-motion';

export function __parsePseudoFunctorStates (stateMachine: StateMachine) {
    const pseudoFunctorStateMap = new Map<EmptyState, PseudoFunctorState>();
    const ignoredStates = new Set<State>();
    const ignoredTransitions = new Set<Transition>();
    for (const state of stateMachine.states()) {
        if (!(state instanceof EmptyState)) {
            continue;
        }
        const stateName = state.name;
        if (!stateName.startsWith('#')) {
            continue;
        }
        const incomingSharpSMTransitions = [...stateMachine.getIncomings(state)]
            .filter((incoming) => incoming.from instanceof SubStateMachine && incoming.from.name === '#');
        if (incomingSharpSMTransitions.length !== 1) {
            throw new Error(`A pseudo functor state should have one and only one incoming SM named # describing its functor.`);
        }
        const incomingSharpSMTransition = incomingSharpSMTransitions[0];
        const incomingSharpSM = incomingSharpSMTransition.from as SubStateMachine;
        const functor = parseStateMachineAsFunctor(incomingSharpSM.stateMachine);
        const pseudoFunctorState = new PseudoFunctorState(stateName, functor, incomingSharpSM);
        pseudoFunctorStateMap.set(state, pseudoFunctorState);
        ignoredStates.add(incomingSharpSM);
        ignoredTransitions.add(incomingSharpSMTransition);
    }
    return {
        pseudoFunctorStateMap,
        ignoredStates,
        ignoredTransitions,
    };
}

export function __parsePseudoFunctorStashes (layer: Layer) {
    const { stateMachine: layerStateMachine } = layer;
    const functorStashes = [] as FunctorStash[];
    for (const state of layerStateMachine.states()) {
        if (!(state instanceof SubStateMachine)) {
            continue;
        }
        const stateName = state.name;
        if (!stateName.startsWith('#')) {
            continue;
        }
        if ([...layerStateMachine.getOutgoings(state)].length !== 0) {
            continue;
        }
        const jsonString = stateName.slice(1);
        const json = JSON.parse(jsonString) as AnimationFunctorDescription;
        if (json.type !== 'Stash') {
            throw new Error(
                `Bad state: ${state.name}. `
                + `Such sort of state should only mock a 'stash' functor instead got ${json.type}`,
            );
        }
        const functor = parseInputFunctorArray(state.stateMachine, state.stateMachine.exitState, 1)[0];
        const stashName = json.stashName;
        const functorStash = new FunctorStash();
        functorStash.stashName = stashName;
        functorStash.functor = functor;
        functorStashes.push(functorStash);
    }
    return functorStashes;
}

interface PseudoFunctorStateDescription {
    duration?: number;
}

type AnimationFunctorDescription = {
    type: 'ModifierCurve';
    items: Array<{
        curveName: string;
        value: number;
    }>;
    alpha: number;
} | {
    type: 'Stash';
    stashName: string;
} | {
    type: 'UseStash';
    stashName: string;
} | {
    type: 'SingleFrameClip';
    clip: string;
    time?: number;
} | {
    type: 'BlendBones';
    weights: number[];
    bones: string[];
} | {
    type: 'DirectBlend';
    weights: number[];
};

function parseStateMachineAsFunctor (stateMachine: StateMachine) {
    const outmostFunctors = parseInputFunctorArray(
        stateMachine,
        stateMachine.exitState,
        0,
        1,
    );
    return outmostFunctors.length === 0 ? null : outmostFunctors[0];
}

function parseFunctorInternal (stateMachine: StateMachine, state: State): AnimationFunctor {
    if (state instanceof MotionState) {
        const motionNode = new MotionFunctor();
        motionNode.motion = state.motion;
        return motionNode;
    } else if (state instanceof EmptyState) {
        const stateName = state.name;
        if (!stateName.startsWith('#')) {
            throw new Error(
                `Bad state: ${state.name}. `
                + `Empty state in a pseudo state machine should have a name `
                + `starting with # and then followed by a node description JSON string.`,
            );
        }
        const jsonString = stateName.slice(1);
        const json = JSON.parse(jsonString) as AnimationFunctorDescription;
        if (json.type === 'ModifierCurve') {
            const modifierCurve = new ModifyNamedCurvesFunctor();
            modifierCurve.items = json.items.map(({ curveName, value }) => {
                const item = new NamedCurveModifyItem();
                item.curveName = curveName;
                item.value = value;
                return item;
            });
            modifierCurve.alpha = json.alpha;
            const inputs = parseInputFunctorArray(stateMachine, state, 1);
            modifierCurve.input = inputs[0];
            return modifierCurve;
        } else if (json.type === 'UseStash') {
            const useStashFunctor = new UseStashFunctor(json.stashName);
            return useStashFunctor;
        } else if (json.type === 'SingleFrameClip') {
            parseInputFunctorArray(stateMachine, state, 0, 0);
            const clip = getAssociatedClip(stateMachine, json.clip);
            const functor = new SingleFrameClipFunctor();
            functor.clip = clip;
            functor.time = json.time ?? 0.0;
            return functor;
        } else if (json.type === 'BlendBones') {
            const inputs = parseInputFunctorArray(stateMachine, state, 1, Infinity);
            const functor = new BlendBonesFunctor();
            functor.base = inputs[0];
            functor.items = inputs.slice(1).map((functor, iItem) => {
                const item = new BlendItem();
                item.functor = functor;
                item.weight = json.weights[iItem];
                return item;
            });
            functor.bones = json.bones;
            return functor;
        } else if (json.type === 'DirectBlend') {
            const inputs = parseInputFunctorArray(stateMachine, state, 1, Infinity);
            const functor = new DirectBlendFunctor();
            functor.items = inputs.map((functor, iItem) => {
                const item = new BlendItem();
                item.functor = functor;
                item.weight = json.weights[iItem];
                return item;
            });
            return functor;
        }
        throw new Error(`Unknown functor.`);
    } else if (state instanceof SubStateMachine) {
        const stateMachineFunctor = new StateMachineFunctor();
        stateMachineFunctor.stateMachine = state.stateMachine;
        return stateMachineFunctor;
    }

    throw new Error(`Bad state: ${state.name}. This kind of state can not be presented as a pseudo state machine.`);
}

function parseInputFunctorArray (stateMachine: StateMachine, state: State, minDesired: number, maxDesired = minDesired) {
    const incomings = [...stateMachine.getIncomings(state)];
    if (incomings.length < minDesired || incomings.length > maxDesired) {
        throw new Error(
            `Bad inputs: `
            + `desired ${minDesired === maxDesired ? minDesired : `[${minDesired}, ${maxDesired}]`} `
            + `actual ${incomings.length}`,
        );
    }
    return incomings.map((incoming) => parseFunctorInternal(stateMachine, incoming.from));
}

function getAssociatedClip (stateMachine: StateMachine, name: string) {
    for (const state of stateMachine.states()) {
        if (state.name === name) {
            if (!(state instanceof MotionState) || !state.motion || !(state.motion instanceof ClipMotion) || !state.motion.clip) {
                throw new Error(
                    `Bad associated clip: should be a non-empty clip motion state`,
                );
            }
            return state.motion.clip;
        }
    }
    throw new Error(`There is not associated clip named ${name}`);
}
