import { poseGraphOp } from '../../../../../../cocos/animation/marionette/asset-creation';
import { PoseNodeTwoBoneIKSolver, TargetSpecificationType } from '../../../../../../cocos/animation/marionette/pose-graph/pose-nodes/ik/two-bone-ik-solver';
import { Vec3 } from '../../../../../../cocos/core';
import { Node } from '../../../../../../exports/base';
import { AnimationGraphEvalMock } from '../../../utils/eval-mock';
import { createAnimationGraph } from '../../../utils/factory';
import '../../../../../utils/matchers/value-type-asymmetric-matchers';
import { getMagicSeed, PseudoRandomGenerator } from '../../../../../utils/random';

describe(`Error-formed`, () => {
    test.todo(`End effector not specified`);
    
    describe(`Failed to bind bones`, () => {
        test.todo(`Failed to bind end effector bone`);

        test.todo(`Failed to bind middle bone`);

        test.todo(`Failed to bind root bone`);
    });

    test.todo(`Input not specified`);

    test.todo(`Evaluate in skeletal space`);

    describe(`End effector target`, () => {
        test.todo(`End effector target bone is not specified`);

        test.todo(`End effector target bone is specified but invalid`);

        test.todo(`End effector target bone is specified and valid`);
    });
});

describe(`A,B,T could not form a triangle`, () => {
    describe(`Zero segment length`, () => {
        test(`Both two segments has zero length(the bones are overlapped)`, () => {
            const pA = new Vec3(1, 2, 3);
            const pT = new Vec3(0.618, -3.14, 10.86);
            const solved = doSolve(
                pA,
                pA,
                pA,
                pT,
                undefined,
            );
            expect(solved.middle.position).toBeCloseToVec3(pA);
            expect(solved.endEffector.position).toBeCloseToVec3(pA);
        });

        describe(`Either the segment has zero length`, () => {
            const pA = new Vec3(1, 2, 3);
            const pC = new Vec3(0.618, -3.14, 10.86);
            const tDirFromA = Object.freeze(Vec3.subtract(new Vec3(), new Vec3(7, 8, -9), pA).normalize());
    
            test(`len(AB) is zero`, () => {
                const solveAtChainLengthMultiplier = (multiplier: number) => {
                    const pT = Vec3.scaleAndAdd(new Vec3(), pA, tDirFromA, Vec3.distance(pA, pC) * multiplier);
                    const solved = doSolve(pA, pA, pC, pT, undefined);
                    expect(solved.middle.position).toBeCloseToVec3(pA);
                    expect(solved.endEffector.position).toBeCloseToVec3(Vec3.scaleAndAdd(new Vec3(), pA, tDirFromA, Vec3.distance(pA, pC)));
                };

                solveAtChainLengthMultiplier(1.2);
                solveAtChainLengthMultiplier(0.7);
            });
    
            test(`len(BC) are overlapped`, () => {
                const solveAtChainLengthMultiplier = (multiplier: number) => {
                    const pT = Vec3.scaleAndAdd(new Vec3(), pA, tDirFromA, Vec3.distance(pA, pC) * multiplier);
                    const solved = doSolve(pA, pC, pC, pT, undefined);
                    expect(solved.endEffector.position).toBeCloseToVec3(Vec3.scaleAndAdd(new Vec3(), pA, tDirFromA, Vec3.distance(pA, pC)));
                    expect(solved.middle.position).toBeCloseToVec3(solved.endEffector.position);
                };

                solveAtChainLengthMultiplier(1.2);
                solveAtChainLengthMultiplier(0.7);
            });
        });
    });

    describe(`All sides are not zero, but could not form a triangle`, () => {
        const g = new PseudoRandomGenerator(getMagicSeed());

        const sl0 = g.positive();
        const sl1 = g.positive();
        const sl2 = sl0 + sl1 + g.positive();
        const vertexA = Object.freeze(new Vec3(g.finite(), g.finite(), g.finite()));
        const dirAB = Object.freeze(Vec3.normalize(new Vec3(), new Vec3(g.normalized(), g.normalized(), g.normalized())));
        const dirBC = Object.freeze(Vec3.normalize(new Vec3(), new Vec3(g.normalized(), g.normalized(), g.normalized())));
        const dirAT = Object.freeze(Vec3.normalize(new Vec3(), new Vec3(g.normalized(), g.normalized(), g.normalized())));

        test.each([
            //          a      b     c
            [`a+b<c`, sl0, sl1, sl2],
            [`a+c<b`, sl0, sl2, sl1],
            [`b+c<a`, sl2, sl0, sl1],
        ])(`%s`, (_, lenAB_, lenBC, lenAT_) => {
            const solve = (lenAB: number, lenAT: number) => {
                const vertexB = Vec3.scaleAndAdd(new Vec3(), vertexA, dirAB, lenAB);

                const solved = doSolve(
                    vertexA,
                    vertexB,
                    Vec3.scaleAndAdd(new Vec3(), vertexB, dirBC, lenBC),
    
                    Vec3.scaleAndAdd(new Vec3(), vertexA, dirAT, lenAT),
                    undefined,
                );
    
                expect(Vec3.normalize(new Vec3(), Vec3.subtract(new Vec3(), solved.middle.position, vertexA))).toBeCloseToVec3(dirAT);
                const dirMiddleEndSolved = lenAB < lenAT ? 1 : -1;
                expect(Vec3.normalize(new Vec3(), Vec3.subtract(new Vec3(), solved.endEffector.position, solved.middle.position)))
                    .toBeCloseToVec3(Vec3.multiplyScalar(new Vec3(), dirAT, dirMiddleEndSolved));
            };

            solve(lenAB_, lenAT_);
            solve(lenAT_, lenAB_);
        });

        test(`Bugfix`, () => {
            const result = doSolve(
                new Vec3(-0.09242249791874639, 0.7809744197151507, 0.0440291647921393),
                new Vec3(-0.2202181390043632, 0.6506767191347834, 0.49891323892477991),
                new Vec3(-0.10022652110916505, 0.7346849221083793, 0.12458274852241735),
                new Vec3(-0.09780396078888308, 0.7339540517872343, 0.11183048623975389),
                new Vec3(-0.2202181390043632, 0.6506767191347834, 0.4989132389247799),
            );
            expect(result.endEffector.position).toBeCloseToVec3(
                new Vec3(-0.09816044416293312, 0.7308392891636664, 0.11632183820444486));
            expect(result.middle.position).toBeCloseToVec3(
                new Vec3(-0.12432196250955035, 0.5022538193953633, 0.4459321240655465));
        })
    });

    describe(`AB is colinear with BT`, () => {
        const coDir = Object.freeze(Vec3.normalize(new Vec3(), new Vec3(1, -1, 2)));
        const pA = new Vec3(1, 2, 3);
        const dAB = 0.4;
        const dBC = 1.2;
        const pB = Vec3.scaleAndAdd(new Vec3(), pA, coDir, dAB);
        const pC = Vec3.scaleAndAdd(new Vec3(), pB, coDir, dBC);
        const solveAtDistanceFromB = (distance: number) => doSolve(
            pA,
            pB,
            pC,
            Vec3.scaleAndAdd(new Vec3(), pB, coDir, distance),
            undefined,
        );
        describe(`Same direction`, () => {
            test(`Longer than chain length`, () => {
                const result = solveAtDistanceFromB(dBC * 1.2);
                expect(result.endEffector.position).toBeCloseToVec3(pC);
            });
            test(`Shorter than chain length`, () => {
                const result = solveAtDistanceFromB(dBC * 0.7);
                expect(result.endEffector.position).toBeCloseToVec3(pC);
            });
        });
        test(`Opposite direction`, () => {
            const coDir = Object.freeze(Vec3.normalize(new Vec3(), new Vec3(0.14195054214877403, 0.063693107343907707, -0.98782246970827026)));
            const pA = new Vec3(9.0057184766238798, -2.5299869030302879, 95.299290089180317);
            const dAB = 42.5720367;
            const dBC = 40.1966896;
            // const dAB = 0.4;
            // const dBC = 1.2;
            // const dAB = 42.5720367;
            // const dBC = 1.2;
            const result = doSolve(
                pA,
                Vec3.scaleAndAdd(new Vec3(), pA, coDir, dAB),
                Vec3.scaleAndAdd(new Vec3(), pA, coDir, dAB + dBC),
                // Vec3.scaleAndAdd(new Vec3(), pA, coDir, dAB + -0.3),
                Vec3.scaleAndAdd(new Vec3(), pA, coDir, (dAB - dBC) * 0.5),
                undefined,
            );
        });
    });
});

