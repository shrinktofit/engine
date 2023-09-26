import { assertIsTrue } from '@base/debug/internal';
import { DescriptorSet, Device, Format, FormatFeatureBit, BufferTextureCopy, Texture } from '../../gfx/index';
import { IMacroPatch } from '../../render-scene/index';
import { UNIFORM_REALTIME_JOINT_TEXTURE_BINDING } from '../../rendering/define';
import { Mesh } from '../index';
import { ImageAsset } from '../../asset/assets/image-asset';
import { Texture2D } from '../../asset/assets/texture-2d';
import { PixelFormat } from '../../asset/assets/asset-enum';

const textureMap = new Map<Texture, Float4ArrayTexture>();

export function todoCommitInstancesJointTexture (texture: Texture): void {
    const manager = textureMap.get(texture);
    if (!manager) {
        return;
    }
    manager.commit();
}

class Float4ArrayTexture {
    constructor (
        private _device: Device,
        textureWidth: number,
        textureHeight: number,
    ) {
        const supporting = _device.getFormatFeatures(Format.RGBA32F) & FormatFeatureBit.SAMPLED_TEXTURE;
        assertIsTrue(supporting);

        const buffer = new Float32Array(4 * textureWidth * textureHeight);
        const image = new ImageAsset({
            width: textureWidth,
            height: textureHeight,
            _data: buffer,
            _compressed: false,
            format: PixelFormat.RGBA32F,
        });
        const texture = new Texture2D();
        texture.reset({
            width: textureWidth,
            height: textureHeight,
            format: PixelFormat.RGBA32F,
        });
        texture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
        texture.setMipFilter(Texture2D.Filter.NONE);
        texture.setWrapMode(Texture2D.WrapMode.CLAMP_TO_EDGE, Texture2D.WrapMode.CLAMP_TO_EDGE, Texture2D.WrapMode.CLAMP_TO_EDGE);
        texture.image = image;
        this._buffer = buffer;
        this._texture = texture;

        this._buffers = [buffer];
        this._regions = [new BufferTextureCopy()];
    }

    public bind (descriptorSet: DescriptorSet, binding: number): void {
        const jointTexture = this._texture;
        const gfxTexture = this._texture.getGFXTexture();
        if (!gfxTexture) {
            return;
        }
        textureMap.set(gfxTexture, this);
        const sampler = jointTexture.getGFXSampler();
        descriptorSet.bindTexture(binding, gfxTexture);
        descriptorSet.bindSampler(binding, sampler);
    }

    public get buffer (): Float32Array {
        return this._buffer;
    }

    public commit (): void {
        const gfxTexture = this._texture.getGFXTexture();
        if (!gfxTexture) {
            return;
        }
        this._texture.uploadData(this.buffer);
        this._device.copyBuffersToTexture(this._buffers, gfxTexture, this._regions);
    }

    private _buffer: Float32Array;
    private _texture: Texture2D;
    private _buffers: [Float32Array];
    private _regions: [BufferTextureCopy];
}

class InstanceSubgroup {
    constructor (
        private _storage: Float4ArrayTexture,
        private _instanceLengthInFloats: number,
        private _maxInstances: number,
    ) {
    }

    public getPatches (): IMacroPatch[] {
        assertIsTrue(this._instanceLengthInFloats % 4 === 0);
        return [{
            name: 'CC_USE_SKINNING',
            value: true,
        }, {
            name: 'CC_USE_REAL_TIME_JOINT_TEXTURE',
            value: true,
        }, {
            name: 'CC_SKINNING_INSTANCE_STRIDE_IN_FLOAT_VEC4',
            value: this._instanceLengthInFloats / 4,
        }];
    }

    public updateInstance (instanceIndex: number, instanceData: Float32Array): void {
        assertIsTrue(!this._destroyed_debug);
        assertIsTrue(instanceData.length === this._instanceLengthInFloats);
        this._storage.buffer.set(instanceData, this._instanceLengthInFloats * instanceIndex);
    }

    public bindDescriptorSet (descriptorSet: DescriptorSet): void {
        this._storage.bind(descriptorSet, UNIFORM_REALTIME_JOINT_TEXTURE_BINDING);
    }

