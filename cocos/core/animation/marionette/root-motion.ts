import { Node } from '../../scene-graph/node';
import { Quat } from '../../math/quat';
import { Vec3 } from '../../math/vec3';

export class RootMotionOutput {
    position: Vec3 = Vec3.clone(Vec3.ZERO);
    scale: Vec3 = Vec3.clone(Vec3.ONE);
    rotation: Quat = Quat.clone(Quat.IDENTITY);
}

export function resetRootMotionOutput (output: RootMotionOutput) {
    Vec3.copy(output.position, Vec3.ZERO);
    Quat.copy(output.rotation, Quat.IDENTITY);
    Vec3.copy(output.scale, Vec3.ONE);
}

export function applyRootMotionOutput (target: Node, rootMotionOutput: RootMotionOutput) {
    // const rotation = Quat.multiply(new Quat(), target.rotation, rootMotionOutput.rotation);
    // target.setRotation(rotation);

    // TODO: Don't consider scaling part
    // Vec3.multiply(scaleMotion, scaleMotion, rootBone.scale);
    // rootBone.setScale(scaleMotion);

    const position = Vec3.transformQuat(new Vec3(), rootMotionOutput.position, target.rotation);
    Vec3.add(position, position, target.position);
    target.setPosition(position);
}
