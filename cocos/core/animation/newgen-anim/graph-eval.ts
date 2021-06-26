import { PoseGraph, Layer, PoseSubgraph, GraphNode, Transition } from './pose-graph';
import { assertIsTrue, assertIsNonNullable } from '../../data/utils/asserts';
import { PoseEval, PoseEvalContext } from './pose';
import type { Node } from '../../scene-graph/node';
import { createEval } from './create-eval';
import { Value } from './variable';
import { BindingHost, getPropertyBindingPoints } from './parametric';
import { ConditionEval } from './condition';
import { VariableNotDefinedError } from './errors';
import { PoseNode } from './pose-node';
import { SkeletonMask } from '../skeleton-mask';
import { debug } from '../../platform/debug';
import { BlendStateBuffer } from '../../../3d/skeletal-animation/skeletal-animation-blending';

const graphLog = true;

export class PoseGraphEval {
    private _varRefMap: Record<string, VarRefs> = {};
    private declare _layerEvaluations: LayerEval[];
    private _blendBuffer = new BlendStateBuffer();

    constructor (graph: PoseGraph, root: Node) {
        for (const [name, { value }] of graph.variables) {
            this._varRefMap[name] = {
                value,
                refs: [],
            };
        }

        const context: LayerContext = {
            blendBuffer: this._blendBuffer,
            node: root,
            bind: this._bind.bind(this),
            getParam: (host: BindingHost, name: string) => {
                const varId = host.getPropertyBinding(name);
                if (!varId) {
                    return undefined;
                }
                const varRefs = this._varRefMap[varId];
                if (!varRefs) {
                    throw new VariableNotDefinedError(varId);
                }
                return varRefs.value;
            },
        };

        this._layerEvaluations = Array.from(graph.layers).map((layer) => {
            const layerEval = new LayerEval(layer, {
                ...context,
                mask: layer.mask ?? undefined,
            });
            return layerEval;
        });
    }

    public update (deltaTime: number) {
        globalThis.xx = [];
        for (const layerEval of this._layerEvaluations) {
            layerEval.update(deltaTime);
        }
        // console.log(`Weights: [${globalThis.xx.map(([name, weight]) => `[${name}: ${weight}]`).join('  ')}]`);
        this._blendBuffer.apply();
    }

    public getValue (name: string) {
        const varRefs = this._varRefMap[name];
        if (!varRefs) {
            return undefined;
        } else {
            return varRefs.value;
        }
    }

    public setValue (name: string, value: Value) {
        const varRefs = this._varRefMap[name];
        if (!varRefs) {
            return;
        }

        varRefs.value = value;
        for (const { fn, args } of varRefs.refs) {
            fn(value, ...args);
        }
    }

    public getCurrentNodeInfo (layer: number) {
        assertIsTrue(layer >= 0 && layer < this._layerEvaluations.length, 'Layer out of bound');
        return this._layerEvaluations[layer].getCurrentNodeInfo();
    }

    private _bind<T, ExtraArgs extends any[]> (varId: string, fn: (value: T, ...args: ExtraArgs) => void, args: ExtraArgs): T {
        const varRefs = this._varRefMap[varId];
        if (!varRefs) {
            throw new VariableNotDefinedError(varId);
        }
        varRefs.refs.push({
            fn: fn as (value: unknown, ...args: unknown[]) => T,
            args,
        });
        return varRefs.value as unknown as T;
    }
}

interface LayerContext {
    node: Node;

    blendBuffer: BlendStateBuffer;

    mask?: SkeletonMask;

    getParam(host: BindingHost, name: string): unknown;

    bind<T, ExtraArgs extends any[]>(varId: string, fn: (value: T, ...args: ExtraArgs) => void, args: ExtraArgs): T;
}

class LayerEval {
    private declare _graphEval: SubgraphEval;

    constructor (layer: Layer, context: LayerContext) {
        this._graphEval = new SubgraphEval(layer.graph, {
            ...context,
        });
        this._graphEval.setWeight(layer.weight);
    }

    public update (deltaTime: number) {
        if (!this._graphEval.exited) {
            this._graphEval.update(deltaTime);
            this._graphEval.sample();
        }
    }

    public getCurrentNodeInfo () {
        return this._graphEval.getCurrentNodeInfo();
    }
}

