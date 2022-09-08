
#include "./native-binding.h"
#include "bindings/manual/jsb_conversions.h"
#include "bindings/manual/jsb_global.h"
#include "bindings/sebind/intl/common.h"
#include "bindings/sebind/sebind.h"

namespace {
struct AnimationModuleNamespace {
};
} // namespace

bool jsb_register_animations(se::Object* globalThis) {
    auto ns = se::Object::createPlainObject();
    globalThis->setProperty("animation", se::Value{ns});

    sebind::class_<cc::Pose>("Pose")
        .function(
            "transforms", +[](cc::Pose* pose_) {
                const auto transforms = pose_->transforms();
                const auto floats = ccstd::span<float>(
                    reinterpret_cast<float*>(transforms.data()),
                    reinterpret_cast<float*>(transforms.data() + transforms.size()));
                return se::Object::createTypedArray<float>(floats.data(), floats.size());
            })
        .install(ns);

    sebind::class_<cc::AnimationGraphPoseLayout>("AnimationGraphPoseLayout").install(ns);

    sebind::class_<cc::AnimationGraphPoseLayoutMaintainer>("AnimationGraphPoseLayoutMaintainer")
        .constructor<>()
        .function(
            "generateLayout", +[](const cc::AnimationGraphPoseLayoutMaintainer* maintainer_) {
                return std::make_shared<cc::AnimationGraphPoseLayout>(maintainer_->generateLayout());
            })
        .function(
            "generateNodeTable", +[](cc::AnimationGraphPoseLayoutMaintainer* poseLayoutMatainer_) {
                const auto nodes = poseLayoutMatainer_->generateNodeTable();
                auto jsNodes = se::Object::createArrayObject(nodes.size());
                for (decltype(nodes.size()) i = 0; i < nodes.size(); ++i) {
                    jsNodes->setArrayElement(i, nodes[i]);
                }
                return jsNodes;
            })
        .function("apply", &cc::AnimationGraphPoseLayoutMaintainer::apply)
        .install(ns);

    sebind::class_<cc::AnimationGraphBindingContext>("AnimationGraphBindingContext")
        .constructor<cc::__scene_graph_interop_helper::SceneNode, cc::AnimationGraphPoseLayoutMaintainer&>()
        .install(ns);

    sebind::class_<cc::AnimationGraphEvaluationContext>("AnimationGraphEvaluationContext")
        .constructor<const cc::AnimationGraphPoseLayout&>()
        .function("createDefaultedPose", &cc::AnimationGraphEvaluationContext::createDefaultedPose)
        .function("createZeroPose", &cc::AnimationGraphEvaluationContext::createZeroPose)
        .function("duplicatePose", &cc::AnimationGraphEvaluationContext::duplicatePose)
        .function("deletePose", &cc::AnimationGraphEvaluationContext::deletePose)
        .install(ns);

    sebind::class_<cc::AnimationClipGraphBindingContext>("AnimationClipGraphBindingContext").install(ns);

    sebind::class_<cc::AnimationClipGraphEvaluationContext>("AnimationClipGraphEvaluationContext")
        .constructor<cc::Pose&>()
        .property("pose", &cc::AnimationClipGraphEvaluationContext::pose, nullptr)
        .install(ns);

    sebind::class_<cc::ExoticAnimationEvaluator>("ExoticAnimationEvaluator")
        // TODO:
        .function("evaluate", &cc::ExoticAnimationEvaluator::evaluate)
        .function(
            "evaluateWithPose", +[](cc::ExoticAnimationEvaluator* evaluator_, cc::AnimationTimeType time_, cc::Pose& pose_) {
                cc::AnimationClipGraphEvaluationContext context(pose_);
                evaluator_->evaluate(time_, context);
            })
        .install(ns);

    sebind::class_<cc::ExoticAnimation>("ExoticAnimation")
        .constructor<>()
        .function("fromJS", &cc::ExoticAnimation::fromJS)
        .function(
            "createEvaluator", +[](cc::ExoticAnimation* animation_, cc::AnimationGraphBindingContext& bindingContext_) {
                return std::make_shared<cc::ExoticAnimationEvaluator>(animation_->createEvaluator(bindingContext_));
            })
        .install(ns);

    sebind::class_<AnimationModuleNamespace> moduleFunctions("ModuleFunctions");
    moduleFunctions.staticFunction(
        "swapPose", +[](cc::Pose& lhs_, cc::Pose& rhs_) {
            std::swap(lhs_, rhs_);
        });
    moduleFunctions.staticFunction("blendPoseInto", cc::blendPoseInto);
    moduleFunctions.staticFunction("calculateDeltaPose", cc::calculateDeltaPose);
    moduleFunctions.staticFunction("applyDeltaPose", cc::applyDeltaPose);
    moduleFunctions.install(ns);
    {
        auto moduleFunctionsObjValue = (*ns)["ModuleFunctions"];
        auto moduleFunctionsObj = moduleFunctionsObjValue.toObject();
        std::vector<std::string> keys;
        moduleFunctionsObj->getAllKeys(&keys);
        for (const auto& key : keys) {
            ns->setProperty(key, (*moduleFunctionsObj)[key.c_str()]);
        }
    }

    return true;
}
