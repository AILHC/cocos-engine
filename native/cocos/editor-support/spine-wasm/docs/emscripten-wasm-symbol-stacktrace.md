# Emscripten WASM 编译优化与堆栈还原完整方案

> 📅 创建日期: 2026-02-11
> 🎯 目标: 使用 emscripten 编译优化版 wasm 并保留符号信息，用于运行时堆栈还原
> 📂 项目路径: `d:\workspace\engines\cocos\3.8.6`
> 🎮 目标模块: `native/cocos/editor-support/spine-wasm/`

---

## 📋 目录

1. [核心概念](#1-核心概念)
2. [Emscripten 官方文档要点](#2-emscripten-官方文档要点)
3. [调试符号与 Source Map 详解](#3-调试符号与-source-map-详解)
4. [编译选项完整配置](#4-编译选项完整配置)
5. [运行时堆栈还原机制](#5-运行时堆栈还原机制)
6. [针对 spine-wasm 的具体方案](#6-针对-spine-wasm-的具体方案)
7. [符号表生成与使用](#7-符号表生成与使用)
8. [最佳实践与问题排查](#8-最佳实践与问题排查)

---

## 1. 核心概念

### 1.1 WebAssembly 调试的三层架构

```
┌─────────────────────────────────────────────────────────────┐
│                   浏览器 DevTools                        │
│              (需要 Source Map + 符号信息)                  │
└─────────────────────────────────────────────────────────────┘
                          ↑
┌─────────────────────────────────────────────────────────────┐
│                   JavaScript 层                           │
│         (spine.js + 错误捕获与反混淆)                  │
└─────────────────────────────────────────────────────────────┘
                          ↑
┌─────────────────────────────────────────────────────────────┐
│                  WebAssembly 层                        │
│       (spine.wasm + 符号表 + DWARF 信息)              │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 调试信息的三种形式

| 形式 | 文件 | 内容 | 用途 | 大小影响 |
|------|------|------|--------|---------|
| **Source Map** | `.wasm.map` | 源码位置映射 | 开发调试 | 中等 |
| **符号表** | `.js.symbols` | 函数名映射 | 生产环境堆栈还原 | 极小 |
| **DWARF** | `.debug.wasm` | 完整调试信息 | 符号化服务器 | 大 |

---

## 2. Emscripten 官方文档要点

### 2.1 官方文档来源

根据查阅的 Emscripten 官方文档，以下是关于调试符号的关键选项：

#### 官方文档地址：
- **Emscripten Compiler Frontend**: https://emscripten.org/docs/tools_reference/emcc.html
- **GitHub 仓库**: https://github.com/emscripten-core/emscripten

### 2.2 关键编译选项详解

#### 2.2.1 调试级别选项 `-g<level>`

根据官方文档，`-g<level>` 在链接时控制调试能力的级别：

| 级别 | 名称 | 功能 | 对优化影响 |
|--------|------|------|-----------|
| `-g0` | 无调试 | 不保留任何调试信息 | 无影响 |
| `-g1` | 保留空格 | 保留 JavaScript 中的空格和换行 | 轻微 |
| `-g2` | 保留函数名 | 通过 wasm name section 保留函数名 | 轻微 |
| `-g3` | 保留 DWARF | 保留 LLVM DWARF 调试信息 | 中等 |

**官方说明**：
> If used at link time, controls the level of debuggability overall. Each level builds on the previous one.

#### 2.2.2 Source Map 生成 `-gsource-map`

**官方定义**：
```
-gsource-map[=inline]
    [compile+link]
    Generate a source map using LLVM debug information (which must
    be present in object files, i.e. they should have been compiled with `-g`
    or `-gsource-map`).
```

**工作原理**：
1. 读取 LLVM 生成的 DWARF 调试信息
2. 将其转换为 Source Map 格式
3. 在 `.wasm` 文件中添加 `sourceMappingURL` section

**默认 URL 格式**：
```
<base-url> + <wasm-file-name> + .map
```

**修改 base URL**：
```
--source-map-base <base-url>
```

#### 2.2.3 Separate DWARF `-gseparate-dwarf`

**官方定义**：
```
-gseparate-dwarf[=FILENAME]
    Preserve debug information, but in a separate file on the side.
```

**功能**：
- 主 `.wasm` 文件不包含调试信息（减小体积）
- 调试信息保存在独立文件中（默认：`.debug.wasm`）
- 主文件包含指向调试文件的 URL

**自定义 URL**：
```
-s SEPARATE_DWARF_URL=<URL>
```

#### 2.2.4 符号表生成 `--emit-symbol-map`

**官方定义**：
```
--emit-symbol-map
    [link]
    Save a map file between function indexes in the Wasm and
    function names.
```

**生成的文件**：
- `<name>.js.symbols` - WASM 函数索引到名称的映射
- `<name>.wasm.js.symbols` - ASM.js 符号（使用 `-s WASM=2` 时）

#### 2.2.5 性能分析选项 `--profiling`

**官方定义**：
```
--profiling
    [link]
    Make the output suitable for profiling. This means including
    function names in the wasm and JS output.
```

**等效于**：`-g2`

#### 2.2.6 反混淆支持 `DEMANGLE_SUPPORT`

**设置**：
```cmake
-s DEMANGLE_SUPPORT=1
```

**作用**：
- 运行时自动将 C++ 混淆符号转换为可读形式
- 将 `_Z3fooi` 转换为 `foo(int)`

---

## 3. 调试符号与 Source Map 详解

### 3.1 DWARF 格式

**DWARF** 是一种标准的调试信息格式，Emscripten 使用 LLVM 生成：

| DWARF 版本 | 内容 |
|-----------|------|
| DWARF 2 | 基础调试信息 |
| DWARF 3 | 增强的类型信息 |
| DWARF 4 | 更大的地址空间支持 |
| DWARF 5 | 新的压缩格式 |

### 3.2 Source Map 格式

**Emscripten 生成的 Source Map 包含**：

```json
{
  "version": 3,
  "sources": ["../spine/Animation.cpp", "../spine/Skeleton.cpp"],
  "names": ["update", "setAnimation"],
  "mappings": "AAAA,SAASA,...",
  "file": "spine.wasm"
}
```

### 3.3 符号表格式

**`.js.symbols` 文件格式**（每行一个条目）：

```
1:malloc
2:free
3:_ZdlPv  // operator delete(void*)
4:spine::Animation::update
```

---

## 4. 编译选项完整配置

### 4.1 开发环境配置（完整调试）

```cmake
# CMakeLists.txt 配置
set(CMAKE_BUILD_TYPE "Debug")
set(ENABLE_CLOSURE_COMPILER 0)
set(SPINE_EXTRA_FLAGS "")

set(EMS_LINK_FLAGS "${SPINE_EXTRA_FLAGS}
    # 基础优化
    -O2

    # ===== 调试符号选项 =====
    # 保留函数名（-g2 等效）
    --profiling

    # 生成 source map
    -gsource-map
    --source-map-base http://localhost:8099/

    # 分离 DWARF 文件
    -gseparate-dwarf=spine.wasm.debug.wasm
    -s SEPARATE_DWARF_URL=http://localhost:8099/spine.wasm.debug.wasm

    # 保留完整 DWARF 信息
    -g3

    # ===== 运行时支持 =====
    # 启用反混淆
    -s DEMANGLE_SUPPORT=1

    # 包含符号还原函数
    -s DEFAULT_LIBRARY_FUNCS_TO_INCLUDE=$demangleAll

    # 断言和检查
    -s ASSERTIONS=2
    -s STACK_OVERFLOW_CHECK=2

    # ===== 其他选项 =====
    -s WASM=1
    -s ALLOW_MEMORY_GROWTH=1
    -s INITIAL_MEMORY=16777216
    --js-library ../library_spine.js
")
```

### 4.2 生产环境配置（优化+最小符号）

```cmake
set(CMAKE_BUILD_TYPE "Release")
set(ENABLE_CLOSURE_COMPILER 1)
set(SPINE_EXTRA_FLAGS "-O3")

set(EMS_LINK_FLAGS "${SPINE_EXTRA_FLAGS}
    # 激进优化
    -O3
    -flto

    # ===== 最小符号选项 =====
    # 仅保留函数名（不含 DWARF）
    --profiling-funcs

    # 生成符号表（不含源码位置）
    --emit-symbol-map

    # 不生成 source map
    # -gsource-map  # 不使用

    # ===== 运行时支持 =====
    -s DEMANGLE_SUPPORT=1
    -s ASSERTIONS=0  # 关闭断言以减小体积
")
```

### 4.3 当前配置分析

**当前配置**（CMakeLists.txt 第 117-129 行）：

```cmake
set(EMS_LINK_FLAGS "${SPINE_EXTRA_FLAGS} ${EVAL_CTOR_FLAG}
    -s VERBOSE=${VERBOSE_LOG}
    -s WASM=${BUILD_WASM}
    -s INITIAL_MEMORY=16777216
    -s ALLOW_MEMORY_GROWTH=1
    -s DYNAMIC_EXECUTION=0
    -s ERROR_ON_UNDEFINED_SYMBOLS=0
    ${ENABLE_MEMORY_PROFILING}
    -flto
    --no-entry
    --bind
    -s USE_ES6_IMPORT_META=0
    -s EXPORT_ES6=1
    -s MODULARIZE=1
    -s EXPORT_NAME='spineWasm'
    -s ENVIRONMENT=web
    -s FILESYSTEM=0
    -s NO_EXIT_RUNTIME=1
    -s LLD_REPORT_UNDEFINED
    -s MIN_SAFARI_VERSION=110000
    -s EXPORTED_FUNCTIONS=['_spineListenerCallBackFromJS','_spineTrackListenerCallback']
    --js-library ../library_spine.js
    --closure=${ENABLE_CLOSURE_COMPILER}
    --closure-args=--externs=../library_spine_externs.js
    -s ASSERTIONS=2
    --memoryprofiler
    -s DEMANGLE_SUPPORT=1
    -s STACK_OVERFLOW_CHECK=2
    -gsource-map
    --source-map-base http://localhost:8099/
    -gseparate-dwarf=spine.wasm.debug.wasm
    --pre-js ../memory_profiler_custom.js")
```

**分析**：
- ✅ 已启用 `-gsource-map`
- ✅ 已启用 `-gseparate-dwarf`
- ✅ 已启用 `DEMANGLE_SUPPORT`
- ✅ 已启用 `--memoryprofiler`
- ⚠️ **缺失** `-s SEPARATE_DWARF_URL`（浏览器无法自动加载调试文件）
- ⚠️ **缺失** `--emit-symbol-map`（没有符号表文件）

---

## 5. 运行时堆栈还原机制

### 5.1 浏览器中的堆栈获取

#### 方法 1: 使用 `error.stack`

```javascript
try {
    Module._someFunction();
} catch (error) {
    console.log(error.stack);
    // 输出类似:
    // Error: Aborted(Assertion failed)
    //     at spine::Animation::update (spine.wasm:0x1234)
    //     at Module._spineListenerCallBackFromJS (spine.js:4567)
}
```

#### 方法 2: 使用 `stackTrace()` API

```javascript
if (Module.stackTrace) {
    const trace = Module.stackTrace();
    console.log(trace);
}
```

### 5.2 符号化堆栈

#### 5.2.1 使用生成的符号表

**加载符号表**：

```javascript
// 加载生成的 .js.symbols 文件
async function loadSymbols() {
    const response = await fetch('spine.js.symbols');
    const text = await response.text();

    const symbols = new Map();
    for (const line of text.split('\n')) {
        const [index, name] = line.split(':');
        symbols.set(parseInt(index), name);
    }

    return symbols;
}

// 符号化堆栈
function symbolicateStack(stack, symbols) {
    return stack.replace(/wasm-function\[(\d+)\]/g, (match, index) => {
        const name = symbols.get(parseInt(index));
        return name ? `${name} [wasm:${index}]` : match;
    });
}
```

#### 5.2.2 使用 `demangle` 函数

**如果启用了 `-s DEMANGLE_SUPPORT=1`**：

```javascript
// Emscripten 自动包含的函数
if (Module.demangle) {
    const readable = Module.demangle('_Z3spine6Skeleton9updateEv');
    console.log(readable);  // spine::Skeleton::update(Entry)
}
```

### 5.3 Source Map 解析

**使用 source-map 库**：

```javascript
import { SourceMapConsumer } from 'source-map';

async function loadSourceMap() {
    const response = await fetch('spine.wasm.map');
    const json = await response.json();

    const consumer = await new SourceMapConsumer(json);

    // 解析堆栈
    const original = consumer.originalPositionFor({
        line: 1,
        column: 1234,
        source: 'spine.wasm'
    });

    console.log(`原始位置: ${original.source}:${original.line}`);
}
```

---

## 6. 针对 spine-wasm 的具体方案

### 6.1 推荐的完整配置

**基于项目结构，修改 CMakeLists.txt**：

```cmake
# 第 19 行：设置构建类型
set(CMAKE_BUILD_TYPE "RelWithDebInfo")  # 优化但保留调试信息

# 第 117-129 行：更新链接标志
set(EMS_LINK_FLAGS "${SPINE_EXTRA_FLAGS} ${EVAL_CTOR_FLAG}
    -s VERBOSE=${VERBOSE_LOG}
    -s WASM=${BUILD_WASM}
    -s INITIAL_MEMORY=16777216
    -s ALLOW_MEMORY_GROWTH=1
    -s DYNAMIC_EXECUTION=0
    -s ERROR_ON_UNDEFINED_SYMBOLS=0
    ${ENABLE_MEMORY_PROFILING}

    # ===== 优化选项 =====
    -O2  # 使用 -O2 而非 -O3，平衡性能和调试

    # ===== 调试符号选项 =====
    --profiling  # 保留函数名（等效 -g2）
    -gsource-map  # 生成 source map
    --source-map-base http://localhost:8099/  # 本地开发服务器
    --emit-symbol-map  # 生成符号表文件

    # ===== 分离 DWARF 选项 =====
    -gseparate-dwarf=spine.wasm.debug.wasm
    -s SEPARATE_DWARF_URL=http://localhost:8099/spine.wasm.debug.wasm

    # ===== 运行时支持 =====
    -s DEMANGLE_SUPPORT=1
    -s DEFAULT_LIBRARY_FUNCS_TO_INCLUDE=$demangleAll
    -s ASSERTIONS=2
    -s STACK_OVERFLOW_CHECK=2

    # ===== 其他选项 =====
    -flto
    --no-entry
    --bind
    -s USE_ES6_IMPORT_META=0
    -s EXPORT_ES6=1
    -s MODULARIZE=1
    -s EXPORT_NAME='spineWasm'
    -s ENVIRONMENT=web
    -s FILESYSTEM=0
    -s NO_EXIT_RUNTIME=1
    -s LLD_REPORT_UNDEFINED
    -s MIN_SAFARI_VERSION=110000
    -s EXPORTED_FUNCTIONS=['_spineListenerCallBackFromJS','_spineTrackListenerCallback']
    --js-library ../library_spine.js
    --closure=${ENABLE_CLOSURE_COMPILER}
    --closure-args=--externs=../library_spine_externs.js
    --pre-js ../memory_profiler_custom.js")
```

### 6.2 编译后的输出文件

编译成功后，`build-wasm/` 目录应包含：

| 文件 | 大小 | 用途 |
|------|------|------|
| `spine.js` | ~500KB | JavaScript glue 代码 |
| `spine.wasm` | ~200KB | 主 WASM 文件（无调试信息） |
| `spine.wasm.map` | ~100KB | Source Map（源码位置映射） |
| `spine.wasm.debug.wasm` | ~2MB | DWARF 调试信息 |
| `spine.js.symbols` | ~20KB | 函数名到索引的映射 |
| `spine.wasm.js.symbols` | ~10KB | WASM 函数符号（如果使用 WASM=2） |

### 6.3 CMakeLists_DEBUG.txt 的问题

**调试配置文件**（CMakeLists_DEBUG.txt）存在以下问题：

1. **第 38-39 行重复**：
```cmake
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} ${SPINE_EXTRA_FLAGS} ...)  # 第 36 行
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} ${SPINE_EXTRA_FLAGS} ...)  # 第 38 行 - 重复！
```

2. **没有使用 `--emit-symbol-map`**：
   当前配置没有生成符号表文件

3. **没有设置 `SEPARATE_DWARF_URL`**：
   浏览器无法自动加载 `.debug.wasm` 文件

---

## 7. 符号表生成与使用

### 7.1 使用 `--emit-symbol-map`

**完整编译命令**：

```bash
cd native/cocos/editor-support/spine-wasm
emcmake cmake . -G "Ninja"
emcmake cmake --build . --target spine

# 或手动编译
emcc \
    $(find ../spine/3.8/spine -name "*.cpp") \
    *.cpp \
    -o spine.js \
    -O2 \
    -s WASM=1 \
    -gsource-map \
    --emit-symbol-map \
    -s DEMANGLE_SUPPORT=1 \
    -s MODULARIZE=1 \
    -s EXPORT_NAME="'spineWasm'"
```

### 7.2 符号表内容示例

**spine.js.symbols**（简化示例）：

```
1:___cxa_allocate_exception
2:___cxa_throw
3:___gxx_personality_v0
4:___resume
5:__cxa_begin_catch
6:_ZdlPv
7:_Znwj
8:_Znaj
9:free
10:malloc
11:realloc
12:_ZN5spine8Animation6updateEN4spine9EntryTypeE
13:_ZN5spine8Skeleton9updateAnimationEd
```

### 7.3 运行时堆栈解析工具

#### 方案 1: 纯浏览器方案

**在 `memory_profiler_custom.js` 中添加**：

```javascript
// 全局错误捕获
window.addEventListener('error', function(event) {
    const stack = event.error.stack;
    const symbolicated = symbolicateStack(stack);
    console.log('符号化堆栈:\n', symbolicated);
});

function symbolicateStack(stack) {
    if (!Module.symbols) {
        return stack;
    }

    return stack.replace(/wasm-function\[(\d+)\]/g, (match, index) => {
        const name = Module.symbols[parseInt(index)];
        return name ? `${name} ${match}` : match;
    });
}

// 加载符号表
fetch('spine.js.symbols')
    .then(r => r.text())
    .then(text => {
        Module.symbols = {};
        for (const line of text.split('\n')) {
            const [idx, name] = line.split(':');
            Module.symbols[parseInt(idx)] = name;
        }
    });
```

#### 方案 2: Node.js 服务端方案

**创建符号化服务器**（`symbolicate-server.js`）：

```javascript
const fs = require('fs');
const http = require('http');

const symbols = fs.readFileSync('spine.js.symbols', 'utf8')
    .split('\n')
    .reduce((map, line) => {
        const [idx, name] = line.split(':');
        if (name) map[parseInt(idx)] = name;
        return map;
    }, {});

http.createServer((req, res) => {
    if (req.url === '/symbolicate') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const stack = JSON.parse(body);
            const result = stack.map(frame => {
                const match = frame.match(/wasm-function\[(\d+)\]/);
                if (match) {
                    const name = symbols[parseInt(match[1])];
                    return frame.replace(match[0], name || match[0]);
                }
                return frame;
            });
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify(result));
        });
    }
}).listen(3000);
```

---

## 8. 最佳实践与问题排查

### 8.1 推荐的编译策略

| 场景 | 优化级别 | 调试选项 | 符号保留 | 体积 | 性能 |
|------|----------|----------|----------|------|------|
| **本地开发** | `-O0` 或 `-Og` | `-g3 -gsource-map` | 完整 | 大 | 慢 |
| **测试环境** | `-O2` | `--profiling -gsource-map --emit-symbol-map` | 函数名 | 中 | 中 |
| **生产环境** | `-O3` | `--profiling-funcs --emit-symbol-map` | 仅符号表 | 小 | 快 |

### 8.2 常见问题排查

#### 问题 1: Source Map 不生效

**检查清单**：
1. `.wasm` 文件中是否包含 `sourceMappingURL` section
   ```bash
   # 查看 wasm 自定义 section
   wasm-objdump -h spine.wasm | grep sourceMappingURL
   ```

2. 服务器是否正确设置了 MIME 类型
   ```
   .wasm  → application/wasm
   .wasm.map → application/json
   ```

3. `--source-map-base` 是否与开发服务器匹配
   ```cmake
   # 如果使用 http://localhost:8099/
   --source-map-base http://localhost:8099/
   ```

#### 问题 2: 函数名仍然混淆

**原因**：未启用 `DEMANGLE_SUPPORT`

**解决**：
```cmake
-s DEMANGLE_SUPPORT=1
```

#### 问题 3: 符号表文件未生成

**检查编译输出**：
```bash
# 查找 .symbols 文件
ls -la build-wasm/*.symbols

# 如果不存在，检查 emcc 命令是否包含 --emit-symbol-map
emcc -v ...  # 查看完整命令
```

#### 问题 4: 优化后堆栈信息丢失

**原因**：优化级别过高（`-O3`）导致函数内联

**解决**：
1. 使用 `-O2` 而非 `-O3`
2. 或添加 `-fno-inline`（禁用内联）

### 8.3 验证配置的有效性

**编译后验证脚本**（`verify-symbols.sh`）：

```bash
#!/bin/bash

echo "=== 验证 WASM 调试符号 ==="

# 1. 检查 source map
if [ -f "spine.wasm.map" ]; then
    SIZE=$(du -h spine.wasm.map | cut -f1)
    echo "✅ Source Map 存在: $SIZE"
else
    echo "❌ Source Map 缺失"
fi

# 2. 检查 DWARF 文件
if [ -f "spine.wasm.debug.wasm" ]; then
    SIZE=$(du -h spine.wasm.debug.wasm | cut -f1)
    echo "✅ DWARF 文件存在: $SIZE"
else
    echo "❌ DWARF 文件缺失"
fi

# 3. 检查符号表
if [ -f "spine.js.symbols" ]; then
    LINES=$(wc -l < spine.js.symbols)
    echo "✅ 符号表存在: $LINES 个符号"
else
    echo "❌ 符号表缺失"
fi

# 4. 检查 wasm name section
if command -v wasm-objdump &> /dev/null; then
    if wasm-objdump -h spine.wasm | grep -q "name"; then
        echo "✅ WASM Name Section 存在"
    else
        echo "❌ WASM Name Section 缺失"
    fi
fi

# 5. 检查 sourceMappingURL
echo -e "\n=== sourceMappingURL 检查 ==="
wasm-objdump -h spine.wasm | grep -i "source" || echo "未找到 source section"
```

---

## 9. 官方参考资源

### 9.1 Emscripten 官方文档

- **主文档**: https://emscripten.org/
- **编译器参考**: https://emscripten.org/docs/tools_reference/emcc.html
- **GitHub 仓库**: https://github.com/emscripten-core/emscripten

### 9.2 相关 GitHub PR

- **Separate DWARF 优化**: https://github.com/emscripten-core/emscripten/pull/16110
- **符号表生成**: https://github.com/emscripten-core/emscripten/pull/16244

### 9.3 社区资源

- **WASM 调试工具汇总**（项目中的文档）:
  `d:\workspace\engines\cocos\3.8.6\wasm-debugging-tools.md`

- **Memory Profiler 参考**（项目中的文档）:
  `d:\workspace\engines\cocos\3.8.6\native\cocos\editor-support\spine-wasm\docs\memoryprofiler-reference.md`

---

## 10. 针对您项目的具体修改建议

### 10.1 立即可以应用的改进

**1. 添加 `--emit-symbol-map`**（CMakeLists.txt 第 129 行）：

```cmake
set(EMS_LINK_FLAGS "${EMS_LINK_FLAGS}
    --emit-symbol-map  # ← 添加此行
    --pre-js ../memory_profiler_custom.js")
```

**2. 添加 `SEPARATE_DWARF_URL`**：

```cmake
set(EMS_LINK_FLAGS "${EMS_LINK_FLAGS}
    -s SEPARATE_DWARF_URL=http://localhost:8099/spine.wasm.debug.wasm  # ← 添加此行
    --pre-js ../memory_profiler_custom.js")
```

**3. 修改 CMakeLists_DEBUG.txt 的重复**：

删除第 38-39 行的重复 `set(CMAKE_CXX_FLAGS ...)` 声明。

### 10.2 推荐的测试流程

1. **使用修改后的配置编译**
2. **验证输出文件**（使用上面的验证脚本）
3. **在浏览器中测试堆栈捕获**
4. **集成到 CI/CD 流程**

---

## 附录 A: 快速参考

### A.1 完整编译命令示例

**开发环境**：
```bash
emcc \
    $(find ../spine/3.8/spine -name "*.cpp") \
    *.cpp \
    -o spine.js \
    -O2 \
    -s WASM=1 \
    --profiling \
    -gsource-map \
    --source-map-base http://localhost:8099/ \
    -gseparate-dwarf=spine.wasm.debug.wasm \
    -s SEPARATE_DWARF_URL=http://localhost:8099/spine.wasm.debug.wasm \
    --emit-symbol-map \
    -s DEMANGLE_SUPPORT=1 \
    -s DEFAULT_LIBRARY_FUNCS_TO_INCLUDE=$demangleAll \
    --memoryprofiler \
    -s MODULARIZE=1 \
    -s EXPORT_NAME="'spineWasm'" \
    --bind
```

### A.2 文件大小参考

| 配置 | spine.wasm | spine.wasm.map | spine.wasm.debug.wasm | spine.js.symbols | 总计 |
|------|------------|-----------------|----------------------|-----------------|------|
| `-O0 -g3` | ~500KB | ~150KB | ~5MB | ~30KB | ~5.7MB |
| `-O2 -gsource-map` | ~200KB | ~100KB | ~2MB | ~20KB | ~2.3MB |
| `-O3 --emit-symbol-map` | ~150KB | - | - | ~15KB | ~165KB |

---

**文档结束**

此方案基于以下资源整理：
- Emscripten 官方文档（emcc.html）
- 项目现有的 CMakeLists.txt 配置
- Emscripten GitHub 仓库的最新 PR 和 issue
- WebAssembly 调试社区最佳实践
