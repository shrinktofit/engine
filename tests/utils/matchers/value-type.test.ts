import { Vec3 } from "../../../cocos/core";
import './value-type';

test('Value type matchers', () => {
    expect(undefined).not.toBeCloseToVec3(Vec3.ZERO);
    expect(null).not.toBeCloseToVec3(Vec3.ZERO);
    expect('').not.toBeCloseToVec3(Vec3.ZERO);
    expect(true).not.toBeCloseToVec3(Vec3.ZERO);
    expect(6).not.toBeCloseToVec3(Vec3.ZERO);
    expect(new Vec3(0.001, 0.001, 0.001)).toBeCloseToVec3(new Vec3(0.001, 0.001, 0.001), 2);
    expect(new Vec3(0.01, 0.01, 0.01)).toBeCloseToVec3(Vec3.ZERO, 2);
});