#pragma once
#include <cmath>
#include <functional>

namespace cc {
namespace easing {
namespace {
template <typename Ty>
constexpr Ty pi = Ty(3.1415926535897932385L);
}

template <typename Ty>
Ty constant(Ty k) {
    return static_cast<Ty>(0);
}

template <typename Ty>
Ty linear(Ty k) {
    return k;
}

template <typename Ty>
Ty quadIn(Ty k) {
    return k * k;
}

template <typename Ty>
Ty quadOut(Ty k) {
    return k * (2 - k);
}

template <typename Ty>
Ty quadInOut(Ty k) {
    k *= 2;
    if (k < 1) {
        return 0.5 * k * k;
    }
    return -0.5 * (--k * (k - 2) - 1);
}

template <typename Ty>
Ty cubicIn(Ty k) {
    return k * k * k;
}

template <typename Ty>
Ty cubicOut(Ty k) {
    return --k * k * k + 1;
}

template <typename Ty>
Ty cubicInOut(Ty k) {
    k *= 2;
    if (k < 1) {
        return 0.5 * k * k * k;
    }
    return 0.5 * ((k -= 2) * k * k + 2);
}

template <typename Ty>
Ty quartIn(Ty k) {
    return k * k * k * k;
}

template <typename Ty>
Ty quartOut(Ty k) {
    return 1 - (--k * k * k * k);
}

template <typename Ty>
Ty quartInOut(Ty k) {
    k *= 2;
    if (k < 1) {
        return 0.5 * k * k * k * k;
    }
    return -0.5 * ((k -= 2) * k * k * k - 2);
}

template <typename Ty>
Ty quintIn(Ty k) {
    return k * k * k * k * k;
}

template <typename Ty>
Ty quintOut(Ty k) {
    return --k * k * k * k * k + 1;
}

template <typename Ty>
Ty quintInOut(Ty k) {
    k *= 2;
    if (k < 1) {
        return 0.5 * k * k * k * k * k;
    }
    return 0.5 * ((k -= 2) * k * k * k * k + 2);
}

template <typename Ty>
Ty sineIn(Ty k) {
    if (k == 1) {
        return 1;
    }
    return 1 - std::cos(k * pi<Ty> / 2);
}

template <typename Ty>
Ty sineOut(Ty k) {
    return std::sin(k * pi<Ty> / 2);
}

template <typename Ty>
Ty sineInOut(Ty k) {
    return 0.5 * (1 - std::cos(pi<Ty> * k));
}

template <typename Ty>
Ty expoIn(Ty k) {
    return k == 0 ? 0 : std::pow(1024, k - 1);
}

template <typename Ty>
Ty expoOut(Ty k) {
    return k == 1 ? 1 : 1 - std::pow(2, -10 * k);
}

template <typename Ty>
Ty expoInOut(Ty k) {
    if (k == 0) {
        return 0;
    }
    if (k == 1) {
        return 1;
    }
    k *= 2;
    if (k < 1) {
        return 0.5 * std::pow(1024, k - 1);
    }
    return 0.5 * (-std::pow(2, -10 * (k - 1)) + 2);
}

template <typename Ty>
Ty circIn(Ty k) {
    return 1 - std::sqrt(1 - k * k);
}

template <typename Ty>
Ty circOut(Ty k) {
    return std::sqrt(1 - (--k * k));
}

template <typename Ty>
Ty circInOut(Ty k) {
    k *= 2;
    if (k < 1) {
        return -0.5 * (std::sqrt(1 - k * k) - 1);
    }
    return 0.5 * (std::sqrt(1 - (k -= 2) * k) + 1);
}

template <typename Ty>
Ty elasticIn(Ty k) {
    Ty       s = 0;
    Ty       a = 0.1;
    const Ty p = 0.4;
    if (k == 0) {
        return 0;
    }
    if (k == 1) {
        return 1;
    }
    if (!a || a < 1) {
        a = 1;
        s = p / 4;
    } else {
        s = p * std::asin(1 / a) / (2 * pi<Ty>);
    }
    return -(a * std::pow(2, 10 * (k -= 1)) * std::sin((k - s) * (2 * pi<Ty>) / p));
}

template <typename Ty>
Ty elasticOut(Ty k) {
    Ty       s = 0;
    Ty       a = 0.1;
    const Ty p = 0.4;
    if (k == 0) {
        return 0;
    }
    if (k == 1) {
        return 1;
    }
    if (!a || a < 1) {
        a = 1;
        s = p / 4;
    } else {
        s = p * std::asin(1 / a) / (2 * pi<Ty>);
    }
    return (a * std::pow(2, -10 * k) * std::sin((k - s) * (2 * pi<Ty>) / p) + 1);
}

template <typename Ty>
Ty elasticInOut(Ty k) {
    Ty       s = 0;
    Ty       a = 0.1;
    const Ty p = 0.4;
    if (k == 0) {
        return 0;
    }
    if (k == 1) {
        return 1;
    }
    if (!a || a < 1) {
        a = 1;
        s = p / 4;
    } else {
        s = p * std::asin(1 / a) / (2 * pi<Ty>);
    }
    k *= 2;
    if (k < 1) {
        return -0.5 * (a * std::pow(2, 10 * (k -= 1)) * std::sin((k - s) * (2 * pi<Ty>) / p));
    }
    return a * std::pow(2, -10 * (k -= 1)) * std::sin((k - s) * (2 * pi<Ty>) / p) * 0.5 + 1;
}

template <typename Ty>
Ty backIn(Ty k) {
    if (k == 1) {
        return 1;
    }
    const Ty s = 1.70158;
    return k * k * ((s + 1) * k - s);
}

template <typename Ty>
Ty backOut(Ty k) {
    if (k == 0) {
        return 0;
    }
    const Ty s = 1.70158;
    return --k * k * ((s + 1) * k + s) + 1;
}

template <typename Ty>
Ty backInOut(Ty k) {
    const Ty s = 1.70158 * 1.525;
    k *= 2;
    if (k < 1) {
        return 0.5 * (k * k * ((s + 1) * k - s));
    }
    return 0.5 * ((k -= 2) * k * ((s + 1) * k + s) + 2);
}

template <typename Ty>
Ty bounceOut(Ty k) {
    if (k < (1 / 2.75)) {
        return 7.5625 * k * k;
    } else if (k < (2 / 2.75)) {
        return 7.5625 * (k -= (1.5 / 2.75)) * k + 0.75;
    } else if (k < (2.5 / 2.75)) {
        return 7.5625 * (k -= (2.25 / 2.75)) * k + 0.9375;
    } else {
        return 7.5625 * (k -= (2.625 / 2.75)) * k + 0.984375;
    }
}

template <typename Ty>
Ty bounceIn(Ty k) {
    return 1 - bounceOut(1 - k);
}

template <typename Ty>
Ty bounceInOut(Ty k) {
    if (k < 0.5) {
        return bounceIn(k * 2) * 0.5;
    }
    return bounceOut(k * 2 - 1) * 0.5 + 0.5;
}

template <typename Ty>
Ty smooth(Ty k) {
    if (k <= 0) {
        return 0;
    }
    if (k >= 1) {
        return 1;
    }
    return k * k * (3 - 2 * k);
}

template <typename Ty>
Ty fade(Ty k) {
    if (k <= 0) {
        return 0;
    }
    if (k >= 1) {
        return 1;
    }
    return k * k * k * (k * (k * 6 - 15) + 10);
}

namespace {
template <typename Ty>
using EasingFn = std::function<Ty(Ty)>;

template <typename Ty, typename FnIn, typename FnOut>
Ty _makeOutIn(FnIn fnIn, FnOut fnOut, Ty k) {
    if (k < 0.5) {
        return fnOut(k * 2) / 2;
    }
    return fnIn(2 * k - 1) / 2 + 0.5;
}
} // namespace

template <typename Ty>
Ty quadOutIn(Ty k) {
    return _makeOutIn(quadIn<Ty>, quadOut<Ty>, k);
}

template <typename Ty>
Ty cubicOutIn(Ty k) {
    return _makeOutIn(cubicIn<Ty>, cubicOut<Ty>, k);
}

template <typename Ty>
Ty quartOutIn(Ty k) {
    return _makeOutIn(quartIn<Ty>, quartOut<Ty>, k);
}

template <typename Ty>
Ty quintOutIn(Ty k) {
    return _makeOutIn(quintIn<Ty>, quintOut<Ty>, k);
}

template <typename Ty>
Ty sineOutIn(Ty k) {
    return _makeOutIn(sineIn<Ty>, sineOut<Ty>, k);
}

template <typename Ty>
Ty expoOutIn(Ty k) {
    return _makeOutIn(expoIn<Ty>, expoOut<Ty>, k);
}

template <typename Ty>
Ty circOutIn(Ty k) {
    return _makeOutIn(circIn<Ty>, circOut<Ty>, k);
}

template <typename Ty>
Ty elasticOutIn(Ty k) {
    return _makeOutIn(elasticIn<Ty>, elasticOut<Ty>, k);
}

template <typename Ty>
Ty backOutIn(Ty k) {
    return _makeOutIn(backIn<Ty>, backOut<Ty>, k);
}

template <typename Ty>
Ty bounceOutIn(Ty k) {
    return _makeOutIn(bounceIn<Ty>, bounceOut<Ty>, k);
}
} // namespace easing
} // namespace cc