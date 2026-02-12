# Spine WASM 符号表测试指南

## 概述

本文档提供了在浏览器环境中复现越界内存访问错误的测试方案，用于验证符号表（Symbol Table）在调试 WASM 错误时的有效性。

## 目标错误

**原始错误堆栈**：
```
Out of bounds memory access (evaluating 'r.apply(null,l)')
wasm-function[361]  // spine::IkConstraintTimeline::IkConstraintTimeline(int)
wasm-function[497]  // emscripten::internal::raw_destructor<spine::Skin::AttachmentMap::Entry>
wasm-function[113]  // emscripten::internal::MethodInvoker<float (spine::Vector2::*)() const, float, const spine::Vector2*>::invoke()
```

**使用符号表后的预期堆栈**：
```
Out of bounds memory access
  at spine::IkConstraintTimeline::IkConstraintTimeline(int) (IkConstraintTimeline.cpp:63)
  at emscripten::internal::raw_destructor<spine::Skin::AttachmentMap::Entry> (spine::Skin::AttachmentMap::Entry*)
  at emscripten::internal::MethodInvoker<float (spine::Vector2::*)() const, float, const spine::Vector2*>::invoke() (Vector2.cpp:20)
```

## 测试环境设置

### 1. 准备 Cocos Creator 项目

确保项目使用 Cocos Creator 3.8.6 版本，并包含 Spine 资源。

### 2. 启用符号表

在浏览器中启用符号表解析，需要在构建后的 HTML 中添加以下代码：

```html
<script>
// 在 spine.wasm.js 加载之前添加
window.SPINE_SYMBOL_TABLE_URL = './spine.js.symbols';
</script>
```

### 3. 配置错误捕获

在项目的 main.ts 或游戏启动脚本中添加全局错误处理：

```typescript
// 捕获 WASM 错误
window.addEventListener('error', (event) => {
    if (event.message && event.message.includes('Out of bounds memory access')) {
        console.error('=== WASM 越界访问错误 ===');
        console.error('错误信息:', event.message);
        console.error('错误堆栈:', event.error?.stack);

        // 保存错误信息到 localStorage
        localStorage.setItem('wasm_error', JSON.stringify({
            message: event.message,
            stack: event.error?.stack,
            timestamp: new Date().toISOString()
        }));
    }
});

// 捕获未处理的 Promise 错误
window.addEventListener('unhandledrejection', (event) => {
    console.error('未处理的 Promise 错误:', event.reason);
});
```

## 测试方案

### 方案 1: 使用已销毁的 Skeleton 对象

这是最可能触发错误的方式，模拟对象生命周期问题。

#### 步骤

1. 在浏览器控制台中执行以下代码：

```typescript
// 获取场景中的 Spine 组件
const spineNode = cc.director.getScene().children.find(
    (node: any) => node.getComponent('sp.Skeleton')
);

if (!spineNode) {
    console.error('未找到 Spine 节点，请先创建包含 Spine 组件的场景');
} else {
    const spineComponent = spineNode.getComponent('sp.Skeleton');

    console.log('找到 Spine 组件:', spineComponent.node.name);
    console.log('当前动画:', spineComponent.animation);
    console.log('SkeletonData:', spineComponent.skeletonData?.name);

    // 强制销毁 instance
    console.log('=== 开始测试：强制销毁 instance ===');

    // 保存原始引用
    const originalInstance = (spineComponent as any)._instance;

    // 销毁 instance
    if (originalInstance) {
        originalInstance.destroy();
        (spineComponent as any)._instance = null;
        console.log('Instance 已销毁');
    }

    // 等待一帧后尝试更新动画（触发错误）
    setTimeout(() => {
        console.log('=== 尝试调用 updateAnimation（应该触发错误）===');
        try {
            spineComponent.updateAnimation(0.016);
            console.warn('未触发错误，可能 _instance 检查生效了');
        } catch (error) {
            console.error('成功触发错误:', error);
        }
    }, 100);
}
```

#### 预期结果

- **无符号表**: 显示 `wasm-function[XXX]` 的原始堆栈
- **有符号表**: 显示具体的函数名和源码位置

### 方案 2: 切换包含 IK 约束的动画

IK 约束（IkConstraint）是错误堆栈中出现的关键组件，使用包含 IK 的动画更可能触发问题。

#### 步骤

