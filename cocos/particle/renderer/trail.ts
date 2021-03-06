
/**
 * @category particle
 */

import { Color, Vec3, Mat4, Quat } from '../../core/math';
import { ccclass, property } from '../../core/data/class-decorator';
import { GFX_DRAW_INFO_SIZE, GFXBuffer, IGFXIndirectBuffer } from '../../core/gfx/buffer';
import { GFXAttributeName, GFXBufferUsageBit, GFXFormat, GFXFormatInfos, GFXMemoryUsageBit, GFXPrimitiveMode } from '../../core/gfx/define';
import { GFXDevice } from '../../core/gfx/device';
import { IGFXAttribute } from '../../core/gfx/input-assembler';
import { Model } from '../../core/renderer';
import { Material } from '../../core/assets/material';
import { IRenderingSubmesh } from '../../core/assets/mesh';
import { Pool } from '../../core/memop';
import { director } from '../../core/director';
import CurveRange from '../animator/curve-range';
import GradientRange from '../animator/gradient-range';
import { Space, TextureMode, TrailMode } from '../enum';
import Particle from '../particle';

// tslint:disable: max-line-length
const PRE_TRIANGLE_INDEX = 1;
const NEXT_TRIANGLE_INDEX = 1 << 2;

const _temp_trailEle = { position: new Vec3(), velocity: new Vec3() } as ITrailElement;
const _temp_quat = new Quat();
const _temp_xform = new Mat4();
const _temp_vec3 = new Vec3();
const _temp_vec3_1 = new Vec3();
const _temp_color = new Color();

const barycentric = [1,0,0, 0,1,0, 0,0,1]; // <wirframe debug>
let _bcIdx = 0;

interface ITrailElement {
    position: Vec3;
    lifetime: number;
    width: number;
    velocity: Vec3;
    color: Color;
}

// the valid element is in [start,end) range.if start equals -1,it represents the array is empty.
class TrailSegment {
    public start: number;
    public end: number;
    public trailElements: ITrailElement[];

    constructor (maxTrailElementNum: number) {
        this.start = -1;
        this.end = -1;
        this.trailElements = [];
        while (maxTrailElementNum--) {
            this.trailElements.push({
                position: new Vec3(),
                lifetime: 0,
                width: 0,
                velocity: new Vec3(),
                color: new Color(),
            });
        }
    }

    public getElement (idx: number) {
        if (this.start === -1) {
            return null;
        }
        if (idx < 0) {
            idx = (idx + this.trailElements.length) % this.trailElements.length;
        }
        if (idx >= this.trailElements.length) {
            idx %= this.trailElements.length;
        }
        return this.trailElements[idx];
    }

    public addElement (): ITrailElement {
        if (this.trailElements.length === 0) {
            return null as any;
        }
        if (this.start === -1) {
            this.start = 0;
            this.end = 1;
            return this.trailElements[0];
        }
        if (this.start === this.end) {
            this.start++;
            this.start %= this.trailElements.length;
        }
        const newEleLoc = this.end++;
        this.end %= this.trailElements.length;
        return this.trailElements[newEleLoc];
    }

    public iterateElement (target: object, f: (target: object, e: ITrailElement, p: Particle, dt: number) => boolean, p: Particle, dt: number) {
        const end = this.start >= this.end ? this.end + this.trailElements.length : this.end;
        for (let i = this.start; i < end; i++) {
            if (f(target, this.trailElements[i % this.trailElements.length], p, dt)) {
                this.start++;
                this.start %= this.trailElements.length;
            }
        }
        if (this.start === end) {
            this.start = -1;
            this.end = -1;
        }
    }

    public count () {
        if (this.start < this.end) {
            return this.end - this.start;
        } else {
            return this.trailElements.length + this.end - this.start;
        }
    }

    public clear () {
        this.start = -1;
        this.end = -1;
    }

    // <debug>
    // public _print () {
    //     let msg = String();
    //     this.iterateElement(this, (target: object, e: ITrailElement, p: Particle, dt: number) => {
    //         msg += 'pos:' + e.position.toString() + '\nlifetime:' + e.lifetime + '\nwidth:' + e.width + '\nvelocity:' + e.velocity.toString() + '\n';
    //         return false;
    //     }, null, 0);
    //     console.log(msg);
    // }
}

