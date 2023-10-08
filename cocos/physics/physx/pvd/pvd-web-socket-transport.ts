import type { PxPvdTransportImpl } from './pvd';

export function createPvdWebSocketTransport(
    websocket: WebSocket,
): PxPvdTransportImpl {
    let written = 0;
    return {
        connect() {
            return websocket.readyState === WebSocket.OPEN;
        },

        disconnect() {
            websocket.close();
            written = 0;
        },

        isConnected() {
            return websocket.readyState === WebSocket.OPEN;
        },

        write(data) {
            if (websocket.readyState !== WebSocket.OPEN) {
                return false;
            }
            const copy = new Uint8Array(data.length);
            copy.set(data);
            websocket.send(copy);
            written += data.length;
            return true;
        },

        lock() { },

        unlock() { },

        flush() { },

        getWrittenDataSize() { return written; },

        release() { },
    };
}
