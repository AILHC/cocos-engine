# Spine WASM UpdateRenderData 错误分析

## 错误堆栈

```
wasm-function[476]: embind_init_spine...::__invoke(spine::RegionAttachment&)
wasm-function[59]: __memcpy
wasm-function[122]: spine::Bone::updateWorldTransform(...)
wasm-function[335]: spine::AttachmentTimeline::AttachmentTimeline(int)
wasm-function[201]: spine::Skeleton::updateCache()
wasm-function[495]: AttachmentVertices::copy()
→ JS: updateRenderData (game.js:8361)
```

## 调用链分析

### 1. JavaScript 层调用

**文件**: `d:\workspace\engines\cocos\3.8.6\cocos\spine\skeleton.ts`

```typescript
// 第 1168-1177 行
public updateRenderData (): any {
    if (this.isAnimationCached()) {
        if (!this._curFrame) return null;
        const model = this._curFrame.model;
        return model;
    } else {
        const model = this._instance!.updateRenderData();  // 调用 WASM
        return model;
    }
}
```

### 2. Assembler 层调用

**文件**: `d:\workspace\engines\cocos\3.8.6\cocos\spine\assembler\simple.ts`

```typescript
// 第 118-124 行
updateRenderData (comp: Skeleton): void {
    const skeleton = comp._skeleton;
    const cull = !!comp.node.__CULLED__;
    if (skeleton && comp.node.active && !cull && comp.skeletonData?.isValid) {
        updateComponentRenderData(comp);  // 第 129 行
    }
}
```

### 3. WASM C++ 层调用

**文件**: `d:\workspace\engines\cocos\3.8.6\native\cocos\editor-support\spine-wasm\spine-skeleton-instance.cpp`

```cpp
// 第 207-227 行
SpineModel *SpineSkeletonInstance::updateRenderData() {
    if (_userData.debugMode) {
        _debugShapes.clear();
    }
    _skeleton->updateWorldTransform();  // 第 212 行 - 触发堆栈中的 Bone::updateWorldTransform
    SpineMeshData::reset();
    _model->clearMeshes();
    if (_userData.useTint) {
        _model->byteStride = sizeof(V3F_T2F_C4B_C4B);
    } else {
        _model->byteStride = sizeof(V3F_T2F_C4B);
    }
    collectMeshData();  // 第 223 行 - 遍历所有 slot 和 attachment
    globalMesh.textureID = "";
    _model->setBufferPtr(SpineMeshData::vb(), SpineMeshData::ib());
    return _model;
}
```

### 4. AttachmentVertices::copy() 调用

**文件**: `d:\workspace\engines\cocos\3.8.6\native\cocos\editor-support\spine-wasm\AtlasAttachmentLoaderExtension.cpp`

```cpp
// 第 20-25 行
AttachmentVertices *AttachmentVertices::copy() {
    AttachmentVertices *atv = new AttachmentVertices(_triangles->vertCount, _triangles->indices, _triangles->indexCount, _textureName);
    atv->_textureUUID = _textureUUID;
    memcpy(static_cast<void *>(atv->_triangles->verts), static_cast<void *>(_triangles->verts), sizeof(V3F_T2F_C4B) * _triangles->vertCount);
    return atv;
}
```

## 可疑代码和问题分析

### 问题 1: createStoreMemory 的使用时机（skeleton-data.ts 第 228 行）

**文件**: `d:\workspace\engines\cocos\3.8.6\cocos\spine\skeleton-data.ts`

```typescript
// 第 225-234 行
const rawData = new Uint8Array(this._nativeAsset);
const byteSize = rawData.length;
const ptr = spine.wasmUtil.createStoreMemory(byteSize);  // 创建临时内存
const wasmMem = spine.wasmUtil.wasm.HEAPU8.subarray(ptr, ptr + byteSize);
wasmMem.set(rawData);
this._skeletonCache = spine.wasmUtil.createSpineSkeletonDataWithBinary(byteSize, this._atlasText, this.textureNames, textureUUIDs);
spine.wasmUtil.registerSpineSkeletonDataWithUUID(this._skeletonCache, uuid);
spine.wasmUtil.freeStoreMemory();  // 立即释放内存
```

