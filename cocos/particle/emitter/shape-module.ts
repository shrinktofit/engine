/*
 Copyright (c) 2020-2023 Xiamen Yaji Software Co., Ltd.

 https://www.cocos.com/

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights to
 use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 of the Software, and to permit persons to whom the Software is furnished to do so,
 subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
*/

import { ccclass, tooltip, displayOrder, type, formerlySerializedAs, serializable, visible, range, editable } from 'cc.decorator';
import { Mat4, Quat, Vec2, Vec3, clamp, pingPong, random, randomRange, repeat, toDegree, toRadian, warn } from '../../core';

import CurveRange from '../animator/curve-range';
import { ParticleArcMode, ParticleEmitLocation, ParticleShapeType } from '../enum';
import { fixedAngleUnitVector2, particleEmitZAxis, randomPointBetweenCircleAtFixedAngle, randomPointBetweenSphere,
    randomPointInCube, randomSign, randomSortArray, randomUnitVector } from '../particle-general-function';
import { ParticleSystem } from '../particle-system';
import { Mesh } from '../../3d/assets/mesh';
import { FormatInfos } from '../../gfx/base/define';
import type { Particle } from '../particle';
import { property } from '../../core/data/class-decorator';

const _intermediVec = new Vec3(0, 0, 0);
const _intermediArr: [number, number, number] = [0, 0, 0];
const _unitBoxExtent = new Vec3(0.5, 0.5, 0.5);

// 计算属性偏移量的辅助函数
function getOffset (attributes: any[], attributeIndex: number): number {
    let result = 0;
    for (let i = 0; i < attributeIndex; ++i) {
        const attribute = attributes[i];
        result += FormatInfos[attribute.format].size;
    }
    return result;
}

function getShapeTypeEnumName (enumValue: number): keyof typeof ParticleShapeType {
    let enumName = '';
    for (const key in ParticleShapeType) {
        const value = ParticleShapeType[key];
        if (typeof value === 'number' && value === enumValue) {
            enumName = key;
            break;
        }
    }
    return enumName as keyof typeof ParticleShapeType;
}

/**
 * @en
 * This module defines the the volume or surface from which particles can be emitted, and the direction of the start velocity.
 * The Shape property defines the shape of the emission volume, and the rest of the module properties vary depending on the Shape you choose.
 * All shapes have properties that define their dimensions, such as the Radius property.
 * To edit these, drag the handles on the wireframe emitter shape in the Scene view.
 * The choice of shape affects the region from which particles can be emitted, but also the initial direction of the particles.
 * @zh
 * 本模块定义一个发射体或发射面，粒子将会从它进行发射，并且定义了粒子发射的初始方向和初始速度。
 * 形状属性定义粒子系统的发射体，剩下的属性依赖于选择的形状。
 * 所有形状都具有定义其大小的属性，例如 Radius 属性。要编辑这些属性，请在视图中拖动线框发射器形状上的控制柄。
 * 形状的选择会影响可发射粒子的区域，但也会影响粒子的初始方向。
 */
@ccclass('cc.ShapeModule')
export default class ShapeModule {
    /**
     * @en Emitter position.
     * @zh 粒子发射器位置。
     */
    @displayOrder(13)
    @tooltip('i18n:shapeModule.position')
    get position (): Vec3 {
        return this._position;
    }
    set position (val) {
        this._position = val;
        this.constructMat();
    }

    /**
     * @en Emitter rotation.
     * @zh 粒子发射器旋转角度。
     */
    @displayOrder(14)
    @tooltip('i18n:shapeModule.rotation')
    get rotation (): Vec3 {
        return this._rotation;
    }
    set rotation (val) {
        this._rotation = val;
        this.constructMat();
    }

    /**
     * @en Emitter size scale.
     * @zh 粒子发射器缩放比例。
     */
    @displayOrder(15)
    @tooltip('i18n:shapeModule.scale')
    get scale (): Vec3 {
        return this._scale;
    }
    set scale (val) {
        this._scale = val;
        this.constructMat();
    }