    public addMember (): InstanceCard {
        const id = this._instanceCount;
        ++this._instanceCount;
        const card = new InstanceCard(this, id);
        return card;
    }

    public removeMember (instanceIndex: number): void {
        assertIsTrue(this._instanceCount > 0);
        --this._instanceCount;
        // if (this._instanceCount === 0) {
        //     this._remote.destroy();
        //     this._destroyed_debug = true;
        // }
    }

    private _instanceCount = 0;
    private _destroyed_debug = false;
}

class InstanceGroup {
    constructor (
        private _device: Device,
        private _instanceJointCount: number,
    ) {
        const subgroupMaxFloats = this._textureWidth * this._textureHeight * 4;
        const instanceFloats = _instanceJointCount * 12;
        const subgroupMaxInstances = Math.floor(subgroupMaxFloats / instanceFloats);
        assertIsTrue(subgroupMaxInstances > 0);
        this._subgroupMaxInstances = subgroupMaxInstances;
        this._lastSubgroupInstances = this._subgroupMaxInstances;
    }

    public addMember (): InstanceCard {
        const { _subgroups } = this;
        if (this._lastSubgroupInstances >= this._subgroupMaxInstances) {
            const newSubgroup = this._addSubgroup();
            this._subgroups.push(newSubgroup);
            assertIsTrue(this._subgroupMaxInstances > 0);
            this._lastSubgroupInstances = 0;
        }
        assertIsTrue(this._subgroups.length > 0);
        const subgroup = _subgroups[_subgroups.length - 1];
        const card = subgroup.addMember();
        ++this._lastSubgroupInstances;
        return card;
    }

    private _textureWidth = 256;
    private _textureHeight = 256;
    private _subgroups: InstanceSubgroup[] = [];
    private _subgroupMaxInstances = 0;
    private _lastSubgroupInstances = 0;

    private _addSubgroup (): InstanceSubgroup {
        const storage = new Float4ArrayTexture(this._device, this._textureWidth, this._textureHeight);
        const instanceLengthInFloats = this._instanceJointCount * 12;
        const subgroup = new InstanceSubgroup(
            storage,
            instanceLengthInFloats,
            this._subgroupMaxInstances,
        );
        return subgroup;
    }
}

class InstancedJointTransformBufferMap {
    public get (mesh: Mesh, subMeshIndex: number): InstanceGroup | undefined {
        return this._perMesh.get(mesh)?.get(subMeshIndex);
    }

    public set (mesh: Mesh, subMeshIndex: number, group: InstanceGroup): void {
        let meshGroups = this._perMesh.get(mesh);
        if (!meshGroups) {
            meshGroups = new Map();
            this._perMesh.set(mesh, meshGroups);
        }
        meshGroups.set(subMeshIndex, group);
    }

    private _perMesh = new Map<Mesh, Map<number, InstanceGroup>>();
}

class InstanceCard {
    constructor (
        private readonly _group: InstanceSubgroup,
        private _instanceIndex: number,
    ) {
    }

    public leave (): void {
        this._group.removeMember(this._instanceIndex);
    }

    public getPatches (): IMacroPatch[] {
        return this._group.getPatches();
    }

    public update (transforms: Float32Array): void {
        this._group.updateInstance(this._instanceIndex, transforms);
    }

    public bindDescriptorSet (descriptorSet: DescriptorSet): void {
        this._group.bindDescriptorSet(descriptorSet);
    }
}

export type { InstanceCard };

class InstancedSkinningManager {
    private _groups: InstancedJointTransformBufferMap = new InstancedJointTransformBufferMap();

    public supports (device: Device, jointCount: number): boolean {
        return true;
    }

    public hire (device: Device, mesh: Mesh, subMeshIndex: number, jointCount: number): InstanceCard {
        let group = this._groups.get(mesh, subMeshIndex);
        if (!group) {
            group = new InstanceGroup(
                device,
                jointCount,
            );
            this._groups.set(mesh, subMeshIndex, group);
        }
        const card = group.addMember();
        return card;
    }
}

export const instanceManager = new InstancedSkinningManager();
