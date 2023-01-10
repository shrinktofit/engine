import { AnimationClip, AnimationState } from "../../../cocos/animation";
import { RealTrack, Track, TrackPath } from "../../../cocos/animation/animation";
import { Node } from "../../../cocos/scene-graph";

describe(`Adjoint curve track`, () => {
    test(`Track path`, () => {
        const path = new TrackPath();

        expect(path.toAdjointCurve('xyz')).toBe(path);
        expect(path.length).toBe(1);
        expect(path.isAdjointCurve()).toBe(true);
        expect(path.parseAdjointCurve()).toBe('xyz');

        // The adjoint curve path shall be the only subpath in a track path.
        expect(() => path.toAdjointCurve('abc')).toThrowError();
        expect(() => path.toProperty('x')).toThrowError();
        expect(() => path.toElement(1)).toThrowError();
        expect(() => path.toHierarchy('h')).toThrowError();
        expect(() => path.toComponent('c')).toThrowError();
        expect(() => path.toCustomized({ get() {  } })).toThrowError();
        expect(() => new TrackPath().toHierarchy('h').toAdjointCurve('xyz')).toThrowError();
    });

    test(`Shall be ignored in legacy animation system`, () => {
        const clip = new AnimationClip();
        clip.duration = 1.0;
        const realTrack = new RealTrack();
        realTrack.path.toAdjointCurve('xyz');
        clip.addTrack(realTrack);

        const state = new AnimationState(clip);
        const node = new Node();
        state.initialize(node);
    });
});