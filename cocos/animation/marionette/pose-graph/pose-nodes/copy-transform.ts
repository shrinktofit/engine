import { EDITOR } from 'internal:constants';
import { ccclass, editable, serializable, type } from '../../../../core/data/decorators';
import { CLASS_NAME_PREFIX_ANIM } from '../../../define';
import { PoseNodeBindingContext, PoseTransformSpaceRequirement } from '../pose-node';
import { ccenum } from '../../../../core';
import { TransformHandle } from '../../../core/animation-handle';
import { poseGraphNodeMenu } from '../pose-graph-node-common';
import { POSE_GRAPH_NODE_MENU_PREFIX_POSE } from './menu-common';
import { Pose, PoseTransformSpace } from '../../../core/pose';
import { AnySpaceSinglePoseModifier, SinglePoseModifier } from './single-pose-modifier';
import { AnimationGraphEvaluationContext } from '../../animation-graph-context';
import { Transform } from '../../../core/transform';

enum SetAuxiliaryCurveFlag {
    LEAVE_UNCHANGED,

    REPLACE,

    ADD,
}

ccenum(SetAuxiliaryCurveFlag);

const cacheTransform = new Transform();

@ccclass(`${CLASS_NAME_PREFIX_ANIM}CopyTransform`)
@poseGraphNodeMenu(`${POSE_GRAPH_NODE_MENU_PREFIX_POSE}拷贝变换`)
export class CopyTransform extends SinglePoseModifier {
    @serializable
    @editable
    public sourceTransformName = '';

    @serializable
    @editable
    public targetTransformName = '';

    @serializable
    @editable
    @type(PoseTransformSpaceRequirement)
    public transformSpaceRequirement: PoseTransformSpaceRequirement = PoseTransformSpaceRequirement.SKELETAL;

    public bind (context: PoseNodeBindingContext): void {
        super.bind(context);
        const sourceTransformHandle = context.outerContext.bindTransformByName(this.sourceTransformName);
        const targetTransformHandle = context.outerContext.bindTransformByName(this.targetTransformName);
        if (!sourceTransformHandle || !targetTransformHandle) {
            sourceTransformHandle?.destroy();
            targetTransformHandle?.destroy();
            return;
        }
        this._workspace = new Workspace(
            sourceTransformHandle,
            targetTransformHandle,
        );
    }

    protected modifyPose (context: AnimationGraphEvaluationContext, inputPose: Pose) {
        const {
            _workspace: workspace,
        } = this;
        if (!workspace) {
            return;
        }
        const {
            hSource: { index: sourceTransformIndex },
            hTarget: { index: targetTransformIndex },
        } = workspace;
        const transform = inputPose.transforms.getTransform(sourceTransformIndex, cacheTransform);
        inputPose.transforms.setTransform(targetTransformIndex, transform);
    }

    protected getPoseTransformSpaceRequirement () {
        return this.transformSpaceRequirement;
    }

    private _workspace: Workspace | undefined = undefined;
}

class Workspace {
    constructor (
        public hSource: TransformHandle,
        public hTarget: TransformHandle,
    ) {
    }
}

if (EDITOR) {
    CopyTransform.prototype.getTitle = function getTitle (this: CopyTransform) {
        return `拷贝 ${this.sourceTransformName} 的变换至 ${this.targetTransformName}`;
    };
}
