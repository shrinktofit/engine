
#include "./RealCurve.h"
#include <algorithm>
#include <bitset>
#include <cmath>
#include <type_traits>
#include "./private/Easing.h"
#include "./private/SolveCubic.h"

namespace cc {
namespace {
/**
 * @en Returns float remainder for t / length.<br/>
 * @zh 返回t / length的浮点余数。
 * @param t Time start at 0.
 * @param length Time of one cycle.
 * @return The Time wrapped in the first cycle.
 */
template <typename T>
T repeat(T t, T length) {
    return t - std::floor(t / length) * length;
}

/**
 * Returns time wrapped in ping-pong mode.
 *
 * @param t Time start at 0.
 * @param length Time of one cycle.
 * @return The time wrapped in the first cycle.
 */
template <typename T>
T pingPong(T t, T length) {
    t = repeat(t, length * 2);
    t = length - std::abs(t - length);
    return t;
}

template <typename T>
T lerp(T from, T to, T ratio) {
    return from + (to - from) * ratio;
}

RealCurve::Value wrapRepeat(RealCurve::Time time, RealCurve::Time prevTime, RealCurve::Time nextTime) {
    return prevTime + repeat(time - prevTime, nextTime - prevTime);
}

RealCurve::Value wrapPingPong(RealCurve::Time time, RealCurve::Time prevTime, RealCurve::Time nextTime) {
    return prevTime + pingPong(time - prevTime, nextTime - prevTime);
}

bool isLeftTangentWeightEnabled(TangentWeightMode tangentWeightMode) {
    return (static_cast<std::underlying_type_t<TangentWeightMode>>(tangentWeightMode) &
            static_cast<std::underlying_type_t<TangentWeightMode>>(TangentWeightMode::LEFT)) != 0;
}

bool isRightTangentWeightEnabled(TangentWeightMode tangentWeightMode) {
    return (static_cast<std::underlying_type_t<TangentWeightMode>>(tangentWeightMode) &
            static_cast<std::underlying_type_t<TangentWeightMode>>(TangentWeightMode::RIGHT)) != 0;
}

RealCurve::Value getParamFromCubicSolution(std::array<RealCurve::Value, 3> solutions, std::array<RealCurve::Value, 3>::size_type solutionsCount, RealCurve::Value x) {
    RealCurve::Value param = x;
    if (solutionsCount == 1) {
        param = solutions[0];
    } else {
        param = -std::numeric_limits<RealCurve::Value>::infinity();
        for (std::remove_const_t<decltype(solutionsCount)> iSolution = 0; iSolution < solutionsCount; ++iSolution) {
            const auto solution = solutions[iSolution];
            if (solution >= 0.0 && solution <= 1.0) {
                if (solution > param) {
                    param = solution;
                }
            }
        }
        if (param == -std::numeric_limits<RealCurve::Value>::infinity()) {
            param = 0.0;
        }
    }
    return param;
}

RealCurve::Value bezierInterpolate(RealCurve::Value p0, RealCurve::Value p1, RealCurve::Value p2, RealCurve::Value p3, RealCurve::Value t) {
    const auto u      = 1 - t;
    const auto coeff0 = u * u * u;
    const auto coeff1 = 3 * u * u * t;
    const auto coeff2 = 3 * u * t * t;
    const auto coeff3 = t * t * t;
    return coeff0 * p0 + coeff1 * p1 + coeff2 * p2 + coeff3 * p3;
}

RealCurve::Value applyEasing(EasingMethod easingMethod, RealCurve::Value ratio) {
    const auto k = ratio;
    switch (easingMethod) {
        default: assert(false); // fallthrough
        case EasingMethod::CONSTANT: return easing::constant(k);
        case EasingMethod::LINEAR: return easing::linear(k);
        case EasingMethod::QUAD_IN: return easing::quadIn(k);
        case EasingMethod::QUAD_OUT: return easing::quadOut(k);
        case EasingMethod::QUAD_IN_OUT: return easing::quadInOut(k);
        case EasingMethod::QUAD_OUT_IN: return easing::quadOutIn(k);
        case EasingMethod::CUBIC_IN: return easing::cubicIn(k);
        case EasingMethod::CUBIC_OUT: return easing::cubicOut(k);
        case EasingMethod::CUBIC_IN_OUT: return easing::cubicInOut(k);
        case EasingMethod::CUBIC_OUT_IN: return easing::cubicOutIn(k);
        case EasingMethod::QUART_IN: return easing::quartIn(k);
        case EasingMethod::QUART_OUT: return easing::quartOut(k);
        case EasingMethod::QUART_IN_OUT: return easing::quartInOut(k);
        case EasingMethod::QUART_OUT_IN: return easing::quartOutIn(k);
        case EasingMethod::QUINT_IN: return easing::quintIn(k);
        case EasingMethod::QUINT_OUT: return easing::quintOut(k);
        case EasingMethod::QUINT_IN_OUT: return easing::quintInOut(k);
        case EasingMethod::QUINT_OUT_IN: return easing::quintOutIn(k);
        case EasingMethod::SINE_IN: return easing::sineIn(k);
        case EasingMethod::SINE_OUT: return easing::sineOut(k);
        case EasingMethod::SINE_IN_OUT: return easing::sineInOut(k);
        case EasingMethod::SINE_OUT_IN: return easing::sineOutIn(k);
        case EasingMethod::EXPO_IN: return easing::expoIn(k);
        case EasingMethod::EXPO_OUT: return easing::expoOut(k);
        case EasingMethod::EXPO_IN_OUT: return easing::expoInOut(k);
        case EasingMethod::EXPO_OUT_IN: return easing::expoOutIn(k);
        case EasingMethod::CIRC_IN: return easing::circIn(k);
        case EasingMethod::CIRC_OUT: return easing::circOut(k);
        case EasingMethod::CIRC_IN_OUT: return easing::circInOut(k);
        case EasingMethod::CIRC_OUT_IN: return easing::circOutIn(k);
        case EasingMethod::ELASTIC_IN: return easing::elasticIn(k);
        case EasingMethod::ELASTIC_OUT: return easing::elasticOut(k);
        case EasingMethod::ELASTIC_IN_OUT: return easing::elasticInOut(k);
        case EasingMethod::ELASTIC_OUT_IN: return easing::elasticOutIn(k);
        case EasingMethod::BACK_IN: return easing::backIn(k);
        case EasingMethod::BACK_OUT: return easing::backOut(k);
        case EasingMethod::BACK_IN_OUT: return easing::backInOut(k);
        case EasingMethod::BACK_OUT_IN: return easing::backOutIn(k);
        case EasingMethod::BOUNCE_IN: return easing::bounceIn(k);
        case EasingMethod::BOUNCE_OUT: return easing::bounceOut(k);
        case EasingMethod::BOUNCE_IN_OUT: return easing::bounceInOut(k);
        case EasingMethod::BOUNCE_OUT_IN: return easing::bounceOutIn(k);
        case EasingMethod::SMOOTH: return easing::smooth(k);
        case EasingMethod::FADE: return easing::fade(k);
    }
}

RealCurve::Value evalBetweenTwoKeyFrames(
    RealCurve::Time                 prevTime,
    const RealCurve::KeyframeValue &prevValue,
    RealCurve::Time                 nextTime,
    const RealCurve::KeyframeValue &nextValue,
    RealCurve::Time                 ratio) {
    const auto dt = nextTime - prevTime;
    switch (prevValue.interpolationMode) {
        default:
        case RealInterpolationMode::CONSTANT:
            return prevValue.value;
        case RealInterpolationMode::LINEAR: {
            const auto transformedRatio = prevValue.easingMethod == EasingMethod::LINEAR
                                              ? ratio
                                              : applyEasing(prevValue.easingMethod, ratio);
            return lerp(prevValue.value, nextValue.value, transformedRatio);
        }
        case RealInterpolationMode::CUBIC: {
            const auto ONE_THIRD                  = 1.0 / 3.0;
            const auto prevTangent                = prevValue.rightTangent;
            const auto prevTangentWeightSpecified = prevValue.rightTangentWeight;
            const auto prevTangentWeightEnabled   = isRightTangentWeightEnabled(prevValue.tangentWeightMode);
            const auto nextTangent                = nextValue.leftTangent;
            const auto nextTangentWeightSpecified = nextValue.leftTangentWeight;
            const auto nextTangentWeightEnabled   = isLeftTangentWeightEnabled(nextValue.tangentWeightMode);

            if (!prevTangentWeightEnabled && !nextTangentWeightEnabled) {
                // Optimize for the case when both x components of tangents are 1.
                // See below.
                const auto p1 = prevValue.value + ONE_THIRD * prevTangent * dt;
                const auto p2 = nextValue.value - ONE_THIRD * nextTangent * dt;
                return bezierInterpolate(prevValue.value, p1, p2, nextValue.value, ratio);
            } else {
                RealKeyframeValue::Value prevTangentWeight = 0.0;
                if (prevTangentWeightEnabled) {
                    prevTangentWeight = prevTangentWeightSpecified;
                } else {
                    const auto x      = dt;
                    const auto y      = dt * prevTangent;
                    prevTangentWeight = std::sqrt(x * x + y * y) * ONE_THIRD;
                }
                const auto angle0 = std::atan(prevTangent);
                const auto tx0    = std::cos(angle0) * prevTangentWeight + prevTime;
                const auto ty0    = std::sin(angle0) * prevTangentWeight + prevValue.value;

                RealKeyframeValue::Value nextTangentWeight = 0.0;
                if (nextTangentWeightEnabled) {
                    nextTangentWeight = nextTangentWeightSpecified;
                } else {
                    const auto x      = dt;
                    const auto y      = dt * nextTangent;
                    nextTangentWeight = std::sqrt(x * x + y * y) * ONE_THIRD;
                }
                const auto angle1 = std::atan(nextTangent);
                const auto tx1    = -std::cos(angle1) * nextTangentWeight + nextTime;
                const auto ty1    = -std::sin(angle1) * nextTangentWeight + nextValue.value;

                const auto dx = dt;
                // Hermite to Bezier
                const auto u0x = (tx0 - prevTime) / dx;
                const auto u1x = (tx1 - prevTime) / dx;
                const auto u0y = ty0;
                const auto u1y = ty1;
                // Converts from Bernstein Basis to Power Basis.
                // Formula: [1, 0, 0, 0; -3, 3, 0, 0; 3, -6, 3, 0; -1, 3, -3, 1] * [p_0; p_1; p_2; p_3]
                // --------------------------------------
                // | Basis | Coeff
                // | t^3   | 3 * p_1 - p_0 - 3 * p_2 + p_3
                // | t^2   | 3 * p_0 - 6 * p_1 + 3 * p_2
                // | t^1   | 3 * p_1 - 3 * p_0
                // | t^0   | p_0
                // --------------------------------------
                // where: p_0 = 0, p_1 = u0x, p_2 = u1x, p_3 = 1
                // Especially, when both tangents are 1, we will have u0x = 1/3 and u1x = 2/3
                // and then: ratio = t, eg. the ratios are
                // 1-1 corresponding to param t. That's why we can do optimization like above.
                std::array<RealKeyframeValue::Value, 4> coeffs = {
                    0.0 - ratio,            // 0
                    3.0 * u0x,              // 1
                    3.0 * u1x - 6.0 * u0x,  // -1
                    3.0 * (u0x - u1x) + 1.0 // 1
                };
                // Solves the param t from equation X(t) = ratio.
                const auto solveResult = solveCubic(coeffs);
                const auto nSolutions  = solveResult.second;
                const auto solutions   = solveResult.first;
                const auto param       = getParamFromCubicSolution(solutions, nSolutions, ratio);
                // Solves Y.
                const auto y = bezierInterpolate(prevValue.value, u0y, u1y, nextValue.value, param);
                return y;
            }
        }
    }
}

RealCurve::Value linearTrend(
    RealCurve::Time  prevTime,
    RealCurve::Value prevValue,
    RealCurve::Time  nextTime,
    RealCurve::Value nextValue,
    RealCurve::Time  time) {
    const auto slope = (nextValue - prevValue) / (nextTime - prevTime);
    return prevValue + (time - prevTime) * slope;
}
} // namespace

RealCurve::Value RealCurve::evaluate(Time time) const {
#ifdef CURVE_DEBUG
    std::cout
        << "Evaluaing " << time << "from: \n"
        << "keyframeCount: " << this->keyFramesCount()
        << " | preExtrapolation:" << this->getPreExtrapolation()
        << " | postExtrapolation:" << this->getPostExtrapolation()
        << " | keyframes: "
        << "\n";
    for (int i = 0; i < this->keyFramesCount(); ++i) {
        std::cout << "time: " << this->getTime(i) << " | " << this->getKeyframeValue(i) << "\n";
    }
#endif
    const auto nKeyframes = this->keyFramesCount();

    if (nKeyframes == 0) {
        return 0.0;
    }

    const auto firstTime = this->getTime(0);
    const auto iLast     = nKeyframes - 1;
    const auto lastTime  = this->getTime(iLast);
    if (time < this->rangeMin()) {
#ifdef CURVE_DEBUG
        std::cout << "Less than rangeMin"
                  << "\n";
#endif
        if (this->_preExtrapolation == ExtrapolationMode::CLAMP || nKeyframes < 2) {
            return this->getKeyframeValue(0).value;
        }
        switch (this->_preExtrapolation) {
            case ExtrapolationMode::LINEAR:
                return linearTrend(
                    firstTime,
                    this->getKeyframeValue(0).value,
                    this->getTime(1),
                    this->getKeyframeValue(1).value,
                    time);
            case ExtrapolationMode::LOOP:
                time = wrapRepeat(time, firstTime, lastTime);
                break;
            case ExtrapolationMode::PING_PONG:
                time = wrapPingPong(time, firstTime, lastTime);
                break;
            default:
                return this->getKeyframeValue(0).value;
        }
    } else if (time > this->rangeMax()) {
#ifdef CURVE_DEBUG
        std::cout << "Greater than rangeMax"
                  << "\n";
#endif
        if (this->_postExtrapolation == ExtrapolationMode::CLAMP || nKeyframes < 2) {
            return this->getKeyframeValue(iLast).value;
        }
        switch (this->_postExtrapolation) {
            case ExtrapolationMode::LINEAR:
                return linearTrend(
                    lastTime,
                    this->getKeyframeValue(iLast).value,
                    this->getTime(iLast - 1),
                    this->getKeyframeValue(iLast - 1).value,
                    time);
            case ExtrapolationMode::LOOP:
                time = wrapRepeat(time, firstTime, lastTime);
                break;
            case ExtrapolationMode::PING_PONG:
                time = wrapPingPong(time, firstTime, lastTime);
                break;
            default:
                return this->getKeyframeValue(iLast).value;
        }
    }

    const auto iter  = std::lower_bound(timesBegin(), timesEnd(), time);
    const auto iNext = static_cast<Size>(iter - timesBegin());
    assert(iter != timesEnd());

#ifdef CURVE_DEBUG
    std::cout << "iNext: " << iNext << "\n";
#endif

    if (*iter == time) {
        return getKeyframeValue(iNext).value;
    }

    assert(iNext != 0);
    const auto iPrev = iNext - 1;

    const auto preTime   = getTime(iPrev);
    const auto preValue  = getKeyframeValue(iPrev);
    const auto nextTime  = getTime(iNext);
    const auto nextValue = getKeyframeValue(iNext);
    assert(nextTime > time && time > preTime);
    const auto dt = nextTime - preTime;

    const auto ratio = (time - preTime) / dt;
    return evalBetweenTwoKeyFrames(preTime, preValue, nextTime, nextValue, ratio);

    return 0.0;
}

namespace {
constexpr std::size_t FLAGS_EASING_METHOD_BITS_START = 8;
constexpr std::size_t FLAG_EASING_METHOD_MASK        = 0xFF << FLAGS_EASING_METHOD_BITS_START; // 8-16 bits

enum class KeyframeValueFlag {
    VALUE                = 0,
    INTERPOLATION_MODE   = 1,
    TANGENT_WEIGHT_MODE  = 2,
    LEFT_TANGENT         = 3,
    LEFT_TANGENT_WEIGHT  = 4,
    RIGHT_TANGENT        = 5,
    RIGHT_TANGENT_WEIGHT = 6,
};

using OverflowSerializedType           = std::uint8_t;
using FrameCountSerializedType         = std::uint32_t;
using TimeSerializedType               = float;
using KeyframeValueFlagsSerializedType = std::uint32_t;
using ValueSerializedType              = float;
using LeftTangentSerializedType        = float;
using LeftTangentWeightSerializedType  = float;
using RightTangentSerializedType       = float;
using RightTangentWeightSerializedType = float;
using InterpolationModeSerializedType  = std::uint8_t;
using TangentWeightModeSerializedType  = std::uint8_t;

constexpr std::size_t REAL_KEY_FRAME_VALUE_MAX_SIZE =
    sizeof(KeyframeValueFlagsSerializedType) +
    sizeof(ValueSerializedType) +
    sizeof(InterpolationModeSerializedType) +
    sizeof(TangentWeightModeSerializedType) +
    sizeof(LeftTangentSerializedType) +
    sizeof(LeftTangentWeightSerializedType) +
    sizeof(RightTangentSerializedType) +
    sizeof(RightTangentWeightSerializedType) +
    0;

const RealKeyframeValue defaultConstructedRealKeyframeValue;

const auto DEFAULT_INTERPOLATION_MODE   = defaultConstructedRealKeyframeValue.interpolationMode;
const auto DEFAULT_TANGENT_WEIGHT_MODE  = defaultConstructedRealKeyframeValue.tangentWeightMode;
const auto DEFAULT_LEFT_TANGENT         = defaultConstructedRealKeyframeValue.leftTangent;
const auto DEFAULT_LEFT_TANGENT_WEIGHT  = defaultConstructedRealKeyframeValue.leftTangentWeight;
const auto DEFAULT_RIGHT_TANGENT        = defaultConstructedRealKeyframeValue.rightTangent;
const auto DEFAULT_RIGHT_TANGENT_WEIGHT = defaultConstructedRealKeyframeValue.rightTangentWeight;

// Helper for real curve serialization
// TODO: more generality
class OutputArchive {
public:
    OutputArchive(std::size_t maxSize) : _size(0), _bytes(maxSize, static_cast<std::uint8_t>(0)) {
    }

