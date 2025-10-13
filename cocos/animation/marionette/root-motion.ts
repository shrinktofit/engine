import { Quat, Vec3 } from '../../core';
import { Node } from '../../scene-graph';
import { Transform } from '../core/transform';

export function applyRootMotion (rootMotion: Transform, target: Node): void {
    const rootMotionTransform = rootMotion;
    target.scale = Vec3.multiply(vec3Cache1, rootMotionTransform.scale, target.scale);
    // Note the order here: root motion rotation defined in local space(before current rotation)
    target.rotation = Quat.multiply(quatCache1, target.rotation, rootMotionTransform.rotation);
    target.position = Vec3.add(vec3Cache2, rootMotionTransform.position, target.position);
}

const vec3Cache1 = new Vec3();
const vec3Cache2 = new Vec3();
const quatCache1 = new Quat();
