import React, { useState, useEffect, useRef } from 'react';
import { Heading, Text, Button, Banner, Label, TextInput } from '@primer/react';
import {
  KeyIcon,
  ShieldCheckIcon,
  ServerIcon,
  UploadIcon,
  CheckCircleIcon,
  XCircleIcon,
  TrashIcon,
  SyncIcon,
  LockIcon,
  ShieldIcon,
} from '@primer/octicons-react';
import { invoke } from '@tauri-apps/api/core';
import { CertValidationResult, MitmStatus, ValidationStep } from '../types/mitm';

interface MitmPageProps {
  singboxPort: number | string;
}

export const MitmPage: React.FC<MitmPageProps> = ({ singboxPort }) => {
  const isMac = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('mac');

  // MITM 待命监听状态
  const [mitmStatus, setMitmStatus] = useState<MitmStatus>({
    enabled: false,
    port: null,
    is_macos: isMac,
    message: '未激活',
  });
  const [sniffedPort, setSniffedPort] = useState<number | null>(null);
  const [isSniffing, setIsSniffing] = useState<boolean>(false);
  const [isTogglingMitm, setIsTogglingMitm] = useState<boolean>(false);

  // CA 根证书状态
  const [existingCert, setExistingCert] = useState<CertValidationResult | null>(null);
  const [certFeedback, setCertFeedback] = useState<{
    type: 'success' | 'critical' | 'info';
    title: string;
    message: string;
  } | null>(null);

  // 证书导入表单状态
  const [importType, setImportType] = useState<'p12' | 'pem'>('p12');
  const [p12Base64, setP12Base64] = useState<string>('');
  const [p12Password, setP12Password] = useState<string>('');
  const [certPem, setCertPem] = useState<string>('');
  const [keyPem, setKeyPem] = useState<string>('');
  const [storeInKeychain, setStoreInKeychain] = useState<boolean>(true);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validationSteps, setValidationSteps] = useState<ValidationStep[]>([]);

  // 文件上传 Ref
  const p12FileInputRef = useRef<HTMLInputElement | null>(null);
  const certFileInputRef = useRef<HTMLInputElement | null>(null);
  const keyFileInputRef = useRef<HTMLInputElement | null>(null);

  const baseNumericPort = typeof singboxPort === 'number' ? singboxPort : parseInt(String(singboxPort), 10) || 2080;
  const defaultCandidatePort = baseNumericPort + 1 <= 65535 ? baseNumericPort + 1 : 65535;
  const currentTargetPort = sniffedPort || mitmStatus.port || defaultCandidatePort;

  // 查询现有 MITM 监听状态
  const refreshMitmStatus = async () => {
    try {
      const res = await invoke<MitmStatus>('get_mitm_status');
      setMitmStatus(res);
      if (res.port) {
        setSniffedPort(res.port);
      }
    } catch (err) {
      console.warn('[MitmPage] 查询 MITM 状态失败:', err);
    }
  };

  // 查询现有 CA 证书信息
  const refreshCertInfo = async () => {
    try {
      const res = await invoke<CertValidationResult | null>('get_ca_cert_info');
      setExistingCert(res);
    } catch (err) {
      console.warn('[MitmPage] 查询现有证书失败:', err);
    }
  };

  useEffect(() => {
    refreshMitmStatus();
    refreshCertInfo();
  }, []);

  // 执行端口嗅探: 尝试从当前 sing-box 监听端口 + 1 开始，依次递增直到找到可用端口
  const handleSniffPort = async () => {
    setIsSniffing(true);
    try {
      const foundPort = await invoke<number>('sniff_mitm_port', {
        basePort: baseNumericPort,
      });
      setSniffedPort(foundPort);
      setCertFeedback({
        type: 'success',
        title: '端口嗅探成功',
        message: `从基准端口 ${baseNumericPort} 递增探测，成功寻获未被占用的空闲端口: ${foundPort}。`,
      });
    } catch (err: any) {
      setCertFeedback({
        type: 'critical',
        title: '端口嗅探失败',
        message: String(err),
      });
    } finally {
      setIsSniffing(false);
    }
  };

  // 开启/关闭 MITM 待命监听服务
  const handleToggleMitm = async () => {
    setIsTogglingMitm(true);
    const targetEnable = !mitmStatus.enabled;
    const targetPort = currentTargetPort;

    try {
      const res = await invoke<MitmStatus>('toggle_mitm_listener', {
        enable: targetEnable,
        port: targetPort,
      });
      setMitmStatus(res);
      setCertFeedback({
        type: targetEnable ? 'success' : 'info',
        title: targetEnable ? 'MITM 待命监听已激活' : 'MITM 监听已关闭',
        message: targetEnable
          ? `Rust 后端已成功在 0.0.0.0:${targetPort} 绑定待命端口。未来 sing-box 命中拦截策略将无缝指向此端口。`
          : 'MITM 后端监听套接字已安全释放。',
      });
    } catch (err: any) {
      setCertFeedback({
        type: 'critical',
        title: '操作 MITM 监听失败',
        message: String(err),
      });
    } finally {
      setIsTogglingMitm(false);
    }
  };

  // 处理 P12 文件选择并转 Base64
  const handleP12FileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const commaIdx = result.indexOf(',');
      const b64 = commaIdx >= 0 ? result.slice(commaIdx + 1) : result;
      setP12Base64(b64);
    };
    reader.readAsDataURL(file);
  };

  // 处理证书 PEM 文件读取
  const handleCertFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCertPem(reader.result as string);
    };
    reader.readAsText(file);
  };

  // 处理私钥 PEM 文件读取
  const handleKeyFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setKeyPem(reader.result as string);
    };
    reader.readAsText(file);
  };

  // 提交 CA 证书验证与导入流水线
  const handleImportCert = async () => {
    setIsValidating(true);
    setValidationSteps([]);
    setCertFeedback(null);

    try {
      const payload = {
        import_type: importType,
        p12_base64: importType === 'p12' ? p12Base64 : undefined,
        p12_password: importType === 'p12' ? p12Password : undefined,
        cert_pem: importType === 'pem' ? certPem : undefined,
        key_pem: importType === 'pem' ? keyPem : undefined,
        store_in_keychain: storeInKeychain,
      };

      const res = await invoke<CertValidationResult>('import_ca_cert', { payload });
      setValidationSteps(res.steps);
      setExistingCert(res);
      setCertFeedback({
        type: 'success',
        title: 'CA 根证书验证并导入成功',
        message: `4 项安全性与资质检验全部通过！证书已保存至应用配置区 (ca.crt)，私钥已按策略妥善存储。`,
      });
    } catch (err: any) {
      setCertFeedback({
        type: 'critical',
        title: 'CA 证书校验导入失败',
        message: String(err),
      });
    } finally {
      setIsValidating(false);
    }
  };

  // 删除证书
  const handleDeleteCert = async () => {
    try {
      await invoke('delete_ca_cert');
      setExistingCert(null);
      setValidationSteps([]);
      setCertFeedback({
        type: 'info',
        title: 'CA 证书已清除',
        message: '根证书文件及配套私钥已从应用配置区完全移除。',
      });
    } catch (err: any) {
      setCertFeedback({
        type: 'critical',
        title: '删除证书失败',
        message: String(err),
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 顶部架构说明横幅 */}
      <div
        style={{
          padding: '16px 20px',
          backgroundColor: 'var(--bg-subtle, #f6f8fa)',
          borderRadius: '8px',
          border: '1px solid var(--border-default, #d0d7de)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              backgroundColor: 'var(--color-accent-subtle, #ddf4ff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <KeyIcon size={22} fill="var(--color-accent-fg, #0969da)" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Heading as="h2" style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>
                MITM 代理与证书管理
              </Heading>
              {isMac ? (
                <Label variant="accent" size="small">
                  macOS 原生硬件加密支持
                </Label>
              ) : (
                <Label variant="secondary" size="small">
                  macOS 专属特性 (当前为兼容模式)
                </Label>
              )}
            </div>
            <Text as="p" style={{ fontSize: '12px', color: 'var(--fg-muted, #656d76)', margin: '4px 0 0 0' }}>
              为将来的动态 HTTPS 证书签发与特定域名规则分流 (如 domain keyword: weibo.com) 提供待命端口与 CA 根证书底座。
            </Text>
          </div>
        </div>

        <div>
          <Label variant={mitmStatus.enabled ? 'success' : 'default'} size="large">
            {mitmStatus.enabled ? `● 待命监听中 (:${currentTargetPort})` : '○ MITM 服务未启动'}
          </Label>
        </div>
      </div>

      {certFeedback && (
        <Banner
          variant={certFeedback.type}
          title={certFeedback.title}
          description={
            <div style={{ whiteSpace: 'pre-wrap', fontSize: '12px', lineHeight: '1.5', marginTop: '4px' }}>
              {certFeedback.message}
            </div>
          }
          onDismiss={() => setCertFeedback(null)}
        />
      )}

      {/* 模块 1: MITM 待命监听端口管理与自动嗅探 */}
      <div
        style={{
          padding: '20px',
          backgroundColor: 'var(--bg-subtle, #f6f8fa)',
          borderRadius: '8px',
          border: '1px solid var(--border-default, #d0d7de)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ServerIcon size={18} fill="var(--fg-muted, #656d76)" />
            <Heading as="h3" style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>
              MITM 独立监听端口待命服务 (Port Sniffing & Listener)
            </Heading>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Button
              variant="default"
              size="small"
              leadingVisual={SyncIcon}
              onClick={handleSniffPort}
              loading={isSniffing}
              disabled={isSniffing || mitmStatus.enabled}
            >
              嗅探可用端口
            </Button>

            <Button
              variant={mitmStatus.enabled ? 'danger' : 'primary'}
              size="small"
              onClick={handleToggleMitm}
              loading={isTogglingMitm}
            >
              {mitmStatus.enabled ? '停止待命监听' : '开启待命监听'}
            </Button>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
          }}
        >
          <div
            style={{
              padding: '12px',
              backgroundColor: 'var(--bg-canvas, #ffffff)',
              borderRadius: '6px',
              border: '1px solid var(--border-default, #d0d7de)',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--fg-muted, #656d76)', fontWeight: 600 }}>
              sing-box 基础监听端口
            </div>
            <div style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'monospace', marginTop: '4px' }}>
              {singboxPort}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--fg-muted, #656d76)', marginTop: '4px' }}>
              主进程入站端口 (基准点)
            </div>
          </div>

          <div
            style={{
              padding: '12px',
              backgroundColor: 'var(--bg-canvas, #ffffff)',
              borderRadius: '6px',
              border: '1px solid var(--border-default, #d0d7de)',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--fg-muted, #656d76)', fontWeight: 600 }}>
              嗅探起始候选端口
            </div>
            <div style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'monospace', marginTop: '4px' }}>
              {defaultCandidatePort}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--fg-muted, #656d76)', marginTop: '4px' }}>
              sing-box 端口 + 1 起探测
            </div>
          </div>

          <div
            style={{
              padding: '12px',
              backgroundColor: 'var(--bg-canvas, #ffffff)',
              borderRadius: '6px',
              border: mitmStatus.enabled
                ? '1px solid var(--color-success, #1a7f37)'
                : '1px solid var(--border-default, #d0d7de)',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--fg-muted, #656d76)', fontWeight: 600 }}>
              当前分配 MITM 待命端口
            </div>
            <div
              style={{
                fontSize: '18px',
                fontWeight: 600,
                fontFamily: 'monospace',
                marginTop: '4px',
                color: mitmStatus.enabled ? 'var(--color-success, #1a7f37)' : 'inherit',
              }}
            >
              {currentTargetPort}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--fg-muted, #656d76)', marginTop: '4px' }}>
              {mitmStatus.enabled ? '● 正在监听 0.0.0.0' : '就绪待绑定'}
            </div>
          </div>
        </div>

        <Text as="p" style={{ fontSize: '12px', color: 'var(--fg-muted, #656d76)', margin: 0, lineHeight: 1.6 }}>
          端口分配机制说明：Rust 后端自动优先尝试 <code>sing-box 端口 + 1</code>。若被其他软件占用，则依次递增加 2、加 3
          直至 65535。一旦开启开关，Rust 后端将在该端口保持 <code>TcpListener</code> 处于守候状态。
        </Text>
      </div>

      {/* 模块 2: CA 根证书管理与 4 步安全性校验流水线 */}
      <div
        style={{
          padding: '20px',
          backgroundColor: 'var(--bg-subtle, #f6f8fa)',
          borderRadius: '8px',
          border: '1px solid var(--border-default, #d0d7de)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheckIcon size={18} fill="var(--fg-muted, #656d76)" />
            <Heading as="h3" style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>
              CA 根证书管理 (CA Certificate Management)
            </Heading>
          </div>

          {existingCert && (
            <Button
              variant="invisible"
              size="small"
              leadingVisual={TrashIcon}
              onClick={handleDeleteCert}
              style={{ color: 'var(--color-danger, #cf222e)' }}
            >
              删除现有 CA 证书
            </Button>
          )}
        </div>

        {/* 使用门槛声明 */}
        <Banner
          variant="info"
          title="CA 根证书使用门槛说明"
          description="本软件为保证纯净安全，不集成证书自动生成代码。用户必须自行提供已有根证书（如使用 OpenSSL 或 mkcert 预先生成）。支持导入 P12 (Base64 + 解密密钥) 或明文 PEM 格式。"
        />

        {/* 若已导入证书，展示详细卡片 */}
        {existingCert ? (
          <div
            style={{
              padding: '16px',
              backgroundColor: 'var(--bg-canvas, #ffffff)',
              borderRadius: '6px',
              border: '1px solid var(--border-default, #d0d7de)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircleIcon size={18} fill="var(--color-success, #1a7f37)" />
                <Text style={{ fontSize: '14px', fontWeight: 600 }}>CA 根证书已成功导入并生效</Text>
              </div>
              <Label variant="success" size="small">
                已就绪 (cA=TRUE)
              </Label>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '12px',
                fontSize: '12px',
              }}
            >
              <div>
                <span style={{ color: 'var(--fg-muted, #656d76)' }}>主题 (Subject):</span>
                <div style={{ fontFamily: 'monospace', marginTop: '2px', fontWeight: 600 }}>
                  {existingCert.subject}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--fg-muted, #656d76)' }}>签发者 (Issuer):</span>
                <div style={{ fontFamily: 'monospace', marginTop: '2px', fontWeight: 600 }}>
                  {existingCert.issuer}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--fg-muted, #656d76)' }}>密钥类型与算法:</span>
                <div style={{ fontFamily: 'monospace', marginTop: '2px', fontWeight: 600 }}>
                  {existingCert.key_algorithm}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--fg-muted, #656d76)' }}>私钥存储位置:</span>
                <div style={{ marginTop: '2px', fontWeight: 600, color: 'var(--color-accent-fg, #0969da)' }}>
                  {existingCert.key_storage}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--fg-muted, #656d76)' }}>公钥证书存储路径 (ca.crt):</span>
                <div style={{ fontFamily: 'monospace', marginTop: '2px', wordBreak: 'break-all' }}>
                  {existingCert.cert_path}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--fg-muted, #656d76)' }}>有效期范围:</span>
                <div style={{ fontFamily: 'monospace', marginTop: '2px' }}>
                  {existingCert.not_before} ~ {existingCert.not_after}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* 证书导入表单 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            backgroundColor: 'var(--bg-canvas, #ffffff)',
            borderRadius: '6px',
            border: '1px solid var(--border-default, #d0d7de)',
            padding: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <Text style={{ fontSize: '13px', fontWeight: 600 }}>
              {existingCert ? '重新导入或替换 CA 根证书' : '导入 CA 根证书'}
            </Text>

            {/* 格式切换开关 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Button
                variant={importType === 'p12' ? 'primary' : 'default'}
                size="small"
                onClick={() => setImportType('p12')}
              >
                P12 (Base64 + 密钥)
              </Button>
              <Button
                variant={importType === 'pem' ? 'primary' : 'default'}
                size="small"
                onClick={() => setImportType('pem')}
              >
                PEM 明文
              </Button>
            </div>
          </div>

          {/* 隐藏的上传选择器 */}
          <input
            type="file"
            ref={p12FileInputRef}
            onChange={handleP12FileUpload}
            style={{ display: 'none' }}
            accept=".p12,.pfx"
          />
          <input
            type="file"
            ref={certFileInputRef}
            onChange={handleCertFileUpload}
            style={{ display: 'none' }}
            accept=".crt,.cer,.pem"
          />
          <input
            type="file"
            ref={keyFileInputRef}
            onChange={handleKeyFileUpload}
            style={{ display: 'none' }}
            accept=".key,.pem"
          />

          {importType === 'p12' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--fg-muted, #656d76)' }}>
                    P12 Base64 编码数据 (可直接粘贴或上传 .p12 文件)
                  </label>
                  <Button
                    variant="invisible"
                    size="small"
                    leadingVisual={UploadIcon}
                    onClick={() => p12FileInputRef.current?.click()}
                    style={{ fontSize: '11px', height: '20px', padding: '0 4px' }}
                  >
                    从 .p12/.pfx 文件载入
                  </Button>
                </div>
                <textarea
                  value={p12Base64}
                  onChange={(e: any) => setP12Base64(e.target.value)}
                  placeholder="例如: MIIKuQIBAzCCCn8GCSqg6AgIIAA..."
                  rows={3}
                  style={{
                    width: '100%',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-default, #d0d7de)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--fg-muted, #656d76)', display: 'block', marginBottom: '4px' }}>
                  P12 解密密码 (Decryption Password)
                </label>
                <TextInput
                  type="password"
                  leadingVisual={LockIcon}
                  value={p12Password}
                  onChange={(e: any) => setP12Password(e.target.value)}
                  placeholder="若未设置密码可留空"
                  block
                />
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--fg-muted, #656d76)' }}>
                    公钥证书 PEM (包含 -----BEGIN CERTIFICATE-----)
                  </label>
                  <Button
                    variant="invisible"
                    size="small"
                    leadingVisual={UploadIcon}
                    onClick={() => certFileInputRef.current?.click()}
                    style={{ fontSize: '11px', height: '20px', padding: '0 4px' }}
                  >
                    上传 .crt/.pem
                  </Button>
                </div>
                <textarea
                  value={certPem}
                  onChange={(e: any) => setCertPem(e.target.value)}
                  placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                  rows={5}
                  style={{
                    width: '100%',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-default, #d0d7de)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--fg-muted, #656d76)' }}>
                    私钥 PEM (包含 -----BEGIN PRIVATE KEY-----)
                  </label>
                  <Button
                    variant="invisible"
                    size="small"
                    leadingVisual={UploadIcon}
                    onClick={() => keyFileInputRef.current?.click()}
                    style={{ fontSize: '11px', height: '20px', padding: '0 4px' }}
                  >
                    上传 .key/.pem
                  </Button>
                </div>
                <textarea
                  value={keyPem}
                  onChange={(e: any) => setKeyPem(e.target.value)}
                  placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                  rows={5}
                  style={{
                    width: '100%',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-default, #d0d7de)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          )}

          {/* 私钥存储策略偏好设置 */}
          <div
            style={{
              padding: '12px',
              backgroundColor: 'var(--bg-subtle, #f6f8fa)',
              borderRadius: '6px',
              border: '1px solid var(--border-default, #d0d7de)',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
              私钥存储策略 (Private Key Storage Policy)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="key_storage"
                  checked={storeInKeychain}
                  onChange={() => setStoreInKeychain(true)}
                />
                <ShieldIcon size={14} fill="var(--color-accent-fg, #0969da)" />
                <span>
                  <strong>存储至 macOS Keychain / Secure Enclave</strong> (默认推荐，通过苹果系统硬件加密安全隔离，绝不写磁盘明文)
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="key_storage"
                  checked={!storeInKeychain}
                  onChange={() => setStoreInKeychain(false)}
                />
                <LockIcon size={14} fill="var(--fg-muted, #656d76)" />
                <span>
                  <strong>允许以明文形式存储至应用配置目录</strong> (与 ca.crt、config.json 存放于同一目录 ca.key)
                </span>
              </label>
            </div>
          </div>

          {/* 4 步检验清单进度展示 */}
          {validationSteps.length > 0 && (
            <div
              style={{
                padding: '12px',
                backgroundColor: 'var(--bg-subtle, #f6f8fa)',
                borderRadius: '6px',
                border: '1px solid var(--border-default, #d0d7de)',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
                CA 证书 4 步安全性与资质验证进度清单:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {validationSteps.map((s) => (
                  <div key={s.step_number} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                    {s.passed ? (
                      <CheckCircleIcon size={16} fill="var(--color-success, #1a7f37)" />
                    ) : (
                      <XCircleIcon size={16} fill="var(--color-danger, #cf222e)" />
                    )}
                    <span style={{ fontWeight: 600, minWidth: '160px' }}>
                      步骤 {s.step_number}: {s.name}
                    </span>
                    <span style={{ color: s.passed ? 'var(--fg-default, #1f2328)' : 'var(--color-danger, #cf222e)' }}>
                      {s.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <Button
              variant="primary"
              leadingVisual={ShieldCheckIcon}
              onClick={handleImportCert}
              loading={isValidating}
              disabled={isValidating || (importType === 'p12' ? !p12Base64.trim() : !certPem.trim() || !keyPem.trim())}
            >
              执行 4 步校验并导入 CA 证书
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