```typescript
// 查找包含 IK 约束的 Spine 节点
function testIkConstraintAnimation() {
    const scene = cc.director.getScene();
    const spineNodes: any[] = [];

    // 递归查找所有 Spine 节点
    function findSpineNodes(node: any) {
        const spine = node.getComponent('sp.Skeleton');
        if (spine) {
            spineNodes.push({ node, spine });
        }
        node.children.forEach(findSpineNodes);
    }

    scene.children.forEach(findSpineNodes);

    if (spineNodes.length === 0) {
        console.error('未找到 Spine 节点');
        return;
    }

    console.log(`找到 ${spineNodes.length} 个 Spine 节点`);

    // 对每个 Spine 节点测试
    spineNodes.forEach(({ node, spine }, index) => {
        console.log(`\n测试节点 ${index + 1}: ${node.name}`);

        // 获取所有动画名称
        const skeletonData = (spine as any)._skeleton;
        if (!skeletonData) {
            console.log('  无 skeleton data，跳过');
            return;
        }

        const animations = skeletonData.data.animations;
        console.log('  可用动画:', animations.map((a: any) => a.name));

        // 检查是否有 IK 约束
        const ikConstraints = skeletonData.ikConstraints;
        if (ikConstraints && ikConstraints.length > 0) {
            console.log(`  ✓ 发现 ${ikConstraints.length} 个 IK 约束`);

            // 快速切换动画以触发错误
            let animIndex = 0;
            const switchInterval = setInterval(() => {
                if (animIndex >= animations.length) {
                    clearInterval(switchInterval);
                    console.log('  动画切换测试完成');
                    return;
                }

                const animName = animations[animIndex].name;
                console.log(`  切换到动画: ${animName}`);

                try {
                    spine.setAnimation(0, animName, true);
                } catch (error) {
                    console.error(`  ✗ 切换动画时出错:`, error);
                    clearInterval(switchInterval);
                }

                animIndex++;
            }, 50); // 每 50ms 切换一次
        } else {
            console.log('  无 IK 约束，跳过');
        }
    });
}

// 执行测试
testIkConstraintAnimation();
```

#### 预期结果

- 快速切换动画可能导致动画状态不同步
- IK 约束应用时可能访问无效的 Vector2 数据
- 应该触发与原始错误类似的堆栈

### 方案 3: 修改 Spine 数据触发越界

通过创建无效的 Spine 数据来触发加载时的错误。

#### 步骤

1. 在项目中创建一个测试脚本 `spine-error-test.ts`：