@ccclass('cc.TrailModule')
export default class TrailModule {

    /**
     * 是否启用。
     */
    @property({
        displayOrder: 0,
    })
    public get enable () {
        return this._enable;
    }

    public set enable (val) {
        if (val && !this._trailModel) {
            this._createModel();
        }
        if (val && !this._enable) {
            this._enable = val;
            this._particleSystem.renderer._updateTrailMaterial();
        }
        this._enable = val;
        if (this._trailModel) {
            this._trailModel.enabled = val;
        }
    }

    @property
    public _enable = false;

    /**
     * 设定粒子生成轨迹的方式。
     */
    @property({
        type: TrailMode,
        displayOrder: 1,
    })
    public mode = TrailMode.Particles;

    /**
     * 轨迹存在的生命周期。
     */
    @property({
        type: CurveRange,
        displayOrder: 3,
    })
    public lifeTime = new CurveRange();

    @property
    public _minParticleDistance = 0.1;

    /**
     * 每个轨迹粒子之间的最小间距。
     */
    @property({
        displayOrder: 5,
    })
    public get minParticleDistance () {
        return this._minParticleDistance;
    }

    public set minParticleDistance (val) {
        this._minParticleDistance = val;
        this._minSquaredDistance = val * val;
    }

    @property({
        type: Space,
        displayOrder: 6,
    })
    public get space () {
        return this._space;
    }

    public set space (val) {
        this._space = val;
        if (this._particleSystem) {
            this._particleSystem.renderer._updateTrailMaterial();
        }
    }

    /**
     * 粒子本身是否存在。
     */
    @property({
        displayOrder: 7,
    })
    public existWithParticles = true;

    /**
     * 设定纹理填充方式。
     */
    @property({
        type: TextureMode,
        displayOrder: 8,
    })
    public textureMode = TextureMode.Stretch;

    @property({
        displayOrder: 9,
    })
    public widthFromParticle = true;

    /**
     * 控制轨迹长度的曲线。
     */
    @property({
        type: CurveRange,
        displayOrder: 10,
    })
    public widthRatio = new CurveRange();

    @property({
        displayOrder: 11,
    })
    public colorFromParticle = false;

    @property({
        type: GradientRange,
        displayOrder: 12,
    })
    public colorOverTrail = new GradientRange();

    @property({
        type: GradientRange,
        displayOrder: 13,
    })
    public colorOvertime = new GradientRange();

    /**
     * 轨迹设定时的坐标系。
     */
    @property({
        type: Space,
    })
    private _space = Space.World;

    @property({
        type: cc.ParticleSystemComponent,
        visible: false,
    })
    private _particleSystem: any = null;

    private _minSquaredDistance: number = 0;
    private _vertSize: number;
    private _trailNum: number = 0;
    private _trailLifetime: number = 0;
    private vbOffset: number = 0;
    private ibOffset: number = 0;
    private _trailSegments: Pool<TrailSegment> | null = null;
    private _particleTrail: Map<Particle, TrailSegment>;
    private _trailModel: Model | null = null;
    private _iaInfo: IGFXIndirectBuffer;
    private _iaInfoBuffer: GFXBuffer | null = null;
    private _subMeshData: IRenderingSubmesh | null = null;
    private _vertAttrs: IGFXAttribute[];
    private _vbF32: Float32Array | null = null;
    private _vbUint32: Uint32Array | null = null;
    private _iBuffer: Uint16Array | null = null;
    private _needTransform: boolean = false;
    private _defaultMat: Material | null = null;

    constructor () {
        this._iaInfo = {
            drawInfos: [{
                vertexCount: 0,
                firstVertex: 0,
                indexCount: 0,
                firstIndex: 0,
                vertexOffset: 0,
                instanceCount: 0,
                firstInstance: 0,
            }],
        };

        this._vertAttrs = [
            { name: GFXAttributeName.ATTR_POSITION, format: GFXFormat.RGB32F }, // xyz:position
            { name: GFXAttributeName.ATTR_TEX_COORD, format: GFXFormat.RGBA32F }, // x:index y:size zw:texcoord
            // { name: GFXAttributeName.ATTR_TEX_COORD2, format: GFXFormat.RGB32F }, // <wireframe debug>
            { name: GFXAttributeName.ATTR_TEX_COORD1, format: GFXFormat.RGB32F }, // xyz:velocity
            { name: GFXAttributeName.ATTR_COLOR, format: GFXFormat.RGBA8, isNormalized: true },
        ];
        this._vertSize = 0;
        for (const a of this._vertAttrs) {
            this._vertSize += GFXFormatInfos[a.format].size;
        }

        this._particleTrail = new Map<Particle, TrailSegment>();
    }

