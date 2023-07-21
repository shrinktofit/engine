const { pathsToModuleNameMapper } = require('ts-jest/utils');
const ts = require('typescript');
const ps = require('path');
const tsConfig = ts.readConfigFile(ps.join(__dirname, 'tsconfig.json'), ts.sys.readFile);
if (!tsConfig.config) {
    throw new Error(`Failed to read tsconfig`);
}
const { compilerOptions } = tsConfig.config;
/** @type {import('@swc/core').Options} */
const swcOptions = {
    jsc: {
        parser: {
            syntax: 'typescript',
            decorators: true,
        },
        transform: {
            legacyDecorator: true,
        },
    },
};
module.exports = {
    testEnvironment: './tests/test-environment.ts',
    testRegex: '/tests/.*\\.(test|spec)?\\.(ts|tsx)$',
    moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: `${__dirname}/` }),
    transform: {
        "^.+\\.(t|j)sx?$": ["@swc/jest", swcOptions],
    },
    transformIgnorePatterns: [
        // ignore everything in the node_modules EXCEPT for:
        // - @cocos/dragonbones-js
        'node_modules/(?!(@cocos/dragonbones-js)/)',
        'native/external/emscripten/',
    ],
    setupFilesAfterEnv: [
        "./tests/setup-after-env.ts",
        "./tests/utils/log-capture-setup-after-env.ts"
    ],
    setupFiles: [
        './tests/init.ts',
    ],
    coverageDirectory: './test/report/',
    globals: {
        CC_DEV: true,
        CC_TEST: true,
        CC_PHYSICS_BUILTIN: true,
    }
};
