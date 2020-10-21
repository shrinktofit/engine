import { CCConfig, CCConfigFn } from '../@types/cc-config';
import * as babel from '@babel/core';
import babelPresetEnv from '@babel/preset-env';
import type { Options as BabelPresetEnvOptions } from '@babel/preset-env';
import fs from 'fs-extra';
import ps from 'path';
import vm from 'vm';
import Module from 'module';

export async function createConfigGenerator (engine: string) {
    const ccConfigFile = ps.join(engine, 'cc.config.js');

    const code = (await babel.transformFileAsync(ccConfigFile, {
        presets: [ [babelPresetEnv, {
            modules: 'cjs'
        } as BabelPresetEnvOptions] ],
    }))?.code;
    if (!code) {
        throw new Error(`Failed to get ccconfig.`);
    }

    const fileName = ps.normalize(ccConfigFile);

    const script = new vm.Script(Module.wrap(code), {
        filename: fileName,
    });

    const module: { exports: { default?: CCConfigFn } } = { exports: {} };

    // script.runInContext(vm.createContext())(
    script.runInThisContext()(
        module.exports,
        (Module.createRequire ?? Module.createRequireFromPath)(fileName),
        module,
        fileName,
        ps.dirname(fileName),
    );

    
    if (typeof module.exports.default !== 'function') {
        throw new Error(`Bad config file!`);
    }

    return module.exports.default;
}