    public onInit (ps) {
        this._particleSystem = ps;
        this.minParticleDistance = this._minParticleDistance;
        let burstCount = 0;
        for (const b of this._particleSystem.bursts) {
            burstCount += b.getMaxCount(this._particleSystem);
        }
        this._trailNum = Math.ceil(this._particleSystem.startLifetime.getMax() * this.lifeTime.getMax() * 60 * (this._particleSystem.rateOverTime.getMax() * this._particleSystem.duration + burstCount));
        this._trailSegments = new Pool(() => new TrailSegment(Math.ceil(this._particleSystem.startLifetime.getMax() * this.lifeTime.getMax() * 60)), Math.ceil(this._particleSystem.rateOverTime.getMax() * this._particleSystem.duration));
        if (this._enable) {
            this.enable = this._enable;
            this._updateMaterial();
        }
    }

    public onEnable () {
        if (this._enable && this._trailModel) {
            this._trailModel.enabled = true;
        }
    }

    public onDisable () {
        if (this._enable && this._trailModel) {
            this._trailModel.enabled = false;
        }
    }

    public destroy () {
        if (this._trailModel) {
            this._particleSystem._getRenderScene().destroyModel(this._trailModel!);
            this._trailModel = null;
        }
    }

    public clear () {
        if (this.enable) {
            const trailIter = this._particleTrail.values();
            let trail = trailIter.next();
            while (!trail.done) {
                trail.value.clear();
                trail = trailIter.next();
            }
            this._particleTrail.clear();
            this.updateRenderData();
        }
    }

    public _updateMaterial () {
        if (this._particleSystem && this._trailModel) {
            const mat = this._particleSystem.renderer.trailMaterial;
            if (mat) {
                this._trailModel.setSubModelMaterial(0, mat);
            } else {
                this._trailModel.setSubModelMaterial(0, this._particleSystem.renderer._defaultTrailMat);
            }
        }
    }

    public update () {
        this._trailLifetime = this.lifeTime.evaluate(this._particleSystem._time, 1)!;
        if (this.space === Space.World && this._particleSystem._simulationSpace === Space.Local) {
            this._needTransform = true;
            this._particleSystem.node.getWorldMatrix(_temp_xform);
            this._particleSystem.node.getWorldRotation(_temp_quat);
        } else {
            this._needTransform = false;
        }
    }

    public animate (p: Particle, scaledDt: number) {
        if (!this._trailSegments) {
            return;
        }
        let trail = this._particleTrail.get(p);
        if (!trail) {
            trail = this._trailSegments.alloc();
            this._particleTrail.set(p, trail);
        }
        let lastSeg = trail.getElement(trail.end - 1);
        if (this._needTransform) {
            Vec3.transformMat4(_temp_vec3, p.position, _temp_xform);
        } else {
            Vec3.copy(_temp_vec3, p.position);
        }
        if (lastSeg) {
            trail.iterateElement(this, this._updateTrailElement, p, scaledDt);
            if (Vec3.squaredDistance(lastSeg.position, _temp_vec3) < this._minSquaredDistance) {
                return;
            }
        }
        lastSeg = trail.addElement();
        if (!lastSeg) {
            return;
        }
        Vec3.copy(lastSeg.position, _temp_vec3);
        lastSeg.lifetime = 0;
        if (this.widthFromParticle) {
            lastSeg.width = p.size.x * this.widthRatio.evaluate(0, 1)!;
        } else {
            lastSeg.width = this.widthRatio.evaluate(0, 1)!;
        }
        const trailNum = trail.count();
        if (trailNum === 2) {
            const lastSecondTrail = trail.getElement(trail.end - 2)!;
            Vec3.subtract(lastSecondTrail.velocity, lastSeg.position, lastSecondTrail.position);
        } else if (trailNum > 2) {
            const lastSecondTrail = trail.getElement(trail.end - 2)!;
            const lastThirdTrail = trail.getElement(trail.end - 3)!;
            Vec3.subtract(_temp_vec3, lastThirdTrail.position, lastSecondTrail.position);
            Vec3.subtract(_temp_vec3_1, lastSeg.position, lastSecondTrail.position);
            Vec3.subtract(lastSecondTrail.velocity, _temp_vec3_1, _temp_vec3);
            if (Vec3.equals(Vec3.ZERO, lastSecondTrail.velocity)) {
                Vec3.copy(lastSecondTrail.velocity, _temp_vec3);
            }
        }
        if (this.colorFromParticle) {
            lastSeg.color.set(p.color);
        } else {
            lastSeg.color.set(this.colorOvertime.evaluate(0, 1));
        }
    }

