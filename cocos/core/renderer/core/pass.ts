/*
 Copyright (c) 2017-2018 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated engine source code (the "Software"), a limited,
  worldwide, royalty-free, non-assignable, revocable and non-exclusive license
 to use Cocos Creator solely to develop games on your target platforms. You shall
  not use Cocos Creator software for developing other software or tools that's
  used for developing games. You are not granted to publish, distribute,
  sublicense, and/or sell copies of Cocos Creator.

 The software or tools in this License Agreement are licensed, not sold.
 Xiamen Yaji Software Co., Ltd. reserves all rights not expressly granted to you.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
*/

/**
 * @category material
 */

import { builtinResMgr } from '../../3d/builtin/init';
import { EffectAsset, IPassInfo, IPassStates, IPropertyInfo, IShaderInfo } from '../../assets/effect-asset';
import { TextureBase } from '../../assets/texture-base';
import { GFXBindingLayout, IGFXBinding } from '../../gfx/binding-layout';
import { GFXBuffer } from '../../gfx/buffer';
import { GFXBindingType, GFXBufferUsageBit, GFXDynamicState,
    GFXGetTypeSize, GFXMemoryUsageBit, GFXPrimitiveMode, GFXType } from '../../gfx/define';
import { GFXDevice } from '../../gfx/device';
import { GFXPipelineLayout } from '../../gfx/pipeline-layout';
import { GFXBlendState, GFXBlendTarget, GFXDepthStencilState,
    GFXInputState, GFXPipelineState, GFXRasterizerState } from '../../gfx/pipeline-state';
import { GFXRenderPass } from '../../gfx/render-pass';
import { GFXSampler } from '../../gfx/sampler';
import { GFXShader } from '../../gfx/shader';
import { GFXTextureView } from '../../gfx/texture-view';
import { Mat3, Mat4, Vec2, Vec3, Vec4 } from '../../math';
import { isBuiltinBinding, RenderPassStage, RenderPriority } from '../../pipeline/define';
import { getPhaseID } from '../../pipeline/pass-phase';
import { Root } from '../../root';
import { programLib } from './program-lib';
import { samplerLib } from './sampler-lib';

export interface IDefineMap { [name: string]: number | boolean | string; }
export interface IPassInfoFull extends IPassInfo {
    // generated part
    idxInTech: number;
    curDefs: IDefineMap;
    states: PassOverrides;
}
export type PassOverrides = RecursivePartial<IPassStates>;

const _type2writer = {
    [GFXType.UNKNOWN]: (a: Float32Array, v: any, idx: number = 0) => console.warn('illegal uniform handle'),
    [GFXType.INT]: (a: Float32Array, v: any, idx: number = 0) => a[idx] = v,
    [GFXType.INT2]: (a: Float32Array, v: any, idx: number = 0) => Vec2.toArray(a, v, idx),
    [GFXType.INT3]: (a: Float32Array, v: any, idx: number = 0) => Vec3.toArray(a, v, idx),
    [GFXType.INT4]: (a: Float32Array, v: any, idx: number = 0) => Vec4.toArray(a, v, idx),
    [GFXType.FLOAT]: (a: Float32Array, v: any, idx: number = 0) => a[idx] = v,
    [GFXType.FLOAT2]: (a: Float32Array, v: any, idx: number = 0) => Vec2.toArray(a, v, idx),
    [GFXType.FLOAT3]: (a: Float32Array, v: any, idx: number = 0) => Vec3.toArray(a, v, idx),
    [GFXType.FLOAT4]: (a: Float32Array, v: any, idx: number = 0) => Vec4.toArray(a, v, idx),
    [GFXType.MAT3]: (a: Float32Array, v: any, idx: number = 0) => Mat3.toArray(a, v, idx),
    [GFXType.MAT4]: (a: Float32Array, v: any, idx: number = 0) => Mat4.toArray(a, v, idx),
};

