#pragma once

#if CC_EMSCRIPTEN
    #include <emscripten/val.h>
#else
    #include "bindings/jswrapper/SeApi.h"
#endif
#include <math/Quaternion.h>
#include <math/Vec3.h>
#include <algorithm>
#include <boost/assert.hpp>
#include <memory>
#include <optional>
#include <string>
#include <string_view>
#include <vector>
#include "../core/span.h"
#include "../core/time.h"
#include "../marionette/context.h"

namespace cc {
template <typename Ty>
struct ExoticTrackValueTrait {
    using ValueType = Ty;
};

template <>
struct ExoticTrackValueTrait<Vec3> {
public:
    using ValueType = Vec3;

    constexpr static ValueType defaultValue = ValueType();

    static ValueType lerp(const ValueType& from_, const ValueType& to_, AnimationTimeType alpha_) {
        return cc::lerp(from_, to_, alpha_);
    }
};

template <>
struct ExoticTrackValueTrait<Quaternion> {
public:
    using ValueType = Quaternion;

    constexpr static ValueType defaultValue = ValueType();

    static ValueType lerp(const ValueType& from_, const ValueType& to_, AnimationTimeType alpha_) {
        return cc::slerp(from_, to_, alpha_);
    }
};

template <typename Ty>
class ExoticTrack {
private:
    using ValueTraitType = ExoticTrackValueTrait<Ty>;

public:
    using SizeType = std::uint32_t;

    using TimeType = AnimationTimeType;

    using ValueType = typename ValueTraitType::ValueType;

    ExoticTrack(ccstd::span<TimeType> times_, ccstd::span<ValueType> values_) : _times(__CC_SPAN_TO_STD_VECTOR_ARGS__(times_)),
                                                                                _values(__CC_SPAN_TO_STD_VECTOR_ARGS__(values_)) {
    }

    ValueType sample(TimeType time_) {
        const auto nKeyframes = _values.size();
        if (!nKeyframes) {
            return ValueTraitType::defaultValue;
        }
        const auto& firstTime = _times[0];
        const auto& lastTime = _times[nKeyframes - 1];
        if (time_ <= firstTime) {
            return _values[0];
        } else if (time_ >= lastTime) {
            return _values[nKeyframes - 1];
        } else {
            const auto nextIter = std::lower_bound(_times.begin(), _times.end(), time_);
            BOOST_ASSERT_MSG(nextIter != _times.end() && nextIter != _times.begin(), "_times was not sorted?");
            const auto prevIndex = static_cast<SizeType>(std::prev(nextIter) - _times.begin());
            const auto nextIndex = static_cast<SizeType>(nextIter - _times.begin());
            const auto prevTime = _times[prevIndex];
            const auto prevValue = _values[prevIndex];
            const auto nextTime = _times[nextIndex];
            const auto nextValue = _values[nextIndex];
            const auto ratio = (time_ - prevTime) / (nextTime - prevTime);
            if (ratio < 0 || ratio > 1) {
                std::cerr << "Bad ratio: " << ratio << " Time: " << time_ << " PrevTime: " << prevTime << " NextTime: " << nextTime << " PrevIndex " << prevIndex << "\n";
            }
            return ValueTraitType::lerp(prevValue, nextValue, ratio);
        }
    }

private:
    std::vector<TimeType> _times;
    std::vector<Ty> _values;
};

using ExoticVec3Track = ExoticTrack<Vec3>;

using ExoticQuatTrack = ExoticTrack<Quaternion>;

class ExoticNodeAnimationSampleData {
public:
    std::optional<ExoticVec3Track> position;
    std::optional<ExoticQuatTrack> rotation;
    std::optional<ExoticVec3Track> scale;
};

class ExoticNodeAnimationEvaluator {
public:
    ExoticNodeAnimationEvaluator(
        TransformHandle transform_handle_,
        std::shared_ptr<ExoticNodeAnimationSampleData> sample_data_) : _transformHandle(transform_handle_), _sampleData(sample_data_) {
    }

    void evaluate(AnimationTimeType time_, AnimationClipGraphEvaluationContext& context_) const {
        auto& pose = context_.pose();
        auto& transform = pose.transforms()[_transformHandle];
        if (_sampleData->position) {
            transform.setPosition(_sampleData->position->sample(time_));
        }
        if (_sampleData->rotation) {
            transform.setRotation(_sampleData->rotation->sample(time_));
        }
        if (_sampleData->scale) {
            transform.setScale(_sampleData->scale->sample(time_));
        }
    }

private:
    TransformHandle _transformHandle;
    std::shared_ptr<ExoticNodeAnimationSampleData> _sampleData;
};

class ExoticNodeAnimation {
public:
    ExoticNodeAnimation(
        std::string_view path_,
        ExoticNodeAnimationSampleData&& sampleData_) : _path(path_),
                                                       _sampleData(std::make_shared<ExoticNodeAnimationSampleData>(std::move(sampleData_))) {
    }

