import { assertIsTrue, EditorExtendable, js, warn } from '../../../core';
import { ccclass, serializable } from '../../../core/data/decorators';
import { CLASS_NAME_PREFIX_ANIM } from '../../define';
import { PoseNode } from './pose-node';
import { PoseGraphNode } from './node';
import { PoseGraphNodeShell } from './node-shell';
import { shellTag } from './pose-graph-node-base';

@ccclass(`${CLASS_NAME_PREFIX_ANIM}PoseGraph`)
export class PoseGraph extends EditorExtendable {
    public get main () {
        return this._main;
    }

    public set main (value) {
        if (value) {
            if (!this._shells.includes(value)) {
                warn(`Specified node is not within container.`);
                return;
            }
            if (!(value.node instanceof PoseNode)) {
                warn(`The main node must be pose node.`);
                return;
            }
        }
        this._main = value;
    }

    /**
     * // TODO: HACK
     * @internal
     */
    public __callOnAfterDeserializeRecursive () {
        for (const shell of this._shells) {
            shell.__callOnAfterDeserializeRecursive();
        }
    }

    public shells () {
        return this._shells.values();
    }

    public addNode<TNode extends PoseGraphNode> (node: TNode) {
        assertIsTrue(!node[shellTag], `The node has been added into else graph.`);
        const shell = new PoseGraphNodeShell(node);
        this._shells.push(shell);
        node[shellTag] = shell;
        return shell;
    }

    public removeNode<TNode extends PoseGraphNode> (removal: PoseGraphNodeShell<TNode>) {
        // Disconnect from others.
        for (const shell of this._shells) {
            shell._deleteBindingTo(removal);
        }

        // Disconnect from output.
        if (removal === this._main) {
            this._main = null;
        }

        // Remove from graph.
        js.array.remove(this._shells, removal);
    }

    @serializable
    private _main: PoseGraphNodeShell<PoseNode> | null = null;

    @serializable
    private _shells: PoseGraphNodeShell<PoseGraphNode>[] = [];
}
