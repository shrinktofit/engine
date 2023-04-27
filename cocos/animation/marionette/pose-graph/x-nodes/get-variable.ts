import { EDITOR } from 'internal:constants';
import { editable, Quat, serializable, Vec3 } from '../../../../core';
import { ccclass } from '../../../../core/data/class-decorator';
import { VariableType, VarInstance } from '../../variable';
import { CLASS_NAME_PREFIX_X_NODES } from './builtin/prefix';
import { SingleOutputXNode, XNodeLinkContext } from '../x-node';
import {
    PoseGraphCreateNodeEntry, PoseGraphCreateNodeFactory, poseGraphCreateNodeFactory, poseGraphNodeHide,
} from '../decorator/node';
import { PoseGraphType } from '../foundation/type-system';

interface CreateNodeArg {
    name: string;
    type: Exclude<PoseGraphType, PoseGraphType.POSE>;
}

const createNodeFactory: PoseGraphCreateNodeFactory<CreateNodeArg> = {
    // eslint-disable-next-line arrow-body-style
    listEntries: (context) => {
        // eslint-disable-next-line arrow-body-style
        const entries: PoseGraphCreateNodeEntry<CreateNodeArg>[] = [];
        for (const [variableName, { type }] of context.animationGraph.variables) {
            if (type === VariableType.TRIGGER) {
                continue;
            }
            let poseGraphType: CreateNodeArg['type'] | undefined;
            switch (type) {
            default:
                break;
            case VariableType.FLOAT:
                poseGraphType = PoseGraphType.FLOAT;
                break;
            case VariableType.INTEGER:
                poseGraphType = PoseGraphType.INTEGER;
                break;
            case VariableType.BOOLEAN:
                poseGraphType = PoseGraphType.BOOLEAN;
                break;
            case VariableType.VEC3_experimental:
                poseGraphType = PoseGraphType.VEC3;
                break;
            }
            if (typeof poseGraphType === 'undefined') {
                continue;
            }
            entries.push({
                arg: { name: variableName, type: poseGraphType  },
                menu: `获取变量/${variableName}`,
            });
        }
        return entries;
    },

    create: (arg) => {
        let node: XNodeGetVariableFloat | XNodeGetVariableInteger | XNodeGetVariableBoolean | XNodeGetVariableVec3 | XNodeGetVariableQuat;
        switch (arg.type) {
        default:
            throw new Error(`Bad create node arg: ${PoseGraphType[arg.type]}`);
        case PoseGraphType.FLOAT:
            node = new XNodeGetVariableFloat();
            break;
        case PoseGraphType.INTEGER:
            node = new XNodeGetVariableInteger();
            break;
        case PoseGraphType.BOOLEAN:
            node = new XNodeGetVariableBoolean();
            break;
        case PoseGraphType.VEC3:
            node = new XNodeGetVariableVec3();
            break;
        case PoseGraphType.QUAT:
            node = new XNodeGetVariableQuat();
            break;
        }
        node.variableName = arg.name;
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

@ccclass(`${CLASS_NAME_PREFIX_X_NODES}XNodeGetVariableFloat`)
@poseGraphNodeHide()
export class XNodeGetVariableFloat extends XNodeGetVariable<number> {
    constructor () {
        super(PoseGraphType.FLOAT);
    }

    public selfEvaluateDefaultOutput (): number {
        return this._varInstance?.value as number; // TODO
    }
}

@ccclass(`${CLASS_NAME_PREFIX_X_NODES}XNodeGetVariableInteger`)
@poseGraphNodeHide()
export class XNodeGetVariableInteger extends XNodeGetVariable<number> {
    constructor () {
        super(PoseGraphType.INTEGER);
    }

    public selfEvaluateDefaultOutput (): number {
        return this._varInstance?.value as number; // TODO
    }
}

@ccclass(`${CLASS_NAME_PREFIX_X_NODES}XNodeGetVariableBoolean`)
@poseGraphNodeHide()
export class XNodeGetVariableBoolean extends XNodeGetVariable<boolean> {
    constructor () {
        super(PoseGraphType.BOOLEAN);
    }

    public selfEvaluateDefaultOutput (): boolean {
        return this._varInstance?.value as boolean; // TODO
    }
}

@ccclass(`${CLASS_NAME_PREFIX_X_NODES}XNodeGetVariableVec3`)
@poseGraphNodeHide()
export class XNodeGetVariableVec3 extends XNodeGetVariable<Readonly<Vec3>> {
    constructor () {
        super(PoseGraphType.VEC3);
    }

    public selfEvaluateDefaultOutput (): Readonly<Vec3> {
        return this._varInstance?.value as unknown as Readonly<Vec3>; // TODO
    }
}

@ccclass(`${CLASS_NAME_PREFIX_X_NODES}XNodeGetVariableQuat`)
@poseGraphNodeHide()
export class XNodeGetVariableQuat extends XNodeGetVariable<Quat> {
    constructor () {
        super(PoseGraphType.QUAT);
    }

    public selfEvaluateDefaultOutput (): Readonly<Quat> {
        return this._varInstance?.value as unknown as Quat; // TODO
    }
}