const _type2reader = {
    [GFXType.UNKNOWN]: (a: Float32Array, v: any, idx: number = 0) => console.warn('illegal uniform handle'),
    [GFXType.INT]: (a: Float32Array, v: any, idx: number = 0) => a[idx],
    [GFXType.INT2]: (a: Float32Array, v: any, idx: number = 0) => Vec2.fromArray(v, a, idx),
    [GFXType.INT3]: (a: Float32Array, v: any, idx: number = 0) => Vec3.fromArray(v, a, idx),
    [GFXType.INT4]: (a: Float32Array, v: any, idx: number = 0) => Vec4.fromArray(v, a, idx),
    [GFXType.FLOAT]: (a: Float32Array, v: any, idx: number = 0) => a[idx],
    [GFXType.FLOAT2]: (a: Float32Array, v: any, idx: number = 0) => Vec2.fromArray(v, a, idx),
    [GFXType.FLOAT3]: (a: Float32Array, v: any, idx: number = 0) => Vec3.fromArray(v, a, idx),
    [GFXType.FLOAT4]: (a: Float32Array, v: any, idx: number = 0) => Vec4.fromArray(v, a, idx),
    [GFXType.MAT3]: (a: Float32Array, v: any, idx: number = 0) => Mat3.fromArray(v, a, idx),
    [GFXType.MAT4]: (a: Float32Array, v: any, idx: number = 0) => Mat4.fromArray(v, a, idx),
};

const _type2default = {
    [GFXType.INT]: [0],
    [GFXType.INT2]: [0, 0],
    [GFXType.INT3]: [0, 0, 0],
    [GFXType.INT4]: [0, 0, 0, 0],
    [GFXType.FLOAT]: [0],
    [GFXType.FLOAT2]: [0, 0],
    [GFXType.FLOAT3]: [0, 0, 0],
    [GFXType.FLOAT4]: [0, 0, 0, 0],
    [GFXType.MAT3]: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    [GFXType.MAT4]: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    [GFXType.SAMPLER2D]: 'default-texture',
    [GFXType.SAMPLER_CUBE]: 'default-cube-texture',
};

const btMask      = 0xf0000000; //  4 bits => 16 binding types
const typeMask    = 0x0fc00000; //  6 bits => 64 types
const bindingMask = 0x003fc000; //  8 bits => 256 bindings
const offsetMask  = 0x00003fff; // 14 bits => 4096 vectors
const genHandle = (bt: GFXBindingType, binding: number, type: GFXType, index: number = 0) =>
    ((bt << 28) & btMask) | ((type << 22) & typeMask) | ((binding << 14) & bindingMask) | (index & offsetMask);
const getBindingTypeFromHandle = (handle: number) => (handle & btMask) >>> 28;
const getTypeFromHandle = (handle: number) => (handle & typeMask) >>> 22;
const getBindingFromHandle = (handle: number) => (handle & bindingMask) >>> 14;
const getOffsetFromHandle = (handle: number) => (handle & offsetMask);
const customizeType = (handle: number, type: GFXType) => (handle & ~typeMask) | ((type << 22) & typeMask);

interface IBlock {
    buffer: ArrayBuffer;
    view: Float32Array;
    dirty: boolean;
}

interface IPassResources {
    bindingLayout: GFXBindingLayout;
    pipelineLayout: GFXPipelineLayout;
    pipelineState: GFXPipelineState;
}

interface IPassDynamics {
    [type: string]: {
        dirty: boolean,
        value: number[],
    };
}

interface IEffectInfo {
    techIdx: number;
    defines: IDefineMap[];
    states: PassOverrides[];
}

/**
 * @zh
 * 渲染 pass，储存实际描述绘制过程的各项资源。
 */
export class Pass {
    /**
     * @zh
     * 根据 handle 获取 unform 的绑定类型（UBO 或贴图等）。
     */
    public static getBindingTypeFromHandle = getBindingTypeFromHandle;
    /**
     * @zh
     * 根据 handle 获取 UBO member 的具体类型。
     */
    public static getTypeFromHandle = getTypeFromHandle;
    /**
     * @zh
     * 根据 handle 获取 binding。
     */
    public static getBindingFromHandle = getBindingFromHandle;

