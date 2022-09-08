
#include "./transform.h"
#include <cmath>

namespace cc {
namespace {
const auto EPSILON = 1e-5;

Vec3 invOrZero(const Vec3& v_, float epsilon_) {
    return {
        std::abs(v_.x) <= epsilon_ ? 0.0f : 1.0f / v_.x,
        std::abs(v_.y) <= epsilon_ ? 0.0f : 1.0f / v_.y,
        std::abs(v_.z) <= epsilon_ ? 0.0f : 1.0f / v_.z,
    };
}
} // namespace

const Transform Transform::IDENTITY = Transform();

const Transform Transform::ZERO = Transform(Vec3::ZERO, Quaternion(), Vec3::ONE);

Transform Transform::operator*(const Transform& rhs_) const {
    const auto rotation = this->_rotation * rhs_._rotation;
    const auto scale = this->_scale * rhs_._scale;
    const auto position = rhs_._position + (rhs_._rotation * (this->_position * rhs_._scale));
    return {position, rotation, scale};
}

Transform Transform::operator/(const Transform& rhs_) const {
    const auto invScale = invOrZero(rhs_._scale, static_cast<Vec3::ValueType>(EPSILON));
    const auto invRotation = rhs_._rotation.getInversed();
    const auto rotation = invRotation * this->_rotation;
    const auto scale = invScale * this->_scale;
    const auto position = invScale * (invRotation * (this->_position - rhs_._position));
    return {position, rotation, scale};
}
} // namespace cc
