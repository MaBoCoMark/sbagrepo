import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider, BaseStyles, UnderlineNav } from '@primer/react';
import { GearIcon, TerminalIcon } from '@primer/octicons-react';
import { invoke } from '@tauri-apps/api/core';

import { Header } from './components/Header';
import { ActionToolbar } from './components/ActionToolbar';
import { StatusCard } from './components/StatusCard';
import { ConfigViewer } from './components/ConfigViewer';
import { LogBoard } from './components/LogBoard';

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

  const loadConfig = useCallback(async () => {
    setIsLoadingConfig(true);
    try {
      const content = await invoke<string>('read_config_file', { configPath });
      setConfigContent(content);
    } catch (err) {
      console.warn('Unable to read config via Tauri command, attempting fetch fallback:', err);
      try {
        const response = await fetch('/config.json');
        if (response.ok) {
          const text = await response.text();
          setConfigContent(text);
        }
      } catch (fetchErr) {
        console.warn('Fetch fallback also failed:', fetchErr);
      }
    } finally {
      setIsLoadingConfig(false);
    }
  }, [configPath]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

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
                  onRefreshConfig={loadConfig}
                />

                <StatusCard configContent={configContent} />

                <ConfigViewer
                  configPath={configPath}
                  configContent={configContent}
                  onReload={loadConfig}
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
