# Spine WASM 内存信息获取方案

> 📅 创建日期: 2026-02-27
> 📝 目的: 总结从 JS 获取 Spine WASM 内存信息的可行方案

---

## 1. 当前状态

### 1.1 已有的内存分析工具

项目已集成 **Emscripten Memory Profiler**，通过 `--memoryprofiler` 编译选项启用：

- ✅ 实时内存监控（堆、栈、静态内存）
- ✅ malloc/free 调用追踪
- ✅ 可视化图表
- ✅ 调用栈分析

相关文件：
- `memoryprofiler_custom.js` - 自定义 profiler UI
- `CMakeModules/DeployMemoryProfiler.cmake` - 部署工具

### 1.2 不改配置能获取的信息

| JS 接口 | 值 | 说明 |
|--------|-----|------|
| `spine.HEAP8.length` | 例如：33554432 | **堆总大小**（字节） |
| `spine.HEAP8.buffer.byteLength` | 同上 | 同上 |

---

## 2. 方案对比

### 方案 A：不改 C++，不改编译选项

**限制**：只能获取堆总大小

```javascript
const totalMemory = spine.HEAP8.length;
console.log(`堆总大小: ${totalMemory} bytes`);
```

**优点**：
- ✅ 无需任何修改
- ✅ 立即可用

**缺点**：
- ❌ 信息有限，只有总大小

---

### 方案 B：仅添加导出（推荐）

**原理**：在 CMakeLists.txt 中添加导出列表，使 JS 能访问内存接口

**CMakeLists.txt 修改**：

```cmake
# 方案B：内存导出（用于调试）
# 使用方式：cmake -DENABLE_MEMORY_EXPORT=ON ..
option(ENABLE_MEMORY_EXPORT "启用内存导出（方案B），导出 ___heap_base, _sbrk 等函数" OFF)

# 方案B：内存导出处理
# 注意：内存导出需要合并到现有的 EXPORTED_FUNCTIONS 中
if(ENABLE_MEMORY_EXPORT)
    # 内存导出的函数列表
    set(MEMORY_EXPORTED_FUNCTIONS "'___heap_base','_sbrk',")
    # 关闭 JS 压缩，方便查看导出的函数
    set(ENABLE_CLOSURE_COMPILER 0)
    message(">>> 启用内存导出（方案B），关闭 JS 压缩")
endif()

# 在 EXPORTED_FUNCTIONS 中合并（注意格式）
-s EXPORTED_FUNCTIONS=[${MEMORY_EXPORTED_FUNCTIONS}'_spineListenerCallBackFromJS','_spineTrackListenerCallback']
```

**编译命令**：
```bash
cd native/cocos/editor-support/spine-wasm/build-wasm
emcmake cmake -DENABLE_MEMORY_EXPORT=ON ..
ninja
```

**JS 调用**：
```javascript
// 方式1：直接调用导出的函数
const heapEnd = spine._sbrk(0);
const totalMemory = spine.HEAP8.length;
const usedMemory = heapEnd;  // 堆起始地址为0
const freeMemory = totalMemory - heapEnd;

console.log(`堆总大小: ${totalMemory} bytes`);
console.log(`已使用: ${usedMemory} bytes`);
console.log(`空闲: ${freeMemory} bytes`);
```

**⚠️ 注意事项**：
- `___heap_base` 在 Emscripten 3.1.41 中可能被链接器优化，无法直接导出
- `_sbrk` 可以正常导出，用于获取当前堆边界
- `emscripten_stack_get_base/end` 在新版 Emscripten 中不可用

**优点**：
- ✅ 不改 C++ 代码
- ✅ 性能开销最小
- ✅ 生产环境可用

**缺点**：
- ❌ 需要重新编译
- ❌ 内存计算为近似值（堆起始地址可能为0）

---

### 方案 C：C++ 层封装

**原理**：在 C++ 层添加内存统计函数，导出给 JS 调用

**C++ 实现** (`spine-memory.cpp`)：
```cpp
#include <emscripten/emscripten.h>
#include <emscripten/heap.h>
#include <cstdint>

struct MemoryStats {
    uint32_t totalMemory;
    uint32_t usedMemory;
    uint32_t freeMemory;
};

EMSCRIPTEN_KEEPALIVE
uint32_t getTotalMemory() {
    return emscripten_get_heap_size();
}

EMSCRIPTEN_KEEPALIVE
uint32_t getUsedMemory() {
    uintptr_t* sbrkPtr = emscripten_get_sbrk_ptr();
    extern char __heap_base;
    return (uint32_t)(*sbrkPtr - (uintptr_t)&__heap_base);
}

EMSCRIPTEN_KEEPALIVE
uint32_t getFreeMemory() {
    return emscripten_get_heap_size() - getUsedMemory();
}
```