    /**
     * @en Particles will be emitted in an arc if shape is Cone or Circle.
     * @zh 粒子发射器在一个扇形范围内发射。
     */
    @displayOrder(6)
    @tooltip('i18n:shapeModule.arc')
    @visible(function (this: ShapeModule) {
        const subset: Array<keyof typeof ParticleShapeType> = ['Cone', 'Circle'];
        const enumName = getShapeTypeEnumName(this.shapeType);
        return subset.includes(enumName);
    })
    get arc (): number {
        return toDegree(this._arc);
    }

    set arc (val) {
        this._arc = toRadian(val);
    }

    /**
     * @en The angle of the Cone.<bg>
     * Define how the cone opening and closing.
     * @zh 圆锥的轴与母线的夹角<bg>。
     * 决定圆锥发射器的开合程度。
     */
    @displayOrder(5)
    @tooltip('i18n:shapeModule.angle')
    @visible(function (this: ShapeModule) {
        const subset: Array<keyof typeof ParticleShapeType> = ['Cone'];
        const enumName = getShapeTypeEnumName(this.shapeType);
        return subset.includes(enumName);
    })
    get angle (): number {
        return Math.round(toDegree(this._angle) * 100) / 100;
    }

    set angle (val) {
        this._angle = toRadian(val);
    }

    @serializable
    private _enable = false;
    /**
     * @en Enable this module or not.
     * @zh 是否启用。
     */
    @displayOrder(0)
    public get enable (): boolean {
        return this._enable;
    }

    public set enable (val) {
        this._enable = val;
    }

    /**
     * @en Emitter [[ShapeType]].
     * @zh 粒子发射器类型 [[ShapeType]]。
     *
     * @deprecated since v3.5.0, this is an engine private interface that will be removed in the future.
     */
    @type(ParticleShapeType)
    @formerlySerializedAs('shapeType')
    @displayOrder(1)
    public _shapeType = ParticleShapeType.Cone;

    @type(ParticleShapeType)
    @tooltip('i18n:shapeModule.shapeType')
    public get shapeType (): number {
        return this._shapeType;
    }

    public set shapeType (val) {
        this._shapeType = val;
        switch (this._shapeType) {
        case ParticleShapeType.Box:
            if (this.emitFrom === ParticleEmitLocation.Base) {
                this.emitFrom = ParticleEmitLocation.Volume;
            }
            break;
        case ParticleShapeType.Cone:
            if (this.emitFrom === ParticleEmitLocation.Edge) {
                this.emitFrom = ParticleEmitLocation.Base;
            }
            break;
        case ParticleShapeType.Sphere:
        case ParticleShapeType.Hemisphere:
            if (this.emitFrom === ParticleEmitLocation.Base || this.emitFrom === ParticleEmitLocation.Edge) {
                this.emitFrom = ParticleEmitLocation.Volume;
            }
            break;
        case ParticleShapeType.Mesh:
            // Mesh 类型只支持从表面发射
            this.emitFrom = ParticleEmitLocation.Shell;
            break;
        default:
            break;
        }
    }

    /**
     * @en Particles emitted from which part of the shape [[EmitLocation]] (Box Cone Sphere Hemisphere).
     * @zh 粒子从发射器哪个部位发射 [[EmitLocation]]。
     */
    @type(ParticleEmitLocation)
    @serializable
    @displayOrder(2)
    @tooltip('i18n:shapeModule.emitFrom')
    @visible(function (this: ShapeModule) {
        const subset: Array<keyof typeof ParticleShapeType> = ['Box', 'Cone', 'Sphere', 'Hemisphere'];
        const enumName = getShapeTypeEnumName(this.shapeType);
        return subset.includes(enumName);
    })
    public emitFrom = ParticleEmitLocation.Volume;

    /**
     * @en Align particle with particle direction.
     * @zh 根据粒子的初始方向决定粒子的移动方向。
     */
    @serializable
    @displayOrder(16)
    @tooltip('i18n:shapeModule.alignToDirection')
    public alignToDirection = false;

    /**
     * @en Particle direction random amount.
     * @zh 粒子生成方向随机设定。
     */
    @serializable
    @displayOrder(17)
    @tooltip('i18n:shapeModule.randomDirectionAmount')
    public randomDirectionAmount = 0;

    /**
     * @en Blend particle directions towards a spherical direction, where they travel outwards from the center of their transform.
     * @zh 表示当前发射方向与当前位置到结点中心连线方向的插值。
     */
    @serializable
    @displayOrder(18)
    @tooltip('i18n:shapeModule.sphericalDirectionAmount')
    public sphericalDirectionAmount = 0;

