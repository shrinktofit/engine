
#pragma once

#include <cstdint>

namespace cc {
class AnimationGraphPoseLayoutMaintainer;

class TransformHandle {
    friend class SceneNodeTransformRecord;

public:
    TransformHandle(const TransformHandle &other_) = default;

    TransformHandle(TransformHandle &&other_) {
        _pIndex = other_._pIndex;
        other_._pIndex = nullptr;
    }

    operator std::uint32_t() const {
        return *_pIndex;
    }

private:
    using TransformIndex = std::uint32_t;

    TransformIndex *_pIndex = nullptr;

    TransformHandle(TransformIndex *index_) : _pIndex(index_) {
    }
};
} // namespace cc
