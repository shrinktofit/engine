#include <array>
#include <cmath>
#include <utility>
#include "base/Macros.h"

namespace cc {
namespace {
constexpr static auto pi = 3.14159265359;

template <typename T>
T isZero(T x) {
    constexpr static auto EQN_EPS = 1e-9;
    return x > -EQN_EPS && x < EQN_EPS;
}
} // namespace

template <typename T>
std::pair<std::array<T, 3>, typename std::array<T, 3>::size_type> solveCubic(std::array<T, 4> coeffs) {
    std::array<T, 3> solutions;

    // normal form: x^3 + Ax^2 + Bx + C = 0
    const auto a = coeffs[2] / coeffs[3];
    const auto b = coeffs[1] / coeffs[3];
    const auto c = coeffs[0] / coeffs[3];

    // substitute x = y - A/3 to eliminate quadric term:
    // x^3 +px + q = 0
    const auto sqrA = a * a;
    const auto p    = 1.0 / 3.0 * (-1.0 / 3 * sqrA + b);
    const auto q    = 1.0 / 2.0 * (2.0 / 27.0 * a * sqrA - 1.0 / 3 * a * b + c);

    // use Cardano's formula
    const auto cubicP = p * p * p;
    const auto d      = q * q + cubicP;

    typename decltype(solutions)::size_type nSolutions = 0;
    if (isZero(d)) {
        if (isZero(q)) { // one triple solution
            solutions[0] = 0;
            return {solutions, 1};
        } else { // one single and one double solution
            const auto u = std::cbrt(-q);
            solutions[0] = 2 * u;
            solutions[1] = -u;
            return {solutions, 2};
        }
    } else if (d < 0) { // Casus irreducibilis: three real solutions
        const auto phi = 1.0 / 3 * std::acos(-q / std::sqrt(-cubicP));
        const auto t   = 2 * std::sqrt(-p);

        solutions[0] = t * std::cos(phi);
        solutions[1] = -t * std::cos(phi + cc::pi / 3);
        solutions[2] = -t * std::cos(phi - cc::pi / 3);
        nSolutions   = 3;
    } else { // one real solution
        const auto sqrtD = std::sqrt(d);
        const auto u     = std::cbrt(sqrtD - q);
        const auto v     = -std::cbrt(sqrtD + q);
        solutions[0]     = u + v;
        nSolutions       = 1;
    }

    const auto sub = 1.0 / 3 * a;
    for (auto i = 0; i < nSolutions; ++i) {
        solutions[i] -= sub;
    }

    return {solutions, nSolutions};
}
} // namespace cc
