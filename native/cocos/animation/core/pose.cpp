
#include "./pose.h"

namespace cc {
void blendTransformsInto(ccstd::span<Transform> target_, ccstd::span<const Transform> source_, float alpha_) {
    const auto nTransforms = target_.size();
    BOOST_ASSERT(nTransforms == source_.size());
    if (alpha_ == 0) {
        return;
    } else if (alpha_ == 1) {
        std::copy(source_.begin(), source_.end(), target_.begin());
        return;
    }
    for (decltype(target_.size()) iTransform = 0; iTransform < nTransforms; ++iTransform) {
        target_[iTransform] = target_[iTransform].lerp(source_[iTransform], alpha_);
    }
}

void blendMetaValuesInto(ccstd::span<float> target_, ccstd::span<const float> source_, float alpha_) {
    const auto nMetaValues = target_.size();
    BOOST_ASSERT(nMetaValues == source_.size());
    if (alpha_ == 0) {
        return;
    } else if (alpha_ == 1) {
        std::copy(source_.begin(), source_.end(), target_.begin());
        return;
    }
    for (decltype(target_.size()) iMetaValue = 0; iMetaValue < nMetaValues; ++iMetaValue) {
        target_[iMetaValue] = MathUtil::lerp(target_[iMetaValue], source_[iMetaValue], alpha_);
    }
}

void blendPoseInto(Pose& target_, const Pose& source_, float alpha_) {
    blendTransformsInto(target_.transforms(), source_.transforms(), alpha_);
    blendMetaValuesInto(target_.metaValues(), source_.metaValues(), alpha_);
}

void calculateDeltaTransforms(ccstd::span<Transform> target_, ccstd::span<const Transform> base_) {
    const auto nTransforms = target_.size();
    BOOST_ASSERT(nTransforms == base_.size());
    for (decltype(target_.size()) iTransform = 0; iTransform < nTransforms; ++iTransform) {
        target_[iTransform] = __calculateDeltaTransform(target_[iTransform], base_[iTransform]);
    }
}

void calculateDeltaMetaValues(ccstd::span<float> target_, ccstd::span<const float> base_) {
    const auto nMetaValues = target_.size();
    BOOST_ASSERT(nMetaValues == base_.size());
    for (decltype(target_.size()) i = 0; i < nMetaValues; ++i) {
        target_[i] -= base_[i];
    }
}

void calculateDeltaPose(Pose& target_, const Pose& base_) {
    calculateDeltaTransforms(target_.transforms(), base_.transforms());
    calculateDeltaMetaValues(target_.metaValues(), base_.metaValues());
}

void applyDeltaTransforms(ccstd::span<Transform> target_, ccstd::span<const Transform> delta_, float alpha_) {
    const auto nTransforms = target_.size();
    BOOST_ASSERT(nTransforms == delta_.size());
    for (decltype(target_.size()) iTransform = 0; iTransform < nTransforms; ++iTransform) {
        target_[iTransform] = __applyDeltaTransform(target_[iTransform], delta_[iTransform], alpha_);
    }
}

void applyDeltaMetaValues(ccstd::span<float> target_, ccstd::span<const float> delta_, float alpha_) {
    const auto nMetaValues = target_.size();
    BOOST_ASSERT(nMetaValues == delta_.size());
    for (decltype(target_.size()) i = 0; i < nMetaValues; ++i) {
        target_[i] += delta_[i] * alpha_;
    }
}

void applyDeltaPose(Pose& target_, const Pose& delta_, float alpha_) {
    applyDeltaTransforms(target_.transforms(), delta_.transforms(), alpha_);
    applyDeltaMetaValues(target_.metaValues(), delta_.metaValues(), alpha_);
}
} // namespace cc
