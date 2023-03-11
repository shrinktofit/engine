import { assertIsTrue, warn } from '../../../core';
import { instantiate } from '../../../serialization';
import { PoseNode } from './pose-node';
import { PoseGraph } from './pose-graph';
import { XNode, XNodeLinkContext } from './x-node';
import { PoseGraphNode } from './node';
import { PoseGraphNodeShell } from './node-shell';

export function instantiatePoseGraph (
    graph: PoseGraph,
    linkContext: XNodeLinkContext,
): PoseNode | undefined {
    const {
        main,
    } = graph;

    if (!main) {
        return undefined;
    }

    const instantiationMap = new Map<PoseGraphNode, RuntimeNodeEvaluation>();
    const mainRecord = instantiateNode(
        main,
        instantiationMap,
        linkContext,
    );
    assertIsTrue(mainRecord instanceof PoseNode);

    return mainRecord;
}

export interface PoseNodeDependencyEvaluation {
    evaluate(): void;
}

function instantiateNode<TNode extends PoseGraphNode> (
    shell: PoseGraphNodeShell<TNode>,
    instantiationMap: Map<PoseGraphNode, RuntimeNodeEvaluation>,
    linkContext: XNodeLinkContext,
): RuntimeNodeEvaluation {
    const {
        node,
    } = shell;

    const existing = instantiationMap.get(node);
    if (existing) {
        return existing;
    }

    const instantiated = instantiate(node);

    // Invoke serialization callback.
    if ('__callOnAfterDeserializeRecursive' in instantiated) {
        (instantiated as unknown as {
            __callOnAfterDeserializeRecursive(): void;
        }).__callOnAfterDeserializeRecursive();
    }

    /** Link. */
    if (instantiated instanceof XNode) {
        instantiated.link(linkContext);
    }

    /** Alias. */
    const consumerNode = instantiated;

    /**
     * Create the x-node property binding records.
     */
    const runtimeXNodePropertyBindings: RuntimeXNodePropertyBinding[] = [];
    for (const {
        target: producerShell,
        outputIndex: producerOutputIndex,
        consumerPropertyKey,
        consumerElementIndex,
    } of shell._getBindings()) {
        const producer = instantiateNode(producerShell, instantiationMap, linkContext);
        if (producer instanceof PoseNode) {
            // Rule: pose nodes can only be used to feed pose nodes.
            assertIsTrue(consumerNode instanceof PoseNode);
            // Core code: link pose nodes.
            assertIsTrue(consumerPropertyKey in consumerNode);
            linkPoseNode(
                consumerNode,
                consumerPropertyKey,
                consumerElementIndex,
                producer,
                producerOutputIndex,
            );
        } else {
            const runtimeXNodePropertyBinding = linkXNode(
                consumerNode,
                consumerPropertyKey,
                consumerElementIndex,
                producer,
                producerOutputIndex,
            );
            if (runtimeXNodePropertyBinding) {
                runtimeXNodePropertyBindings.push(runtimeXNodePropertyBinding);
            }
        }
    }

    // Create the dependency evaluation.
    const dependencyEvaluation = new DependencyEvaluation(runtimeXNodePropertyBindings);

    // Create the evaluation record.
    let evaluation: PoseNode | RuntimeNodeEvaluation;
    if (consumerNode instanceof PoseNode) {
        // If this is pose node. Injects the dependency.
        consumerNode._setDependencyEvaluation(dependencyEvaluation);
        evaluation = consumerNode;
    } else {
        // Otherwise, create the evaluation record.
        const xNodeEvaluation = new RuntimeXNodeEvaluation(consumerNode, dependencyEvaluation);
        evaluation = xNodeEvaluation;
    }

    instantiationMap.set(node, evaluation);
    return evaluation;
}

class DependencyEvaluation implements PoseNodeDependencyEvaluation {
    constructor (
        bindingEvaluations: readonly RuntimeXNodePropertyBinding[],
    ) {
        this._bindingEvaluations = bindingEvaluations;
    }

    public evaluate (): void {
        const {
            _bindingEvaluations: bindingEvaluations,
        } = this;

        for (const binding of bindingEvaluations) {
            binding.evaluate();
        }
    }

    private _bindingEvaluations: readonly RuntimeXNodePropertyBinding[];
}

class RuntimeXNodeEvaluation {
    constructor (
        private _node: XNode,
        private _dependency: DependencyEvaluation,
    ) {
        this._outputs = new Array(_node.outputCount);
    }

    get node () {
        return this._node;
    }

    public get outputCount () {
        return this._outputs.length;
    }

    public getDefaultOutput () {
        return this.getOutput(0);
    }

