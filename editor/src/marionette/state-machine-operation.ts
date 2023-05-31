import {
    EmptyStateTransition,
    State,
    StateMachine,
    Transition,
    isAnimationTransition,
    EmptyState,
    SubStateMachine,
    ProceduralPoseState,
    ProceduralPoseTransition,
    AnimationTransition,
} from "../../../cocos/animation/marionette/animation-graph";
import { cloneAnimationGraphEditorExtrasFrom } from "../../../cocos/animation/marionette/animation-graph-editor-extras-clone-helper";
import { AnimationGraphEventBinding } from "../../../cocos/animation/marionette/event/event-binding";
import { ownerSymbol } from "../../../cocos/animation/marionette/ownership";
import { MotionState } from "../../../cocos/animation/marionette/state-machine/motion-state";
import { assertIsTrue } from "../../../cocos/core/data/utils/asserts";
import { editorExtrasTag, error } from "../../../exports/base";
import { Condition, copyPoseGraphNodes, pastePoseGraphNodes } from "../../exports/new-gen-anim";

function copyTransitionConditions(lhs: Transition, rhs: Transition) {
    lhs.conditions = rhs.conditions.map((condition) => condition.clone());
}

function copyTransition<T extends Transition>(lhs: T, rhs: T) {
    if (isAnimationTransition(lhs)) {
        assertIsTrue(isAnimationTransition(rhs));
        rhs.copyTo(lhs);
    } else if (lhs instanceof EmptyStateTransition) {
        assertIsTrue(rhs instanceof EmptyStateTransition);
        rhs.copyTo(lhs);
    } else {
        rhs.copyTo(lhs);
    }
}

/**
 * Clones a state into same state machine.
 * @param stateMachine The state machine within which the motion state locates.
 * @param state The state.
 * @param includeTransitions If true, transitions are also cloned.
 * @returns The newly created state.
 * 
 * For each editor extras object attached on animation-graph-specific objects,
 * if the editor extras object has a method called `clone`,
 * that method would be called to perform a clone operation on that editor extras object.
 * The return value would be used as the clone result.
 * The method `clone` has the signature: `(host: EditorExtendableObject) => unknown`.
 * Otherwise, if no `clone` method provide, the new editor extras would be set to undefined.
 */
export function cloneState<TState extends MotionState | EmptyState | SubStateMachine | ProceduralPoseState>(
    stateMachine: StateMachine,
    state: TState,
    includeTransitions: boolean,
): TState;

/**
 * Clones a state into maybe another state machine.
 * @param stateMachine The state machine within which the motion state locates.
 * @param state The state.
 * @param targetStateMachine Target state machine
 * @returns The newly created state.
 * 
 * For each editor extras object attached on animation-graph-specific objects,
 * if the editor extras object has a method called `clone`,
 * that method would be called to perform a clone operation on that editor extras object.
 * The return value would be used as the clone result.
 * The method `clone` has the signature: `(host: EditorExtendableObject) => unknown`.
 * Otherwise, if no `clone` method provide, the new editor extras would be set to undefined.
 */
export function cloneState(
    stateMachine: StateMachine,
    state: MotionState | EmptyState | SubStateMachine | ProceduralPoseState,
    targetStateMachine: StateMachine,
): SubStateMachine;

export function cloneState(stateMachine: StateMachine, state: MotionState | EmptyState | SubStateMachine | ProceduralPoseState, includeTransitions: boolean | StateMachine) {
    const newStateOwner = typeof includeTransitions === 'boolean' ? stateMachine : includeTransitions;
    let newState: State;
    if (state instanceof MotionState) {
        const newMotionState = newState = newStateOwner.addMotion();
        state.copyTo(newMotionState);
    } else if (state instanceof EmptyState) {
        const newEmptyState = newState = newStateOwner.addEmpty();
        state.copyTo(newEmptyState);
    } else if (state instanceof ProceduralPoseState) {
        const newProceduralPoseState = newState = newStateOwner.addProceduralPoseState();
        newProceduralPoseState[editorExtrasTag] = cloneAnimationGraphEditorExtrasFrom(state);
        const copyInfo = copyPoseGraphNodes(state.graph, [...state.graph.nodes()]);
        pastePoseGraphNodes(newProceduralPoseState.graph, copyInfo);
    } else /* if (state instanceof SubStateMachine) */ {
        const newSubStateMachine = newState = newStateOwner.addSubStateMachine();
        state.copyTo(newSubStateMachine);
    }
    if (includeTransitions && stateMachine === newStateOwner) {
        const incomings = stateMachine.getIncomings(state);
        for (const incoming of incomings) {
            const newIncoming = stateMachine.connect(incoming.from, newState);
            copyTransition(newIncoming, incoming);
        }
        const outgoings = stateMachine.getOutgoings(state);
        for (const outgoing of outgoings) {
            const newOutgoing = stateMachine.connect(newState, outgoing.to);
            copyTransition(newOutgoing, outgoing);
        }
    }
    return newState;
}

