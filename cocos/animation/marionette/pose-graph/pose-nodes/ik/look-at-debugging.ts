import { Color, Vec3 } from '../../../../../core';
import { AABB } from '../../../../../core/geometry';
import { legacyCC } from '../../../../../core/global-exports';
import type { Director } from '../../../../../game';
import type { GeometryRenderer } from '../../../../../rendering/geometry-renderer';
import { Transform } from '../../../../core/transform';
import { AnimationGraphEvaluationContext } from '../../../animation-graph-context';
import type { PoseNodeLookAt } from './look-at';

const getOrCreateGeometryRenderer = (): GeometryRenderer | undefined => {
    const camera = (legacyCC.director as Director).getScene()?.renderScene?.cameras[0];
    if (!camera) {
        return undefined;
    }
    camera.initGeometryRenderer();
    return camera.geometryRenderer ?? undefined;
};

const cacheWorldTransform = new Transform();
const cacheTargetWorld = new Transform();
const cacheRightAxis = new Vec3();
const cacheAABB = new AABB();
const cacheLineTo = new Vec3();

class LookAtDebugger {
    public drawInputs (
        context: AnimationGraphEvaluationContext,
        transform: Transform,
        targetPosition: Readonly<Vec3>,
        forwardAxis: Readonly<Vec3>,
        upAxis: Readonly<Vec3>,
    ): void {
        const geometryRenderer = getOrCreateGeometryRenderer();
        if (!geometryRenderer) {
            return;
        }
        const componentToWorld = context.componentToWorldTransform;
        const worldTransform = Transform.multiply(cacheWorldTransform, componentToWorld, transform);
        const targetWorld = Transform.setIdentity(cacheTargetWorld);
        targetWorld.position = targetPosition;
        Transform.multiply(targetWorld, componentToWorld, targetWorld);

        this._drawBonePosition(geometryRenderer, worldTransform.position);
        this._drawBonePosition(geometryRenderer, targetWorld.position);
        this._drawAxis(geometryRenderer, worldTransform.position, forwardAxis, 0.1, Color.BLUE);
        this._drawAxis(geometryRenderer, worldTransform.position, upAxis, 0.1, Color.GREEN);
        const rightAxis = Vec3.cross(cacheRightAxis, upAxis, forwardAxis);
        Vec3.normalize(rightAxis, rightAxis);
        this._drawAxis(geometryRenderer, worldTransform.position, rightAxis, 0.1, Color.RED);
        geometryRenderer.addDashedLine(
            worldTransform.position,
            targetWorld.position,
            Color.WHITE,
            false,
        );
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public drawResult (transform: Transform): void {
    }

    private _drawBonePosition (
        geometryRenderer: GeometryRenderer,
        position: Readonly<Vec3>,
    ): void {
        const halfExtent = 0.01;
        geometryRenderer.addBoundingBox(
            AABB.set(
                cacheAABB,
                position.x,
                position.y,
                position.z,
                halfExtent,
                halfExtent,
                halfExtent,
            ),
            Color.WHITE,
            true,
            false,
        );
    }

    private _drawAxis (
        geometryRenderer: GeometryRenderer,
        position: Readonly<Vec3>,
        dir: Readonly<Vec3>,
        scale: number,
        color: Color,
    ): void {
        Vec3.scaleAndAdd(cacheLineTo, position, dir, scale);
        geometryRenderer.addLine(
            position,
            Vec3.scaleAndAdd(cacheLineTo, position, dir, scale),
            color,
            false,
        );
    }
}

// // eslint-disable-next-line @typescript-eslint/ban-types
// const debuggerMap = new WeakMap<PoseNodeLookAt, LookAtDebugger>();

// export function createDebugger (poseNode: PoseNodeLookAt) {
//     debuggerMap.set(poseNode, new LookAtDebugger());
// }

const globalDebugger = new LookAtDebugger();

export function getDebugger (_poseNode: PoseNodeLookAt): LookAtDebugger | undefined {
    return globalDebugger;
}