    public removeParticle (p: Particle) {
        const trail = this._particleTrail.get(p);
        if (trail && this._trailSegments) {
            trail.clear();
            this._trailSegments.free(trail);
            this._particleTrail.delete(p);
        }
    }

    public updateRenderData () {
        this.vbOffset = 0;
        this.ibOffset = 0;
        for (const p of this._particleTrail.keys()) {
            const trailSeg = this._particleTrail.get(p)!;
            if (trailSeg.start === -1) {
                continue;
            }
            const indexOffset = this.vbOffset * 4 / this._vertSize;
            const end = trailSeg.start >= trailSeg.end ? trailSeg.end + trailSeg.trailElements.length : trailSeg.end;
            const trailNum = end - trailSeg.start;
            // const lastSegRatio = vec3.distance(trailSeg.getTailElement()!.position, p.position) / this._minParticleDistance;
            const textCoordSeg = 1 / (trailNum /*- 1 + lastSegRatio*/);
            const startSegEle = trailSeg.trailElements[trailSeg.start];
            this._fillVertexBuffer(startSegEle, this.colorOverTrail.evaluate(1, 1), indexOffset, 1, 0, NEXT_TRIANGLE_INDEX);
            for (let i = trailSeg.start + 1; i < end; i++) {
                const segEle = trailSeg.trailElements[i % trailSeg.trailElements.length];
                const j = i - trailSeg.start;
                this._fillVertexBuffer(segEle, this.colorOverTrail.evaluate(1 - j / trailNum, 1), indexOffset, 1 - j * textCoordSeg, j, PRE_TRIANGLE_INDEX | NEXT_TRIANGLE_INDEX);
            }
            if (this._needTransform) {
                Vec3.transformMat4(_temp_trailEle.position, p.position, _temp_xform);
            } else {
                Vec3.copy(_temp_trailEle.position, p.position);
            }
            if (trailNum === 1) {
                const lastSecondTrail = trailSeg.getElement(trailSeg.end - 1)!;
                Vec3.subtract(lastSecondTrail.velocity, _temp_trailEle.position, lastSecondTrail.position);
                this._vbF32![this.vbOffset - this._vertSize / 4 - 4] = lastSecondTrail.velocity.x;
                this._vbF32![this.vbOffset - this._vertSize / 4 - 3] = lastSecondTrail.velocity.y;
                this._vbF32![this.vbOffset - this._vertSize / 4 - 2] = lastSecondTrail.velocity.z;
                this._vbF32![this.vbOffset - 4] = lastSecondTrail.velocity.x;
                this._vbF32![this.vbOffset - 3] = lastSecondTrail.velocity.y;
                this._vbF32![this.vbOffset - 2] = lastSecondTrail.velocity.z;
                Vec3.subtract(_temp_trailEle.velocity, _temp_trailEle.position, lastSecondTrail.position);
            } else if (trailNum > 2) {
                const lastSecondTrail = trailSeg.getElement(trailSeg.end - 1)!;
                const lastThirdTrail = trailSeg.getElement(trailSeg.end - 2)!;
                Vec3.subtract(_temp_vec3, lastThirdTrail.position, lastSecondTrail.position);
                Vec3.subtract(_temp_vec3_1, _temp_trailEle.position, lastSecondTrail.position);
                Vec3.subtract(lastSecondTrail.velocity, _temp_vec3_1, _temp_vec3);
                this._vbF32![this.vbOffset - this._vertSize / 4 - 4] = lastSecondTrail.velocity.x;
                this._vbF32![this.vbOffset - this._vertSize / 4 - 3] = lastSecondTrail.velocity.y;
                this._vbF32![this.vbOffset - this._vertSize / 4 - 2] = lastSecondTrail.velocity.z;
                this._vbF32![this.vbOffset - 4] = lastSecondTrail.velocity.x;
                this._vbF32![this.vbOffset - 3] = lastSecondTrail.velocity.y;
                this._vbF32![this.vbOffset - 2] = lastSecondTrail.velocity.z;
                Vec3.subtract(_temp_trailEle.velocity, _temp_trailEle.position, lastSecondTrail.position);
            }
            _temp_trailEle.width = p.size.x;
            _temp_trailEle.color = p.color;

            if (Vec3.equals(_temp_trailEle.velocity, Vec3.ZERO)) {
                this.ibOffset -= 3;
            } else {
                this._fillVertexBuffer(_temp_trailEle, this.colorOverTrail.evaluate(0, 1), indexOffset, 0, trailNum, PRE_TRIANGLE_INDEX);
            }
        }
        this.updateIA(this.ibOffset);
    }

