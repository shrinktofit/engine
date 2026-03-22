import { AABB } from '../../core/geometry';
import type { Component } from '../component';

export interface BoundingComponent extends Component {
    /**
     * Returns the bounding box of the component, or `undefined` if the component has no bounding box.
     */
    [BoundingComponent.Tags.getBoundingBox](): AABB | undefined;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace BoundingComponent {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    export namespace Tags {
        export const getBoundingBox = Symbol('BoundingComponent.getBoundingBox');
    }

    export function is (component: Component): component is BoundingComponent {
        return BoundingComponent.Tags.getBoundingBox in component;
    }
}
