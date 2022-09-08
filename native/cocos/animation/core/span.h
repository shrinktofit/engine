#pragma once

#if __cplusplus >= 202002L
    #include <span>
#else
    #include "./tcb-span.hpp"
#endif

namespace ccstd {
#if __cplusplus >= 202002L
template <typename Ty>
using span = std::span<Ty>;
#else
template <typename Ty>
using span = tcb::span<Ty>;
#endif
} // namespace ccstd

#define __CC_SPAN_TO_STD_VECTOR_ARGS__(expr) ((expr).data()), ((expr).data() + (expr).size())
