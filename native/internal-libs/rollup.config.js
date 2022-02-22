import ts from 'rollup-plugin-typescript2';
import ps from 'path';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

export default [{
    external: ['internal_bindings_namespace'],
    plugins: [
        ts({ tsconfig: ps.join(__dirname, './first-loader/tsconfig.json') }),
    ],
    input: ps.join(__dirname, './first-loader/index.ts'),
    output: [{
        format: 'iife',
        globals: {
            'internal_bindings_namespace': 'internalBindings',
        },
        file: ps.join(__dirname, 'lib', 'first-loader.js'),
    }],
}, {
    input: ps.join(__dirname, './external/url.js'),
    output: [{
        format: 'esm',
        file: ps.join(__dirname, 'lib', 'third-party', 'url.js'),
    }],
    plugins: [
        json(),
        commonjs(),
        resolve({
            preferBuiltins: false,
        }),
    ],
}];