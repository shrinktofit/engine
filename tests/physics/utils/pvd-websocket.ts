import ws from 'websocket';

export async function openPvdWebsocket(pvdWsURL: string = 'ws://127.0.0.1:5426') {
    const pvdWs = new ws.w3cwebsocket(pvdWsURL);
    pvdWs.binaryType = 'arraybuffer';
    await new Promise<void>((resolve, reject) => {
        pvdWs.onopen = () => {
            resolve();
        };
        pvdWs.onerror = (event) => {
            reject(event);
        };
        pvdWs.onclose = () => {
            reject();
        };
    });
    return pvdWs as WebSocket;
}
