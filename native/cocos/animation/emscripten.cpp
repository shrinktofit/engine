
#include "./exotic-animation/exotic-animation.h"
#include "./marionette/context.h"

#include <emscripten/bind.h>

#ifndef NDEBUG
    #include <iostream>
#endif

EMSCRIPTEN_BINDINGS(cc) {
    emscripten::class_<cc::Pose>("Pose")
        .function("transforms", emscripten::select_overload<emscripten::val(cc::Pose & pose_)>([](cc::Pose &pose_) {
                      const auto transforms = pose_.transforms();
                      const auto floats = ccstd::span<float>(
                          reinterpret_cast<float *>(transforms.data()),
                          reinterpret_cast<float *>(transforms.data() + transforms.size()));
                      return emscripten::val{emscripten::typed_memory_view(floats.size(), floats.data())};
                  }));

    emscripten::class_<cc::AnimationGraphPoseLayout>("AnimationGraphPoseLayout")

        ;
    emscripten::class_<cc::AnimationGraphPoseLayoutMaintainer>("AnimationGraphPoseLayoutMaintainer")
        .constructor<>()
        .function("generateLayout", &cc::AnimationGraphPoseLayoutMaintainer::generateLayout)
        .function("generateNodeTable", emscripten::select_overload<emscripten::val(cc::AnimationGraphPoseLayoutMaintainer & poseLayoutMatainer_)>([](cc::AnimationGraphPoseLayoutMaintainer &poseLayoutMatainer_) {
                      const auto nodes = poseLayoutMatainer_.generateNodeTable();
                      auto jsNodes = emscripten::val::array();
                      // jsNodes["length"] = emscripten::val(nodes.size());
                      for (decltype(nodes.size()) i = 0; i < nodes.size(); ++i) {
                          // jsNodes[std::uint32_t(i)] = emscripten::val(nodes[i]);
                          jsNodes.call<void>("push", emscripten::val(nodes[i]));
                      }
                      return jsNodes;
                  }))
        .function("apply", &cc::AnimationGraphPoseLayoutMaintainer::apply);

    emscripten::class_<cc::AnimationGraphBindingContext>("AnimationGraphBindingContext")
        .constructor<cc::__scene_graph_interop_helper::SceneNode, cc::AnimationGraphPoseLayoutMaintainer &>();

    emscripten::class_<cc::AnimationGraphEvaluationContext>("AnimationGraphEvaluationContext")
        .constructor<const cc::AnimationGraphPoseLayout &>()
        .function("createDefaultedPose", &cc::AnimationGraphEvaluationContext::createDefaultedPose, emscripten::allow_raw_pointers())
        .function("createZeroPose", &cc::AnimationGraphEvaluationContext::createZeroPose, emscripten::allow_raw_pointers())
        .function("duplicatePose", &cc::AnimationGraphEvaluationContext::duplicatePose, emscripten::allow_raw_pointers())
        .function("deletePose", &cc::AnimationGraphEvaluationContext::deletePose, emscripten::allow_raw_pointers());

    emscripten::class_<cc::AnimationClipGraphBindingContext>("AnimationClipGraphBindingContext");

    emscripten::class_<cc::AnimationClipGraphEvaluationContext>("AnimationClipGraphEvaluationContext")
        .constructor<cc::Pose &>()
        .property("pose", &cc::AnimationClipGraphEvaluationContext::pose);

    emscripten::class_<cc::ExoticAnimationEvaluator>("ExoticAnimationEvaluator")
        // TODO:
        .function("evaluate", &cc::ExoticAnimationEvaluator::evaluate)
        .function("evaluateWithPose", emscripten::select_overload<void(cc::ExoticAnimationEvaluator & evaluator_, cc::AnimationTimeType time_, cc::Pose & pose_)>([](cc::ExoticAnimationEvaluator &evaluator_, cc::AnimationTimeType time_, cc::Pose &pose_) {
                      cc::AnimationClipGraphEvaluationContext context(pose_);
                      evaluator_.evaluate(time_, context);
                  }));

    emscripten::class_<cc::ExoticAnimation>("ExoticAnimation")
        .constructor<>()
        .function("fromJS", &cc::ExoticAnimation::fromJS)
        .function("createEvaluator", &cc::ExoticAnimation::createEvaluator);

    emscripten::function("swapPose", emscripten::select_overload<void(cc::Pose & lhs_, cc::Pose & rhs_)>([](cc::Pose &lhs_, cc::Pose &rhs_) {
                             std::swap(lhs_, rhs_);
                         }));
    emscripten::function("blendPoseInto", cc::blendPoseInto);
    emscripten::function("calculateDeltaPose", cc::calculateDeltaPose);
    emscripten::function("applyDeltaPose", cc::applyDeltaPose);
}