    /**
     * @en Particle position random amount.
     * @zh 粒子生成位置随机设定（设定此值为非 0 会使粒子生成位置超出生成器大小范围）。
     */
    @serializable
    @displayOrder(19)
    @tooltip('i18n:shapeModule.randomPositionAmount')
    public randomPositionAmount = 0;

    /**
     * @en Emition radius (available for Circle Cone Sphere Hemisphere).
     * @zh 粒子发射器半径。
     */
    @serializable
    @displayOrder(3)
    @tooltip('i18n:shapeModule.radius')
    @visible(function (this: ShapeModule) {
        const subset: Array<keyof typeof ParticleShapeType> = ['Circle', 'Cone', 'Sphere', 'Hemisphere'];
        const enumName = getShapeTypeEnumName(this.shapeType);
        return subset.includes(enumName);
    })
    public radius = 1;

    /**
     * @en Emit position in shape (available for Circle Cone Sphere Hemisphere): <bg>
     * - 0 Emit from surface;
     * - 1 Emit from volume center;
     * - 0 to 1 Emit within surface and volume center.
     * @zh 粒子发射器发射位置（对 Box 类型的发射器无效）：<bg>
     * - 0 表示从表面发射；
     * - 1 表示从中心发射；
     * - 0 ~ 1 之间表示在中心到表面之间发射。
     */
    @serializable
    @displayOrder(4)
    @tooltip('i18n:shapeModule.radiusThickness')
    @visible(function (this: ShapeModule) {
        const subset: Array<keyof typeof ParticleShapeType> = ['Circle', 'Cone', 'Sphere', 'Hemisphere'];
        const enumName = getShapeTypeEnumName(this.shapeType);
        return subset.includes(enumName);
    })
    public radiusThickness = 1;

    /**
     * @en Arc mode for Cone and Circle shape.
     * @zh 粒子在扇形范围内的发射方式 [[ArcMode]]。
     */
    @type(ParticleArcMode)
    @serializable
    @displayOrder(7)
    @tooltip('i18n:shapeModule.arcMode')
    @visible(function (this: ShapeModule) {
        const subset: Array<keyof typeof ParticleShapeType> = ['Cone', 'Circle'];
        const enumName = getShapeTypeEnumName(this.shapeType);
        return subset.includes(enumName);
    })
    public arcMode = ParticleArcMode.Random;

    /**
     * @en Control arc spread for Cone and circle shape.
     * @zh 控制可能产生粒子的弧周围的离散间隔。
     */
    @visible(function noArc (this: ShapeModule) { return this.arcMode !== ParticleArcMode.Random; }) // Bug fix: Hide this input when arcMode is random
    @serializable
    @displayOrder(9)
    @tooltip('i18n:shapeModule.arcSpread')
    @visible(function (this: ShapeModule) {
        const subset: Array<keyof typeof ParticleShapeType> = ['Cone', 'Circle'];
        const enumName = getShapeTypeEnumName(this.shapeType);
        return subset.includes(enumName);
    })
    public arcSpread = 0;

    /**
     * @en Emit speed around arc (available for Cone and Circle).
     * @zh 粒子沿圆周发射的速度。
     */
    @type(CurveRange)
    @visible(function noArc (this: ShapeModule) { return this.arcMode !== ParticleArcMode.Random; }) // Bug fix: Hide this input when arcMode is random
    @range([0, 1])
    @serializable
    @displayOrder(10)
    @tooltip('i18n:shapeModule.arcSpeed')
    @visible(function (this: ShapeModule) {
        const subset: Array<keyof typeof ParticleShapeType> = ['Cone', 'Circle'];
        const enumName = getShapeTypeEnumName(this.shapeType);
        return subset.includes(enumName);
    })
    public arcSpeed = new CurveRange();

    /**
     * @en The length from Cone bottom to top.
     * @zh 圆锥顶部截面距离底部的轴长<bg>。
     * 决定圆锥发射器的高度。
     */
    @serializable
    @displayOrder(11)
    @tooltip('i18n:shapeModule.length')
    @visible(function (this: ShapeModule) {
        const subset: Array<keyof typeof ParticleShapeType> = ['Cone'];
        const enumName = getShapeTypeEnumName(this.shapeType);
        return subset.includes(enumName);
    })
    public length = 5;

