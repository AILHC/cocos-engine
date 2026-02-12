cmake_minimum_required(VERSION 3.8)

set(APP_NAME "spine")
set(SPINE_VERSION "3.8")
# set(SPINE_VERSION "4.2")

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

project(${APP_NAME}_wasm)

# 添加 CMake 模块路径
list(APPEND CMAKE_MODULE_PATH "${CMAKE_CURRENT_LIST_DIR}/CMakeModules")

set(BUILD_WASM 1)
set(ENABLE_JSON_PARSER 1)
set(ENABLE_BINARY_PARSER 1)
# set(ENABLE_PROFILING "--profiling")
# set(ENABLE_MEMORY_PROFILING "--memoryprofiler -sDEFAULT_LIBRARY_FUNCS_TO_INCLUDE=$demangleAll")
set(VERBOSE_LOG 0)

set(CMAKE_BUILD_TYPE "MinSizeRel")
# set(CMAKE_BUILD_TYPE "RelWithDebInfo")
# set(CMAKE_BUILD_TYPE "Debug")

# 三种构建类型配置
if(CMAKE_BUILD_TYPE STREQUAL "Debug")
    # Debug 模式：无优化 + 完整调试信息 + source map + 符号表 + DWARF
    set(ENABLE_CLOSURE_COMPILER 0)
    set(SPINE_EXTRA_FLAGS "-O0 -g -gsource-map --emit-symbol-map -gseparate-dwarf")
    message(">>> 构建模式: Debug（无优化 + 完整调试信息 + DWARF）")
elseif(CMAKE_BUILD_TYPE STREQUAL "RelWithDebInfo")
    # RelWithDebInfo 模式：-O2 + 完整调试信息 + source map + 符号表 + DWARF
    set(ENABLE_CLOSURE_COMPILER 0)
    set(SPINE_EXTRA_FLAGS "-O2 -g -gsource-map --emit-symbol-map -gseparate-dwarf")
    message(">>> 构建模式: RelWithDebInfo（O2 优化 + 调试信息 + DWARF）")
elseif(CMAKE_BUILD_TYPE STREQUAL "MinSizeRel")
    # MinSizeRel 模式：-Oz + --emit-symbol-map（无 source map）
    set(ENABLE_CLOSURE_COMPILER 1)
    set(SPINE_EXTRA_FLAGS "-Oz --emit-symbol-map")
    message(">>> 构建模式: MinSizeRel（体积优化 + 符号表，无 source map）")
else()
    # 默认使用 MinSizeRel 配置
    set(ENABLE_CLOSURE_COMPILER 1)
    set(SPINE_EXTRA_FLAGS "-Oz --emit-symbol-map")
    message(">>> 构建模式: 默认（体积优化 + 符号表，无 source map）")
endif()

if(BUILD_WASM EQUAL 1)
    # WebAssembly 模式下，除 Debug 外都启用 EVAL_CTORS 优化
    if(NOT CMAKE_BUILD_TYPE STREQUAL "Debug")
        set(EVAL_CTOR_FLAG "-s EVAL_CTORS=1")
    else()
        set(EVAL_CTOR_FLAG "")
    endif()
else()
    set(EVAL_CTOR_FLAG "") # asmjs doesn't support EVAL_CTORS
endif()

set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} ${SPINE_EXTRA_FLAGS} -DEMSCRIPTEN_HAS_UNBOUND_TYPE_NAMES=0 -DENABLE_JSON_PARSER=${ENABLE_JSON_PARSER} -DENABLE_BINARY_PARSER=${ENABLE_BINARY_PARSER}")
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} ${SPINE_EXTRA_FLAGS} -fno-exceptions -fno-rtti -Wno-inconsistent-missing-override ${ENABLE_PROFILING} \
    -DEMSCRIPTEN_HAS_UNBOUND_TYPE_NAMES=0 -DENABLE_JSON_PARSER=${ENABLE_JSON_PARSER} -DENABLE_BINARY_PARSER=${ENABLE_BINARY_PARSER}")

message(">>> --------------------------------------------------------------")
message(">>> Current directory: ${CMAKE_CURRENT_LIST_DIR}")
message(">>> CMAKE_BUILD_TYPE: ${CMAKE_BUILD_TYPE}")
message(">>> ENABLE_CLOSURE_COMPILER: ${ENABLE_CLOSURE_COMPILER}")
message(">>> ENABLE_JSON_PARSER: ${ENABLE_JSON_PARSER}")
message(">>> ENABLE_BINARY_PARSER: ${ENABLE_BINARY_PARSER}")
message(">>> ENABLE_PROFILING: ${ENABLE_PROFILING}")
message(">>> ENABLE_MEMORY_PROFILING: ${ENABLE_MEMORY_PROFILING}")
message(">>> SPINE_EXTRA_FLAGS: ${SPINE_EXTRA_FLAGS}")
message(">>> EVAL_CTOR_FLAG: ${EVAL_CTOR_FLAG}")
message(">>> --------------------------------------------------------------")
message(">>> CMAKE_C_COMPILER_VERSION is ${CMAKE_C_COMPILER_VERSION}")
message(">>> CMAKE_CXX_COMPILER_VERSION is ${CMAKE_CXX_COMPILER_VERSION}")
message(">>> CMAKE_C_COMPILER_TARGET is ${CMAKE_C_COMPILER_TARGET}")
message(">>> CMAKE_CXX_COMPILER_TARGET is ${CMAKE_CXX_COMPILER_TARGET}")
message(">>> CMAKE_C_PLATFORM_ID is ${CMAKE_C_PLATFORM_ID}")
message(">>> CMAKE_CXX_PLATFORM_ID is ${CMAKE_CXX_PLATFORM_ID}")
message(">>> CMAKE_C_COMPILE_FEATURES is ${CMAKE_C_COMPILE_FEATURES}")
message(">>> CMAKE_CXX_COMPILE_FEATURES is ${CMAKE_CXX_COMPILE_FEATURES}")
message(">>> --------------------------------------------------------------")




