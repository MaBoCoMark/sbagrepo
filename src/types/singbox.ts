export interface EnvDetectionResult {
  binary_path: string;
  config_path: string;
  binary_found: boolean;
  config_found: boolean;
  cwd: string;
}

export interface BinaryStatusInfo {
  imported: boolean;
  binary_name: string;
  binary_path: string;
  file_size: number;
}

export type RunningMode = 'stopped' | 'normal' | 'admin';

export interface FeedbackState {
  type: 'success' | 'critical' | 'info' | 'warning';
  title: string;
  message: string;
}

export interface RuntimeOverrides {
  port: number | null;
  logLevel: string | null;
}

export interface UnexpectedExitPayload {
  code: number | null;
  message: string;
  mode: string;
  timestamp?: string;
}

export type InboundProxyType = 'Mixed' | 'HTTP only' | 'SOCKS5 only';
