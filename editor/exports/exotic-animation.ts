import { RealCurve } from '../../cocos/core/curves/curve';
import { AnimationClip, exoticAnimationTag } from '../../cocos/core/animation/animation-clip';
import { trackBindingTag } from '../../cocos/core/animation/tracks/track';
import { QuatCurve } from '../../cocos/core/curves/quat-curve';
import { Quat, Vec3 } from '../../cocos/core';

export {
    exoticAnimationTag,
} from '../../cocos/core/animation/animation-clip';

export {
    ExoticAnimation,
} from '../../cocos/core/animation/exotic-animation/exotic-animation';

/**
 * Normalize trs animations on specified node.
 * For position, rotation, scale part on these animation,
 * the animations would be reset as if they contains constant animation:
 * - The position always be zero;
 * - the rotation always be identity rotation;
 * - the scale always be (1, 1, 1) vector.
 * This function also proceed with exotic animations.
 * @param animationClip 
 * @param nodes 
 */
export function normalizeTrsAnimations(animationClip: AnimationClip, nodes: string[]) {
    const {
        tracks,
        [exoticAnimationTag]: exoticAnimation,
    } = animationClip;

    for (const track of tracks) {
        const trsPath = track[trackBindingTag].parseTrsPath();
        if (!trsPath) {
            continue;
        }
        const { node, property } = trsPath;
        if (!nodes.includes(node)) {
            continue;
        }
        for (const { curve } of track.channels()) {
            if (curve instanceof RealCurve) {
                const defaultVal = property === 'scale' ? 1.0 : 0.0;
                curve.assignSorted([[0.0, defaultVal]]);
            } else if (curve instanceof QuatCurve) {
                curve.assignSorted([[0.0, { value: Quat.IDENTITY }]]);
            }
        }
    }

    for (const node of nodes) {
        const nodeAnimation = exoticAnimation.getNodeAnimation(node);
        if (nodeAnimation) {
            nodeAnimation.constant(
                Vec3.ZERO,
                Quat.IDENTITY,
                Vec3.ONE,
            );
        }
    }
}
