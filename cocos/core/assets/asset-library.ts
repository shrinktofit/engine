﻿/*
 Copyright (c) 2013-2016 Chukong Technologies Inc.
 Copyright (c) 2017-2018 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated engine source code (the "Software"), a limited,
  worldwide, royalty-free, non-assignable, revocable and non-exclusive license
 to use Cocos Creator solely to develop games on your target platforms. You shall
  not use Cocos Creator software for developing other software or tools that's
  used for developing games. You are not granted to publish, distribute,
  sublicense, and/or sell copies of Cocos Creator.

 The software or tools in this License Agreement are licensed, not sold.
 Xiamen Yaji Software Co., Ltd. reserves all rights not expressly granted to you.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
*/

/**
 * @category asset
 */

import decodeUuid from '../utils/decode-uuid';
import { _getClassById, createMap, isChildClassOf } from '../utils/js';
import { callInNextTick } from '../utils/misc';
import { AssetTable } from '../load-pipeline/asset-table';
import { getDependsRecursively } from '../load-pipeline/auto-release-utils';
import MD5Pipe from '../load-pipeline/md5-pipe';
import { initPacks } from '../load-pipeline/pack-downloader';
import { SubPackPipe } from '../load-pipeline/subpackage-pipe';
import { Asset } from './asset';
import * as debug from '../platform/debug';

// tslint:disable: max-line-length

// configs

let _libraryBase = '';
let _rawAssetsBase = '';     // The base dir for raw assets in runtime
const _uuidToRawAsset = createMap(true);

function isScene (asset) {
    return asset && (asset.constructor === cc.SceneAsset || asset instanceof cc.Scene);
}

// types

function RawAssetEntry (url, type) {
    // @ts-ignore
    this.url = url;
    // @ts-ignore
    this.type = type;
}

// publics

/**
 * 管理项目中加载/卸载资源的资源库。
 * @class AssetLibrary
 * @static
 */
