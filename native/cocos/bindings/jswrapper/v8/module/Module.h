#pragma once

#include <v8/v8.h>
#include <cassert>
#include <map>
#include <memory>
#include <unordered_map>
#include "../FileOperationDelegate.h"

namespace se {
class EsModule;

using EsModuleId = std::uint32_t;

class InternalBindings {
public:
    InternalBindings(v8::Local<v8::Context> context_);

    v8::Local<v8::Object> object(v8::Isolate *isolate_) {
        return _object.Get(isolate_);
    }

    void add(const std::string &key_, v8::Local<v8::Value> value_, v8::Isolate *isolate_) {
        const auto            object = _object.Get(isolate_);
        v8::Local<v8::String> keyJs =
            v8::String::NewFromUtf8(isolate_, key_.c_str()).ToLocalChecked();
        object->Set(isolate_->GetCurrentContext(), keyJs, value_);
    }

private:
    v8::Persistent<v8::Object> _object;
};

class InternalBindingModule {
public:
    InternalBindingModule(
        v8::Local<v8::Context> context_, v8::Local<v8::Function> module_wrap_constructor_, std::shared_ptr<InternalBindings> internal_bindings_);

    InternalBindingModule(const InternalBindingModule &) = delete;

    InternalBindingModule(InternalBindingModule &&) = delete;

    v8::Local<v8::Object> module(v8::Isolate *isolate_) {
        return this->_moduleWrap.Get(isolate_);
    }

private:
    static constexpr auto exportNameInternalBinding = "default";

    v8::Persistent<v8::Object> _moduleWrap;

    std::shared_ptr<InternalBindings> _internalBindings;

    void _evaluate(
        const v8::FunctionCallbackInfo<v8::Value> &args_);
};

enum ContextEmbedderIndex {
    environment = 32 + 10,
};

class EsEnvironment {
public:
    EsEnvironment(v8::Local<v8::Context> context_);

    EsEnvironment(const EsEnvironment &) = delete;

    EsEnvironment(EsEnvironment &&) = delete;

    v8::Local<v8::Context> context() {
        return _context.Get(_isolate);
    }

    v8::Local<v8::FunctionTemplate> createFunctionTemplate(
        v8::FunctionCallback     callback_,
        v8::Local<v8::Signature> signature_        = v8::Local<v8::Signature>(),
        v8::ConstructorBehavior  behavior_         = v8::ConstructorBehavior::kAllow,
        v8::SideEffectType       side_effect_type_ = v8::SideEffectType::kHasSideEffect) {
        v8::Local<v8::External> external = _external.Get(isolate());
        return v8::FunctionTemplate::New(
            _isolate,
            callback_,
            external,
            signature_,
            0,
            behavior_,
            side_effect_type_);
    }

    void SetMethod(v8::Local<v8::Object> that,
                   const char *          name,
                   v8::FunctionCallback  callback) {
        v8::Local<v8::Context>  context = isolate()->GetCurrentContext();
        v8::Local<v8::Function> function =
            createFunctionTemplate(callback, v8::Local<v8::Signature>(),
                                   // TODO(TimothyGu): Investigate if SetMethod is ever
                                   // used for constructors.
                                   v8::ConstructorBehavior::kAllow,
                                   v8::SideEffectType::kHasSideEffect)
                ->GetFunction(context)
                .ToLocalChecked();
        // kInternalized strings are created in the old space.
        const v8::NewStringType type = v8::NewStringType::kInternalized;
        v8::Local<v8::String>   name_string =
            v8::String::NewFromUtf8(isolate(), name, type).ToLocalChecked();
        that->Set(context, name_string, function).FromJust();
        function->SetName(name_string); // NODE_SET_METHOD() compatibility.
    }

