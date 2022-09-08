
#include "./scene-graph-interop.h"

namespace cc::__scene_graph_interop_helper {
#ifdef CC_EMSCRIPTEN
//    using JsVal = emscripten::val;
//
// class JsAnimationGraphBindingContext {
// public:
//    JsAnimationGraphBindingContext(emscripten::val&& val_) : _val(std::move(val_)) {
//    }
//
//    std::optional<TransformHandle> bindTransform(std::string_view path_) {
//        std::string path(path_);
//        const auto x = _val.call<emscripten::val>("bindTransform", path);
//        return x == emscripten::val::null() ? std::nullopt : std::optional<TransformHandle>(x);
//    }
//
// private:
//    emscripten::val _val;
//};

using JsBindingContext = emscripten::val;

using SceneNode = emscripten::val;

std::optional<SceneNode> findNode(SceneNode from_, std::string_view path_) {
    std::string p(path_);
    const auto x = from_.call<emscripten::val>("getChildByPath", p);
    return x == emscripten::val::null() ? std::nullopt : std::optional<SceneNode>(x);
}

std::optional<SceneNode> getParent(SceneNode node_) {
    const auto x = node_["parent"];
    return x == emscripten::val::null() ? std::nullopt : std::optional<SceneNode>(x);
}

bool isEqual(SceneNode lhs_, SceneNode rhs_) {
    return lhs_.call<emscripten::val>("equalTo", rhs_).as<bool>();
}

void setRTS(SceneNode node_, std::array<float, 10> data_) {
    node_.call<void>("setRTS", emscripten::val{emscripten::typed_memory_view(data_.size(), data_.data())});
}
#else
using JsBindingContext = se::Value;

using SceneNode = se::Value;

std::optional<SceneNode> findNode(SceneNode from_, std::string_view path_) {
    se::ValueArray args;
    se::Value result;
    (*from_.toObject())["getChildByPath"].toObject()->call(args, from_.toObject(), &result);
    return result.isNullOrUndefined() ? std::nullopt : std::optional<SceneNode>(result);
}

std::optional<SceneNode> getParent(SceneNode node_) {
    auto result = (*node_.toObject())["parent"];
    return result.isNullOrUndefined() ? std::nullopt : std::optional<SceneNode>(result);
}

bool isEqual(SceneNode lhs_, SceneNode rhs_) {
    se::ValueArray args(1, rhs_);
    se::Value result;
    (*lhs_.toObject())["equalTo"].toObject()->call(args, lhs_.toObject(), &result);
    return result.toBoolean();
}

void setRTS(SceneNode node_, std::array<float, 10> data_) {
    throw std::runtime_error("Not impl");
}
#endif
} // namespace cc::__scene_graph_interop_helper