    std::optional<ExoticNodeAnimationEvaluator> createEvaluator(AnimationGraphBindingContext& binding_context_) const {
        const auto transformHandle = binding_context_.bindTransform(_path);
        if (!transformHandle) {
            return {};
        }
        return ExoticNodeAnimationEvaluator{*transformHandle, _sampleData};
    }

private:
    std::string _path;
    std::shared_ptr<ExoticNodeAnimationSampleData> _sampleData;
};

class ExoticAnimationEvaluator {
public:
    ExoticAnimationEvaluator(std::vector<ExoticNodeAnimationEvaluator>&& node_animation_evaluators_)
    : _nodeAnimationEvaluators(std::move(node_animation_evaluators_)) {
    }

public:
    void evaluate(AnimationTimeType time_, AnimationClipGraphEvaluationContext& context_) const {
        for (const auto& evaluator : _nodeAnimationEvaluators) {
            evaluator.evaluate(time_, context_);
        }
    }

private:
    std::vector<ExoticNodeAnimationEvaluator> _nodeAnimationEvaluators;
};

class ExoticAnimation {
public:
#if CC_EMSCRIPTEN
    void fromJS(emscripten::val js_) {
        auto jsNodeAnimations = js_["_nodeAnimations"];
        auto x = jsNodeAnimations["length"].as<std::uint32_t>();
        for (std::uint32_t i = 0; i < x; ++i) {
            auto jsNodeAnimation = jsNodeAnimations[i];
            const auto path = jsNodeAnimation["_path"].as<std::string>();

            const auto convertTimes = [](emscripten::val js_) {
                std::vector<AnimationTimeType> times(js_["length"].as<std::uint32_t>());
                for (int i = 0; i < times.size(); ++i) {
                    times[i] = js_[std::uint32_t(i)].as<float>();
                }
                return times;
            };

            const auto convertVec3s = [&](emscripten::val js_) {
                auto fs = convertTimes(js_["_values"]);
                std::vector<Vec3> values(fs.size() / 3);
                for (int i = 0; i < values.size(); ++i) {
                    values[i] = Vec3{fs[i * 3 + 0], fs[i * 3 + 1], fs[i * 3 + 2]};
                }
                return values;
            };

            const auto convertQuats = [&](emscripten::val js_) {
                auto fs = convertTimes(js_["_values"]);
                std::vector<Quaternion> values(fs.size() / 4);
                for (int i = 0; i < values.size(); ++i) {
                    values[i] = Quaternion{fs[i * 4 + 0], fs[i * 4 + 1], fs[i * 4 + 2], fs[i * 4 + 3]};
                }
                return values;
            };

            std::optional<ExoticVec3Track> positions;
            if (jsNodeAnimation["_position"] != emscripten::val::null()) {
                auto t = convertTimes(jsNodeAnimation["_position"]["times"]);
                auto v = convertVec3s(jsNodeAnimation["_position"]["values"]);
                positions.emplace(
                    ccstd::span<AnimationTimeType>{__CC_SPAN_TO_STD_VECTOR_ARGS__(t)},
                    ccstd::span<Vec3>{__CC_SPAN_TO_STD_VECTOR_ARGS__(v)});
            }

            std::optional<ExoticQuatTrack> rotations;
            if (jsNodeAnimation["_rotation"] != emscripten::val::null()) {
                auto t = convertTimes(jsNodeAnimation["_rotation"]["times"]);
                auto v = convertQuats(jsNodeAnimation["_rotation"]["values"]);
                rotations.emplace(
                    ccstd::span<AnimationTimeType>{__CC_SPAN_TO_STD_VECTOR_ARGS__(t)},
                    ccstd::span<Quaternion>{__CC_SPAN_TO_STD_VECTOR_ARGS__(v)});
            }

            std::optional<ExoticVec3Track> scales;
            if (jsNodeAnimation["_scale"] != emscripten::val::null()) {
                auto t = convertTimes(jsNodeAnimation["_scale"]["times"]);
                auto v = convertVec3s(jsNodeAnimation["_scale"]["values"]);
                scales.emplace(
                    ccstd::span<AnimationTimeType>{__CC_SPAN_TO_STD_VECTOR_ARGS__(t)},
                    ccstd::span<Vec3>{__CC_SPAN_TO_STD_VECTOR_ARGS__(v)});
            }

            ExoticNodeAnimationSampleData sampleData;
            sampleData.position = std::move(positions);
            sampleData.scale = std::move(scales);
            sampleData.rotation = std::move(rotations);

            _nodeAnimations.emplace_back(path, std::move(sampleData));
        }
    }
#else
    void fromJS(se::Value js_) {
        se::Value jsNodeAnimationsX;
        BOOST_ASSERT(js_.toObject()->getProperty("_nodeAnimations", &jsNodeAnimationsX));
        auto jsNodeAnimations = jsNodeAnimationsX.toObject();
        BOOST_ASSERT(jsNodeAnimations);
        std::uint32_t x = 0;
        BOOST_ASSERT(jsNodeAnimations->getArrayLength(&x));
        for (std::uint32_t i = 0; i < x; ++i) {
            se::Value jsNodeAnimaitonX;
            BOOST_ASSERT(jsNodeAnimations->getArrayElement(i, &jsNodeAnimaitonX));
            auto jsNodeAnimation = jsNodeAnimaitonX.toObject();
            BOOST_ASSERT(jsNodeAnimation);

            auto pathX = (*jsNodeAnimation)["_path"];
            auto path = pathX.toString();

            const auto convertTimes = [](se::Value js_) {
                float* data = nullptr;
                std::size_t size = 0;
                js_.toObject()->getTypedArrayData(reinterpret_cast<std::uint8_t**>(&data), &size);
                size /= sizeof(float);
                std::vector<AnimationTimeType> times(size);
                for (decltype(size) i = 0; i < size; ++i) {
                    auto element = data[i];
                    times[i] = element;
                }
                return times;
            };

            const auto convertVec3s = [&](se::Value js_) {
                se::Value vals;
                BOOST_ASSERT(js_.toObject()->getProperty("_values", &vals));
                auto fs = convertTimes(vals);
                std::vector<Vec3> values(fs.size() / 3);
                for (int i = 0; i < values.size(); ++i) {
                    values[i] = Vec3{fs[i * 3 + 0], fs[i * 3 + 1], fs[i * 3 + 2]};
                }
                return values;
            };

            const auto convertQuats = [&](se::Value js_) {
                se::Value vals;
                BOOST_ASSERT(js_.toObject()->getProperty("_values", &vals));
                auto fs = convertTimes(vals);
                std::vector<Quaternion> values(fs.size() / 4);
                for (int i = 0; i < values.size(); ++i) {
                    values[i] = Quaternion{fs[i * 4 + 0], fs[i * 4 + 1], fs[i * 4 + 2], fs[i * 4 + 3]};
                }
                return values;
            };

            std::optional<ExoticVec3Track> positions;
            if (!(*jsNodeAnimation)["_position"].isNullOrUndefined()) {
                auto t = convertTimes((*((*jsNodeAnimation)["_position"].toObject()))["times"]);
                auto v = convertVec3s((*((*jsNodeAnimation)["_position"].toObject()))["values"]);
                positions.emplace(
                    ccstd::span<AnimationTimeType>{__CC_SPAN_TO_STD_VECTOR_ARGS__(t)},
                    ccstd::span<Vec3>{__CC_SPAN_TO_STD_VECTOR_ARGS__(v)});
            }

            std::optional<ExoticQuatTrack> rotations;
            if (!(*jsNodeAnimation)["_rotation"].isNullOrUndefined()) {
                auto t = convertTimes((*((*jsNodeAnimation)["_rotation"].toObject()))["times"]);
                auto v = convertQuats((*((*jsNodeAnimation)["_rotation"].toObject()))["values"]);
                rotations.emplace(
                    ccstd::span<AnimationTimeType>{__CC_SPAN_TO_STD_VECTOR_ARGS__(t)},
                    ccstd::span<Quaternion>{__CC_SPAN_TO_STD_VECTOR_ARGS__(v)});
            }

            std::optional<ExoticVec3Track> scales;
            if (!(*jsNodeAnimation)["_scale"].isNullOrUndefined()) {
                auto t = convertTimes((*((*jsNodeAnimation)["_scale"].toObject()))["times"]);
                auto v = convertVec3s((*((*jsNodeAnimation)["_scale"].toObject()))["values"]);
                scales.emplace(
                    ccstd::span<AnimationTimeType>{__CC_SPAN_TO_STD_VECTOR_ARGS__(t)},
                    ccstd::span<Vec3>{__CC_SPAN_TO_STD_VECTOR_ARGS__(v)});
            }

            ExoticNodeAnimationSampleData sampleData;
            sampleData.position = std::move(positions);
            sampleData.scale = std::move(scales);
            sampleData.rotation = std::move(rotations);

            _nodeAnimations.emplace_back(path, std::move(sampleData));
        }
    }
#endif

    ExoticAnimationEvaluator createEvaluator(AnimationGraphBindingContext& binding_context_) {
        std::vector<ExoticNodeAnimationEvaluator> nodeAnimationEvaluators;
        for (const auto& nodeAnimation : _nodeAnimations) {
            auto evaluator = nodeAnimation.createEvaluator(binding_context_);
            if (evaluator) {
                nodeAnimationEvaluators.emplace_back(std::move(*evaluator));
            }
        }

        return std::move(nodeAnimationEvaluators);
    }

private:
    std::vector<ExoticNodeAnimation> _nodeAnimations;
};
} // namespace cc
