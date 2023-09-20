export function createPvd (
    px: any,
    foundation: any,
    pvdWebSocket?: WebSocket,
): any {
    const {
        PxCreatePvd,
        PxPvdWebSocketTransportCreate,
        PxPvdInstrumentationFlag,
        PxPvdInstrumentationFlags,
    } = px;

    const pvd = PxCreatePvd(foundation);

    if (pvdWebSocket) {
        const transport = PxPvdWebSocketTransportCreate(pvdWebSocket);
        pvd.connect(transport, new PxPvdInstrumentationFlags(PxPvdInstrumentationFlag.eALL.value));
    }

    return pvd;
}

export function setupScenePvd (
    px: any,
    scene: any,
): void {
    const { PxPvdSceneFlag } = px;
    const pvdClient = scene.getScenePvdClient();
    if (!pvdClient) {
        return;
    }
    pvdClient.setScenePvdFlag(PxPvdSceneFlag.eTRANSMIT_CONSTRAINTS.value, true);
    pvdClient.setScenePvdFlag(PxPvdSceneFlag.eTRANSMIT_CONTACTS.value, true);
    pvdClient.setScenePvdFlag(PxPvdSceneFlag.eTRANSMIT_SCENEQUERIES.value, true);
}
