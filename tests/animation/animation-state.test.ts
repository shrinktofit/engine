import { AnimationClip } from '../../cocos/core/animation/animation-clip';
import { AnimationState } from '../../cocos/core/animation/animation-state';
import { WrapMode } from '../../cocos/core/animation/types';

describe('Animation State', () => {
    const animationClip = new AnimationClip();

    const clip = new AnimationClip();
    clip.duration = 1.0;

    const createStateWithWrapMode = (wrapMode: WrapMode) => {
        const state = new AnimationState(clip);
        state.wrapMode = wrapMode;
        return state;
    };

    test('Wrap mode: Normal', () => {
        const state = createStateWithWrapMode(WrapMode.Normal);
    });

    test('Wrap mode: Reverse', () => {
        const state = createStateWithWrapMode(WrapMode.Reverse);
    });

    test('Wrap mode: Loop', () => {
        const state = createStateWithWrapMode(WrapMode.Loop);
    });

    test('Wrap mode: LoopReverse', () => {
        const state = createStateWithWrapMode(WrapMode.LoopReverse);
    });

    test('Wrap mode: PingPong', () => {
        const state = createStateWithWrapMode(WrapMode.PingPong);
    });

    test('Wrap mode: PingPongReverse', () => {
        const state = createStateWithWrapMode(WrapMode.PingPongReverse);
    });

    test('Set time', () => {
        const clip = new AnimationClip();
        clip.duration = 1.0;
        const state = new AnimationState(clip);

        expect(state.time).toStrictEqual(0); // Initial state

        state.time = 0.5;
        expect(state.time).toStrictEqual(0.5); // Normal value

        state.time = clip.duration; // The max boundary
        expect(state.time).toStrictEqual(clip.duration);

        state.time = -0.5; // Negative value
        expect(state.time).toStrictEqual(0);

        state.time = 1.1; // Out of boundary
        expect(state.time).toStrictEqual(clip.duration);
    });

    test('Reset time while changing wrap mode', () => {
        const state = new AnimationState(animationClip);
        state.time = 0.5;
        // Even if its value is not going to be changed
        // eslint-disable-next-line no-self-assign
        state.wrapMode = state.wrapMode;
        expect(state.time).toStrictEqual(0.0);
    });
});