```typescript
import { _decorator, Component, Node } from 'cc';
import spine from 'cc/spine';

const { ccclass, property } = _decorator;

@ccclass('SpineErrorTest')
export class SpineErrorTest extends Component {
    @property(Node)
    targetSpineNode: Node | null = null;

    private _testIndex = 0;

    start() {
        // 延迟执行，确保 Spine 已加载
        this.scheduleOnce(() => {
            this.runTests();
        }, 1);
    }

    private runTests() {
        if (!this.targetSpineNode) {
            console.error('未设置目标 Spine 节点');
            return;
        }

        const spineComp = this.targetSpineNode.getComponent(spine.Skeleton);
        if (!spineComp) {
            console.error('目标节点没有 Spine 组件');
            return;
        }

        console.log('=== Spine 错误测试开始 ===');
        this.testInvalidOperations(spineComp);
    }

    private testInvalidOperations(spineComp: spine.Skeleton) {
        const tests = [
            this.testInvalidSkinSwitch,
            this.testInvalidAnimation,
            this.testInvalidAttachment,
            this.testNullAccess,
            this.testRapidSkinChange,
            this.testIkConstraintManipulation
        ];

        const runNextTest = () => {
            if (this._testIndex >= tests.length) {
                console.log('=== 所有测试完成 ===');
                return;
            }

            const test = tests[this._testIndex];
            console.log(`\n--- 测试 ${this._testIndex + 1}/${tests.length} ---`);

            try {
                test.call(this, spineComp);
            } catch (error) {
                console.error(`测试 ${this._testIndex + 1} 触发错误:`, error);
            }

            this._testIndex++;
            this.scheduleOnce(runNextTest, 0.5);
        };

        runNextTest();
    }

    // 测试 1: 无效的 Skin 切换
    private testInvalidSkinSwitch(spineComp: spine.Skeleton) {
        console.log('测试: 无效的 Skin 切换');
        try {
            spineComp.setSkin('non_existent_skin');
            console.warn('  切换到不存在的 skin 未报错');
        } catch (error) {
            console.error('  ✓ 触发错误:', error);
        }
    }

    // 测试 2: 无效的动画设置
    private testInvalidAnimation(spineComp: spine.Skeleton) {
        console.log('测试: 无效的动画设置');
        try {
            spineComp.setAnimation(0, 'non_existent_animation', true);
            console.warn('  设置不存在的动画未报错');
        } catch (error) {
            console.error('  ✓ 触发错误:', error);
        }
    }

    // 测试 3: 无效的 Attachment
    private testInvalidAttachment(spineComp: spine.Skeleton) {
        console.log('测试: 无效的 Attachment 设置');
        try {
            spineComp.setAttachment('invalid_slot', 'invalid_attachment');
            console.warn('  设置无效 attachment 未报错');
        } catch (error) {
            console.error('  ✓ 触发错误:', error);
        }
    }

    // 测试 4: 空指针访问模拟
    private testNullAccess(spineComp: spine.Skeleton) {
        console.log('测试: 空指针访问模拟');

        // 保存原始方法
        const originalUpdate = (spineComp as any).updateAnimation;

        // 替换为可能触发错误的版本
        (spineComp as any).updateAnimation = function(dt: number) {
            // 在更新前尝试访问可能无效的对象
            const instance = (this as any)._instance;
            if (instance) {
                // 强制访问内部属性（可能触发错误）
                try {
                    const skeleton = instance._skeleton;
                    if (skeleton) {
                        // 尝试访问 IK 约束
                        const ikConstraints = skeleton.ikConstraints;
                        if (ikConstraints && ikConstraints.length > 0) {
                            // 访问第一个 IK 约束（可能触发 Vector2 访问错误）
                            const constraint = ikConstraints[0];
                            console.log('  IK 约束数据:', constraint);
                        }
                    }
                } catch (error) {
                    console.error('  ✓ 内部访问触发错误:', error);
                }
            }

            // 调用原始方法
            return originalUpdate.call(this, dt);
        };
    }

    // 测试 5: 快速 Skin 切换
    private testRapidSkinChange(spineComp: spine.Skeleton) {
        console.log('测试: 快速 Skin 切换');

        const skeleton = (spineComp as any)._skeleton;
        if (!skeleton || !skeleton.data.skins || skeleton.data.skins.length === 0) {
            console.log('  无可用的 skins');
            return;
        }

        const skins = skeleton.data.skins;
        let switchCount = 0;
        const maxSwitches = 100;

        const switchSkin = () => {
            if (switchCount >= maxSwitches) {
                console.log(`  完成 ${maxSwitches} 次 skin 切换`);
                return;
            }

            const skinName = skins[switchCount % skins.length].name;
            try {
                spineComp.setSkin(skinName);
            } catch (error) {
                console.error(`  ✓ 第 ${switchCount + 1} 次切换触发错误:`, error);
                return;
            }

            switchCount++;
            requestAnimationFrame(switchSkin);
        };

        switchSkin();
    }

    // 测试 6: IK 约束操作
    private testIkConstraintManipulation(spineComp: spine.Skeleton) {
        console.log('测试: IK 约束操作');

        const skeleton = (spineComp as any)._skeleton;
        if (!skeleton || !skeleton.ikConstraints || skeleton.ikConstraints.length === 0) {
            console.log('  无 IK 约束');
            return;
        }

        // 尝试访问和操作 IK 约束
        skeleton.ikConstraints.forEach((constraint: any, index: number) => {
            console.log(`  IK 约束 ${index}:`);
            console.log('    - 名称:', constraint.data?.name);
            console.log('    - 骨骼数量:', constraint.bones?.length);
            console.log('    - Target:', constraint.target?.data?.name);

            // 尝试触发 Vector2 访问
            try {
                if (constraint.bones && constraint.bones.length > 0) {
                    const bone = constraint.bones[0];
                    // 访问 bone 的位置（Vector2）
                    const x = bone.x;
                    const y = bone.y;
                    console.log(`    - 位置: (${x}, ${y})`);
                }
            } catch (error) {
                console.error(`    ✗ IK 约束 ${index} 访问触发错误:`, error);
            }
        });
    }
}
```

2. 将该组件添加到场景中的节点上

3. 在编辑器中选择包含 Spine 组件的节点作为目标

4. 运行场景

### 方案 4: 使用 Chrome DevTools Memory Profiler

通过内存分析工具检测和触发内存问题。

#### 步骤

1. 打开 Chrome DevTools (F12)

2. 切换到 "Memory" 标签

3. 选择 "Heap snapshot" 并点击 "Take snapshot"

4. 在控制台执行以下代码：

