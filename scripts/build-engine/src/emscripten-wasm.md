
It may be valuable to understand how Emscripen generated WebAssembly modules(EWM) are
integrated into Cocos Creator engine.

## Problem Statement

EWM(s) by nature are designed as asynchronized. To use exports of an EWM,
you're required to wait for its initialization:

```ts
import Ammo from '@cocos/ammo';

const v1 = new Ammo.Vec3(); // Error: Ammo.Vec3 is not defined!
Ammo.then(() => {
    const v2 = new Ammo.Vec3(); // Ok
});
```

With the stage 3 proposal "top level await", we may got a simple statement in this module like:

```ts
await new Promise((resolve) => Ammo.then(() => resolve()));
const v = new Ammo.Vec3(); // Ok
```

It guarantees the awaited promise is resolved before the remain module execution.

But this technique is rarely implemented for now and can not be implemented in CommonJS. As SystemJS, which declaims "top level wait" is supported.
It relies the `async` syntax to be supported on destination platform because [@babel/plugin-transform-modules-systemjs](https://babeljs.io/docs/en/babel-plugin-transform-modules-systemjs) generates async function.
Even if the assumption "WebAssembly implies async functions" holds but we still don't want to maintain two copies version source codes.

## Our solution

The solution is based on:

1. "top level await" **semantic** is allowed in SystemJS;

2. SystemJS module fetching can be hook-able and promisified.

For any EWM with unique name `'<ewm>'`, we generated the following helper modules.

The real content of `'<ewm>'` to be exposed:

```ts
import { promise } from '<async-ewm>';

let resolved = await promise;

export { resolved as default };
```
which is equivalent to, but **manually** written in:

```ts
System.register(['<async-ewm>'], (_export) => {
    let promise;
    return {
        execute: () => Promise.resolve(promise),
        setters: [
            (_asyncEwm) => Promise.resolve(promise).then(
                (resolved) => _export("default", resolved))
        ],
    };
});
```

The `<async-ewm>`:

```ts
export const default =
    /* promise for get '<ewm>' initialization */;
```

