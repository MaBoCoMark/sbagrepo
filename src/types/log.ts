export type LogLevel =
  | 'info'
  | 'warn'
  | 'error'
  | 'fatal'
  | 'debug'
  | 'trace'
  | 'success'
  | 'unknown';

export interface ParsedLog {
  id: string;
  raw: string;
  level: LogLevel;
  tag?: string;       // 例如 [0309] 或 [0024]
  timing?: string;    // 例如 [3985730520 53ms]
  category?: string;  // 例如 outbound/vless[...]
  message: string;
  byteSize: number;
  timestamp: number;
}

export interface BufferStats {
  totalCount: number;
  totalBytes: number;
  maxBytes: number;
  formattedSize: string;
  formattedMaxSize: string;
  displayLimit: number;
  renderedCount: number;
  droppedCount: number;
}
