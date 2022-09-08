
#pragma once

#include <algorithm>
#include <memory>
#include <optional>
#include <string>
#include <string_view>
#include <vector>
#include "../core/pose-allocator.h"
#include "../core/pose.h"
#include "../core/transform.h"
#include "./scene-graph-interop.h"
#include "./transform-handle.h"

namespace cc {

class AnimationGraphPoseLayout {
public:
    AnimationGraphPoseLayout(std::uint32_t transformCount_, std::uint32_t metaValueCount_, std::vector<Transform>&& defaultTranforms_)
    : _transformCount(transformCount_), _metaValueCount(metaValueCount_), _defaultTranforms(std::move(defaultTranforms_)) {
    }

    auto transformCount() const {
        return _transformCount;
    }

    auto metaValueCount() const {
        return _metaValueCount;
    }

private:
    std::uint32_t _transformCount;
    std::uint32_t _metaValueCount;
    std::vector<Transform> _defaultTranforms;
};

class SceneNodeTransformRecord {
public:
    SceneNodeTransformRecord(
        __scene_graph_interop_helper::SceneNode node_, std::uint32_t index_) : node(node_), index(std::make_unique<std::uint32_t>(index_)) {
    }

    TransformHandle makeHandle() const {
        return {&*index};
    }

    __scene_graph_interop_helper::SceneNode node;
    std::unique_ptr<std::uint32_t> index;
};

class AnimationGraphPoseLayoutMaintainer {
public:
    AnimationGraphPoseLayout generateLayout() const {
        std::vector<Transform> defaultTransforms(_transformRecords.size());
        return {
            static_cast<std::uint32_t>(_transformRecords.size()),
            static_cast<std::uint32_t>(_metaValueRecords.size()),
            std::move(defaultTransforms)};
    }

    std::vector<__scene_graph_interop_helper::SceneNode> generateNodeTable() const {
        std::vector<__scene_graph_interop_helper::SceneNode> nodes(_transformRecords.size(), __scene_graph_interop_helper::createNullSceneNode());
        std::transform(_transformRecords.begin(), _transformRecords.end(), nodes.begin(), [](const SceneNodeTransformRecord& record) {
            return __scene_graph_interop_helper::SceneNode(record.node);
        });
        return nodes;
    }

    TransformHandle getOrCreateTransformBinding(__scene_graph_interop_helper::SceneNode node) {
        const auto transformIter = std::find_if(
            _transformRecords.begin(),
            _transformRecords.end(),
            [node](const auto& record_) { return __scene_graph_interop_helper::isEqual(node, record_.node); });
        if (transformIter != _transformRecords.end()) {
            return transformIter->makeHandle();
        }

        // Ensure parent is preceding to children.
        decltype(_transformRecords)::size_type newNodeIndex = 0;
        for (std::optional<__scene_graph_interop_helper::SceneNode> parent = __scene_graph_interop_helper::getParent(node);
             parent;
             parent = __scene_graph_interop_helper::getParent(*parent)) {
            const auto parentIter = std::find_if(
                _transformRecords.begin(),
                _transformRecords.end(),
                [parent](const auto& record_) { return __scene_graph_interop_helper::isEqual(*parent, record_.node); });
            if (parentIter != _transformRecords.end()) {
                newNodeIndex = (parentIter - _transformRecords.begin()) + 1;
                break;
            }
        }

        // Update necessary bone handle.
        for (auto transformIndex = newNodeIndex; transformIndex < _transformRecords.size(); ++transformIndex) {
            ++*(_transformRecords[transformIndex].index);
        }

        // Insert new transform record.
        SceneNodeTransformRecord transformRecord{node, static_cast<std::uint32_t>(newNodeIndex)};
        _transformRecords.emplace(_transformRecords.begin() + newNodeIndex, std::move(transformRecord));

        return _transformRecords[newNodeIndex].makeHandle();
    }

    void apply(const Pose& pose_) {
        const auto& transforms = pose_.transforms();
        BOOST_ASSERT(transforms.size() == _transformRecords.size());
        for (decltype(transforms.size()) iTransform = 0; iTransform < transforms.size(); ++iTransform) {
            auto node = _transformRecords[iTransform].node;
            const auto& transform = transforms[iTransform];
            std::array<float, 10> data = {
                transform.getPosition().x,
                transform.getPosition().y,
                transform.getPosition().z,

                transform.getRotation().x,
                transform.getRotation().y,
                transform.getRotation().z,
                transform.getRotation().w,

                transform.getScale().x,
                transform.getScale().y,
                transform.getScale().z,
            };
            __scene_graph_interop_helper::setRTS(node, data);
        }

        const auto& metaValues = pose_.metaValues();
    }

private:
    std::vector<std::string> _metaValueRecords;
    std::vector<SceneNodeTransformRecord> _transformRecords;
};

// class AnimationGraphBindingContext {
// public:
//     AnimationGraphBindingContext(__scene_graph_interop_helper::JsVal&& val_) : _js(std::move(val_)) {
//     }
//
//     std::optional<TransformHandle> bindTransform(std::string_view path_) {
//         return _js.bindTransform(path_);
//     }
//
// private:
//     __scene_graph_interop_helper::JsAnimationGraphBindingContext _js;
// };

class AnimationGraphBindingContext {
public:
    AnimationGraphBindingContext(
        __scene_graph_interop_helper::SceneNode origin_, AnimationGraphPoseLayoutMaintainer& poseLayoutMainter_) : _origin(origin_), _poseLayoutMaintainer(poseLayoutMainter_) {
    }

    std::optional<TransformHandle> bindTransform(std::string_view path_) {
        auto node = __scene_graph_interop_helper::findNode(_origin, path_);
        if (!node) {
            return {};
        }
        return _poseLayoutMaintainer.getOrCreateTransformBinding(*node);
    }

private:
    __scene_graph_interop_helper::SceneNode _origin;
    AnimationGraphPoseLayoutMaintainer& _poseLayoutMaintainer;
};

class AnimationGraphEvaluationContext {
public:
    AnimationGraphEvaluationContext(const AnimationGraphPoseLayout& poseLayout) : _poseAllocator(poseLayout.transformCount(), poseLayout.metaValueCount()) {
    }

    Pose* createDefaultedPose() {
        const auto pose = _poseAllocator.allocatePose();
        std::copy(_defaultTransforms.begin(), _defaultTransforms.end(), pose->transforms().begin());
        std::fill(pose->metaValues().begin(), pose->metaValues().end(), 0.0f);
        return pose;
    }

    Pose* createZeroPose() {
        const auto pose = _poseAllocator.allocatePose();
        std::fill(pose->transforms().begin(), pose->transforms().end(), Transform::ZERO);
        std::fill(pose->metaValues().begin(), pose->metaValues().end(), 0.0f);
        return pose;
    }

    Pose* duplicatePose(const Pose& src_) {
        const auto pose = _poseAllocator.allocatePose();
        *pose = src_;
        return pose;
    }

    void deletePose(Pose* pose_) {
        _poseAllocator.deletePose(pose_);
    }

private:
    std::vector<Transform> _defaultTransforms;

    PoseAllocator _poseAllocator;
};

class AnimationClipGraphBindingContext {
public:
};

class AnimationClipGraphEvaluationContext {
public:
    AnimationClipGraphEvaluationContext(Pose& pose_) : _pose(pose_) {
    }

    Pose& pose() const {
        return _pose;
    }

    Pose& _pose;
};
} // namespace cc