    public static createPasses (effect: EffectAsset, info: IEffectInfo) {
        const { techIdx, defines, states } = info;
        const tech = effect.techniques[techIdx || 0];
        if (!tech) { return []; }
        const passNum = tech.passes.length;
        const passes: Pass[] = [];
        for (let k = 0; k < passNum; ++k) {
            const passInfo = tech.passes[k] as IPassInfoFull;
            const defs = passInfo.curDefs = defines.length > k ? defines[k] : {};
            if (passInfo.switch && !defs[passInfo.switch]) { continue; }
            passInfo.states = states.length > k ? states[k] : {};
            passInfo.idxInTech = k;
            const pass = new Pass(cc.game._gfxDevice);
            pass.initialize(passInfo);
            passes.push(pass);
        }
        return passes;
    }

    protected static getOffsetFromHandle = getOffsetFromHandle;
    // internal resources
    protected _buffers: Record<number, GFXBuffer> = {};
    protected _samplers: Record<number, GFXSampler> = {};
    protected _textureViews: Record<number, GFXTextureView> = {};
    protected _resources: IPassResources[] = [];
    // internal data
    protected _phase: number = 0;
    protected _idxInTech = 0;
    protected _programName = '';
    protected _priority: RenderPriority = RenderPriority.DEFAULT;
    protected _primitive: GFXPrimitiveMode = GFXPrimitiveMode.TRIANGLE_LIST;
    protected _stage: RenderPassStage = RenderPassStage.DEFAULT;
    protected _bindings: IGFXBinding[] = [];
    protected _bs: GFXBlendState = new GFXBlendState();
    protected _dss: GFXDepthStencilState = new GFXDepthStencilState();
    protected _rs: GFXRasterizerState = new GFXRasterizerState();
    protected _dynamicStates: GFXDynamicState[] = [];
    protected _dynamics: IPassDynamics = {};
    protected _customizations: string[] = [];
    protected _handleMap: Record<string, number> = {};
    protected _blocks: IBlock[] = [];
    protected _shaderInfo: IShaderInfo = null!;
    protected _defines: IDefineMap = {};
    protected _properties: Record<string, IPropertyInfo> = {};
    // external references
    protected _device: GFXDevice;
    protected _renderPass: GFXRenderPass | null = null;
    protected _shader: GFXShader | null = null;

    public constructor (device: GFXDevice) {
        this._device = device;
    }

    /**
     * @zh
     * 根据指定参数初始化当前 pass，shader 会在这一阶段就尝试编译。
     */
    public initialize (info: IPassInfoFull) {
        this._idxInTech = info.idxInTech;
        this._programName = info.program;
        this._defines = info.curDefs;
        this._shaderInfo = programLib.getTemplate(info.program);
        this._properties = info.properties || this._properties;
        // pipeline state
        const device = this._device;
        this._fillinPipelineInfo(info);
        this._fillinPipelineInfo(info.states);

        for (const u of this._shaderInfo.blocks) {
            if (isBuiltinBinding(u.binding)) { continue; }
            const blockSize = u.members.reduce((s, m) => s + GFXGetTypeSize(m.type) * m.count, 0);

            // create gfx buffer resource
            this._buffers[u.binding] = device.createBuffer({
                memUsage: GFXMemoryUsageBit.HOST | GFXMemoryUsageBit.DEVICE,
                size: Math.ceil(blockSize / 16) * 16, // https://bugs.chromium.org/p/chromium/issues/detail?id=988988
                usage: GFXBufferUsageBit.UNIFORM | GFXBufferUsageBit.TRANSFER_DST,
            });
            // non-builtin UBO data pools, note that the effect compiler
            // guarantees these bindings to be consecutive, starting from 0
            const buffer = new ArrayBuffer(blockSize);
            this._blocks[u.binding] = { buffer, dirty: false, view: new Float32Array(buffer) };

            u.members.reduce((acc, cur) => {
                // store handle map
                this._handleMap[cur.name] = genHandle(GFXBindingType.UNIFORM_BUFFER, u.binding, cur.type, acc);
                // proceed the counter
                return acc + (GFXGetTypeSize(cur.type) >> 2) * cur.count;
            }, 0);
        }
        for (const u of this._shaderInfo.samplers) {
            this._handleMap[u.name] = genHandle(GFXBindingType.SAMPLER, u.binding, u.type);
        }

        this.resetUBOs();
        this.resetTextures();
        this.tryCompile();
    }

