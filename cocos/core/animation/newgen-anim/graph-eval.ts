import { PoseGraph, Layer, PoseSubgraph, GraphNode, Transition } from './pose-graph';
import { assertIsTrue, assertIsNonNullable } from '../../data/utils/asserts';
import { PoseEval, PoseEvalContext } from './pose';
import type { Node } from '../../scene-graph/node';
import { createEval } from './create-eval';
import { Value } from './variable';
import { BindingHost, getPropertyBinding, getPropertyBindingPoints } from './parametric';
import { ConditionEval } from './condition';
import { VariableNotDefinedError } from './errors';
import { PoseNode } from './pose-node';
import { SkeletonMask } from '../skeleton-mask';

export class PoseGraphEval {
    private _varRefMap: Record<string, VarRefs> = {};
    private declare _layerEvaluations: LayerEval[];

    constructor (graph: PoseGraph, root: Node) {
        for (const [name, { value }] of graph.variables) {
            this._varRefMap[name] = {
                value,
                refs: [],
            };
        }

        const context: LayerContext = {
            node: root,
            bind: this._bind.bind(this),
            getParam: (host: BindingHost, name: string) => {
                const varId = getPropertyBinding(host, name);
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
        for (const layerEval of this._layerEvaluations) {
            layerEval.update(deltaTime);
        }
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

    mask?: SkeletonMask;

    getParam(host: BindingHost, name: string): unknown;

    bind<T, ExtraArgs extends any[]>(varId: string, fn: (value: T, ...args: ExtraArgs) => void, args: ExtraArgs): T;
}

class LayerEval {
    private declare _graphEval: SubgraphEval;

    constructor (layer: Layer, context: LayerContext) {
        this._graphEval = new SubgraphEval(layer.graph, {
            layerWeight: layer.weight,
            ...context,
        });
    }

    public update (deltaTime: number) {
        if (!this._graphEval.existed) {
            this._graphEval.update(deltaTime);
        }
    }

    public getCurrentNodeInfo () {
        return this._graphEval.getCurrentNodeInfo();
    }
}

type SubGraphEvalContext = LayerContext & {
    layerWeight: number;
};

class SubgraphEval {
    private declare _layerWeight: number;
    private declare _nodes: Set<NodeEval>;
    private declare _currentNode: NodeEval;
    private _currentTransition: TransitionEval | null = null;
    private _transitionProgress = 0;
    private declare _anyNode: NodeEval;

    constructor (subgraph: PoseSubgraph, context: SubGraphEvalContext) {
        this._layerWeight = context.layerWeight;

        const nodeEvaluators = subgraph.nodes.map((node) => createNodeEval(context, subgraph, node));

        for (let iNode = 0; iNode < subgraph.nodes.length; ++iNode) {
            const node = subgraph.nodes[iNode];
            nodeEvaluators[iNode].outgoingTransitions = createTransitionEval(context, subgraph, node, nodeEvaluators[iNode], nodeEvaluators);
        }

        this._nodes = new Set(nodeEvaluators);
        const entryNode = nodeEvaluators.find((node) => node.kind === NodeKind.entry);
        assertIsNonNullable(entryNode, 'Entry node is missing');

        const anyNode = nodeEvaluators.find((node) => node.kind === NodeKind.any);
        assertIsNonNullable(anyNode, 'Any node is missing');
        this._anyNode = anyNode;

        this._currentNode = entryNode;
    }

    get existed () {
        return this._currentNode.kind === NodeKind.exist;
    }

    public update (deltaTime: number) {
        this._consume(deltaTime);
    }

    public getCurrentNodeInfo () {
        return {
            name: this._currentNode.name,
        };
    }

    private _consume (deltaTime: number) {
        if (this._currentTransition) {
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
            console.log(`Ratio ${ratio}`);
            const layerWeight = this._layerWeight;
            if (fromNode.kind === NodeKind.pose) {
                fromNode.pose?.setBaseWeight(layerWeight * (1.0 - ratio));
                fromNode.pose?.update(contrib);
            }
            if (toNode.kind === NodeKind.pose) {
                toNode.pose?.setBaseWeight(layerWeight * ratio);
                toNode.pose?.update(contrib * this._currentTransition.targetStretch);
            }

            if (ratio === 1.0) {
                if (this._currentNode.kind === NodeKind.pose) {
                    this._currentNode.pose?.inactive();
                }
                this._currentNode = this._currentTransition.to;
                this._currentTransition = null;
            }

            return contrib;
        }

        // Apply transitions
        const currentNode = this._currentNode;
        let satisfiedTransition = this._getSatisfiedTransition(currentNode);
        if (!satisfiedTransition) {
            satisfiedTransition = this._getSatisfiedTransition(this._anyNode);
        }
        if (!satisfiedTransition || satisfiedTransition.to === currentNode) {
            if (currentNode.kind === NodeKind.pose && currentNode.pose) {
                currentNode.pose.update(deltaTime);
            }
        } else {
            this._currentTransition = satisfiedTransition;
            this._transitionProgress = 0.0;
            const targetNode = satisfiedTransition.to;
            if (targetNode.kind === NodeKind.pose && targetNode.pose) {
                targetNode.pose.active();
                targetNode.pose.setBaseWeight(this._layerWeight);
            }
            // if (currentNode.kind === NodeKind.pose && currentNode.pose) {
            //     currentNode.pose.inactive();
            // }
            // this._currentNode = targetNode;
        }

        return deltaTime;
    }

    private _getSatisfiedTransition (node: NodeEval): TransitionEval | null {
        const { outgoingTransitions } = node;
        for (let iTransition = 0; iTransition < outgoingTransitions.length; ++iTransition) {
            const transition = outgoingTransitions[iTransition];
            if (!transition.condition || transition.condition.eval()) {
                return transition;
            }
        }
        return null;
    }
}

function createNodeEval (context: SubGraphEvalContext, graph: PoseSubgraph, node: GraphNode): NodeEval {
    const name = node.name;
    const outgoingTransitions: TransitionEval[] = [];
    if (node instanceof PoseNode) {
        const poseNodeEval: PoseNodeEval & NodeBaseEval = {
            name,
            outgoingTransitions,
            kind: NodeKind.pose,
            pose: null,
            speed: node.speed,
            startRatio: node.startRatio,
        };
        bindEvalProperties(context, node, poseNodeEval);
        const poseEvalContext: PoseEvalContext = {
            ...context,
            speed: node.speed,
            startRatio: node.startRatio,
        };
        const poseEval = node.pose?.[createEval](poseEvalContext) ?? null;
        if (poseEval && node.pose instanceof BindingHost) {
            bindEvalProperties(context, node.pose, poseEval);
        }
        poseNodeEval.pose = poseEval;
        return poseNodeEval;
    } else if (node instanceof PoseSubgraph) {
        const subgraphEval = new SubgraphEval(node, context);
        return {
            name,
            outgoingTransitions,
            kind: NodeKind.subgraph,
            subgraphEval,
        };
    } else {
        return {
            name,
            outgoingTransitions,
            kind: node === graph.entryNode
                ? NodeKind.entry
                : node === graph.existNode
                    ? NodeKind.exist
                    : node === graph.anyNode
                        ? NodeKind.any
                        : NodeKind.exist,
        };
    }
}

function createTransitionEval (context: SubGraphEvalContext, graph: PoseSubgraph, node: GraphNode, nodeEval: NodeEval, nodeEvaluators: NodeEval[]) {
    const outgoingTemplates = graph.getOutgoings(node);
    const outgoingTransitions: TransitionEval[] = [];
    for (const outgoing of outgoingTemplates) {
        const iOutgoingNode = graph.nodes.findIndex((nodeTemplate) => nodeTemplate === outgoing.to);
        if (iOutgoingNode < 0) {
            assertIsTrue(false, 'Bad animation data');
        }
        const toEval = nodeEvaluators[iOutgoingNode];
        const transitionEval: TransitionEval = {
            to: toEval,
            condition: outgoing.condition?.[createEval]() ?? null,
            duration: outgoing.duration,
            targetStretch: 1.0,
        };
        if (toEval.kind === NodeKind.pose) {
            const toScaling = 1.0;
            if (transitionEval.duration !== 0.0 && nodeEval.kind === NodeKind.pose && nodeEval.pose && toEval.pose) {
                // toScaling = toEval.pose.duration / transitionEval.duration;
            }
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
        const varName = getPropertyBinding(source, bindingPointId);
        if (varName) {
            context.bind(varName, bindingPoint.notify, [evalObject]);
        }
    }
}

enum NodeKind {
    entry, exist, any, pose, subgraph,
}

interface NodeBaseEval {
    name: string;
    outgoingTransitions: TransitionEval[];
}

export interface PoseNodeEval extends NodeBaseEval {
    kind: NodeKind.pose;
    pose: PoseEval | null;
    speed: number;
    startRatio: number;
}

export interface SubgraphNodeEval extends NodeBaseEval {
    kind: NodeKind.subgraph;
    subgraphEval: SubgraphEval;
}

export interface SpecialNodeEval extends NodeBaseEval {
    kind: NodeKind.entry | NodeKind.exist | NodeKind.any;
}

export type NodeEval = PoseNodeEval | SubgraphNodeEval | SpecialNodeEval;

interface TransitionEval {
    to: NodeEval;
    duration: number;
    condition: ConditionEval | null;
    targetStretch: number;
}

interface VarRefs {
    value: Value;

    refs: VarRef[];
}

interface VarRef {
    fn: (value: unknown, ...args: unknown[]) => void;

    args: unknown[];
}
