import 'jest';
import diff from 'jest-diff';
import { Vec3 } from '../../../cocos/core';

interface CustomMatchers<R = unknown> {
    toBeCloseToVec3(expected: Vec3, numDigits?: number): R;
}

declare global {
    namespace jest {
        interface Expect extends CustomMatchers {}
        interface Matchers<R> extends CustomMatchers<R> {}
        interface InverseAsymmetricMatchers extends CustomMatchers {}
    }
}

expect.extend({
    toBeCloseToVec3(received: any, expected: Vec3, numDigits = 5) {
        if (!received || typeof received !== 'object' ||
            typeof received.x !== 'number' || typeof received.y !== 'number' || typeof received.z !== 'number') {
            return {
                pass: false,
                message: () => this.utils.matcherHint('toBeCloseToVec3', undefined, undefined) + '\n\n' +
                    `Expected: ${this.utils.printExpected(expected)}\n` +
                    `Received: ${this.utils.printReceived(received)}`,
            };
        } else {
            const epsilon = 0.1 ** numDigits;
            const passed = Vec3.equals(received, expected, epsilon);
            const diffString = diff(
                expected.toString(numDigits),
                received.toString(numDigits),
                { expand: this.expand },
            );
            return {
                actual: received,
                message: () => this.utils.matcherHint('toBeCloseToVec3', undefined, undefined) + '\n\n' +
                    (diffString && diffString.includes('- Expect')
                        ? `Difference:\n\n${diffString}`
                        : `Expected: ${this.utils.printExpected(expected)}\n` +
                        `Received: ${this.utils.printReceived(received)}`
                    ),
                pass: passed,
            };
        }
    },
});