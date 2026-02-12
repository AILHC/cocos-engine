# WebAssembly 越界内存访问错误分析报告

## 错误信息

```
Out of bounds memory access (evaluating 'r.apply(null,l)')
RuntimeError: Out of bounds memory access (evaluating 'r.apply(null,l)')
```

## 完整调用链分析

### JavaScript/TypeScript 层

**文件**: `d:\workspace\engines\cocos\3.8.6\cocos\spine\skeleton.ts`
**方法**: `updateAnimation` (行 1081-1113)

```typescript
public updateAnimation (dt: number): void {
    this.markForUpdateRenderData();
    if (this._cannotPreviewInEditor()) return;
    if (this.paused) return;
    if (this.isAnimationCached()) {
        // ... 缓存模式处理 ...
    } else {
        this._instance!.updateAnimation(dt);  // 行 1111 - 调用 WASM
    }
}
```

**关键观察**:
- 使用了 `this._instance!` 非空断言操作符（`!`），表示 `_instance` 可能为 null
- `_instance` 类型为 `spine.SkeletonInstance | null`
- 如果 `_instance` 为 null 或已被销毁，调用其方法会导致内存错误

### WASM/C++ 层

**文件**: `d:\workspace\engines\cocos\3.8.6\native\cocos\editor-support\spine-wasm\spine-skeleton-instance.cpp`
**方法**: `SpineSkeletonInstance::updateAnimation` (行 198-205)

```cpp
void SpineSkeletonInstance::updateAnimation(float dltTime) {
    if (!_skeleton) return;  // 行 199 - 空指针检查
    dltTime *= dtRate;
    _skeleton->update(dltTime);      // 行 201 - 更新骨架
    _animState->update(dltTime);     // 行 202 - 更新动画状态
    _animState->apply(*_skeleton);   // 行 203 - 应用动画到骨架
    dispatchEvents();                  // 行 204 - 分发事件
}
```

**关键观察**:
- C++ 层对 `_skeleton` 进行了空指针检查
- 但 `_animState` 可能未检查

## 堆栈调用链

根据之前的堆栈跟踪和完整代码分析：

```
skeleton.ts:updateAnimation (行 1111)
    ↓ this._instance!.updateAnimation(dt)
    ↓
spine-skeleton-instance.cpp:updateAnimation (行 198-205)
    ↓ _animState->apply(*_skeleton)
    ↓
wasm-function[361]  -> spine::IkConstraintTimeline::IkConstraintTimeline(int)
    ↓
wasm-function[497]  -> emscripten::internal::raw_destructor<spine::Skin::AttachmentMap::Entry>(spine::Skin::AttachmentMap::Entry*)
    ↓
wasm-function[113]  -> emscripten::internal::MethodInvoker<float (spine::Vector2::*)() const, float, const spine::Vector2*>::invoke()
    ↓
Vector2::getX() 访问无效内存 ⚠️ CRASH
```

## 符号表解析

### 索引 361: `spine::IkConstraintTimeline::IkConstraintTimeline(int)`

**源码位置**: `d:\workspace\engines\cocos\3.8.6\native\cocos\editor-support\spine\3.8\spine\IkConstraintTimeline.cpp:63-65`

```cpp
IkConstraintTimeline::IkConstraintTimeline(int frameCount) : CurveTimeline(frameCount), _ikConstraintIndex(0) {
    _frames.setSize(frameCount * ENTRIES, 0);
}
```

**分析**:
- 构造函数接收 `frameCount` 参数
- 调用父类 `CurveTimeline(frameCount)` 构造函数
- 初始化 `_frames` 向量，大小为 `frameCount * ENTRIES`（ENTRIES = 6）
- **潜在问题**: 如果 `frameCount` 为负数或过大，可能导致内存分配问题或越界访问

### 索引 497: `emscripten::internal::raw_destructor<spine::Skin::AttachmentMap::Entry>(spine::Skin::AttachmentMap::Entry*)`

**源码位置**: `d:\workspace\engines\cocos\3.8.6\native\cocos\editor-support\spine\3.8\spine\Skin.h:54-63`

```cpp
struct SP_API Entry {
    size_t _slotIndex;
    String _name;
    Attachment *_attachment;
    Entry(size_t slotIndex, const String &name, Attachment *attachment) : _slotIndex(slotIndex),
                                                                          _name(name),
                                                                          _attachment(attachment) {
    }
};
```