    public updateIA (count: number) {
        if (this._trailModel && this._trailModel.subModelNum > 0) {
            const subModel = this._trailModel.getSubModel(0);
            subModel.inputAssembler!.vertexBuffers[0].update(this._vbF32!);
            subModel.inputAssembler!.indexBuffer!.update(this._iBuffer!);
            subModel.inputAssembler!.indexCount = count;
            subModel.inputAssembler!.extractDrawInfo(this._iaInfo.drawInfos[0]);
            this._iaInfoBuffer!.update(this._iaInfo);
        }
    }

    private _createModel () {
        if (this._trailModel) {
            return;
        }
        const device: GFXDevice = director.root!.device;
        const vertexBuffer = device.createBuffer({
            usage: GFXBufferUsageBit.VERTEX | GFXBufferUsageBit.TRANSFER_DST,
            memUsage: GFXMemoryUsageBit.HOST | GFXMemoryUsageBit.DEVICE,
            size: this._vertSize * (this._trailNum + 1) * 2,
            stride: this._vertSize,
        });
        const vBuffer: ArrayBuffer = new ArrayBuffer(this._vertSize * (this._trailNum + 1) * 2);
        this._vbF32 = new Float32Array(vBuffer);
        this._vbUint32 = new Uint32Array(vBuffer);
        vertexBuffer.update(vBuffer);

        const indexBuffer = device.createBuffer({
            usage: GFXBufferUsageBit.INDEX | GFXBufferUsageBit.TRANSFER_DST,
            memUsage: GFXMemoryUsageBit.HOST | GFXMemoryUsageBit.DEVICE,
            size: this._trailNum * 6 * Uint16Array.BYTES_PER_ELEMENT,
            stride: Uint16Array.BYTES_PER_ELEMENT,
        });
        this._iBuffer = new Uint16Array(this._trailNum * 6);
        indexBuffer.update(this._iBuffer);

        this._iaInfoBuffer = device.createBuffer({
            usage: GFXBufferUsageBit.INDIRECT,
            memUsage: GFXMemoryUsageBit.HOST | GFXMemoryUsageBit.DEVICE,
            size: GFX_DRAW_INFO_SIZE,
            stride: 1,
        });
        this._iaInfo.drawInfos[0].vertexCount = (this._trailNum + 1) * 2;
        this._iaInfo.drawInfos[0].indexCount = this._trailNum * 6;
        this._iaInfoBuffer.update(this._iaInfo);

        this._subMeshData = {
            vertexBuffers: [vertexBuffer],
            indexBuffer,
            indirectBuffer: this._iaInfoBuffer,
            attributes: this._vertAttrs!,
            primitiveMode: GFXPrimitiveMode.TRIANGLE_LIST,
        };

        this._trailModel = this._particleSystem._getRenderScene().createModel(Model, this._particleSystem.node);
        this._trailModel!.visFlags = this._particleSystem.visibility;
        this._trailModel!.setSubModelMesh(0, this._subMeshData);
        this._trailModel!.enabled = true;
    }

