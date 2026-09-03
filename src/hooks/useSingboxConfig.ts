import { useState, useEffect, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  BinaryStatusInfo,
  EnvDetectionResult,
  InboundProxyType,
  RunningMode,
  UnexpectedExitPayload,
} from '../types/singbox';

export function detectInboundType(configContent: string): InboundProxyType {
  if (!configContent || !configContent.trim()) {
    return 'Mixed';
  }
  try {
    const parsed = JSON.parse(configContent);
    const inbounds = Array.isArray(parsed.inbounds) ? parsed.inbounds : [];
    const hasMixed = inbounds.some((ib: any) => ib.type === 'mixed' || ib.tag === 'mixed-in');
    const hasHttp = inbounds.some((ib: any) => ib.type === 'http');
    const hasSocks = inbounds.some((ib: any) => ib.type === 'socks');

    if (hasMixed || (hasHttp && hasSocks)) {
      return 'Mixed';
    }
    if (hasHttp && !hasSocks) {
      return 'HTTP only';
    }
    if (hasSocks && !hasHttp) {
      return 'SOCKS5 only';
    }
    return 'Mixed';
  } catch {
    return 'Mixed';
  }
}

export interface UseSingboxConfigReturn {
  binaryPath: string;
  setBinaryPath: (path: string) => void;
  configPath: string;
  setConfigPath: (path: string) => void;
  configContent: string;
  setConfigContent: (content: string) => void;
  runningMode: RunningMode;
  setRunningMode: (mode: RunningMode) => void;
  isLoadingConfig: boolean;
  loadConfig: (targetConfigPath?: string) => Promise<void>;
  handleAutoDetect: () => Promise<EnvDetectionResult | null>;
  // 核心导入与内核状态
  binaryStatus: BinaryStatusInfo | null;
  checkBinaryStatus: () => Promise<BinaryStatusInfo | null>;
  importConfigFile: (rawText: string) => Promise<string>;
  importBinaryFile: (base64Data: string) => Promise<BinaryStatusInfo>;
  // 运行时端口与日志级别临时覆盖 (Temporary Overrides)
  originalPort: number | string;
  originalLogLevel: string;
  overridePort: number | null;
  overrideLogLevel: string | null;
  effectivePort: number | string;
  effectiveLogLevel: string;
  isPortOverridden: boolean;
  isLogLevelOverridden: boolean;
  setOverridePort: (port: number | null) => void;
  revertPort: () => void;
  setOverrideLogLevel: (level: string | null) => void;
  revertLogLevel: () => void;
  // 托盘代理类型与意外退出监控
  inboundProxyType: InboundProxyType;
  unexpectedExit: UnexpectedExitPayload | null;
  clearUnexpectedExit: () => void;
}

const STORAGE_PORT_KEY = 'singbox_override_port';
const STORAGE_LOG_LEVEL_KEY = 'singbox_override_loglevel';

