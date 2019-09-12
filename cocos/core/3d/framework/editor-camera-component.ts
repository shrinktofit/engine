/**
 * @hidden
 */

import { ccclass } from '../../data/class-decorator';
import { GFXClearFlag } from '../../gfx/define';
import { toRadian } from '../../math';
import { Camera } from '../../renderer';
import { CameraVisFlags } from '../../renderer/scene/camera';
import { CameraComponent } from './camera-component';

@ccclass('cc.EditorCameraComponent')
export class EditorCameraComponent extends CameraComponent {

    private _uiEditorCamera: Camera | null = null;

    set projection (val) {
        this._setProjection(val);
        if (this._uiEditorCamera) {
            this._uiEditorCamera.projectionType = val;
        }
    }

    set fov (val) {
        this._setFov(val);
        if (this._uiEditorCamera) {
            this._uiEditorCamera.fov = toRadian(val);
        }
    }

    set orthoHeight (val) {
        this._setOrthoHeight(val);
        if (this._uiEditorCamera) {
            this._uiEditorCamera.orthoHeight = val;
        }
    }

    set near (val) {
        this._setNear(val);
        if (this._uiEditorCamera) {
            this._uiEditorCamera.nearClip = val;
        }
    }

    set far (val) {
        this._setFar(val);
        if (this._uiEditorCamera) {
            this._uiEditorCamera.farClip = val;
        }
    }

    set color (val) {
        this._setColor(val);
        if (this._uiEditorCamera) {
            this._uiEditorCamera.clearColor = val;
        }
    }

    set depth (val) {
        this._setDepth(val);
        if (this._uiEditorCamera) {
            this._uiEditorCamera.clearDepth = val;
        }
    }

    set stencil (val) {
        this._setStencil(val);
        if (this._uiEditorCamera) {
            this._uiEditorCamera.clearStencil = val;
        }
    }

    set clearFlags (val) {
        this._setClearFlags(val);
        if (this._uiEditorCamera) {
            this._uiEditorCamera.clearFlag = val;
        }
    }

    set rect (val) {
        this._setRect(val);
        if (this._uiEditorCamera) {
            this._uiEditorCamera.viewport = val;
        }
    }

    set screenScale (val) {
        this._setScreenScale(val);
        if (this._uiEditorCamera) {
            this._uiEditorCamera.screenScale = val;
        }
    }

    public onLoad () {
        super.onLoad();
    }

    public onEnable () {
        super.onEnable();
    }

    public onDisable () {
        super.onDisable();
    }

    public onDestroy () {
        super.onDestroy();
        if (this._uiEditorCamera) {
            cc.director.root!.ui.renderScene.destroyCamera(this._uiEditorCamera);
            this._uiEditorCamera = null;
        }
    }

    protected _createCamera () {
        const priorCamera = this._camera;
        super._createCamera();

        if (this._camera !== priorCamera && this._camera) {
            if (this._uiEditorCamera) {
                cc.director.root!.ui.renderScene.destroyCamera(this._uiEditorCamera);
                this._uiEditorCamera = null;
            }
            this._uiEditorCamera = cc.director.root!.ui.renderScene.createCamera({
                name: 'Editor UICamera',
                node: this._camera.node,
                projection: this._projection,
                window: cc.director.root!.mainWindow,
                priority: this._priority + 1,
                flows: ['UIFlow'],
            });

            this._uiEditorCamera!.visibility |= (CameraVisFlags.EDITOR | CameraVisFlags.GIZMOS);
            this._uiEditorCamera!.viewport = this._camera.viewport;
            this._uiEditorCamera!.fov = this._camera.fov;
            this._uiEditorCamera!.nearClip = this._camera.nearClip;
            this._uiEditorCamera!.farClip = this._camera.farClip;
            this._uiEditorCamera!.clearColor = this._camera.clearColor;
            this._uiEditorCamera!.clearDepth = this._camera.clearDepth;
            this._uiEditorCamera!.clearStencil = this._camera.clearStencil;
            this._uiEditorCamera!.clearFlag = GFXClearFlag.DEPTH_STENCIL;
        }
    }
}
