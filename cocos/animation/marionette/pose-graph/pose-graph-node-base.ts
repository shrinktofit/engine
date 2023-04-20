import { EditorExtendable } from '../../../core';
import { EnterNodeInfo } from './enter-node-info';
import { PoseGraphNodeShell } from './node-shell';

export const shellTag = Symbol('Shell');

export class PoseGraphNodeBase extends EditorExtendable {
    public getTitle?(): string;

    public getEnterInfo?(): EnterNodeInfo | undefined;

    /** @internal */
    public [shellTag]: PoseGraphNodeShell | undefined;
}
