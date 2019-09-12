/**
 * @hidden
 */

import { Vec3 } from '../core/math';
import { BoxShapeBase, ICreateBodyOptions, PhysicsWorldBase, RigidBodyBase, SphereShapeBase } from './api';
import { BoxShape, PhysicsWorld, RigidBody, SphereShape } from './impl-selector';
import { RaycastResult } from './raycast-result';

export function createPhysicsWorld (): PhysicsWorldBase {
    return new PhysicsWorld() as PhysicsWorldBase;
}

export function createRigidBody (options?: ICreateBodyOptions): RigidBodyBase {
    return new RigidBody(options) as RigidBodyBase;
}

export function createBoxShape (size: Vec3): BoxShapeBase {
    // @ts-ignore
    return new BoxShape(size);
}

export function createSphereShape (radius: number): SphereShapeBase {
    // @ts-ignore
    return new SphereShape(radius);
}

export function createRaycastResult (): RaycastResult {
    return new RaycastResult();
}

cc.createRaycastResult = createRaycastResult;
