export enum LegacyRenderMode {
    /**
     * @en
     * Automatically chosen by engine.
     * @zh
     * 通过引擎自动选择。
     */
    AUTO = 0,
    /**
     * @en
     * Forced to use canvas renderer.
     * @zh
     * 强制使用 canvas 渲染。
     */
    CANVAS = 1,
    /**
     * @en
     * Forced to use WebGL renderer, but this will be ignored on mobile browsers.
     * @zh
     * 强制使用 WebGL 渲染，但是在部分 Android 浏览器中这个选项会被忽略。
     */
    WEBGL = 2,
    /**
     * @en
     * Use Headless Renderer, which is useful in test or server env, only for internal use by cocos team for now
     * @zh
     * 使用空渲染器，可以用于测试和服务器端环境，目前暂时用于 Cocos 内部测试使用。
     */
    HEADLESS = 3,
    /**
     * @en
     * Force WebGPU rendering, but this option will be ignored in some browsers.
     * @zh
     * 强制使用 WebGPU 渲染，但是在部分浏览器中这个选项会被忽略。
     */
    WEBGPU = 4,
}
