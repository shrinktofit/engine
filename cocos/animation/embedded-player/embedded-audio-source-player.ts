/*
 Copyright (c) 2022-2023 Xiamen Yaji Software Co., Ltd.

 https://www.cocos.com/

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights to
 use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 of the Software, and to permit persons to whom the Software is furnished to do so,
 subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
*/

import { ccclass, editable, serializable, type } from 'cc.decorator';
import { warn, js } from '../../core';
import type { Node } from '../../scene-graph/node';
import { CLASS_NAME_PREFIX_ANIM } from '../define';
import { EmbeddedPlayableState, EmbeddedPlayable } from './embedded-player';
import { AudioClip, AudioSource } from '../../audio';

/**
 * @en
 * The embedded audio source playable. The players play audio on a embedded player.
 * @zh
 * 音频子区域播放器。此播放器在子区域上播放音频。
 */
@ccclass(`${CLASS_NAME_PREFIX_ANIM}EmbeddedAudioSourcePlayable`)
export class EmbeddedAudioSourcePlayable extends EmbeddedPlayable {
    /**
     * @en
     * Path to the node where audio source component inhabits, relative from animation context root.
     * @zh
     * 音频源组件所在的结点路径，相对于动画上下文的根节点。
     */
    @serializable
    public path = '';

    @serializable
    @editable
    @type(AudioClip)
    public clip: AudioClip | null = null;

    public instantiate (root: Node): EmbeddedAudioSourcePlayableState | null {
        const node = root.getChildByPath(this.path);
        if (!node) {
            warn(`Hierarchy path ${this.path} does not exists.`);
            return null;
        }
        // TODO: we shouldn't wanna know the name of `AudioSource` indeed.
        const AudioSourceConstructor = js.getClassByName(`cc.AudioSource`) as Constructor<AudioSource> | undefined;
        if (!AudioSourceConstructor) {
            warn(`Audio source is required for embedded audio player.`);
            return null;
        }
        const audioSource = node.getComponent(AudioSourceConstructor);
        if (!audioSource) {
            warn(`${this.path} does not includes an audio source component.`);
            return null;
        }
        return new EmbeddedAudioSourcePlayableState(audioSource, this.clip);
    }
}

class EmbeddedAudioSourcePlayableState extends EmbeddedPlayableState {
    constructor (audioSource: AudioSource, clip: AudioClip | null) {
        super(false);
        this._audioSource = audioSource;
        this._audioClip = clip;
    }

    public destroy (): void {
        // DO NOTHING
    }

    /**
     * Plays the particle system from the beginning no matter current time.
     */
    public play (): void {
        if (this._audioClip) {
            this._audioSource.playOneShot(this._audioClip);
        } else {
            this._audioSource.play();
        }
    }

    /**
     * Pause the particle system no matter current time.
     */
    public pause (): void {
        this._audioSource.pause();
    }

    /**
     * Stops the particle system.
     */
    public stop (): void {
        this._audioSource.stop();
    }

    /**
     * Sets the speed of the particle system.
     * @param speed The speed.
     */
    public setSpeed (speed: number): void {
        this._audioSource.speed = speed;
    }

    private _audioSource: AudioSource;
    private _audioClip: AudioClip | null;
}
