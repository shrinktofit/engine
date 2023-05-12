import { editable } from '../../core';
import { ccclass, serializable } from '../../core/data/decorators';
import { CLASS_NAME_PREFIX_ANIM } from '../define';
import { AnimationGraphCustomEventEmitter } from './event/custom-event-emitter';

@ccclass(`${CLASS_NAME_PREFIX_ANIM}AnimationGraphEvent`)
export class AnimationGraphEvent {
    @editable
    @serializable
    public eventName = '';

    public emit (target: AnimationGraphCustomEventEmitter) {
        target.emit(this.eventName);
    }
}
