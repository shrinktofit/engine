import { join, normalize, relative, resolve } from 'node:path';
import { defineCommandModule } from './utils.ts';
import * as vite from 'vite';
import * as ccBuild from '@cocos/ccbuild';
import * as babel from '@babel/core';
import babelPluginTransformModulesSystemJS from '@babel/plugin-transform-modules-systemjs';
// @ts-expect-error
import babelPluginTransformDynamicImport from '@babel/plugin-transform-dynamic-import';
import fs from 'fs-extra';
import assert from 'node:assert';
import Ejs from 'ejs';

export default defineCommandModule({
  command: 'build',

  builder: (argv) => argv.options({
    out: {
      type: 'string',
      demandOption: true,
    },
  }),

  handler: async (argv) => {
    console.debug(`Build options: ${JSON.stringify(argv, undefined, 2)}`);
    const engineRepoPath = join(import.meta.dirname, '../../../');
    console.debug(`Engine repo path: ${engineRepoPath}`);

    const statsQuery = await ccBuild.StatsQuery.create(engineRepoPath);
    const mode = 'EDITOR';
    const platform = 'EDITOR' as ccBuild.Modularize.PlatformType;

    const features = Object.fromEntries(statsQuery.getFeatureUnits().map((featureUnit) => {
      return [featureUnit, statsQuery.getFeatureUnitFile(featureUnit)];
    }));
    console.debug(`Features: ${JSON.stringify(features, undefined, 2)}`);

    const flags: Record<string, boolean> = {};
    flags.DEBUG = true;
    const buildTimeConstants = statsQuery.constantManager.genBuildTimeConstants({
      mode,
      platform,
      flags,
    });

    const useStaticModuleOverrides: boolean = false;
    const staticModuleOverrides = useStaticModuleOverrides
      ? statsQuery.evaluateModuleOverrides({
          mode,
          platform,
          buildTimeConstants,
        })
      : {};

    const makeInternalConstantsModule = async () => {
      let code = '';
      code += statsQuery.constantManager.exportDynamicConstants({
        mode,
        platform,
        flags,
      });
      code += '\n';
      return code;
    };

    const output = await vite.build({
      build: {
        lib: {
          entry: {
            ...features,
          },
          formats: ['es'],
        },
        emptyOutDir: true,
        outDir: argv.out,
        sourcemap: true,
        minify: false,
        rollupOptions: {
          external: (id) => {
            if (id === 'cce:/internal/x/prerequisite-imports') {
              return true;
            }
            if (id.startsWith('external:')) {
              return true;
            }
          },
          output: {
            entryFileNames: `[format]/[name].js`,
            chunkFileNames: `[format]/_chunks/[name].js`,
            assetFileNames: `_assets/[name].[ext]`,
          },
        },
      },

      resolve: {
        alias: {
          'cc.decorator': resolve(engineRepoPath, 'cocos/core/data/decorators/index.ts'),
        },
      },

      plugins: [
        useStaticModuleOverrides
          ? overrideModules({
              overrides: staticModuleOverrides,
            })
          : dynamicOverrideModules(statsQuery),
        enginePlugin({ engineRepoPath }),
        provideInternalModules({
          memoryModules: {
            'internal:constants': async () => await makeInternalConstantsModule(),
          },
        }),
        reportStats(),
        outputSystemJS(),
      ],
    });
    void output;
  },
});

function enginePlugin({
  engineRepoPath,
}: { engineRepoPath: string }): vite.Plugin {
  return {
    name: 'engine-plugin',

    resolveId(id, parent) {
      if (id === '../settings.js' && parent && normalize(parent) === normalize(resolve(engineRepoPath, 'cocos/core/settings.ts'))) {
        return { id, external: true };
      }
    },
  };
}

function provideInternalModules({
  memoryModules,
}: {
  memoryModules: Record<string, () => Promise<string>>;
}): vite.Plugin {
  return {
    name: 'provide-internal-modules',

    resolveId(id) {
      if (id in memoryModules) {
        return id;
      }
    },

    async load(id) {
      if (id in memoryModules) {
        return {
          code: await memoryModules[id](),
        };
      }
    },
  };
}

function overrideModules({
  overrides,
}: {
  overrides: Record<string, string>;
}): vite.Plugin {
  return {
    name: 'override-modules',

    enforce: 'pre',

    async resolveId(id, a, opts) {
      if (id in overrides) {
        return overrides[id];
      }
      const resolved = await this.resolve(id, a, {
        ...opts,
        skipSelf: true,
      });
      if (resolved && !resolved.external) {
        const normalized = normalize(resolved.id);
        if (normalized in overrides) {
          return overrides[normalized];
        }
      }
      return resolved;
    },
  };
}