    public getOutput (outputIndex: number) {
        return this._outputs[outputIndex];
    }

    public evaluate () {
        const {
            _node: node,
            _dependency: dependency,
        } = this;
        // Evaluate the dependency.
        dependency.evaluate();
        // Evaluate the node.
        node.selfEvaluate(this._outputs);
    }

    protected _outputs: unknown[];
}

type RuntimeNodeEvaluation = PoseNode | RuntimeXNodeEvaluation;

function linkPoseNode (
    consumerNode: PoseNode,
    consumerPropertyKey: string,
    consumerElementIndex: number,
    producerNode: PoseNode,
    producerOutputIndex: number,
) {
    if (producerOutputIndex !== 0) {
        // Rule: pose nodes have and only have one output.
        warn(`Node ${producerNode.toString()} does not have specified output ${producerOutputIndex}.`);
        return;
    }

    const consumerProperty = consumerNode[consumerPropertyKey];

    // Plain property binding.

    if (consumerElementIndex < 0) {
        if (consumerProperty !== null) {
            // Invalid binding.
            warn(`Invalid binding: consumer node's input ${consumerPropertyKey} should be leaved as evaluation before evaluation.`);
            return;
        }

        consumerNode[consumerPropertyKey] = producerNode;
        return;
    }

    // The following is dedicated to array element bindings.

    if (!Array.isArray(consumerProperty)) {
        // Invalid binding.
        warn(`Invalid binding: consumer node's input ${consumerPropertyKey} should be an array.`);
        return;
    }

    if (consumerElementIndex >= consumerProperty.length) {
        // Invalid binding.
        warn(`Invalid binding: consumer node's input ${consumerPropertyKey} `
            + `have length ${consumerProperty.length} but the binding specified ${consumerElementIndex}`);
        return;
    }
    if (consumerProperty[consumerElementIndex] !== null) {
        // Invalid binding.
        warn(`Invalid binding: consumer node's input ${consumerPropertyKey}[${consumerElementIndex}] should be leaved as null before evaluation`);
        return;
    }

    consumerProperty[consumerElementIndex] = producerNode;
}

interface RuntimeXNodePropertyBinding {
    evaluate(): void;
}

class RuntimeXNodePlainPropertyBinding implements RuntimeXNodePropertyBinding {
    constructor (
        private _consumerNode: PoseGraphNode, // TODO: Don't use any.
        private _consumerPropertyKey: string,
        private _producerRecord: RuntimeXNodeEvaluation,
        private _producerOutputIndex: number,
    ) {
    }

    public evaluate () {
        this._producerRecord.evaluate();
        this._consumerNode[this._consumerPropertyKey] = this._producerRecord.getOutput(this._producerOutputIndex);
    }
}

class RuntimeXNodeArrayElementPropertyBinding implements RuntimeXNodePropertyBinding {
    constructor (
        private _consumerNode: PoseGraphNode, // TODO: Don't use any.
        private _consumerPropertyKey: string,
        private _consumerElementIndex: number,
        private _producerRecord: RuntimeXNodeEvaluation,
        private _producerOutputIndex: number,
    ) {
    }

    public evaluate () {
        this._producerRecord.evaluate();
        this._consumerNode[this._consumerPropertyKey][this._consumerElementIndex] = this._producerRecord.getOutput(this._producerOutputIndex);
    }
}

function linkXNode (
    consumerNode: PoseGraphNode,
    consumerPropertyKey: string,
    consumerElementIndex: number,
    producerRecord: RuntimeXNodeEvaluation,
    producerOutputIndex: number,
): RuntimeXNodePropertyBinding | undefined {
    const consumerProperty = consumerNode[consumerPropertyKey];

    // Plain property binding.

    if (consumerElementIndex < 0) {
        return new RuntimeXNodePlainPropertyBinding(
            consumerNode,
            consumerPropertyKey,
            producerRecord,
            producerOutputIndex,
        );
    }

    // The following is dedicated to array element bindings.

    if (!Array.isArray(consumerProperty)) {
        // Invalid binding.
        warn(`Invalid binding: consumer node's input ${consumerPropertyKey} should be an array.`);
        return undefined;
    }

    if (consumerElementIndex >= consumerProperty.length) {
        // Invalid binding.
        warn(`Invalid binding: consumer node's input ${consumerPropertyKey} `
            + `have length ${consumerProperty.length} but the binding specified ${consumerElementIndex}`);
        return undefined;
    }

    return new RuntimeXNodeArrayElementPropertyBinding(
        consumerNode,
        consumerPropertyKey,
        consumerElementIndex,
        producerRecord,
        producerOutputIndex,
    );
}