    /**
     * @en Shape thickness for box shape.
     * @zh 粒子发射器发射位置（针对 Box 类型的粒子发射器）。
     */
    @serializable
    @displayOrder(12)
    @tooltip('i18n:shapeModule.boxThickness')
    @visible(function (this: ShapeModule) {
        const subset: Array<keyof typeof ParticleShapeType> = ['Box'];
        const enumName = getShapeTypeEnumName(this.shapeType);
        return subset.includes(enumName);
    })
    public boxThickness = new Vec3(0, 0, 0);

    @serializable
    private _position = new Vec3(0, 0, 0);

    @serializable
    private _rotation = new Vec3(0, 0, 0);

    @serializable
    private _scale = new Vec3(1, 1, 1);

    @serializable
    private _arc = toRadian(360);

    @serializable
    private _angle = toRadian(25);

    private mat = new Mat4();
    private quat: Quat = new Quat();
    private particleSystem: ParticleSystem | null = null;
    private lastTime = 0;
    private totalAngle = 0;

    // Mesh缓存相关属性
    public _vertexBuffer: Vec3[] = [];
    public _faceBuffer: number[] = [];
    public _currentMesh: Mesh | null = null;
    public _currentMeshMaterialIndex = -1;
    public _faceAreas: number[] = [];
    public _totalArea: number = 0;