type SubGraphEvalContext = LayerContext;

class SubgraphEval {
    private _weight = 0.0;
    private declare _nodes: Set<NodeEval>;
    private declare _currentNode: NodeEval;
    private _currentTransition: TransitionEval | null = null;
    private _transitionProgress = 0;
    private declare _anyNode: NodeEval;
    private declare _enterNode: NodeEval;

    public declare name: string;

    constructor (subgraph: PoseSubgraph, context: SubGraphEvalContext) {
        this.name = subgraph.name;

        const nodes = Array.from(subgraph.nodes());

        const nodeEvaluators = nodes.map((node) => createNodeEval(context, subgraph, node));

        for (let iNode = 0; iNode < nodes.length; ++iNode) {
            const node = nodes[iNode];
            nodeEvaluators[iNode].outgoingTransitions = createTransitionEval(context, subgraph, node, nodeEvaluators[iNode], nodeEvaluators, nodes);
        }

        this._nodes = new Set(nodeEvaluators);
        const entryNode = nodeEvaluators.find((node) => node.kind === NodeKind.entry);
        assertIsNonNullable(entryNode, 'Entry node is missing');
        this._enterNode = entryNode;

        const anyNode = nodeEvaluators.find((node) => node.kind === NodeKind.any);
        assertIsNonNullable(anyNode, 'Any node is missing');
        this._anyNode = anyNode;

        this._currentNode = entryNode;
    }

    /**
     * Indicates if this sub graph reached its exit.
     */
    get exited () {
        return this._currentNode.kind === NodeKind.exit;
    }

    /**
     * Resets this sub graph to its initial state.
     */
    public reset () {
        this._currentNode = this._enterNode;
        this._currentTransition = null;
    }

    /**
     * Sets weight of this sub graph.
     * @param weight The weight.
     */
    public setWeight (weight: number) {
        this._weight = weight;
        if (isPoseOrSubgraphNodeEval(this._currentNode)) {
            this._currentNode.setWeight(weight);
        }
    }

    public update (deltaTime: number) {
        let remainDeltaTime = deltaTime;
        do {
            const consumed = this._consume(remainDeltaTime);
            if (!consumed) {
                break;
            }
            remainDeltaTime -= consumed;
        } while (remainDeltaTime > 0);
    }

    public sample () {
        const { _currentNode: currentNode } = this;
        if (isPoseOrSubgraphNodeEval(currentNode)) {
            currentNode.sample();
        }
        if (this._currentTransition) {
            const { to } = this._currentTransition;
            if (isPoseOrSubgraphNodeEval(to)) {
                to.sample();
            }
        }
    }

    public getCurrentNodeInfo () {
        return {
            name: this._currentNode.name,
        };
    }

    private _consume (deltaTime: number) {
        const currentUpdatingConsume = this._updateCurrentTransition(deltaTime);
        if (currentUpdatingConsume !== 0.0) {
            return currentUpdatingConsume;
        }

        const currentNode = this._currentNode;

        let satisfiedTransition: TransitionEval | null = null;
        if (!(currentNode.kind === NodeKind.subgraph && !currentNode.exited)) {
            // If current node is subgraph,
            // we should wait for its exiting before we can look for its transitions.
            satisfiedTransition = this._getSatisfiedTransition(currentNode);
        }

        if (!satisfiedTransition) {
            satisfiedTransition = this._getSatisfiedTransition(this._anyNode);
        }

        const isValidSelfTransition = () => {
            if (currentNode.kind === NodeKind.pose) {
                return false;
            }
            if (currentNode.kind === NodeKind.subgraph) {
                if (currentNode.exited) {
                    return true;
                }
            }
            return false;
        };

        if (!satisfiedTransition || (satisfiedTransition.to === currentNode && !isValidSelfTransition())) {
            if (isPoseOrSubgraphNodeEval(currentNode)) {
                currentNode.update(deltaTime);
            }
            return deltaTime;
        }

        if (satisfiedTransition.to !== currentNode) {
            // Apply transitions
            this._currentTransition = satisfiedTransition;
            this._transitionProgress = 0.0;
            const targetNode = satisfiedTransition.to;
            if (isPoseOrSubgraphNodeEval(targetNode)) {
                targetNode.setWeight(this._weight);
                targetNode.enter();
            }
            // if (currentNode.kind === NodeKind.pose && currentNode.pose) {
            //     currentNode.pose.inactive();
            // }
            // this._currentNode = targetNode;

            if (graphLog) {
                debug(`[Subgraph ${this.name}]: Transition starts: from ${currentNode.name} to ${satisfiedTransition.to.name}.`);
            }

            return 0.0;
        }

        // Self transition

        if (currentNode.kind === NodeKind.subgraph) {
            assertIsTrue(currentNode.exited);
            currentNode.reenter();

            if (graphLog) {
                debug(`[Subgraph ${this.name}]: Subgraph ${currentNode.name} reentered.`);
            }

            currentNode.update(deltaTime);
        }

        return deltaTime;
    }

