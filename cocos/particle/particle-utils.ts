/**
 * @hidden
 */

import { ParticleSystemComponent } from './particle-system-component';
import { CCObject } from '../core/data/object';
import { Node } from '../core/scene-graph';
import { Pool } from '../core/memop';
import { Director, director } from '../core/director';
import { instantiate } from '../core/data';

export class ParticleUtils {
    private static particleSystemPool: Map<string, Pool<CCObject>> = new Map<string, Pool<CCObject>>();
    private static registeredSceneEvent: boolean = false;

    /**
     * instantiate
     */
    public static instantiate (prefab) {
        if (!this.registeredSceneEvent) {
            director.on(Director.EVENT_BEFORE_SCENE_LAUNCH, this.onSceneUnload, this);
            this.registeredSceneEvent = true;
        }
        if (!this.particleSystemPool.has(prefab._uuid)) {
            this.particleSystemPool.set(prefab._uuid, new Pool<CCObject>(() => {
                return instantiate(prefab);
            }, 1));
        }
        return this.particleSystemPool.get(prefab._uuid)!.alloc();
    }

    public static destroy (prefab) {
        if (this.particleSystemPool.has(prefab._prefab.asset._uuid)) {
            this.stop(prefab);
            this.particleSystemPool.get(prefab._prefab.asset._uuid)!.free(prefab);
        }
    }

    private static onSceneUnload () {
        this.particleSystemPool.forEach((value) => {
            value.clear((prefab) => {
                prefab.destroy();
            });
        });
        this.particleSystemPool.clear();
    }

    public static play (rootNode: Node) {
        for (const ps of rootNode.getComponentsInChildren(ParticleSystemComponent)) {
            (ps as ParticleSystemComponent).play();
        }
    }

    public static stop (rootNode: Node) {
        for (const ps of rootNode.getComponentsInChildren(ParticleSystemComponent)) {
            (ps as ParticleSystemComponent).stop();
        }
    }
}
