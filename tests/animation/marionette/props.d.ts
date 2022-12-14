
declare namespace JSX {
    interface Element {

    }

    interface ElementChildrenAttribute {
        __bogusChildren: any; // specify children name to use
    }

    interface ElementAttributesProperty {
        __bogusProps: any; // specify the property name to use
    }

    interface ElementClass {
        __bogusInstanceType: any; // specify the property name to use
    }
}