import "../../exports/physics-physx";
import { PhysicsMaterialCombineMode } from "../../cocos/physics/framework/assets/physics-material";
import { assertsUnreachable, Asset, builtinResMgr, director, Node, v3, Vec3 } from "../../exports/base";
import { BoxCollider, Collider, ERigidBodyType, physics, PhysicsMaterial, PhysicsSystem, RigidBody, SphereCollider } from "../../exports/physics-framework";
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
            test.each([
                ['Max', PhysicsMaterialCombineMode.MAX],
                ['Multiply', PhysicsMaterialCombineMode.MULTIPLY],
                ['Min', PhysicsMaterialCombineMode.MIN],
                ['Average', PhysicsMaterialCombineMode.AVERAGE],
            ])(`Friction combine mode: %s`, (_title, combineMode) => {
                for (const combineMode2 of allCombineModes) {
                    testFrictionCombineMode(
                        env,
                        combineMode,
                        0.32,
                        combineMode2,
                        0.86,
                    );
    
                    env.rootNode.destroyAllChildren();
                }
            });
        });

        describe(`Restitution combine modes`, () => {
            test.each([
                ['Max', PhysicsMaterialCombineMode.MAX],
                ['Multiply', PhysicsMaterialCombineMode.MULTIPLY],
                ['Min', PhysicsMaterialCombineMode.MIN],
                ['Average', PhysicsMaterialCombineMode.AVERAGE],
            ])(`Restitution combine mode: %s`, (_title, combineMode) => {
                for (const combineMode2 of allCombineModes) {
                    testRestitutionCombineMode(
                        env,
                        combineMode,
                        0.32,
                        combineMode2,
                        0.86,
                    );
    
                    env.rootNode.destroyAllChildren();
                }
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
    /// - Create a dynamic rigid box, disabling damping and angle velocity, pressing the stationary one always.
    /// - Create materials and set friction and combine mode for them.
    /// - Give the dynamic one an impulse so that it slides on the stationary one along x-axis.
    /// - After some ticks, observe the dynamic one's velocity to see if the friction is correct.

    const FPS = 60;
    const step = 1 / FPS;
    const slidingTicks = FPS;
    const initialVelocityX = 40;
    const maxPossibleSlidingDistance = initialVelocityX * slidingTicks * step;

    const stationaryObjectExtentX = maxPossibleSlidingDistance + 5;
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
        angularDamping: 0.0,
        angularFactor: Vec3.ZERO,
    });
    // Note we're not using box collider since it gives unexpected result,
    // see: 
    // https://forums.developer.nvidia.com/t/unusual-friction-coefficient-behaviour-in-physx-3-4/49589/4
    // fpx(dynamicObject.addComponent(BoxCollider) as BoxCollider, {
    //     size: v3(1, 1, 1),
    //     material: fpx(new PhysicsMaterial(), {
    //         friction: friction1,
    //         frictionCombineMode: combineMode1,
    //         restitution: 0.0,
    //     }),
    // });
    fpx(dynamicObject.addComponent(SphereCollider) as SphereCollider, {
        radius: 1,
        material: fpx(new PhysicsMaterial(), {
            friction: friction1,
            frictionCombineMode: combineMode1,
            restitution: 0.0,
        }),
    });

    const initialPosition = v3(-stationaryObjectExtentX / 2 + 1, 1);
    dynamicObject.worldPosition = initialPosition;

    dynamicRigidBody.applyImpulse(v3(initialVelocityX * dynamicRigidBody.mass));

    let simulationTimeLength = 0.0;
    for (let i = 0; i < slidingTicks; ++i) {
        director.tick(step);
        simulationTimeLength += step;
    }
    // The dynamic object shall not fall.
    expect(dynamicObject.worldPosition.x).not.toBeGreaterThan(stationaryObjectExtentX / 2 - 1);

    const expectedSelectedCombineMode = getExpectedSelectedCombineMode(combineMode0, combineMode1);
    const expectedFriction = getExpectedCombinedValue(friction0, friction1, expectedSelectedCombineMode);

    const expectedFrictionForce = expectedFriction * dynamicRigidBody.mass * physics.PhysicsSystem.instance.gravity.y;
    const expectedResultVelocityX = initialVelocityX - Math.abs(expectedFrictionForce) / dynamicRigidBody.mass * simulationTimeLength;
    expect(expectedResultVelocityX).toBeGreaterThan(-1e-6);
    const actualVelocity = v3();
    dynamicRigidBody.getLinearVelocity(actualVelocity);
    expect(actualVelocity).toBeCloseToVec3(v3(
        expectedResultVelocityX,
        0.0,
        0.0,
    ), 3);
}

function testRestitutionCombineMode(
    env: PhysicsTestEnv,
    combineMode0: PhysicsMaterialCombineMode,
    restitution0: number,
    combineMode1: PhysicsMaterialCombineMode,
    restitution1: number,
) {
    /// Test thoughts:
    /// - Create a stationary rigid box, as ground.
    /// - Create a dynamic rigid sphere, as ball, disabling damping and angle velocity.
    /// - Create materials and set restitution and combine mode for them.
    /// - Let the ball fall on the ground once after some ticks.
    /// - Now it's easy to compute the about-to-bounce velocity.
    //  - After the bounce tick, check if the velocity is expected.

    const stationaryObject = new Node();
    env.rootNode.addChild(stationaryObject);
    fpx(stationaryObject.addComponent(RigidBody) as RigidBody, {
        type: ERigidBodyType.STATIC,
    });
    fpx(stationaryObject.addComponent(BoxCollider) as BoxCollider, {
        size: v3(1, 1, 1),
        material: fpx(new PhysicsMaterial(), {
            friction: 0,
            restitution: restitution0,
            restitutionCombineMode: combineMode0,
        }),
    });

    const dynamicObject = new Node();
    env.rootNode.addChild(dynamicObject);
    const dynamicRigidBody = fpx(dynamicObject.addComponent(RigidBody) as RigidBody, {
        type: ERigidBodyType.DYNAMIC,
        linearDamping: 0.0,
        angularDamping: 0.0,
        angularFactor: Vec3.ZERO,
    });
    fpx(dynamicObject.addComponent(SphereCollider) as SphereCollider, {
        radius: 1,
        material: fpx(new PhysicsMaterial(), {
            friction: 0,
            restitution: restitution1,
            restitutionCombineMode: combineMode1,
        }),
    });

    const FPS = 60;
    const step = 1 / FPS;
    const nFallingTicks = FPS;
    const g = physics.PhysicsSystem.instance.gravity.y;
    // An extra ticking time to prevent precision problem.
    const bounceTickLength = 0.3; // should be in interval (0, 1)
    const idealFallTimeBeforeBounce = step * (nFallingTicks + bounceTickLength);
    const idealTranslationYBeforeBounce = -g * (idealFallTimeBeforeBounce ** 2) / 2;

    const initialPosition = v3(0, 1 + 0.5 + idealTranslationYBeforeBounce, 0);
    dynamicObject.worldPosition = initialPosition;

    const onCollisionEnter = jest.fn();
    dynamicRigidBody.node.getComponent(Collider)?.on('onCollisionEnter', onCollisionEnter);

    // Falling.
    for (let i = 0; i < nFallingTicks; ++i) {
        director.tick(step);
    }
    expect(onCollisionEnter).not.toBeCalled();
    expect(getLinearVelocity(dynamicRigidBody)).toBeCloseToVec3(v3(
        0,
        g * (nFallingTicks * step),
        0,
    ), 4);

    // Contact and bounce tick.
    director.tick(step);
    // expect(onCollisionEnter).toBeCalled();
    const expectedSelectedCombineMode = getExpectedSelectedCombineMode(combineMode0, combineMode1);
    const expectedRestitution = getExpectedCombinedValue(restitution0, restitution1, expectedSelectedCombineMode);
    expect(getLinearVelocity(dynamicRigidBody)).toBeCloseToVec3(v3(
        0,
        -(g * (nFallingTicks + 1) * step * expectedRestitution),
        0,
    ), 4);
}

type NoneMethods<T> = {
    [x in keyof T]: T[x] extends Function ? never : x;
}[keyof T];

type PhysicsMaterialProperties = Pick<
    PhysicsMaterial,
    NoneMethods<Omit<PhysicsMaterial, keyof Asset | 'id'>>
>;

const allCombineModes = Object.values(PhysicsMaterialCombineMode).filter(
    (mode): mode is PhysicsMaterialCombineMode => typeof mode !== 'string',
) as readonly PhysicsMaterialCombineMode[];

const combineModePriority = [
    PhysicsMaterialCombineMode.MAX,
    PhysicsMaterialCombineMode.MULTIPLY,
    PhysicsMaterialCombineMode.MIN,
    PhysicsMaterialCombineMode.AVERAGE,
] as readonly PhysicsMaterialCombineMode[];

function getExpectedSelectedCombineMode(combineMode0: PhysicsMaterialCombineMode, combineMode1: PhysicsMaterialCombineMode) {
    const priority0 = combineModePriority.indexOf(combineMode0);
    const priority1 = combineModePriority.indexOf(combineMode1);
    expect(priority0).toBeGreaterThanOrEqual(0);
    expect(priority1).toBeGreaterThanOrEqual(0);
    return priority0 <= priority1 ? combineMode0 : combineMode1;
}

function getExpectedCombinedValue(value0: number, value1: number, combineMode: PhysicsMaterialCombineMode) {
    switch (combineMode) {
        case PhysicsMaterialCombineMode.MULTIPLY: return value0 * value1;
        case PhysicsMaterialCombineMode.MIN: return Math.min(value0, value1);
        case PhysicsMaterialCombineMode.MAX: return Math.max(value0, value1);
        case PhysicsMaterialCombineMode.AVERAGE: return (value0 + value1) / 2;
        default: return assertsUnreachable();
    }
}

const fpx: <T extends {}>(object: T, properties: Partial<Pick<T, NoneMethods<T>>>) => T = Object.assign;

function getLinearVelocity(rigidBody: RigidBody) {
    const result = v3();
    rigidBody.getLinearVelocity(result);
    return result;
}
