#pragma once

#include <algorithm>
#include <cassert>
#include <cstdint>
#include <vector>
#include "base/Macros.h"

#ifndef NDEBUG
    #define CURVE_DEBUG
#endif

#undef CURVE_DEBUG

#ifdef CURVE_DEBUG
    #include <iostream>
#endif

namespace cc {
template <typename TKeyframeValue>
class CC_DLL KeyframeCurve {
public:
    using Size = std::uint32_t;

    using Time = double;

    using KeyframeValue = TKeyframeValue;

private:
    using TimeContainer = std::vector<Time>;

    using KeyframeValueContainer = std::vector<KeyframeValue>;

public:
    using TimeIterator = typename TimeContainer::iterator;

    using TimeConstIterator = typename TimeContainer::const_iterator;

    using KeyframeValueIterator = typename KeyframeValueContainer::iterator;

    using KeyframeValueConstIterator = typename KeyframeValueContainer::const_iterator;

    KeyframeCurve() = default;

    KeyframeCurve(KeyframeCurve &&) = default;

    KeyframeCurve(const KeyframeCurve &) = default;

    Size keyFramesCount() const {
        return static_cast<Size>(this->_times.size());
    }

    Time rangeMin() const {
        return _times[0];
    }

    Time rangeMax() const {
        return _times[_times.size() - 1];
    }

    TimeConstIterator timesBegin() const {
        return _times.begin();
    }

    TimeConstIterator timesEnd() const {
        return _times.end();
    }

    TimeIterator timesBegin() {
        return _times.begin();
    }

    TimeIterator timesEnd() {
        return _times.end();
    }

    Time getTime(Size index) const {
        return _times[index];
    }

    KeyframeValueConstIterator keyframeValuesBegin() const {
        return _times.begin();
    }

    KeyframeValueConstIterator keyframeValuesEnd() const {
        return _times.end();
    }

    KeyframeValueIterator keyframeValuesBegin() {
        return _keyframeValues.begin();
    }

    KeyframeValueIterator keyframeValuesEnd() {
        return _keyframeValues.end();
    }

    const KeyframeValue &getKeyframeValue(Size index) const {
        return _keyframeValues[index];
    }

    KeyframeValue &getKeyframeValue(Size index) {
        return _keyframeValues[index];
    }

    Size insertKeyframe(Time time, KeyframeValue keyframeValue) {
        const auto nFrames = this->keyFramesCount();
#ifdef CURVE_DEBUG
        std::cout << "Start insert. time :" << time << " | frame: " << keyframeValue << ". Current frames: " << nFrames << "\n";
#endif
        const auto position = this->_findPosition(time);
        if (position >= 0) {
            return position;
        }

#ifdef CURVE_DEBUG
        std::cout << "iNext: " << ~position << "\n";
#endif

        const auto iNext = ~position;
        if (iNext == 0) {
            this->_times.insert(this->_times.begin(), time);
            this->_keyframeValues.insert(this->_keyframeValues.begin(), keyframeValue);
        } else if (iNext == nFrames) {
            this->_times.push_back(time);
            this->_keyframeValues.push_back(keyframeValue);
        } else {
            assert(nFrames > 1);
            this->_times.insert(this->_times.begin() + iNext, time);
            this->_keyframeValues.insert(this->_keyframeValues.begin() + iNext, keyframeValue);
        }
        return iNext;
    }

    void removeKeyframe(Size index) {
        this->_times.erase(this->_times.begin() + index);
        this->_keyframeValues.erase(this->_keyframeValues.begin() + index);
    }

    Size indexOf(Time time) {
        const auto iter = std::find(timesBegin(), timesEnd(), time);
        return iter - timesBegin();
    }

    void updateTime(Size index, Time time) {
        const auto keyframeValue = this->_keyframeValues[index];
        this->removeKeyframe(index);
        this->insertKeyframe(time, keyframeValue);
    }

    void clear() {
        this->_times.clear();
        this->_keyframeValues.clear();
    }

    template <typename Iter>
    void assign(Iter first, Iter last) {
        const auto distance = std::distance(first, last);
        assert(distance >= 0);
        const auto size = static_cast<Size>(distance);
        _times.resize(size);
        _keyframeValues.resize(size);
        Size iKeyframe = 0;
        for (auto cur = first; first != last; ++cur, ++iKeyframe) {
            _times[iKeyframe]          = cur->first;
            _keyframeValues[iKeyframe] = cur->second;
        }
        assert(_isSorted() && "The keyframes should be sorted by times.");
    }

    template <typename TimeIter, typename KeyframeValueIter>
    void assign(TimeIter firstTime, TimeIter lastTime, KeyframeValueIter firstKeyframeValue, KeyframeValueIter lastKeyframeValue) {
        const auto timeDistance = std::distance(firstTime, lastTime);
        assert(timeDistance >= 0);
        const auto keyframeValueDistance = std::distance(firstKeyframeValue, lastKeyframeValue);
        assert(keyframeValueDistance >= 0);
        const auto size = static_cast<Size>(timeDistance);
        assert(size == static_cast<Size>(keyframeValueDistance));
        _times.resize(size);
        _keyframeValues.resize(size);
        for (Size iKeyframe = 0; iKeyframe < size; ++iKeyframe, ++firstTime, ++firstKeyframeValue) {
            _times[iKeyframe]          = *firstTime;
            _keyframeValues[iKeyframe] = *firstKeyframeValue;
        }
        assert(_isSorted() && "The keyframes should be sorted by times.");
    }

private:
    TimeContainer          _times;
    KeyframeValueContainer _keyframeValues;

    using Position = std::make_signed_t<Size>;

    bool _isSorted() const {
        return std::is_sorted(this->_times.begin(), this->_times.end());
    }

    Position _findPosition(Time time) const {
        const auto    &array   = this->_times;
        const auto     value   = time;
        constexpr Time EPSILON = 1e-5;

        Position low    = 0;
        Position high   = static_cast<Position>(array.size()) - 1;
        Position middle = high >> 1;
        for (; low <= high; middle = (low + high) >> 1) {
            const auto test = array[middle];
            if (test > (value + EPSILON)) {
                high = middle - 1;
            } else if (test < (value - EPSILON)) {
                low = middle + 1;
            } else {
                return middle;
            }
        }
        return ~low;
    }
};

enum class ExtrapolationMode {
    /**
     * @en
     * Compute the result
     * according to the first two frame's linear trend in the case of underflow and
     * according to the last two frame's linear trend in the case of overflow.
     * If there are less than two frames, fallback to `CLAMP`.
     * @zh
     * 下溢时，根据前两帧的线性趋势计算结果；上溢时，根据最后两帧的线性趋势计算结果。
     * 如果曲线帧数小于 2，回退到  `CLAMP`。
     */
    LINEAR,

    /**
     * @en
     * Use first frame's value in the case of underflow,
     * use last frame's value in the case of overflow.
     * @zh
     * 下溢时，使用第一帧的值；上溢时，使用最后一帧的值。
     */
    CLAMP,

    /**
     * @en
     * Computes the result as if the curve is infinitely and continuously looped.
     * @zh
     * 求值时将该曲线视作是无限连续循环的。
     */
    LOOP,

    /**
     * @en
     * Computes the result as if the curve is infinitely and continuously looped in a ping-pong manner.
     * @zh
     * 求值时将该曲线视作是以“乒乓”的形式无限连续循环的。
     */
    PING_PONG,
};
} // namespace cc
