import { editable, EventTarget as CoreEventTarget } from '../../core';
import { ccclass, serializable } from '../../core/data/decorators';
import { CLASS_NAME_PREFIX_ANIM } from '../define';

@ccclass(`${CLASS_NAME_PREFIX_ANIM}AnimationGraphEvent`)
export class AnimationGraphEvent {
    @editable
    @serializable
    public eventName = '';

    public emit (target: GraphEventTarget) {
        target.emit(this.eventName);
    }
}

export interface GraphEventReceiver {
    on(name: string, callback: () => void): void;
}

export interface GraphEventTarget extends GraphEventReceiver {
    emit(name: string): void;
}

export function createGraphEventTarget (): GraphEventTarget {
    return new CoreEventTarget();
}
