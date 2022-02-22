#include "./Module.h"
#include <array>
#include <sstream>
#include "../ScriptEngine.h"

namespace se {
namespace {
enum ModuleHostDefinedOptionIndex {
    isModule = 0,
    id       = 1,
    capacity,
};
} // namespace

void se::ScriptEngine::_initializeModuleEnvironment() {
    v8::HandleScope handleScope(_isolate);

    const auto context                   = _context.Get(_isolate);
    _environment                         = std::make_unique<EsEnvironment>(context);
    _environment->_fileOperationDelegate = _fileOperationDelegate;
    _environment->startup();
}

EsEnvironment::EsEnvironment(v8::Local<v8::Context> context_) : _isolate(context_->GetIsolate()), _context(context_->GetIsolate(), context_) {
    context_->SetAlignedPointerInEmbedderData(ContextEmbedderIndex::environment, this);
    _external.Reset(_isolate, v8::External::New(_isolate, this));

    const auto context = _context.Get(_isolate);

    _moduleWrapTempl.Reset(_isolate, EsModule::createFunctionTemplate(*this));

    _internalBindings = std::make_shared<InternalBindings>(context);

    const auto moduleWrapConstructor = _moduleWrapTempl.Get(_isolate)->GetFunction(context).ToLocalChecked();
    _internalBindingsModule          = std::make_unique<InternalBindingModule>(context, moduleWrapConstructor, _internalBindings);
}

EsModule *EsEnvironment::getModuleWrapper(v8::Local<v8::Module> module_) {
    const auto range = _hashToModuleMap.equal_range(module_->GetIdentityHash());
    for (auto i = range.first; i != range.second; ++i) {
        if (i->second->module(this->_isolate) == module_) {
            return i->second;
        }
    }
    return nullptr;
}

EsModule *EsEnvironment::getModuleWrapper(EsModule::Id id_) {
    for (auto &kv : _hashToModuleMap) {
        if (kv.second->id() == id_) {
            return kv.second;
        }
    }
    return nullptr;
}

void EsEnvironment::_handleException(EsEnvironment *env_, v8::Local<v8::Value> exception_) {
    const auto context = env_->context();
    const auto isolate = env_->isolate();
    /*auto global = context->Global();
    auto console = global->Get(v8::String::NewFromUtf8(isolate, "console")).As<v8::Object>();
    auto error = console->Get(v8::String::NewFromUtf8(isolate, "error")).As<v8::Function>();
    v8::Local<v8::Value> ret;
    error->Call(context, console, 1, &exception_);*/
    if (exception_->IsObject()) {
        const auto maybeMessage = exception_.As<v8::Object>()->Get(context, v8::String::NewFromUtf8(isolate, "message").ToLocalChecked());
        if (!maybeMessage.IsEmpty()) {
            v8::Local<v8::Value> message;
            maybeMessage.ToLocal(&message);
            if (message->IsString()) {
                const auto            messageText = message.As<v8::String>();
                v8::String::Utf8Value messageTextU8(isolate, messageText);
                std::string           messageTextNative(*messageTextU8, messageTextU8.length());
                SE_LOGE("%s", messageTextNative.c_str());
            }
        }
    }
}

v8::MaybeLocal<v8::Promise> EsEnvironment::_handleHostImportModuleDynamically(
    v8::Local<v8::Context>        context,
    v8::Local<v8::ScriptOrModule> referrer,
    v8::Local<v8::String>         specifier,
    v8::Local<v8::FixedArray>     import_assertions) {
    const auto env     = EsEnvironment::get(context);
    const auto isolate = context->GetIsolate();

    v8::EscapableHandleScope handleScope(isolate);

    v8::Local<v8::Promise::Resolver> resolver;
    if (!v8::Promise::Resolver::New(context).ToLocal(&resolver)) {
        return {};
    }

    v8::MaybeLocal<v8::Promise> promise(resolver->GetPromise());
    const auto                  hostDefinedOptions = referrer->GetHostDefinedOptions();
    assert(!hostDefinedOptions.IsEmpty());
    assert(hostDefinedOptions->Length() == ModuleHostDefinedOptionIndex::capacity);

    const auto isModule = hostDefinedOptions->Get(isolate, ModuleHostDefinedOptionIndex::isModule).As<v8::Boolean>()->BooleanValue(isolate);
    if (!isModule) {
        resolver->Reject(
            context,
            v8::Exception::Error(v8::String::NewFromUtf8(isolate, u8"Unsupported dynamic import.").ToLocalChecked()));
        return handleScope.Escape(resolver->GetPromise());
    }

    const auto moduleId = hostDefinedOptions->Get(isolate, ModuleHostDefinedOptionIndex::id).As<v8::Number>()->Uint32Value(context).ToChecked();
    static_assert(std::is_same_v<std::remove_const_t<decltype(moduleId)>, EsModule::Id>, "Update requred here.");

    const auto moduleWrap = env->getModuleWrapper(moduleId);
    if (!moduleWrap) {
        resolver->Reject(
            context,
            v8::Exception::Error(v8::String::NewFromUtf8(isolate, u8"Unsupported dynamic import.").ToLocalChecked()));
        return handleScope.Escape(resolver->GetPromise());
    }

    const auto           moduleWrapJs = moduleWrap->object();
    v8::Local<v8::Value> dynamicImportMethod;
    if (!moduleWrapJs->Get(context, v8::String::NewFromUtf8Literal(isolate, u8"importDynamiclly")).ToLocal(&dynamicImportMethod) ||
        !dynamicImportMethod->IsFunction()) {
        resolver->Reject(
            context,
            v8::Exception::TypeError(v8::String::NewFromUtf8(isolate, u8"There is no .importDynamiclly() in the module wrapper.").ToLocalChecked()));
        return handleScope.Escape(resolver->GetPromise());
    }

    std::array<v8::Local<v8::Value>, 1> args = {
        specifier,
    };

    const auto maybeReturn = dynamicImportMethod.As<v8::Function>()->CallAsFunction(
        context,
        moduleWrapJs,
        args.size(),
        args.data());
    v8::Local<v8::Value> retVal;
    if (!maybeReturn.ToLocal(&retVal) || !retVal->IsPromise()) {
        resolver->Reject(
            context,
            v8::Exception::TypeError(v8::String::NewFromUtf8(isolate, u8"The .importDynamiclly() should return a promise.").ToLocalChecked()));
        return handleScope.Escape(resolver->GetPromise());
    }

    return retVal.As<v8::Promise>();
}

void EsEnvironment::_evaluateFirstLoader() {
    auto isolate = _isolate;

    auto               context = v8::Context::New(isolate);
    v8::Context::Scope contextScope{context};

    // Injects the "internalBindings" global function.
    context->Global()->Set(
        context,
        v8::String::NewFromUtf8(isolate, R"(internalBindings)").ToLocalChecked(),
        _internalBindings->object(isolate));

    const auto data               = v8::External::New(isolate, this);
    const auto loadInternalSource = v8::Function::New(context, _loadInternalSource, data).ToLocalChecked();
    context->Global()->Set(
        context,
        v8::String::NewFromUtf8(isolate, R"(loadInternalSource)").ToLocalChecked(),
        loadInternalSource);

    const auto sourceString = _loadDefaultLoaderScriptSource();
    const auto source       = v8::String::NewFromUtf8(isolate, sourceString.c_str()).ToLocalChecked();
    const auto maybeScript  = v8::Script::Compile(
        context,
        source,
        nullptr);
    const auto       lineOffset         = v8::Integer::New(isolate, 0);
    const auto       columnOffset       = v8::Integer::New(isolate, 0);
    const auto       hostDefinedOptions = v8::PrimitiveArray::New(isolate, 0);
    v8::ScriptOrigin origin(
        v8::String::NewFromUtf8(isolate, R"(libs/first-loader.js)").ToLocalChecked(),
        lineOffset,
        columnOffset,
        v8::False(isolate),       // Is shared cross-origin
        v8::Local<v8::Integer>(), // Script id
        v8::Local<v8::Value>(),   // Source map url
        v8::False(isolate),       // Is opaque
        v8::False(isolate),       // Is Web assembly module
        v8::True(isolate),        // Is module,
        hostDefinedOptions);
    v8::Local<v8::Script> script;
    maybeScript.ToLocal(&script);
    script->Run(context);

#if CC_DEBUG

#endif
}

std::string EsEnvironment::_loadDefaultLoaderScriptSource() {
    assert(_fileOperationDelegate.isValid());

    std::string path = "libs/first-loader.js";

    std::string scriptBuffer = _fileOperationDelegate.onGetStringFromFile(path);

    return scriptBuffer;
}

template <typename T>
T &get_native(const v8::FunctionCallbackInfo<v8::Value> &args_) {
    assert(args_.Data()->IsExternal());
    return *static_cast<T *>(args_.Data().As<v8::External>()->Value());
}

void EsEnvironment::startup() {
    auto isolate = _isolate;
    auto context = _context.Get(_isolate);

    isolate->SetHostImportModuleDynamicallyCallback(EsEnvironment::_handleHostImportModuleDynamically);

    auto global = context->Global();

    auto target = global;

    auto       moduleWrapTempl = _moduleWrapTempl.Get(isolate);
    const auto moduleWrap      = moduleWrapTempl->GetFunction(context).ToLocalChecked();
    target->Set(
              this->context(),
              v8::String::NewFromUtf8(_isolate, "EsModule").ToLocalChecked(),
              moduleWrap)
        .FromJust();

    _internalBindings->add("RawModule", moduleWrap, context->GetIsolate());

    _internalBindings->add("internalBindingsModule", _internalBindingsModule->module(isolate), isolate);

    _internalBindings->add(
        "log",
        v8::Function::New(
            context,
            [](const v8::FunctionCallbackInfo<v8::Value> &args_) {
                assert(args_.Length() == 1);
                assert(args_[0]->IsString());
                const v8::String::Utf8Value message(args_.GetIsolate(), args_[0]);
                seLogE("[internalBinding.log] %s\n", *message);
            },
            v8::External::New(isolate, this))
            .ToLocalChecked(),
        isolate);

    _internalBindings->add(
        "loadInternalSource",
        v8::Function::New(
            context,
            [](const v8::FunctionCallbackInfo<v8::Value> &args_) {
                assert(args_.Length() == 1);
                assert(args_[0]->IsString());
                const v8::String::Utf8Value path(args_.GetIsolate(), args_[0]);
                const auto                  env    = static_cast<EsEnvironment *>(args_.Data().As<v8::External>()->Value());
                const auto                  source = env->_fileOperationDelegate.loadInternalSource(*path);
                args_.GetReturnValue().Set(v8::String::NewFromUtf8(args_.GetIsolate(), source.data()).ToLocalChecked());
            },
            v8::External::New(isolate, this))
            .ToLocalChecked(),
        isolate);

    _internalBindings->add(
        "getStringFromFile",
        v8::Function::New(
            context,
            [](const v8::FunctionCallbackInfo<v8::Value> &args_) {
                assert(args_.Length() == 1);
                assert(args_[0]->IsString());
                const v8::String::Utf8Value path(args_.GetIsolate(), args_[0]);
                const auto                  env    = static_cast<EsEnvironment *>(args_.Data().As<v8::External>()->Value());
                const auto                  source = env->_fileOperationDelegate.onGetStringFromFile(*path);
                args_.GetReturnValue().Set(v8::String::NewFromUtf8(args_.GetIsolate(), source.data()).ToLocalChecked());
            },
            v8::External::New(isolate, this))
            .ToLocalChecked(),
        isolate);

    _internalBindings->add(
        "setLoaderBase",
        v8::Function::New(
            context,
            [](const v8::FunctionCallbackInfo<v8::Value> &args_) {
                assert(args_.Length() == 1);
                assert(args_[0]->IsFunction());
                auto                        isolate = args_.GetIsolate();
                auto                        context = isolate->GetCurrentContext();
                const v8::String::Utf8Value path(isolate, args_[0]);
                auto                        env = static_cast<EsEnvironment *>(args_.Data().As<v8::External>()->Value());
                env->_internalBindings->object(isolate)->Set(
                    context,
                    v8::String::NewFromUtf8(args_.GetIsolate(), u8R"(LoaderBase)").ToLocalChecked(),
                    args_[0]);
            },
            v8::External::New(isolate, this))
            .ToLocalChecked(),
        isolate);

    _internalBindings->add(
        "setImportHandler",
        v8::Function::New(
            context,
            [](const v8::FunctionCallbackInfo<v8::Value> &args_) {
                assert(args_.Length() == 1);
                assert(args_[0]->IsFunction());
                auto                        isolate = args_.GetIsolate();
                const v8::String::Utf8Value path(isolate, args_[0]);
                auto                        env = static_cast<EsEnvironment *>(args_.Data().As<v8::External>()->Value());
                env->_importHandler.Reset(isolate, args_[0].As<v8::Function>());
            },
            v8::External::New(isolate, this))
            .ToLocalChecked(),
        isolate);

    _evaluateFirstLoader();
}

v8::MaybeLocal<v8::Value> EsEnvironment::import(v8::Local<v8::String> specifier_, v8::MaybeLocal<v8::String> url_) {
    auto                                isolate       = _isolate;
    auto                                context       = _context.Get(isolate);
    const auto                          importHandler = _importHandler.Get(isolate);
    std::array<v8::Local<v8::Value>, 1> args          = {
        specifier_};
    return importHandler.As<v8::Function>()->CallAsFunction(context, v8::Undefined(isolate), args.size(), args.data());
}

bool ScriptEngine::import(const std::string &specifier_, std::string *parentURL) {
    v8::HandleScope handleScope(_isolate);
    const auto      specifierJs = v8::String::NewFromUtf8(_isolate, specifier_.data()).ToLocalChecked();
    this->_environment->import(
        specifierJs,
        !parentURL ? v8::MaybeLocal<v8::String>{} : v8::String::NewFromUtf8(_isolate, specifier_.data()).ToLocalChecked());
    return true;
}

InternalBindingModule::InternalBindingModule(
    v8::Local<v8::Context> context_, v8::Local<v8::Function> module_wrap_constructor_, std::shared_ptr<InternalBindings> internal_bindings_) : _internalBindings(internal_bindings_) {
    auto isolate = context_->GetIsolate();

    const auto internalBindingExportName =
        v8::String::NewFromUtf8(isolate, exportNameInternalBinding).ToLocalChecked();
    std::vector<v8::Local<v8::Value>> exportNames{internalBindingExportName};

    const auto syntheticExecution =
        v8::Function::New(
            context_,
            [](const v8::FunctionCallbackInfo<v8::Value> &args_) {
                assert(args_.Data()->IsExternal());
                reinterpret_cast<InternalBindingModule *>(args_.Data().As<v8::External>()->Value())->_evaluate(args_);
            },
            v8::External::New(isolate, this))
            .ToLocalChecked();

    const auto url = v8::String::NewFromUtf8(isolate, "internal_bindings").ToLocalChecked();

    const auto exportNamesJs = v8::Array::New(isolate, exportNames.data(), exportNames.size());

    std::array<v8::Local<v8::Value>, 3> args{
        url,                // url
        exportNamesJs,      // exportNames
        syntheticExecution, // syntheticExecutionFunction
    };
    const auto moduleWrap = module_wrap_constructor_->CallAsConstructor(
                                                        context_,
                                                        args.size(),
                                                        args.data())
                                .ToLocalChecked()
                                .As<v8::Object>();
    this->_moduleWrap.Reset(isolate, moduleWrap);
}

void InternalBindingModule::_evaluate(const v8::FunctionCallbackInfo<v8::Value> &args_) {
    auto       isolate                    = args_.GetIsolate();
    const auto context                    = isolate->GetCurrentContext();
    const auto moduleWrapJs               = args_.This();
    const auto setSyntheticModuleExportJs = moduleWrapJs->Get(
                                                            context,
                                                            v8::String::NewFromUtf8(isolate, u8R"(setSyntheticModuleExport)").ToLocalChecked())
                                                .ToLocalChecked()
                                                .As<v8::Function>();

    std::array<v8::Local<v8::Value>, 2> args{
        v8::String::NewFromUtf8(isolate, exportNameInternalBinding).ToLocalChecked(),
        _internalBindings->object(isolate)};
    setSyntheticModuleExportJs->CallAsFunction(
        context,
        moduleWrapJs,
        args.size(),
        args.data());
}

/// <summary>
/// new ModuleWrap(url: string, source: string, lineOffset: number, columnOffset: number)
/// new ModuleWrap(url: string, exportNames: string[], syntheticExecutionFunction: Function)
/// </summary>
/// <param name="args_"></param>
void EsModule::New(const v8::FunctionCallbackInfo<v8::Value> &args_) {
    assert(args_.IsConstructCall());
    const auto env     = EsEnvironment::get(args_);
    const auto isolate = env->isolate();

    const auto jsThis = args_.This();

    const auto argc = args_.Length();
    assert(argc >= 2);

    assert(args_[0]->IsString());
    const auto url = args_[0].As<v8::String>();

    v8::Local<v8::Context> context = jsThis->CreationContext();

    v8::Local<v8::PrimitiveArray> hostDefinedOptions;

    v8::Local<v8::Module> module;
    const auto &          arg1 = args_[1];
    if (!arg1->IsString()) {
        assert(arg1->IsArray());
        assert(args_[2]->IsFunction());
        const auto                         exportNamesJs = arg1.As<v8::Array>();
        const auto                         nExportNames  = exportNamesJs->Length();
        std::vector<v8::Local<v8::String>> exportNames(nExportNames);
        for (std::remove_const_t<decltype(nExportNames)> iExportName = 0;
             iExportName < nExportNames; ++iExportName) {
            const auto exportNameJs = exportNamesJs->Get(context, iExportName).ToLocalChecked();
            assert(exportNameJs->IsString());
            exportNames[iExportName] = exportNameJs.As<v8::String>();
        }
        module = v8::Module::CreateSyntheticModule(
            isolate,
            url,
            exportNames,
            _evaluationSteps);
        jsThis->SetInternalField(InternalFieldSlots::syntheticEvaluationSteps, args_[2]);
    } else {
        const auto sourceText = arg1.As<v8::String>();

        v8::TryCatch tryCatch(isolate);

        const auto lineOffset   = v8::Integer::New(isolate, 0);
        const auto columnOffset = v8::Integer::New(isolate, 0);
        hostDefinedOptions      = v8::PrimitiveArray::New(isolate, ModuleHostDefinedOptionIndex::capacity);
        hostDefinedOptions->Set(isolate, ModuleHostDefinedOptionIndex::isModule, v8::Boolean::New(isolate, true));

        v8::ScriptOrigin origin(
            url,
            lineOffset,
            columnOffset,
            v8::False(isolate),       // Is shared cross-origin
            v8::Local<v8::Integer>(), // Script id
            v8::Local<v8::Value>(),   // Source map url
            v8::False(isolate),       // Is opaque
            v8::False(isolate),       // Is Web assembly module
            v8::True(isolate),        // Is module,
            hostDefinedOptions);
        v8::Context::Scope         contextScope(context);
        v8::ScriptCompiler::Source source(sourceText, origin);
        if (!v8::ScriptCompiler::CompileModule(isolate, &source).ToLocal(&module)) {
            assert(tryCatch.HasCaught());
            assert(!tryCatch.Message().IsEmpty());
            assert(!tryCatch.Exception().IsEmpty());
            tryCatch.ReThrow();
            return;
        }
    }

    const auto esModule = new EsModule(env, jsThis, module, url, context);

    if (!hostDefinedOptions.IsEmpty()) {
        hostDefinedOptions->Set(isolate, ModuleHostDefinedOptionIndex::id, v8::Number::New(isolate, esModule->id()));
    }

    args_.GetReturnValue().Set(jsThis);
}

void EsModule::Link(const v8::FunctionCallbackInfo<v8::Value> &args_) {
    const auto env     = EsEnvironment::get(args_);
    const auto isolate = env->isolate();

    assert(args_.Length() == 1);
    assert(args_[0]->IsFunction());

    const auto jsThis        = args_.This();
    const auto moduleWrapped = EsModule::unwrap<EsModule>(jsThis);

    if (moduleWrapped->_linked) {
        return;
    }
    moduleWrapped->_linked = true;

    const auto resolver = args_[0].As<v8::Function>();

    const auto context = moduleWrapped->_context.Get(isolate);
    const auto module  = moduleWrapped->_module.Get(isolate);

    const auto nModuleRequests = module->GetModuleRequestsLength();
    auto       resolvePromises = v8::Array::New(isolate, nModuleRequests);
    for (std::remove_const_t<decltype(nModuleRequests)> iModuleRequest = 0;
         iModuleRequest < nModuleRequests; ++iModuleRequest) {
        auto                                moduleRequest   = module->GetModuleRequest(iModuleRequest);
        std::array<v8::Local<v8::Value>, 1> resolveArgs     = {moduleRequest};
        auto                                resolverRetvalX = resolver->Call(context, jsThis, resolveArgs.size(), resolveArgs.data());
        if (resolverRetvalX.IsEmpty()) {
            // TODO?
            return;
        }
        auto resolvePromiseX = resolverRetvalX.ToLocalChecked();
        if (!resolvePromiseX->IsPromise()) {
            // TODO: throw
        }
        auto resolvePromise = resolvePromiseX.As<v8::Promise>();

        v8::String::Utf8Value moduleRequestU8(env->isolate(), moduleRequest);
        std::string           moduleRequestNative(*moduleRequestU8, moduleRequestU8.length());
        moduleWrapped->_resolvePromises[moduleRequestNative].Reset(env->isolate(), resolvePromise);

        resolvePromises->Set(context, iModuleRequest, resolvePromise).FromJust();
    }

    args_.GetReturnValue().Set(resolvePromises);
}

void EsModule::Instantiate(const v8::FunctionCallbackInfo<v8::Value> &args_) {
    auto env     = EsEnvironment::get(args_);
    auto isolate = env->isolate();

    auto jsThis        = args_.This();
    auto moduleWrapped = EsModule::unwrap<EsModule>(jsThis);

    auto context = moduleWrapped->_context.Get(isolate);
    auto module  = moduleWrapped->_module.Get(isolate);

    v8::TryCatch tryCatch(env->isolate());
    auto         result = module->InstantiateModule(context, ResolveCallback);

    if (!result.FromMaybe(false)) {
        assert(tryCatch.HasCaught());
        assert(!tryCatch.Message().IsEmpty());
        assert(!tryCatch.Exception().IsEmpty());
        tryCatch.ReThrow();
        return;
    }
}

void EsModule::Evaluate(const v8::FunctionCallbackInfo<v8::Value> &args_) {
    auto env     = EsEnvironment::get(args_);
    auto isolate = env->isolate();

    auto jsThis        = args_.This();
    auto moduleWrapped = EsModule::unwrap<EsModule>(jsThis);

    seLogE("Evaluating %s\n", *v8::String::Utf8Value(isolate, moduleWrapped->url()));

    auto context = moduleWrapped->_context.Get(isolate);
    auto module  = moduleWrapped->_module.Get(isolate);

    v8::TryCatch tryCatch(env->isolate());

    auto result = module->Evaluate(context);

    if (tryCatch.HasCaught()) {
        tryCatch.ReThrow();
        return;
    }

    args_.GetReturnValue().Set(result.ToLocalChecked());
}

void EsModule::SetSyntheticModuleExport(const v8::FunctionCallbackInfo<v8::Value> &args_) {
    auto env        = EsEnvironment::get(args_);
    auto isolate    = env->isolate();
    auto jsThis     = args_.This();
    auto moduleWrap = EsModule::unwrap<EsModule>(jsThis);

    assert(args_.Length() == 2);
    assert(args_[0]->IsString());

    const auto exportName  = args_[0].As<v8::String>();
    const auto exportValue = args_[1];
    const auto v8Module    = moduleWrap->_module.Get(isolate);
    v8Module->SetSyntheticModuleExport(exportName, exportValue);
}

void EsModule::Namespace(const v8::FunctionCallbackInfo<v8::Value> &args_) {
    auto env           = EsEnvironment::get(args_);
    auto isolate       = env->isolate();
    auto jsThis        = args_.This();
    auto moduleWrapped = EsModule::unwrap<EsModule>(jsThis);
    auto module        = moduleWrapped->_module.Get(isolate);
    args_.GetReturnValue().Set(module->GetModuleNamespace());
}

v8::MaybeLocal<v8::Module> EsModule::ResolveCallback(v8::Local<v8::Context> context_, v8::Local<v8::String> module_request_, v8::Local<v8::Module> importer_) {
    auto env     = EsEnvironment::get(context_);
    auto isolate = env->isolate();

    auto importerWrapper = env->getModuleWrapper(importer_);
    assert(importerWrapper);

    v8::String::Utf8Value moduleRequestU8(isolate, module_request_);
    std::string           moduleRequestNative(*moduleRequestU8, moduleRequestU8.length());
    // TODO: what if same specifier occurs multi times
    if (importerWrapper->_resolvePromises.count(moduleRequestNative) != 1) {
        env->throwError(u8"Linking was not performend prior to instantiate.");
        return {};
    }

    const auto resolvePromise = importerWrapper->_resolvePromises[moduleRequestNative].Get(isolate);
    if (resolvePromise->State() != v8::Promise::kFulfilled) {
        env->throwError(u8"Linking promise was not fulfilled at the moment the module instantiates.");
        return {};
    }

    auto resolvedModuleX = resolvePromise->Result();
    if (resolvedModuleX.IsEmpty() ||
        !resolvedModuleX->IsObject()) {
        env->throwError(u8"Linking promise did not result a module object.");
        return {};
    }

    auto resolvedModuleWrapped = EsModule::unwrap<EsModule>(resolvedModuleX.As<v8::Object>());
    if (!resolvedModuleWrapped) {
        // TODO THROW: not wrapped
        return {};
    }

    return resolvedModuleWrapped->_module.Get(isolate);
}

v8::MaybeLocal<v8::Value> EsModule::_evaluationSteps(v8::Local<v8::Context> context_, v8::Local<v8::Module> module_) {
    auto env     = EsEnvironment::get(context_);
    auto isolate = env->isolate();

    auto importerWrapper = env->getModuleWrapper(module_);
    assert(importerWrapper);

    v8::TryCatch tryCatch{isolate};

    const auto syntheticEvaluationSteps =
        importerWrapper->object()->GetInternalField(InternalFieldSlots::syntheticEvaluationSteps).As<v8::Function>();
    const auto evaluationResult = syntheticEvaluationSteps->Call(context_, importerWrapper->object(), 0, nullptr);
    if (evaluationResult.IsEmpty()) {
        assert(tryCatch.HasCaught());
    }

    if (tryCatch.HasCaught() && !tryCatch.HasTerminated()) {
        assert(!tryCatch.Message().IsEmpty());
        assert(!tryCatch.Exception().IsEmpty());
        tryCatch.ReThrow();
        return v8::MaybeLocal<v8::Value>();
    }

    return v8::Undefined(isolate);
}

InternalBindings::InternalBindings(v8::Local<v8::Context> context_) {
    auto isolate = context_->GetIsolate();
    auto object  = v8::Object::New(isolate, v8::Null(isolate), nullptr, nullptr, 0);
    _object.Reset(isolate, object);
}
} // namespace se
