import { ccclass, editable, serializable } from '../../../../../../core/data/decorators';
import { poseGraphNodeHide, poseGraphNodeAppearance } from '../../../decorator/node';
import { PoseGraphType } from '../../../foundation/type-system';
import { SingleOutputPVNode } from '../../../pure-value-node';
import { input } from '../../../decorator/input';
import { CLASS_NAME_PREFIX_ANIM } from '../../../../../define';

@ccclass(`${CLASS_NAME_PREFIX_ANIM}PVNodeUnaryNumericBase`)
@poseGraphNodeHide()
@poseGraphNodeAppearance({ themeColor: '#B169C4' })
export abstract class PVNodeUnaryNumericBase extends SingleOutputPVNode<number> {
    constructor () {
        super(PoseGraphType.FLOAT);
    }

    @serializable
    @editable
    @input({ type: PoseGraphType.FLOAT })
    public operand = 0.0;

    public selfEvaluateDefaultOutput () {
        return this.evaluateValue(this.operand);
    }

    protected abstract evaluateValue(value: number): number;
}
