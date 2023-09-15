import "../../exports/physics-physx";
import { PhysicsMaterialCombineMode } from "../../cocos/physics/framework/assets/physics-material";
import { assertsUnreachable, Asset, builtinResMgr, director, Game, game, Node, v3, Vec3 } from "../../exports/base";
import { BoxCollider, ERigidBodyType, physics, PhysicsMaterial, PhysicsSystem, RigidBody } from "../../exports/physics-framework";
import { PhysicsTestEnv } from "./physics.test";
import '../utils/matchers/value-type-asymmetric-matchers';

export default function physicsMaterialTest(env: PhysicsTestEnv) {
    if (env.backendId !== 'physx') {
        return;
    }

    describe(`Physics material`, () => {
        test(`Default physics material`, () => {
            // Default material is defined to be built in resource "default-physics-material".
            expect(PhysicsSystem.instance.defaultMaterial).toBe(
                builtinResMgr.get<PhysicsMaterial>('default-physics-material')
            );
        
            // Its properties.
            expect(PhysicsSystem.instance.defaultMaterial).toEqual(expect.objectContaining<PhysicsMaterialProperties>({
                friction: 0.6,
                frictionCombineMode: PhysicsMaterialCombineMode.MULTIPLY,
                rollingFriction: 0.0,
                spinningFriction: 0.0,
                restitution: 0.0,
                restitutionCombineMode: PhysicsMaterialCombineMode.MULTIPLY,
            }));
        });
    
        describe(`Friction combine modes`, () => {
            test.only.each([
                ['Max', PhysicsMaterialCombineMode.MAX],
                // ['Multiply', PhysicsMaterialCombineMode.MULTIPLY],
                // ['Min', PhysicsMaterialCombineMode.MIN],
                // ['Average', PhysicsMaterialCombineMode.AVERAGE],
            ])(`Material combine mode: %s`, (_title, combineMode) => {
                testFrictionCombineMode(
                    env,
                    combineMode,
                    0.32,
                    combineMode,
                    0.86,
                );
            });
        });
    });
}

function testFrictionCombineMode(
    env: PhysicsTestEnv,
    combineMode0: PhysicsMaterialCombineMode,
    friction0: number,
    combineMode1: PhysicsMaterialCombineMode,
    friction1: number,
) {
    /// Test thoughts:
    /// - Create a stationary rigid box.
    /// - Create a dynamic rigid box, disabling damping, pressing the stationary one always.
    /// - Create materials and set friction and combine mode for them.
    /// - Give the dynamic one an impulse so that it slides on the stationary one along x-axis.
    /// - After some ticks, observe the dynamic one's velocity to see if the friction is correct.

    const stationaryObjectExtentX = 100;

    const stationaryObject = new Node();
    env.rootNode.addChild(stationaryObject);
    fpx(stationaryObject.addComponent(RigidBody) as RigidBody, {
        type: ERigidBodyType.STATIC,
    });
    fpx(stationaryObject.addComponent(BoxCollider) as BoxCollider, {
        size: v3(stationaryObjectExtentX, 1, 1),
        material: fpx(new PhysicsMaterial(), {
            friction: friction0,
            frictionCombineMode: combineMode0,
            restitution: 0.0,
        }),
    });

    const dynamicObject = new Node();
    env.rootNode.addChild(dynamicObject);
    const dynamicRigidBody = fpx(dynamicObject.addComponent(RigidBody) as RigidBody, {
        type: ERigidBodyType.DYNAMIC,
        linearDamping: 0.0,
    });
    fpx(dynamicObject.addComponent(BoxCollider) as BoxCollider, {
        size: v3(1, 1, 1),
        material: fpx(new PhysicsMaterial(), {
            friction: friction1,
            frictionCombineMode: combineMode1,
            restitution: 0.0,
        }),
    });

    const initialPosition = v3(-stationaryObjectExtentX / 2 + 1, 1);
    dynamicObject.worldPosition = initialPosition;

    // Tick until the dynamic object settled.
    {
        tickUntilSettled(dynamicRigidBody, 1 / 60, 10 / 60, 1e-3);
        const velocity = v3();
        dynamicRigidBody.getLinearVelocity(velocity);
        expect(velocity).toBeCloseToVec3(Vec3.ZERO, 2);
        expect(dynamicObject.worldPosition).toBeCloseToVec3(initialPosition, 3);
    }

    // Apply an initial speed at 40m/s .
    const initialVelocityX = 40;
    dynamicRigidBody.applyImpulse(v3(initialVelocityX * dynamicRigidBody.mass));

    const FPS = 60;
    const step = 1 / FPS;
    let simulationTimeLength = 0.0;
    for (let i = 0; i < FPS * 2; ++i) {
        director.tick(step);
        simulationTimeLength += step;
    }
    // The dynamic object shall not fall.
    expect(dynamicObject.worldPosition.x).not.toBeGreaterThan(stationaryObjectExtentX / 2 - 1);

    const expectedSelectedCombineMode = getExpectedSelectedCombineMode(combineMode0, combineMode1);
    const expectedFriction = getExpectedCombinedFriction(friction0, friction1, expectedSelectedCombineMode);

    const expectedFrictionForce = expectedFriction * dynamicRigidBody.mass * physics.PhysicsSystem.instance.gravity.y;
    const expectedResultVelocityX = initialVelocityX - Math.abs(expectedFrictionForce) * simulationTimeLength;
    expect(expectedResultVelocityX).toBeGreaterThan(-1e-6);
    const actualVelocity = v3();
    dynamicRigidBody.getLinearVelocity(actualVelocity);
    expect(actualVelocity).toBeCloseToVec3(v3(
        expectedResultVelocityX,
        0.0,
        0.0,
    ), 6);
}

type NoneMethods<T> = {
    [x in keyof T]: T[x] extends Function ? never : x;
}[keyof T];

type PhysicsMaterialProperties = Pick<
    PhysicsMaterial,
    NoneMethods<Omit<PhysicsMaterial, keyof Asset | 'id'>>
>;

function getExpectedSelectedCombineMode(combineMode0: PhysicsMaterialCombineMode, combineMode1: PhysicsMaterialCombineMode) {
    if (combineMode0 === combineMode1) {
        return combineMode0;
    } else {
        throw new Error(`TODO`);
    }
}

function getExpectedCombinedFriction(friction0: number, friction1: number, combineMode: PhysicsMaterialCombineMode) {
    switch (combineMode) {
        case PhysicsMaterialCombineMode.MULTIPLY: return friction0 * friction1;
        case PhysicsMaterialCombineMode.MIN: return Math.min(friction0, friction1);
        case PhysicsMaterialCombineMode.MAX: return Math.max(friction0, friction1);
        case PhysicsMaterialCombineMode.AVERAGE: return (friction0 + friction1) / 2;
        default: return assertsUnreachable();
    }
}

function tickUntilSettled(rigidBody: RigidBody, step: number, maxTime: number, epsilon: number) {
    const nMaxSteps = Math.floor(maxTime / step);
    for (let i = 0; i < nMaxSteps; ++i) {
        director.tick(step);
        const velocity = v3();
        rigidBody.getLinearVelocity(velocity);
        if (Vec3.equals(velocity, Vec3.ZERO, epsilon)) {
            return true;
        }
    }
    return false;
}

const fpx: <T extends {}>(object: T, properties: Partial<Pick<T, NoneMethods<T>>>) => T = Object.assign;