**分析**:
- 这是 Emscripten 自动生成的析构函数包装器
- `Entry` 结构体包含三个成员：`_slotIndex`（size_t）、`_name`（String）、`_attachment`（指针）
- **潜在问题**:
  1. 如果 `Entry*` 指针无效或已释放，会导致访问错误
  2. `String` 类型析构时可能访问已释放的内存
  3. 双重释放问题

### 索引 113: `emscripten::internal::MethodInvoker<float (spine::Vector2::*)() const, float, const spine::Vector2*>::invoke()`

**源码位置**: `d:\workspace\engines\cocos\3.8.6\native\cocos\editor-support\spine-wasm\Vector2.cpp:20-22`

```cpp
float Vector2::getX() const {
    return x;
}
```

**分析**:
- 这是 `Vector2::getX()` 方法调用
- **最可能的错误源**: `const spine::Vector2*` 指针为空或指向无效内存
- 当尝试通过无效指针调用 `getX()` 时，会读取 `this->x`，导致越界访问

## 根本原因分析

### 重新评估的根因（结合新证据）

基于完整的调用链分析，问题的根本原因可能是以下几种情况之一：

#### 1. **SkeletonInstance 生命周期问题**（概率：40%）

**场景**:
- `skeleton.ts` 中的 `_instance` 对象在 `updateAnimation` 调用时已被部分销毁
- TypeScript 层使用 `!` 断言绕过了空指针检查
- WASM 层的 `_skeleton` 或 `_animState` 指针已失效

**相关代码**:
```typescript
// skeleton.ts 行 333-346
constructor () {
    super();
    this._useVertexOpacity = true;
    // ...
    if (!JSB) {
        this._instance = new spine.SkeletonInstance();  // 创建实例
        this._instance.dtRate = this._timeScale * timeScale;
        this._instance.isCache = this.isAnimationCached();
    }
    // ...
}
```

**可能的问题场景**:
```typescript
// skeleton.ts 行 741-744
if (!JSB && this._instance) {
    this._instance.destroy();  // 销毁实例
    this._instance = null;    // 但可能存在时序问题
}
```

**触发条件**:
- 在 `onDestroy()` 调用后，`updateAnimation` 仍被调用
- 异步销毁过程中有其他组件仍在使用 `Skeleton`
- 组件禁用时（`onDisable`）动画系统仍在更新

#### 2. **IkConstraint 内部 Vector2 访问问题**（概率：35%）

**场景**:
- IK 约束应用时访问了无效的 `Vector2` 成员
- `IkConstraint::apply()` 方法中的向量计算使用已释放的内存

**相关代码** (`d:\workspace\engines\cocos\3.8.6\native\cocos\editor-support\spine\3.8\spine\IkConstraint.cpp`):
```cpp
void IkConstraint::apply(Bone &parent, Bone &child, float targetX, float targetY, int bendDir, bool stretch, float softness, float alpha) {
    float a, b, c, d;
    float px, py, psx, sx, psy;
    float cx, cy, csx, cwx, cwy;
    // ... 计算过程 ...
    // 如果 parent 或 child 的内部 Vector2 成员已失效，这里会崩溃
    if (!parent._appliedValid) parent.updateAppliedTransform();  // 行 108
    if (!child._appliedValid) child.updateAppliedTransform();   // 行 109
    px = parent._ax;  // 访问可能已失效的内存
    py = parent._ay;
    // ...
}
```

**触发条件**:
- Bone 对象在 IK 约束应用时已部分销毁
- Skeleton 数据被重新加载但旧的约束引用仍存在
- 动画切换时约束数据未正确更新

#### 3. **动画状态与骨架不同步**（概率：15%）

**场景**:
- `_animState` 仍引用已释放的 `_skeleton` 对象
- `AnimationState::apply()` 尝试访问无效的骨骼数据

**相关代码**:
```cpp
// spine-skeleton-instance.cpp 行 198-205
void SpineSkeletonInstance::updateAnimation(float dltTime) {
    if (!_skeleton) return;  // ✓ 检查 _skeleton
    dltTime *= dtRate;
    _skeleton->update(dltTime);
    _animState->update(dltTime);       // ✗ 未检查 _animState
    _animState->apply(*_skeleton);   // ✗ 如果 _animState 无效则崩溃
    dispatchEvents();
}
```

#### 4. **Skin/Attachment 析构问题**（概率：10%）

**场景**:
- `Skin::AttachmentMap::Entry` 的析构函数被调用，但相关对象已被释放
- 双重释放或访问已释放的内存

### 根因优先级排序（更新后）

