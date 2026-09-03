export type ProcessStatus = 'stopped' | 'running' | 'elevated' | 'checking';

export interface SingBoxInbound {
  type?: string;
  tag?: string;
  listen?: string;
  listen_port?: number;
  interface_name?: string;
  inet4_address?: string;
  auto_route?: boolean;
  strict_route?: boolean;
  stack?: string;
  [key: string]: any;
}

export interface SingBoxOutbound {
  type?: string;
  tag?: string;
  server?: string;
  server_port?: number;
  [key: string]: any;
}

export interface SingBoxConfig {
  log?: {
    level?: string;
    timestamp?: boolean;
    output?: string;
  };
  inbounds?: SingBoxInbound[];
  outbounds?: SingBoxOutbound[];
  route?: {
    auto_detect_interface?: boolean;
    rules?: any[];
    [key: string]: any;
  };
  experimental?: any;
  [key: string]: any;
}

export interface ConfigMeta {
  hasTun: boolean;
  mixedPort: number | null;
  socksPort: number | null;
  httpPort: number | null;
  logLevel: string;
  inboundCount: number;
  outboundCount: number;
  rulesCount: number;
  isValid: boolean;
  parseError?: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug' | 'trace';
  message: string;
  raw: string;
}

export interface DefaultPaths {
  binaryPath: string;
  configPath: string;
  os: 'macos' | 'windows' | 'linux';
  arch: string;
}
