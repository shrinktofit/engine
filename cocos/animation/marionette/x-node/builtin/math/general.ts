import { clamp } from '../../../../../core';
import { ccclass, editable, serializable } from '../../../../../core/data/decorators';
import { XNodeConstantNumber } from '../../constant-node';
import { XNode } from '../../x-node';
import { xLink } from '../../x-node-link';
import { CLASS_NAME_PREFIX_X_NODE_MATH } from './prefix';

@ccclass(`${CLASS_NAME_PREFIX_X_NODE_MATH}XNodeMin`)
export class XNodeMin extends XNode<number> {
    @serializable
    @editable
    @xLink
    public value0 = new XNodeConstantNumber();

    @serializable
    @editable
    @xLink
    public value1 = new XNodeConstantNumber();

    public evaluate () {
        return Math.min(this.value0.evaluate(), this.value1.evaluate());
    }
}

@ccclass(`${CLASS_NAME_PREFIX_X_NODE_MATH}XNodeMax`)
export class XNodeMax extends XNode<number> {
    @serializable
    @editable
    @xLink
    public value0 = new XNodeConstantNumber();

    @serializable
    @editable
    @xLink
    public value1 = new XNodeConstantNumber();

    public evaluate () {
        return Math.max(this.value0.evaluate(), this.value1.evaluate());
    }
}

@ccclass(`${CLASS_NAME_PREFIX_X_NODE_MATH}XNodeClamp`)
export class XNodeClamp extends XNode<number> {
    @serializable
    @editable
    @xLink
    public input = new XNodeConstantNumber();

    @serializable
    @editable
    @xLink
    public min = new XNodeConstantNumber(0);

    @serializable
    @editable
    @xLink
    public max = new XNodeConstantNumber(1);

    public evaluate () {
        return clamp(
            this.input.evaluate(),
            this.min.evaluate(),
            this.max.evaluate(),
        );
    }
}
