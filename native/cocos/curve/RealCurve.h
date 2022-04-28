#include "./Curve.h"
#include "base/Macros.h"

#ifdef __EMSCRIPTEN__
    #include <emscripten/val.h>
    #include <memory>
#endif

namespace cc {
/**
 * @en
 * The method used for interpolation method between value of a keyframe and its next keyframe.
 * @zh
 * 在某关键帧（前一帧）和其下一帧之间插值时使用的插值方式。
 */
enum class RealInterpolationMode {
    /**
     * @en
     * Perform linear interpolation between previous keyframe value and next keyframe value.
     * @zh
     * 在前一帧和后一帧之间执行线性插值。
     */
    LINEAR,

    /**
     * @en
     * Always use the value from this keyframe.
     * @zh
     * 永远使用前一帧的值。
     */
    CONSTANT,

    /**
     * @en
     * Perform cubic(hermite) interpolation between previous keyframe value and next keyframe value.
     * @zh
     * 在前一帧和后一帧之间执行立方插值。
     */
    CUBIC,
};

/**
 * @en
 * Specifies both side tangent weight mode of a keyframe value.
 * @zh
 * 指定关键帧两侧的切线权重模式。
 */
enum class TangentWeightMode {
    /**
     * @en
     * Neither side of the keyframe carries tangent weight information.
     * @zh
     * 关键帧的两侧都不携带切线权重信息。
     */
    NONE = 0,

    /**
     * @en
     * Only left side of the keyframe carries tangent weight information.
     * @zh
     * 仅关键帧的左侧携带切线权重信息。
     */
    LEFT = 1,

    /**
     * @en
     * Only right side of the keyframe carries tangent weight information.
     * @zh
     * 仅关键帧的右侧携带切线权重信息。
     */
    RIGHT = 2,

    /**
     * @en
     * Both sides of the keyframe carries tangent weight information.
     * @zh
     * 关键帧的两侧都携带切线权重信息。
     */
    BOTH = 1 | 2,
};

enum class EasingMethod {
    LINEAR,
    CONSTANT,
    QUAD_IN,
    QUAD_OUT,
    QUAD_IN_OUT,
    QUAD_OUT_IN,
    CUBIC_IN,
    CUBIC_OUT,
    CUBIC_IN_OUT,
    CUBIC_OUT_IN,
    QUART_IN,
    QUART_OUT,
    QUART_IN_OUT,
    QUART_OUT_IN,
    QUINT_IN,
    QUINT_OUT,
    QUINT_IN_OUT,
    QUINT_OUT_IN,
    SINE_IN,
    SINE_OUT,
    SINE_IN_OUT,
    SINE_OUT_IN,
    EXPO_IN,
    EXPO_OUT,
    EXPO_IN_OUT,
    EXPO_OUT_IN,
    CIRC_IN,
    CIRC_OUT,
    CIRC_IN_OUT,
    CIRC_OUT_IN,
    ELASTIC_IN,
    ELASTIC_OUT,
    ELASTIC_IN_OUT,
    ELASTIC_OUT_IN,
    BACK_IN,
    BACK_OUT,
    BACK_IN_OUT,
    BACK_OUT_IN,
    BOUNCE_IN,
    BOUNCE_OUT,
    BOUNCE_IN_OUT,
    BOUNCE_OUT_IN,
    SMOOTH,
    FADE,

    _COUNT,
};

struct EditorExtendable {
#ifdef __EMSCRIPTEN__
    emscripten::val editorExtras = emscripten::val::undefined();
#endif
};

struct RealKeyframeValue : public EditorExtendable {
    using Value = double;

    /**
     * @en
     * When perform interpolation, the interpolation method should be taken
     * when for this keyframe is used as starting keyframe.
     * @zh
     * 在执行插值时，当以此关键帧作为起始关键帧时应当使用的插值方式。
     */
    RealInterpolationMode interpolationMode = RealInterpolationMode::LINEAR;

