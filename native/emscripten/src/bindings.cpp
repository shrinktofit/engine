#include <emscripten/bind.h>
#include <memory>
#include "../../cocos/curve/Curve.h"
#include "../../cocos/curve/RealCurve.h"

#ifndef NDEBUG
    #include <iostream>
#endif

template <typename Ty>
struct single_iterator {
    using iterator_category = std::random_access_iterator_tag;

    using difference_type = std::ptrdiff_t;

    using value_type = Ty;

    using pointer = value_type *;

    using reference = value_type &;

    single_iterator(value_type *ptr_) : _ptr(ptr_), _remain(0) {}

    single_iterator(value_type *ptr_, std::size_t count_) : _ptr(ptr_), _remain(count_) {}

    const value_type &operator*() const {
        return *_ptr;
    }

    value_type &operator*() {
        return *_ptr;
    }

    const value_type *operator->() const {
        return _ptr;
    }

    value_type *operator->() {
        return _ptr;
    }

    single_iterator operator++() {
        return single_iterator(_ptr, _remain--);
    }

    single_iterator &operator++(int) {
        ++_remain;
        return *this;
    }

    single_iterator &operator+=(difference_type n) {
        this->_remain += n;
        return *this;
    }

    single_iterator operator+(difference_type n) const {
        single_iterator temp = *this;
        return temp += n;
    }

    single_iterator &operator-=(difference_type n) {
        return *this += -n;
    }

    single_iterator operator-(difference_type n) const {
        auto temp = *this;
        return temp -= n;
    }

    difference_type operator-(const single_iterator &other) const {
        return this->_remain - other._remain;
    }

    value_type &operator[](difference_type n) {
        return *(*this + n);
    }

    const value_type &operator[](difference_type n) const {
        return *(*this + n);
    }

    bool operator==(const single_iterator &other) const {
        return this->_ptr == other._ptr && this->_remain == other._remain;
    }

    bool operator!=(const single_iterator &other) const {
        return !(*this == other);
    }

private:
    Ty *_ptr = nullptr;

    std::size_t _remain = 0;
};