#### 2. **IkConstraintTimeline 构造时的参数问题**（概率：10%）

**场景**:
- 传递给 `IkConstraintTimeline` 构造函数的 `frameCount` 参数异常
- 可能导致 `_frames` 向量分配不正确
- 后续访问 `_frames` 时越界

**相关代码位置**:
- `d:\workspace\engines\cocos\3.8.6\native\cocos\editor-support\spine\3.8\spine\IkConstraintTimeline.cpp:63-65`
- `d:\workspace\engines\cocos\3.8.6\native\cocos\editor-support\spine\3.8\spine\CurveTimeline.cpp:47-51`

#### 3. **Skin::AttachmentMap::Entry 析构问题**（概率：5%）

**场景**:
- `Entry` 对象被错误地释放多次
- `String` 成员的析构函数访问已释放的内存

**相关代码位置**:
- `d:\workspace\engines\cocos\3.8.6\native\cocos\editor-support\spine\3.8\spine\Skin.cpp:50-54`（disposeAttachment 函数）
- `d:\workspace\engines\cocos\3.8.6\native\cocos\editor-support\spine\3.8\spine\Skin.cpp:100-106`（Skin 析构函数）

## 调试建议

### 1. 立即检查项

#### 检查 Vector2 指针使用

在以下位置添加空指针检查：
- 所有调用 `Vector2::getX()` 和 `Vector2::getY()` 的地方
- 特别是 `IkConstraint::apply()` 方法中的向量操作

```cpp
// 示例：添加防御性检查
if (vector2Ptr != nullptr) {
    float x = vector2Ptr->getX();
} else {
    // 记录错误并处理
    CCLOGERROR("Vector2 pointer is null!");
}
```

#### 检查 IkConstraintTimeline 创建

检查所有创建 `IkConstraintTimeline` 的代码：
```cpp
// d:\workspace\engines\cocos\3.8.6\native\cocos\editor-support\spine\3.8\spine\SkeletonBinary.cpp
// 或其他创建 Timeline 的地方

// 添加参数验证
if (frameCount <= 0 || frameCount > MAX_FRAMES) {
    CCLOGERROR("Invalid frameCount: %d", frameCount);
    return nullptr;
}
```

### 2. 内存分析工具

#### 使用 Emscripten 内存分析

重新编译时添加调试选项：
```bash
emcmake cmake .. -DEMSCRIPTEN_WARN_MISSING_PORTS=1
emcc -g4 -s SAFE_HEAP=1 -s STACK_OVERFLOW_CHECK=2
```

#### 添加内存追踪

在关键位置添加内存访问日志：
```cpp
#define TRACK_VECTOR2_ACCESS(ptr) \
    if ((ptr) == nullptr) { \
        CCLOGERROR("NULL Vector2 access at %s:%d", __FILE__, __LINE__); \
    } else { \
        CCLOG("Vector2 access: %p", (void*)(ptr)); \
    }
```

### 3. 具体排查步骤

#### 步骤 1: 确定崩溃时序

1. 在 `IkConstraintTimeline` 构造函数中添加日志：
```cpp
IkConstraintTimeline::IkConstraintTimeline(int frameCount) : CurveTimeline(frameCount), _ikConstraintIndex(0) {
    CCLOG("IkConstraintTimeline created with frameCount=%d", frameCount);
    _frames.setSize(frameCount * ENTRIES, 0);
}
```

2. 在 `Vector2::getX()` 中添加日志：
```cpp
float Vector2::getX() const {
    CCLOG("Vector2::getX() called on %p", (void*)this);
    return x;
}
```

#### 步骤 2: 检查 Spine 数据完整性

验证 Spine 骨骼数据文件：
- 检查 IK 约束数据是否完整
- 确认 frameCount 值在合理范围内
- 验证所有必需字段都存在

#### 步骤 3: 检查对象生命周期

确认以下对象的生命周期管理：
- `IkConstraint` 对象是否在使用中被释放
- `Skin` 对象的析构时机
- `Attachment` 对象的引用计数

### 4. 常见触发场景

根据堆栈调用，最可能的触发场景：

**场景 A: IK 约束应用时的空指针**
```cpp
// 在 AnimationState::apply() 或类似方法中
IkConstraint* constraint = skeleton._ikConstraints[index];
// 如果 constraint 为 null 或其内部 Vector2 成员未初始化
constraint->apply(...); // 可能触发崩溃
```