    /**
     * @en
     * Tangent weight mode when perform cubic interpolation
     * This field is regarded if current interpolation mode is not cubic.
     * @zh
     * 当执行三次插值时，此关键帧使用的切线权重模式。
     * 若当前的插值模式不是三次插值时，该字段无意义。
     */
    TangentWeightMode tangentWeightMode = TangentWeightMode::NONE;

    /**
     * @en
     * Value of the keyframe.
     * @zh
     * 该关键帧的值。
     */
    Value value = 0.0;

    /**
     * @en
     * The tangent of this keyframe
     * when it's used as starting point during cubic interpolation.
     * Regarded otherwise.
     * @zh
     * 当此关键帧作为三次插值的起始点时，此关键帧的切线。其他情况下该字段无意义。
     */
    Value rightTangent = 0.0;

    /**
     * @en
     * The tangent weight of this keyframe
     * when it's used as starting point during weighted cubic interpolation.
     * Regarded otherwise.
     * @zh
     * 当此关键帧作为三次插值的起始点时，此关键帧的切线权重。其他情况下该字段无意义。
     */
    Value rightTangentWeight = 0.0;

    /**
     * @en
     * The tangent of this keyframe
     * when it's used as ending point during cubic interpolation.
     * Regarded otherwise.
     * @zh
     * 当此关键帧作为三次插值的目标点时，此关键帧的切线。其他情况下该字段无意义。
     */
    Value leftTangent = 0.0;

    /**
     * @en
     * The tangent weight of this keyframe
     * when it's used as ending point during weighted cubic interpolation.
     * Regarded otherwise.
     * @zh
     * 当此关键帧作为三次插值的目标点时，此关键帧的切线权重。其他情况下该字段无意义。
     */
    Value leftTangentWeight = 0.0;

    /**
     * @deprecated Reserved for backward compatibility. Will be removed in future.
     */
    EasingMethod easingMethod = EasingMethod::LINEAR;
};

class CC_DLL RealCurve : public KeyframeCurve<RealKeyframeValue> {
public:
    using Value = RealKeyframeValue::Value;

    ExtrapolationMode getPreExtrapolation() const {
        return this->_preExtrapolation;
    }

    void setPreExtrapolation(ExtrapolationMode value) {
        this->_preExtrapolation = value;
    }

    ExtrapolationMode getPostExtrapolation() const {
        return this->_postExtrapolation;
    }

    void setPostExtrapolation(ExtrapolationMode value) {
        this->_postExtrapolation = value;
    }

    Value evaluate(Time time) const;

private:
    ExtrapolationMode _preExtrapolation  = ExtrapolationMode::CLAMP;
    ExtrapolationMode _postExtrapolation = ExtrapolationMode::CLAMP;
};

std::vector<std::uint8_t> serialize(const RealCurve &curve);

void deserialize(std::vector<std::uint8_t> bytes, RealCurve &curve);
} // namespace cc

#ifdef CURVE_DEBUG
namespace std {
inline std::ostream &operator<<(std::ostream &os, const cc::ExtrapolationMode &value) {
    const char *name = nullptr;
    switch (value) {
        case cc::ExtrapolationMode::CLAMP: name = "clamp"; break;
        case cc::ExtrapolationMode::LINEAR: name = "linear"; break;
        case cc::ExtrapolationMode::LOOP: name = "loop"; break;
        case cc::ExtrapolationMode::PING_PONG: name = "ping-pong"; break;
    }
    return os << name;
}

inline std::ostream &operator<<(std::ostream &os, const cc::RealInterpolationMode &value) {
    const char *name = nullptr;
    switch (value) {
        case cc::RealInterpolationMode::LINEAR: name = "linear"; break;
        case cc::RealInterpolationMode::CONSTANT: name = "constant"; break;
        case cc::RealInterpolationMode::CUBIC: name = "cubic"; break;
    }
    return os << name;
}

inline std::ostream &operator<<(std::ostream &os, const cc::RealKeyframeValue &value) {
    return os << "value: " << value.value << " | interop: " << value.interpolationMode << "\n";
}
} // namespace std
#endif
