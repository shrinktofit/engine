import { BrowserType, Feature, Language, NetworkType, OS, PalSystemEvent, Platform } from '../../pal/system-info/enum-type';

export const systemInfo: typeof import('pal/system-info')['systemInfo'] = {
    networkType: NetworkType.NONE,
    isNative: false,
    isBrowser: false,
    isMobile: false,
    isLittleEndian: false,
    platform: Platform.UNKNOWN,
    language: Language.UNKNOWN,
    nativeLanguage: '',
    os: OS.UNKNOWN,
    osVersion: '',
    osMainVersion: 0,
    browserType: BrowserType.UNKNOWN,
    browserVersion: '',
    isXR: false,
    init (): Promise<void[]> {
        return Promise.resolve([]);
    },
    hasFeature (feature: Feature): boolean {
        return false;
    },
    getBatteryLevel (): number {
        return 0;
    },
    triggerGC (): void {
        // nope
    },
    openURL (url: string): void {
        // nope
    },
    now (): number {
        return Date.now();
    },
    restartJSVM (): void {
        // nope
    },
    close (): void {
        // nope
    },
    exit (): void {
        // nope
    },
    on (event: PalSystemEvent, cb: (...args: any) => void, target?: any): void {
        // nope
    },
    off (event: PalSystemEvent, cb?: (...args: any) => void, target?: any): void {
        // nope
    },
};
