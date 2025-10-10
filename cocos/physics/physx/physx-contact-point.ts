import { IVec3Like, Pool, Vec3 } from '../../core';
import { Node } from '../../scene-graph';
import { CharacterController, Collider } from '../framework';
import { Collision, ContactPoint } from '../framework/physics-interface';
import { getContactDataOrByteOffset } from './physx-adapter';

export interface PhysXContactPointImpl {
    position: IVec3Like;
    normal: IVec3Like;
}

export class PhysXContactPoint implements ContactPoint {
    get position (): Vec3 {
        if (this._impl) {
            Vec3.copy(this._position, this._impl.position);
        }
        return this._position;
    }

    get normal (): Vec3 {
        if (this._impl) {
            Vec3.copy(this._normal, this._impl.normal);
        }
        if (this._reverseContactNormal) {
            Vec3.negate(this._normal, this._normal);
        }
        return this._normal;
    }

    get impl (): unknown {
        return this._impl;
    }

    reset (impl: PhysXContactPointImpl, reverseContactNormal: boolean): void {
        this._impl = impl;
        this._reverseContactNormal = reverseContactNormal;
    }

    clear (): void {
        this._impl = undefined;
    }

    private _impl: PhysXContactPointImpl | undefined = undefined;
    private _reverseContactNormal = false;
    private _position = new Vec3();
    private _normal = new Vec3();
}

const globalCollisionCache: {
    -readonly [key in keyof Collision]: Collision[key] extends (string | number | boolean | unknown[]) ? Collision[key] : Collision[key] | undefined;
} = {
    self: undefined,
    selfNode: undefined,
    other: undefined,
    otherNode: undefined,
    contacts: [],
    impl: undefined,
};

const globalContactPointCachePool = new Pool<PhysXContactPoint>(
    () => new PhysXContactPoint(),
    1,
    (contact) => {
        contact.clear();
    },
);

export function fillGlobalPhysXCollision (
    selfComponent: Collider | CharacterController,
    selfNode: Node,
    otherComponent: Collider | CharacterController,
    otherNode: Node,
    dataBuffer: unknown,
    contactDataOffset: number,
    contactCount: number,
    reverseContactNormal: boolean,
): Collision {
    // eslint-disable-next-line no-void
    void dataBuffer;

    const collision = globalCollisionCache;

    collision.self = selfComponent;
    collision.selfNode = selfNode;
    collision.other = otherComponent;
    collision.otherNode = otherNode;
    collision.impl = undefined;

    const contacts = collision.contacts;
    contacts.length = 0;
    for (let iContact = 0; iContact < contactCount; iContact++) {
        const contact = globalContactPointCachePool.alloc();
        const contactImpl = getContactDataOrByteOffset(iContact, contactDataOffset) as PhysXContactPointImpl;
        contact.reset(contactImpl, reverseContactNormal);
        contacts.push(contact);
    }

    return collision as Collision;
}

export function freeGlobalPhysXCollision (collision: Collision): void {
    const g = collision as typeof globalCollisionCache;
    globalContactPointCachePool.freeArray(g.contacts as PhysXContactPoint[]);
    g.self = undefined;
    g.selfNode = undefined;
    g.other = undefined;
    g.otherNode = undefined;
    g.impl = undefined;
}