test.skip(`Edge case: target is almost Infinity from bones`, () => {
    const result = doSolve(
        new Vec3(-0.21317485899373015, 1.3981241276020546, -0.06900958751340587),
        new Vec3(-0.25255526992058713, 1.122513395181039, -0.07067335755206586),
        new Vec3(-0.30032509088559695, 0.8525761352143646, 0.000768669924157972),
        new Vec3(-2.7378717978901504e+270, 8.311351261877791e+270, 2.751998222735035e+269),
        undefined,
    );
    // TODO: what do we expect?
});

function doSolve(
    root: Readonly<Vec3>,
    middle: Readonly<Vec3>,
    endEffector: Readonly<Vec3>,
    endEffectorTargetPosition: Readonly<Vec3> | undefined,
    poleTargetPosition: Readonly<Vec3> | undefined,
): {
    middle: {
        position: Readonly<Vec3>;
    };
    endEffector: {
        position: Readonly<Vec3>;
    };
} {
    const d_root_middle = Vec3.distance(root, middle);
    const d_middle_endEffector = Vec3.distance(middle, endEffector);

    const animationGraph = createAnimationGraph({
        layers: [{
            stateMachine: {
                entryTransitions: [{ to: 'p' }],
                states: { 'p': { type: 'procedural', graph: (poseGraph) => {
                    const node = poseGraph.addNode(new PoseNodeTwoBoneIKSolver());
                    node.endEffectorBoneName = 'EndEffector';
                    if (!endEffectorTargetPosition) {
                        node.endEffectorTarget.type = TargetSpecificationType.NONE;
                    } else {
                        node.endEffectorTarget.type = TargetSpecificationType.VALUE;
                        Vec3.copy(node.endEffectorTarget.targetPosition, endEffectorTargetPosition);
                    }
                    if (!poleTargetPosition) {
                        node.poleTarget.type = TargetSpecificationType.NONE;
                    } else {
                        node.poleTarget.type = TargetSpecificationType.VALUE;
                        Vec3.copy(node.poleTarget.targetPosition, poleTargetPosition);
                    }
                    poseGraphOp.connectOutputNode(poseGraph, node);
                } } },
            },
        }],
    });

    const origin = new Node();
    const rootNode = new Node(`Root`);
    rootNode.parent = origin;
    const middleNode = new Node(`Middle`);
    middleNode.parent = rootNode;
    const endEffectorNode = new Node(`EndEffector`);
    endEffectorNode.parent = middleNode;

    rootNode.worldPosition = root;
    middleNode.worldPosition = middle;
    endEffectorNode.worldPosition = endEffector;

    const evalMock = new AnimationGraphEvalMock(origin, animationGraph);
    evalMock.step(0.1);

    // Root position shall not change.
    expect(rootNode.worldPosition).toStrictEqual(expect.objectContaining({
        x: root.x,
        y: root.y,
        z: root.z,
    }));
    // Chain segment lengths shall not change.
    expect(Vec3.distance(rootNode.worldPosition, middleNode.worldPosition)).toBeCloseTo(d_root_middle, 5);
    expect(Vec3.distance(middleNode.worldPosition, endEffectorNode.worldPosition)).toBeCloseTo(d_middle_endEffector, 5);

    return {
        middle: { position: middleNode.worldPosition },
        endEffector: { position: endEffectorNode.worldPosition },
    };
}
