
import { property } from '../../cocos/core/data/class-decorator';
import { ccclass } from '../../cocos/core/data/decorators';
import { deserialize } from '../../cocos/core/data/deserialize';
import { onAfterDeserializedTag } from '../../cocos/core/data/deserialize-symbols';
import { unregisterClass } from '../../cocos/core/utils/js-typed';

describe('Deserialize', () => {
    test('Basic', () => {
        @ccclass('Foo') class Foo {
            @property public n = 1.0;
            @property public b = true;
            @property public s = 'foo';
            @property public nil = null;
            @property public emptyArray = [];
            @property public numericArray = [0.1, 0.2];
            @property public genericArray = [1, '2', { a: 3 }, [4, [5]], true, null];
            @property public arrayWithHoles = (() => { const arr = new Array(3); arr[1] = 1.0; return arr; })();
        }

        const classMap = { Foo };

        const serialized = [{
            __type__: 'Foo',
            n: 1.0,
            b: true,
            s: 'foo',
            nil: null,
            emptyArray: [],
            numericArray: [0.1, 0.2],
            genericArray: [1, '2', { a: 3 }, [4, [5]], true, null],
            arrayWithHoles: (() => { const arr = new Array(3); arr[1] = 1.0; return arr; })(),
        }];

        const deserialized: Foo = deserialize(serialized, undefined, {
            classFinder: (id: string) => {
                return classMap[id];
            },
        });

        expect(deserialized).toStrictEqual(new Foo());

        unregisterClass(Foo);
    });

    test('Object array element', () => {
        @ccclass('Foo') class Foo {  @property name: string = ''; }

        @ccclass('Bar') class Bar { @property array: Foo[] = []; @property mainFoo: Foo; }

        const classMap = { Foo, Bar};

        const serialized = [
            { __type__: 'Bar', array: [{ __id__: 1 }, {__id__: 2 }], mainFoo: { __id__: 1 }  },
            { __type__: 'Foo', name: 'foo1' },
            { __type__: 'Foo', name: 'foo2'},
        ];

        const deserialized: Bar = deserialize(serialized, undefined, {
            classFinder: (id: string) => {
                return classMap[id];
            },
        });

        expect(deserialized.array).toHaveLength(2);
        expect(deserialized.array[0]).toBeInstanceOf(Foo);
        expect(deserialized.array[0].name).toBe('foo1');
        expect(deserialized.array[1]).toBeInstanceOf(Foo);
        expect(deserialized.array[1].name).toBe('foo2');

        unregisterClass(Foo);
        unregisterClass(Bar);
    });

    test('Circular reference(self)', () => {
        @ccclass('Foo') class Foo { @property public foo: Foo; }

        const classMap = { Foo };

        const serialized = [
            { __type__: 'Foo', foo: { __id__: 0 } },
        ];

        const deserialized: Foo = deserialize(serialized, undefined, {
            classFinder: (id: string) => {
                return classMap[id];
            },
        });

        expect(deserialized.foo).toBe(deserialized);

        unregisterClass(Foo);
    });

    test('Circular reference(indirect)', () => {
        @ccclass('Foo') class Foo { @property public bar: Bar; }
        @ccclass('Bar') class Bar { @property public foo: Foo; }

        const classMap = { Foo, Bar };

        const serialized = [
            { __type__: 'Foo', bar: { __id__: 1 } },
            { __type__: 'Bar', foo: { __id__: 0 } },
        ];

        const deserialized: Foo = deserialize(serialized, undefined, {
            classFinder: (id: string) => {
                return classMap[id];
            },
        });

        expect(deserialized.bar.foo).toBe(deserialized);

        unregisterClass(Foo);
        unregisterClass(Bar);
    });

    test('Circular reference(indirect, array)', () => {
        @ccclass('Foo') class Foo { @property public bar: Bar; }
        @ccclass('Bar') class Bar { @property public fooArray: Foo[]; }

        const classMap = { Foo, Bar };

        const serialized = [
            { __type__: 'Foo', bar: { __id__: 1 } },
            { __type__: 'Bar', fooArray: [{ __id__: 0 }] },
        ];

        const deserialized: Foo = deserialize(serialized, undefined, {
            classFinder: (id: string) => {
                return classMap[id];
            },
        });

        expect(deserialized.bar.fooArray[0]).toBe(deserialized);

        unregisterClass(Foo);
        unregisterClass(Bar);
    });

    test('Circular reference(indirect, dictionary)', () => {
        // TODO
    });

    test('OnAfterDeserialized callback', () => {
        @ccclass('Foo') class Foo {
            public calledCount = 0;
            
            [onAfterDeserializedTag]() {
                ++this.calledCount;
            }
        }

        const classMap = { Foo };

        const serialized = [
            { __type__: 'Foo' },
        ];

        const deserialized: Foo = deserialize(serialized, undefined, {
            classFinder: (id: string) => {
                return classMap[id];
            },
        });

        expect(deserialized.calledCount).toBe(1);

        unregisterClass(Foo);
    });

    test('Order of [onAfterDeserializedTag]', () => {
        const orders: string[] = [];

        @ccclass('Foo') class Foo {
            @property name = '';
            @property foo: Bar;
            [onAfterDeserializedTag]() {
                orders.push(this.name);
            }
        }

        @ccclass('Bar') class Bar {
            @property name = '';
            [onAfterDeserializedTag]() {
                orders.push(this.name);
            }
        }

        const classMap = { Foo, Bar };

        const serialized = [
            { __type__: 'Foo', name: 'foo', foo: { __id__: 1 } },
            { __type__: 'Bar', name: 'bar' },
        ];

        deserialize(serialized, undefined, {
            classFinder: (id: string) => {
                return classMap[id];
            },
        });

        expect(orders).toBe(['bar', 'foo']);

        unregisterClass(Foo);
        unregisterClass(Bar);
    });
});
