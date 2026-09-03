/**
 * 应用全局启动与全局异常捕获初始化
 */
export function setupGlobalErrorHandlers(): void {
  console.log('==================================================');
  console.log('  sing-box Desktop 前端控制台初始化');
  console.log('==================================================');

  window.addEventListener('error', (event) => {
    console.error('[singbox-desktop][Webview Error]', event.error || event.message, event);
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[singbox-desktop][Webview Unhandled Rejection]', event.reason);
  });
}
