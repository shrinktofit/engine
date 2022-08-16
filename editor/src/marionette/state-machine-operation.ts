import { EmptyStateTransition, State, StateMachine, Transition, isAnimationTransition, EmptyState, SubStateMachine } from "../../../cocos/core/animation/marionette/animation-graph";
import { MotionState } from "../../../cocos/core/animation/marionette/motion-state";
import { assertIsTrue } from "../../../cocos/core/data/utils/asserts";

function assignTransitionConditions(lhs: Transition, rhs: Transition) {
    lhs.conditions = rhs.conditions.map((condition) => condition.clone());
}

function assignTransition<T extends Transition>(lhs: T, rhs: T) {
    if (isAnimationTransition(lhs)) {
        assertIsTrue(isAnimationTransition(rhs));
        rhs.assign(lhs);
    } else if (lhs instanceof EmptyStateTransition) {
        assertIsTrue(rhs instanceof EmptyStateTransition);
        rhs.assign(lhs);
    } else {
        rhs.assign(lhs);
    }
}

/**
 * Clones a state into same state machine.
 * @param stateMachine The state machine within which the motion state locates.
 * @param state The state.
 * @param includeTransitions If true, transitions are also cloned.
 * @returns The newly created state.
 */
export function cloneState(stateMachine: StateMachine, state: MotionState | EmptyState | SubStateMachine, includeTransitions: boolean): SubStateMachine;

/**
 * Clones a state into maybe another state machine.
 * @param stateMachine The state machine within which the motion state locates.
 * @param state The state.
 * @param targetStateMachine Target state machine
 * @returns The newly created state.
 */
export function cloneState(stateMachine: StateMachine, state: MotionState | EmptyState | SubStateMachine, targetStateMachine: StateMachine): SubStateMachine;

export function cloneState(stateMachine: StateMachine, state: MotionState | EmptyState | SubStateMachine, includeTransitions: boolean | StateMachine) {
    const newStateOwner = typeof includeTransitions === 'boolean' ? stateMachine : includeTransitions;
    let newState: State;
    if (state instanceof MotionState) {
        const newMotionState = newState = newStateOwner.addMotion();
        state.assign(newMotionState);
    } else if (state instanceof EmptyState) {
        const newEmptyState = newState = newStateOwner.addEmpty();
        state.assign(newEmptyState);
    } else /* if (state instanceof SubStateMachine) */ {
        const newSubStateMachine = newState = newStateOwner.addSubStateMachine();
        state.assign(newSubStateMachine);
    }
    if (includeTransitions && stateMachine === newStateOwner) {
        const incomings = stateMachine.getIncomings(state);
        for (const incoming of incomings) {
            const newIncoming = stateMachine.connect(incoming.from, newState);
            assignTransition(newIncoming, incoming);
        }
        const outgoings = stateMachine.getOutgoings(state);
        for (const outgoing of outgoings) {
            const newOutgoing = stateMachine.connect(state, outgoing.to);
            assignTransition(newOutgoing, outgoing);
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
    const newMotionState = subStateMachine.stateMachine.addMotion();
    state.assign(newMotionState);
    subStateMachine.stateMachine.connect(subStateMachine.stateMachine.entryState, newMotionState);

    // Connect.
    const incomings = stateMachine.getIncomings(state);
    for (const incoming of incomings) {
        const newIncoming = stateMachine.connect(incoming.from, subStateMachine);
        assignTransition(newIncoming, incoming);
    }
    const outgoings = stateMachine.getOutgoings(state);
    for (const outgoing of outgoings) {
        const newOutgoingInternal = subStateMachine.stateMachine.connect(
            newMotionState, subStateMachine.stateMachine.exitState);
        assignTransition(newOutgoingInternal, outgoing);
        const newOutgoingExternal = stateMachine.connect(
            subStateMachine, outgoing.to);
        assignTransitionConditions(newOutgoingExternal, outgoing);
    }

    // Remove old one.
    stateMachine.remove(state);

    return subStateMachine;
}