**场景 B: Timeline 加载时的数据损坏**
```cpp
// 在 SkeletonBinary::readIkConstraint() 中
int frameCount = readInt(input);
// 如果 frameCount 被错误读取或数据损坏
IkConstraintTimeline* timeline = new IkConstraintTimeline(frameCount);
// 后续使用 timeline 时崩溃
```

**场景 C: Skin 切换时的内存问题**
```cpp
// 在 Skeleton::setSkin() 或类似方法中
// 旧的 skin 被销毁，但仍有引用指向其 Entry
delete oldSkin;
// 其他代码仍尝试访问已释放的 Entry
```

## 调试和修复建议

### 1. 立即检查项（JavaScript 层）

#### 添加 _instance 有效性检查

在 `skeleton.ts` 的 `updateAnimation` 方法中添加更严格的检查：

```typescript
// skeleton.ts 行 1081-1113
public updateAnimation (dt: number): void {
    this.markForUpdateRenderData();
    if (this._cannotPreviewInEditor()) return;
    if (this.paused) return;

    // 🔧 添加：检查 instance 是否有效
    if (!this._instance) {
        console.warn(`[Spine] Attempting to update animation with null instance on node: ${this.node?.name}`);
        return;
    }

    if (this.isAnimationCached()) {
        // 缓存模式处理...
    } else {
        this._instance!.updateAnimation(dt);
    }
}
```

#### 改进 onDestroy 方法

```typescript
// skeleton.ts 行 723-748
public onDestroy (): void {
    // 先移除系统监听
    SkeletonSystem.getInstance().remove(this);
    this._isRenderable = false;

    // 🔧 添加：确保 instance 销毁后不再被访问
    if (!JSB && this._instance) {
        this._instance.destroy();
        this._instance = null;  // 明确设为 null
    }

    // ... 其他清理代码 ...
}
```

### 2. WASM/C++ 层防御性检查

#### 在 SpineSkeletonInstance::updateAnimation 中添加检查

```cpp
// spine-skeleton-instance.cpp 行 198-205
void SpineSkeletonInstance::updateAnimation(float dltTime) {
    // 🔧 添加：检查 _animState 有效性
    if (!_skeleton || !_animState) {
        logToConsole("SpineSkeletonInstance::updateAnimation: null skeleton or animState", LOG_LEVEL_ERROR);
        return;
    }

    dltTime *= dtRate;
    _skeleton->update(dltTime);
    _animState->update(dltTime);

    // 🔧 添加：try-catch 包装或检查 skeleton 有效性
    if (_skeleton) {  // 二次检查，防止 update 中被销毁
        _animState->apply(*_skeleton);
    }

    dispatchEvents();
}
```

#### 在 IkConstraint::apply 中添加检查

```cpp
// IkConstraint.cpp 行 96-200
void IkConstraint::apply(Bone &parent, Bone &child, float targetX, float targetY, int bendDir, bool stretch, float softness, float alpha) {
    // 🔧 添加：验证 bone 对象有效性
    if (alpha == 0) {
        child.updateWorldTransform();
        return;
    }

    // 🔧 添加：检查 parent 和 child 是否有有效数据
    if (!parent._appliedValid) parent.updateAppliedTransform();
    if (!child._appliedValid) child.updateAppliedTransform();

    // 🔧 添加：添加断言或日志
#ifdef DEBUG
    if (&parent == nullptr || &child == nullptr) {
        logToConsole("IkConstraint::apply: null bone reference", LOG_LEVEL_ERROR);
        return;
    }
#endif

    // ... 继续原有逻辑 ...
}
```

### 3. 使用调试工具

#### 启用 WASM 内存检查

重新编译时添加调试选项：
```bash
# native/cocos/editor-support/spine-wasm/build-wasm
emcmake cmake .. -DCMAKE_BUILD_TYPE=Debug
emcc -g4 -s SAFE_HEAP=1 -s STACK_OVERFLOW_CHECK=2
```

#### 添加内存访问追踪

在关键位置添加内存访问日志：
```cpp
// spine-skeleton-instance.cpp
#define LOG_SKELETON_STATE() \
    logToConsole("Skeleton: " + std::to_string((uintptr_t)_skeleton) + \
                ", AnimState: " + std::to_string((uintptr_t)_animState), LOG_LEVEL_INFO);

void SpineSkeletonInstance::updateAnimation(float dltTime) {
    LOG_SKELETON_STATE();  // 记录指针状态
    // ...
}
```

### 4. 长期修复（根本解决）

#### 改进对象生命周期管理