    void SetProtoMethod(
        v8::Local<v8::FunctionTemplate> templ_,
        const char *                    name_,
        v8::FunctionCallback            callback_) {
        v8::Local<v8::Signature>        signature = v8::Signature::New(isolate(), templ_);
        v8::Local<v8::FunctionTemplate> t =
            createFunctionTemplate(callback_, signature, v8::ConstructorBehavior::kThrow,
                                   v8::SideEffectType::kHasSideEffect);
        // kInternalized strings are created in the old space.
        const v8::NewStringType type = v8::NewStringType::kInternalized;
        v8::Local<v8::String>   name_string =
            v8::String::NewFromUtf8(isolate(), name_, type).ToLocalChecked();
        templ_->PrototypeTemplate()->Set(name_string, t);
        t->SetClassName(name_string); // NODE_SET_PROTOTYPE_METHOD() compatibility.
    }

    void SetProtoMethodNoSideEffect(
        v8::Local<v8::FunctionTemplate> templ_,
        const char *                    name_,
        v8::FunctionCallback            callback_) {
        v8::Local<v8::Signature>        signature = v8::Signature::New(isolate(), templ_);
        v8::Local<v8::FunctionTemplate> t =
            createFunctionTemplate(callback_, signature, v8::ConstructorBehavior::kThrow,
                                   v8::SideEffectType::kHasNoSideEffect);
        // kInternalized strings are created in the old space.
        const v8::NewStringType type = v8::NewStringType::kInternalized;
        v8::Local<v8::String>   name_string =
            v8::String::NewFromUtf8(isolate(), name_, type).ToLocalChecked();
        templ_->PrototypeTemplate()->Set(name_string, t);
        t->SetClassName(name_string); // NODE_SET_PROTOTYPE_METHOD() compatibility.
    }

    void SetMethodNoSideEffect(v8::Local<v8::Object> templ_,
                               const char *          name_,
                               v8::FunctionCallback  callback) {
        v8::Local<v8::Context>  context = isolate()->GetCurrentContext();
        v8::Local<v8::Function> function =
            createFunctionTemplate(callback, v8::Local<v8::Signature>(),
                                   // TODO(TimothyGu): Investigate if SetMethod is ever
                                   // used for constructors.
                                   v8::ConstructorBehavior::kAllow,
                                   v8::SideEffectType::kHasNoSideEffect)
                ->GetFunction(context)
                .ToLocalChecked();
        // kInternalized strings are created in the old space.
        const v8::NewStringType type = v8::NewStringType::kInternalized;
        v8::Local<v8::String>   name_string =
            v8::String::NewFromUtf8(isolate(), name_, type).ToLocalChecked();
        templ_->Set(context, name_string, function).FromJust();
        function->SetName(name_string); // NODE_SET_METHOD() compatibility.
    }

    /// <summary>
    ///
    /// </summary>
    /// <param name="message_">UTF-8.</param>
    void throwError(const char *message_) {
        throwError(v8::Exception::Error, message_);
    }

    void throwError(
        v8::Local<v8::Value> (*constructor_)(v8::Local<v8::String>), const char *message_) {
        v8::HandleScope handleScope(isolate());
        (void)isolate()->ThrowException(constructor_(v8::String::NewFromUtf8(_isolate, message_).ToLocalChecked()));
    }

    void startup();

    ~EsEnvironment() {
        // TODO: SetAlignedPointerInEmbedderData to nullptr
    }

    v8::Isolate *isolate() {
        return _isolate;
    }

    /*void addCleanUpHook(std::function<void()> callback_) {
            _cleanupHooks.emplace(callback_);
          }*/

    void registerModuleWrapper(v8::Local<v8::Module> module_, EsModule *wrapper_) {
        _hashToModuleMap.emplace(module_->GetIdentityHash(), wrapper_);
    }

    void unregisterModuleWrapper(v8::Local<v8::Module> module_, EsModule *wrapper_) {
        auto range = _hashToModuleMap.equal_range(module_->GetIdentityHash());
        for (auto i = range.first; i != range.second; ++i) {
            if (i->second == wrapper_) {
                _hashToModuleMap.erase(i);
                break;
            }
        }
    }