EMSCRIPTEN_BINDINGS(cc) {
    emscripten::class_<cc::EditorExtendable>("EditorExtendable")
        .property("editorExtras", &cc::EditorExtendable::editorExtras);

    emscripten::enum_<cc::ExtrapolationMode>("ExtrapolationMode")
        .value("LINEAR", cc::ExtrapolationMode::LINEAR)
        .value("CLAMP", cc::ExtrapolationMode::CLAMP)
        .value("LOOP", cc::ExtrapolationMode::LOOP)
        .value("PING_PONG", cc::ExtrapolationMode::PING_PONG);

    emscripten::enum_<cc::RealInterpolationMode>("RealInterpolationMode")
        .value("LINEAR", cc::RealInterpolationMode::LINEAR)
        .value("CONSTANT", cc::RealInterpolationMode::CONSTANT)
        .value("CUBIC", cc::RealInterpolationMode::CUBIC);

    emscripten::enum_<cc::TangentWeightMode>("TangentWeightMode")
        .value("NONE", cc::TangentWeightMode::NONE)
        .value("LEFT", cc::TangentWeightMode::LEFT)
        .value("RIGHT", cc::TangentWeightMode::RIGHT)
        .value("BOTH", cc::TangentWeightMode::BOTH);

    emscripten::enum_<cc::EasingMethod>("EasingMethod")
        .value("LINEAR", cc::EasingMethod::LINEAR)
        .value("CONSTANT", cc::EasingMethod::CONSTANT)
        .value("QUAD_IN", cc::EasingMethod::QUAD_IN)
        .value("QUAD_OUT", cc::EasingMethod::QUAD_OUT)
        .value("QUAD_IN_OUT", cc::EasingMethod::QUAD_IN_OUT)
        .value("QUAD_OUT_IN", cc::EasingMethod::QUAD_OUT_IN)
        .value("CUBIC_IN", cc::EasingMethod::CUBIC_IN)
        .value("CUBIC_OUT", cc::EasingMethod::CUBIC_OUT)
        .value("CUBIC_IN_OUT", cc::EasingMethod::CUBIC_IN_OUT)
        .value("CUBIC_OUT_IN", cc::EasingMethod::CUBIC_OUT_IN)
        .value("QUART_IN", cc::EasingMethod::QUART_IN)
        .value("QUART_OUT", cc::EasingMethod::QUART_OUT)
        .value("QUART_IN_OUT", cc::EasingMethod::QUART_IN_OUT)
        .value("QUART_OUT_IN", cc::EasingMethod::QUART_OUT_IN)
        .value("QUINT_IN", cc::EasingMethod::QUINT_IN)
        .value("QUINT_OUT", cc::EasingMethod::QUINT_OUT)
        .value("QUINT_IN_OUT", cc::EasingMethod::QUINT_IN_OUT)
        .value("QUINT_OUT_IN", cc::EasingMethod::QUINT_OUT_IN)
        .value("SINE_IN", cc::EasingMethod::SINE_IN)
        .value("SINE_OUT", cc::EasingMethod::SINE_OUT)
        .value("SINE_IN_OUT", cc::EasingMethod::SINE_IN_OUT)
        .value("SINE_OUT_IN", cc::EasingMethod::SINE_OUT_IN)
        .value("EXPO_IN", cc::EasingMethod::EXPO_IN)
        .value("EXPO_OUT", cc::EasingMethod::EXPO_OUT)
        .value("EXPO_IN_OUT", cc::EasingMethod::EXPO_IN_OUT)
        .value("EXPO_OUT_IN", cc::EasingMethod::EXPO_OUT_IN)
        .value("CIRC_IN", cc::EasingMethod::CIRC_IN)
        .value("CIRC_OUT", cc::EasingMethod::CIRC_OUT)
        .value("CIRC_IN_OUT", cc::EasingMethod::CIRC_IN_OUT)
        .value("CIRC_OUT_IN", cc::EasingMethod::CIRC_OUT_IN)
        .value("ELASTIC_IN", cc::EasingMethod::ELASTIC_IN)
        .value("ELASTIC_OUT", cc::EasingMethod::ELASTIC_OUT)
        .value("ELASTIC_IN_OUT", cc::EasingMethod::ELASTIC_IN_OUT)
        .value("ELASTIC_OUT_IN", cc::EasingMethod::ELASTIC_OUT_IN)
        .value("BACK_IN", cc::EasingMethod::BACK_IN)
        .value("BACK_OUT", cc::EasingMethod::BACK_OUT)
        .value("BACK_IN_OUT", cc::EasingMethod::BACK_IN_OUT)
        .value("BACK_OUT_IN", cc::EasingMethod::BACK_OUT_IN)
        .value("BOUNCE_IN", cc::EasingMethod::BOUNCE_IN)
        .value("BOUNCE_OUT", cc::EasingMethod::BOUNCE_OUT)
        .value("BOUNCE_IN_OUT", cc::EasingMethod::BOUNCE_IN_OUT)
        .value("BOUNCE_OUT_IN", cc::EasingMethod::BOUNCE_OUT_IN)
        .value("SMOOTH", cc::EasingMethod::SMOOTH)
        .value("FADE", cc::EasingMethod::FADE);

    emscripten::class_<cc::RealKeyframeValue, emscripten::base<cc::EditorExtendable>>("RealKeyframeValue")
        .constructor()
        .property("interpolationMode", &cc::RealKeyframeValue::interpolationMode)
        .property("tangentWeightMode", &cc::RealKeyframeValue::tangentWeightMode)
        .property("value", &cc::RealKeyframeValue::value)
        .property("rightTangent", &cc::RealKeyframeValue::rightTangent)
        .property("rightTangentWeight", &cc::RealKeyframeValue::rightTangentWeight)
        .property("leftTangent", &cc::RealKeyframeValue::leftTangent)
        .property("leftTangentWeight", &cc::RealKeyframeValue::leftTangentWeight)
        .property("easingMethod", &cc::RealKeyframeValue::easingMethod);

    emscripten::class_<cc::KeyframeCurve<cc::RealKeyframeValue>>("RealCurveBase")
        .constructor()
        // NO NEED!
        // .function("keyFramesCount", &cc::RealCurve::keyFramesCount)
        // .function("rangeMin", &cc::RealCurve::rangeMin)
        // .function("rangeMax", &cc::RealCurve::rangeMax)
        // .function("clear", &cc::RealCurve::clear)
        ;

    emscripten::class_<cc::RealCurve, /* IMPORTANT */ emscripten::base<cc::KeyframeCurve<cc::RealKeyframeValue>>>("RealCurve")
        .constructor()
        .property("preExtrapolation", &cc::RealCurve::getPreExtrapolation, &cc::RealCurve::setPreExtrapolation)
        .property("postExtrapolation", &cc::RealCurve::getPostExtrapolation, &cc::RealCurve::setPostExtrapolation)
        .function("evaluate", &cc::RealCurve::evaluate)
        .property("keyFramesCount", &cc::RealCurve::keyFramesCount)
        .function("rangeMin", &cc::RealCurve::rangeMin)
        .function("rangeMax", &cc::RealCurve::rangeMax)
        .function("resize", emscripten::select_overload<void(cc::RealCurve &, cc::RealCurve::Size size, std::uintptr_t times)>([](cc::RealCurve &curve, cc::RealCurve::Size size, std::uintptr_t times) {
                      const auto t = reinterpret_cast<const cc::RealCurve::Time *>(times);
#ifdef CURVE_DEBUG
                      std::cout << "Resize with " << size << " times :";
                      for (int i = 0; i < size; ++i) {
                          std::cout << " " << t[i];
                      }
                      std::cout << "\n";
#endif
                      cc::RealKeyframeValue keyframeValue;
                      curve.assign(
                          t,
                          t + size,
                          single_iterator<cc::RealKeyframeValue>(&keyframeValue),
                          single_iterator<cc::RealKeyframeValue>(&keyframeValue, size));
                  }),
                  emscripten::allow_raw_pointers())
        .function("insertKeyframe", &cc::RealCurve::insertKeyframe)
        .function("getKeyframeTime", &cc::RealCurve::getTime)
        .function("getKeyframeValue", emscripten::select_overload<cc::RealCurve::KeyframeValue *(cc::RealCurve &, cc::RealCurve::Size)>([](cc::RealCurve &curve, cc::RealCurve::Size index) -> cc::RealCurve::KeyframeValue * {
                      // Returns a reference do copy the object.
                      // See: https://github.com/emscripten-core/emscripten/issues/3480
                      // https://groups.google.com/g/emscripten-discuss/c/-zRu1bFLsCg
                      return &curve.getKeyframeValue(index);
                  }),
                  emscripten::allow_raw_pointers())
        .function("indexOfKeyframe", &cc::RealCurve::indexOf)
        .function("updateTime", &cc::RealCurve::updateTime)
        .function("clear", &cc::RealCurve::clear)
        .function("serializeBinary", emscripten::select_overload<emscripten::val(const cc::RealCurve &)>(
                                         [](const cc::RealCurve &curve) -> emscripten::val {
                                             const auto bytes = cc::serialize(curve);
#ifdef CURVE_DEBUG
                                             std::cout << "Serialize bytes: " << bytes.size() << ":";
                                             for (auto b : bytes) {
                                                 std::cout << " " << static_cast<int>(b);
                                             }
                                             std::cout << "\n";
#endif
                                             const auto heap            = emscripten::val::module_property("HEAPU8");
                                             const auto localUint8Array = emscripten::val::global("Uint8Array").new_(heap["buffer"], reinterpret_cast<std::uintptr_t>(bytes.data()), bytes.size());

                                             const auto hostUint8Array = emscripten::val::global("Uint8Array").new_(bytes.size());
                                             hostUint8Array.call<void>("set", localUint8Array);
                                             return hostUint8Array;
                                         }))
        .function("deserializeBinary", emscripten::select_overload<void(cc::RealCurve &, std::uintptr_t, std::size_t)>(
                                           [](cc::RealCurve &curve, std::uintptr_t bytes_, std::size_t size) -> void {
                                               const auto                bytesPtr = reinterpret_cast<const std::uint8_t *>(bytes_);
                                               std::vector<std::uint8_t> bytes(bytesPtr, bytesPtr + size);
#ifdef CURVE_DEBUG
                                               std::cout << "Deserialize bytes: " << bytes.size() << ":";
                                               for (auto b : bytes) {
                                                   std::cout << " " << static_cast<int>(b);
                                               }
                                               std::cout << "\n";
#endif
                                               cc::deserialize(bytes, curve);
                                           }))

        ;
}