    /**
     * @zh
     * 获取指定 UBO 成员，或其更具体分量的读写句柄。默认以成员自身的类型为目标读写类型（即读写时必须传入与成员类型相同的变量）。
     * @param name 目标 UBO 成员名
     * @param offset 目标分量在成员内的偏移量
     * @param targetType 目标读写类型，用于定制化在使用此句柄时，将以什么类型进行读写操作
     * @example
     * ```
     * // say 'pbrParams' is a uniform vec4
     * const hParams = pass.getHandle('pbrParams'); // get the default handle
     * pass.setUniform(hAlbedo, cc.v3(1, 0, 0)); // wrong! pbrParams.w is NaN now
     *
     * // say 'albedoScale' is a uniform vec4, and we only want to modify the w component in the form of a single float
     * const hThreshold = pass.getHandle('albedoScale', 3, cc.GFXType.FLOAT);
     * pass.setUniform(hThreshold, 0.5); // now, albedoScale.w = 0.5
     * ```
     */
    public getHandle (name: string, offset = 0, targetType = GFXType.UNKNOWN): number | undefined {
        let handle = this._handleMap[name];
        if (!handle) { return; }
        if (targetType) { handle = customizeType(handle, targetType); }
        else if (offset) { handle = customizeType(handle, getTypeFromHandle(handle) - offset); }
        return handle + offset;
    }

    /**
     * @zh
     * 获取指定 uniform 的 binding。
     * @param name 目标 uniform 名。
     */
    public getBinding (name: string) {
        const handle = this.getHandle(name);
        if (handle === undefined) { return; }
        return Pass.getBindingFromHandle(handle);
    }

    /**
     * @zh
     * 设置指定普通向量类 uniform 的值，如果需要频繁更新请尽量使用此接口。
     * @param handle 目标 uniform 的 handle。
     * @param value 目标值。
     */
    public setUniform (handle: number, value: any) {
        const binding = Pass.getBindingFromHandle(handle);
        const type = Pass.getTypeFromHandle(handle);
        const ofs = Pass.getOffsetFromHandle(handle);
        const block = this._blocks[binding];
        _type2writer[type](block.view, value, ofs);
        block.dirty = true;
    }

    /**
     * @zh
     * 获取指定普通向量类 uniform 的值。
     * @param handle 目标 uniform 的 handle。
     * @param out 输出向量。
     */
    public getUniform (handle: number, out: any) {
        const binding = Pass.getBindingFromHandle(handle);
        const type = Pass.getTypeFromHandle(handle);
        const ofs = Pass.getOffsetFromHandle(handle);
        const block = this._blocks[binding];
        return _type2reader[type](block.view, out, ofs);
    }

    /**
     * @zh
     * 设置指定数组类 uniform 的值，如果需要频繁更新请尽量使用此接口。
     * @param handle 目标 uniform 的 handle。
     * @param value 目标值。
     */
    public setUniformArray (handle: number, value: any[]) {
        const binding = Pass.getBindingFromHandle(handle);
        const type = Pass.getTypeFromHandle(handle);
        const stride = GFXGetTypeSize(type) >> 2;
        const block = this._blocks[binding];
        let ofs = Pass.getOffsetFromHandle(handle);
        for (let i = 0; i < value.length; i++, ofs += stride) {
            if (value[i] === null) { continue; }
            _type2writer[type](block.view, value[i], ofs);
        }
        block.dirty = true;
    }

    /**
     * @zh
     * 绑定实际 [[GFXBuffer]] 到指定 binding。
     * @param binding 目标 UBO 的 binding。
     * @param value 目标 buffer。
     */
    public bindBuffer (binding: number, value: GFXBuffer) {
        if (this._buffers[binding] === value) { return; }
        this._buffers[binding] = value;
        const len = this._resources.length;
        for (let i = 0; i < len; i++) {
            const res = this._resources[i];
            res.bindingLayout.bindBuffer(binding, value);
        }
    }

