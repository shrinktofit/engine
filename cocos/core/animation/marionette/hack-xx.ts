import { RealTrack } from '../tracks/real-track';
import { MotionState } from './motion-state';

const motionStateStack: string[] = [];

export function pushMotionStateName (name: string) {
    motionStateStack.push(name);
}

export function popMotionStateName () {
    motionStateStack.pop();
}

export function getHackNamedTracks (): RealTrack[] {
    if (motionStateStack.length === 0) {
        return [];
    }
    const topMotionStateName = motionStateStack[motionStateStack.length - 1];
    const tracks: RealTrack[] = [];
    // eslint-disable-next-line no-cond-assign
    for (let regex = /\(#(\w+):(\d+)\)/g, match: RegExpMatchArray | null = null; (match = regex.exec(topMotionStateName)) !== null;) {
        const curveName = match[1];
        const curveValue = parseFloat(match[2]);
        const track = new RealTrack();
        track.path.toNamedCurve(curveName);
        track.channel.curve.assignSorted([[0.0, curveValue]]);
        tracks.push(track);
    }
    return tracks;
}

export function parseModifyCurveState (state: MotionState): null | {
    name: string;
    curves: Record<string, number>;
    __original: MotionState;
} {
    const regex1 = /.*#ModifyCurve(\(.*\))$/;
    const matches = regex1.exec(state.name);
    if (!matches) {
        return null;
    }
    const spec = matches[1];
    const curves: Record<string, number> = {};
    // eslint-disable-next-line no-cond-assign
    for (let regex = /\(#(\w+):(\d+)\)/g, match: RegExpMatchArray | null = null; (match = regex.exec(spec)) !== null;) {
        const curveName = match[1];
        const curveValue = parseFloat(match[2]);
        curves[curveName] = curveValue;
    }
    return {
        name: state.name,
        curves,
        __original: state,
    };
}