export function useSingboxConfig(): UseSingboxConfigReturn {
  const isMac = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('mac');
  const defaultBinaryName = isMac
    ? 'sing-box-aarch64-apple-darwin'
    : 'sing-box-x86_64-pc-windows-msvc.exe';

  const [binaryPath, setBinaryPath] = useState<string>(defaultBinaryName);
  const [configPath, setConfigPath] = useState<string>('config.json');
  const [configContent, setConfigContent] = useState<string>('{}');
  const [runningMode, setRunningMode] = useState<RunningMode>('stopped');
  const [isLoadingConfig, setIsLoadingConfig] = useState<boolean>(false);
  const [binaryStatus, setBinaryStatus] = useState<BinaryStatusInfo | null>(null);
  const [unexpectedExit, setUnexpectedExit] = useState<UnexpectedExitPayload | null>(null);

  // 初始化从 localStorage 读取临时覆盖状态
  const [overridePort, setInternalOverridePort] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PORT_KEY);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 1024 && parsed <= 65535) {
          return parsed;
        }
      }
    } catch {
      // 忽略存储错误
    }
    return null;
  });

  const [overrideLogLevel, setInternalOverrideLogLevel] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_LOG_LEVEL_KEY);
      if (saved) return saved.toLowerCase();
    } catch {
      // 忽略存储错误
    }
    return null;
  });

  // 解析配置文件本身的原始端口与原始日志级别
  const { originalPort, originalLogLevel } = useMemo(() => {
    if (!configContent || !configContent.trim()) {
      return { originalPort: 2080, originalLogLevel: 'info' };
    }
    try {
      const parsed = JSON.parse(configContent);
      const inbounds = Array.isArray(parsed.inbounds) ? parsed.inbounds : [];
      const mixedInbound =
        inbounds.find((ib: any) => ib.tag === 'mixed-in') ||
        inbounds.find((ib: any) => ib.type === 'mixed') ||
        inbounds[0];

      const port = mixedInbound?.listen_port ?? mixedInbound?.port ?? 2080;
      const level = (parsed.log?.level || 'info').toLowerCase();
      return { originalPort: port, originalLogLevel: level };
    } catch {
      return { originalPort: 2080, originalLogLevel: 'info' };
    }
  }, [configContent]);

  // 计算最终生效的端口与日志级别
  const effectivePort = overridePort !== null ? overridePort : originalPort;
  const effectiveLogLevel = overrideLogLevel !== null ? overrideLogLevel : originalLogLevel;

  // 判断是否与原始文件存在覆盖差异
  const isPortOverridden =
    overridePort !== null &&
    String(overridePort) !== String(originalPort) &&
    typeof originalPort === 'number';

  const isLogLevelOverridden =
    overrideLogLevel !== null &&
    overrideLogLevel.toLowerCase() !== originalLogLevel.toLowerCase();

  // 当前配置的入站代理协议类型 (Mixed / HTTP only / SOCKS5 only)
  const inboundProxyType = useMemo(() => {
    return detectInboundType(configContent);
  }, [configContent]);

  // 同步覆盖配置到 Rust 后端临时运行时文件 (runtime_config.json)
  const syncRuntimeOverride = useCallback(
    async (port: number | null, level: string | null) => {
      try {
        await invoke('save_runtime_override', {
          overridePort: port,
          overrideLogLevel: level,
        });
      } catch (err) {
        console.warn('[useSingboxConfig] 同步运行时覆盖配置失败:', err);
      }
    },
    []
  );

  const setOverridePort = useCallback(
    (port: number | null) => {
      setInternalOverridePort(port);
      if (port !== null) {
        try {
          localStorage.setItem(STORAGE_PORT_KEY, String(port));
        } catch {}
      } else {
        try {
          localStorage.removeItem(STORAGE_PORT_KEY);
        } catch {}
      }
      syncRuntimeOverride(port, overrideLogLevel);
    },
    [overrideLogLevel, syncRuntimeOverride]
  );

  const revertPort = useCallback(() => {
    console.log('[useSingboxConfig] 还原监听端口至原始配置:', originalPort);
    setOverridePort(null);
  }, [setOverridePort, originalPort]);

  const setOverrideLogLevel = useCallback(
    (level: string | null) => {
      const normalized = level ? level.toLowerCase() : null;
      setInternalOverrideLogLevel(normalized);
      if (normalized !== null) {
        try {
          localStorage.setItem(STORAGE_LOG_LEVEL_KEY, normalized);
        } catch {}
      } else {
        try {
          localStorage.removeItem(STORAGE_LOG_LEVEL_KEY);
        } catch {}
      }
      syncRuntimeOverride(overridePort, normalized);
    },
    [overridePort, syncRuntimeOverride]
  );

  const revertLogLevel = useCallback(() => {
    console.log('[useSingboxConfig] 还原日志级别至原始配置:', originalLogLevel);
    setOverrideLogLevel(null);
  }, [setOverrideLogLevel, originalLogLevel]);

  // 读取固定区域的配置文件 (默认 app_config_dir/config.json，不存在则生成空 JSON {})
  const loadConfig = useCallback(async (targetConfigPath?: string) => {
    setIsLoadingConfig(true);
    console.log('[useSingboxConfig] 正在从固定应用存储区加载配置文件...');
    try {
      const content = await invoke<string>('read_config_file', {
        configPath: targetConfigPath || null,
      });
      console.log(`[useSingboxConfig] 配置文件读取成功 (${content.length} 字节)`);
      setConfigContent(content.trim() ? content : '{}\n');
    } catch (err) {
      console.error('[useSingboxConfig] 读取配置文件失败:', err);
      try {
        const response = await fetch('/config.json');
        if (response.ok) {
          const text = await response.text();
          setConfigContent(text);
        } else {
          setConfigContent('{}');
        }
      } catch {
        setConfigContent('{}');
      }
    } finally {
      setIsLoadingConfig(false);
    }
  }, []);

  // 检查 sing-box 二进制内核是否已导入
  const checkBinaryStatus = useCallback(async (): Promise<BinaryStatusInfo | null> => {
    try {
      const res = await invoke<BinaryStatusInfo>('check_binary_status');
      console.log('[useSingboxConfig] 内核状态检测结果:', res);
      setBinaryStatus(res);
      if (res.imported) {
        setBinaryPath(res.binary_path);
      }
      return res;
    } catch (err) {
      console.warn('[useSingboxConfig] 检测二进制状态失败:', err);
      return null;
    }
  }, []);

  // 导入并持久化配置文件
  const importConfigFile = useCallback(
    async (rawText: string): Promise<string> => {
      console.log('[useSingboxConfig] 准备校验并导入用户上传的配置...');
      let parsedJson: any;
      try {
        parsedJson = JSON.parse(rawText);
      } catch (err: any) {
        throw new Error(`文件不是合法的 JSON 格式: ${err.message || String(err)}`);
      }

      try {
        const savedFormatted = await invoke<string>('import_config_file', {
          content: JSON.stringify(parsedJson, null, 2),
        });
        setConfigContent(savedFormatted);
        syncRuntimeOverride(overridePort, overrideLogLevel);
        return savedFormatted;
      } catch (err: any) {
        throw new Error(String(err));
      }
    },
    [overridePort, overrideLogLevel, syncRuntimeOverride]
  );

  // 导入可执行内核
  const importBinaryFile = useCallback(
    async (base64Data: string): Promise<BinaryStatusInfo> => {
      console.log('[useSingboxConfig] 准备导入可执行文件...');
      try {
        const res = await invoke<BinaryStatusInfo>('import_binary_file', {
          base64Content: base64Data,
        });
        setBinaryStatus(res);
        setBinaryPath(res.binary_path);
        return res;
      } catch (err: any) {
        throw new Error(String(err));
      }
    },
    []
  );

  const handleAutoDetect = useCallback(async () => {
    try {
      const result = await invoke<EnvDetectionResult>('detect_environment', {
        defaultBinary: defaultBinaryName,
        defaultConfig: configPath || 'config.json',
      });
      if (result.binary_found) {
        setBinaryPath(result.binary_path);
      }
      await checkBinaryStatus();
      await loadConfig();
      return result;
    } catch {
      await checkBinaryStatus();
      await loadConfig();
      return null;
    }
  }, [defaultBinaryName, configPath, checkBinaryStatus, loadConfig]);

  const clearUnexpectedExit = useCallback(() => {
    setUnexpectedExit(null);
  }, []);

  // 组件挂载时自动加载配置、检测二进制并同步覆盖状态
  useEffect(() => {
    loadConfig();
    checkBinaryStatus();
    if (overridePort !== null || overrideLogLevel !== null) {
      syncRuntimeOverride(overridePort, overrideLogLevel);
    }
  }, [loadConfig, checkBinaryStatus, overridePort, overrideLogLevel, syncRuntimeOverride]);

  // 监听后端 sing-box 进程退出事件
  useEffect(() => {
    let unlistenStopped: (() => void) | undefined;
    let unlistenUnexpected: (() => void) | undefined;

    const setupListeners = async () => {
      try {
        unlistenStopped = await listen('process-stopped', () => {
          setRunningMode('stopped');
        });
      } catch (err) {
        console.warn('[useSingboxConfig] 注册 process-stopped 监听器失败:', err);
      }

      try {
        unlistenUnexpected = await listen<UnexpectedExitPayload>(
          'process-unexpected-exit',
          (event) => {
            console.warn('[useSingboxConfig] 监测到内核意外退出:', event.payload);
            setRunningMode('stopped');
            setUnexpectedExit(event.payload);
          }
        );
      } catch (err) {
        console.warn('[useSingboxConfig] 注册 process-unexpected-exit 监听器失败:', err);
      }
    };
    setupListeners();

    return () => {
      if (unlistenStopped) unlistenStopped();
      if (unlistenUnexpected) unlistenUnexpected();
    };
  }, []);

  // 状态发生变化时，实时同步并更新系统托盘菜单
  useEffect(() => {
    const portStr = effectivePort ? String(effectivePort) : '-';
    invoke('update_tray_info', {
      mode: runningMode,
      port: portStr,
      proxyType: inboundProxyType,
    }).catch((err) => {
      console.debug('[useSingboxConfig] 同步更新托盘菜单信息:', err);
    });
  }, [runningMode, effectivePort, inboundProxyType]);

  return {
    binaryPath,
    setBinaryPath,
    configPath,
    setConfigPath,
    configContent,
    setConfigContent,
    runningMode,
    setRunningMode,
    isLoadingConfig,
    loadConfig,
    handleAutoDetect,
    binaryStatus,
    checkBinaryStatus,
    importConfigFile,
    importBinaryFile,
    originalPort,
    originalLogLevel,
    overridePort,
    overrideLogLevel,
    effectivePort,
    effectiveLogLevel,
    isPortOverridden,
    isLogLevelOverridden,
    setOverridePort,
    revertPort,
    setOverrideLogLevel,
    revertLogLevel,
    inboundProxyType,
    unexpectedExit,
    clearUnexpectedExit,
  };
}