**问题**: `createStoreMemory` 返回的指针在 `freeStoreMemory()` 被调用后失效，但在 `createSpineSkeletonDataWithBinary` 中可能还在使用这个内存。

### 问题 2: AttachmentVertices 生命周期管理

**文件**: `d:\workspace\engines\cocos\3.8.6\native\cocos\editor-support\spine-wasm\spine-wasm.cpp`

```cpp
// 第 120 行
attachmentVertices = generateAttachmentVertices(attachment);

// generateAttachmentVertices 在第 46-55 行创建新对象
attachmentVertices = new AttachmentVertices(
    static_cast<int32_t>(meshAttachment->getWorldVerticesLength() >> 1),
    meshAttachment->getTriangles().buffer(),
    static_cast<int32_t>(meshAttachment->getTriangles().size()),
    region->page->name);
```

**问题**:
1. `generateAttachmentVertices` 返回新分配的 `AttachmentVertices` 对象
2. 这个对象在 `spineAttachmentVerticesMap` 中缓存
3. 在 `destroySpineSkeletonDataWithUUID` 时被删除（第 243 行）
4. 但在 `updateRenderData` 过程中，可能还有代码在访问已经释放的内存

### 问题 3: memcpy 访问已释放内存

**文件**: `d:\workspace\engines\cocos\3.8.6\native\cocos\editor-support\spine-wasm\AtlasAttachmentLoaderExtension.cpp`

```cpp
// AttachmentVertices::copy() 第 23 行
memcpy(static_cast<void *>(atv->_triangles->verts),
       static_cast<void *>(_triangles->verts),
       sizeof(V3F_T2F_C4B) * _triangles->vertCount);
```

**问题**:
- `_triangles->verts` 指向的内存可能已经被释放
- 在 `updateRenderData` 的循环中访问 attachment 时（spine-skeleton-instance.cpp 第 297-298 行），可能访问悬垂指针

### 问题 4: 内存释放时序问题

**文件**: `d:\workspace\engines\cocos\3.8.6\native\cocos\editor-support\spine-wasm\spine-wasm.cpp`

```cpp
// 第 233-248 行 - destroySpineSkeletonDataWithUUID
void SpineWasmUtil::destroySpineSkeletonDataWithUUID(const String& uuid) {
    if (skeletonDataMap.containsKey(uuid)) {
        auto* data = skeletonDataMap[uuid];
        HashMap<Attachment *, AttachmentVertices *> *attachmentVerticesMap = nullptr;
        if (spineAttachmentVerticesMap.containsKey(data)) {
            attachmentVerticesMap = spineAttachmentVerticesMap[data];
            auto entries = attachmentVerticesMap->getEntries();
            while (entries.hasNext()) {
                auto entry = entries.next();
                auto* attachmentVertices = entry.value;
                delete attachmentVertices;  // 删除 AttachmentVertices
            }
            delete attachmentVerticesMap;
            spineAttachmentVerticesMap.remove(data);
        }
        delete data;
        skeletonDataMap.remove(uuid);
    }
}
```

**问题**:
1. `SkeletonData` 被删除后，其包含的 `Attachment` 对象也被删除
2. 但 `Skeleton` 实例可能还在使用这些 `Attachment`
3. 在 `updateRenderData` 中通过 `slot->getAttachment()` 获取的可能是悬垂指针

### 问题 5: updateWorldTransform 的副作用

**文件**: `d:\workspace\engines\cocos\3.8.6\native\cocos\editor-support\spine-wasm\spine-skeleton-instance.cpp`

```cpp
// 第 212 行
_skeleton->updateWorldTransform();
```

**问题**:
- `updateWorldTransform` 会更新所有骨骼的世界变换
- 这可能导致 `AttachmentTimeline` 的应用，改变 attachment 的状态
- 如果此时 attachment 相关的内存已经失效，就会访问错误内存

## 根本原因分析

### 时序问题

1. **初始化阶段**:
   - `createStoreMemory()` 创建临时内存
   - `createSpineSkeletonDataWithBinary()` 使用这个内存
   - `freeStoreMemory()` 立即释放内存
   - **问题**: `SkeletonData` 内部可能还保留着指向这个内存的指针