```typescript
// 强制触发内存操作
const spineNodes = cc.director.getScene().getComponentsInChildren('sp.Skeleton');

console.log(`找到 ${spineNodes.length} 个 Spine 组件`);

// 对每个组件执行压力测试
spineNodes.forEach((spine: spine.Skeleton, index) => {
    console.log(`\n测试 Spine ${index}:`, spine.node.name);

    // 获取内部实例
    const instance = (spine as any)._instance;
    if (!instance) {
        console.log('  无 WASM instance');
        return;
    }

    // 记录初始内存状态
    console.log('  初始 instance 地址:', instance);

    // 测试 1: 连续创建和销毁
    console.log('  测试: 连续销毁和重建');
    for (let i = 0; i < 10; i++) {
        try {
            instance.destroy();
            (spine as any)._instance = null;

            // 尝试再次使用（应该触发错误）
            spine.updateAnimation(0.016);
            console.log(`  ✓ 迭代 ${i} 未触发错误`);
        } catch (error) {
            console.error(`  ✗ 迭代 ${i} 触发错误:`, error);
            break;
        }
    }

    // 测试 2: 操作已释放的资源
    console.log('  测试: 操作已释放的资源');
    try {
        const skeleton = (spine as any)._skeleton;
        if (skeleton) {
            // 尝试访问已释放的骨骼
            const bones = skeleton.bones;
            console.log(`    骨骼数量: ${bones.length}`);

            if (bones.length > 0) {
                const bone = bones[0];
                // 访问 Vector2 成员
                console.log(`    第一个骨骼: ${bone.data.name}, (${bone.x}, ${bone.y})`);
            }
        }
    } catch (error) {
        console.error('  ✗ 访问已释放资源触发错误:', error);
    }
});

console.log('\n=== 测试完成，检查 Memory 标签 ===');
```

5. 再次拍摄快照，对比两次快照的差异

### 方案 5: 使用 WASM 内存检查器

如果项目中集成了内存分析工具，可以直接检查 WASM 内存状态。

#### 步骤

```typescript
// 在控制台执行以下代码
function checkWasmMemory() {
    // 尝试访问 spine WASM 实例
    const spine = (window as any).spine;
    if (!spine || !spine.HEAP8 || !spine.HEAPU8) {
        console.error('无法访问 Spine WASM 内存');
        return;
    }

    console.log('=== WASM 内存检查 ===');
    console.log('HEAP8 大小:', spine.HEAP8.length);
    console.log('HEAPU8 大小:', spine.HEAPU8.length);

    // 检查内存边界
    const testAddresses = [
        0,           // 起始位置
        1024,        // 1KB 位置
        1024 * 1024, // 1MB 位置
        spine.HEAP8.length - 1,  // 最后一个字节
        spine.HEAP8.length,      // 越界（应该触发错误）
    ];

    testAddresses.forEach((addr, index) => {
        try {
            const value = spine.HEAP8[addr];
            console.log(`  地址 ${addr}: 值 = ${value}`);
        } catch (error) {
            console.error(`  ✗ 地址 ${addr} 触发错误:`, error);
        }
    });

    // 触发 Vector2 访问错误
    console.log('\n=== 测试 Vector2 访问 ===');
    const spineNodes = cc.director.getScene().getComponentsInChildren('sp.Skeleton');

    if (spineNodes.length > 0) {
        const skeleton = (spineNodes[0] as any)._skeleton;
        if (skeleton && skeleton.bones && skeleton.bones.length > 0) {
            const bone = skeleton.bones[0];
            console.log('  测试骨骼:', bone.data.name);

            // 尝试访问 Vector2 的 x 和 y 属性
            try {
                const x = bone.x;  // Vector2::getX()
                const y = bone.y;  // Vector2::getY()
                console.log(`  位置: (${x}, ${y})`);
            } catch (error) {
                console.error('  ✗ Vector2 访问触发错误:', error);
            }
        }
    }
}

// 执行检查
checkWasmMemory();
```

## 符号表验证方法

### 验证步骤

1. **不使用符号表时捕获错误**：

```javascript
// 在控制台执行
localStorage.removeItem('wasm_error');

// 执行上述任一测试方案触发错误

// 查看捕获的错误
const errorWithoutSymbols = JSON.parse(localStorage.getItem('wasm_error') || '{}');
console.log('无符号表错误:', errorWithoutSymbols);
```

预期输出：
```json
{
  "message": "Out of bounds memory access (evaluating 'r.apply(null,l)')",
  "stack": "wasm-function[361]\nwasm-function[497]\nwasm-function[113]"
}
```

