# =============================================================================
# DeployMemoryProfiler.cmake
# 自动部署自定义 Memory Profiler 到 Emscripten 源码目录
# =============================================================================

# 查找 Emscripten 安装路径
function(find_emscripten_path VAR)
    set(EMSCRIPTEN_PATH "")

    # 1. 检查环境变量
    if(NOT EMSCRIPTEN_PATH)
        if(DEFINED ENV{EMSDK})
            set(EMSCRIPTEN_PATH "$ENV{EMSDK}/upstream/emscripten")
        endif()
    endif()

    if(NOT EMSCRIPTEN_PATH)
        if(DEFINED ENV{EMSCRIPTEN_ROOT})
            set(EMSCRIPTEN_PATH "$ENV{EMSCRIPTEN_ROOT}")
        endif()
    endif()

    # 2. 检查常见安装位置 (E 盘)
    if(NOT EMSCRIPTEN_PATH)
        file(GLOB EMSCRIPTEN_PATHS "E:/softwares/emsdk-*/upstream/emscripten")
        foreach(p ${EMSCRIPTEN_PATHS})
            if(EXISTS "${p}")
                set(EMSCRIPTEN_PATH "${p}")
                break()
            endif()
        endforeach()
    endif()

    # 3. 检查常见安装位置 (C 盘和 D 盘)
    if(NOT EMSCRIPTEN_PATH)
        file(GLOB EMSDK_PATHS "C:/emsdk-*" "D:/emsdk-*")
        foreach(p ${EMSDK_PATHS})
            if(EXISTS "${p}/upstream/emscripten")
                set(EMSCRIPTEN_PATH "${p}/upstream/emscripten")
                break()
            endif()
        endforeach()
    endif()

    # 4. 验证路径
    if(NOT EMSCRIPTEN_PATH OR NOT EXISTS "${EMSCRIPTEN_PATH}")
        message(FATAL_ERROR "找不到 Emscripten 安装路径。请设置 EMSDK 或 EMSCRIPTEN_ROOT 环境变量。")
    endif()

    set(${VAR} "${EMSCRIPTEN_PATH}" PARENT_SCOPE)
    message(STATUS "找到 Emscripten: ${EMSCRIPTEN_PATH}")
endfunction()

# 部署自定义 profiler
function(deploy_memory_profiler CUSTOM_PROFILER_PATH)
    # 检测 Emscripten 路径
    find_emscripten_path(EMSCRIPTEN_PATH)

    # 查找原始文件
    set(ORIGINAL_PROFILER "${EMSCRIPTEN_PATH}/src/memoryprofiler.js")
    if(NOT EXISTS "${ORIGINAL_PROFILER}")
        message(FATAL_ERROR "找不到原始 memoryprofiler.js: ${ORIGINAL_PROFILER}")
    endif()

    # 检查自定义文件是否存在
    if(NOT EXISTS "${CUSTOM_PROFILER_PATH}")
        message(FATAL_ERROR "找不到自定义 memoryprofiler.js: ${CUSTOM_PROFILER_PATH}")
    endif()

    # 备份原始文件
    set(BACKUP_PROFILER "${ORIGINAL_PROFILER}.backup")
    execute_process(
        COMMAND ${CMAKE_COMMAND} -E copy "${ORIGINAL_PROFILER}" "${BACKUP_PROFILER}"
        RESULT_VARIABLE COPY_RESULT
    )
    if(NOT COPY_RESULT EQUAL 0)
        message(FATAL_ERROR "备份失败: ${ORIGINAL_PROFILER} -> ${BACKUP_PROFILER}")
    endif()
    message(STATUS "已备份原始文件: ${BACKUP_PROFILER}")

    # 拷贝自定义版本
    execute_process(
        COMMAND ${CMAKE_COMMAND} -E copy "${CUSTOM_PROFILER_PATH}" "${ORIGINAL_PROFILER}"
        RESULT_VARIABLE COPY_RESULT
    )
    if(NOT COPY_RESULT EQUAL 0)
        message(FATAL_ERROR "拷贝失败: ${CUSTOM_PROFILER_PATH} -> ${ORIGINAL_PROFILER}")
    endif()
    message(STATUS "已部署自定义 memoryprofiler.js 到: ${ORIGINAL_PROFILER}")
endfunction()

# 恢复原始 profiler
function(restore_memory_profiler)
    # 检测 Emscripten 路径
    find_emscripten_path(EMSCRIPTEN_PATH)

    # 查找备份文件
    set(ORIGINAL_PROFILER "${EMSCRIPTEN_PATH}/src/memoryprofiler.js")
    set(BACKUP_PROFILER "${ORIGINAL_PROFILER}.backup")

    if(EXISTS "${BACKUP_PROFILER}")
        # 恢复原始文件
        execute_process(
            COMMAND ${CMAKE_COMMAND} -E copy "${BACKUP_PROFILER}" "${ORIGINAL_PROFILER}"
            RESULT_VARIABLE COPY_RESULT
        )
        if(COPY_RESULT EQUAL 0)
            # 删除备份
            execute_process(
                COMMAND ${CMAKE_COMMAND} -E remove "${BACKUP_PROFILER}"
            )
            message(STATUS "已恢复原始 memoryprofiler.js 并删除备份文件")
        else()
            message(WARNING "恢复失败: ${BACKUP_PROFILER} -> ${ORIGINAL_PROFILER}")
        endif()
    else()
        message(STATUS "没有找到备份文件，跳过恢复")
    endif()
endfunction()

# =============================================================================
# 脚本模式支持（用于 add_custom_command 调用）
# =============================================================================
if(RESTORE_PROFILER)
    restore_memory_profiler()
endif()
