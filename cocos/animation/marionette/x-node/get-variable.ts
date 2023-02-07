import { EDITOR } from 'internal:constants';
import { editable, Quat, serializable, Vec3 } from '../../../core';
import { ccclass } from '../../../core/data/class-decorator';
import { VarInstance } from '../variable';
import { CLASS_NAME_PREFIX_X_NODES } from './builtin/prefix';
import { SingleOutputXNode, XNodeLinkContext } from './x-node';

export abstract class XNodeGetVariable<T> extends SingleOutputXNode<T> {
    @editable
    @serializable
    public variableName = '';

    link (context: XNodeLinkContext) {
        this._varInstance = context.getVar(this.variableName);
    }

    protected _varInstance: VarInstance | undefined = undefined;
}

if (EDITOR) {
    XNodeGetVariable.prototype.getTitle = function getTitle (this: XNodeGetVariable<any>) {
        return `获取变量 ${this.variableName}`;
    };
}

@ccclass(`${CLASS_NAME_PREFIX_X_NODES}XNodeGetVariableNumber`)
export class XNodeGetVariableNumber extends XNodeGetVariable<number> {
    public selfEvaluateDefaultOutput (): number {
        return this._varInstance?.value as number; // TODO
    }
}

@ccclass(`${CLASS_NAME_PREFIX_X_NODES}XNodeGetVariableBoolean`)
export class XNodeGetVariableBoolean extends XNodeGetVariable<boolean> {
    public selfEvaluateDefaultOutput (): boolean {
        return this._varInstance?.value as boolean; // TODO
    }
}

@ccclass(`${CLASS_NAME_PREFIX_X_NODES}XNodeGetVariableVec3`)
export class XNodeGetVariableVec3 extends XNodeGetVariable<Vec3> {
    public selfEvaluateDefaultOutput (): Readonly<Vec3> {
        return this._varInstance?.value as unknown as Vec3; // TODO
    }
}

@ccclass(`${CLASS_NAME_PREFIX_X_NODES}XNodeGetVariableQuat`)
export class XNodeGetVariableQuat extends XNodeGetVariable<Quat> {
    @editable
    @serializable
    public variableName = '';

    public selfEvaluateDefaultOutput (): Readonly<Quat> {
        return this._varInstance?.value as unknown as Quat; // TODO
    }
}