    template <typename T, typename = std::enable_if_t<std::is_arithmetic<T>::value>>
    OutputArchive &operator<<(T value) {
        *reinterpret_cast<T *>(_bytes.data() + _size) = value;
        _size += sizeof(value);
        return *this;
    }

    std::vector<std::uint8_t> bytes() const {
        return std::vector<std::uint8_t>(this->_bytes.begin(), this->_bytes.begin() + this->_size);
    }

private:
    std::size_t               _size;
    std::vector<std::uint8_t> _bytes;
};

class InputArchive {
public:
    InputArchive(const std::uint8_t *bytes) : _size(0), _bytes(bytes) {
    }

    template <typename T, typename = std::enable_if_t<std::is_arithmetic<T>::value>>
    InputArchive &operator>>(T &value) {
        value = *reinterpret_cast<const T *>(_bytes + _size);
        _size += sizeof(value);
        return *this;
    }

#ifdef CURVE_DEBUG
    std::size_t position() const {
        return _size;
    }
#endif

private:
    std::size_t         _size;
    const std::uint8_t *_bytes;
};

template <typename Target, typename Source>
struct StaticCastBeforeArchive {
    StaticCastBeforeArchive(Source &source_) : source(source_) {
    }

    Source &source;
};

template <typename Target, typename Source>
StaticCastBeforeArchive<Target, Source> staticCastAfterUnarchive(Source &source) {
    return source;
}

template <typename Target, typename Source>
InputArchive &operator>>(InputArchive &archive, const StaticCastBeforeArchive<Target, Source> value) {
    Target target = Target();
    archive >> target;
    value.source = static_cast<Source>(target);
    return archive;
}

OutputArchive &operator<<(OutputArchive &archive, const RealKeyframeValue &keyframeValue) {
    bool isNotDefaultInterpolationMode  = keyframeValue.interpolationMode != DEFAULT_INTERPOLATION_MODE;
    bool isNotDefaultTangentWeightMode  = keyframeValue.tangentWeightMode != DEFAULT_TANGENT_WEIGHT_MODE;
    bool isNotDefaultLeftTangent        = keyframeValue.leftTangent != DEFAULT_LEFT_TANGENT;
    bool isNotDefaultLeftTangentWeight  = keyframeValue.leftTangentWeight != DEFAULT_LEFT_TANGENT_WEIGHT;
    bool isNotDefaultRightTangent       = keyframeValue.rightTangent != DEFAULT_RIGHT_TANGENT;
    bool isNotDefaultRightTangentWeight = keyframeValue.rightTangentWeight != DEFAULT_RIGHT_TANGENT_WEIGHT;

    std::bitset<sizeof(KeyframeValueFlagsSerializedType) * CHAR_BIT> flags;
    const auto                                                       setFlag = [&flags](KeyframeValueFlag flag) {
        flags.set(static_cast<std::size_t>(flag));
    };
    if (isNotDefaultInterpolationMode) {
        setFlag(KeyframeValueFlag::INTERPOLATION_MODE);
    }
    if (isNotDefaultTangentWeightMode) {
        setFlag(KeyframeValueFlag::TANGENT_WEIGHT_MODE);
    }
    if (isNotDefaultLeftTangent) {
        setFlag(KeyframeValueFlag::LEFT_TANGENT);
    }
    if (isNotDefaultLeftTangentWeight) {
        setFlag(KeyframeValueFlag::LEFT_TANGENT_WEIGHT);
    }
    if (isNotDefaultRightTangent) {
        setFlag(KeyframeValueFlag::RIGHT_TANGENT);
    }
    if (isNotDefaultRightTangentWeight) {
        setFlag(KeyframeValueFlag::RIGHT_TANGENT_WEIGHT);
    }
    flags |= (static_cast<KeyframeValueFlagsSerializedType>(keyframeValue.easingMethod) << FLAGS_EASING_METHOD_BITS_START);
    archive << static_cast<KeyframeValueFlagsSerializedType>(flags.to_ulong());

#ifdef CURVE_DEBUG
    std::cout << "Write Flags: " << std::bitset<32>(flags) << "\n";
#endif

    archive << static_cast<ValueSerializedType>(keyframeValue.value);

    if (isNotDefaultInterpolationMode) {
        archive << static_cast<InterpolationModeSerializedType>(keyframeValue.interpolationMode);
    }

    if (isNotDefaultTangentWeightMode) {
        archive << static_cast<TangentWeightModeSerializedType>(keyframeValue.tangentWeightMode);
    }

    if (isNotDefaultLeftTangent) {
        archive << static_cast<LeftTangentSerializedType>(keyframeValue.leftTangent);
    }

    if (isNotDefaultLeftTangentWeight) {
        archive << static_cast<LeftTangentWeightSerializedType>(keyframeValue.leftTangentWeight);
    }

    if (isNotDefaultRightTangent) {
        archive << static_cast<RightTangentSerializedType>(keyframeValue.rightTangent);
    }

    if (isNotDefaultRightTangentWeight) {
        archive << static_cast<RightTangentWeightSerializedType>(keyframeValue.rightTangentWeight);
    }

    return archive;
}

InputArchive &operator>>(InputArchive &archive, RealKeyframeValue &keyframeValue) {
#ifdef CURVE_DEBUG
    std::cout << "Position: " << archive.position() << "\n";
#endif
    KeyframeValueFlagsSerializedType flags = 0;
    archive >> flags;
    const auto isFlagSet = [&flags](KeyframeValueFlag flag) -> bool {
        return flags & (1 << static_cast<std::size_t>(flag));
    };
#ifdef CURVE_DEBUG
    std::cout << "Read Flags: " << std::bitset<32>(flags) << "\n";
#endif

    archive >> staticCastAfterUnarchive<ValueSerializedType>(keyframeValue.value);

    if (isFlagSet(KeyframeValueFlag::INTERPOLATION_MODE)) {
        archive >> staticCastAfterUnarchive<InterpolationModeSerializedType>(keyframeValue.interpolationMode);
    }

    if (isFlagSet(KeyframeValueFlag::TANGENT_WEIGHT_MODE)) {
        archive >> staticCastAfterUnarchive<TangentWeightModeSerializedType>(keyframeValue.tangentWeightMode);
    }

    if (isFlagSet(KeyframeValueFlag::LEFT_TANGENT)) {
        archive >> staticCastAfterUnarchive<LeftTangentSerializedType>(keyframeValue.leftTangent);
    }

    if (isFlagSet(KeyframeValueFlag::LEFT_TANGENT_WEIGHT)) {
        archive >> staticCastAfterUnarchive<LeftTangentWeightSerializedType>(keyframeValue.leftTangentWeight);
    }

    if (isFlagSet(KeyframeValueFlag::RIGHT_TANGENT)) {
        archive >> staticCastAfterUnarchive<RightTangentSerializedType>(keyframeValue.rightTangent);
    }

    if (isFlagSet(KeyframeValueFlag::RIGHT_TANGENT_WEIGHT)) {
        archive >> staticCastAfterUnarchive<RightTangentWeightSerializedType>(keyframeValue.rightTangentWeight);
    }

    const auto easingMethod    = static_cast<EasingMethod>((flags & FLAG_EASING_METHOD_MASK) >> FLAGS_EASING_METHOD_BITS_START);
    keyframeValue.easingMethod = easingMethod;

    return archive;
}

OutputArchive &operator<<(OutputArchive &archive, const RealCurve &curve) {
    // Overflow operations
    archive << static_cast<OverflowSerializedType>(curve.getPreExtrapolation());
    archive << static_cast<OverflowSerializedType>(curve.getPostExtrapolation());

    // Frame count
    const auto nKeyframes = curve.keyFramesCount();
    archive << static_cast<FrameCountSerializedType>(nKeyframes);

#ifdef CURVE_DEBUG
    std::cout << "nKeyframes: " << nKeyframes << "\n";
#endif

    // Times
    for (std::remove_const_t<decltype(nKeyframes)> iKeyframe = 0; iKeyframe < nKeyframes; ++iKeyframe) {
        archive << static_cast<TimeSerializedType>(curve.getTime(iKeyframe));
    }

    // Frame values
    for (std::remove_const_t<decltype(nKeyframes)> iKeyframe = 0; iKeyframe < nKeyframes; ++iKeyframe) {
        archive << curve.getKeyframeValue(iKeyframe);
    }

    return archive;
}

InputArchive &operator>>(InputArchive &archive, RealCurve &curve) {
    // Overflow operations
    ExtrapolationMode preExtrapolation;
    archive >> staticCastAfterUnarchive<OverflowSerializedType>(preExtrapolation);
    curve.setPreExtrapolation(preExtrapolation);
    ExtrapolationMode postExtrapolation;
    archive >> staticCastAfterUnarchive<OverflowSerializedType>(postExtrapolation);
    curve.setPostExtrapolation(postExtrapolation);

    // Frame count
    FrameCountSerializedType nKeyframes = 0;
    archive >> nKeyframes;

#ifdef CURVE_DEBUG
    std::cout << "nKeyframes: " << nKeyframes << "\n";
#endif

    // Times
    std::vector<RealCurve::Time> times(nKeyframes, 0);
    for (std::remove_const_t<decltype(nKeyframes)> iKeyframe = 0; iKeyframe < nKeyframes; ++iKeyframe) {
        archive >> staticCastAfterUnarchive<TimeSerializedType>(times[iKeyframe]);
    }

#ifdef CURVE_DEBUG
    std::cout << "Times(" << times.size() << "):";
    for (auto t : times) {
        std::cout << " " << t;
    }
    std::cout << "\n";
#endif

    // Frame values
    std::vector<RealKeyframeValue> keyframeValues(nKeyframes);
    for (std::remove_const_t<decltype(nKeyframes)> iKeyframe = 0; iKeyframe < nKeyframes; ++iKeyframe) {
        archive >> keyframeValues[iKeyframe];
    }

    curve.assign(times.begin(), times.end(), keyframeValues.begin(), keyframeValues.end());

    return archive;
}
} // namespace

std::vector<std::uint8_t> serialize(const RealCurve &curve) {
    const auto nKeyframes = curve.keyFramesCount();

    const auto dataSize = 0 +
                          sizeof(OverflowSerializedType) +
                          sizeof(OverflowSerializedType) +
                          sizeof(FrameCountSerializedType) +
                          sizeof(TimeSerializedType) * nKeyframes +
                          REAL_KEY_FRAME_VALUE_MAX_SIZE * nKeyframes;

    OutputArchive archive(dataSize);
    archive << curve;

    return archive.bytes();
}

void deserialize(std::vector<std::uint8_t> bytes, RealCurve &curve) {
    InputArchive archive(bytes.data());

    archive >> curve;
}
} // namespace cc