/**
 * Turns a motion state into a new sub state machine.
 * @param stateMachine The state machine within which the motion state locates.
 * @param state The motion state.
 * @returns The newly created sub state machine.
 */
export function turnMotionStateIntoSubStateMachine(stateMachine: StateMachine, state: MotionState) {
    // Create new state.
    const subStateMachine = stateMachine.addSubStateMachine();
    subStateMachine.name = state.name;

    const newMotionState = subStateMachine.stateMachine.addMotion();
    state.copyTo(newMotionState);
    subStateMachine.stateMachine.connect(subStateMachine.stateMachine.entryState, newMotionState);

    // Connect.
    const incomings = stateMachine.getIncomings(state);
    for (const incoming of incomings) {
        const newIncoming = stateMachine.connect(incoming.from, subStateMachine);
        copyTransition(newIncoming, incoming);
    }
    const outgoings = stateMachine.getOutgoings(state);
    for (const outgoing of outgoings) {
        const newOutgoingInternal = subStateMachine.stateMachine.connect(
            newMotionState, subStateMachine.stateMachine.exitState);
        copyTransition(newOutgoingInternal, outgoing);
        const newOutgoingExternal = stateMachine.connect(
            subStateMachine, outgoing.to);
        copyTransitionConditions(newOutgoingExternal, outgoing);
    }

    // Remove old one.
    stateMachine.remove(state);

    return subStateMachine;
}

export function swapState(stateMachine: StateMachine, state1: State, state2: State) {
    // The states should be bound, ie. in state machine.
    let isState1Bound = false;
    let isState2Bound = false;
    for (const state of stateMachine.states()) {
        if (state === state1) {
            isState1Bound = true;
        }
        if (state === state2) {
            isState2Bound = true;
        }
    }
    if (!isState1Bound || !isState2Bound) {
        error(`The states to swap are unbound.`);
        return;
    }

    // Can not swap between special states.
    if (isSpecialState(stateMachine, state1) || isSpecialState(stateMachine, state2)) {
        error(`Can not swap with special states.`);
        return;
    }

    // If the state is identical, no operation needed.
    if (state1 === state2) {
        return;
    }

    // Swap editor extras.
    {
        const t = state1[editorExtrasTag];
        state1[editorExtrasTag] = state2[editorExtrasTag];
        state2[editorExtrasTag] = t;
    }

    // Save their transitions.
    const state1Transitions = saveTransitions(stateMachine, state1);
    const state2Transitions = saveTransitions(stateMachine, state2);

    // Erase their transitions.
    stateMachine.eraseTransitionsIncludes(state1);
    stateMachine.eraseTransitionsIncludes(state2);

    // Reverts the states to another states.
    revertSavedTransitions(stateMachine, state1, state2Transitions);
    revertSavedTransitions(stateMachine, state2, state1Transitions);
}

function isSpecialState(stateMachine: StateMachine, state: State) {
    switch (state) {
        case stateMachine.entryState:
        case stateMachine.exitState:
        case stateMachine.anyState:
            return true;
        default:
            return false;
    }
}

function saveTransitions(stateMachine: StateMachine, state: State) {
    return {
        incomings: [...stateMachine.getIncomings(state)].map((tr) => [tr.from, saveTransition(tr)] as const),
        outgoings: [...stateMachine.getOutgoings(state)].map((tr) => [tr.to, saveTransition(tr)] as const),
    };
}

function revertSavedTransitions(
    stateMachine: StateMachine, state: State, transitions: ReturnType<typeof saveTransitions>,
) {
    for (const [from, transition] of transitions.incomings) {
        const tr = stateMachine.connect(from, state);
        revertSavedTransition(tr, transition);
    }
    for (const [to, transition] of transitions.outgoings) {
        const tr = stateMachine.connect(state, to);
        revertSavedTransition(tr, transition);
    }
}

type FilterTransitionDataProps<TTransition extends Transition> = Omit<{
    [k in keyof TTransition as TTransition[k] extends Function ? never : k]: TTransition[k];
}, typeof ownerSymbol | 'from' | 'to'>;

type SavedBaseTransition = FilterTransitionDataProps<Transition> & { type: 'transition' };
type SavedAnimationTransition = FilterTransitionDataProps<AnimationTransition> & { type: 'animation-transition' };
type SavedProceduralPoseTransition = FilterTransitionDataProps<ProceduralPoseTransition> & { type: 'procedural-pose-transition' };
type SavedEmptyStateTransition = FilterTransitionDataProps<EmptyStateTransition> & { type: 'empty-state-transition' };
type SavedTransition = SavedBaseTransition | SavedAnimationTransition | SavedProceduralPoseTransition | SavedEmptyStateTransition;

