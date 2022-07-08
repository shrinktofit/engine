import { Quat, Vec3 } from '../../math';

export type BoneHandle = number;

export interface MotionFunctionInstantiateContext {
    bindBone(bonePath: string): BoneHandle | undefined;
}

export class Pose {
    public getBoneWorldPosition (out: Vec3, handle: BoneHandle): Vec3 {
        return out;
    }

    public getBoneWorldRotation (out: Quat, handle: BoneHandle): Quat {
        return out;
    }

    public getBoneLocalPosition (out: Vec3, handle: BoneHandle): Vec3 {
        return out;
    }

    public getBoneLocalRotation (out: Vec3, handle: BoneHandle): Vec3 {
        return out;
    }
}

export abstract class MotionFunction {
    public abstract instantiate (context: MotionFunctionInstantiateContext): MotionFunctionInstance;
}

export abstract class MotionFunctionInstance {
    public abstract invoke(inputs: Pose[]): Pose;
}