function dynamicOverrideModules(statsQuery: ccBuild.StatsQuery): vite.Plugin {
  const overrideMap: Record<string, {
    isVirtual: boolean;
    variants: Array<{
      condition: string;
      override: string;
    }>;
  }> = {};
  // @ts-expect-error
  const config = statsQuery._config as ccBuild.ConfigInterface.Config;
  if (config.moduleOverrides) {
    for (const moduleOverrideEntry of config.moduleOverrides) {
      for (const [k, v] of Object.entries(moduleOverrideEntry.overrides)) {
        const mId = moduleOverrideEntry.isVirtualModule ? k : resolve(statsQuery.path, k);
        let overrideInfo = overrideMap[mId];
        if (!overrideInfo) {
          overrideInfo = {
            isVirtual: moduleOverrideEntry.isVirtualModule,
            variants: [],
          };
          overrideMap[mId] = overrideInfo;
        }
        if (overrideInfo.isVirtual !== moduleOverrideEntry.isVirtualModule) {
          throw new Error(`Module ${mId} is declared as both virtual and non-virtual`);
        }
        overrideInfo.variants.push({
          condition: moduleOverrideEntry.test,
          override: resolve(statsQuery.path, v).replace(/\\/g, '/'),
        });
      }
    }
  }

  const prefix = `\0override:`;
  const realPrefix = `\0real:`;
  const contextModuleId = '\0__cc-module-override-context';

  for (const [k, m] of Object.entries(overrideMap)) {
    if (!m.isVirtual) {
      m.variants.push({
        condition: 'true',
        override: realPrefix + k.replace(/\\/g, '/'),
      });
    }
  }

  return {
    name: 'dynamic-override-modules',

    enforce: 'pre',

    async resolveId(id, a, opts) {
      if (id.startsWith(realPrefix)) {
        const realId = id.slice(realPrefix.length);
        return this.resolve(realId, a, {
          ...opts,
          skipSelf: true,
        });
      }
      if (id === contextModuleId) {
        return contextModuleId;
      }
      if (id in overrideMap) {
        return prefix + id;
      }
      const resolved = await this.resolve(id, a, {
        ...opts,
        skipSelf: true,
      });
      if (resolved && !resolved.external) {
        const normalized = normalize(resolved.id);
        if (normalized in overrideMap) {
          return prefix + normalized;
        }
      }
      return resolved;
    },

    async load(id, options) {
      if (id.startsWith(prefix)) {
        const k = id.slice(prefix.length);
        assert(k in overrideMap);
        const { variants } = overrideMap[k];
        let code = '';
        const proxyTemplate = await fs.readFile(join(import.meta.dirname, '../static/module-override-proxy.ts.ejs'), 'utf-8');
        code += Ejs.render(proxyTemplate, {
          alias: k,
          contextModuleId,
          variants: variants.map((v) => ({
            condition: v.condition || 'true',
            override: v.override,
          })),
        });
        code += '\n';
        return {
          code,
          syntheticNamedExports: '__synthetic',
        };
      }
      if (id === contextModuleId) {
        return {
          code: `export default globalThis.__getModuleOverrideContext__();`,
        };
      }
      return null;
    },
  };
}
function reportStats(): vite.Plugin {
  return {
    name: 'report-stats',

    enforce: 'post',

    async generateBundle(opts, bundle) {
      const externals = new Set<string>();
      for (const [_, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk') {
          for (const importModuleSpecifier of chunk.imports) {
            if (!bundle[importModuleSpecifier]) {
              externals.add(importModuleSpecifier);
            }
          }
          for (const importModuleSpecifier of chunk.dynamicImports) {
            if (!bundle[importModuleSpecifier]) {
              externals.add(importModuleSpecifier);
            }
          }
        }
      }
      console.debug(`(${externals.size}) externals:\n${[...externals].map((e, i) => `  [${i}] ${e}`).join('\n')}`);
    },
  };
}

async function outputSystemJS(): Promise<vite.Plugin> {
  const useProxy: boolean = true;
  const systemJSProxyTemplate = await fs.readFile(join(import.meta.dirname, '../static/systemjs-proxy.js.ejs'), 'utf-8');
  return {
    name: 'output-systemjs',

    enforce: 'post',

    async generateBundle(opts, bundle) {
      if (opts.format !== 'es') {
        return;
      }
      await Promise.all(Object.entries(bundle).map(async ([chunkName, chunk]) => {
        if (chunk.type !== 'chunk') {
          return;
        }

        assert(opts.dir);
        const chunkNameStripped = relative('esm', chunkName);
        const fileName = join(opts.dir, 'systemjs', `${chunkNameStripped}`);

        if (useProxy) {
          const code = Ejs.render(systemJSProxyTemplate, {
            target: '../' + chunkName,
            dependencies: [], // chunk.imports,
          });
          await fs.outputFile(fileName, code);
          return;
        }

        const result = await babel.transformAsync(chunk.code, {
          plugins: [
            [babelPluginTransformModulesSystemJS],
            [babelPluginTransformDynamicImport],
          ],
        });
        if (!result || !result.code) {
          return;
        }
        await fs.outputFile(fileName, result.code);
        if (result.map) {
          await fs.outputFile(`${fileName}.map`, JSON.stringify(result.map));
        }
      }));
    },
  };
}
