import * as pal from 'pal/pacer';

export class Pacer implements pal.Pacer {
    get targetFrameRate (): number {
        return 60;
    }

    set targetFrameRate (val: number) {
        // No-op
    }

    get onTick (): (() => void) | null {
        return this._onTick;
    }

    set onTick (val: (() => void) | null) {
        this._onTick = val;
    }

    start (): void {
        if (this._started) {
            return;
        }
        this._started = true;
        this._queueTick();
    }

    stop (): void {
        if (!this._started) {
            return;
        }
        this._started = false;
    }

    private _onTick: (() => void) | null = null;
    private _started = false;

    private _queueTick (): void {
        setTimeout(() => {
            this._tick();
        }, 0);
    }

    private _tick (): void {
        if (!this._started) {
            return;
        }
        this._onTick?.();
        this._queueTick();
    }
}