    constructor () {}
    private _refreshMesh (): void {
        const mesh = this.particleSystem!.emitMesh;
        this._currentMesh = mesh;
        this._currentMeshMaterialIndex = this.particleSystem!.emitMeshMaterialIndex;

        // 清理缓存
        this._vertexBuffer.length = 0;
        this._faceBuffer.length = 0;
        this._faceAreas.length = 0;
        this._totalArea = 0;

        if (mesh) {
            const primitives = mesh.struct.primitives;

            // 确定要处理的 primitive 索引
            let targetPrimitives: number[] = [];
            if (this.particleSystem!.emitMeshMaterialIndex >= 0) {
                // 只处理指定的 primitive
                if (this.particleSystem!.emitMeshMaterialIndex < primitives.length) {
                    targetPrimitives = [this.particleSystem!.emitMeshMaterialIndex];
                }
            } else {
                // 处理所有 primitives
                targetPrimitives = Array.from({ length: primitives.length }, (_, i) => i);
            }

            // 跟踪已处理的顶点束，避免重复处理
            const processedBundles = new Set<number>();
            let totalVertexCount = 0;

            // 处理每个目标 primitive
            for (const primitiveIndex of targetPrimitives) {
                const primitive = primitives[primitiveIndex];
                const faceIndexOffset = totalVertexCount; // 当前面索引的偏移量

                // 获取顶点数据
                if (primitive.vertexBundelIndices && primitive.vertexBundelIndices.length > 0) {
                    const bundleIndex = primitive.vertexBundelIndices[0];
                    // 检查是否已经处理过这个顶点束
                    if (!processedBundles.has(bundleIndex)) {
                        const bundle = mesh.struct.vertexBundles[bundleIndex];

                        // 查找位置属性
                        let positionAttributeIndex = -1;
                        for (let j = 0; j < bundle.attributes.length; j++) {
                            if (bundle.attributes[j].name === 'a_position') {
                                positionAttributeIndex = j;
                                break;
                            }
                        }

                        if (positionAttributeIndex !== -1) {
                            // 验证偏移量是否在有效范围内
                            const view = bundle.view;
                            const bufferOffset = mesh.data.byteOffset + view.offset;
                            const bufferEnd = mesh.data.byteOffset + mesh.data.length;

                            if (bufferOffset + view.length > bufferEnd) {
                                console.warn(`Buffer overflow: offset ${bufferOffset} + length ${view.length} > buffer end ${bufferEnd}`);
                                continue;
                            }

                            // 读取顶点数据
                            const dataView = new DataView(mesh.data.buffer, bufferOffset, view.length);
                            const positionOffset = getOffset(bundle.attributes, positionAttributeIndex);
                            const positionStride = bundle.attributes.reduce((acc, attr) => Math.max(acc, getOffset(bundle.attributes, bundle.attributes.indexOf(attr)) + FormatInfos[attr.format].size), 0);
                            const vertexCount = view.count;

                            // 验证 positionOffset 是否在有效范围内
                            if (positionOffset >= view.length) {
                                console.warn(`Position offset ${positionOffset} is outside view length ${view.length}`);
                                continue;
                            }

                            for (let v = 0; v < vertexCount; v++) {
                                const offset = v * positionStride + positionOffset;
                                if (offset + 12 > view.length) { // 12 bytes for 3 floats (x, y, z)
                                    console.warn(`Vertex data offset ${offset} is outside view bounds ${view.length}`);
                                    break;
                                }
                                const x = dataView.getFloat32(offset, true);
                                const y = dataView.getFloat32(offset + 4, true);
                                const z = dataView.getFloat32(offset + 8, true);
                                this._vertexBuffer.push(new Vec3(x, y, z));
                            }

                            totalVertexCount += vertexCount;
                            processedBundles.add(bundleIndex);
                        }
                    } else {
                    // 如果已经处理过这个顶点束，需要更新总顶点数
                        if (mesh.struct.vertexBundles[bundleIndex]) {
                            totalVertexCount += mesh.struct.vertexBundles[bundleIndex].view.count;
                        }
                    }
                }

                // 获取索引数据（用于表面发射）
                if (primitive.indexView) {
                    const indexView = primitive.indexView;
                    const bufferOffset = mesh.data.byteOffset + indexView.offset;
                    const bufferEnd = mesh.data.byteOffset + mesh.data.length;

                    if (bufferOffset + indexView.length > bufferEnd) {
                        console.warn(`Index buffer overflow: offset ${bufferOffset} + length ${indexView.length} > buffer end ${bufferEnd}`);
                        continue;
                    }

                    const dataView = new DataView(mesh.data.buffer, bufferOffset, indexView.length);
                    const indexCount = indexView.count;

                    for (let idx = 0; idx < indexCount; idx += 3) { // 每3个索引组成一个三角形
                        let index0: number = 0;
                        let index1: number = 0;
                        let index2: number = 0;

                        // 获取三角形的三个顶点索引
                        for (let i = 0; i < 3; i++) {
                            const currentIndex = idx + i;
                            let index: number = 0;
                            switch (indexView.stride) {
                            case 1:
                                if (currentIndex >= indexView.length) continue;
                                index = dataView.getUint8(currentIndex);
                                break;
                            case 2:
                                if (currentIndex * 2 + 1 >= indexView.length) continue;
                                index = dataView.getUint16(currentIndex * 2, true);
                                break;
                            case 4:
                                if (currentIndex * 4 + 3 >= indexView.length) continue;
                                index = dataView.getUint32(currentIndex * 4, true);
                                break;
                            default:
                                index = 0;
                            }

                            // 添加顶点偏移量
                            const adjustedIndex = index + faceIndexOffset;
                            switch (i) {
                            case 0:
                                index0 = adjustedIndex;
                                break;
                            case 1:
                                index1 = adjustedIndex;
                                break;
                            case 2:
                                index2 = adjustedIndex;
                                break;
                            }
                        }

                        // 存储面索引
                        this._faceBuffer.push(index0, index1, index2);

                        // 计算三角形面积并存储
                        let area = 0;
                        if (index0 < this._vertexBuffer.length
                        && index1 < this._vertexBuffer.length
                        && index2 < this._vertexBuffer.length) {
                            const v0 = this._vertexBuffer[index0];
                            const v1 = this._vertexBuffer[index1];
                            const v2 = this._vertexBuffer[index2];
                            area = this.calculateTriangleArea(v0, v1, v2);
                        }
                        this._faceAreas.push(area);
                        this._totalArea += area;
                    }
                }
            }
            console.warn(`total area: ${this._totalArea}`);
            const range = new CurveRange();
            this.particleSystem!.rateOverTime = range;
            range.mode = CurveRange.Mode.Constant;
            range.constant = this._totalArea * this.particleSystem!.density;
        }
    }