    private _updateCurrentTransition (deltaTime: number) {
        if (!this._currentTransition) {
            return 0.0;
        }

        const transitionDuration = this._currentTransition.duration;
        assertIsTrue(transitionDuration >= this._transitionProgress);
        const remain = transitionDuration - this._transitionProgress;
        const contrib = Math.min(remain, deltaTime);
        this._transitionProgress += contrib;

        const progress = this._transitionProgress;
        const fromNode = this._currentNode;
        const toNode = this._currentTransition.to;
        assertIsTrue(fromNode !== toNode);
        const ratio = Math.min(progress / transitionDuration, 1.0);
        // console.log(`Ratio ${ratio}`);

        const weight = this._weight;
        if (isPoseOrSubgraphNodeEval(fromNode)) {
            fromNode.setWeight(weight * (1.0 - ratio));
            fromNode.update(contrib);
        }
        if (isPoseOrSubgraphNodeEval(toNode)) {
            toNode.setWeight(weight * ratio);
            toNode.update(contrib * this._currentTransition.targetStretch);
        }

        if (ratio === 1.0) {
            if (graphLog) {
                debug(`[Subgraph ${this.name}]: Transition finished: from ${fromNode.name} to ${toNode.name}.`);
            }

            if (isPoseOrSubgraphNodeEval(fromNode)) {
                fromNode.leave();
            }
            this._currentNode = toNode;
            this._currentTransition = null;
        }

        return contrib;
    }

    private _getSatisfiedTransition (node: NodeEval): TransitionEval | null {
        const { outgoingTransitions } = node;
        for (let iTransition = 0; iTransition < outgoingTransitions.length; ++iTransition) {
            const transition = outgoingTransitions[iTransition];
            if (node.kind === NodeKind.pose
                && transition.exitCondition >= 0.0
                && node.progress < transition.exitCondition) {
                continue;
            }
            if (!transition.condition || transition.condition.eval()) {
                return transition;
            }
        }
        return null;
    }
}

function createNodeEval (context: SubGraphEvalContext, graph: PoseSubgraph, node: GraphNode): NodeEval {
    if (node instanceof PoseNode) {
        return new PoseNodeEval(node, context);
    } else if (node instanceof PoseSubgraph) {
        return new SubgraphNodeEval(node, context);
    } else {
        const kind = node === graph.entryNode
            ? NodeKind.entry
            : node === graph.exitNode
                ? NodeKind.exit
                : node === graph.anyNode
                    ? NodeKind.any
                    : NodeKind.exit;
        return new SpecialNodeEval(kind, node.name);
    }
}

function createTransitionEval (context: SubGraphEvalContext, graph: PoseSubgraph, node: GraphNode, nodeEval: NodeEval, nodeEvaluators: NodeEval[], mappings: GraphNode[]) {
    const outgoingTemplates = graph.getOutgoings(node);
    const outgoingTransitions: TransitionEval[] = [];
    for (const outgoing of outgoingTemplates) {
        const iOutgoingNode = mappings.findIndex((nodeTemplate) => nodeTemplate === outgoing.to);
        if (iOutgoingNode < 0) {
            assertIsTrue(false, 'Bad animation data');
        }
        const toEval = nodeEvaluators[iOutgoingNode];
        const transitionEval: TransitionEval = {
            to: toEval,
            condition: outgoing.condition?.[createEval](context) ?? null,
            duration: outgoing.duration,
            targetStretch: 1.0,
            exitCondition: outgoing.exitCondition,
        };
        if (toEval.kind === NodeKind.pose) {
            const toScaling = 1.0;
            // if (transitionEval.duration !== 0.0 && nodeEval.kind === NodeKind.pose && nodeEval.pose && toEval.pose) {
            //     // toScaling = toEval.pose.duration / transitionEval.duration;
            // }
            transitionEval.targetStretch = toScaling;
        }
        if (transitionEval.condition && outgoing.condition) {
            bindEvalProperties(context, outgoing.condition, transitionEval.condition);
        }
        outgoingTransitions.push(transitionEval);
    }
    return outgoingTransitions;
}

