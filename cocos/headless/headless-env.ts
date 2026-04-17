import * as pal from 'pal/env';

class Canvas {
    width = 0;
    height = 0;
}

class Adapter {
    get canvas (): Canvas {
        return this._canvas;
    }

    get frame (): unknown {
        return undefined;
    }

    get container (): unknown {
        return undefined;
    }

    private _canvas = new Canvas();
}

let adapter: Adapter | null = null;

export const findCanvas: typeof pal.findCanvas = () => {
    if (!adapter) {
        adapter = new Adapter();
    }
    return adapter as unknown as ReturnType<typeof pal.findCanvas>;
};

export function loadJsFile (): Promise<void> {
    return Promise.reject(new Error('loadJsFile not implemented'));
}