    /**
     * @zh
     * 绑定实际 [[GFXTextureView]] 到指定 binding。
     * @param binding 目标贴图类 uniform 的 binding。
     * @param value 目标 texture view。
     */
    public bindTextureView (binding: number, value: GFXTextureView) {
        if (this._textureViews[binding] === value) { return; }
        this._textureViews[binding] = value;
        const len = this._resources.length;
        for (let i = 0; i < len; i++) {
            const res = this._resources[i];
            res.bindingLayout.bindTextureView(binding, value);
        }
    }

    /**
     * @zh
     * 绑定实际 [[GFXSampler]] 到指定 binding。
     * @param binding 目标贴图类 uniform 的 binding。
     * @param value 目标 sampler。
     */
    public bindSampler (binding: number, value: GFXSampler) {
        if (this._samplers[binding] === value) { return; }
        this._samplers[binding] = value;
        const len = this._resources.length;
        for (let i = 0; i < len; i++) {
            const res = this._resources[i];
            res.bindingLayout.bindSampler(binding, value);
        }
    }

    /**
     * @zh
     * 设置运行时 pass 内可动态更新的管线状态属性。
     * @param state 目标管线状态。
     * @param value 目标值。
     */
    public setDynamicState (state: GFXDynamicState, value: any) {
        const ds = this._dynamics[state];
        if (ds && ds.value === value) { return; }
        ds.value = value; ds.dirty = true;
    }

    /**
     * @zh
     * 重载当前所有管线状态。
     * @param original 原始管线状态。
     * @param value 管线状态重载值。
     */
    public overridePipelineStates (original: IPassInfo, overrides: PassOverrides) {
        this._bs = new GFXBlendState();
        this._dss = new GFXDepthStencilState();
        this._rs = new GFXRasterizerState();
        this._fillinPipelineInfo(original);
        this._fillinPipelineInfo(overrides);
    }

    /**
     * @zh
     * 更新当前 Uniform 数据。
     */
    public update () {
        const len = this._blocks.length;
        for (let i = 0; i < len; i++) {
            const block = this._blocks[i];
            if (block.dirty) {
                this._buffers[i].update(block.buffer);
                block.dirty = false;
            }
        }
        const source = (cc.director.root as Root).pipeline.globalBindings;
        const target = this._shaderInfo.builtins.globals;
        const samplerLen = target.samplers.length;
        for (let i = 0; i < samplerLen; i++) {
            const s = target.samplers[i];
            const info = source.get(s.name)!;
            if (info.sampler) { this.bindSampler(info.samplerInfo!.binding, info.sampler); }
            this.bindTextureView(info.samplerInfo!.binding, info.textureView!);
        }
    }

    /**
     * @zh
     * 销毁当前 pass。
     */
    public destroy () {
        for (const u of this._shaderInfo.blocks) {
            if (isBuiltinBinding(u.binding)) { continue; }
            this._buffers[u.binding].destroy();
        }
        this._buffers = {};
        // textures are reused
        this._samplers = {};
        this._textureViews = {};
    }

    /**
     * @zh
     * 重置所有 UBO 为初始默认值。
     */
    public resetUBOs () {
        for (const u of this._shaderInfo.blocks) {
            if (isBuiltinBinding(u.binding)) { continue; }
            const block: IBlock = this._blocks[u.binding];
            let ofs = 0;
            for (let i = 0; i < u.members.length; i++) {
                const cur = u.members[i];
                const inf = this._properties[cur.name];
                const givenDefault = inf && inf.value;
                const value = givenDefault ? givenDefault : _type2default[cur.type];
                const stride = GFXGetTypeSize(cur.type) >> 2;
                for (let j = 0; j < cur.count; j++) { block.view.set(value, ofs + j * stride); }
                ofs += stride * cur.count;
            }
            block.dirty = true;
        }
    }

