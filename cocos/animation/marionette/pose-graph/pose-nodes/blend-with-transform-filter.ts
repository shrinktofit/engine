import { ccclass, editable, serializable, type } from '../../../../core/data/decorators';
import { blendPoseInto, Pose, TransformFilter } from '../../../core/pose';
import { CLASS_NAME_PREFIX_ANIM } from '../../../define';
import { AnimationGraphSettleContext } from '../../animation-graph-context';
import { poseGraphNodeMenu } from '../pose-graph-node-common';
import { POSE_GRAPH_NODE_MENU_PREFIX_POSE_BLEND } from './menu-common';
import { AnimationMask } from '../../animation-mask';
import { BlendTwoPoseBase } from './blend-two-pose-base';

@ccclass(`${CLASS_NAME_PREFIX_ANIM}BlendWithTransformFilter`)
@poseGraphNodeMenu(`${POSE_GRAPH_NODE_MENU_PREFIX_POSE_BLEND}带变换过滤器的混合`)
export class BlendWithTransformFilter extends BlendTwoPoseBase {
    @serializable
    @editable
    @type(AnimationMask)
    mask: AnimationMask | null = null;

    public settle (context: AnimationGraphSettleContext): void {
        super.settle(context);
        if (this.mask) {
            const transformFilter = context.createTransformFilter(this.mask);
            this._transformFilter = transformFilter;
        }
    }

    protected doBlend (pose0: Pose, pose1: Pose, ratio: number): void {
        blendPoseInto(pose0, pose1, ratio, this._transformFilter);
    }

    private _transformFilter: TransformFilter | undefined = undefined;
}