    EsModule *getModuleWrapper(v8::Local<v8::Module> module_);

    EsModule *getModuleWrapper(EsModuleId id_);

    v8::MaybeLocal<v8::Value> import(v8::Local<v8::String> specifier_, v8::MaybeLocal<v8::String> url_);

    static EsEnvironment *get(v8::Isolate *isolate_) {
        return get(isolate_->GetCurrentContext());
    }

    static EsEnvironment *get(v8::Local<v8::Context> context_) {
        return static_cast<EsEnvironment *>(
            context_->GetAlignedPointerFromEmbedderData(ContextEmbedderIndex::environment));
    }

    static EsEnvironment *get(const v8::FunctionCallbackInfo<v8::Value> &args_) {
        assert(args_.Data()->IsExternal());
        return static_cast<EsEnvironment *>(args_.Data().As<v8::External>()->Value());
    }

    FileOperationDelegate _fileOperationDelegate;

private:
    v8::Isolate *                                 _isolate;
    v8::Persistent<v8::Context>                   _context;
    v8::Persistent<v8::External>                  _external;
    std::unordered_map<std::uint32_t, EsModule *> _hashToModuleMap;
    //std::unordered_set<std::function<void()>> _cleanupHooks; // TODO: clean
    std::shared_ptr<InternalBindings>      _internalBindings;
    std::unique_ptr<InternalBindingModule> _internalBindingsModule;
    v8::Persistent<v8::FunctionTemplate>   _moduleWrapTempl;
    v8::Persistent<v8::Function>           _importHandler;

    static void _handleException(EsEnvironment *env_, v8::Local<v8::Value> exception_);

    static v8::MaybeLocal<v8::Promise> _handleHostImportModuleDynamically(v8::Local<v8::Context>        context,
                                                                          v8::Local<v8::ScriptOrModule> referrer,
                                                                          v8::Local<v8::String>         specifier,
                                                                          v8::Local<v8::FixedArray>     import_assertions);

    static void _loadInternalSource(const v8::FunctionCallbackInfo<v8::Value> &args_) {
        auto isolate = args_.GetIsolate();
        auto env     = EsEnvironment::get(args_);

        assert(args_.Length() == 1);
        assert(args_[0]->IsString());

        v8::String::Utf8Value sourceId{isolate, args_[0]};
        std::string           path   = "libs/" + std::string{*sourceId};
        const auto            source = env->_fileOperationDelegate.onGetStringFromFile(path);
        args_.GetReturnValue().Set(v8::String::NewFromUtf8(isolate, source.data()).ToLocalChecked());
    }

    void _evaluateFirstLoader();

    std::string _loadDefaultLoaderScriptSource();
};

class EsObject {
public:
    EsObject(EsEnvironment *       env_,
             v8::Local<v8::Object> object_) : _env(env_), _handle(env_->isolate(), object_) {
        assert(!object_.IsEmpty());
        assert(object_->InternalFieldCount() > 0);
        object_->SetAlignedPointerInInternalField(0, static_cast<void *>(this));
    }

    ~EsObject() {
        if (_handle.IsEmpty()) {
            return;
        }

        v8::HandleScope handleScope(_env->isolate());
        object()->SetAlignedPointerInInternalField(0, nullptr);
    }

    EsEnvironment *env() {
        return _env;
    }

    v8::Local<v8::Object> object() {
        return _handle.Get(_env->isolate());
    }

    static EsObject *unwrap(v8::Local<v8::Object> object_) {
        assert(object_->InternalFieldCount() > 0);
        return static_cast<EsObject *>(object_->GetAlignedPointerFromInternalField(0));
    }