    /**
     * @zh
     * 重置所有 texture 和 sampler 为初始默认值。
     */
    public resetTextures () {
        for (const u of this._shaderInfo.samplers) {
            if (isBuiltinBinding(u.binding)) { continue; }
            const inf = this._properties[u.name];
            const texName = inf && inf.value ? inf.value + '-texture' : _type2default[u.type];
            const texture = builtinResMgr.get<TextureBase>(texName);
            const textureView = texture && texture.getGFXTextureView();
            if (!textureView) { console.warn('illegal texture default value: ' + texName); continue; }
            this._textureViews[u.binding] = textureView;
            const samplerHash = inf && (inf.samplerHash !== undefined) ? inf.samplerHash : texture.getSamplerHash();
            const sampler = this._samplers[u.binding] = samplerLib.getSampler(this._device, samplerHash);
            for (let i = 0; i < this._resources.length; i++) {
                const res = this._resources[i];
                res.bindingLayout.bindSampler(u.binding, sampler);
                res.bindingLayout.bindTextureView(u.binding, textureView);
            }
        }
    }

    /**
     * @zh
     * 尝试编译 shader 并获取相关资源引用。
     * @param defineOverrides shader 预处理宏定义重载
     */
    public tryCompile (defineOverrides?: IDefineMap) {
        if (defineOverrides) { Object.assign(this._defines, defineOverrides); }
        const pipeline = (cc.director.root as Root).pipeline;
        if (!pipeline) { return false; }
        this._renderPass = pipeline.getRenderPass(this._stage);
        if (!this._renderPass) { console.warn(`illegal pass stage.`); return false; }
        this._shader = programLib.getGFXShader(this._device, this._programName, this._defines, pipeline);
        if (!this._shader) { console.warn(`create shader ${this._programName} failed`); return false; }
        this._bindings = this._shaderInfo.blocks.reduce((acc, cur) => {
            if (cur.defines.every((d) => this._defines[d])) {
                acc.push({ name: cur.name, binding: cur.binding, type: GFXBindingType.UNIFORM_BUFFER });
            }
            return acc;
        }, [] as IGFXBinding[]).concat(this._shaderInfo.samplers.reduce((acc, cur) => {
            if (cur.defines.every((d) => this._defines[d])) {
                acc.push({ name: cur.name, binding: cur.binding, type: GFXBindingType.SAMPLER });
            }
            return acc;
        }, [] as IGFXBinding[]));
        return true;
    }

    /**
     * @zh
     * 根据当前 pass 持有的信息创建 [[GFXPipelineState]]。
     */
    public createPipelineState (): GFXPipelineState | null {
        if ((!this._renderPass || !this._shader || !this._bindings.length) && !this.tryCompile()) {
            console.warn(`pass resources not complete, create PSO failed`);
            return null;
        }
        // bind resources
        const bindingLayout = this._device.createBindingLayout({ bindings: this._bindings });
        for (const b of Object.keys(this._buffers)) {
            bindingLayout.bindBuffer(parseInt(b), this._buffers[b]);
        }
        for (const s of Object.keys(this._samplers)) {
            bindingLayout.bindSampler(parseInt(s), this._samplers[s]);
        }
        for (const t of Object.keys(this._textureViews)) {
            bindingLayout.bindTextureView(parseInt(t), this._textureViews[t]);
        }
        // bind pipeline builtins
        const source = (cc.director.root as Root).pipeline.globalBindings;
        const target = this._shaderInfo.builtins.globals;
        for (const b of target.blocks) {
            const info = source.get(b.name);
            if (!info || info.type !== GFXBindingType.UNIFORM_BUFFER) { console.warn(`builtin UBO '${b.name}' not available!`); continue; }
            bindingLayout.bindBuffer(info.blockInfo!.binding, info.buffer!);
        }
        for (const s of target.samplers) {
            const info = source.get(s.name);
            if (!info || info.type !== GFXBindingType.SAMPLER) { console.warn(`builtin texture '${s.name}' not available!`); continue; }
            if (info.sampler) { bindingLayout.bindSampler(info.samplerInfo!.binding, info.sampler); }
            bindingLayout.bindTextureView(info.samplerInfo!.binding, info.textureView!);
        }

        // create pipeline state
        const pipelineLayout = this._device.createPipelineLayout({ layouts: [bindingLayout] });
        const pipelineState = this._device.createPipelineState({
            bs: this._bs,
            dss: this._dss,
            dynamicStates: this._dynamicStates,
            is: new GFXInputState(),
            layout: pipelineLayout,
            primitive: this._primitive,
            renderPass: this._renderPass!,
            rs: this._rs,
            shader: this._shader!,
        });
        this._resources.push({ bindingLayout, pipelineLayout, pipelineState });
        return pipelineState;
    }

