import { clamp } from '../../../../../core';
import { ccclass, editable, serializable } from '../../../../../core/data/decorators';
import { SingleOutputXNode } from '../../x-node';
import { xLink } from '../../x-node-binding';
import { CLASS_NAME_PREFIX_X_NODE_MATH } from './prefix';

@ccclass(`${CLASS_NAME_PREFIX_X_NODE_MATH}XNodeMin`)
export class XNodeMin extends SingleOutputXNode<number> {
    @serializable
    @editable
    @xLink()
    public value0 = 0.0;

    @serializable
    @editable
    @xLink()
    public value1 = 0.0;

    public selfEvaluateDefaultOutput () {
        return Math.min(this.value0, this.value1);
    }
}

@ccclass(`${CLASS_NAME_PREFIX_X_NODE_MATH}XNodeMax`)
export class XNodeMax extends SingleOutputXNode<number> {
    @serializable
    @editable
    @xLink()
    public value0 = 0.0;

    @serializable
    @editable
    @xLink()
    public value1 = 0.0;

    public selfEvaluateDefaultOutput () {
        return Math.max(this.value0, this.value1);
    }
}

@ccclass(`${CLASS_NAME_PREFIX_X_NODE_MATH}XNodeClamp`)
export class XNodeClamp extends SingleOutputXNode<number> {
    @serializable
    @editable
    @xLink()
    public input = 0.0;

    @serializable
    @editable
    @xLink()
    public min = 0.0;

    @serializable
    @editable
    @xLink()
    public max = 0.0;

    public selfEvaluateDefaultOutput () {
        return clamp(
            this.input,
            this.min,
            this.max,
        );
    }
}
