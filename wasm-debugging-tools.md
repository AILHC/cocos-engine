# WebAssembly 可视化调试工具指南

本文档整理了 GitHub 上关于 WebAssembly (WASM) 的可视化调试工具，按星级排序。

---

## 一、核心调试工具

### 1. WasmExplorer (341 stars)
- **仓库**: [mbebenita/WasmExplorer](https://github.com/mbebenita/WasmExplorer)
- **星级**: 341
- **描述**: 在线 WebAssembly 浏览器/探索器
- **适用场景**: 查看 WASM 二进制文件结构，反汇编代码

**安装与使用**:
1. 访问在线版本（如果有）或克隆仓库
2. 在浏览器中打开 WASM 文件进行查看

**优缺点**:
- 优点: 直观的 WASM 代码查看器，可以实时查看反汇编结果
- 缺点: 更适合查看而非调试，功能相对简单

---

### 2. weave - wasm viewer (147 stars)
- **仓库**: [evmar/weave](https://github.com/evmar/weave)
- **星级**: 147
- **描述**: WebAssembly 查看器
- **适用场景**: 可视化查看 WASM 模块结构

**安装与使用**:
```bash
git clone https://github.com/evmar/weave.git
cd weave
# 查看项目 README 了解具体使用方法
```

**优缺点**:
- 优点: 轻量级查看器
- 缺点: 项目较老，可能缺乏维护

---

### 3. wasm-analyzer (11 stars)
- **仓库**: [Nor2-io/wasm-analyzer](https://github.com/Nor2-io/wasm-analyzer)
- **星级**: 11
- **主页**: https://wa2.dev
- **描述**: WebAssembly 分析工具
- **适用场景**: 在线分析 WASM 文件

**安装与使用**:
1. 访问 https://wa2.dev
2. 上传 WASM 文件进行分析

**优缺点**:
- 优点: 在线工具，无需安装
- 缺点: 需要网络连接

---

### 4. wasm-inspector (4 stars)
- **仓库**: [jeffasante/wasm-inspector](https://github.com/jeffasante/wasm-inspector)
- **星级**: 4
- **描述**: 基于 Rust 的快速 WASM 分析工具，支持浏览器和 CLI
- **功能**: 揭示模块结构、函数调用图、性能指标、内存使用、运行时兼容性

**安装与使用**:
```bash
cargo install wasm-inspector
# 或在浏览器中使用 Web 版本
```

**优缺点**:
- 优点: 功能全面，核心引擎编译为 WASM
- 缺点: 项目较新，社区较小

---

## 二、专用调试器

### 1. wasm-debug (52 stars)
- **仓库**: [wasm3/wasm-debug](https://github.com/wasm3/wasm-debug)
- **星级**: 52
- **描述**: 直接的源码级 WebAssembly 调试器
- **适用场景**: 源码级调试

**优缺点**:
- 优点: 源码级调试支持
- 缺点: 需要调试符号支持

---

### 2. chrome-wasm-debugger (100 stars)
- **仓库**: [itszn/chrome-wasm-debugger](https://github.com/itszn/chrome-wasm-debugger)
- **星级**: 100
- **描述**: Chrome 扩展，提供更友好的 WASM 调试 UI
- **适用场景**: 在 Chrome 浏览器中调试 WASM

**安装与使用**:
1. 在 Chrome 网上应用店搜索并安装（或从源码加载）
2. 打开 Chrome DevTools，找到 WASM 调试面板
3. 加调试断点、查看内存、单步执行

**优缺点**:
- 优点: 集成到 Chrome DevTools，使用方便
- 缺点: 仅支持 Chrome/Edge 浏览器

---

### 3. vscode-dwarf-debugging-ext (24 stars)
- **仓库**: [microsoft/vscode-dwarf-debugging-ext](https://github.com/microsoft/vscode-dwarf-debugging-ext)
- **星级**: 24
- **描述**: VS Code 中增强的 WebAssembly 调试支持
- **适用场景**: 在 VS Code 中调试 WASM

**安装与使用**:
1. 在 VS Code 扩展市场安装
2. 配置 launch.json 进行 WASM 调试

**优缺点**:
- 优点: 微软官方支持，与 VS Code 深度集成
- 缺点: 配置可能较复杂

---

## 三、内存调试工具

### 1. wasm-mem-preview (1 star)
- **仓库**: [CharlyCst/wasm-mem-preview](https://github.com/CharlyCst/wasm-mem-preview)
- **星级**: 1
- **主页**: https://charlycst.github.io/wasm-mem-preview/
- **描述**: 简单的在线工具，用于检查 WASM 内存

**安装与使用**:
1. 访问 https://charlycst.github.io/wasm-mem-preview/
2. 加载 WASM 文件查看内存布局

**优缺点**:
- 优点: 在线工具，简单易用
- 缺点: 功能较基础

---

### 2. WASM-Memory-Scanner (2 stars)
- **仓库**: [z46-dev/WASM-Memory-Scanner](https://github.com/z46-dev/WASM-Memory-Scanner)
- **星级**: 2
- **描述**: 扫描 WASM 内存堆（通常是 JS 中的类型数组）
- **适用场景**: 内存分析和扫描

**优缺点**:
- 优点: 专门用于内存扫描
- 缺点: 项目较小，缺乏文档

---

## 四、编译工具链（辅助调试）

### 1. WABT - The WebAssembly Binary Toolkit (7855 stars)
- **仓库**: [WebAssembly/wabt](https://github.com/WebAssembly/wabt)
- **星级**: 7855
- **描述**: WebAssembly 二进制工具包
- **工具**: wat2wasm, wasm2wat, wasm-objdump, wasm-dis 等

**安装与使用**:
```bash
# Windows (使用 scoop)
scoop install wabt

# macOS
brew install wabt

# Linux
sudo apt-get install wabt

# 或从源码编译
git clone https://github.com/WebAssembly/wabt.git
cd wabt
mkdir build && cd build
cmake ..
cmake --build .
```

**常用命令**:
```bash
# 反汇编 WASM 到 WAT
wasm2wat input.wasm -o output.wat

# 查看 WASM 内容
wasm-objdump -d input.wasm

# 打印 WASM 信息
wasm-stats input.wasm
```

**优缺点**:
- 优点: 官方工具，功能全面，文档完善
- 缺点: 命令行工具，没有可视化界面

---

### 2. Binaryen (8334 stars)
- **仓库**: [WebAssembly/binaryen](https://github.com/WebAssembly/binaryen)
- **星级**: 8334
- **描述**: WebAssembly 优化器和编译器/工具链库
- **工具**: wasm-opt, wasm-as, wasm-dis 等

**安装与使用**:
```bash
# 从源码编译
git clone https://github.com/WebAssembly/binaryen.git
cd binaryen
mkdir build && cd build
cmake ..
cmake --build . --parallel
```

**优缺点**:
- 优点: 强大的优化功能，可用于调试优化前后对比
- 缺点: 主要作为库使用，命令行工具功能有限

---

### 3. wasm-tools (1683 stars)
- **仓库**: [bytecodealliance/wasm-tools](https://github.com/bytecodealliance/wasm-tools)
- **星级**: 1683
- **描述**: 低级操作 WebAssembly 模块的 CLI 和 Rust 库
- **适用场景**: WASM 模块检查、验证、转换

**安装与使用**:
```bash
# 使用 cargo 安装
cargo install wasm-tools

# 或下载预编译二进制
```

**常用命令**:
```bash
# 验证 WASM 文件
wasm-tools validate input.wasm

# 打印 WASM 信息
wasm-tools print input.wasm

# 分析 WASM 模块
wasm-tools analyze input.wasm

# 裁剪未使用的函数
wasm-tools strip input.wasm -o output.wasm
```

**优缺点**:
- 优点: 现代 Rust 实现，功能强大，活跃维护
- 缺点: 命令行工具

---

## 五、反编译工具

### 1. wasmdec (424 stars)
- **仓库**: [wwwg/wasmdec](https://github.com/wwwg/wasmdec)
- **星级**: 424
- **主页**: https://wwwg.github.io/web-wasmdec/
- **描述**: WebAssembly 到 C 的反编译器
- **适用场景**: 将 WASM 反编译为 C 代码以便分析

**安装与使用**:
1. 访问在线版本 https://wwwg.github.io/web-wasmdec/
2. 上传 WASM 文件进行反编译

**优缺点**:
- 优点: 在线工具，输出可读的 C 代码
- 缺点: 反编译结果可能不够精确

---

### 2. NotDec (88 stars)
- **仓库**: [NotDec/NotDec](https://github.com/NotDec/NotDec)
- **星级**: 88
- **描述**: 基于 LLVM IR 的 WebAssembly 反编译器和静态分析框架
- **适用场景**: 高级反编译和静态分析

**优缺点**:
- 优点: 基于 LLVM，分析能力强
- 缺点: 开发中（WIP），功能可能不完整

---

## 六、浏览器内置调试

### Chrome DevTools
Chrome 浏览器内置了对 WASM 的调试支持：

**使用方法**:
1. 打开 Chrome DevTools (F12)
2. 在 Sources 面板中找到 WASM 文件
3. 可以查看反汇编的 WASM 代码
4. 支持断点调试和内存查看

**优缺点**:
- 优点: 无需额外安装，Chrome 原生支持
- 缺点: 界面不够友好，需要配合 chrome-wasm-debugger 使用

---

### Firefox DevTools
Firefox 也支持 WASM 调试：

**使用方法**:
1. 打开 Firefox Developer Tools
2. 在 Debugger 面板中查看 WASM 源码
3. 支持单步调试和断点

**优缺点**:
- 优点: Firefox 对 WASM 调试支持较好
- 缺点: 需要使用 Firefox 浏览器

---

## 七、工具推荐总结

### 按使用场景推荐：

| 场景 | 推荐工具 |
|------|----------|
| 快速查看 WASM 代码 | WasmExplorer, wasm-tools print |
| 浏览器内调试 | chrome-wasm-debugger, Chrome DevTools |
| VS Code 开发调试 | vscode-dwarf-debugging-ext |
| 内存分析 | wasm-mem-preview, WASM-Memory-Scanner |
| 命令行工具 | WABT (wasm2wat, wasm-objdump) |
| 反编译分析 | wasmdec, NotDec |
| 模块分析 | wasm-inspector, wasm-analyzer |
| 优化和转换 | Binaryen (wasm-opt), wasm-tools |

### 最佳实践组合：

1. **开发阶段**: WABT + VS Code + vscode-dwarf-debugging-ext
2. **浏览器调试**: chrome-wasm-debugger + Chrome DevTools
3. **快速分析**: wasm-analyzer (wa2.dev) 或 wasm-inspector
4. **深度分析**: wasm-tools + Binaryen + WABT

---

## 八、注意事项

1. **调试符号**: 要获得良好的调试体验，编译时需要保留调试符号 (`-g` 标志)
2. **浏览器兼容**: 不同浏览器对 WASM 调试的支持程度不同
3. **工具更新**: WebAssembly 生态快速发展，工具更新频繁
4. **性能影响**: 调试模式会显著影响性能，发布时请移除调试符号

---

## 九、参考资源

- [WebAssembly 官方文档](https://webassembly.org/)
- [MDN WebAssembly 文档](https://developer.mozilla.org/en-US/docs/WebAssembly)
- [Awesome WASM Tools](https://github.com/vshymanskyy/awesome-wasm-tools) (517 stars)

---

## 十、性能分析与追踪工具

### 1. wasm-trace (50 stars)
- **仓库**: [sliminality/wasm-trace](https://github.com/sliminality/wasm-trace)
- **星级**: 50
- **描述**: 用于追踪 wasm 二进制文件函数执行的工具
- **适用场景**: 函数级执行追踪，分析函数调用流程

**安装与使用**:
```bash
npm install -g @sliminality/wasm-trace
```

**优缺点**:
- 优点: 可以追踪函数执行顺序，帮助理解程序流程
- 缺点: 可能会带来性能开销

---

### 2. node-wasm-trace (32 stars)
- **仓库**: [wasm3/node-wasm-trace](https://github.com/wasm3/node-wasm-trace)
- **星级**: 32
- **描述**: 检测 wasm 文件并追踪执行
- **适用场景**: Node.js 环境下的 WASM 追踪

**优缺点**:
- 优点: 专为 Node.js 环境设计
- 缺点: 仅支持 Node.js，不适用于浏览器

---

### 3. wasm-profiler (3 stars)
- **仓库**: [wasmx/wasm-profiler](https://github.com/wasmx/wasm-profiler)
- **星级**: 3
- **描述**: 用于分析 WebAssembly 二进制文件的性能分析实用工具
- **适用场景**: WASM 性能分析和 profiling

**优缺点**:
- 优点: 专注于性能分析
- 缺点: 项目较小，文档可能不完善

---

### 4. BlazorWasmProfiler (11 stars)
- **仓库**: [Jinjinov/BlazorWasmProfiler](https://github.com/Jinjinov/BlazorWasmProfiler)
- **星级**: 11
- **描述**: Blazor Wasm 性能分析器
- **适用场景**: Blazor WebAssembly 应用的性能分析

**优缺点**:
- 优点: 专为 Blazor 设计
- 缺点: 仅适用于 Blazor 应用

---

## 十一、更多内存分析工具

### 1. wasm-memory (19 stars)
- **仓库**: [radu-matei/wasm-memory](https://github.com/radu-matei/wasm-memory)
- **星级**: 19
- **主页**: https://radu-matei.com/blog/practical-guide-to-wasm-memory/
- **描述**: WebAssembly 内存实用指南
- **适用场景**: 学习和理解 WASM 内存模型

**优缺点**:
- 优点: 详细的内存模型说明和示例
- 缺点: 主要是教程而非工具

---

### 2. minimal-zig-wasm-canvas (121 stars)
- **仓库**: [daneelsan/minimal-zig-wasm-canvas](https://github.com/daneelsan/minimal-zig-wasm-canvas)
- **星级**: 121
- **描述**: 展示 HTML5 canvas、wasm 内存和 zig 交互的最小示例
- **适用场景**: 学习 WASM 内存与 JavaScript 交互

**优缺点**:
- 优点: 实用的示例代码
- 缺点: 不是调试工具，而是学习示例

---

## 十二、基准测试工具

### 1. kotlin-wasm-benchmarks (21 stars)
- **仓库**: [Kotlin/kotlin-wasm-benchmarks](https://github.com/Kotlin/kotlin-wasm-benchmarks)
- **星级**: 21
- **描述**: 专注于 Kotlin/Wasm 性能的基准测试集合
- **适用场景**: Kotlin WASM 性能测试

---

### 2. wasm-bench (17 stars)
- **仓库**: [hajimehoshi/wasm-bench](https://github.com/hajimehoshi/wasm-bench)
- **星级**: 17
- **描述**: Wasm 基准测试实验
- **适用场景**: WASM 性能基准测试

---

### 3. rust-wasm-benchmark (13 stars)
- **仓库**: [alexcrichton/rust-wasm-benchmark](https://github.com/alexcrichton/rust-wasm-benchmark)
- **星级**: 13
- **描述**: Rust WebAssembly 基准测试
- **适用场景**: Rust 编译的 WASM 性能测试

---

## 十三、WASM 运行时（带调试功能）

### 1. wasmer (20406 stars)
- **仓库**: [wasmerio/wasmer](https://github.com/wasmerio/wasmer)
- **星级**: 20406
- **描述**: 快速、安全、轻量级的基于 WebAssembly 的容器
- **适用场景**: 服务端 WASM 运行，支持调试

**安装与使用**:
```bash
# 安装 wasmer
curl https://get.wasmer.io -sSfL | sh

# 运行 WASM 文件
wasmer run file.wasm

# 查看信息
wasmer inspect file.wasm
```

**优缺点**:
- 优点: 功能强大，支持多种前端，活跃维护
- 缺点: 主要用于服务端，不直接支持浏览器调试

---

### 2. wasmtime (17566 stars)
- **仓库**: [bytecodealliance/wasmtime](https://github.com/bytecodealliance/wasmtime)
- **星级**: 17566
- **描述**: 快速、安全、符合标准的轻量级 WebAssembly 运行时
- **适用场景**: JIT 编译，高性能 WASM 运行

**安装与使用**:
```bash
# 安装 wasmtime
cargo install wasmtime-cli

# 运行 WASM 文件
wasmtime file.wasm

# 启用调试
wasmtime --optimize=0 file.wasm
```

**优缺点**:
- 优点: 官方推荐，性能优秀
- 缺点: 命令行工具，GUI 支持有限

---

### 3. WasmEdge (10435 stars)
- **仓库**: [WasmEdge/WasmEdge](https://github.com/WasmEdge/WasmEdge)
- **星级**: 10435
- **描述**: 用于云原生、边缘和去中心化应用的轻量级、高性能、可扩展的 WebAssembly 运行时
- **适用场景**: 边缘计算、云原生 WASM 应用

**优缺点**:
- 优点: 性能优秀，支持 AOT 编译
- 缺点: 主要用于服务端场景

---

## 十四、反汇编器

### 1. bn-wasm (10 stars)
- **仓库**: [hgarrereyn/bn-wasm](https://github.com/hgarrereyn/bn-wasm)
- **星级**: 10
- **描述**: Binary Ninja WASM 反汇编器插件
- **适用场景**: 使用 Binary Ninja 进行逆向分析

**优缺点**:
- 优点: 集成到 Binary Ninja 专业工具
- 缺点: 需要 Binary Ninja 许可证

---

### 2. diswasm (10 stars)
- **仓库**: [jandem/diswasm](https://github.com/jandem/diswasm)
- **星级**: 10
- **描述**: 基于 objdump 编译到 wasm 的在线反汇编器
- **适用场景**: 在线反汇编 WASM 文件

**优缺点**:
- 优点: 在线工具，无需安装
- 缺点: 功能相对简单

---

## 十五、工具推荐（更新版）

### 按使用场景推荐（更新版）：

| 场景 | 推荐工具 |
|------|----------|
| 快速查看 WASM 代码 | WasmExplorer, wasm-tools print |
| 浏览器内调试 | chrome-wasm-debugger, Chrome DevTools |
| VS Code 开发调试 | vscode-dwarf-debugging-ext, vscode-emscripten-debugging |
| 内存分析 | wasm-mem-preview, WASM-Memory-Scanner, wasm-memory 教程 |
| 函数执行追踪 | wasm-trace, node-wasm-trace |
| 性能分析 | wasm-inspector, wasm-profiler |
| 命令行工具 | WABT (wasm2wat, wasm-objdump) |
| 反编译分析 | wasmdec, NotDec |
| 模块分析 | wasm-inspector, wasm-analyzer (wa2.dev) |
| 优化和转换 | Binaryen (wasm-opt), wasm-tools |
| 基准测试 | wasm-bench, rust-wasm-benchmark |
| 服务端运行 | wasmer, wasmtime, WasmEdge |

### 内存调试专项工具组合：

| 工具组合 | 适用场景 |
|----------|----------|
| chrome-wasm-debugger + Chrome DevTools Memory 面板 | 浏览器内存调试 |
| wasm-mem-preview + WASM-Memory-Scanner | 快速内存扫描 |
| wasm-trace + Chrome Profiler | 内存 + 性能联合分析 |
| wasmer/wasmtime + valgrind | 服务端内存调试 |

---

*文档更新日期: 2025-02-11*
