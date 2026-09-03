import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { EnvDetectionResult, RunningMode } from '../types/singbox';

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
}

export function useSingboxConfig(): UseSingboxConfigReturn {
  const isMac = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('mac');
  const defaultBinary = isMac
    ? 'src-tauri/binaries/sing-box-aarch64-apple-darwin'
    : 'src-tauri/binaries/sing-box-x86_64-pc-windows-msvc.exe';

  const [binaryPath, setBinaryPath] = useState<string>(defaultBinary);
  const [configPath, setConfigPath] = useState<string>('config.json');
  const [configContent, setConfigContent] = useState<string>('');
  const [runningMode, setRunningMode] = useState<RunningMode>('stopped');
  const [isLoadingConfig, setIsLoadingConfig] = useState<boolean>(false);

  const loadConfig = useCallback(async (targetConfigPath?: string) => {
    const activePath = targetConfigPath || configPath;
    setIsLoadingConfig(true);
    console.log('[useSingboxConfig] 正在读取配置文件:', activePath);
    try {
      const content = await invoke<string>('read_config_file', { configPath: activePath });
      console.log(`[useSingboxConfig] 配置文件读取成功 (${content.length} 字节)`);
      setConfigContent(content);
    } catch (err) {
      console.error('[useSingboxConfig] 通过 Tauri 读取配置文件失败:', err);
      console.log('[useSingboxConfig] 尝试通过 HTTP fetch 作为后备方式获取 /config.json...');
      try {
        const response = await fetch('/config.json');
        if (response.ok) {
          const text = await response.text();
          console.log('[useSingboxConfig] HTTP fetch 读取 /config.json 成功');
          setConfigContent(text);
        } else {
          console.warn('[useSingboxConfig] HTTP fetch 返回状态码:', response.status);
        }
      } catch (fetchErr) {
        console.error('[useSingboxConfig] HTTP fetch 后备读取也失败:', fetchErr);
      }
    } finally {
      setIsLoadingConfig(false);
    }
  }, [configPath]);

  const handleAutoDetect = useCallback(async () => {
    console.log('[useSingboxConfig] 触发运行环境及文件路径自动探测...');
    try {
      const result = await invoke<EnvDetectionResult>('detect_environment', {
        defaultBinary,
        defaultConfig: configPath || 'config.json',
      });
      console.log('[useSingboxConfig] 环境探测结果:', result);

      if (result.binary_found) {
        console.log('[useSingboxConfig] 自动定位到 sing-box 可执行文件:', result.binary_path);
        setBinaryPath(result.binary_path);
      } else {
        console.warn('[useSingboxConfig] 未自动找到有效 sing-box 可执行文件，保留当前设置:', binaryPath);
      }

      if (result.config_found) {
        console.log('[useSingboxConfig] 自动定位到配置文件:', result.config_path);
        setConfigPath(result.config_path);
        loadConfig(result.config_path);
      } else {
        console.warn('[useSingboxConfig] 未自动找到配置文件，保留当前设置:', configPath);
        loadConfig(configPath);
      }
      return result;
    } catch (err) {
      console.error('[useSingboxConfig] 执行 detect_environment 出错:', err);
      loadConfig(configPath);
      return null;
    }
  }, [defaultBinary, configPath, binaryPath, loadConfig]);

  // 组件挂载时自动探测环境并加载配置
  useEffect(() => {
    handleAutoDetect();
  }, [handleAutoDetect]);

  // 监听后端 sing-box 进程退出事件
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const setupListener = async () => {
      try {
        console.log('[useSingboxConfig] 注册 process-stopped 事件监听器...');
        unlisten = await listen('process-stopped', () => {
          console.log('[useSingboxConfig] 收到 process-stopped 事件，将运行状态重置为 stopped');
          setRunningMode('stopped');
        });
      } catch (err) {
        console.warn('[useSingboxConfig] 注册 process-stopped 监听器失败 (非 Tauri 环境忽略):', err);
      }
    };
    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

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
  };
}
