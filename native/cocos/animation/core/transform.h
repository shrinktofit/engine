#pragma once

#include <math/Mat4.h>
#include <math/Quaternion.h>
#include <math/Vec3.h>
#include "./time.h"

namespace cc {
class Transform {
public:
    Transform() = default;

    Transform(const Vec3& position_, const Quaternion& rotation_, const Vec3& scale_) : _position(position_), _rotation(rotation_), _scale(scale_) {}

    Transform(const Transform& other_) = default;

    Transform(const Mat4& mat4_) {
        Mat4::toRTS(mat4_, &_rotation, &_position, &_scale);
    }

public:
    Vec3 getPosition() const {
        return _position;
    }

    void setPosition(const Vec3& position_) {
        _position = position_;
    }

    Quaternion getRotation() const {
        return _rotation;
    }

    void setRotation(const Quaternion& rotation_) {
        _rotation = rotation_;
    }

    Vec3 getScale() const {
        return _scale;
    }

    void setScale(const Vec3& scale_) {
        _scale = scale_;
    }

    bool approxEquals(const Transform& other_) const {
        return this->_position.approxEquals(other_._position) &&
               this->_rotation.approxEquals(other_._rotation) &&
               this->_scale.approxEquals(other_._scale);
    }

    bool operator==(const Transform& other_) const {
        return this->_position == other_._position &&
               this->_rotation == other_._rotation &&
               this->_scale == other_._scale;
    }

    Transform lerp(const Transform& target_, AnimationTimeType t_) const {
        if (t_ == 0.0) {
            return *this;
        } else if (t_ == 1.0) {
            return target_;
        } else {
            return {
                cc::lerp(this->_position, target_._position, t_),
                slerp(this->_rotation, target_._rotation, t_),
                cc::lerp(this->_scale, target_._scale, t_)};
        }
    }

    Transform operator*(const Transform& rhs_) const;

    Transform& operator*=(const Transform& rhs_) {
        return (*this) = (*this * rhs_);
    }

    Transform operator/(const Transform& rhs_) const;

    Transform& operator/=(const Transform& rhs_) {
        return (*this) = (*this / rhs_);
    }

    operator Mat4() const {
        Mat4 mat4;
        Mat4::fromRTS(this->_rotation, this->_position, this->_scale, &mat4);
        return mat4;
    }

private:
    Vec3 _position;
    Quaternion _rotation;
    Vec3 _scale = Vec3::ONE;

public:
    const static Transform IDENTITY;

    const static Transform ZERO;
};

inline Quaternion __deltaQuat(const Quaternion& quat_, const Quaternion& base_) {
    return base_.getInversed() * quat_;
}

inline Transform __calculateDeltaTransform(const Transform& target_, const Transform& base_) {
    return {
        target_.getPosition() - base_.getPosition(),
        __deltaQuat(target_.getRotation(), base_.getRotation()),
        target_.getScale() - base_.getScale()};
}

inline Transform __applyDeltaTransform(const Transform& target_, const Transform& delta_, float alpha_) {
    return {
        target_.getPosition() + delta_.getPosition() * alpha_,
        target_.getRotation() * slerp(Quaternion::identity(), delta_.getRotation(), alpha_), // TODO: order??
        target_.getScale() + delta_.getScale() * alpha_,
    };
}
} // namespace cc
