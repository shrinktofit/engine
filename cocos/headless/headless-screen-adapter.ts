import { IScreenOptions, SafeAreaEdge, screenAdapter as screenAdapterPal } from 'pal/screen-adapter';
import { Orientation, PalScreenEvent } from '../../pal/screen-adapter/enum-type';
import { Size } from '../core';

type ScreenAdapterType = typeof screenAdapterPal;

class ScreenAdapter implements ScreenAdapterType {
    public init (options: IScreenOptions, cbToRebuildFrameBuffer: () => void): void {

    }

    public isFrameRotated = false;

    public get isProportionalToFrame (): boolean {
        return this._isProportionalToFrame;
    }
    public set isProportionalToFrame (v: boolean) {
        this._isProportionalToFrame = v;
    }

    public handleResizeEvent = false;

    public get supportFullScreen (): boolean {
        return false;
    }

    public get isFullScreen (): boolean {
        return false;
    }

    public get devicePixelRatio (): number {
        return 1;
    }

    public get windowSize (): Size {
        return this._windowSize;
    }

    public set windowSize (size: Size) {
        this._windowSize.set(size);
        this._safeAreaEdge.bottom = size.height;
        this._safeAreaEdge.right = size.width;
    }

    public get resolution (): Size {
        return this._windowSize;
    }

    public get resolutionScale (): number {
        return this._resolutionScale;
    }

    public set resolutionScale (value: number) {
        this._resolutionScale = value;
    }

    public get orientation (): Orientation {
        return this._orientation;
    }

    public set orientation (value: Orientation) {
        this._orientation = value;
    }

    public get safeAreaEdge (): SafeAreaEdge {
        return this._safeAreaEdge;
    }

    public requestFullScreen (): Promise<void> {
        return Promise.reject(new Error('Method not implemented.'));
    }

    public exitFullScreen (): Promise<void> {
        return Promise.reject(new Error('Method not implemented.'));
    }

    on (event: PalScreenEvent, cb: (...args: any) => void, target?: any): void {
        // nope
    }

    once (event: PalScreenEvent, cb: (...args: any) => void, target?: any): void {
        // nope
    }

    off (event: PalScreenEvent, cb?: (...args: any) => void, target?: any): void {
        // nope
    }

    private _isProportionalToFrame = false;
    private _windowSize = new Size(640, 480);
    private _resolutionScale = 1;
    private _orientation = Orientation.PORTRAIT;
    private _safeAreaEdge: SafeAreaEdge = {
        top: 0,
        bottom: this._windowSize.height,
        left: 0,
        right: this._windowSize.width,
    };
}

export const screenAdapter = new ScreenAdapter();
