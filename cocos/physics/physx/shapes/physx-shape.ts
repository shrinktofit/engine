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

/* eslint-disable @typescript-eslint/no-unsafe-return */
import { IVec3Like, Mat4, Quat, Vec3, geometry } from '../../../core';
import { Collider, RigidBody, PhysicsMaterial, PhysicsSystem } from '../../framework';
import { IBaseShape } from '../../spec/i-physics-shape';
import {
    addReference, getShapeFlags, getShapeMaterials, getShapeWorldBounds, getTempTransform,
    PX, removeReference, _trans,
} from '../physx-adapter';
import { EFilterDataWord3 } from '../physx-enum';
import { PhysXSharedBody } from '../physx-shared-body';
import { PhysXWorld } from '../physx-world';
import { PhysXInstance } from '../physx-instance';
import { PhysXObject } from '../physx-object';

export enum EPhysXShapeType {
    SPHERE,
    BOX,
    CAPSULE,
    CYLINDER,
    CONE,
    PLANE,
    TERRAIN,
    MESH,
}

/** @mangle */
export class PhysXShape extends PhysXObject implements IBaseShape {
    private static _MESH_SCALE: any;
    static get MESH_SCALE (): any {
        if (!this._MESH_SCALE) { this._MESH_SCALE = new PX.MeshScale(Vec3.ZERO, Quat.IDENTITY); }
        return this._MESH_SCALE;
    }

    get impl (): any { return this._impl; }
    get collider (): Collider { return this._collider; }
    get attachedRigidBody (): RigidBody | null { return null; }

    readonly type: EPhysXShapeType;

    protected _impl: any = null;
    protected _collider: Collider = null as any;
    protected _flags: any;
    protected _sharedBody!: PhysXSharedBody;
    protected _index = -1;
    protected _word3 = 0;
    protected _isEnabled = false;

    constructor (type: EPhysXShapeType) {
        super();
        this.type = type;
    }

    initialize (v: Collider): void {
        this._collider = v;
        this._flags = getShapeFlags(v.isTrigger);
        this._sharedBody = (PhysicsSystem.instance.physicsWorld as PhysXWorld).getSharedBody(v.attachedRigidBody?.node ?? v.node);
        this._sharedBody.reference = true;
        Vec3.copy(this._shapeLocalTransform.position, this._collider.center);
        this._updateLocalTransform();
        this.onComponentSet();
        addReference(this, this._impl);
    }

    setIndex (v: number): void {
        this._index = v;
    }

    // virtual
    onComponentSet (): void { }

    // virtual
    updateScale (): void { }

    onLoad (): void {
        this.setMaterial(this._collider.sharedMaterial);
        this.setCenter(this._collider.center);
    }

    onEnable (): void {
        this.addToBody();
        this._isEnabled = true;
        this._sharedBody.enabled = true;
    }

    onDisable (): void {
        this.removeFromBody();
        this._isEnabled = false;
        this._sharedBody.enabled = false;
    }

    onDestroy (): void {
        this._sharedBody.reference = false;
        if (this._impl) {
            removeReference(this, this._impl);
            this._impl.release();
            this._impl = null;
        }
        this._flags = null;
        this._collider = null as any;
    }

    setMaterial (v: PhysicsMaterial | null): void {
        const mat = this.getSharedMaterial(v);
        this._impl.setMaterials(getShapeMaterials(mat));
    }

    protected getSharedMaterial (v: PhysicsMaterial | null): any {
        const v1 = (v == null) ? PhysicsSystem.instance.defaultMaterial : v;
        if (!PX.CACHE_MAT[v1.id]) {
            const physics = PhysXInstance.physics;
            const mat = physics.createMaterial(v1.friction, v1.friction, v1.restitution);
            mat.setFrictionCombineMode(PX.CombineMode.eMULTIPLY);
            mat.setRestitutionCombineMode(PX.CombineMode.eMULTIPLY);
            PX.CACHE_MAT[v1.id] = mat;
            return mat;
        }
        const mat = PX.CACHE_MAT[v1.id];
        mat.setStaticFriction(v1.friction);
        mat.setDynamicFriction(v1.friction);
        mat.setRestitution(v1.restitution);
        return mat;
    }

    setAsTrigger (v: boolean): void {
        if (v) {
            this._impl.setFlag(PX.ShapeFlag.eSIMULATION_SHAPE, !v);
            this._impl.setFlag(PX.ShapeFlag.eTRIGGER_SHAPE, v);
        } else {
            this._impl.setFlag(PX.ShapeFlag.eTRIGGER_SHAPE, v);
            this._impl.setFlag(PX.ShapeFlag.eSIMULATION_SHAPE, !v);
        }
        if (this._index >= 0) {
            this._sharedBody.removeShape(this);
            this._sharedBody.addShape(this);
        }
    }

    setCenter (v: IVec3Like): void {
        Vec3.copy(this._shapeLocalTransform.position, v);
        this._updateLocalTransform();
    }

    updateColliderTransform (): void {
        this._updateLocalTransform();
    }

    getAABB (v: geometry.AABB): void {
        getShapeWorldBounds(this.impl, this._sharedBody.impl, 1, v);
    }

    getBoundingSphere (v: geometry.Sphere): void {
        geometry.AABB.toBoundingSphere(v, this._collider.worldBounds as geometry.AABB);
    }