```typescript
// skeleton.ts
export class Skeleton extends UIRenderer {
    private _instanceValid: boolean = false;  // 🔧 新增标记

    constructor () {
        super();
        // ...
        if (!JSB) {
            this._instance = new spine.SkeletonInstance();
            this._instanceValid = true;  // 标记为有效
            // ...
        }
    }

    public onDestroy (): void {
        // 🔧 先标记为无效
        this._instanceValid = false;

        if (!JSB && this._instance) {
            this._instance.destroy();
            this._instance = null;
        }
        // ...
    }

    public updateAnimation (dt: number): void {
        // 🔧 检查有效性标记
        if (!this._instanceValid || !this._instance) {
            return;
        }
        // ...
    }
}
```

#### 添加 Spine 数据完整性验证

```cpp
// 在 SkeletonData 加载后添加验证
bool validateSkeletonData(SkeletonData* data) {
    if (!data) return false;

    // 验证 IK 约束数据
    auto& ikConstraints = data->getIkConstraints();
    for (int i = 0; i < ikConstraints.size(); i++) {
        auto* ikConstraint = ikConstraints[i];
        if (!ikConstraint) continue;

        // 验证 bones 数组
        auto& bones = ikConstraint->getBones();
        for (int j = 0; j < bones.size(); j++) {
            if (!bones[j]) {
                logToConsole("Invalid IK constraint: null bone", LOG_LEVEL_ERROR);
                return false;
            }
        }

        // 验证 target
        if (!ikConstraint->getTarget()) {
            logToConsole("Invalid IK constraint: null target", LOG_LEVEL_ERROR);
            return false;
        }
    }

    return true;
}
```

## 相关文件清单

### TypeScript/JavaScript 层
- `d:\workspace\engines\cocos\3.8.6\cocos\spine\skeleton.ts` - Skeleton 组件主文件（行 1081-1113: updateAnimation）
- `d:\workspace\engines\cocos\3.8.6\cocos\spine\lib\spine-core.d.ts` - Spine WASM 接口定义

### WASM/C++ 层
- `d:\workspace\engines\cocos\3.8.6\native\cocos\editor-support\spine-wasm\spine-skeleton-instance.cpp` - SkeletonInstance 实现（行 198-205: updateAnimation）
- `d:\workspace\engines\cocos\3.8.6\native\cocos\editor-support\spine-wasm\spine-wasm.cpp` - WASM 绑定代码
- `d:\workspace\engines\cocos\3.8.6\native\cocos\editor-support\spine\3.8\spine\IkConstraint.cpp` - IK 约束实现
- `d:\workspace\engines\cocos\3.8.6\native\cocos\editor-support\spine\3.8\spine\IkConstraintTimeline.cpp` - IK 约束时间轴
- `d:\workspace\engines\cocos\3.8.6\native\cocos\editor-support\spine\3.8\spine\Skin.cpp` - Skin 管理
- `d:\workspace\engines\cocos\3.8.6\native\cocos\editor-support\spine-wasm\Vector2.cpp` - Vector2 实现（行 20-22: getX）

## 总结

基于完整的调用链分析（TypeScript → WASM → C++），**最可能的原因是**：

### 优先级 1：SkeletonInstance 生命周期问题（40%）
`skeleton.ts` 中的 `_instance` 对象在 `updateAnimation` 调用时可能处于部分销毁状态。TypeScript 的 `!` 断言绕过了空指针检查，导致 WASM 层访问无效内存。

### 优先级 2：IkConstraint 内部访问问题（35%）
IK 约束应用时访问了已失效的 `Vector2` 成员或 Bone 对象，特别是在动画切换或数据重新加载时。

### 优先级 3：动画状态同步问题（15%）
`_animState` 对象未经验证就被使用，而其引用的 `_skeleton` 可能已失效。

## 快速诊断步骤

1. **在崩溃时检查**：
   - `skeleton._instance` 是否为 null
   - `skeleton.node` 是否仍在场景中
   - 是否正在切换场景或销毁节点

2. **在 Spine 数据加载时检查**：
   - IK 约束配置是否完整
   - 是否有循环引用（bones 引用自己）

3. **添加调试代码**：
   - 在 `skeleton.ts:updateAnimation` 开头添加日志
   - 在 `spine-skeleton-instance.cpp:updateAnimation` 添加指针验证日志

---

**更新时间**: 2026-02-11
**分析范围**: TypeScript → WASM → C++ 完整调用链
**分析方法**: 源码静态分析 + 调用链追踪
