import net from 'net';
import { PxPvdTransportImpl } from '../../../cocos/physics/physx/pvd/pvd';

export async function createPvdNodeSocketTransport(
    port: number = 5425,
): Promise<PxPvdTransportImpl> {
    let socket: net.Socket;
    try {
        await new Promise<void>((resolve, reject) => {
            socket = net.createConnection({
                port,
                host: '127.0.0.1',
            });
            socket.on('error', reject)
            socket.connect({ port }, () => {
                resolve();
            });
        });
    } catch (err) {
        console.error(err);
    }

    let written = 0;
    return {
        connect() {
            return socket.readyState === 'open';
        },

        disconnect() {
            socket.destroy();
            written = 0;
        },

        isConnected() {
            return !!(socket?.connecting);
        },

        write(data) {
            if (!socket) {
                return false;
            }
            const copy = new Uint8Array(data.length);
            copy.set(data);
            socket.write(copy);
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