function bindEvalProperties<T extends BindingHost, EvalT> (context: SubGraphEvalContext, source: T, evalObject: EvalT) {
    const propertyBindingPoints = getPropertyBindingPoints(source);
    if (!propertyBindingPoints) {
        return;
    }
    for (const [bindingPointId, bindingPoint] of Object.entries(propertyBindingPoints)) {
        const varName = source.getPropertyBinding(bindingPointId);
        if (varName) {
            context.bind(varName, bindingPoint.notify, [evalObject]);
        }
    }
}

enum NodeKind {
    entry, exit, any, pose, subgraph,
}

export class NodeBaseEval {
    constructor (name: string) {
        this.name = name;
    }

    public readonly name: string;

    public outgoingTransitions: readonly TransitionEval[] = [];
}

export class PoseNodeEval extends NodeBaseEval {
    constructor (node: PoseNode, context: SubGraphEvalContext) {
        super(node.name);
        this.speed = node.speed;
        this.startRatio = node.startRatio;
        bindEvalProperties(context, node, this);
        const poseEvalContext: PoseEvalContext = {
            ...context,
            speed: node.speed,
            startRatio: node.startRatio,
        };
        const poseEval = node.pose?.[createEval](poseEvalContext) ?? null;
        if (poseEval && node.pose instanceof BindingHost) {
            bindEvalProperties(context, node.pose, poseEval);
        }
        this._pose = poseEval;
    }

    public readonly kind = NodeKind.pose;

    public speed: number;

    public startRatio: number;

    get progress () {
        return this._pose?.progress ?? -1.0;
    }

    public setWeight (weight: number) {
        this._pose?.setBaseWeight(weight);
    }

    public enter () {
        this._pose?.active();
    }

    public leave () {
        this._pose?.inactive();
    }

    public update (deltaTime: number) {
        this._pose?.update(deltaTime);
    }

    public sample () {
        this._pose?.sample();
    }

    private _pose: PoseEval | null = null;
}

export class SubgraphNodeEval extends NodeBaseEval {
    constructor (node: PoseSubgraph, context: SubGraphEvalContext) {
        super(node.name);
        const subgraphEval = new SubgraphEval(node, context);
        this.subgraphEval = subgraphEval;
    }

    public readonly kind = NodeKind.subgraph;

    public subgraphEval: SubgraphEval;

    get exited () {
        return this.subgraphEval.exited;
    }

    public enter () {
    }

    public leave () {
        this.subgraphEval.reset();
    }

    public reenter () {
        this.subgraphEval.reset();
    }

    public setWeight (weight: number) {
        this.subgraphEval.setWeight(weight);
    }

    public update (deltaTime: number) {
        this.subgraphEval.update(deltaTime);
    }

    public sample () {
        this.subgraphEval.sample();
    }
}

export class SpecialNodeEval extends NodeBaseEval {
    constructor (kind: SpecialNodeEval['kind'], name: string) {
        super(name);
        this.kind = kind;
    }

    public readonly kind: NodeKind.entry | NodeKind.exit | NodeKind.any;
}

export type NodeEval = PoseNodeEval | SubgraphNodeEval | SpecialNodeEval;

function isPoseOrSubgraphNodeEval (nodeEval: NodeEval): nodeEval is (PoseNodeEval | SubgraphNodeEval) {
    return nodeEval.kind === NodeKind.pose || nodeEval.kind === NodeKind.subgraph;
}

interface TransitionEval {
    to: NodeEval;
    duration: number;
    condition: ConditionEval | null;
    targetStretch: number;
    exitCondition: number;
}

interface VarRefs {
    value: Value;

    refs: VarRef[];
}

interface VarRef {
    fn: (value: unknown, ...args: unknown[]) => void;

    args: unknown[];
}