2. **运行阶段**:
   - `updateRenderData()` 被调用
   - `_skeleton->updateWorldTransform()` 更新骨骼
   - `collectMeshData()` 遍历 attachment
   - **问题**: 如果 attachment 的内部数据指向已释放的内存，就会崩溃

3. **销毁阶段**:
   - `destroySpineSkeletonDataWithUUID()` 删除 `SkeletonData`
   - 删除所有缓存的 `AttachmentVertices`
   - **问题**: 此时可能还有 `Skeleton` 实例在使用这些数据

### 悬垂指针来源

1. **StoreMemory 悬垂指针**:
   - `createStoreMemory()` 返回的指针在 `freeStoreMemory()` 后失效
   - Spine runtime 可能缓存了这个指针

2. **AttachmentVertices 悬垂指针**:
   - `AttachmentVertices::copy()` 复制 `_triangles->verts` 内存
   - 原始 `AttachmentVertices` 被删除后，复制的内容可能失效

3. **Attachment 悬垂指针**:
   - `SkeletonData` 被删除后，其包含的 `Attachment` 也被删除
   - 但 `Skeleton` 实例还持有这些 `Attachment` 的指针

## 修复建议

### 1. 修复 StoreMemory 的生命周期

**文件**: `d:\workspace\engines\cocos\3.8.6\cocos\spine\skeleton-data.ts`

```typescript
// 修改第 225-234 行
const rawData = new Uint8Array(this._nativeAsset);
const byteSize = rawData.length;

// 方案A: 不立即释放，等待 Spine 内部复制完成
const ptr = spine.wasmUtil.createStoreMemory(byteSize);
const wasmMem = spine.wasmUtil.wasm.HEAPU8.subarray(ptr, ptr + byteSize);
wasmMem.set(rawData);
this._skeletonCache = spine.wasmUtil.createSpineSkeletonDataWithBinary(byteSize, this._atlasText, this.textureNames, textureUUIDs);
spine.wasmUtil.registerSpineSkeletonDataWithUUID(this._skeletonCache, uuid);
// 延迟释放，确保 Spine 已经完成数据复制
setTimeout(() => {
    spine.wasmUtil.freeStoreMemory();
}, 0);

// 方案B: 使用 Spine 的内存管理，而不是临时内存
// 这需要修改 WASM 接口，让 Spine 内部管理内存
```

### 2. 修复 AttachmentVertices 的生命周期管理

**文件**: `d:\workspace\engines\cocos\3.8.6\native\cocos\editor-support\spine-wasm\AtlasAttachmentLoaderExtension.cpp`

```cpp
// AttachmentVertices::copy() - 深拷贝而不是浅拷贝
AttachmentVertices *AttachmentVertices::copy() {
    AttachmentVertices *atv = new AttachmentVertices(_triangles->vertCount, _triangles->indices, _triangles->indexCount, _textureName);
    atv->_textureUUID = _textureUUID;

    // 深拷贝 verts 数组
    atv->_triangles->verts = new V3F_T2F_C4B[_triangles->vertCount];
    memcpy(static_cast<void *>(atv->_triangles->verts),
           static_cast<void *>(_triangles->verts),
           sizeof(V3F_T2F_C4B) * _triangles->vertCount);

    // 深拷贝 indices 数组
    atv->_triangles->indices = new uint16_t[_triangles->indexCount];
    memcpy(atv->_triangles->indices,
           _triangles->indices,
           sizeof(uint16_t) * _triangles->indexCount);

    return atv;
}
```

### 3. 添加生命周期检查

**文件**: `d:\workspace\engines\cocos\3.8.6\native\cocos\editor-support\spine-wasm\spine-skeleton-instance.cpp`

```cpp
SpineModel *SpineSkeletonInstance::updateRenderData() {
    // 检查 SkeletonData 是否还有效
    if (!skeletonDataMap.containsKey(_skeletonData)) {
        // SkeletonData 已经被销毁，不应该继续使用
        return nullptr;
    }

    if (_userData.debugMode) {
        _debugShapes.clear();
    }
    // ... 其余代码
}
```

### 4. 修复 SkeletonData 的销毁时机

**文件**: `d:\workspace\engines\cocos\3.8.6\cocos\spine\skeleton.ts`

