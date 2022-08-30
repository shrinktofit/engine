
import { AnimationClip } from "../../../cocos/core/animation/animation-clip";
import { AnimationBlend } from "../../../cocos/core/animation/marionette/animation-blend";
import { AnimationBlend1D } from "../../../cocos/core/animation/marionette/animation-blend-1d";
import { AnimationBlend2D } from "../../../cocos/core/animation/marionette/animation-blend-2d";
import { AnimationBlendDirect } from "../../../cocos/core/animation/marionette/animation-blend-direct";
import {
    StateMachine,
    SubStateMachine,
    AnimationGraph,
} from "../../../cocos/core/animation/marionette/animation-graph";
import { ClipMotion } from "../../../cocos/core/animation/marionette/clip-motion";
import { Motion } from "../../../cocos/core/animation/marionette/motion";
import { MotionState } from "../../../cocos/core/animation/marionette/motion-state";
import { EditorExtendableObject } from "../../../cocos/core/data/editor-extras-tag";

export function* visitAnimationGraphEditorExtras(animationGraph: AnimationGraph): Generator<EditorExtendableObject> {
    for (const layer of animationGraph.layers) {
        yield* visitStateMachine(layer.stateMachine);
    }

    function* visitStateMachine(stateMachine: StateMachine): Generator<EditorExtendableObject> {
        for (const state of stateMachine.states()) {
            yield state;
            if (state instanceof MotionState) {
                const motion = state.motion;
                if (!motion) {
                    continue;
                }
                if (motion instanceof AnimationBlend || motion instanceof ClipMotion) {
                    yield motion;
                }
            } else if (state instanceof SubStateMachine) {
                yield* visitStateMachine(state.stateMachine);
            }
        }
    }
}

export function* visitAnimationClips(animationGraph: AnimationGraph): Generator<AnimationClip> {
    for (const layer of animationGraph.layers) {
        yield* visitStateMachine(layer.stateMachine);
    }

    function* visitStateMachine(stateMachine: StateMachine): Generator<AnimationClip> {
        for (const state of stateMachine.states()) {
            if (state instanceof MotionState) {
                const { motion } = state;
                if (motion) {
                    yield* visitMotion(motion);
                }
            } else if (state instanceof SubStateMachine) {
                yield* visitStateMachine(state.stateMachine);
            }
        }
    }

    function* visitMotion(motion: Motion): Generator<AnimationClip> {
        if (motion instanceof ClipMotion) {
            if (motion.clip) {
                yield motion.clip;
            }
        } else if (motion instanceof AnimationBlend1D || motion instanceof AnimationBlend2D || motion instanceof AnimationBlendDirect) {
            for (const { motion: childMotion } of motion.items) {
                if (childMotion) {
                    yield* visitMotion(motion);
                }
            }
        }
    }
}
