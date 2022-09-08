cmake_minimum_required (VERSION 3.6)

project (cc_wasm)

option(BUILD_WASM "Build WASM." on)

set(CMAKE_VERBOSE_MAKEFILE on)

set(CC_WASM_RELEASE_BUILD on)

if (CC_WASM_RELEASE_BUILD)
    message (STATUS "Release build")
    set (emccLinkerFlags "\
    -O3 \
    --memory-init-file 0 \
    --bind \
    -s MODULARIZE=1 \
    -s EXPORT_ES6=1 \
    --llvm-lto 1 \
    --g3 \
    -gsource-map \
    -s ASSERTIONS=0 \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s NO_DISABLE_EXCEPTION_CATCHING \
    --source-map-base http://localhost:12138/ \
    ")
else ()
    set (emccLinkerFlags "\
    -O0 \
    --memory-init-file 0 \
    --bind \
    -s MODULARIZE=1 \
    -s EXPORT_ES6=1 \
    --llvm-lto 1 \
    --g3 \
    -gsource-map \
    -s ASSERTIONS=1 \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s NO_DISABLE_EXCEPTION_CATCHING \
    --source-map-base http://localhost:12138/ \
    ")
endif ()
if (BUILD_WASM)
else ()
    set (emccLinkerFlags "${emccLinkerFlags} -s WASM=0")
endif ()

file(GLOB_RECURSE sourceFiles
    "../cocos/math/MathUtil.cpp"
    "../cocos/math/Vec3.cpp"
    "../cocos/math/Quaternion.cpp"

    "../cocos/animation/core/transform.cpp"
    "../cocos/animation/emscripten.cpp"
)

add_executable (cc_wasm ${sourceFiles})
set_target_properties (cc_wasm PROPERTIES CXX_STANDARD 17)
set_target_properties (cc_wasm PROPERTIES SUFFIX ".js")
set_target_properties (cc_wasm PROPERTIES LINK_FLAGS ${emccLinkerFlags})
target_include_directories (cc_wasm PRIVATE
    ".."
    "../cocos"
    "../external/sources"
)

target_compile_definitions (cc_wasm PRIVATE CC_PLATFORM=9)
