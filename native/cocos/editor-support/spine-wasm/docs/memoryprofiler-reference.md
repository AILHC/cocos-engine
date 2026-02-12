# Emscripten Memory Profiler 参考文档

> 📚 **文档版本**: 1.0
> 📅 **创建日期**: 2026-02-11
> 🎯 **适用对象**: AI 助手、开发者、技术人员

---

## 📋 目录

1. [概述](#1-概述)
2. [工作原理](#2-工作原理)
3. [编译时行为](#3-编译时行为)
4. [源码结构](#4-源码结构)
5. [UI 创建流程](#5-ui-创建流程)
6. [自定义方案](#6-自定义方案)
7. [本项目实现](#7-本项目实现)
8. [关键代码片段](#8-关键代码片段)
9. [调试技巧](#9-调试技巧)
10. [参考资料](#10-参考资料)

---

## 1. 概述

### 1.1 什么是 Memory Profiler

**Emscripten Memory Profiler** 是 Emscripten 编译工具链提供的内存分析工具，用于实时监控和分析 WebAssembly 应用的内存使用情况。

### 1.2 编译选项

```bash
emcc --memoryprofiler [其他选项]
```

在本项目的 CMakeLists.txt 中：

```cmake
set(ENABLE_MEMORY_PROFILING "--memoryprofiler -sDEFAULT_LIBRARY_FUNCS_TO_INCLUDE=$demangleAll")
```

### 1.3 主要功能

- ✅ **实时内存监控**: 显示动态内存、静态内存、栈内存的使用情况
- ✅ **分配统计**: 追踪 malloc/free 调用次数和内存分配量
- ✅ **可视化图表**: 使用 Canvas 绘制内存占用图
- ✅ **调用栈分析**: 记录内存分配的调用位置
- ✅ **内存泄漏检测**: 通过对比 malloc/free 次数发现潜在泄漏

---

## 2. 工作原理

### 2.1 三层架构

```
┌─────────────────────────────────────────────────────────────┐
│                        UI 层                                 │
│  (DOM 元素、Canvas 绑定、事件处理、定时刷新)                  │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                   JavaScript 桥接层                         │
│  (Module.onMalloc、Module.onFree、emscriptenMemoryProfiler)  │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                      C/C++ 层                               │
│  (malloc、free、realloc 插桩、emscripten_trace_record_*)     │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 调用链

#### 内存分配流程

```
C/C++ 代码
    ↓
malloc(size)
    ↓
emscripten_trace_record_allocation(ptr, size)  [条件编译: __EMSCRIPTEN_TRACING__]
    ↓
Module['onMalloc'](ptr, size)
    ↓
emscriptenMemoryProfiler.onMalloc(ptr, size)
    ↓
更新统计信息 + 触发 UI 刷新
```

#### 内存释放流程

```
C/C++ 代码
    ↓
free(ptr)
    ↓
emscripten_trace_record_free(ptr)  [条件编译: __EMSCRIPTEN_TRACING__]
    ↓
Module['onFree'](ptr)
    ↓
emscriptenMemoryProfiler.onFree(ptr)
    ↓
更新统计信息 + 触发 UI 刷新
```

### 2.3 条件编译宏

| 宏名称 | 作用 | 定义位置 |
|--------|------|---------|
| `MEMORYPROFILER` | 控制 memoryprofiler.js 的包含 | Emscripten 内部 |
| `__EMSCRIPTEN_TRACING__` | 启用 C 层追踪插桩 | `--memoryprofiler` 自动定义 |
| `__EMSCRIPTEN_MEMORY_PROFILER__` | 标记启用内存分析 | 某些版本使用 |

---

## 3. 编译时行为

### 3.1 `--memoryprofiler` 触发的操作

1. **定义条件编译宏**: 添加 `__EMSCRIPTEN_TRACING__`
2. **注入 JavaScript 文件**:
   - `library_trace.js`: 提供 C 层追踪函数
   - `memoryprofiler.js`: 提供 UI 和统计逻辑
3. **C 层插桩**: 在 malloc/free 等函数中插入追踪代码

### 3.2 自动注入的文件

#### library_trace.js

提供 C 可调用的追踪函数：

```javascript
// 伪代码示例
function emscripten_trace_record_allocation(ptr, size) {
    if (Module['onMalloc']) Module['onMalloc'](ptr, size);
}

function emscripten_trace_record_free(ptr) {
    if (Module['onFree']) Module['onFree'](ptr);
}
```

#### memoryprofiler.js

完整的 profiler 实现，包含：
- `emscriptenMemoryProfiler` 对象
- UI 创建和管理逻辑
- 数据统计和可视化

### 3.3 C 层插桩位置

Emscripten 在系统库的以下位置插入追踪代码：

- `malloc()` - 内存分配
- `free()` - 内存释放
- `realloc()` - 内存重分配
- `calloc()` - 清零分配
- `sbrk()` - 堆扩展

---

## 4. 源码结构

### 4.1 文件位置

**Emscripten 源码路径**（本项目使用的版本）:
```
e:\softwares\emsdk-3.1.44\upstream\emscripten\src\memoryprofiler.js
```

**编译后的注入位置**:
```
build-wasm/spine.js  // 会被注入到生成的代码中
```

### 4.2 关键对象

#### emscriptenMemoryProfiler

全局单例对象，包含所有 profiler 功能：

```javascript
var emscriptenMemoryProfiler = {
    // 配置项
    detailedHeapUsage: true,              // 详细堆使用追踪
    trackedCallstackMinSizeBytes: 16MB,   // 调用栈追踪阈值（大小）
    trackedCallstackMinAllocCount: 10000, // 调用栈追踪阈值（次数）
    hookStackAlloc: true,                 // 是否追踪栈分配
    uiUpdateIntervalMsecs: 2000,          // UI 刷新间隔

    // 统计数据
    allocationsAtLoc: {},                 // 按位置统计的分配
    allocationSitePtrs: {},               // 指针到分配位置的映射
    sizeOfAllocatedPtr: {},               // 指针到大小的映射
    totalMemoryAllocated: 0,              // 总分配内存
    totalTimesMallocCalled: 0,            // malloc 调用次数
    totalTimesFreeCalled: 0,              // free 调用次数

    // UI 相关
    canvas: null,                         // Canvas 元素
    drawContext: null,                    // 2D 绘图上下文

    // 方法...
};
```

### 4.3 关键方法

#### initialize()

**功能**: 初始化 profiler，注入钩子，创建 UI

**调用时机**: 文件加载时自动执行（在文件末尾）

**核心操作**:
```javascript
initialize: function initialize() {
    // 1. 注入钩子
    Module['onMalloc'] = function(ptr, size) {
        emscriptenMemoryProfiler.onMalloc(ptr, size);
    };
    Module['onFree'] = function(ptr) {
        emscriptenMemoryProfiler.onFree(ptr);
    };

    // 2. 创建 UI 容器
    var div = document.createElement("div");
    div.innerHTML = "..."; // 包含 canvas 和控件

    // 3. 添加到 DOM
    document.body.appendChild(div);

    // 4. 设置定时刷新
    setInterval(() => emscriptenMemoryProfiler.updateUi(),
                emscriptenMemoryProfiler.uiUpdateIntervalMsecs);
}
```

#### onMalloc(ptr, size)

**功能**: 处理内存分配事件

**流程**:
```javascript
onMalloc: function onMalloc(ptr, size) {
    if (!ptr) return;

    var self = emscriptenMemoryProfiler;

    // 1. 更新全局统计
    self.totalMemoryAllocated += size;
    ++self.totalTimesMallocCalled;

    // 2. 记录分配位置
    self.sizeOfAllocatedPtr[ptr] = size;

    // 3. 捕获调用栈
    var loc = new Error().stack.toString();
    if (!self.allocationsAtLoc[loc]) {
        self.allocationsAtLoc[loc] = [0, 0, self.filterCallstackForMalloc(loc)];
    }
    self.allocationsAtLoc[loc][0] += 1;  // 次数
    self.allocationsAtLoc[loc][1] += size; // 大小
    self.allocationSitePtrs[ptr] = loc;
}
```

#### onFree(ptr)

**功能**: 处理内存释放事件

**流程**:
```javascript
onFree: function onFree(ptr) {
    if (!ptr) return;

    var self = emscriptenMemoryProfiler;
    var sz = self.sizeOfAllocatedPtr[ptr];

    // 1. 更新全局统计
    self.totalMemoryAllocated -= sz;
    ++self.totalTimesFreeCalled;

    // 2. 清除记录
    delete self.sizeOfAllocatedPtr[ptr];
    delete self.allocationSitePtrs[ptr];
}
```

#### updateUi()

**功能**: 刷新 UI 显示

**重要**: ⚠️ 此方法包含强制滚动代码

```javascript
updateUi: function updateUi() {
    // ... 统计和绘图逻辑 ...

    // ⚠️ 问题代码：强制启用滚动条
    document.body.style.overflow = '';  // 这会覆盖应用的 overflow 设置！
}
```

### 4.4 自动初始化机制

在 `memoryprofiler.js` 文件的末尾：

```javascript
#if MEMORYPROFILER
// ... emscriptenMemoryProfiler 定义 ...

// 文件末尾的自动初始化
if (typeof runtimeInitialized === 'undefined' || runtimeInitialized) {
    emscriptenMemoryProfiler.initialize();
}
#endif
```

**时序**:
1. 文件被注入到生成的 `.js` 文件中
2. 页面加载时执行
3. `runtimeInitialized` 为 true 后自动调用 `initialize()`

---

## 5. UI 创建流程

### 5.1 创建时机

**同步创建**（如果 `document.body` 存在）:
```javascript
if (document.body) {
    populateHtmlBody();  // 立即创建
}
```

**延迟创建**（如果 `document.body` 不存在）:
```javascript
else {
    setTimeout(populateHtmlBody, 1000);  // 1秒后重试
}
```

### 5.2 DOM 插入方式

```javascript
var div = document.createElement("div");
div.innerHTML = `
    <div style='border: 2px solid black; padding: 2px;'>
        <canvas id='memoryprofiler_canvas' width='100%' height='50'></canvas>
        <!-- 各种控件 -->
    </div>
`;

document.body.appendChild(div);  // ⚠️ 直接插入到 body
```

**特点**:
- 插入到 `<body>` 的直接子元素
- 使用内联样式（`border: 2px solid black`）
- 没有 ID 或 class，只能通过样式选择器定位

### 5.3 强制滚动问题

**问题代码位置**: `updateUi()` 方法

```javascript
// memoryprofiler.js 原始代码
updateUi: function updateUi() {
    // ... 绘图逻辑 ...

    // ⚠️ 问题：每次刷新都重置 body 的 overflow
    document.body.style.overflow = '';
}
```

**影响**:
- 每 2 秒执行一次（`uiUpdateIntervalMsecs: 2000`）
- 会覆盖应用设置的 `overflow: hidden`
- 导致页面出现滚动条或布局抖动

---

## 6. 自定义方案

### 6.1 方案对比表

| 方案 | 实现方式 | 优点 | 缺点 | 推荐度 |
|------|---------|------|------|--------|
| **A: 修改源码** | 替换 Emscripten 源码目录的文件 | ✅ 彻底解决问题<br>✅ 可自定义所有功能<br>✅ 一次配置，永久生效 | ⚠️ 需要 Emscripten 写权限<br>⚠️ 升级 Emscripten 需重新应用<br>⚠️ 影响所有项目 | ⭐⭐⭐⭐⭐ (本方案) |
| **B: 后处理 JS** | 编译后修改生成的 `.js` 文件 | ✅ 不影响 Emscripten 安装<br>✅ 项目独立 | ⚠️ 每次编译都要处理<br>⚠️ 文件大处理慢<br>⚠️ 可能影响 source map | ⭐⭐⭐ |
| **C: 运行时 CSS** | 通过 `--pre-js` 注入 CSS 和 JS | ✅ 不修改源码<br>✅ 灵活可控 | ⚠️ CSS 选择器脆弱<br>⚠️ 仍需处理强制滚动<br>⚠️ 时序问题复杂 | ⭐⭐⭐⭐ |
| **D: 运行时 Hook** | 运行时替换 `updateUi` 方法 | ✅ 最灵活<br>✅ 易于调试 | ⚠️ 需要精确的时序控制<br>⚠️ 可能被覆盖 | ⭐⭐⭐ |

### 6.2 方案 A：修改源码（本项目实现）

**原理**: 在编译前临时替换 Emscripten 源码目录的 `memoryprofiler.js`

**流程**:
```
1. 备份原始文件: memoryprofiler.js → memoryprofiler.js.backup
2. 拷贝自定义文件: memoryprofiler_custom.js → memoryprofiler.js
3. 执行编译（使用被替换的文件）
4. 恢复原始文件: memoryprofiler.js.backup → memoryprofiler.js
```

**实现工具**: `DeployMemoryProfiler.cmake`

### 6.3 方案 B：后处理生成的 JS

```bash
# 编译后执行
sed -i 's/document\.body\.style\.overflow = .*\;/\/\/ FIXED/g' build-wasm/spine.js
```

**问题**:
- 文件很大（几 MB），处理慢
- Source map 可能失效
- 需要每次编译后执行

### 6.4 方案 C：运行时修改（组合方案）

**原理**: 通过 `--pre-js` 注入代码，在运行时修改

**三个策略**:

1. **CSS 样式注入** - 立即隐藏/重新定位原始 UI
2. **DOM 监听修改** - MutationObserver 监听 UI 创建
3. **方法 Hook** - 替换 `updateUi` 阻止强制滚动

**实现文件**: `memory_profiler_custom.js`

---

## 7. 本项目实现

### 7.1 文件结构

```
native/cocos/editor-support/spine-wasm/
├── CMakeLists.txt                          # 主 CMake 配置
├── CMakeModules/
│   └── DeployMemoryProfiler.cmake          # 部署工具模块
├── memoryprofiler_custom.js                # 自定义 profiler（方案 A）
├── memory_profiler_custom.js               # 额外注入脚本（方案 C）
└── build-wasm/
    └── spine.js                            # 编译输出
```

### 7.2 自定义文件：memoryprofiler_custom.js

**功能**:
1. 汉化所有文本标签
2. 创建浮动面板样式
3. 移除强制滚动代码
4. 添加关闭按钮和切换功能

**关键修改**:

```javascript
// 汉化文本映射
stack: "初始堆 sbrk 限制<br>",  // 原: "initial heap sbrk limit<br>"
console.log('内存调整: ' + oldSize + ' ' + newSize);  // 原: 'memory resize:'

// 浮动面板样式
div.style.cssText = `
    position: fixed !important;
    top: 10px !important;
    right: 10px !important;
    width: 400px !important;
    max-height: 70vh !important;
    overflow-y: auto !important;
    background: rgba(255,255,255,0.98) !important;
    border-radius: 8px !important;
    box-shadow: 0 8px 16px rgba(0,0,0,0.3) !important;
    z-index: 999999 !important;
`;

// 移除强制滚动
updateUi: function updateUi() {
    // ... 原有逻辑 ...
    // document.body.style.overflow = '';  // ← 已删除这行
}
```

### 7.3 部署模块：DeployMemoryProfiler.cmake

**功能**: 自动化备份、替换、恢复流程

**主要函数**:

#### find_emscripten_path(VAR)

查找 Emscripten 安装路径的优先级：

```cmake
1. 环境变量 $EMSDK/upstream/emscripten
2. 环境变量 $EMSCRIPTEN_ROOT
3. E 盘常见位置: E:/softwares/emsdk-*/upstream/emscripten
4. C/D 盘: C:/emsdk-*/upstream/emscripten
```

#### deploy_memory_profiler(CUSTOM_PROFILER_PATH)

部署自定义版本：

```cmake
# 1. 查找 Emscripten 路径
find_emscripten_path(EMSCRIPTEN_PATH)

# 2. 备份原始文件
execute_process(
    COMMAND ${CMAKE_COMMAND} -E copy
        "${ORIGINAL_PROFILER}" "${BACKUP_PROFILER}"
)

# 3. 拷贝自定义版本
execute_process(
    COMMAND ${CMAKE_COMMAND} -E copy
        "${CUSTOM_PROFILER_PATH}" "${ORIGINAL_PROFILER}"
)
```

#### restore_memory_profiler()

恢复原始文件：

```cmake
# 拷贝备份文件回原位置
execute_process(
    COMMAND ${CMAKE_COMMAND} -E copy
        "${BACKUP_PROFILER}" "${ORIGINAL_PROFILER}"
)

# 删除备份
execute_process(
    COMMAND ${CMAKE_COMMAND} -E remove "${BACKUP_PROFILER}"
)
```

### 7.4 集成方式：CMakeLists.txt

**配置**:

```cmake
# 第 20 行：启用内存分析
set(ENABLE_MEMORY_PROFILING "--memoryprofiler -sDEFAULT_LIBRARY_FUNCS_TO_INCLUDE=$demangleAll")

# 第 89-93 行：编译前部署
if(ENABLE_MEMORY_PROFILING)
    include(DeployMemoryProfiler)
    deploy_memory_profiler("${CMAKE_CURRENT_LIST_DIR}/memoryprofiler_custom.js")
endif()

# 第 97-106 行：编译后恢复
if(ENABLE_MEMORY_PROFILING)
    add_custom_command(TARGET ${APP_NAME} POST_BUILD
        COMMAND ${CMAKE_COMMAND}
            -DCMAKE_MODULE_PATH=${CMAKE_MODULE_PATH}
            -DRESTORE_PROFILER=TRUE
            -P "${CMAKE_CURRENT_LIST_DIR}/CMakeModules/DeployMemoryProfiler.cmake"
        COMMENT "恢复原始 memoryprofiler.js"
    )
endif()
```

### 7.5 工作流程

```
┌─────────────────────────────────────────────────────────────┐
│ 1. CMake 配置阶段                                            │
│    - include(DeployMemoryProfiler)                          │
│    - deploy_memory_profiler(...) 被调用                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. 部署阶段（编译前）                                         │
│    - 查找 Emscripten 路径                                    │
│    - 备份 memoryprofiler.js → memoryprofiler.js.backup      │
│    - 拷贝 memoryprofiler_custom.js → memoryprofiler.js      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. 编译阶段                                                  │
│    - Emscripten 使用被替换的 memoryprofiler.js              │
│    - 生成包含自定义 UI 的 spine.js                           │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. POST_BUILD 阶段                                           │
│    - add_custom_command 执行                                │
│    - restore_memory_profiler() 被调用                       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. 恢复阶段                                                  │
│    - memoryprofiler.js.backup → memoryprofiler.js           │
│    - 删除 .backup 文件                                       │
│    - Emscripten 目录恢复原状                                 │
└─────────────────────────────────────────────────────────────┘
```

### 7.6 额外注入：memory_profiler_custom.js

**用途**: 通过 `--pre-js` 注入，使用方案 C 的运行时修改

**CMake 配置**:
```cmake
# 第 129 行
--pre-js ../memory_profiler_custom.js
```

**功能**:
1. **策略1**: 立即注入 CSS，隐藏并重新定位原始 UI
2. **策略2**: 创建切换按钮
3. **策略3**: MutationObserver 监听 DOM 变化，运行时修改 UI
4. **策略4**: Hook `updateUi()` 方法，阻止强制滚动

```javascript
// 策略 4 示例
function preventForceScroll() {
    if (typeof emscriptenMemoryProfiler !== 'undefined'
        && emscriptenMemoryProfiler.updateUi) {
        var originalUpdateUi = emscriptenMemoryProfiler.updateUi;
        emscriptenMemoryProfiler.updateUi = function() {
            var originalOverflow = document.body.style.overflow;
            originalUpdateUi.call(this);
            document.body.style.overflow = originalOverflow;  // 恢复
        };
        return true;
    }
    return false;
}
```

---

## 8. 关键代码片段

### 8.1 浮动面板样式

```css
/* 隐藏并重新定位原始 profiler 容器 */
body > div[style*="border: 2px solid black"],
body > div[style*="memoryprofiler_canvas"] {
    position: fixed !important;
    top: 10px !important;
    right: 10px !important;
    width: 400px !important;
    max-height: 70vh !important;
    overflow-y: auto !important;
    background: rgba(255,255,255,0.98) !important;
    border: 2px solid #333 !important;
    border-radius: 8px !important;
    box-shadow: 0 8px 16px rgba(0,0,0,0.3) !important;
    z-index: 999999 !important;
    padding: 15px !important;
    display: none !important;  /* 默认隐藏 */
    font-family: monospace !important;
    font-size: 12px !important;
}

/* 修复 canvas 宽度 */
#memoryprofiler_canvas {
    width: 370px !important;
}
```

### 8.2 汉化文本映射

| 原始文本 | 汉化文本 | 位置 |
|---------|---------|------|
| "initial heap sbrk limit<br>" | "初始堆 sbrk 限制<br>" | onSbrkGrow |
| "initial heap size<br>" | "初始堆大小<br>" | onMemoryResize |
| 'memory resize: ' | '内存调整: ' | onMemoryResize |

### 8.3 禁用强制滚动

**在 memoryprofiler_custom.js 中**（方案 A）:
```javascript
// 完全删除 updateUi() 中的这行：
// document.body.style.overflow = '';
```

**在 memory_profiler_custom.js 中**（方案 C）:
```javascript
// Hook updateUi 方法
var originalUpdateUi = emscriptenMemoryProfiler.updateUi;
emscriptenMemoryProfiler.updateUi = function() {
    var originalOverflow = document.body.style.overflow;
    originalUpdateUi.call(this);
    document.body.style.overflow = originalOverflow;  // 恢复原值
};
```

### 8.4 查找 Profiler 容器

```javascript
// 多种选择器策略
function findProfilerDiv() {
    // 方法 1: 通过内联样式
    var profilerDiv = document.querySelector('div[style*="border: 2px solid black"]');

    // 方法 2: 通过 canvas ID
    if (!profilerDiv) {
        profilerDiv = document.querySelector('div[style*="memoryprofiler_canvas"]');
    }

    // 方法 3: 通过 canvas 的父元素
    if (!profilerDiv) {
        var canvas = document.getElementById('memoryprofiler_canvas');
        if (canvas) {
            profilerDiv = canvas.parentElement;
        }
    }

    return profilerDiv;
}
```

---

## 9. 调试技巧

### 9.1 验证 Profiler 是否注入

**检查编译后的 JS 文件**:

```bash
# Windows PowerShell
Select-String -Path "build-wasm\spine.js" -Pattern "emscriptenMemoryProfiler"

# Linux/macOS
grep -n "emscriptenMemoryProfiler" build-wasm/spine.js
```

**预期输出**:
- 应该找到多处匹配
- 如果没有，说明 `--memoryprofiler` 未生效

### 9.2 检查自定义版本是否部署

```bash
# 检查 Emscripten 源码目录的文件
cat e:\softwares\emsdk-3.1.44\upstream\emscripten\src\memoryprofiler.js | grep "内存调整"
```

**预期输出**:
- 如果显示中文文本，说明自定义版本已部署
- 如果是英文，说明未部署或恢复失败

### 9.3 浏览器控制台检查

**检查对象是否存在**:
```javascript
console.log(typeof emscriptenMemoryProfiler);  // 应该是 "object"
```

**检查统计信息**:
```javascript
console.log(emscriptenMemoryProfiler.totalMemoryAllocated);
console.log(emscriptenMemoryProfiler.totalTimesMallocCalled);
console.log(emscriptenMemoryProfiler.totalTimesFreeCalled);
```

**手动触发刷新**:
```javascript
emscriptenMemoryProfiler.updateUi();
```

### 9.4 常见问题排查

#### 问题 1: Profiler UI 不显示

**检查清单**:
- [ ] 确认 `--memoryprofiler` 编译选项存在
- [ ] 检查 `document.body` 是否存在
- [ ] 查看控制台是否有 JavaScript 错误
- [ ] 检查 CSS 是否隐藏了 UI

**调试代码**:
```javascript
// 检查 canvas 元素
var canvas = document.getElementById('memoryprofiler_canvas');
console.log('Canvas:', canvas);
console.log('Canvas parent:', canvas ? canvas.parentElement : null);
```

#### 问题 2: 强制滚动依然存在

**检查清单**:
- [ ] 确认 `memory_profiler_custom.js` 通过 `--pre-js` 注入
- [ ] 检查 Hook 是否成功：`console.log(emscriptenMemoryProfiler.updateUi.toString())`
- [ ] 验证时序：Hook 代码需要在 `initialize()` 之后执行

**解决方案**:
```javascript
// 增加轮询等待时间
var patchInterval = setInterval(function() {
    if (preventForceScroll()) {
        clearInterval(patchInterval);
        console.log('[MemoryProfiler] Hook 成功');
    }
}, 50);

// 增加超时时间
setTimeout(function() {
    clearInterval(patchInterval);
    console.warn('[MemoryProfiler] Hook 超时');
}, 10000);  // 10 秒
```

#### 问题 3: CMake 部署失败

**错误信息**:
```
CMake Error: 找不到 Emscripten 安装路径
```

**解决方案**:
```bash
# 设置环境变量
export EMSDK=/path/to/emsdk
# 或
export EMSCRIPTEN_ROOT=/path/to/emscripten

# 重新运行 CMake
cmake .. -G "Unix Makefiles"
```

#### 问题 4: 编译后原始文件未恢复

**手动恢复**:
```bash
cp e:\softwares\emsdk-3.1.44\upstream\emscripten\src\memoryprofiler.js.backup \
   e:\softwares\emsdk-3.1.44\upstream\emscripten\src\memoryprofiler.js

# 删除备份
rm e:\softwares\emsdk-3.1.44\upstream\emscripten\src\memoryprofiler.js.backup
```

### 9.5 编译错误处理

#### 错误: "找不到 memoryprofiler_custom.js"

**原因**: 文件路径错误或文件不存在

**解决**:
```cmake
# 使用绝对路径
deploy_memory_profiler("${CMAKE_CURRENT_LIST_DIR}/memoryprofiler_custom.js")
```

#### 错误: "Permission denied" 备份/拷贝失败

**原因**: Emscripten 目录没有写权限

**解决**:
```bash
# Windows（以管理员身份运行）
# 修改 Emscripten 目录权限

# Linux/macOS
sudo chown -R $USER /path/to/emsdk
```

---

## 10. 参考资料

### 10.1 Emscripten 版本信息

| 项目 | 版本/路径 |
|------|----------|
| Emscripten 主版本 | 3.1.44 |
| 备用版本 | 3.1.41 |
| 安装路径 | `e:\softwares\emsdk-3.1.44\` |
| 源码路径 | `upstream\emscripten\src\` |

### 10.2 相关文件路径

| 文件 | 项目路径 | Emscripten 路径 |
|------|---------|----------------|
| 自定义 Profiler | `native/cocos/editor-support/spine-wasm/memoryprofiler_custom.js` | - |
| 部署模块 | `native/cocos/editor-support/spine-wasm/CMakeModules/DeployMemoryProfiler.cmake` | - |
| 额外注入脚本 | `native/cocos/editor-support/spine-wasm/memory_profiler_custom.js` | - |
| 原始 Profiler | - | `src/memoryprofiler.js` |
| Trace 库 | - | `src/library_trace.js` |

### 10.3 本项目配置

**CMakeLists.txt 关键配置**:
```cmake
# 第 20 行
set(ENABLE_MEMORY_PROFILING "--memoryprofiler -sDEFAULT_LIBRARY_FUNCS_TO_INCLUDE=$demangleAll")

# 第 25 行
set(CMAKE_BUILD_TYPE "Debug")

# 第 129 行
--pre-js ../memory_profiler_custom.js
```

### 10.4 文档版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0 | 2026-02-11 | 初始版本，基于项目实际实现 |

---

## 附录

### A. 完整的 memoryprofiler 对象结构

```javascript
var emscriptenMemoryProfiler = {
    // 配置
    detailedHeapUsage: true,
    trackedCallstackMinSizeBytes: Infinity,
    trackedCallstackMinAllocCount: Infinity,
    hookStackAlloc: true,
    uiUpdateIntervalMsecs: 2000,

    // 统计数据
    allocationsAtLoc: {},
    allocationSitePtrs: {},
    sizeOfAllocatedPtr: {},
    sizeOfPreRunAllocatedPtr: {},
    resizeMemorySources: [],
    sbrkSources: [],
    pagePreRunIsFinished: false,
    totalMemoryAllocated: 0,
    totalTimesMallocCalled: 0,
    totalTimesFreeCalled: 0,
    stackTopWatermark: Infinity,

    // UI
    canvas: null,
    drawContext: null,
    memoryprofiler_summary: null,
    memoryprofiler_ptrs: null,

    // 工具方法
    truncDec: function(f) { ... },
    formatBytes: function(bytes) { ... },
    hsvToRgb: function(h, s, v) { ... },

    // 事件处理
    onSbrkGrow: function(oldLimit, newLimit) { ... },
    onMemoryResize: function(oldSize, newSize) { ... },
    recordStackWatermark: function() { ... },
    onMalloc: function(ptr, size) { ... },
    onFree: function(ptr) { ... },
    onRealloc: function(oldAddress, newAddress, size) { ... },
    onPreloadComplete: function() { ... },

    // 核心
    initialize: function() { ... },
    updateUi: function() { ... },

    // 绘图
    bytesToPixelsRoundedDown: function(bytes) { ... },
    bytesToPixelsRoundedUp: function(bytes) { ... },
    fillLine: function(startBytes, endBytes) { ... },
    fillRect: function(startBytes, endBytes, heightPercentage) { ... },
    printAllocsWithCyclingColors: function(colors, allocs) { ... },

    // 过滤器
    filterURLsFromCallstack: function(callstack) { ... },
    filterCallstackForMalloc: function(callstack) { ... },
    filterCallstackForHeapResize: function(callstack) { ... }
};
```

### B. 编译选项详解

```bash
--memoryprofiler
    启用内存分析器
    - 定义 __EMSCRIPTEN_TRACING__ 宏
    - 注入 library_trace.js
    - 注入 memoryprofiler.js
    - 在 malloc/free 中插入追踪代码

-sDEFAULT_LIBRARY_FUNCS_TO_INCLUDE=$demangleAll
    包含符号反混淆函数
    - 使调用栈更易读
    - 用于显示 C++ 函数名

-gsource-map
    生成 source map
    - 便于调试
    - 保留原始源码映射

--pre-js <file>
    在生成的 JS 之前注入文件
    - 用于自定义初始化
    - 添加全局配置

--closure=[0|1]
    是否使用 Closure Compiler 优化
    - Debug: 0 (不优化)
    - Release: 1 (优化)
```

### C. 快速参考卡片

```markdown
## 启用 Memory Profiler

```bash
# 1. 设置 CMake 选项
set(ENABLE_MEMORY_PROFILING "--memoryprofiler")

# 2. 编译
emcc your_code.cpp -o output.js --memoryprofiler

# 3. 在浏览器中访问
# Profiler UI 会自动显示在页面底部
```

## 检查是否工作

```javascript
// 在浏览器控制台
console.log(emscriptenMemoryProfiler.totalMemoryAllocated);
```

## 常见问题

**Q: UI 不显示？**
A: 检查 `--memoryprofiler` 是否在编译命令中

**Q: 强制滚动问题？**
A: 使用方案 C 的 `memory_profiler_custom.js`

**Q: 如何汉化？**
A: 使用方案 A 替换 `memoryprofiler.js`
```

---

**文档结束**

如有疑问或需要补充，请联系项目负责人。
