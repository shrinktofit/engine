export const deviceManager = {
    get gfxDevice() {
        throw new Error('GFX device is not supported in headless mode');
    },

    init() {
        return Promise.resolve();
    }
};

export { LegacyRenderMode } from './legacy-render-mode';
