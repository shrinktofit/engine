
import { Mesh, SubMesh, VertexAttributeVec3View, VertexAttributeVec4View, VertexAttributeView } from '../../cocos/3d/assets/mesh';
import { gfx, Vec3 } from '../../cocos/core';
import { Color } from '../../cocos/core/gfx';

describe('Mesh', () => {
    describe('Attribute view', () => {
        const subMesh = new SubMesh();
        subMesh.rearrange({
            streams: [{
                attributes: [{
                    name: gfx.AttributeName.ATTR_POSITION,
                    format: gfx.Format.RGB32F,
                }, {
                    name: gfx.AttributeName.ATTR_NORMAL,
                    format: gfx.Format.RGB32F,
                }],
            }, {
                attributes: [{
                    name: gfx.AttributeName.ATTR_COLOR,
                    format: gfx.Format.RGBA32F,
                }],
            }],
        }, 3);

        expect(subMesh.vertexCount).toBe(3);
        expect(subMesh.hasAttribute(gfx.AttributeName.ATTR_POSITION));
        expect(subMesh.hasAttribute(gfx.AttributeName.ATTR_NORMAL));
        expect(subMesh.hasAttribute(gfx.AttributeName.ATTR_COLOR));

        test.each([
            {
                title: 'interleaved',
                attributeName: gfx.AttributeName.ATTR_NORMAL,
                expectedComponentCount: 3,
            },
            {
                title: 'compact',
                attributeName: gfx.AttributeName.ATTR_COLOR,
                expectedComponentCount: 4,
            },
        ])('View on $title attribute', ({ attributeName, expectedComponentCount }) => {
            const view = subMesh.viewAttribute(attributeName);

            expect(view.vertexCount).toBe(subMesh.vertexCount);
            expect(view.componentCount).toBe(expectedComponentCount);
    
            // Set 3rd vertex's y component to 0.1 
            view.setComponent(2, 1, 0.1);
            expect(view.getComponent(2, 1)).toBeCloseTo(0.1);
    
            // Copy 3rd vertex's value into 2nd vertex
            view.set(view.subarray(2), 1);
            for (let i = 0; i < view.componentCount; ++i) {
                expect(view.getComponent(2, i)).toBe(view.getComponent(1, i));
            }
    
            // Read all vertices' normal
            const normals = view.read() as Float32Array;
            expect(normals).toBeInstanceOf(Float32Array);
            expect(normals).toHaveLength(view.componentCount * view.vertexCount);
            for (let iVertex = 0; iVertex < view.vertexCount; ++iVertex) {
                for (let iComponent = 0; iComponent < view.componentCount; ++iComponent) {
                    expect(view.getComponent(iVertex, iComponent)).toBe(normals[view.componentCount * iVertex + iComponent]);
                }
            }
    
            // Read only two vertices' normal
            const normals2 = view.read(2);
            expect(normals2).toBeInstanceOf(Float32Array);
            expect(normals2).toHaveLength(view.componentCount * 2);
            for (let iVertex = 0; iVertex < 2; ++iVertex) {
                for (let iComponent = 0; iComponent < view.componentCount; ++iComponent) {
                    expect(view.getComponent(iVertex, iComponent)).toBe(normals[view.componentCount * iVertex + iComponent]);
                }
            }
    
            // Read 3(all) vertices' normal and store by your preferred array constructor
            const normals3 = view.read(3, Float64Array);
            // Read all vertices' normal into specified array(and optionally specify a count)
            const normals4 = view.read(new Float32Array(3 * 3), 3);
        });

        test('Vec3 view', () => {
            // Operates on whole attribute
            const normalViewVec3 = new VertexAttributeVec3View(subMesh.viewAttribute(gfx.AttributeName.ATTR_NORMAL));
            // Set 2nd vertex's value to (0.0, 1.0, 0.0)
            normalViewVec3.set(1, new Vec3(0.0, 1.0, 0.0));
            expect(normalViewVec3.get(1, new Vec3())).toStrictEqual(new Vec3(0.0, 1.0, 0.0));
        });

        test('Vec4 view', () => {
            // Operates in Color(Vec4)
            const colorView = new VertexAttributeVec4View(subMesh.viewAttribute(gfx.AttributeName.ATTR_COLOR));
            colorView.set(1, new Color(0.1, 0.2, 0.3, 0.4));
            expect(colorView.get(1, new Color())).toStrictEqual(new Color(0.1, 0.2, 0.3, 0.4));
        });
    });
});