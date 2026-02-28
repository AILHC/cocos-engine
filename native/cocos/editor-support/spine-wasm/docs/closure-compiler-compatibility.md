# Closure Compiler 与 spine-wasm 内存调试兼容性问题总结

## 问题现象

开启 `ENABLE_CLOSURE_COMPILER=1` 后：
- 执行 `Module._sbrk(0)` 报错 `.apply is undefined`
- 执行后 `Module._sbrk == undefined`
- `getSpineMemoryInfo()` 返回对象属性名被压缩（`heapUsed` → `pa`）

---

## 失败经验

### 1. 以为只是变量名压缩问题
- 最初认为只要在 externs 中声明 `Module._sbrk` 即可
- 实际：函数内部引用仍被压缩

### 2. 只保护函数名，没保护属性名
- 添加了 `/** @expose */ getSpineMemoryInfo`
- 结果：返回对象的属性 `heapUsed` 等仍被压缩为 `pa`, `qa`

### 3. Getter 内部引用被压缩
- 即使属性名用计算属性名 `["heapUsed"]`，getter 内的 `this.heapUsed` 仍被压缩为 `this.wa`

---

## 成功经验

### 修复方案

#### 1. library_spine_externs.js - 保护 Module 对象
```javascript
/** @expose */
getSpineMemoryInfo;

/** @expose */
Module._sbrk;

/** @expose */
Module.___heap_base;

/** @expose */
Module.HEAP8;

/** @expose */
Module.getSpineMemoryInfo;
```

#### 2. spine-memory-js.js - 使用计算属性名
```javascript
return {
    ["heapUsed"]: heapEnd,
    ["heapTotal"]: heapTotal,
    ["heapFree"]: heapTotal - heapEnd,
    get ["heapUsedMB"]() { return (this["heapUsed"] / 1024 / 1024).toFixed(2); },
    get ["heapTotalMB"]() { return (this["heapTotal"] / 1024 / 1024).toFixed(2); },
    get ["heapFreeMB"]() { return (this["heapFree"] / 1024 / 1024).toFixed(2); }
};
```

---

## 原理机制

### 1. Closure Compiler 压缩范围
- 变量名：`Module` → `f`
- 函数内局部变量
- 对象属性名（除非使用字符串字面量）

### 2. --post-js 执行时机
```
主代码 → Closure Compiler 压缩 → --post-js 附加
```

Post-js 代码在 Closure 之后执行，看不到主代码中压缩后的变量名。

### 3. @expose 作用
告诉 Closure Compiler 这些是外部可见的符号，不要压缩或重命名。

### 4. 计算属性名原理
```javascript
{ ["heapUsed"]: value }  // 字符串字面量，不被压缩
{ heapUsed: value }     // 标识符，会被压缩
```

---

## 之后怎么做

### 添加新 post-js 模块时
1. **保护函数**：在 externs 中添加 `/** @expose */ FunctionName;`
2. **保护对象**：在 externs 中添加 `/** @expose */ Module.ObjectName;`
3. **保护属性**：返回对象使用计算属性名 `["propertyName"]`
4. **保护引用**：内部使用 `this["propertyName"]` 而非 `this.propertyName`

### 验证方法
编译后检查 spine.js，确认：
- 关键函数名保持原名
- 返回对象属性保持原名
- 内部引用使用字符串访问

---

## 修改的文件

1. `library_spine_externs.js` - 添加 @expose 保护
2. `spine-memory-js.js` - 使用计算属性名
3. `CMakeLists.txt` - 强制开启 ENABLE_CLOSURE_COMPILER=1
