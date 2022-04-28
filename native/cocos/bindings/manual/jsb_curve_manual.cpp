/****************************************************************************
 Copyright (c) 2021-2022 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated engine source code (the "Software"), a limited,
 worldwide, royalty-free, non-assignable, revocable and non-exclusive license
 to use Cocos Creator solely to develop games on your target platforms. You shall
 not use Cocos Creator software for developing other software or tools that's
 used for developing games. You are not granted to publish, distribute,
 sublicense, and/or sell copies of Cocos Creator.

 The software or tools in this License Agreement are licensed, not sold.
 Xiamen Yaji Software Co., Ltd. reserves all rights not expressly granted to you.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
****************************************************************************/

#include "jsb_curve_manual.h"
#include "bindings/jswrapper/SeApi.h"
#include "bindings/manual/jsb_classtype.h"
#include "curve/RealCurve.h"
#include "jsb_global.h"

#include <fstream>
#include <sstream>

namespace {
se::Object* __jsb_cc_curve_RealCurve_proto = nullptr;
se::Class*  __jsb_cc_curve_RealCurve_class = nullptr;

SE_DECLARE_FINALIZE_FUNC(js_cc_curve_RealCurve_finalize)

static bool js_curve_RealCurve_constructor(se::State& s) {
    const auto local = JSB_ALLOC(cc::RealCurve);
    s.thisObject()->setPrivateData(local);
    se::NonRefNativePtrCreatedByCtorMap::emplace(local);
    return true;
}
SE_BIND_CTOR(js_curve_RealCurve_constructor, __jsb_cc_curve_RealCurve_class, js_cc_curve_RealCurve_finalize)

static bool js_cc_curve_RealCurve_finalize(se::State& s) // NOLINT(readability-identifier-naming)
{
    auto iter = se::NonRefNativePtrCreatedByCtorMap::find(SE_THIS_OBJECT<cc::RealCurve>(s));
    if (iter != se::NonRefNativePtrCreatedByCtorMap::end()) {
        se::NonRefNativePtrCreatedByCtorMap::erase(iter);
        auto* local = SE_THIS_OBJECT<cc::RealCurve>(s);
        JSB_FREE(local);
    }
    return true;
}
SE_BIND_FINALIZE_FUNC(js_cc_curve_RealCurve_finalize)

static bool js_cc_curve_RealCurve_evaluate(se::State& s) {
    auto*       local = SE_THIS_OBJECT<cc::RealCurve>(s);
    const auto& args  = s.args();
    const auto  argc  = args.size();
    return true;
}
SE_BIND_FUNC(js_cc_curve_RealCurve_evaluate)
} // namespace

bool register_curve_manual(se::Object* obj) {
    auto* cls = se::Class::create("RealCurve", obj, nullptr, _SE(js_curve_RealCurve_constructor));

    cls->install();
    JSBClassType::registerClass<cc::RealCurve>(cls);

    __jsb_cc_curve_RealCurve_proto = cls->getProto();
    __jsb_cc_curve_RealCurve_class = cls;

    __jsb_cc_curve_RealCurve_proto->defineFunction("evaluate", _SE(js_cc_curve_RealCurve_evaluate));

    se::ScriptEngine::getInstance()->clearException();
    return true;
}
