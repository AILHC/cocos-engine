/**
 * Spine WASM 内存信息获取模块
 * 通过 --post-js 附加到编译输出
 * 执行时机：Emscripten Module 初始化之后
 */

// 定义 getSpineMemoryInfo 全局方法
/** @preserve */
function getSpineMemoryInfo() {
    // 访问已初始化的 Module
    const heapEnd = Module._sbrk ? Module._sbrk(0) : 0;
    const heapTotal = Module.HEAP8 ? Module.HEAP8.length : 0;

    return {
        heapUsed: heapEnd,
        heapTotal: heapTotal,
        heapFree: heapTotal - heapEnd,
        // 方便阅读的格式化输出
        get heapUsedMB() { return (this.heapUsed / 1024 / 1024).toFixed(2); },
        get heapTotalMB() { return (this.heapTotal / 1024 / 1024).toFixed(2); },
        get heapFreeMB() { return (this.heapFree / 1024 / 1024).toFixed(2); }
    };
}

// 挂载到全局对象
if (typeof globalThis !== 'undefined') {
    globalThis["getSpineMemoryInfo"] = getSpineMemoryInfo;
}

// 同时挂载到 Module 上，方便通过 spine.wasmUtil.wasm 访问
if (typeof Module !== 'undefined') {
    Module["getSpineMemoryInfo"] = getSpineMemoryInfo;
}

console.log('[Spine] getSpineMemoryInfo 已注册');
