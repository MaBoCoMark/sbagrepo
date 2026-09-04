export type UserAgentType = 'sing-box' | 'clash-verge';

export interface SubscriptionUserInfo {
  upload?: number;
  download?: number;
  total?: number;
  expire?: number | null;
}

export interface SubscriptionItem {
  id: string;
  prefix: string;
  url: string;
  userAgentType: UserAgentType;
  userAgentString: string;
  filename: string;
  format: 'json' | 'yaml';
  lastUpdated: string;
  content: string;
  userInfo: SubscriptionUserInfo | null;
  rawHeaders?: Record<string, string>;
  srsCompiledDate?: string | null;
}

export interface JsonPathMatch {
  path: string;
  key: string;
  value: any;
  valuePreview: string;
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
}

export interface ExportedPathEntry {
  path: string;
  type: string;
  itemCount?: number;
  preview: string;
  extractedSnippet?: any;
}

export interface JsonValidationError {
  message: string;
  line?: number;
  column?: number;
  rawContent: string;
}

export interface FetchSubscriptionResult {
  success: boolean;
  content?: string;
  userInfo?: SubscriptionUserInfo | null;
  rawHeaders?: Record<string, string>;
  error?: string;
  invalidJson?: boolean;
  validationError?: JsonValidationError;
}
