import { AnimationClip, exoticAnimationTag } from '../../../cocos/animation/animation-clip';
import { TransformFlag } from '../../../cocos/animation/animation-clip-manipulation';
import { Track, trackBindingTag } from '../../../cocos/animation/tracks/track';

export function removeNodeTransformAnimation(clip: AnimationClip, path: string, flags: TransformFlag) {
    clip[exoticAnimationTag]?.removeNodeAnimation(path, flags);

    for (let iTrack = clip.tracksCount - 1; iTrack >= 0; --iTrack) {
        const track = clip.getTrack(iTrack);
        const trsPath = track[trackBindingTag].parseTrsPath();
        if (!trsPath || trsPath.node !== path) {
            continue;
        }
        switch (trsPath.property) {
            case 'position':
                if ((flags & TransformFlag.POSITION) === TransformFlag.POSITION) {
                    clip.removeTrack(iTrack);
                }
                break;
            case 'rotation':
            case 'eulerAngles':
                if ((flags & TransformFlag.ROTATION) === TransformFlag.ROTATION) {
                    clip.removeTrack(iTrack);
                }
                break;
            case 'scale':
                if ((flags & TransformFlag.SCALE) === TransformFlag.SCALE) {
                    clip.removeTrack(iTrack);
                }
                break;
        }
    }
}
