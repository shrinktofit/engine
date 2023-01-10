import { EditorExtendable } from '../../../core';
import { VarInstance } from '../variable';

export abstract class XNode<TValue> extends EditorExtendable {
    public link (context: XNodeLinkContext) {
    }

    public abstract evaluate(): TValue;
}

export interface XNodeLinkContext {
    getVar(name: string): VarInstance | undefined;
}