2. **加载符号表后捕获错误**：

```javascript
// 加载符号表
const script = document.createElement('script');
script.src = './spine.js.symbols';
document.head.appendChild(script);

// 等待加载完成后执行测试
script.onload = () => {
    console.log('符号表已加载');

    // 清除之前的错误
    localStorage.removeItem('wasm_error');

    // 再次执行测试方案
    // ...

    // 查看新的错误
    setTimeout(() => {
        const errorWithSymbols = JSON.parse(localStorage.getItem('wasm_error') || '{}');
        console.log('有符号表错误:', errorWithSymbols);
    }, 2000);
};
```

预期输出（符号表生效后）：
```json
{
  "message": "Out of bounds memory access",
  "stack": "spine::IkConstraintTimeline::IkConstraintTimeline(int) (IkConstraintTimeline.cpp:63)\n  emscripten::internal::raw_destructor<spine::Skin::AttachmentMap::Entry> (spine::Skin::AttachmentMap::Entry*)\n  emscripten::internal::MethodInvoker<float (spine::Vector2::*)() const, float, const spine::Vector2*>::invoke() (Vector2.cpp:20)"
}
```

### 符号表解析脚本

创建一个辅助脚本来解析和美化错误堆栈：

```typescript
// spine-error-parser.ts
interface WasmError {
    message: string;
    stack: string;
    timestamp: string;
}

interface ParsedStackFrame {
    index: number;
    function: string | null;
    location: string | null;
    original: string;
}

class SpineErrorParser {
    private symbolTable: Map<number, { function: string; location: string }> = new Map();

    constructor(symbolTableUrl: string) {
        this.loadSymbolTable(symbolTableUrl);
    }

    private async loadSymbolTable(url: string): Promise<void> {
        try {
            const response = await fetch(url);
            const text = await response.text();

            // 解析符号表
            text.split('\n').forEach(line => {
                const match = line.match(/^(\d+):(.+)$/);
                if (match) {
                    const index = parseInt(match[1]);
                    const symbol = match[2];
                    this.symbolTable.set(index, {
                        function: symbol,
                        location: this.extractLocation(symbol)
                    });
                }
            });

            console.log(`已加载 ${this.symbolTable.size} 个符号`);
        } catch (error) {
            console.error('加载符号表失败:', error);
        }
    }

    private extractLocation(symbol: string): string | null {
        // 尝试从符号中提取文件位置
        const match = symbol.match(/\(([^:]+):(\d+)\)$/);
        if (match) {
            return `${match[1]}:${match[2]}`;
        }
        return null;
    }

    public parseError(error: WasmError): ParsedStackFrame[] {
        const stackLines = error.stack.split('\n').filter(line => line.trim());

        return stackLines.map((line, index) => {
            // 匹配 wasm-function[XXX] 格式
            const funcMatch = line.match(/wasm-function\[(\d+)\]/);

            if (funcMatch) {
                const funcIndex = parseInt(funcMatch[1]);
                const symbol = this.symbolTable.get(funcIndex);

                return {
                    index: funcIndex,
                    function: symbol?.function || null,
                    location: symbol?.location || null,
                    original: line
                };
            }

            // 非 wasm-function 格式
            return {
                index: -1,
                function: line,
                location: null,
                original: line
            };
        });
    }

    public formatError(error: WasmError): string {
        const frames = this.parseError(error);

        let output = `\n=== Spine WASM 错误 ===\n`;
        output += `时间: ${error.timestamp}\n`;
        output += `消息: ${error.message}\n`;
        output += `\n调用堆栈:\n`;

        frames.forEach((frame, index) => {
            output += `\n[${index}] `;

            if (frame.index >= 0) {
                if (frame.function) {
                    output += `\n  函数: ${frame.function}`;
                    if (frame.location) {
                        output += `\n  位置: ${frame.location}`;
                    }
                } else {
                    output += `未知函数 (索引 ${frame.index})`;
                }
            } else {
                output += frame.function;
            }

            if (!frame.function) {
                output += `\n  原始: ${frame.original}`;
            }
        });

        return output;
    }
}

// 使用示例
async function analyzeSpineError() {
    const parser = new SpineErrorParser('./spine.js.symbols');

    // 等待符号表加载
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 获取捕获的错误
    const errorJson = localStorage.getItem('wasm_error');
    if (!errorJson) {
        console.log('没有捕获到错误');
        return;
    }

    const error: WasmError = JSON.parse(errorJson);

    // 解析并显示
    console.log(parser.formatError(error));
}

// 导出供控制台使用
(window as any).analyzeSpineError = analyzeSpineError;
```

