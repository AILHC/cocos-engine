# Spine 合并冲突记录

**分支**: v3.8.6_ys_merge
**创建时间**: 2026-03-02
**说明**: 只合并 2025-06-30 之后的提交
**最终更新**: 2026-03-03 - 已完成所有合并（Fast-forward 合并 v3.8.6_ys_merge_test）

---

## 合并进度

| # | 提交 SHA | 日期 | 标题 | 状态 |
|---|----------|------|------|------|
| 1 | 6a204c1b6c | 2025-08-07 | Fix attachmentVertices | 冲突（external-config.json，非代码）跳过 |
| 2 | b60d358522 | 2025-09-03 | Fix cache space indices | **已合并** (2cff38dc7d) |
| 3 | 14a8c0db63 | 2025-09-05 | Fix OpenGL vertexCount | **已合并** (8bd7877896) |
| 4 | 77f5d6eb9b | 2025-11-19 | Different animations bone data | **已合并** (2ec0c52d07) |
| 5 | 68bc8d2414 | 2025-11-19 | Reset skeletonCache | **已合并** (818f5f1509) |
| 6 | cocos4#65 | - | Web端内存泄漏 | **已合并** (ca73ad12f2) |
| 7 | cocos4#75 | - | TextureRegion atlas释放顺序 | **已合并** (68f8d6e70f) |

### 提交 2: b60d358522

**标题**: Fix the issue where the cache space for indices is smaller than actually required due to indices not being updated. (#18936)

**冲突文件**:
- `cocos/spine/assembler/simple.ts`

**状态**: 已合并 (2cff38dc7d)

**合并说明**: 采用新提交逻辑，使用 `ADJUST_SIZE_RATE = 1.1` 系数来预留更多缓冲区空间。添加了常量定义并解决了两个冲突点（realTimeTraverse 和 cacheTraverse 函数）。

**冲突详情**:

1. **第一个冲突点 (realTimeTraverse 函数，第154-162行)**:
   - **当前分支 (HEAD)**：直接使用 `rd.resize(vc, ic)` 并重新创建 `rd.indices = new Uint16Array(ic)`
   - **要 cherry-pick 的提交 (b60d358522)**：使用条件判断 `if (rd.vertexCount < vc || rd.indexCount < ic)` 并使用 `ADJUST_SIZE_RATE` 系数来扩展缓冲区

2. **第二个冲突点 (cacheTraverse 函数，第285-295行)**:
   - **当前分支 (HEAD)**：直接使用 `rd.resize(vc, ic)`
   - **要 cherry-pick 的提交 (b60d358522)**：使用条件判断和 `ADJUST_SIZE_RATE`

**冲突原因**:
当前分支与 b60d358522 提交的缓冲区调整逻辑不同。新提交使用 `ADJUST_SIZE_RATE` 系数来预留更多空间，而当前分支只是简单设置为 vc 和 ic。

---

### 提交 3: 14a8c0db63

**标题**: Fix the OpenGL error caused by a mismatch between the vertexCount stored in renderData and the actual value. (#18991)

**状态**: 已合并 (8bd7877896)

**合并说明**: 自动合并成功，无冲突。修改了以下两个文件：
- `cocos/2d/renderer/render-data.ts`
- `cocos/spine/assembler/simple.ts`

### 提交 4: 77f5d6eb9b

**标题**: In Spine, different animations in the skeletonData have varying bone data. (#19077)

**状态**: 已合并 (2ec0c52d07)

**合并说明**: 自动合并成功，无冲突。修改了 1 个文件，5 行插入，5 行删除。

---

### 提交 5: 68bc8d2414

**标题**: We need to reset skeletonCache & animCache while changing spine's skeletonData. (#19079)

**状态**: 已合并 (818f5f1509)

**合并说明**: 自动合并成功，无冲突。修改了 1 个文件，2 行插入。修改了 `cocos/spine/skeleton.ts` 文件，在切换 skeletonData 时重置 skeletonCache 和 animCache。

---

### 提交 6: cocos4#65

**标题**: Fix memory leaks in Spine resource parsing on web

**提交 SHA**: ca73ad12f2

**状态**: **已合并** (2026-03-03)

**合并方式**: Cherry-pick from cocos4 仓库 PR #65

**涉及文件**:
- `native/cocos/editor-support/spine-wasm/spine-wasm.cpp`

**代码改动**:
修复了 Web 端 Spine 资源解析时的内存泄漏问题。主要修改了两个函数：

1. `createSpineSkeletonDataWithJson` 函数：
   - 使用作用域 `{ }` 限制 `attachmentLoader` 的生命周期
   - 在作用域结束时自动释放 `attachmentLoader`（包含 atlas 引用）
   - 在作用域外显式 `delete atlas`

2. `createSpineSkeletonDataWithBinary` 函数：
   - 同样的修复逻辑

**问题分析**:
- 原代码中 `attachmentLoader`（包含 atlas 引用）在函数返回前没有被正确释放
- 通过引入作用域确保 `attachmentLoader` 在解析完成后被正确释放

**关于 external-config.json**:
- 文档中提到需要更新到 `v4.0.0-2` 版本
- 但由于当前分支是 v3.8.6，升级到 v4.0.0-2 可能引入破坏性变更
- **暂时不更新 external-config.json**，仅应用核心代码修复

---

### 提交 7: cocos4#75

**标题**: TextureRegion in Spine 4.2 atlas must be released last

**提交 SHA**: 68f8d6e70f

**状态**: **已合并** (2026-03-03)

**合并方式**: Cherry-pick from cocos4 仓库 PR #75

**涉及文件**:
- `native/cocos/editor-support/spine-wasm/spine-wasm.cpp`

**代码改动**:
修复了 Spine 4.2 中 TextureRegion atlas 释放顺序的问题。在 Spine 4.2 中，TextureRegion 在运行时仍然被使用，所以 atlas 必须在 skeletonData 之后释放。

1. 添加了 `spineAtlasMap` 用于在 4.2 版本中保存 atlas 引用：
   ```cpp
   #ifdef CC_SPINE_VERSION_4_2
   HashMap<SkeletonData *, Atlas*> spineAtlasMap{};
   #endif
   ```

2. 在 `createSpineSkeletonDataWithJson` 和 `createSpineSkeletonDataWithBinary` 函数中：
   - 对于 3.8 版本：直接删除 atlas（原有逻辑）
   - 对于 4.2 版本：将 atlas 保存到 `spineAtlasMap`，延迟删除

3. 在 `destroySpineSkeletonDataWithUUID` 函数中：
   - 对于 4.2 版本：先从 `spineAtlasMap` 获取并删除 atlas，然后再删除 skeletonData

**关于 external-config.json**:
- PR #75 改动了 external-config.json 从 `v4.0.0-2` 到 `v4.0.0-3`
- 但当前分支是 v3.8.6，external-config.json 版本是 `v3.8.6-12`
- 由于版本不匹配，**暂时不更新 external-config.json**

---

## 操作说明

1. 处理完冲突后，手动 add 并 commit
2. 继续下一个提交可告知继续
