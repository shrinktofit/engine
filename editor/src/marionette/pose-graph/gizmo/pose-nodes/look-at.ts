
import { PoseNodeLookAt } from '../../../../../../cocos/animation/marionette/pose-graph/pose-nodes/ik/look-at';
import { AABB } from '../../../../../../cocos/core/geometry';
import { Color, Mat4 } from '../../../../../../exports/base';
import { PoseGraphNodeGizmo, PoseGraphNodeGizmoContext, registerPoseGraphNodeGizmo } from '../common';

class PoseNodeLookAtGizmo extends PoseGraphNodeGizmo<PoseNodeLookAt> {
    protected onDraw(context: PoseGraphNodeGizmoContext) {
        const boneNode = context.findNodeByName(this.target.boneName);
        if (!boneNode) {
            return;
        }
        context.geometryRenderer.addBoundingBox(
            new AABB(boneNode.worldPosition.x, boneNode.worldPosition.y, boneNode.worldPosition.z),
            Color.WHITE,
            true,
            undefined,
            undefined,
            true,
            Mat4.fromQuat(new Mat4(), boneNode.worldRotation),
        );
    }
}

registerPoseGraphNodeGizmo(PoseNodeLookAt, PoseNodeLookAtGizmo);
