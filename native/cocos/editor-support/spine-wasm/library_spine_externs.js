var globalThis = {};
globalThis.TrackEntryListeners = {};
globalThis.TrackEntryListeners.emitListener = function() {};
globalThis.TrackEntryListeners.emitTrackEntryListener = function() {};

var SpineWasmUtil = {};
SpineWasmUtil.getCurrentListenerID = function() {};
SpineWasmUtil.getCurrentTrackEntry = function() {};
SpineWasmUtil.getCurrentEvent = function() {};
SpineWasmUtil.getCurrentEventType = function() {};

/**
 * 保护内存导出函数不被 Closure Compiler 压缩
 */

/** @expose */
getSpineMemoryInfo;

/**
 * 保护 Module 对象及其属性不被压缩
 * Closure Compiler 会将 Module 压缩成短变量名，导致 post-js 无法访问
 * 使用 @expose 并指定公开名称来保持原名
 */

/** @expose */
Module._sbrk;

/** @expose */
Module.___heap_base;

/** @expose */
Module.HEAP8;

/** @expose */
Module.getSpineMemoryInfo;
