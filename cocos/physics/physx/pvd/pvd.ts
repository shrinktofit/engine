import { TEST } from 'internal:constants';
import { warn } from '../../../core';

export interface PxPvdTransportImpl {
    connect(): boolean;
    disconnect(): void;
    isConnected(): boolean;
    write(data: Uint8Array): boolean;
    lock(): void;
    unlock(): void;
    flush(): void;
    getWrittenDataSize(): number;
    release(): void;
}

let activatedPvdTransportImpl: PxPvdTransportImpl | undefined;

export function setActivatedPvdTransportImpl (impl: PxPvdTransportImpl | undefined): void {
    activatedPvdTransportImpl = impl;
}

export const SUPPORT_PX_PVD: boolean = TEST;

export function initializePvd (px: any, foundation: any): any {
    if (!testPvdFeatures(px)) {
        warn(`Current PhysX build does not contain PVD features.`);
        return null;
    }

    const pvdTransportImpl = activatedPvdTransportImpl;
    if (!pvdTransportImpl) {
        return null;
    }

    const {
        PxCreatePvd,
        PxPvdInstrumentationFlag,
        PxPvdInstrumentationFlags,
    } = px;

    const pvd = PxCreatePvd(foundation);
    const pvdTransport = px.PxPvdTransport.implement(pvdTransportImpl);
    pvd.connect(pvdTransport, new PxPvdInstrumentationFlags(PxPvdInstrumentationFlag.eALL.value));

    return pvd;
}

export function initializeScenePvd (px: any, scene: any): void {
    if (!testPvdFeatures(px)) {
        return;
    }

    const pvdClient = scene.getScenePvdClient();
    if (!pvdClient) {
        return;
    }

    const { PxPvdSceneFlag } = px;
    pvdClient.setScenePvdFlag(PxPvdSceneFlag.eTRANSMIT_CONSTRAINTS.value, true);
    pvdClient.setScenePvdFlag(PxPvdSceneFlag.eTRANSMIT_CONTACTS.value, true);
    pvdClient.setScenePvdFlag(PxPvdSceneFlag.eTRANSMIT_SCENEQUERIES.value, true);
}

function testPvdFeatures (px: any): boolean {
    return !!px.PX_WEB_BINDINGS_PVD;
}
