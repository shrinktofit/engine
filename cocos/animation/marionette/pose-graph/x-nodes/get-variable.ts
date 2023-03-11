import { EDITOR } from 'internal:constants';
import { editable, Quat, serializable, Vec3 } from '../../../../core';
import { ccclass } from '../../../../core/data/class-decorator';
import { VariableType, VarInstance } from '../../variable';
import { CLASS_NAME_PREFIX_X_NODES } from './builtin/prefix';
import { SingleOutputXNode, XNodeLinkContext } from '../x-node';
import {
    PoseGraphCreateNodeEntry, PoseGraphCreateNodeFactory, poseGraphCreateNodeFactory, poseGraphNodeHide,
} from '../pose-graph-node-common';

const createNodeFactory: PoseGraphCreateNodeFactory<string> = {
    // eslint-disable-next-line arrow-body-style
    listEntries: (context) => {
        // eslint-disable-next-line arrow-body-style
        const entries: PoseGraphCreateNodeEntry<string>[] = [];
        for (const [variableName, { type }] of context.animationGraph.variables) {
            if (type === VariableType.TRIGGER) {
                continue;
            }
            entries.push({
                arg: variableName,
                menu: `获取变量/${variableName}`,
            });
        }
        return entries;
    },

    create: (arg) => {
        const node = new XNodeGetVariableNumber();
        node.variableName = arg;
        return node;
    },
};

@ccclass(`${CLASS_NAME_PREFIX_X_NODES}XNodeGetVariable`)
@poseGraphCreateNodeFactory(createNodeFactory)
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
@poseGraphNodeHide()
export class XNodeGetVariableNumber extends XNodeGetVariable<number> {
    public selfEvaluateDefaultOutput (): number {
        return this._varInstance?.value as number; // TODO
    }
}

@ccclass(`${CLASS_NAME_PREFIX_X_NODES}XNodeGetVariableBoolean`)
@poseGraphNodeHide()
export class XNodeGetVariableBoolean extends XNodeGetVariable<boolean> {
    public selfEvaluateDefaultOutput (): boolean {
        return this._varInstance?.value as boolean; // TODO
    }
}

@ccclass(`${CLASS_NAME_PREFIX_X_NODES}XNodeGetVariableVec3`)
@poseGraphNodeHide()
export class XNodeGetVariableVec3 extends XNodeGetVariable<Vec3> {
    public selfEvaluateDefaultOutput (): Readonly<Vec3> {
        return this._varInstance?.value as unknown as Vec3; // TODO
    }
}

@ccclass(`${CLASS_NAME_PREFIX_X_NODES}XNodeGetVariableQuat`)
@poseGraphNodeHide()
export class XNodeGetVariableQuat extends XNodeGetVariable<Quat> {
    @editable
    @serializable
    public variableName = '';

    public selfEvaluateDefaultOutput (): Readonly<Quat> {
        return this._varInstance?.value as unknown as Quat; // TODO
    }
}
