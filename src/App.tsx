import React, { useState } from 'react';
import { ThemeProvider, BaseStyles, UnderlineNav } from '@primer/react';
import { GearIcon, TerminalIcon, KeyIcon } from '@primer/octicons-react';

import { Header } from './components/Header';
import { ActionToolbar } from './components/ActionToolbar';
import { StatusCard } from './components/StatusCard';
import { ConfigViewer } from './components/ConfigViewer';
import { LogBoard } from './components/LogBoard';
import { MitmPage } from './components/MitmPage';
import { useSingboxConfig } from './hooks/useSingboxConfig';
import { useLogBuffer } from './hooks/useLogBuffer';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'console' | 'logs' | 'mitm'>('console');

  // 配置与运行状态管理通过解耦的 Hook 封装
  const {
    binaryPath,
    configPath,
    configContent,
    runningMode,
    setRunningMode,
    isLoadingConfig,
    loadConfig,
    binaryStatus,
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
  } = useSingboxConfig();

  // 20MB 内存 FIFO 日志缓冲区管理 Hook
  const logBuffer = useLogBuffer();

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

              <UnderlineNav.Item
                aria-current={activeTab === 'mitm' ? 'page' : undefined}
                onSelect={(e) => {
                  e.preventDefault();
                  setActiveTab('mitm');
                }}
                icon={KeyIcon}
              >
                MITM 代理与证书
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
            {activeTab === 'console' && (
              <>
                <ActionToolbar
                  binaryPath={binaryPath}
                  configPath={configPath}
                  configContent={configContent}
                  runningMode={runningMode}
                  setRunningMode={setRunningMode}
                  onRefreshConfig={() => loadConfig()}
                  binaryStatus={binaryStatus}
                  onImportConfig={importConfigFile}
                  onImportBinary={importBinaryFile}
                />

                <StatusCard
                  configContent={configContent}
                  originalPort={originalPort}
                  effectivePort={effectivePort}
                  overridePort={overridePort}
                  isPortOverridden={isPortOverridden}
                  onOverridePort={setOverridePort}
                  onRevertPort={revertPort}
                  originalLogLevel={originalLogLevel}
                  effectiveLogLevel={effectiveLogLevel}
                  overrideLogLevel={overrideLogLevel}
                  isLogLevelOverridden={isLogLevelOverridden}
                  onOverrideLogLevel={setOverrideLogLevel}
                  onRevertLogLevel={revertLogLevel}
                />

                <ConfigViewer
                  configPath={configPath}
                  configContent={configContent}
                  onReload={() => loadConfig()}
                  isLoading={isLoadingConfig}
                />
              </>
            )}

            {activeTab === 'logs' && <LogBoard buffer={logBuffer} />}

            {activeTab === 'mitm' && <MitmPage singboxPort={effectivePort} />}
          </main>
        </div>
      </BaseStyles>
    </ThemeProvider>
  );
};

export default App;
