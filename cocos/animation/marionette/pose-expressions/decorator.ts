import { assertIsTrue, error, js } from '../../../core';
import { PoseExpr } from './pose-expr';

interface PoseInputMeta {
    displayName?: string;
}

type PoseInputMap = Record<string, Readonly<PoseInputMeta>>;

const poseInputRecordMap: WeakMap<Constructor<PoseExpr>, PoseInputMap> = new WeakMap();

export function poseInput ({
    displayName,
}: {
    displayName?: string;
}): PropertyDecorator {
    return (target, propertyKey) => {
        if (typeof propertyKey !== 'string') {
            error(`@poseInput can be only applied to string-named fields.`);
            return;
        }
        const targetConstructor = target.constructor;
        // @ts-expect-error
        if (!js.isChildClassOf<Constructor<PoseExpr>>(targetConstructor, PoseExpr)) {
            error(`@poseInput can be only applied to fields of subclasses of PoseExpr.`);
            return;
        }
        let record = poseInputRecordMap.get(targetConstructor);
        if (!record) {
            record = {};
            poseInputRecordMap.set(targetConstructor, record);
        }
        record[propertyKey] = Object.freeze({ displayName });
    };
}

export function getPoseInputFieldKeys (poseExpr: PoseExpr) {
    const record = getPoseInputRecord(poseExpr);
    return record ? Object.keys(record) : [];
}

export function getPoseInputFieldMeta (poseExpr: PoseExpr, key: string) {
    const record = getPoseInputRecord(poseExpr);
    return record?.[key];
}

export function hasPoseInputField (poseExpr: PoseExpr, key: string) {
    const record = poseInputRecordMap.get(poseExpr.constructor as Constructor<PoseExpr>);
    return !!record && (key in record);
}

export function getPoseInputField (poseExpr: PoseExpr, key: string) {
    if (!hasPoseInputField(poseExpr, key)) {
        return null;
    }
    return poseExpr[key] as PoseExpr | null | undefined ?? null;
}

export function setPoseInputField (poseExpr: PoseExpr, key: string, pose: PoseExpr | null) {
    assertIsTrue(hasPoseInputField(poseExpr, key));
    poseExpr[key] = pose;
}

function getPoseInputRecord (poseExpr: PoseExpr) {
    return poseInputRecordMap.get(poseExpr.constructor as Constructor<PoseExpr>);
}
