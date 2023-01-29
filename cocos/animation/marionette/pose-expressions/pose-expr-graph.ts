import { EditorExtendable, js, warn } from '../../../core';
import { ccclass, serializable } from '../../../core/data/decorators';
import { CLASS_NAME_PREFIX_ANIM } from '../../define';
import { XNode } from '../x-node/x-node';
import { resetXLinksTo } from '../x-node/x-node-link';
import { getPoseInputField, getPoseInputFieldKeys, setPoseInputField } from './decorator';
import { PoseExpr } from './pose-expr';

@ccclass(`${CLASS_NAME_PREFIX_ANIM}PoseExprGraph`)
export class PoseExprGraph extends EditorExtendable {
    public get main () {
        return this._main;
    }

    public set main (value) {
        if (value && !this._exprs.includes(value)) {
            warn(`Specified pose expr is not within container.`);
            return;
        }
        this._main = value;
    }

    public exprs () {
        return this._exprs.values();
    }

    public addExpr (poseExpr: PoseExpr) {
        this._exprs.push(poseExpr);
    }

    public removeExpr (poseExpr: PoseExpr) {
        // Disconnect from others.
        for (const expr of this._exprs) {
            for (const inputKey of getPoseInputFieldKeys(expr)) {
                if (getPoseInputField(expr, inputKey) === expr) {
                    setPoseInputField(expr, inputKey, null);
                }
            }
        }

        // Disconnect from output.
        if (poseExpr === this._main) {
            this._main = null;
        }

        // Remove from graph.
        js.array.remove(this._exprs, poseExpr);
    }

    public xNodes () {
        return this._xNodes.values();
    }

    public addXNode (xNode: XNode<any>) {
        this._xNodes.push(xNode);
    }

    public removeXNode (xNode: XNode<any>) {
        for (const source of this._xNodes) {
            resetXLinksTo(source, xNode);
        }

        for (const source of this._exprs) {
            resetXLinksTo(source, xNode);
        }

        js.array.remove(this._xNodes, xNode);
    }

    @serializable
    private _xNodes: XNode<any>[] = [];

    @serializable
    private _exprs: PoseExpr[] = [];

    @serializable
    private _main: PoseExpr | null = null;
}
