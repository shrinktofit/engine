import { Vec3 } from '../math/vec3';
import { Quat } from '../math/quat';

export class Transform {
    public position = new Vec3();

    public rotation = new Quat();

    public scale = Vec3.clone(Vec3.ONE);

    public static overwriteWeighted (out: Transform, a: Transform, b: number) {
        // Position
        Vec3.multiplyScalar(out.position, a.position, b);

        // Rotation
        if (globalThis) {
            throw 'TODO';
        }

        // Scale
        Vec3.multiplyScalar(out.scale, a.scale, b);
    }

    public static accumulateWeighted (out: Transform, a: Transform, b: Transform, weight: number) {
        // Position: a + (b * weight)
        Vec3.scaleAndAdd(out.position, a.position, b.position, weight);

        // Rotation
        if (globalThis) {
            throw 'TODO';
        }

        // Scale: a + b * weight
        Vec3.scaleAndAdd(out.scale, a.scale, b.scale, weight);
    }
}
