/** @jsx createElement */

import createElement, { XAnimationGraph, XClipMotion, XVariableDeclaration } from './animation-graph-elements';

function createAnimationGraph() {
    const v2 = <XVariableDeclaration name='a' type='float'/>;
    const v = (<XAnimationGraph>
        <XVariableDeclaration name='a' type='float'/>
        <layer>
            <state-machine>
                <motion-state speed={1.2} id="state1">
                    <XClipMotion>
                        <transition from="" to=""></transition>
                        {/* <animation-clip duration={0.3}/> */}
                    </XClipMotion>
                </motion-state>
                <transition
                    from="state1"
                    to="state2"
                />
            </state-machine>
        </layer>
    </XAnimationGraph>);

    return v;
}

test('tt', () => {
    const g = createAnimationGraph();
    console.log(g);
});