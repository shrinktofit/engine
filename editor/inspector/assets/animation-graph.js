exports.template = `
<section class="asset-animation-graph">
    <ui-section expand class="config" expand-key="animation-graph-layers">
        <ui-label slot="header" value="Layers"></ui-label>
        <div class="buttons">
            <ui-button class="button add" tooltip="Add Layer">
                <ui-icon value="add"></ui-icon>
            </ui-button>
        </div>
        <div class="layers">
        </div>
    </ui-section>
    <ui-section expand class="config" expand-key="animation-graph-variables">
        <ui-label slot="header" value="Variables"></ui-label>
        <div class="buttons">
            <ui-button class="button add" tooltip="Add Variable">
                <ui-icon value="add"></ui-icon>
            </ui-button>
        </div>
        <div class="variables">
        </div>
    </ui-section>
</section>
`;

exports.style = `
.asset-animation-graph {
   padding-top: 10px;
   text-align: center;
}

.asset-animation-graph > .config {
    margin-bottom: 10px;
}

.asset-animation-graph > .config > .buttons {
    text-align: right;
    margin-top: 5px;
    margin-bottom: 10px;
}

.asset-animation-graph > .config > .buttons > .button {
    padding: 0 5px;
    width: 100%;
    line-height: 20px;
}

.asset-animation-graph > .config > .layers {
    overflow-y: auto;
    max-height: 500px;
    
}

.asset-animation-graph > .config > .layers > .layer {
    margin-bottom: 10px;
}

.asset-animation-graph > .config > .layers > .layer[active],
.asset-animation-graph > .config > .layers > .layer:hover {
    
}

.asset-animation-graph > .config > .layers > .layer > .name {
    flex: 1;
    text-align: left;
}

.asset-animation-graph > .config > .layers > .layer > .edit {
    padding: 0 5px;
}

.asset-animation-graph > .config > .layers > .layer[active] > .edit,
.asset-animation-graph > .config > .layers > .layer > .edit:hover {
    color: var(--color-primary-fill);
}

.asset-animation-graph > .config > .layers > .layer > .remove {
    padding: 0 10px;
}

.asset-animation-graph > .config > .layers > .layer > .remove:hover {
    color: var(--color-danger-fill-weaker);
}

.asset-animation-graph > .config > .layers > .layer > .node {
    margin-bottom: 5px;
}
`;

exports.$ = {
    container: '.asset-animation-graph',
    layers: '.layers',
    addButton: '.button.add',
    minusButton: '.button.minus',
};

exports.methods = {
    async selectLayer(index) {
        const panel = this;

        panel.activeLayerIndex = index;

        const children = Array.from(panel.$.layers.children);
        children.forEach((child, i) => {
            if (panel.activeLayerIndex === i) {
                child.setAttribute('active', '');
            } else {
                child.removeAttribute('active');
            }
        });


        await panel.change('change-layer', panel.activeLayerIndex);

        Editor.Panel.open('animation-graph');
    },

    async addLayer() {
        await this.change('add-layer');
        Elements.layers.update.call(this);
    },

    selectNode(layerIndex, nodeIndex) { },

    selectTransition(layerIndex, transitionIndex) { },

    async query(uuid) {
        return await Editor.Message.request('scene', 'query-animation-graph', uuid);
    },

    async apply() {
        this.reset();
        await Editor.Message.request('scene', 'apply-animation-graph', this.asset.uuid, this.dumpData);
    },

    reset() {
        this.dirtyData.origin = this.dirtyData.realtime;
        this.dirtyData.uuid = '';
    },

    async change(method, data) {
        this.dumpData = await Editor.Message.request('scene', 'change-animation-graph', method, data);

        this.setDirtyData();
        this.dispatch('change');
    },

    /**
     * Detection of data changes only determines the currently selected technique
     */
    setDirtyData() {
        this.dirtyData.realtime = JSON.stringify(this.dumpData);

        if (!this.dirtyData.origin) {
            this.dirtyData.origin = this.dirtyData.realtime;
        }
    },

    isDirty() {
        const isDirty = this.dirtyData.origin !== this.dirtyData.realtime;
        return isDirty;
    },
};