function saveTransition(transition: Transition): SavedTransition {
    if (isAnimationTransition(transition)) {
        return {
            type: 'animation-transition',
            [editorExtrasTag]: transition[editorExtrasTag],
            conditions: transition.conditions,
            duration: transition.duration,
            relativeDuration: transition.relativeDuration,
            exitConditionEnabled: transition.exitConditionEnabled,
            exitCondition: transition.exitCondition,
            destinationStart: transition.destinationStart,
            relativeDestinationStart: transition.relativeDestinationStart,
            startEventBinding: transition.startEventBinding,
            endEventBinding: transition.endEventBinding,
        };
    } else if (transition instanceof ProceduralPoseTransition) {
        return {
            type: 'procedural-pose-transition',
            [editorExtrasTag]: transition[editorExtrasTag],
            conditions: transition.conditions,
            duration: transition.duration,
            destinationStart: transition.destinationStart,
            relativeDestinationStart: transition.relativeDestinationStart,
            startEventBinding: transition.startEventBinding,
            endEventBinding: transition.endEventBinding,
        };
    } else if (transition instanceof EmptyStateTransition) {
        return {
            type: 'empty-state-transition',
            [editorExtrasTag]: transition[editorExtrasTag],
            conditions: transition.conditions,
            duration: transition.duration,
            destinationStart: transition.destinationStart,
            relativeDestinationStart: transition.relativeDestinationStart,
            startEventBinding: transition.startEventBinding,
            endEventBinding: transition.endEventBinding,
        };
    } else {
        return {
            type: 'transition',
            [editorExtrasTag]: transition[editorExtrasTag],
            conditions: transition.conditions,
        };
    }
}

function convertTransitionData<TTargetType extends SavedTransition['type']>(
    saved: SavedTransition, targetType: TTargetType,
): SavedTransition {
    switch (targetType) {
        case 'animation-transition': return {
            ...toAnimationTransition(),
            type: targetType,
        };
        case 'procedural-pose-transition': return {
            ...toProceduralPoseTransition(),
            type: targetType,
        };
        case 'empty-state-transition': return {
            ...toEmptyStateTransition(),
            type: targetType,
        };
        case 'transition': return {
            ...saved,
            type: targetType,
        };
        default: throw new Error(`Unknown transition type.`);
    }

    function toAnimationTransition(): Omit<SavedAnimationTransition, 'type'> {
        if (saved.type === 'animation-transition') {
            return { ...saved };
        } else if (saved.type === 'procedural-pose-transition') {
            return {
                ...saved,
                relativeDuration: false,
                exitConditionEnabled: false,
                exitCondition: 1.0,
            };
        } else if (saved.type === 'empty-state-transition') {
            return {
                ...saved,
                relativeDuration: false,
                exitConditionEnabled: false,
                exitCondition: 1.0,
            };
        } else {
            return {
                ...saved,
                duration: 0.3,
                relativeDuration: false,
                destinationStart: 0.0,
                relativeDestinationStart: false,
                exitConditionEnabled: false,
                exitCondition: 1.0,
                startEventBinding: new AnimationGraphEventBinding(),
                endEventBinding: new AnimationGraphEventBinding(),
            };
        }
    }

    function toProceduralPoseTransition(): Omit<SavedProceduralPoseTransition, 'type'> {
        if (saved.type === 'animation-transition') {
            return { ...saved };
        } else if (saved.type === 'procedural-pose-transition') {
            return { ...saved };
        } else if (saved.type === 'empty-state-transition') {
            return {
                ...saved,
            };
        } else {
            return {
                ...saved,
                duration: 0.3,
                destinationStart: 0.0,
                relativeDestinationStart: false,
                startEventBinding: new AnimationGraphEventBinding(),
                endEventBinding: new AnimationGraphEventBinding(),
            };
        }
    }

    function toEmptyStateTransition(): Omit<SavedEmptyStateTransition, 'type'> {
        if (saved.type === 'animation-transition') {
            return { ...saved };
        } else if (saved.type === 'procedural-pose-transition') {
            return { ...saved };
        } else if (saved.type === 'empty-state-transition') {
            return { ...saved };
        } else {
            return {
                ...saved,
                duration: 0.3,
                destinationStart: 0.0,
                relativeDestinationStart: false,
                startEventBinding: new AnimationGraphEventBinding(),
                endEventBinding: new AnimationGraphEventBinding(),
            };
        }
    }
}

function revertSavedTransition(target: Transition, saved: ReturnType<typeof saveTransition>) {

}
