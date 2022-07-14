import { Quat } from '../math';

const quatMultiInvInverseCache = new Quat();

/**
 * @returns `q1 * inv(q2)`
 */
function quatMultiInv (out: Quat, q1: Quat, q2: Quat) {
    const q2Inv = Quat.invert(quatMultiInvInverseCache, q2);
    return Quat.multiply(out, q2Inv, q1);
}

/**
 * Calculates the delta(relative) rotations between two rotations represented by quaternions.
 * @param out
 * @param from
 * @param to
 */
export function deltaQuat (out: Quat, from: Quat, to: Quat) {
    return quatMultiInv(
        out,
        to,
        from,
    );
}
