import { BlendStateBuffer, BlendingPropertyName, BlendStateWriter, NamedCurveWriter, LayeredBlendStateBuffer } from '../../3d/skeletal-animation/skeletal-animation-blending';
import { assertIsTrue } from '../data/utils/asserts';
import { warn } from '../platform/debug';
import type { Node } from '../scene-graph';

export type Pose = BlendStateBuffer;

export class PoseOutput {
    public weight = 0.0;

    constructor (pose: Pose) {
        this._pose = pose;
    }

    public destroy () {
        for (let iBlendStateWriter = 0; iBlendStateWriter < this._blendStateWriters.length; ++iBlendStateWriter) {
            this._pose.destroyWriter(this._blendStateWriters[iBlendStateWriter]);
        }
        this._blendStateWriters.length = 0;

        if (this._pose instanceof LayeredBlendStateBuffer) {
            for (let iBlendStateWriter = 0; iBlendStateWriter < this._namedStateWriters.length; ++iBlendStateWriter) {
                this._pose.destroyNamedCurveWriter(this._namedStateWriters[iBlendStateWriter]);
            }
            this._namedStateWriters.length = 0;
        } else {
            assertIsTrue(this._namedStateWriters.length === 0);
        }
    }

    public createPoseWriter (node: Node, property: BlendingPropertyName, constants: boolean) {
        const writer = this._pose.createWriter(node, property, this, constants);
        this._blendStateWriters.push(writer);
        return writer;
    }

    public createNamedCurveWriter (name: string) {
        if (!(this._pose instanceof LayeredBlendStateBuffer)) {
            warn(`TODO: does not support named curve writer`);
            return undefined;
        }
        const writer = this._pose.createNamedCurveWriter(name);
        this._namedStateWriters.push(writer);
        return writer;
    }

    private _pose: Pose;

    private _blendStateWriters: BlendStateWriter<any>[] = [];

    private _namedStateWriters: NamedCurveWriter[] = [];
}