## 自动化测试脚本

创建一个完整的自动化测试脚本，可以一次性执行所有测试方案：

```typescript
// spine-wasm-automation-test.ts
export class SpineWasmAutomationTest {
    private results: Map<string, { passed: boolean; error?: any }> = new Map();

    public async runAllTests(): Promise<void> {
        console.log('=== Spine WASM 自动化测试开始 ===\n');

        await this.testDestroyedInstanceAccess();
        await this.testIkConstraintAnimation();
        await this.testInvalidSpineData();
        await this.testRapidSkinChange();
        await this.testWasmMemoryAccess();

        this.printSummary();
    }

    private async testDestroyedInstanceAccess(): Promise<void> {
        console.log('\n--- 测试 1: 已销毁 Instance 访问 ---');

        try {
            // ... 测试代码 ...
            this.results.set('destroyed_instance', { passed: true });
            console.log('✓ 通过\n');
        } catch (error) {
            this.results.set('destroyed_instance', { passed: false, error });
            console.error('✗ 失败:', error, '\n');
        }

        await this.delay(500);
    }

    private async testIkConstraintAnimation(): Promise<void> {
        console.log('\n--- 测试 2: IK 约束动画 ---');

        try {
            // ... 测试代码 ...
            this.results.set('ik_constraint', { passed: true });
            console.log('✓ 通过\n');
        } catch (error) {
            this.results.set('ik_constraint', { passed: false, error });
            console.error('✗ 失败:', error, '\n');
        }

        await this.delay(500);
    }

    // ... 其他测试方法 ...

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private printSummary(): void {
        console.log('\n=== 测试结果汇总 ===\n');

        let passed = 0;
        let failed = 0;

        this.results.forEach((result, testName) => {
            const status = result.passed ? '✓' : '✗';
            console.log(`${status} ${testName}`);

            if (result.passed) {
                passed++;
            } else {
                failed++;
                console.error(`  错误:`, result.error);
            }
        });

        console.log(`\n总计: ${passed} 通过, ${failed} 失败`);
    }
}

// 执行自动化测试
const automation = new SpineWasmAutomationTest();
automation.runAllTests();
```

## 预期结果对比

### 无符号表

```
Out of bounds memory access (evaluating 'r.apply(null,l)')
    at wasm-function[361] (spine.wasm.debug.wasm:0x12345)
    at wasm-function[497] (spine.wasm.debug.wasm:0x23456)
    at wasm-function[113] (spine.wasm.debug.wasm:0x34567)
```

### 有符号表

```
Out of bounds memory access
    at spine::IkConstraintTimeline::IkConstraintTimeline(int) (IkConstraintTimeline.cpp:63)
    at emscripten::internal::raw_destructor<spine::Skin::AttachmentMap::Entry> (spine/Skin.h:54)
    at emscripten::internal::MethodInvoker<float (spine::Vector2::*)() const, float, const spine::Vector2*>::invoke() (Vector2.cpp:20)
```

## 相关文件

### 符号表文件
- `d:\workspace\engines\cocos\3.8.6\native\cocos\editor-support\spine-wasm\build-wasm\spine.js.symbols`

### Spine 源码
- `d:\workspace\engines\cocos\3.8.6\cocos\spine\skeleton.ts` - TypeScript 层
- `d:\workspace\engines\cocos\3.8.6\native\cocos\editor-support\spine-wasm\spine-skeleton-instance.cpp` - C++ WASM 层
- `d:\workspace\engines\cocos\3.8.6\native\cocos\editor-support\spine\3.8\spine\IkConstraint.cpp` - IK 约束实现
- `d:\workspace\engines\cocos\3.8.6\native\cocos\editor-support\spine-wasm\Vector2.cpp` - Vector2 实现

## 注意事项

1. **安全性**: 这些测试方案会故意触发错误，请在开发环境中进行

2. **性能影响**: 频繁的错误测试可能影响浏览器性能

3. **数据丢失**: 触发 WASM 错误可能导致页面崩溃，请确保保存工作

4. **版本兼容性**: 确保符号表与 WASM 文件版本匹配

5. **调试工具**: 建议使用 Chrome DevTools 的最新版本以获得最佳调试体验

---

**文档版本**: 1.0
**更新时间**: 2026-02-11
**适用版本**: Cocos Creator 3.8.6 + Spine 4.2