const AssetLibrary = {
    /**
     * 这里保存所有已经加载的场景资源，防止同一个资源在内存中加载出多份拷贝。
     *
     * 这里用不了WeakMap，在浏览器中所有加载过的资源都只能手工调用 unloadAsset 释放。
     *
     * 参考：
     * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap
     * https://github.com/TooTallNate/node-weak
     *
     * @property {object} _uuidToAsset
     * @private
     */
    _uuidToAsset: {},

    /**
     * @callback loadCallback
     * @param {String} error - null or the error info
     * @param {Asset} data - the loaded asset or null
     */

    /**
     * @zh
     * 加载资源。
     * @param {String} uuid
     * @param {loadCallback} callback - 加载完成后执行的回调函数。
     * @param {Object} options
     * @param {Boolean} options.readMainCache - 默认为true。如果为false，则资源及其所有依赖资源将重新加载并从库中创建新实例。
     * @param {Boolean} options.writeMainCache - 默认为true。如果为true，则结果将缓存到 AssetLibrary，并且必须由用户手动卸载。
     * @param {Asset} options.existingAsset - 加载现有资源，此参数仅在编辑器中可用。
     */
    loadAsset (uuid: String, callback: Function, options?) {
        if (typeof uuid !== 'string') {
            return callInNextTick(callback, new Error('[AssetLibrary] uuid must be string'), null);
        }
        // var readMainCache = typeof (options && options.readMainCache) !== 'undefined' ? readMainCache : true;
        // var writeMainCache = typeof (options && options.writeMainCache) !== 'undefined' ? writeMainCache : true;
        const item: any = {
            uuid,
            type: 'uuid',
        };
        if (options && options.existingAsset) {
            item.existingAsset = options.existingAsset;
        }
        cc.loader.load(item, (error, asset) => {
            if (error || !asset) {
                error = new Error('[AssetLibrary] loading JSON or dependencies failed: ' + (error ? error.message : 'Unknown error'));
            }
            else {
                if (asset.constructor === cc.SceneAsset) {
                    if (CC_EDITOR && !asset.scene) {
                        debug.error('Sorry, the scene data of "%s" is corrupted!', uuid);
                    }
                    else {
                        const key = cc.loader._getReferenceKey(uuid);
                        asset.scene.dependAssets = getDependsRecursively(key);
                    }
                }
            }
            if (callback) {
                callback(error, asset);
            }
        });
    },

    /**
     * @zh
     * 获取资源的 url。
     */
    getLibUrlNoExt (uuid, inRawAssetsDir?: boolean) {
        if (CC_BUILD) {
            uuid = decodeUuid(uuid);
        }
        const uuids = uuid.split('@').map((name) => {
            return encodeURIComponent(name);
        });
        uuid = uuids.join('@');
        const base = (CC_BUILD && inRawAssetsDir) ? (_rawAssetsBase + 'assets/') : _libraryBase;
        return base + uuid.slice(0, 2) + '/' + uuid;
    },

    /**
     * @zh
     * 在编辑器中查询资源信息。
     * @param uuid 资源的 uuid。
     * @protected
     */
    _queryAssetInfoInEditor (uuid, callback) {
        if (CC_EDITOR) {
            EditorExtends.Asset.queryAssetInfo(uuid, (error: Error, info: any) => {
                if (error) {
                    const loadError: any = new Error('Can not get asset url by uuid "' + uuid + '", the asset may be deleted.');
                    loadError.errorCode = 'db.NOTFOUND';
                    debug.error(error);
                    return callback(loadError);
                }

                const ctor = cc.js.getClassByName(info.type);
                if (ctor) {
                    const isRawAsset = !isChildClassOf(ctor, Asset);
                    const url = `import://${info.uuid.substr(0, 2)}/${info.uuid}.json`;
                    callback(null, url, isRawAsset, ctor);
                } else {
                    callback(new Error('Can not find asset type ' + info.type));
                }
            });
        } else {
            callback(new Error('Unable to load resource: EditorExtends is not defined.'));
        }
    },

    /**
     * @zh
     * 在运行时获取资源信息。
     */
    _getAssetInfoInRuntime (uuid, result?: any) {
        result = result || {url: null, raw: false};
        const info = _uuidToRawAsset[uuid];
        if (info && !isChildClassOf(info.type, cc.Asset)) {
            // backward compatibility since 1.10
            result.url = _rawAssetsBase + info.url;
            result.raw = true;
        }
        else {
            result.url = this.getLibUrlNoExt(uuid) + '.json';
            result.raw = false;
        }
        return result;
    },

    /**
     * @zh
     * 在 setting 中的 uuid。
     */
    _uuidInSettings (uuid) {
        return uuid in _uuidToRawAsset;
    },

    /**
     * @zh
     * 获取资源信息。
     * @param {String} uuid 资源的 uuid。
     * @param {Function} callback
     * @param {Error} callback.error
     * @param {String} callback.url - the url of raw asset or imported asset
     * @param {Boolean} callback.raw - indicates whether the asset is raw asset
     * @param {Function} callback.ctorInEditor - the actual type of asset, used in editor only
     */
    queryAssetInfo (uuid, callback) {
        if (CC_EDITOR && !CC_TEST) {
            this._queryAssetInfoInEditor(uuid, callback);
        }
        else {
            const info = this._getAssetInfoInRuntime(uuid);
            callback(null, info.url, info.raw);
        }
    },

    /**
     * @en
     * parse uuid out of url
     * @zh
     * 从 url 解析 uuid。
     * @param url 资源地址。
     */
    parseUuidInEditor (url) {
        if (CC_EDITOR) {
            let uuid = '';
            const isImported = url.startsWith(_libraryBase);
            if (isImported) {
                const dir = cc.path.dirname(url);
                const dirBasename = cc.path.basename(dir);

                const isAssetUrl = dirBasename.length === 2;
                if (isAssetUrl) {
                    uuid = cc.path.basename(url);
                    const index = uuid.indexOf('.');
                    if (index !== -1) {
                        uuid = uuid.slice(0, index);
                    }
                }
                else {
                    // raw file url
                    uuid = dirBasename;
                }
            }
            // If url is not in the library, just return ""
            return uuid;
        }
    },

    /**
     * @zh
     * 加载 json。
     * @param {String} json
     * @param {loadCallback} callback
     * @return {LoadingHandle}
     * @private
     */
    loadJson (json, callback) {
        const randomUuid = '' + ((new Date()).getTime() + Math.random());
        const item = {
            uuid: randomUuid,
            type: 'uuid',
            content: json,
            skips: [ cc.loader.assetLoader.id, cc.loader.downloader.id ],
        };
        cc.loader.load(item, (error, asset) => {
            if (error) {
                error = new Error('[AssetLibrary] loading JSON or dependencies failed: ' + error.message);
            }
            else {
                if (asset.constructor === cc.SceneAsset) {
                    const key = cc.loader._getReferenceKey(randomUuid);
                    asset.scene.dependAssets = getDependsRecursively(key);
                }
                if (CC_EDITOR || isScene(asset)) {
                    const id = cc.loader._getReferenceKey(randomUuid);
                    cc.loader.removeItem(id);
                }
            }
            asset._uuid = '';
            if (callback) {
                callback(error, asset);
            }
        });
    },

    /**
     * @en
     * Get the exists asset by uuid.
     * @zh
     * 根据 uuid 获取存在的资源。
     * @param {String} uuid
     * @return {Asset} - 返回存在的资源，若没有加载则返回 null
     * @private
     */
    getAssetByUuid (uuid) {
        return AssetLibrary._uuidToAsset[uuid] || null;
    },

    // tslint:disable: no-shadowed-variable
    /**
     * @en
     * init the asset library
     * @zh
     * 初始化 AssetLibrary。
     * @method init
     * @param {Object} options
     * @param {String} options.libraryPath - 能接收的任意类型的路径，通常在编辑器里使用绝对的，在网页里使用相对的。
     * @param {Object} options.mountPaths - mount point of actual urls for raw assets (only used in editor)
     * @param {Object} [options.rawAssets] - uuid to raw asset's urls (only used in runtime)
     * @param {String} [options.rawAssetsBase] - base of raw asset's urls (only used in runtime)
     * @param {String} [options.packedAssets] - packed assets (only used in runtime)
     */
    init (options) {
        if (CC_EDITOR && _libraryBase) {
            cc.errorID(6402);
            return;
        }

        // 这里将路径转 url，不使用路径的原因是有的 runtime 不能解析 "\" 符号。
        // 不使用 url.format 的原因是 windows 不支持 file:// 和 /// 开头的协议，所以只能用 replace 操作直接把路径转成 URL。
        let libraryPath = options.libraryPath;
        libraryPath = libraryPath.replace(/\\/g, '/');
        _libraryBase = cc.path.stripSep(libraryPath) + '/';

        _rawAssetsBase = options.rawAssetsBase;

        const md5AssetsMap = options.md5AssetsMap;
        if (md5AssetsMap && md5AssetsMap.import) {
            // decode uuid
            let i = 0;
            let uuid = '';
            const md5ImportMap = createMap(true);
            let md5Entries = md5AssetsMap.import;
            for (i = 0; i < md5Entries.length; i += 2) {
                uuid = decodeUuid(md5Entries[i]);
                const uuids = uuid.split('@').map((name) => {
                    return encodeURIComponent(name);
                });
                uuid = uuids.join('@');
                md5ImportMap[uuid] = md5Entries[i + 1];
            }

            const md5RawAssetsMap = createMap(true);
            md5Entries = md5AssetsMap['raw-assets'];
            for (i = 0; i < md5Entries.length; i += 2) {
                uuid = decodeUuid(md5Entries[i]);
                const uuids = uuid.split('@').map((name) => {
                    return encodeURIComponent(name);
                });
                uuid = uuids.join('@');
                md5RawAssetsMap[uuid] = md5Entries[i + 1];
            }

            const md5Pipe = new MD5Pipe(md5ImportMap, md5RawAssetsMap, _libraryBase);
            cc.loader.insertPipeAfter(cc.loader.assetLoader, md5Pipe);
            cc.loader.md5Pipe = md5Pipe;
        }

        if (options.subpackages) {
            const subPackPipe = new SubPackPipe(options.subpackages);
            cc.loader.insertPipeAfter(cc.loader.assetLoader, subPackPipe);
            cc.loader.subPackPipe = subPackPipe;
        }

        // init raw assets

        const assetTables = cc.loader._assetTables;
        // tslint:disable: forin
        for (const mount in assetTables) {
            assetTables[mount].reset();
        }

        const rawAssets = options.rawAssets;
        if (rawAssets) {
            for (const mountPoint in rawAssets) {
                const assets = rawAssets[mountPoint];
                for (const uuid in assets) {
                    const info = assets[uuid];
                    const url = info[0];
                    const typeId = info[1];
                    const type = _getClassById(typeId);
                    if (!type) {
                        cc.error('Cannot get', typeId);
                        continue;
                    }
                    // backward compatibility since 1.10
                    _uuidToRawAsset[uuid] = new RawAssetEntry(mountPoint + '/' + url, type);
                    // init resources
                    const isSubAsset = info[2] === 1;

                    if (!assetTables[mountPoint]) {
                        assetTables[mountPoint] = new AssetTable();
                    }

                    assetTables[mountPoint].add(url, uuid, type, !isSubAsset);
                }
            }
        }

        if (options.packedAssets) {
            initPacks(options.packedAssets);
        }

        // init cc.url
        cc.url._init((options.mountPaths && options.mountPaths.assets) || _rawAssetsBase + 'assets');
    },
};

// 暂时屏蔽，因为目前没有缓存任何asset
// if (CC_DEV && Asset.prototype._onPreDestroy) {
//    cc.error('_onPreDestroy of Asset has already defined');
// }
// Asset.prototype._onPreDestroy = function () {
//    if (AssetLibrary._uuidToAsset[this._uuid] === this) {
//        AssetLibrary.unloadAsset(this);
//    }
// };

cc.AssetLibrary = AssetLibrary;
export default AssetLibrary;
