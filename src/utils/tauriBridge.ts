import { DefaultPaths } from '../types';

// Check if running inside Tauri webview
export function isTauriEnvironment(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
  );
}

// Dynamically import Tauri invoke
async function getInvoke() {
  if (isTauriEnvironment()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke;
  }
  return null;
}

// Dynamically import Tauri listen
export async function setupLogListener(
  onLog: (line: string) => void,
  onStatus?: (status: string) => void
): Promise<() => void> {
  if (isTauriEnvironment()) {
    try {
      const { listen } = await import('@tauri-apps/api/event');

      const unlistenLog = await listen<string>('log-message', (event) => {
        onLog(event.payload);
      });

      let unlistenStatus: (() => void) | undefined;
      if (onStatus) {
        unlistenStatus = await listen<string>('process-status', (event) => {
          onStatus(event.payload);
        });
      }

      return () => {
        unlistenLog();
        if (unlistenStatus) unlistenStatus();
      };
    } catch (e) {
      console.warn('Failed to setup Tauri event listener:', e);
    }
  }

  // Fallback for web preview mode
  console.log('[TauriBridge] Running in simulated web browser mode.');
  return () => {};
}

export async function checkConfigCommand(
  binaryPath?: string,
  configPath?: string
): Promise<string> {
  const invoke = await getInvoke();
  if (invoke) {
    return await invoke<string>('check_config', {
      binaryPath: binaryPath || null,
      configPath: configPath || null,
    });
  }

  // Web fallback simulation
  await new Promise((r) => setTimeout(r, 600));
  return '✅ [Simulated] sing-box configuration syntax check passed!';
}

export async function startNormalCommand(
  binaryPath?: string,
  configPath?: string,
  mockLogCallback?: (msg: string) => void
): Promise<void> {
  const invoke = await getInvoke();
  if (invoke) {
    await invoke('start_normal', {
      binaryPath: binaryPath || null,
      configPath: configPath || null,
    });
    return;
  }

  // Web simulation
  if (mockLogCallback) {
    mockLogCallback('[INFO] [Web Mode] sing-box mock starting in direct mode...');
    mockLogCallback(`[INFO] Config path: ${configPath || 'config.json'}`);
    mockLogCallback('[INFO] inbound/mixed[mixed-in]: listening on 127.0.0.1:2080');
    mockLogCallback('[INFO] router: ready to handle routing rules');
  }
}

export async function startAdminCommand(
  binaryPath?: string,
  configPath?: string
): Promise<string> {
  const invoke = await getInvoke();
  if (invoke) {
    return await invoke<string>('start_admin', {
      binaryPath: binaryPath || null,
      configPath: configPath || null,
    });
  }

  // Web simulation
  await new Promise((r) => setTimeout(r, 800));
  return '✅ [Simulated] Admin elevation prompt simulated successfully.';
}

export async function stopProcessCommand(): Promise<string> {
  const invoke = await getInvoke();
  if (invoke) {
    return await invoke<string>('stop_process');
  }

  // Web simulation
  return '🛑 [Simulated] sing-box process stopped.';
}

export async function getDefaultPaths(): Promise<DefaultPaths> {
  const invoke = await getInvoke();
  if (invoke) {
    try {
      return await invoke<DefaultPaths>('get_default_paths');
    } catch (e) {
      console.warn('Failed to call get_default_paths:', e);
    }
  }

  // Web simulation default
  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent);
  return {
    binaryPath: isMac
      ? 'src-tauri/binaries/sing-box-aarch64-apple-darwin'
      : 'src-tauri/binaries/sing-box-x86_64-pc-windows-msvc.exe',
    configPath: 'config.json',
    os: isMac ? 'macos' : 'windows',
    arch: isMac ? 'aarch64' : 'x86_64',
  };
}

export async function readConfigFile(path?: string): Promise<string> {
  const invoke = await getInvoke();
  if (invoke) {
    return await invoke<string>('read_config_file', { path: path || null });
  }

  // Web fallback simulation
  const sample = await import('../assets/sample-config.json');
  return JSON.stringify(sample.default || sample, null, 2);
}