    setGroup (v: number): void {
        this._sharedBody.setGroup(v);
    }

    getGroup (): number {
        return this._sharedBody.getGroup();
    }

    addGroup (v: number): void {
        this._sharedBody.addGroup(v);
    }

    removeGroup (v: number): void {
        this._sharedBody.removeGroup(v);
    }

    setMask (v: number): void {
        this._sharedBody.setMask(v);
    }

    getMask (): number {
        return this._sharedBody.getMask();
    }

    addMask (v: number): void {
        this._sharedBody.addMask(v);
    }

    removeMask (v: number): void {
        this._sharedBody.removeMask(v);
    }

    updateFilterData (filterData: any): void {
        this._word3 = EFilterDataWord3.DETECT_CONTACT_CCD;
        if (this._collider.needTriggerEvent) {
            this._word3 |= EFilterDataWord3.DETECT_TRIGGER_EVENT;
        }
        if (this._collider.needCollisionEvent) {
            this._word3 |= EFilterDataWord3.DETECT_CONTACT_EVENT | EFilterDataWord3.DETECT_CONTACT_POINT;
        }
        //filterData.word2 = this.id;//useless
        filterData.word3 = this._word3;
        this.setFilerData(filterData);
    }

    updateEventListener (): void {
        if (this._sharedBody) this.updateFilterData(this._sharedBody.filterData);
    }

    updateByReAdd (): void {
        if (this._isEnabled) {
            this.removeFromBody();
            this.addToBody();
        }
    }

    // virtual
    setFilerData (filterData: any): void {
        this._impl.setQueryFilterData(filterData);
        this._impl.setSimulationFilterData(filterData);
    }

    // virtual
    addToBody (): void {
        this._sharedBody.addShape(this);
    }

    // virtual
    removeFromBody (): void {
        this._sharedBody.removeShape(this);
    }

    protected get worldScale (): Readonly<Vec3> {
        return this._worldScale;
    }

    protected setShapeRotation (rotation: Quat): void {
        Quat.copy(this._shapeLocalTransform.rotation, rotation);
        this._updateLocalTransform();
    }

    protected setShapeExtraTranslation (v: IVec3Like): void {
        Vec3.copy(this._shapeLocalTransform.extraTranslation, v);
        this._updateLocalTransform();
    }

    private _worldScale = new Vec3(Vec3.ONE);

    private _shapeLocalTransform: ShapeTransform = {
        position: new Vec3(),
        extraTranslation: new Vec3(),
        rotation: new Quat(),
    };

    private _updateLocalTransform (): void {
        let iVec3Cache = 0;

        const colliderNode = this._collider.node;
        const actorNode = this._collider.attachedRigidBody?.node ?? colliderNode;

        // WorldMatrix of final shape:
        //   W_shape = (T_actor_w * R_actor_w * S_actor_w) * (T_0 * R_0 * S_0) * (T_1 * R_1 * S_1) * ... * (T * R * S) * (T_shape * R_shape)
        // We want:
        //   W_shape = (T_actor_w * R_actor_w) * (T_x * R_x * S_x)
        // So:
        //   (T_x * R_x * S_x) = (S_actor_w) * (T_0 * R_0 * S_0) * (T_1 * R_1 * S_1) * ... * (T * R * S) * (T_shape * R_shape)
        //                     = inv(T_actor_w * R_actor_w) * (T_actor_w * R_actor_w * S_actor_w) * (T_0 * R_0 * S_0) * (T_1 * R_1 * S_1) * ... * (T * R * S) * (T_shape * R_shape)
        //                     = inv(T_actor_w * R_actor_w) * W_collider * (T_shape * R_shape)

        const shapeTransform = this._shapeLocalTransform;
        const shapeWorldMatrix = Mat4.fromSRT(mat4Cache_1, shapeTransform.rotation, Vec3.add(
            v3Caches[iVec3Cache++],
            shapeTransform.position,
            shapeTransform.extraTranslation,
        ), Vec3.ONE);
        Mat4.multiply(shapeWorldMatrix, colliderNode.worldMatrix, shapeWorldMatrix);
        const inverseActorTR = Mat4.fromSRT(mat4Cache_3, actorNode.worldRotation, actorNode.worldPosition, Vec3.ONE);
        Mat4.invert(inverseActorTR, inverseActorTR);
        Mat4.multiply(shapeWorldMatrix, inverseActorTR, shapeWorldMatrix);

        const position = v3Caches[iVec3Cache++];
        const scale = v3Caches[iVec3Cache++];
        const rotation = quatCache_1;
        Mat4.toSRT(shapeWorldMatrix, rotation, position, scale);
        const pxLocalTransform = pxTransformCache_1;
        Vec3.copy(pxLocalTransform.translation, position);
        Quat.copy(pxLocalTransform.rotation, rotation);
        Vec3.copy(this._worldScale, scale);
        if (this._impl) {
            this._impl.setLocalPose(pxLocalTransform);
        }
    }
}

interface ShapeTransform {
    position: Vec3;
    extraTranslation: Vec3;
    rotation: Quat;
}

const mat4Cache_1 = new Mat4();
const mat4Cache_2 = new Mat4();
const mat4Cache_3 = new Mat4();
const v3Caches = Array.from({ length: 3 }, () => new Vec3());
const quatCache_1 = new Quat();
const pxTransformCache_1 = {
    translation: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
};
