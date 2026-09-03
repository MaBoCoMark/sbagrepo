import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider, BaseStyles, UnderlineNav } from '@primer/react';
import { GearIcon, TerminalIcon } from '@primer/octicons-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

import { Header } from './components/Header';
import { ActionToolbar } from './components/ActionToolbar';
import { StatusCard } from './components/StatusCard';
import { ConfigViewer } from './components/ConfigViewer';
import { LogBoard } from './components/LogBoard';

interface EnvDetectionResult {
  binary_path: string;
  config_path: string;
  binary_found: boolean;
  config_found: boolean;
  cwd: string;
}

export const App: React.FC = () => {
  const isMac = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('mac');
  const defaultBinary = isMac
    ? 'src-tauri/binaries/sing-box-aarch64-apple-darwin'
    : 'src-tauri/binaries/sing-box-x86_64-pc-windows-msvc.exe';

  const [activeTab, setActiveTab] = useState<'console' | 'logs'>('console');
  const [binaryPath, setBinaryPath] = useState<string>(defaultBinary);
  const [configPath, setConfigPath] = useState<string>('config.json');
  const [configContent, setConfigContent] = useState<string>('');
  const [runningMode, setRunningMode] = useState<'stopped' | 'normal' | 'admin'>('stopped');
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoadingConfig, setIsLoadingConfig] = useState<boolean>(false);

  const loadConfig = useCallback(async (targetConfigPath?: string) => {
    const activePath = targetConfigPath || configPath;
    setIsLoadingConfig(true);
    console.log('[App] 正在读取配置文件:', activePath);
    try {
      const content = await invoke<string>('read_config_file', { configPath: activePath });
      console.log(`[App] 配置文件读取成功 (${content.length} 字节)`);
      setConfigContent(content);
    } catch (err) {
      console.error('[App] 通过 Tauri 读取配置文件失败:', err);
      console.log('[App] 尝试通过 HTTP fetch 作为后备方式获取 /config.json...');
      try {
        const response = await fetch('/config.json');
        if (response.ok) {
          const text = await response.text();
          console.log('[App] HTTP fetch 读取 /config.json 成功');
          setConfigContent(text);
        } else {
          console.warn('[App] HTTP fetch 返回状态码:', response.status);
        }
      } catch (fetchErr) {
        console.error('[App] HTTP fetch 后备读取也失败:', fetchErr);
      }
    } finally {
      setIsLoadingConfig(false);
    }
  }, [configPath]);

  const handleAutoDetect = useCallback(async () => {
    console.log('[App] 触发运行环境及文件路径自动探测...');
    try {
      const result = await invoke<EnvDetectionResult>('detect_environment', {
        defaultBinary,
        defaultConfig: configPath || 'config.json',
      });
      console.log('[App] 环境探测结果:', result);

      if (result.binary_found) {
        console.log('[App] 自动定位到 sing-box 可执行文件:', result.binary_path);
        setBinaryPath(result.binary_path);
      } else {
        console.warn('[App] 未自动找到有效 sing-box 可执行文件，保留当前设置:', binaryPath);
      }

      if (result.config_found) {
        console.log('[App] 自动定位到配置文件:', result.config_path);
        setConfigPath(result.config_path);
        loadConfig(result.config_path);
      } else {
        console.warn('[App] 未自动找到配置文件，保留当前设置:', configPath);
        loadConfig(configPath);
      }
      return result;
    } catch (err) {
      console.error('[App] 执行 detect_environment 出错:', err);
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
        console.log('[App] 注册 process-stopped 事件监听器...');
        unlisten = await listen('process-stopped', () => {
          console.log('[App] 收到 process-stopped 事件，将运行状态重置为 stopped');
          setRunningMode('stopped');
        });
      } catch (err) {
        console.warn('[App] 注册 process-stopped 监听器失败 (非 Tauri 环境忽略):', err);
      }
    };
    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  return (
    <ThemeProvider>
      <BaseStyles>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100vh',
            backgroundColor: 'var(--bg-canvas, #ffffff)',
          }}
        >
          <Header runningMode={runningMode} />

          <div
            style={{
              padding: '0 24px',
              borderBottom: '1px solid var(--border-default, #d0d7de)',
              backgroundColor: 'var(--bg-canvas, #ffffff)',
            }}
          >
            <UnderlineNav aria-label="Main Navigation">
              <UnderlineNav.Item
                aria-current={activeTab === 'console' ? 'page' : undefined}
                onSelect={(e) => {
                  e.preventDefault();
                  console.log('[Navigation] 切换到控制台与配置标签页');
                  setActiveTab('console');
                }}
                icon={GearIcon}
              >
                控制台与配置
              </UnderlineNav.Item>
              <UnderlineNav.Item
                aria-current={activeTab === 'logs' ? 'page' : undefined}
                onSelect={(e) => {
                  e.preventDefault();
                  console.log('[Navigation] 切换到实时日志看板标签页');
                  setActiveTab('logs');
                }}
                icon={TerminalIcon}
              >
                实时日志看板
              </UnderlineNav.Item>
            </UnderlineNav>
          </div>

          <main
            style={{
              flex: 1,
              padding: '24px',
              maxWidth: '1200px',
              width: '100%',
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}
          >
            {activeTab === 'console' ? (
              <>
                <ActionToolbar
                  binaryPath={binaryPath}
                  setBinaryPath={setBinaryPath}
                  configPath={configPath}
                  setConfigPath={setConfigPath}
                  runningMode={runningMode}
                  setRunningMode={setRunningMode}
                  onRefreshConfig={() => loadConfig(configPath)}
                  onAutoDetect={handleAutoDetect}
                />

                <StatusCard configContent={configContent} />

                <ConfigViewer
                  configPath={configPath}
                  configContent={configContent}
                  onReload={() => loadConfig(configPath)}
                  isLoading={isLoadingConfig}
                />
              </>
            ) : (
              <LogBoard logs={logs} setLogs={setLogs} />
            )}
          </main>
        </div>
      </BaseStyles>
    </ThemeProvider>
  );
};

export default App;
