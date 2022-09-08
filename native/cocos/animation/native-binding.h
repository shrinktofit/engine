#pragma once

#include "./exotic-animation/exotic-animation.h"
#include "./marionette/context.h"
#include "bindings/jswrapper/SeApi.h"
#include "bindings/manual/jsb_conversions.h"
#include "bindings/manual/jsb_global.h"

JSB_REGISTER_OBJECT_TYPE(cc::Pose);
JSB_REGISTER_OBJECT_TYPE(cc::AnimationGraphPoseLayout);
JSB_REGISTER_OBJECT_TYPE(cc::AnimationGraphPoseLayoutMaintainer);
JSB_REGISTER_OBJECT_TYPE(cc::AnimationGraphBindingContext);
JSB_REGISTER_OBJECT_TYPE(cc::AnimationGraphEvaluationContext);
JSB_REGISTER_OBJECT_TYPE(cc::AnimationClipGraphBindingContext);
JSB_REGISTER_OBJECT_TYPE(cc::AnimationClipGraphEvaluationContext);
JSB_REGISTER_OBJECT_TYPE(cc::ExoticAnimation);
JSB_REGISTER_OBJECT_TYPE(cc::ExoticAnimationEvaluator);

bool jsb_register_animations(se::Object* globalThis);
