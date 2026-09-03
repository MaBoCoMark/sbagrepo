export interface EnvDetectionResult {
  binary_path: string;
  config_path: string;
  binary_found: boolean;
  config_found: boolean;
  cwd: string;
}

export type RunningMode = 'stopped' | 'normal' | 'admin';

export interface FeedbackState {
  type: 'success' | 'critical' | 'info' | 'warning';
  title: string;
  message: string;
}