    // 新增：计算三角形面积的辅助函数
    private calculateTriangleArea (v0: Vec3, v1: Vec3, v2: Vec3): number {
    // 使用向量叉积计算三角形面积
    // 面积 = 0.5 * |(v1-v0) × (v2-v0)|
        const edge1 = new Vec3();
        const edge2 = new Vec3();
        const cross = new Vec3();

        Vec3.subtract(edge1, v1, v0);
        Vec3.subtract(edge2, v2, v0);
        Vec3.cross(cross, edge1, edge2);

        return 0.5 * Vec3.len(cross);
    }

    /**
     * @en Apply particle system to this shape and create shape transform matrix.
     * @zh 把发射形状应用到粒子系统，并且创建发射形状变换矩阵。
     * @param ps @en Emit shape applied to which Particle system. @zh 使用发射形状的粒子系统。
     * @internal
     */
    public onInit (ps: ParticleSystem): void {
        this.particleSystem = ps;
        this.constructMat();
        this.lastTime = this.particleSystem.time;
        if (this.shapeType === ParticleShapeType.Mesh) {
            this._refreshMesh();
        }
    }

    /**
     * @en Emit particle by this shape.
     * @zh 通过这个形状发射粒子。
     * @param p @en Particle emitted. @zh 发射出来的粒子。
     * @internal
     */
    public emit (p: Particle): void {
        switch (this.shapeType) {
        case ParticleShapeType.Box:
            boxEmit(this.emitFrom, this.boxThickness, p.position, p.velocity);
            break;
        case ParticleShapeType.Circle:
            circleEmit(this.radius, this.radiusThickness, this.generateArcAngle(), p.position, p.velocity);
            break;
        case ParticleShapeType.Cone:
            coneEmit(this.emitFrom, this.radius, this.radiusThickness, this.generateArcAngle(), this._angle, this.length, p.position, p.velocity);
            break;
        case ParticleShapeType.Sphere:
            sphereEmit(this.emitFrom, this.radius, this.radiusThickness, p.position, p.velocity);
            break;
        case ParticleShapeType.Hemisphere:
            hemisphereEmit(this.emitFrom, this.radius, this.radiusThickness, p.position, p.velocity);
            break;
        case ParticleShapeType.Mesh:
            this.meshEmit(p.position, p.velocity);
            break;
        default:
            warn(`${this.shapeType} shapeType is not supported by ShapeModule.`);
        }
        if (this.randomPositionAmount > 0) {
            p.position.x += randomRange(-this.randomPositionAmount, this.randomPositionAmount);
            p.position.y += randomRange(-this.randomPositionAmount, this.randomPositionAmount);
            p.position.z += randomRange(-this.randomPositionAmount, this.randomPositionAmount);
        }
        Vec3.transformQuat(p.velocity, p.velocity, this.quat);
        Vec3.transformMat4(p.position, p.position, this.mat);
        if (this.sphericalDirectionAmount > 0) {
            const sphericalVel = Vec3.normalize(_intermediVec, p.position);
            Vec3.lerp(p.velocity, p.velocity, sphericalVel, this.sphericalDirectionAmount);
        }
        this.lastTime = this.particleSystem!.time;
    }

    private constructMat (): void {
        Quat.fromEuler(this.quat, this._rotation.x, this._rotation.y, this._rotation.z);
        Mat4.fromRTS(this.mat, this.quat, this._position, this._scale);
    }

