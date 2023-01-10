import { Quat, Vec3 } from '../../../core';
import { ccclass, editable, serializable } from '../../../core/data/decorators';
import { CLASS_NAME_PREFIX_X_NODES } from './builtin/prefix';
import { XNode } from './x-node';

@ccclass(`${CLASS_NAME_PREFIX_X_NODES}XNodeConstant`)
export abstract class XNodeConstant<T> extends XNode<T> {

}

@ccclass(`${CLASS_NAME_PREFIX_X_NODES}XNodeConstantNumber`)
export class XNodeConstantNumber extends XNodeConstant<number> {
    constructor (value = 0.0) {
        super();
        this.value = value;
    }

    @serializable
    @editable
    public value = 0.0;

    public evaluate (): number {
        return this.value;
    }
}

@ccclass(`${CLASS_NAME_PREFIX_X_NODES}XNodeConstantVec3`)
export class XNodeConstantVec3 extends XNodeConstant<Vec3> {
    constructor (value = Vec3.ZERO) {
        super();
        Vec3.copy(this.value, value);
    }

    @serializable
    @editable
    public readonly value = new Vec3();

    public evaluate (): Readonly<Vec3> {
        return this.value;
    }
}

@ccclass(`${CLASS_NAME_PREFIX_X_NODES}XNodeConstantQuat`)
export class XNodeConstantQuat extends XNodeConstant<Quat> {
    constructor (value = Quat.IDENTITY) {
        super();
        Quat.copy(this.value, value);
    }

    @serializable
    @editable
    public readonly value = new Quat();

    public evaluate (): Readonly<Quat> {
        return this.value;
    }
}
