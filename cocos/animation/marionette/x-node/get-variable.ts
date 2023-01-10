import { editable, Quat, serializable, Vec3 } from '../../../core';
import { ccclass } from '../../../core/data/class-decorator';
import { VarInstance } from '../variable';
import { CLASS_NAME_PREFIX_X_NODES } from './builtin/prefix';
import { XNode, XNodeLinkContext } from './x-node';

export abstract class XNodeGetVariable<T> extends XNode<T> {
    @editable
    @serializable
    public variableName = '';

    link (context: XNodeLinkContext) {
        this._varInstance = context.getVar(this.variableName);
    }

    protected _varInstance: VarInstance | undefined = undefined;
}

@ccclass(`${CLASS_NAME_PREFIX_X_NODES}XNodeGetVariableNumber`)
export class XNodeGetVariableNumber extends XNodeGetVariable<number> {
    public evaluate (): number {
        return this._varInstance?.value as number; // TODO
    }
}

@ccclass(`${CLASS_NAME_PREFIX_X_NODES}XNodeGetVariableBoolean`)
export class XNodeGetVariableBoolean extends XNodeGetVariable<boolean> {
    public evaluate (): boolean {
        return this._varInstance?.value as boolean; // TODO
    }
}

@ccclass(`${CLASS_NAME_PREFIX_X_NODES}XNodeGetVariableVec3`)
export class XNodeGetVariableVec3 extends XNodeGetVariable<Vec3> {
    public evaluate (): Readonly<Vec3> {
        return this._varInstance?.value as unknown as Vec3; // TODO
    }
}

@ccclass(`${CLASS_NAME_PREFIX_X_NODES}XNodeGetVariableQuat`)
export class XNodeGetVariableQuat extends XNodeGetVariable<Quat> {
    @editable
    @serializable
    public variableName = '';

    public evaluate (): Readonly<Quat> {
        return this._varInstance?.value as unknown as Quat; // TODO
    }
}