```typescript
public onDestroy (): void {
    // 在销毁 Skeleton 实例之前，先确保没有使用 SkeletonData
    this._skeleton = null!;
    this._instance = null!;

    // 然后再销毁 SkeletonData
    SkeletonCache.sharedCache.destroyCachedAnimations(this._uuid);
    spine.wasmUtil.destroySpineSkeletonDataWithUUID(this.skeletonData.mergedUUID());

    super.onDestroy();
}
```

### 5. 使用智能指针管理

**文件**: `d:\workspace\engines\cocos\3.8.6\native\cocos\editor-support\spine-wasm\AtlasAttachmentLoaderExtension.h`

```cpp
#include <memory>

class AttachmentVertices {
public:
    AttachmentVertices(int verticesCount, uint16_t *triangles, int trianglesCount, const spine::String& textureUUID);
    virtual ~AttachmentVertices();
    AttachmentVertices *copy();

    // 使用智能指针管理 triangles
    std::shared_ptr<Triangles> _triangles;
    spine::String _textureUUID;
    spine::String _textureName;
};
```

## 关键文件位置

1. **skeleton-data.ts**: `d:\workspace\engines\cocos\3.8.6\cocos\spine\skeleton-data.ts`
   - 第 228 行: `createStoreMemory(byteSize)`
   - 第 233 行: `freeStoreMemory()`

2. **spine-wasm.cpp**: `d:\workspace\engines\cocos\3.8.6\native\cocos\editor-support\spine-wasm\spine-wasm.cpp`
   - 第 260-264 行: `createStoreMemory()` 实现
   - 第 266-271 行: `freeStoreMemory()` 实现
   - 第 233-248 行: `destroySpineSkeletonDataWithUUID()` 实现

3. **spine-skeleton-instance.cpp**: `d:\workspace\engines\cocos\3.8.6\native\cocos\editor-support\spine-wasm\spine-skeleton-instance.cpp`
   - 第 207-227 行: `updateRenderData()` 实现
   - 第 212 行: `_skeleton->updateWorldTransform()`
   - 第 229 行: `collectMeshData()`

4. **AtlasAttachmentLoaderExtension.cpp**: `d:\workspace\engines\cocos\3.8.6\native\cocos\editor-support\spine-wasm\AtlasAttachmentLoaderExtension.cpp`
   - 第 20-25 行: `AttachmentVertices::copy()` 实现
   - 第 6-13 行: `AttachmentVertices` 构造函数
   - 第 15-18 行: `AttachmentVertices` 析构函数

## 堆栈映射到代码

```
wasm-function[476]: embind_init_spine...::__invoke(spine::RegionAttachment&)
  → RegionAttachment 的初始化或访问

wasm-function[59]: __memcpy
  → AttachmentVertices::copy() 中的 memcpy 调用（第 23 行）
  → 或 updateRenderData 中的 memcpy 调用

wasm-function[122]: spine::Bone::updateWorldTransform(...)
  → updateRenderData 第 212 行调用

wasm-function[335]: spine::AttachmentTimeline::AttachmentTimeline(int)
  → 可能在 updateCache 或 apply 过程中

wasm-function[201]: spine::Skeleton::updateCache()
  → Skeleton 的缓存更新

wasm-function[495]: AttachmentVertices::copy()
  → 直接对应 AtlasAttachmentLoaderExtension.cpp 第 20 行
```

## 结论

这是一个典型的**内存生命周期管理问题**，主要原因是：

1. **StoreMemory 过早释放**: `freeStoreMemory()` 在 Spine 还可能使用内存时就被调用
2. **AttachmentVertices 浅拷贝**: `copy()` 方法没有进行深拷贝，导致共享内部指针
3. **缺少引用计数**: 没有机制跟踪哪些对象还在使用 `SkeletonData` 和 `Attachment`
4. **时序问题**: `destroySpineSkeletonDataWithUUID` 可能在 `updateRenderData` 执行期间被调用

最可能的触发场景：
- 场景切换时，旧的 SkeletonData 被销毁
- 但 Skeleton 组件的 `updateRenderData` 还在执行
- 访问了已经释放的 `AttachmentVertices` 数据