    /**
     * @zh
     * 销毁指定的 [[GFXPipelineState]]，如果它是这个 pass 创建的。
     */
    public destroyPipelineState (pipelineStates: GFXPipelineState) {
        const idx = this._resources.findIndex((res) => res.pipelineState === pipelineStates);
        if (idx >= 0) {
            const { bindingLayout: bl, pipelineLayout: pl, pipelineState: ps } = this._resources[idx];
            bl.destroy(); pl.destroy(); ps.destroy();
            this._resources.splice(idx, 1);
        }
    }

    /**
     * @zh
     * 返回这个 pass 的序列化信息，用于计算 hash。
     */
    public serializePipelineStates () {
        const shaderKey = programLib.getKey(this._programName, this._defines);
        let res = `${shaderKey},${this._stage},${this._primitive}`;
        res += serializeBlendState(this._bs);
        res += serializeDepthStencilState(this._dss);
        res += serializeRasterizerState(this._rs);
        return res;
    }

    protected _fillinPipelineInfo (info: PassOverrides) {
        if (info.priority !== undefined) { this._priority = info.priority; }
        if (info.primitive !== undefined) { this._primitive = info.primitive; }
        if (info.stage !== undefined) { this._stage = info.stage; }
        if (info.dynamics !== undefined) { this._dynamicStates = info.dynamics as GFXDynamicState[]; }
        if (info.customizations) { this._customizations = info.customizations as string[]; }
        if (this._phase === 0) {
            const phaseName = info.phase || 'default';
            this._phase = getPhaseID(phaseName);
        }

        const bs = this._bs;
        if (info.blendState) {
            const bsInfo = Object.assign({}, info.blendState);
            if (bsInfo.targets) {
                bsInfo.targets.forEach((t, i) => Object.assign(
                bs.targets[i] || (bs.targets[i] = new GFXBlendTarget()), t));
            }
            delete bsInfo.targets;
            Object.assign(bs, bsInfo);
        }
        Object.assign(this._rs, info.rasterizerState);
        Object.assign(this._dss, info.depthStencilState);
    }

    get idxInTech () { return this._idxInTech; }
    get programName () { return this._programName; }
    get priority () { return this._priority; }
    get primitive () { return this._primitive; }
    get stage () { return this._stage; }
    get phase () { return this._phase; }
    get bindings () { return this._bindings; }
    get blendState () { return this._bs; }
    get depthStencilState () { return this._dss; }
    get rasterizerState () { return this._rs; }
    get dynamics () { return this._dynamics; }
    get customizations () { return this._customizations; }
    get shader (): GFXShader { return this._shader!; }
}

const serializeBlendState = (bs: GFXBlendState) => {
    let res = `,bs,${bs.isA2C},${bs.blendColor}`;
    for (const t of bs.targets) {
        res += `,bt,${t.blend},${t.blendEq},${t.blendAlphaEq},${t.blendColorMask}`;
        res += `,${t.blendSrc},${t.blendDst},${t.blendSrcAlpha},${t.blendDstAlpha}`;
    }
    return res;
};

const serializeRasterizerState = (rs: GFXRasterizerState) => {
    const res = `,rs,${rs.cullMode},${rs.depthBias},${rs.isFrontFaceCCW}`;
    return res;
};

const serializeDepthStencilState = (dss: GFXDepthStencilState) => {
    let res = `,dss,${dss.depthTest},${dss.depthWrite},${dss.depthFunc}`;
    res += `,${dss.stencilTestFront},${dss.stencilFuncFront},${dss.stencilRefFront},${dss.stencilReadMaskFront}`;
    res += `,${dss.stencilFailOpFront},${dss.stencilZFailOpFront},${dss.stencilPassOpFront},${dss.stencilWriteMaskFront}`;
    res += `,${dss.stencilTestBack},${dss.stencilFuncBack},${dss.stencilRefBack},${dss.stencilReadMaskBack}`;
    res += `,${dss.stencilFailOpBack},${dss.stencilZFailOpBack},${dss.stencilPassOpBack},${dss.stencilWriteMaskBack}`;
    return res;
};