    template <typename Derived>
    static Derived *unwrap(v8::Local<v8::Object> object_) {
        return static_cast<Derived *>(unwrap(object_));
    }

private:
    EsEnvironment *            _env;
    v8::Persistent<v8::Object> _handle;
};

class EsModule : public EsObject {
public:
    using Id = EsModuleId;

    /// <summary>
    ///
    /// </summary>
    /// <param name="env_"></param>
    /// <param name="object_">The Module `this` object.</param>
    /// <param name="module_">The v8 module object.</param>
    /// <param name="url_">The url of the module.</param>
    EsModule(EsEnvironment *        env_,
             v8::Local<v8::Object>  object_,
             v8::Local<v8::Module>  module_,
             v8::Local<v8::String>  url_,
             v8::Local<v8::Context> context_) : EsObject(env_, object_),
                                                _url(env_->isolate(), url_),
                                                _module(env_->isolate(), module_),
                                                _context(env_->isolate(), context_) {
        _id = module_->GetIdentityHash();
        env_->registerModuleWrapper(module_, this);
    }

    ~EsModule() {
        v8::HandleScope scope(env()->isolate());
        auto            module = _module.Get(env()->isolate());
        env()->unregisterModuleWrapper(module, this);
    }

    Id id() const {
        return this->_id;
    }

    v8::Local<v8::Module> module(v8::Isolate *isolate_) {
        return this->_module.Get(isolate_);
    }

    v8::Local<v8::String> url() {
        return _url.Get(env()->isolate());
    }

    static v8::Local<v8::FunctionTemplate> createFunctionTemplate(EsEnvironment &env_) {
        const auto isoate = env_.isolate();
        auto       templ  = env_.createFunctionTemplate(EsModule::New);
        templ->SetClassName(v8::String::NewFromUtf8(isoate, "EsModule").ToLocalChecked());
        templ->InstanceTemplate()->SetInternalFieldCount(InternalFieldSlots::count);
        env_.SetProtoMethod(templ, "link", EsModule::Link);
        env_.SetProtoMethod(templ, "instantiate", EsModule::Instantiate);
        env_.SetProtoMethod(templ, "evaluate", EsModule::Evaluate);
        env_.SetProtoMethod(templ, "setSyntheticModuleExport", EsModule::SetSyntheticModuleExport);
        env_.SetProtoMethod(templ, "namespace", EsModule::Namespace);
        return templ;
    }

private:
    enum InternalFieldSlots {
        syntheticEvaluationSteps = 1,
        count,
    };

    /// <summary>
    /// new ModuleWrap(url: string, source: string, lineOffset: number, columnOffset: number)
    /// new ModuleWrap(url: string, exportNames: string[], syntheticExecutionFunction: Function)
    /// </summary>
    /// <param name="args_"></param>
    static void New(const v8::FunctionCallbackInfo<v8::Value> &args_);

    static void Link(const v8::FunctionCallbackInfo<v8::Value> &args_);

    static void Instantiate(const v8::FunctionCallbackInfo<v8::Value> &args_);

    static void Evaluate(const v8::FunctionCallbackInfo<v8::Value> &args_);

    static void SetSyntheticModuleExport(const v8::FunctionCallbackInfo<v8::Value> &args_);

    static void Namespace(const v8::FunctionCallbackInfo<v8::Value> &args_);

    static v8::MaybeLocal<v8::Module> ResolveCallback(
        v8::Local<v8::Context> context_,
        v8::Local<v8::String>  module_request_,
        v8::Local<v8::Module>  importer_);

    static v8::MaybeLocal<v8::Value> _evaluationSteps(
        v8::Local<v8::Context> context_, v8::Local<v8::Module> module_);

    v8::Persistent<v8::Module>                                   _module;
    v8::Persistent<v8::String>                                   _url;
    v8::Persistent<v8::Context>                                  _context;
    std::unordered_map<std::string, v8::Persistent<v8::Promise>> _resolvePromises;
    bool                                                         _linked = false;
    Id                                                           _id;
};
} // namespace se