    private _updateTrailElement (module: any, trailEle: ITrailElement, p: Particle, dt: number): boolean {
        trailEle.lifetime += dt;
        if (module.colorFromParticle) {
            trailEle.color.set(p.color);
            trailEle.color.multiply(module.colorOvertime.evaluate(1.0 - p.remainingLifetime / p.startLifetime, 1));
        } else {
            trailEle.color.set(module.colorOvertime.evaluate(1.0 - p.remainingLifetime / p.startLifetime, 1));
        }
        if (module.widthFromParticle) {
            trailEle.width = p.size.x * module.widthRatio.evaluate(trailEle.lifetime / module._trailLifetime, 1)!;
        } else {
            trailEle.width = module.widthRatio.evaluate(trailEle.lifetime / module._trailLifetime, 1)!;
        }
        return trailEle.lifetime > module._trailLifetime;
    }

    private _fillVertexBuffer (trailSeg: ITrailElement, colorModifer: Color, indexOffset: number, xTexCoord: number, trailEleIdx: number, indexSet: number) {
        this._vbF32![this.vbOffset++] = trailSeg.position.x;
        this._vbF32![this.vbOffset++] = trailSeg.position.y;
        this._vbF32![this.vbOffset++] = trailSeg.position.z;
        this._vbF32![this.vbOffset++] = 0;
        this._vbF32![this.vbOffset++] = trailSeg.width;
        this._vbF32![this.vbOffset++] = xTexCoord;
        this._vbF32![this.vbOffset++] = 0;
        // this._vbF32![this.vbOffset++] = barycentric[_bcIdx++];  // <wireframe debug>
        // this._vbF32![this.vbOffset++] = barycentric[_bcIdx++];
        // this._vbF32![this.vbOffset++] = barycentric[_bcIdx++];
        // _bcIdx %= 9;
        this._vbF32![this.vbOffset++] = trailSeg.velocity.x;
        this._vbF32![this.vbOffset++] = trailSeg.velocity.y;
        this._vbF32![this.vbOffset++] = trailSeg.velocity.z;
        _temp_color.set(trailSeg.color);
        _temp_color.multiply(colorModifer);
        this._vbUint32![this.vbOffset++] = _temp_color._val;
        this._vbF32![this.vbOffset++] = trailSeg.position.x;
        this._vbF32![this.vbOffset++] = trailSeg.position.y;
        this._vbF32![this.vbOffset++] = trailSeg.position.z;
        this._vbF32![this.vbOffset++] = 1;
        this._vbF32![this.vbOffset++] = trailSeg.width;
        this._vbF32![this.vbOffset++] = xTexCoord;
        this._vbF32![this.vbOffset++] = 1;
        // this._vbF32![this.vbOffset++] = barycentric[_bcIdx++];  // <wireframe debug>
        // this._vbF32![this.vbOffset++] = barycentric[_bcIdx++];
        // this._vbF32![this.vbOffset++] = barycentric[_bcIdx++];
        // _bcIdx %= 9;
        this._vbF32![this.vbOffset++] = trailSeg.velocity.x;
        this._vbF32![this.vbOffset++] = trailSeg.velocity.y;
        this._vbF32![this.vbOffset++] = trailSeg.velocity.z;
        this._vbUint32![this.vbOffset++] = _temp_color._val;
        if (indexSet & PRE_TRIANGLE_INDEX) {
            this._iBuffer![this.ibOffset++] = indexOffset + 2 * trailEleIdx;
            this._iBuffer![this.ibOffset++] = indexOffset + 2 * trailEleIdx - 1;
            this._iBuffer![this.ibOffset++] = indexOffset + 2 * trailEleIdx + 1;
        }
        if (indexSet & NEXT_TRIANGLE_INDEX) {
            this._iBuffer![this.ibOffset++] = indexOffset + 2 * trailEleIdx;
            this._iBuffer![this.ibOffset++] = indexOffset + 2 * trailEleIdx + 1;
            this._iBuffer![this.ibOffset++] = indexOffset + 2 * trailEleIdx + 2;
        }
    }
}
