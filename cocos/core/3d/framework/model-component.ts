/*
 Copyright (c) 2013-2016 Chukong Technologies Inc.
 Copyright (c) 2017-2018 Xiamen Yaji Software Co., Ltd.

 http://www.cocos2d-x.org

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
*/

/**
 * @category model
 */

import { Material, Mesh } from '../../assets';
import { ccclass, executeInEditMode, executionOrder, menu, property } from '../../data/class-decorator';
import { Model } from '../../renderer/scene/model';
import { TransformDirtyBit } from '../../scene-graph/node-enum';
import { Enum } from '../../value-types';
import { builtinResMgr } from '../builtin';
import { RenderableComponent } from './renderable-component';

/**
 * @en Shadow projection mode
 * @zh 阴影投射方式。
 */
const ModelShadowCastingMode = Enum({
    /**
     * 不投射阴影。
     */
    OFF: 0,
    /**
     * 开启阴影投射。
     */
    ON: 1,
});

/**
 * 模型组件。
 * @class ModelComponent
 */
@ccclass('cc.ModelComponent')
@executionOrder(100)
@menu('Components/ModelComponent')
@executeInEditMode
export class ModelComponent extends RenderableComponent {

    /**
     * @en The mesh of the model
     * @zh 模型网格。
     */
    @property({
        type: Mesh,
    })
    get mesh () {
        return this._getMesh();
    }

    set mesh (val) {
        this._setMesh(val);
    }

    protected _getMesh() {
        return this._mesh;
    }

    protected _setMesh(val) {
        const old = this._mesh;
        this._mesh = val;
        this._onMeshChanged(old);
        this._updateModels();
    }

    /**
     * @en The shadow casting mode
     * @zh 投射阴影方式。
     */
    @property({
        type: ModelShadowCastingMode,
    })
    get shadowCastingMode () {
        return this._shadowCastingMode;
    }

    set shadowCastingMode (val) {
        this._shadowCastingMode = val;
        this._updateCastShadow();
    }

    /**
     * @en Does this model receive shadows?
     * @zh 是否接受阴影？
     */
    // @property
    get receiveShadows () {
        return this._receiveShadows;
    }

    set receiveShadows (val) {
        this._receiveShadows = val;
        this._updateReceiveShadow();
    }

    get model () {
        return this._model;
    }

    public static ShadowCastingMode = ModelShadowCastingMode;

    protected _model: Model | null = null;

    @property
    protected _mesh: Mesh | null = null;

    @property
    private _shadowCastingMode = ModelShadowCastingMode.OFF;

    @property
    private _receiveShadows = false;

    public onLoad () {
        this._updateModels();
        this._updateCastShadow();
        this._updateReceiveShadow();
    }

    public onEnable () {
        if (this._model) {
            if (!this._model.inited) {
                this._updateModels();
            }
            this._model.enabled = true;
        }
    }

    public onDisable () {
        if (this._model) {
            this._model.enabled = false;
        }
    }

    public onDestroy () {
        if (this._model) {
            this._getRenderScene().destroyModel(this._model);
            this._model = null;
        }
    }

    public _getModel (): Model | null {
        return this._model;
    }

    public recreateModel () {
        if (this.isValid) {
            if (this._model) {
                this._model.destroy();
                this._model.scene.destroyModel(this._model);
                this._model = null;
            }
            this._updateModels();
        }
    }

    protected _updateModels () {
        if (!this.enabledInHierarchy || !this._mesh) {
            return;
        }

        if (this._model && this._model.inited) {
            this._model.destroy();
        } else {
            this._createModel();
        }

        this._model!.createBoundingShape(this._mesh.minPosition, this._mesh.maxPosition);

        this._updateModelParams();

        if (this._model) {
            this._model.enabled = true;
        }
    }

    protected _createModel () {
        if (!this.node.scene) { return; }
        const scene = this._getRenderScene();
        this._model = scene.createModel(this._getModelConstructor(), this.node);
        this._model.visFlags = this.visibility;
    }

    protected _getModelConstructor () {
        return Model;
    }

    protected _updateModelParams () {
        if (!this._mesh || !this._model) {
            return;
        }
        this.node.hasChangedFlags = this._model.transform.hasChangedFlags = TransformDirtyBit.POSITION;
        const meshCount = this._mesh ? this._mesh.subMeshCount : 0;
        for (let i = 0; i < meshCount; ++i) {
            const material = this.getSharedMaterial(i);
            const renderingMesh = this._mesh.renderingMesh;
            if (renderingMesh) {
                const subMeshData = renderingMesh.getSubmesh(i);
                if (subMeshData) {
                    this._model.initSubModel(i, subMeshData, material || this._getBuiltinMaterial());
                }
            }
        }
    }

    protected _onMaterialModified (idx: number, material: Material | null) {
        if (this._model == null) {
            return;
        }
        this._onRebuildPSO(idx, material || this._getBuiltinMaterial());
    }

    protected _onRebuildPSO (idx: number, material: Material) {
        if (this._model) {
            this._model.setSubModelMaterial(idx, material);
        }
    }

    protected _onMeshChanged (old: Mesh | null) {
    }

    protected _clearMaterials () {
        if (this._model == null) {
            return;
        }
        for (let i = 0; i < this._model.subModelNum; ++i) {
            this._onMaterialModified(i, null);
        }
    }

    protected _getBuiltinMaterial () {
        // classic ugly pink indicating missing material
        return builtinResMgr.get<Material>('missing-material');
    }

    protected _onVisiblityChange (val) {
        if (this._model) {
            this._model.visFlags = val;
        }
    }

    private _updateCastShadow () {
        if (!this._model) { return; }
        if (this._shadowCastingMode === ModelShadowCastingMode.OFF) {
            this._model.castShadow = false;
        } else if (this._shadowCastingMode === ModelShadowCastingMode.ON) {
            this._model.castShadow = true;
        } else {
            console.warn(`ShadowCastingMode ${this._shadowCastingMode} is not supported.`);
        }
    }

    private _updateReceiveShadow () {
        if (!this.enabledInHierarchy || !this._model) {
            return;
        }
        // for (let i = 0; i < this._model.subModelNum; ++i) {
        //     const subModel = this._model.getSubModel(i);
        //     if (subModel._defines['CC_USE_SHADOW_MAP'] != undefined) {
        //         this.getMaterial(i).define('CC_USE_SHADOW_MAP', this._receiveShadows);
        //     }
        // }
    }
}