const Elements = {
    layers: {
        ready() {
            const panel = this;

            Object.assign(panel, {
                activeLayerIndex: 0,
            });

            panel.$.addButton.addEventListener('click', () => {
                panel.addLayer();
            });
        },
        update() {
            const panel = this;

            panel.$.layers.innerText = '';

            this.dumpData._layers.value.forEach((layer, layerIndex) => {
                const $layer = document.createElement('ui-section');
                $layer.setAttribute('class', 'config layer');
                $layer.setAttribute('expand-key', `animation-graph-layers-${layer.name}`);
                panel.$.layers.appendChild($layer);

                const $name = document.createElement('ui-label');
                $name.setAttribute('class', 'name');
                $name.setAttribute('slot', 'header');
                $name.setAttribute('value', `Layer: ${layer.name}`);
                $layer.appendChild($name);

                const $edit = document.createElement('ui-icon');
                $edit.setAttribute('class', 'edit');
                $edit.setAttribute('slot', 'header');
                $edit.setAttribute('value', 'edit');
                $edit.setAttribute('tooltip', 'Open The Animation Graph Editor To Edit');
                $layer.appendChild($edit);

                $edit.addEventListener('click', (event) => {
                    event.stopPropagation();
                    panel.selectLayer(layerIndex);
                });

                const $remove = document.createElement('ui-icon');
                $remove.setAttribute('class', 'remove');
                $remove.setAttribute('slot', 'header');
                $remove.setAttribute('value', 'del');
                $remove.setAttribute('tooltip', 'Remove This Layer');
                $layer.appendChild($remove);

                $remove.addEventListener('click', () => {
                    event.stopPropagation();
                    // 需要加个 dialog 问询
                    panel.removeLayer(layerIndex);
                });

                layer.value._graph.value._nodes.value.forEach((node, nodeIndex) => {
                    const $node = document.createElement('ui-section');
                    $node.setAttribute('class', 'node');
                    $layer.appendChild($node);

                    $node.addEventListener('click', () => {
                        panel.selectNode(layerIndex, nodeIndex);
                    });

                    const $name = document.createElement('ui-label');
                    $name.setAttribute('class', 'name');
                    $name.setAttribute('slot', 'header');
                    $name.setAttribute('value', `Node: ${node.name}`);
                    $node.appendChild($name);
                });


                layer.value._graph.value._transitions.value.forEach((transition, transitionIndex) => {
                    const $transition = document.createElement('ui-section');
                    $transition.setAttribute('class', 'transition');
                    $layer.appendChild($transition);

                    $transition.addEventListener('click', () => {
                        panel.selectTransition(layerIndex, transitionIndex);
                    });

                    const $name = document.createElement('ui-label');
                    $name.setAttribute('class', 'name');
                    $name.setAttribute('slot', 'header');
                    $name.setAttribute('value', `Transition: ${transition.name}`);
                    $transition.appendChild($name);
                });
            });
        },
    },
};

exports.ready = function() {
    // Used to determine whether the material has been modified in isDirty()
    this.dirtyData = {
        uuid: '',
        origin: '',
        realtime: '',
    };

    for (const prop in Elements) {
        const element = Elements[prop];
        if (element.ready) {
            element.ready.call(this);
        }
    }
};

exports.update = async function(assetList, metaList) {
    this.assetList = assetList;
    this.metaList = metaList;
    this.meta = this.metaList[0];
    this.asset = this.assetList[0];

    if (assetList.length !== 1) {
        this.$.container.innerText = '';
        return;
    }

    if (this.dirtyData.uuid !== this.asset.uuid) {
        this.dirtyData.uuid = this.asset.uuid;
        this.dirtyData.origin = '';
    }

    this.dumpData = await this.query(this.asset.uuid);

    for (const prop in Elements) {
        const element = Elements[prop];
        if (element.update) {
            element.update.call(this);
        }
    }

    this.setDirtyData();
};

exports.close = function() {
    // Used to determine whether the material has been modified in isDirty()
    this.dirtyData = {
        uuid: '',
        origin: '',
        realtime: '',
    };

    for (const prop in Elements) {
        const element = Elements[prop];
        if (element.close) {
            element.close.call(this);
        }
    }
};