    /**
 * @en Emit particle from mesh surface or vertices
 * @zh 从网格表面或顶点发射粒子
 * @param shapeModule @en The shape module instance. @zh 形状模块实例
 * @param mesh @en The mesh to emit from. @zh 发射用的网格
 * @param useVertex @en Whether to emit from vertices. @zh 是否从顶点发射
 * @param pos @en Particle position output. @zh 粒子位置输出
 * @param dir @en Particle direction output. @zh 粒子方向输出
 */
    private meshEmit (pos: Vec3, dir: Vec3, useVertex = false): void {
        if (this.particleSystem!.emitMesh !== this._currentMesh || this._currentMeshMaterialIndex !== this.particleSystem!.emitMeshMaterialIndex) {
            this._refreshMesh();
        }
        if (!this._currentMesh) {
            randomUnitVector(pos);
            Vec3.normalize(dir, pos);
            return;
        }
        if (useVertex && this._vertexBuffer.length > 0) {
        // 从顶点发射
            const vertexIndex = Math.floor(randomRange(0, this._vertexBuffer.length));
            const vertex = this._vertexBuffer[vertexIndex];
            Vec3.copy(pos, vertex);
            // 方向为从中心指向顶点
            Vec3.normalize(dir, vertex);
        } else if (!useVertex && this._faceBuffer.length >= 3) {
        // 从表面发射 - 使用面积权重
            let faceIndex: number;
            if (this._totalArea > 0 && this._faceAreas.length > 0) {
            // 根据面积权重选择面
                const targetArea = randomRange(0, this._totalArea);
                let accumulatedArea = 0;
                let selectedFace = 0;

                for (let i = 0; i < this._faceAreas.length; i++) {
                    accumulatedArea += this._faceAreas[i];
                    if (targetArea <= accumulatedArea) {
                        selectedFace = i;
                        break;
                    }
                }

                faceIndex = selectedFace * 3;
            } else {
            // fallback到均匀分布
                faceIndex = Math.floor(randomRange(0, this._faceBuffer.length / 3)) * 3;
            }

            const index0 = this._faceBuffer[faceIndex];
            const index1 = this._faceBuffer[faceIndex + 1];
            const index2 = this._faceBuffer[faceIndex + 2];

            if (index0 < this._vertexBuffer.length && index1 < this._vertexBuffer.length && index2 < this._vertexBuffer.length) {
                const v0 = this._vertexBuffer[index0];
                const v1 = this._vertexBuffer[index1];
                const v2 = this._vertexBuffer[index2];

                // 在三角形面上随机选择一个点
                const r1 = random();
                const r2 = random();
                const sqrtR1 = Math.sqrt(r1);
                const u = 1 - sqrtR1;
                const v = r2 * sqrtR1;
                const w = 1 - u - v;

                // 计算三角形内的点
                pos.x = u * v0.x + v * v1.x + w * v2.x;
                pos.y = u * v0.y + v * v1.y + w * v2.y;
                pos.z = u * v0.z + v * v1.z + w * v2.z;

                // 计算法线方向作为发射方向
                const edge1 = new Vec3();
                const edge2 = new Vec3();
                const normal = new Vec3();
                Vec3.subtract(edge1, v1, v0);
                Vec3.subtract(edge2, v2, v0);
                Vec3.cross(normal, edge1, edge2);
                Vec3.normalize(dir, normal);
            } else {
            // fallback到单位球体
                randomUnitVector(pos);
                Vec3.normalize(dir, pos);
            }
        } else {
        // fallback到单位球体
            randomUnitVector(pos);
            Vec3.normalize(dir, pos);
        }
    }
    private generateArcAngle (): number {
        if (this.arcMode === ParticleArcMode.Random) {
            return randomRange(0, this._arc);
        }
        let angle = this.totalAngle + 2 * Math.PI * this.arcSpeed.evaluate(this.particleSystem!.time, 1)! * (this.particleSystem!.time - this.lastTime);
        this.totalAngle = angle;
        if (this.arcSpread !== 0) {
            angle = Math.floor(angle / (this._arc * this.arcSpread)) * this._arc * this.arcSpread;
        }
        switch (this.arcMode) {
        case ParticleArcMode.Loop:
            return repeat(angle, this._arc);
        case ParticleArcMode.PingPong:
            return pingPong(angle, this._arc);
        default:
            return repeat(angle, this._arc);
        }
    }
}

function sphereEmit (emitFrom: number, radius: number, radiusThickness: number, pos: Vec3, dir: Vec3): void {
    switch (emitFrom) {
    case ParticleEmitLocation.Volume:
        randomPointBetweenSphere(pos, radius * (1 - radiusThickness), radius);
        Vec3.normalize(dir, pos);
        break;
    case ParticleEmitLocation.Shell:
        randomUnitVector(pos);
        Vec3.multiplyScalar(pos, pos, radius);
        Vec3.normalize(dir, pos);
        break;
    default:
        warn(`${emitFrom} is not supported for sphere emitter.`);
    }
}

function hemisphereEmit (emitFrom: number, radius: number, radiusThickness: number, pos: Vec3, dir: Vec3): void {
    switch (emitFrom) {
    case ParticleEmitLocation.Volume:
        randomPointBetweenSphere(pos, radius * (1 - radiusThickness), radius);
        if (pos.z > 0) {
            pos.z *= -1;
        }
        Vec3.normalize(dir, pos);
        break;
    case ParticleEmitLocation.Shell:
        randomUnitVector(pos);
        Vec3.multiplyScalar(pos, pos, radius);
        if (pos.z > 0) {
            pos.z *= -1;
        }
        Vec3.normalize(dir, pos);
        break;
    default:
        warn(`${emitFrom} is not supported for hemisphere emitter.`);
    }
}