**JS 调用**：
```javascript
const total = spine.getTotalMemory();
const used = spine.getUsedMemory();
const free = spine.getFreeMemory();
```

**优点**：
- ✅ 数据精确
- ✅ 接口友好

**缺点**：
- ❌ 需要修改 C++ 代码

---

### 方案 D：启用 Memory Profiler

**原理**：使用 `--memoryprofiler` 编译选项，启用完整内存追踪

**JS 调用**：
```javascript
// 等待 profiler 初始化
setTimeout(() => {
    const profiler = window.emscriptenMemoryProfiler;
    console.log(`已分配: ${profiler.totalMemoryAllocated}`);
    console.log(`malloc次数: ${profiler.totalTimesMallocCalled}`);
    console.log(`free次数: ${profiler.totalTimesFreeCalled}`);
}, 2000);
```

**优点**：
- ✅ 功能最全面
- ✅ 无需修改 C++

**缺点**：
- ❌ 需要 `--memoryprofiler` 编译选项
- ❌ 有一定性能开销

---

## 3. 方案对比表

| 方案 | 改 C++ | 改编译选项 | 信息详细度 | 性能开销 | 推荐度 | 备注 |
|------|--------|-----------|-----------|---------|-------|------|
| A: 不改配置 | ❌ | ❌ | ⭐ (仅总大小) | 无 | ⭐⭐ | 立即可用 |
| B: 添加导出 | ❌ | ✅ | ⭐⭐⭐ | 最小 | ⭐⭐⭐⭐ | 已验证可行 |
| C: C++ 封装 | ✅ | ✅ | ⭐⭐⭐⭐⭐ | 最小 | ⭐⭐⭐⭐ | 接口最友好 |
| D: Memory Profiler | ❌ | ✅ | ⭐⭐⭐⭐⭐ | 中等 | ⭐⭐⭐ | 功能最全 |

---

## 4. 推荐方案

### 方案 B：添加导出（最佳平衡）

**已验证实现**（Emscripten 3.1.41 测试通过）：

**步骤**：

1. 在 `CMakeLists.txt` 中添加 `option` 和导出配置（见上方方案B详情）

2. 编译：
```bash
cd native/cocos/editor-support/spine-wasm/build-wasm
emcmake cmake -DENABLE_MEMORY_EXPORT=ON ..
ninja
```

3. JS 中使用：
```javascript
// 方式1：直接调用
function getSpineMemoryInfo() {
    const heapEnd = spine._sbrk(0);
    const total = spine.HEAP8.length;

    return {
        total: total,
        used: heapEnd,
        free: total - heapEnd
    };
}

// 定时采样
setInterval(() => {
    const mem = getSpineMemoryInfo();
    console.log(`Spine 内存: ${(mem.used / 1024 / 1024).toFixed(2)} MB / ${(mem.total / 1024 / 1024).toFixed(2)} MB`);
}, 5000);
```

**⚠️ 已知问题**：
- `emscripten_stack_get_base/end` 在 Emscripten 3.1.41 中不可用
- `___heap_base` 可能被优化掉，但 `_sbrk` 可用

---

## 5. 附录：Emscripten 内存接口参考

### C++ 头文件接口

```cpp
#include <emscripten/heap.h>

emscripten_get_heap_size()    // 当前堆大小
emscripten_get_heap_max()     // 最大堆限制
emscripten_get_sbrk_ptr()     // 获取 sbrk 指针
emscripten_resize_heap()      // 调整堆大小
```

### 导出的 JS 接口

| 函数 | 作用 |
|------|------|
| `spine.HEAP8.length` | 堆总大小 |
| `spine.___heap_base` | 堆起始地址（需导出） |
| `spine._sbrk(0)` | 堆当前边界（需导出） |
| `spine._emscripten_stack_get_base()` | 栈底地址（需导出） |
| `spine._emscripten_stack_get_end()` | 栈顶地址（需导出） |

---

**文档结束**
