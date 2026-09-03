export interface MitmStatus {
  enabled: boolean;
  port: number | null;
  is_macos: boolean;
  message: string;
}

export interface ValidationStep {
  step_number: number;
  name: string;
  passed: boolean;
  message: string;
}

export interface CertValidationResult {
  success: boolean;
  subject: string;
  issuer: string;
  not_before: string;
  not_after: string;
  is_expired: boolean;
  is_ca: boolean;
  key_pair_matched: boolean;
  key_algorithm: string;
  key_storage: string;
  steps: ValidationStep[];
  cert_path: string;
  key_path?: string | null;
}

export interface ImportCertPayload {
  import_type: 'p12' | 'pem';
  p12_base64?: string;
  p12_password?: string;
  cert_pem?: string;
  key_pem?: string;
  store_in_keychain: boolean;
}
