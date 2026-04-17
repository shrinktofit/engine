const { join } = require('path');
const { ensureDir, emptyDir, outputFile } = require('fs-extra');
const { magenta } = require('chalk');

const { buildEngine, StatsQuery } = require('@cocos/ccbuild');

const prefix = ''.padStart(20, '=');
console.log(magenta(`${prefix} Build H5 source ${prefix}`));

const min = process.argv.includes('--min');

(async function exec () {
    const outDir = join(__dirname, '..', 'bin', 'dev', 'headless', min ? 'min' : 'debug');
    await ensureDir(outDir);
    await emptyDir(outDir);

    await buildEngine({
        engine: join(__dirname, '..'),
        moduleFormat: 'esm',
        mode: 'BUILD',
        platform: 'HEADLESS',
        out: outDir,
        compress: min,
        sourceMap: true,
        split: true,
        targets: ['chrome 80'],
        features: [
            'headless-core',
        ],
        noDeprecatedFeatures: true,
    });

    const statsQuery = await StatsQuery.create(join(__dirname, '..'));
    const mode = 'HEADLESS';
    const platform = 'HEADLESS';
    const flags = {
        DEBUG: true,
    };
    const ccEnvSource = statsQuery.constantManager.exportStaticConstants({
        mode,
        platform,
        flags,
    });
    const ccEnvFile = join(outDir, 'cc-env.js');
    await outputFile(ccEnvFile, ccEnvSource);
}()).catch(console.error.bind(console));