function coneEmit (
    emitFrom: number,
    radius: number,
    radiusThickness: number,
    theta: number,
    angle: number,
    length: number,
    pos: Vec3,
    dir: Vec3,
): void {
    switch (emitFrom) {
    case ParticleEmitLocation.Base:
        randomPointBetweenCircleAtFixedAngle(pos, radius * (1 - radiusThickness), radius, theta);
        Vec2.multiplyScalar(dir, pos, Math.sin(angle));
        dir.z = -Math.cos(angle) * radius;
        Vec3.normalize(dir, dir);
        pos.z = 0;
        break;
    case ParticleEmitLocation.Shell:
        fixedAngleUnitVector2(pos, theta);
        Vec2.multiplyScalar(dir, pos, Math.sin(angle));
        dir.z = -Math.cos(angle);
        Vec3.normalize(dir, dir);
        Vec2.multiplyScalar(pos, pos, radius);
        pos.z = 0;
        break;
    case ParticleEmitLocation.Volume:
        randomPointBetweenCircleAtFixedAngle(pos, radius * (1 - radiusThickness), radius, theta);
        Vec2.multiplyScalar(dir, pos, Math.sin(angle));
        dir.z = -Math.cos(angle) * radius;
        Vec3.normalize(dir, dir);
        pos.z = 0;
        Vec3.add(pos, pos, Vec3.multiplyScalar(_intermediVec, dir, length * random() / -dir.z));
        break;
    default:
        warn(`${emitFrom} is not supported for cone emitter.`);
    }
}

function boxEmit (emitFrom: number, boxThickness: Vec3, pos: Vec3, dir: Vec3): void {
    switch (emitFrom) {
    case ParticleEmitLocation.Volume:
        randomPointInCube(pos, _unitBoxExtent);
        // randomPointBetweenCube(pos, vec3.multiply(_intermediVec, _unitBoxExtent, boxThickness), _unitBoxExtent);
        break;
    case ParticleEmitLocation.Shell:
        _intermediArr[0] = randomRange(-0.5, 0.5);
        _intermediArr[1] = randomRange(-0.5, 0.5);
        _intermediArr[2] = randomSign() * 0.5;
        randomSortArray(_intermediArr);
        applyBoxThickness(_intermediArr, boxThickness);
        Vec3.set(pos, _intermediArr[0], _intermediArr[1], _intermediArr[2]);
        break;
    case ParticleEmitLocation.Edge:
        _intermediArr[0] = randomRange(-0.5, 0.5);
        _intermediArr[1] = randomSign() * 0.5;
        _intermediArr[2] = randomSign() * 0.5;
        randomSortArray(_intermediArr);
        applyBoxThickness(_intermediArr, boxThickness);
        Vec3.set(pos, _intermediArr[0], _intermediArr[1], _intermediArr[2]);
        break;
    default:
        warn(`${emitFrom} is not supported for box emitter.`);
    }
    Vec3.copy(dir, particleEmitZAxis);
}

function circleEmit (radius: number, radiusThickness: number, theta: number, pos: Vec3, dir: Vec3): void {
    randomPointBetweenCircleAtFixedAngle(pos, radius * (1 - radiusThickness), radius, theta);
    Vec3.normalize(dir, pos);
}

function applyBoxThickness (pos: [number, number, number], thickness: Vec3): void {
    if (thickness.x > 0) {
        pos[0] += 0.5 * randomRange(-thickness.x, thickness.x);
        pos[0] = clamp(pos[0], -0.5, 0.5);
    }
    if (thickness.y > 0) {
        pos[1] += 0.5 * randomRange(-thickness.y, thickness.y);
        pos[1] = clamp(pos[1], -0.5, 0.5);
    }
    if (thickness.z > 0) {
        pos[2] += 0.5 * randomRange(-thickness.z, thickness.z);
        pos[2] = clamp(pos[2], -0.5, 0.5);
    }
}
