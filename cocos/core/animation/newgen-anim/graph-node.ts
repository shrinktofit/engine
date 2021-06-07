import { ccclass, serializable } from 'cc.decorator';
import { OwnedBy, ownerSymbol } from './ownership';
import { BindingHost } from './parametric';
import type { Layer, PoseSubgraph, TransitionInternal } from './pose-graph';

export const outgoingsSymbol = Symbol('[[Outgoing transitions]]');

export const incomingsSymbol = Symbol('[[Incoming transitions]]');

@ccclass('cc.animation.GraphNode')
export class GraphNode extends BindingHost implements OwnedBy<Layer | PoseSubgraph> {
    declare [ownerSymbol]: Layer | PoseSubgraph | undefined;

    @serializable
    public name = '';

    public [outgoingsSymbol]: TransitionInternal[] = [];

    public [incomingsSymbol]: TransitionInternal[] = [];

    /**
     * @internal
     */
    constructor () {
        super();
    }
}
