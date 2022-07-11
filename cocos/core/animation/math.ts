import { Quat } from '../math';

const quatMultiInvInverseCache = new Quat();

/**
 * @returns `q1 * inv(q2)`
 */
export function quatMultiInv (out: Quat, q1: Quat, q2: Quat) {
    const q2Inv = Quat.invert(quatMultiInvInverseCache, q2);
    return Quat.multiply(out, q1, q2Inv);
}
