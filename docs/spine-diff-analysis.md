# Spine 提交差异分析报告

**分析日期**：2026-02-28
**当前分支**：v3.8.6_ys
**对比分支**：origin/v3.8.8, cocos4/4.0.0

---

## 一、origin/v3.8.8 vs 当前分支(v3.8.6_ys) 的差异

### 1.1 本地分支特有的提交（当前分支已有）

| SHA | 标题 | 涉及目录 | 改动内容 |
|-----|------|----------|----------|
| 65a6046be4 | [fix] spine-wasm 内存调试兼容 Closure Compiler | native/cocos/editor-support/spine-wasm | 修复 spine-wasm 与 Closure Compiler 兼容性问题 |
| 767a73e398 | 重新编译spinewasm | native/cocos/editor-support/spine-wasm | 重新编译 spine-wasm 文件 |
| 997ca845e3 | [chore]spine编译优化，内存调试优化 | native/cocos/editor-support/spine-wasm | 优化编译和内存调试 |

### 1.2 v3.8.8 分支新增的 Spine 提交（22个）

| SHA | 标题 | 涉及目录 | 改动内容 |
|-----|------|----------|----------|
| 68bc8d2414 | reset skeletonCache & animCache while changing spine's skeletonData (#19079) | cocos/spine/skeleton.ts | 切换 skeletonData 时重置缓存 |
| 77f5d6eb9b | different animations have varying bone data (#19077) | platforms/native/engine/jsb-spine-skeleton.js | 修复不同动画 bone 数据差异 |
| 14a8c0db63 | Fix OpenGL error caused by vertexCount mismatch (#18991) | cocos/2d/renderer/render-data.ts, cocos/spine/assembler/simple.ts | 修复 OpenGL vertexCount 错误 |
| b60d358522 | Fix cache space for indices smaller than required (#18936) | cocos/spine/assembler/simple.ts | 修复索引缓存空间不足 |
| 6a204c1b6c | Fix web platform attachmentVertices fails to retrieve (#18890) | native/cocos/editor-support/spine-wasm | 修复 Web 平台 attachmentVertices |
| 9f8fac3198 | Fix setSlotTexture with attachments from different skeletonData (#18810) | native/cocos/editor-support/spine-wasm | 修复不同 skeletonData 的 setSlotTexture |
| cebc8ce7d0 | Fix texture cannot be replaced when setSlotTexture with createAttachment true (#18797) | - | 修复 setSlotTexture 纹理替换 |
| cb1037fbd5 | Mark customMaterialInstance field as deprecated (#18792) | - | 废弃 customMaterialInstance |
| 45e9225bec | Pre-allocate extra space in chunks (#18777) | cocos/spine/assembler/simple.ts | 预分配空间避免重分配 |
| f5600be370 | Fix setCompleteListener not triggered on native with shared_cache (#18742) | - | 修复原生平台回调不触发 |
| bdc9603fc6 | Fix Spine batch feature fails on native platforms (#18729) | - | 修复原生平台批处理失效 |
| 84fae75e68 | Align AnimationEventType with EventType updates in Spine C++ (#18719) | - | 对齐 AnimationEventType |
| 4fc4e75271 | Spine 4.2 attachment->computeWorldVertices() may modify UV (#18714) | - | 修复 Spine 4.2 UV 每帧更新 |
| f108d4e65d | Expose skin property and setSkin method (#18715) | - | 暴露 skin 属性和方法 |
| 1d3785d678 | Fix display abnormaly due to wrong AttachementVertices (#18692) | - | 修复 AttachementVertices 错误 |
| 0015e7e4e3 | Update spine 4.2 runtime to 4.2.80 (#18683) | - | 升级 Spine 4.2 到 4.2.80 |
| fce05ec594 | Fix setSlotTexture with createNew: true affects other instances (#18680) | - | 修复 Spine 4.2 setSlotTexture |
| 548aa0b458 | Fix inconsistent setSize behavior (#18678) | - | 修复 vector setSize 不一致 |
| 7ead7e4a87 | Fix spine callback issues (#18672) | - | 修复回调问题 |
| 60d2f89529 | Fix spine setSlotTexture cannot work normally (#18651) | - | 修复 setSlotTexture |
| 50f14a091c | Fix rendering anomaly caused by incorrect rotation (#18636) | - | 修复错误旋转渲染异常 |
| a6c5ce0096 | Resolve potential OOM issues (#18610) | - | 解决潜在 OOM |
| a9c82270ee | Fix crash after destroying node with Spine Skeleton (#18567) | - | 修复销毁后崩溃 |

---

## 二、cocos4仓库 4.0.0分支的 Spine 提交

### 2.1 PR #75 - TextureRegion atlas释放顺序

**PR标题**：TextureRegion in Spine 4.2 atlas must be released last

**涉及文件**：
- `native/cocos/editor-support/spine-wasm/spine-wasm.cpp`
- `native/external-config.json`

**代码改动**：

```cpp
// 新增全局变量（仅 Spine 4.2 版本）
#ifdef CC_SPINE_VERSION_4_2
HashMap<SkeletonData *, Atlas*> spineAtlasMap{};
#endif

// 创建函数中：
// 原来：直接 delete atlas;
// 修改后：
#ifdef CC_SPINE_VERSION_3_8
    delete atlas;
#else
    spineAtlasMap.put(skeletonData, atlas);  // 4.2版本：存储到map中延迟删除
#endif

// 销毁函数中：
// 新增：在删除 skeletonData 之前先删除 atlas
#ifndef CC_SPINE_VERSION_3_8
    auto* atlas = spineAtlasMap[data];
    delete atlas;
#endif
delete data;
```

**问题分析**：
- Spine 4.2 版本中，`TextureRegion` 对象在运行时仍然被 Skeleton 使用
- 原来在创建 SkeletonData 后立即删除 atlas，导致运行时出现悬空指针
- 现在改为将 atlas 存储到 `spineAtlasMap` 中延迟删除

**影响**：
- 影响平台：Web 端 (WASM)、所有使用 Spine 4.2 的平台
- 影响功能：Spine 动画的资源管理
- 问题修复：修复 Spine 4.2 运行时崩溃/内存错误

**合并建议**：✅ **强烈建议合并**

---

### 2.2 PR #65 - Web端内存泄漏

**PR标题**：Fix memory leaks in Spine resource parsing on web

**涉及文件**：
- `native/cocos/editor-support/spine-wasm/spine-wasm.cpp`
- `native/external-config.json`

**代码改动**：

```cpp
// 修改前：attachmentLoader 和 json 对象在函数结束前未正确释放
SkeletonData* skeletonData = json.readSkeletonData(jsonStr.buffer());
// ... 处理 ...
saveAttachmentVertices(skeletonData, textureNames, textureUUIDs);
return skeletonData;

// 修改后：使用作用域限制生命周期
SkeletonData* skeletonData = nullptr;
{
    AttachmentLoader* attachmentLoader = new AtlasAttachmentLoaderExtension(atlas);
    // ... 创建 json ...
    skeletonData = json.readSkeletonData(jsonStr.buffer());
    // ... 处理 ...
    saveAttachmentVertices(skeletonData, textureNames, textureUUIDs);
}  // attachmentLoader 在这里自动释放
delete atlas;  // 显式删除 atlas
return skeletonData;
```

**问题分析**：
- 修复 Web 端 Spine 资源解析时的内存泄漏
- 原代码中 `attachmentLoader`（包含 atlas 引用）没有正确释放
- 通过引入作用域确保 `attachmentLoader` 在解析完成后被正确释放

**影响**：
- 影响平台：Web 端 (WASM)
- 影响功能：Spine 资源的 JSON 和 Binary 解析
- 问题修复：修复内存泄漏问题

**合并建议**：✅ **强烈建议合并**

---

## 三、合并顺序分析

### 3.1 提交时间顺序

按时间排序的22个spine提交：

| # | SHA | 日期 | 标题 |
|---|-----|------|------|
| 1 | a9c82270ee | 2025-04-09 | Fix crash after destroying node with Spine |
| 2 | a6c5ce0096 | 2025-04-17 | Resolve potential OOM issues |
| 3 | 50f14a091c | 2025-04-18 | Fix rendering anomaly caused by incorrect rotation |
| 4 | 60d2f89529 | 2025-04-24 | Fix setSlotTexture cannot work |
| 5 | 548aa0b458 | 2025-04-28 | Fix inconsistent setSize behavior |
| 6 | 7ead7e4a87 | 2025-04-28 | Fix spine callback issues |
| 7 | fce05ec594 | 2025-04-30 | Fix setSlotTexture createNew=true affects other instances |
| 8 | 0015e7e4e3 | 2025-04-30 | Update spine 4.2 runtime to 4.2.80 |
| 9 | 1d3785d678 | 2025-05-07 | Fix display abnormaly due to wrong AttachementVertices |
| 10 | f108d4e65d | 2025-05-15 | Expose skin property and setSkin method |
| 11 | 4fc4e75271 | 2025-05-16 | Spine 4.2 computeWorldVertices may modify UV |
| 12 | 84fae75e68 | 2025-05-19 | Align AnimationEventType |
| 13 | bdc9603fc6 | 2025-05-21 | Fix Spine batch feature fails on native |
| 14 | f5600be370 | 2025-05-29 | Fix setCompleteListener not triggered on native |
| 15 | 45e9225bec | 2025-06-12 | Pre-allocate extra space |
| 16 | cb1037fbd5 | 2025-06-17 | Mark customMaterialInstance deprecated |
| 17 | cebc8ce7d0 | 2025-06-19 | Fix setSlotTexture with createAttachment true |
| 18 | 9f8fac3198 | 2025-06-26 | Fix setSlotTexture with attachments from different skeletonData |
| 19 | 6a204c1b6c | 2025-08-07 | Fix attachmentVertices fails to retrieve |
| 20 | b60d358522 | 2025-09-03 | Fix cache space for indices smaller |
| 21 | 14a8c0db63 | 2025-09-05 | Fix OpenGL vertexCount mismatch |
| 22 | 77f5d6eb9b | 2025-11-19 | Different animations have varying bone data |
| 23 | 68bc8d2414 | 2025-11-19 | Reset skeletonCache & animCache |

### 3.2 依赖关系

| 依赖类型 | 提交 | 说明 |
|---------|------|------|
| **必须一起** | 14a8c0db63 | 同时修改了 `render-data.ts` 和 `simple.ts`，不能拆分 |
| **建议按顺序** | setSlotTexture相关5个 | 60d2f89529 → fce05ec594 → 1d3785d678 → cebc8ce7d0 → 9f8fac3198 |
| **可独立** | 其他提交 | 基本是独立的bug修复 |

### 3.3 结论

存在一定的顺序问题，但不是强制性的。**建议直接使用 git merge 合并整个分支**，git会自动处理依赖。

---

## 四、Spine之外变更分析

### 4.1 非Spine文件变更

| SHA | 非Spine文件 | 作用 |
|-----|------------|------|
| 14a8c0db63 | `cocos/2d/renderer/render-data.ts` | 添加 `updateSize()` 方法供spine优化内存分配 |
| bdc9603fc6 | `native/cocos/2d/renderer/Batcher2d.cpp` | 修复Spine批处理在原生平台失效 |
| bdc9603fc6 | `native/cocos/editor-support/MiddlewareManager.cpp/h` | 配合批处理修改 |

### 4.2 冲突风险评估

#### 4.2.1 render-data.ts - updateSize 方法

| 项目 | 状态 |
|------|------|
| 当前分支 | **没有** updateSize 方法 |
| v3.8.8 | 新增方法 |
| 调用情况 | 项目中无其他调用 |
| **冲突风险** | **低** - 直接新增，不会冲突 |

#### 4.2.2 Batcher2d.cpp

| 项目 | 状态 |
|------|------|
| 当前分支 | 使用 `_currDrawInfo->getIbCount()` |
| v3.8.8 | 改用 `_currMiddlewareIbCount` |
| **冲突风险** | **中** - 批次合并逻辑可能失效 |

**详细说明**：
- v3.8.8 将 middleware 的索引计数与 `_currDrawInfo` 解耦，使用独立变量
- 当前分支逻辑直接操作 `_currDrawInfo`
- 合并时需要重点检查 `handleMiddlewareDraw` 函数

#### 4.2.3 MiddlewareManager

| 项目 | 状态 |
|------|------|
| 当前分支 | 标准实现，无特殊修改 |
| v3.8.8 | 预计新增功能 |
| **冲突风险** | **低** |

### 4.3 总体结论

| 模块 | 风险 | 说明 |
|------|------|------|
| render-data.ts | 低 | 直接新增 |
| Batcher2d.cpp | **中** | 需重点检查批次合并逻辑 |
| MiddlewareManager | 低 | 预计无冲突 |

**重点关注**：Batcher2d.cpp 的 `handleMiddlewareDraw` 函数，合并时需要确保新旧逻辑兼容。

---

## 五、实际文件内容对比结果

### 5.1 对比说明

由于之前存在手动复制上游代码的行为，通过实际文件内容对比，确认以下差异是否为真实差异：

### 5.2 文件对比结果

| 文件 | 状态 | 差异说明 |
|------|------|----------|
| `cocos/spine/assembler/simple.ts` | **需要关注** | 1. 当前分支增加了 `cull` 判断逻辑<br>2. resize 逻辑有差异 |
| `cocos/spine/skeleton.ts` | **需要关注** | import 语句差异 |
| `SkeletonDataMgr.cpp` | **需要关注** | 1. 类结构差异（析构函数位置）<br>2. 方法签名差异<br>3. v3.8.8新增 `getSkeletonDataInfos()` 方法 |
| `spine-skeleton-instance.cpp` | **需要关注** | v3.8.8 新增跨 skeletonData 查询函数 `getAttachmentVertices()` |

### 5.3 结论

所有四个关键文件都存在**真实的代码差异**，这些差异是 v3.8.8 相对于当前分支的真正代码变更，**并非手动复制已包含**。

---

## 六、差异文件总览

共涉及 **14 个文件**，可分为以下几类：

| 类别 | 文件 |
|------|------|
| **TypeScript 运行时** | `cocos/spine/assembler/simple.ts`, `cocos/spine/skeleton.ts` |
| **原生渲染器** | `SkeletonCache.cpp`, `SkeletonDataMgr.cpp/h`, `SkeletonRenderer.cpp` |
| **WASM 模块** | `CMakeLists.txt`, `spine-skeleton-instance.cpp` |
| **Spine 核心库** | `ContainerUtil.h`, `Skeleton.cpp` |
| **SWIG 配置** | `spine_3_8.i`, `spine_4_2.i` |
| **JSB 绑定** | `jsb-spine-skeleton.js` |
| **非Spine（配套）** | `render-data.ts`, `Batcher2d.cpp`, `MiddlewareManager.cpp/h` |

---

## 七、合并建议

### 高优先级（强烈建议合并）

| 来源 | SHA/PR | 理由 |
|------|--------|------|
| v3.8.8 | 68bc8d2414 | 切换 skeletonData 时重置缓存 |
| v3.8.8 | 14a8c0db63 | 修复 OpenGL 错误导致崩溃（需同时合并render-data.ts） |
| v3.8.8 | 6a204c1b6c | 修复 Web 平台 attachmentVertices |
| v3.8.8 | a6c5ce0096 | 解决潜在 OOM 问题 |
| v3.8.8 | f5600be370 | 修复原生平台回调不触发 |
| v3.8.8 | 45e9225bec | 预分配空间优化性能 |
| v3.8.8 | bdc9603fc6 | 修复原生平台批处理失效（需同时合并Batcher2d.cpp） |
| cocos4 | #75 | Spine 4.2 atlas 释放顺序修复（仅4.2需要） |
| cocos4 | #65 | 修复 Web 端内存泄漏 |

### 中优先级（建议合并）

| 来源 | SHA | 理由 |
|------|-----|------|
| v3.8.8 | 0015e7e4e3 | 升级 Spine 4.2 到 4.2.80 |
| v3.8.8 | 4fc4e75271 | 修复 Spine 4.2 UV 更新 |
| v3.8.8 | 9f8fac3198 | 修复不同 skeletonData 的 setSlotTexture |
| v3.8.8 | 1d3785d678 | 修复 AttachementVertices 错误 |

### 本地保留（你的修改）

| SHA | 理由 |
|-----|------|
| 65a6046be4 | spine-wasm 兼容 Closure Compiler |
| 767a73e398 | 重新编译的 spine-wasm |
| 997ca845e3 | 编译优化和内存调试优化 |

### 合并方式

**建议直接使用 `git merge` 合并整个 origin/v3.8.8 分支**，由git自动处理依赖和冲突。

**重点关注**：
- Batcher2d.cpp 的批次合并逻辑可能需要手动解决冲突
- merge完成后检查 `handleMiddlewareDraw` 函数

---

## 八、external-config.json 依赖更新

合并时需要同步更新 `native/external-config.json`：

| 来源 | 版本要求 | 对应PR |
|------|----------|--------|
| v3.8.8 | Spine 4.2 → 4.2.80 | #18683 |
| cocos4 PR#65 | cocos-engine-external → v4.0.0-2 | #65 |
| cocos4 PR#75 | cocos-engine-external → v4.0.0-3 | #75 |
