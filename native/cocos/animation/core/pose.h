#pragma once

#include <math/MathUtil.h>
#include <vector>
#include "./span.h"
#include "./transform.h"

namespace cc {
class Pose {
public:
    Pose(std::uint32_t transformCount_, std::uint32_t metaValueCount_) : _transforms(transformCount_), _metaValues(metaValueCount_) {
    }

    ccstd::span<Transform> transforms() {
        return {this->_transforms.data(), this->_transforms.size()};
    }

    ccstd::span<float> metaValues() {
        return {this->_metaValues.data(), this->_metaValues.size()};
    }

    ccstd::span<const Transform> transforms() const {
        return {this->_transforms.data(), this->_transforms.size()};
    }

    ccstd::span<const float> metaValues() const {
        return {this->_metaValues.data(), this->_metaValues.size()};
    }

    friend void swap(Pose& lhs_, Pose& rhs_) {
        std::swap(lhs_._transforms, rhs_._transforms);
        std::swap(lhs_._metaValues, rhs_._metaValues);
    }

private:
    std::vector<Transform> _transforms;

    std::vector<float> _metaValues;
};

void blendPoseInto(Pose& target_, const Pose& source_, float alpha_);

void calculateDeltaPose(Pose& target_, const Pose& base_);

void applyDeltaPose(Pose& target_, const Pose& delta_, float alpha_);
} // namespace cc
