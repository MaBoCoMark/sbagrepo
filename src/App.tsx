import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider, BaseStyles, Box, UnderlineNav } from '@primer/react';
import {
  TerminalIcon,
  SlidersIcon,
  FileCodeIcon,
} from '@primer/octicons-react';
import { Header } from './components/Header';
import { ActionToolbar } from './components/ActionToolbar';
import { StatusCard } from './components/StatusCard';
import { ConfigViewer } from './components/ConfigViewer';
import { LogBoard } from './components/LogBoard';
import {
  ConfigMeta,
  DefaultPaths,
  LogEntry,
  ProcessStatus,
} from './types';
import { parseSingBoxConfig } from './utils/configParser';
import {
  checkConfigCommand,
  getDefaultPaths,
  readConfigFile,
  setupLogListener,
  startAdminCommand,
  startNormalCommand,
  stopProcessCommand,
} from './utils/tauriBridge';

export const App: React.FC = () => {
  // Theme state
  const [colorMode, setColorMode] = useState<'day' | 'night'>('night');
  const [activeTab, setActiveTab] = useState<'console' | 'logs'>('console');

  // App Paths & Status
  const [paths, setPaths] = useState<DefaultPaths | null>(null);
  const [binaryPath, setBinaryPath] = useState<string>('');
  const [configPath, setConfigPath] = useState<string>('config.json');
  const [status, setStatus] = useState<ProcessStatus>('stopped');

  // Config & Logs
  const [rawConfig, setRawConfig] = useState<string>('{}');
  const [configMeta, setConfigMeta] = useState<ConfigMeta>({
    hasTun: false,
    mixedPort: null,
    socksPort: null,
    httpPort: null,
    logLevel: 'info',
    inboundCount: 0,
    outboundCount: 0,
    rulesCount: 0,
    isValid: true,
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // UI Feedback
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{
    type: 'success' | 'danger' | 'warning' | 'info';
    text: string;
  } | null>(null);

  // Helper to append a single log line
  const appendLog = useCallback((raw: string) => {
    const now = new Date();
    const timestamp = now.toTimeString().split(' ')[0];
    let level: LogEntry['level'] = 'info';

    const lower = raw.toLowerCase();
    if (lower.includes('error') || lower.includes('fatal') || lower.includes('panic')) {
      level = 'error';
    } else if (lower.includes('warn')) {
      level = 'warn';
    } else if (lower.includes('debug')) {
      level = 'debug';
    } else if (lower.includes('trace')) {
      level = 'trace';
    }

    const newEntry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp,
      level,
      message: raw,
      raw,
    };

    setLogs((prev) => [...prev.slice(-2000), newEntry]); // keep last 2000 lines
  }, []);

  // Initialize paths and read initial config
  const loadInitialData = useCallback(async () => {
    try {
      const defaultPaths = await getDefaultPaths();
      setPaths(defaultPaths);
      setBinaryPath(defaultPaths.binaryPath);
      setConfigPath(defaultPaths.configPath);

      const content = await readConfigFile(defaultPaths.configPath);
      setRawConfig(content);
      const parsed = parseSingBoxConfig(content);
      setConfigMeta(parsed.meta);
    } catch (e: any) {
      console.error('Failed to load initial data:', e);
    }
  }, []);

  useEffect(() => {
    loadInitialData();

    // Setup Tauri real-time event listener
    let cleanup: (() => void) | undefined;
    setupLogListener(
      (line) => {
        appendLog(line);
      },
      (newStatus) => {
        if (
          newStatus === 'running' ||
          newStatus === 'elevated' ||
          newStatus === 'stopped'
        ) {
          setStatus(newStatus as ProcessStatus);
        }
      }
    ).then((unlisten) => {
      cleanup = unlisten;
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, [appendLog, loadInitialData]);

  // Reload config file from disk
  const handleReloadConfig = async () => {
    setIsLoading(true);
    try {
      const content = await readConfigFile(configPath);
      setRawConfig(content);
      const parsed = parseSingBoxConfig(content);
      setConfigMeta(parsed.meta);
      setActionMessage({
        type: 'success',
        text: `已成功重新读取配置文件: ${configPath}`,
      });
    } catch (err: any) {
      setActionMessage({
        type: 'danger',
        text: `读取配置文件失败: ${err?.message || err}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Button 1: Check Config
  const handleCheckConfig = async () => {
    setIsLoading(true);
    setStatus('checking');
    setActionMessage(null);
    try {
      const result = await checkConfigCommand(binaryPath, configPath);
      setActionMessage({
        type: 'success',
        text: result,
      });
      appendLog(`[CHECK] ${result}`);
    } catch (err: any) {
      setActionMessage({
        type: 'danger',
        text: String(err),
      });
      appendLog(`[ERROR] 语法检查失败: ${err}`);
    } finally {
      setIsLoading(false);
      setStatus('stopped');
    }
  };

  // Button 2: Start Normal (Direct Run)
  const handleStartNormal = async () => {
    setIsLoading(true);
    setActionMessage(null);
    try {
      await startNormalCommand(binaryPath, configPath, (mockMsg) => {
        appendLog(mockMsg);
      });
      setStatus('running');
      setActionMessage({
        type: 'success',
        text: '🚀 sing-box 普通模式启动成功！正在监听连接并实时输出日志。',
      });
      appendLog(`[SYSTEM] sing-box started in normal mode. Config: ${configPath}`);
    } catch (err: any) {
      setStatus('stopped');
      setActionMessage({
        type: 'danger',
        text: `启动失败: ${err}`,
      });
      appendLog(`[FATAL] Normal start failed: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Button 3: Start Admin (Elevated Run)
  const handleStartAdmin = async () => {
    setIsLoading(true);
    setActionMessage(null);
    try {
      const result = await startAdminCommand(binaryPath, configPath);
      setStatus('elevated');
      setActionMessage({
        type: 'success',
        text: `🛡️ ${result}`,
      });
      appendLog(`[ADMIN] ${result}`);
    } catch (err: any) {
      setStatus('stopped');
      setActionMessage({
        type: 'danger',
        text: `提权启动失败: ${err}`,
      });
      appendLog(`[ERROR] Admin start failed: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Button 4: Stop Process
  const handleStopProcess = async () => {
    setIsLoading(true);
    try {
      const result = await stopProcessCommand();
      setStatus('stopped');
      setActionMessage({
        type: 'info',
        text: result,
      });
      appendLog(`[STOP] ${result}`);
    } catch (err: any) {
      setActionMessage({
        type: 'danger',
        text: `停止进程出错: ${err}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemeProvider colorMode={colorMode} dayScheme="light" nightScheme="dark">
      <BaseStyles>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            width: '100vw',
            bg: 'canvas.default',
            color: 'fg.default',
            overflow: 'hidden',
          }}
        >
          {/* Top Header */}
          <Header
            colorMode={colorMode}
            onToggleTheme={() =>
              setColorMode((prev) => (prev === 'day' ? 'night' : 'day'))
            }
            status={status}
            paths={paths}
          />

          {/* Tab Navigation (Primer React UnderlineNav) */}
          <Box sx={{ px: 4, pt: 2, bg: 'canvas.subtle', borderBottom: '1px solid', borderColor: 'border.default' }}>
            <UnderlineNav aria-label="SingBox Main Navigation">
              <UnderlineNav.Item
                icon={SlidersIcon}
                aria-current={activeTab === 'console' ? 'page' : undefined}
                onSelect={(e) => {
                  e.preventDefault();
                  setActiveTab('console');
                }}
              >
                控制台与配置 (Console & Config)
              </UnderlineNav.Item>
              <UnderlineNav.Item
                icon={TerminalIcon}
                counter={logs.length}
                aria-current={activeTab === 'logs' ? 'page' : undefined}
                onSelect={(e) => {
                  e.preventDefault();
                  setActiveTab('logs');
                }}
              >
                实时日志看板 (Live Logs)
              </UnderlineNav.Item>
            </UnderlineNav>
          </Box>

          {/* Main Body Content */}
          <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 4 }}>
            {/* Page 1: Console and Config Viewer */}
            {activeTab === 'console' && (
              <Box sx={{ maxWidth: '1200px', mx: 'auto' }}>
                <ActionToolbar
                  status={status}
                  binaryPath={binaryPath}
                  configPath={configPath}
                  onBinaryPathChange={setBinaryPath}
                  onConfigPathChange={setConfigPath}
                  onCheckConfig={handleCheckConfig}
                  onStartNormal={handleStartNormal}
                  onStartAdmin={handleStartAdmin}
                  onStopProcess={handleStopProcess}
                  onReloadConfig={handleReloadConfig}
                  isActionLoading={isLoading}
                  actionMessage={actionMessage}
                  onDismissMessage={() => setActionMessage(null)}
                />

                <StatusCard meta={configMeta} />

                <ConfigViewer
                  rawJson={rawConfig}
                  meta={configMeta}
                  configPath={configPath}
                />
              </Box>
            )}

            {/* Page 2: Real-time Live Log Board */}
            {activeTab === 'logs' && (
              <Box sx={{ maxWidth: '1200px', mx: 'auto', height: '100%' }}>
                <LogBoard
                  logs={logs}
                  onClearLogs={() => setLogs([])}
                  isRunning={status === 'running' || status === 'elevated'}
                />
              </Box>
            )}
          </Box>
        </Box>
      </BaseStyles>
    </ThemeProvider>
  );
};