if(SPINE_VERSION STREQUAL "3.8")
    include_directories(${CMAKE_CURRENT_LIST_DIR}/../spine/3.8/)
    file(GLOB SPINE_CORE_SRC "${CMAKE_CURRENT_LIST_DIR}/../spine/3.8/spine/*.cpp")
    file(GLOB COCOS_ADAPTER_SRC 
        "${CMAKE_CURRENT_LIST_DIR}/*.cpp"
        "${CMAKE_CURRENT_LIST_DIR}/3.8/*.cpp"
    )
    add_definitions(-DCC_SPINE_VERSION_3_8)
elseif(SPINE_VERSION STREQUAL "4.2")
    include_directories(${CMAKE_CURRENT_LIST_DIR}/../spine/4.2/)
    file(GLOB SPINE_CORE_SRC "${CMAKE_CURRENT_LIST_DIR}/../spine/4.2/spine/*.cpp")
    file(GLOB COCOS_ADAPTER_SRC 
        "${CMAKE_CURRENT_LIST_DIR}/*.cpp"
        "${CMAKE_CURRENT_LIST_DIR}/4.2/*.cpp"
    )
    add_definitions(-DCC_SPINE_VERSION_4_2)
else()
    message(FATAL_ERROR "Unsupported SPINE_VERSION: ${SPINE_VERSION}")
endif()

# 如果启用了内存分析，部署自定义版本
if(ENABLE_MEMORY_PROFILING)
    include(DeployMemoryProfiler)
    deploy_memory_profiler("${CMAKE_CURRENT_LIST_DIR}/memoryprofiler_custom.js")
endif()

add_executable(${APP_NAME} ${SPINE_CORE_SRC} ${COCOS_ADAPTER_SRC})

# 如果启用了内存分析，编译后恢复原始版本
if(ENABLE_MEMORY_PROFILING)
    add_custom_command(TARGET ${APP_NAME} POST_BUILD
        COMMAND ${CMAKE_COMMAND}
            -DCMAKE_MODULE_PATH=${CMAKE_MODULE_PATH}
            -DRESTORE_PROFILER=TRUE
            -P "${CMAKE_CURRENT_LIST_DIR}/CMakeModules/DeployMemoryProfiler.cmake"
        COMMENT "恢复原始 memoryprofiler.js"
    )
endif()

# -s EMBIND_AOT=0 -s MALLOC=emmalloc
# set(EMS_LINK_FLAGS "${SPINE_EXTRA_FLAGS} ${EVAL_CTOR_FLAG} -s VERBOSE=${VERBOSE_LOG} -s WASM=${BUILD_WASM} -s INITIAL_MEMORY=33554432 -s ALLOW_MEMORY_GROWTH=1 -s DYNAMIC_EXECUTION=0 -s ERROR_ON_UNDEFINED_SYMBOLS=0 ${ENABLE_MEMORY_PROFILING} \
#         -flto --no-entry --bind -s USE_ES6_IMPORT_META=0 -s EXPORT_ES6=1 -s MODULARIZE=1 -s EXPORT_NAME='spineWasm' \
#         -s ENVIRONMENT=web -s FILESYSTEM=0 -s NO_EXIT_RUNTIME=1 -s LLD_REPORT_UNDEFINED \
#         -s MIN_SAFARI_VERSION=110000 \
#         -s EXPORTED_FUNCTIONS=['_spineListenerCallBackFromJS','_spineTrackListenerCallback'] \
#         --js-library ../library_spine.js \
#         --closure=${ENABLE_CLOSURE_COMPILER} \
#         --closure-args=--externs=../library_spine_externs.js")
set(EMS_LINK_FLAGS "${SPINE_EXTRA_FLAGS} ${EVAL_CTOR_FLAG} -s VERBOSE=${VERBOSE_LOG} -s WASM=${BUILD_WASM} -s INITIAL_MEMORY=33554432 -s ALLOW_MEMORY_GROWTH=1 -s DYNAMIC_EXECUTION=0 -s ERROR_ON_UNDEFINED_SYMBOLS=0 ${ENABLE_MEMORY_PROFILING} \
        -flto --no-entry --bind -s USE_ES6_IMPORT_META=0 -s EXPORT_ES6=1 -s MODULARIZE=1 -s EXPORT_NAME='spineWasm' \
        -s ENVIRONMENT=web -s FILESYSTEM=0 -s NO_EXIT_RUNTIME=1 -s LLD_REPORT_UNDEFINED \
        -s MIN_SAFARI_VERSION=110000 \
        -s EXPORTED_FUNCTIONS=['_spineListenerCallBackFromJS','_spineTrackListenerCallback'] \
        --js-library ../library_spine.js \
        --closure=${ENABLE_CLOSURE_COMPILER} \
        --closure-args=--externs=../library_spine_externs.js")

set_target_properties(${APP_NAME} PROPERTIES CXX_STANDARD 11 LINK_FLAGS ${EMS_LINK_FLAGS})