#pragma once

#include <vector>
#include "./pose.h"
// TODO:
#include <iostream>

namespace cc {
class PoseAllocator {
public:
    PoseAllocator(std::uint32_t trasnformCount_, std::uint32_t metaValueCount_) {
        _poses.reserve(4);
        for (auto i = 0; i < _poses.capacity(); ++i) {
            _poses.emplace_back(trasnformCount_, metaValueCount_);
        }
        _free.resize(_poses.size());
        std::fill(_free.begin(), _free.end(), true);
    }

    Pose* allocatePose() {
        auto r = std::find(_free.begin(), _free.end(), true);
        if (r == _free.end()) {
            std::cerr << "Pose allocator overflow";
            throw std::runtime_error("Pose allocator overflow");
        }
        *r = false;
        return &_poses[r - _free.begin()];
    }

    void deletePose(Pose* pose_) {
        auto r = std::find_if(_poses.begin(), _poses.end(), [pose_](auto& p) { return &p == pose_; });
        if (r == _poses.end()) {
            std::cerr << "Failed to delete pose";
            throw std::runtime_error("Failed to delete pose");
        }
        _free[r - _poses.begin()] = true;
    }

private:
    std::vector<Pose> _poses;
    std::vector<bool> _free;
};
} // namespace cc
