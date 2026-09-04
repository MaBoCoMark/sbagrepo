import React, { useState } from 'react';
import { Heading, Text, Button, TextInput, Select, Banner } from '@primer/react';
import {
  ShareAndroidIcon,
  DownloadIcon,
  FileCodeIcon,
} from '@primer/octicons-react';
import { UserAgentType } from '../types/subscription';
import { UA_OPTIONS } from '../utils/subscription';
import { useSubscriptionManager } from '../hooks/useSubscriptionManager';
import { SubscriptionCard } from './SubscriptionCard';
import { RawContentModal } from './RawContentModal';

export const SubscriptionPage: React.FC = () => {
  const {
    subscriptions,
    isLoading,
    refreshingId,
    jsonValidationError,
    rawViewModal,
    fetchSubscription,
    refreshSubscription,
    updateSubscription,
    deleteSubscription,
    dismissJsonValidationError,
    openRawViewModal,
    closeRawViewModal,
  } = useSubscriptionManager();

  // 输入控制栏状态
  const [prefix, setPrefix] = useState<string>('');
  const [url, setUrl] = useState<string>('');
  const [userAgentType, setUserAgentType] = useState<UserAgentType>('sing-box');
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 获取按钮点击处理
  const handleFetch = async () => {
    setNetworkError(null);
    setSuccessMessage(null);

    const cleanPrefix = prefix.trim();
    const cleanUrl = url.trim();

    if (!cleanPrefix) {
      setNetworkError('前缀不能为空！请输入至多 6 个字符的前缀名称。');
      return;
    }
    if (cleanPrefix.length > 6) {
      setNetworkError('前缀不能超过 6 个字符！当前长度: ' + cleanPrefix.length);
      return;
    }
    if (!cleanUrl) {
      setNetworkError('请输入订阅 URL 链接！');
      return;
    }

    const res = await fetchSubscription(cleanPrefix, cleanUrl, userAgentType);

    if (res.success) {
      setSuccessMessage(
        `订阅 [${cleanPrefix}] 获取成功！文件已保存至 subscription/${cleanPrefix}.${
          userAgentType === 'sing-box' ? 'json' : 'yaml'
        }`
      );
      setPrefix('');
      setUrl('');
      setTimeout(() => setSuccessMessage(null), 4000);
    } else {
      if (!res.invalidJson) {
        setNetworkError(res.error || '获取订阅失败，请检查网络或服务商状态');
      }
    }
  };

  // 快捷测试辅助：模拟一个非法的 JSON 返回以验证错误处理机制
  const handleSimulateInvalidJson = async () => {
    setNetworkError(null);
    setSuccessMessage(null);
    const mockPrefix = prefix.trim() || 'ERR';
    const mockBadJson = `{\n  "log": { "level": "info" },\n  "outbounds": [\n    { "type": "direct" },\n    { "type": "hysteria2",\n  ]\n}`;
    await fetchSubscription(
      mockPrefix,
      'https://mock.invalid-json.internal/sub',
      'sing-box',
      mockBadJson,
      'upload=12345; download=67890; total=1000000; expire='
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 原文查看模态弹窗 (由点击“查看原文”触发) */}
      <RawContentModal
        isOpen={rawViewModal.isOpen}
        title={rawViewModal.title}
        content={rawViewModal.content}
        errorDetails={rawViewModal.errorDetails}
        onClose={closeRawViewModal}
      />

      {/* 页面标题说明栏 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShareAndroidIcon size={24} fill="var(--fg-accent, #0969da)" />
            <Heading as="h1" style={{ fontSize: '20px', margin: 0, fontWeight: 600 }}>
              订阅管理 (Subscription Management)
            </Heading>
          </div>
          <Text as="p" style={{ fontSize: '13px', color: 'var(--fg-muted, #656d76)', margin: 0 }}>
            集中管理多源订阅文件，支持 Sing-Box 与 Clash 客户端身份定制、用量监控、本地归档与 JSONPath 提取。
          </Text>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Button size="small" variant="invisible" onClick={handleSimulateInvalidJson} title="模拟返回损坏的 JSON 验证异常提示">
            模拟非法 JSON 报错
          </Button>
        </div>
      </div>

      {/* 核心添加输入栏：前缀 (最多6字) - URL - 下拉菜单 - 获取 */}
      <div
        style={{
          backgroundColor: 'var(--bg-canvas, #ffffff)',
          borderRadius: '8px',
          border: '1px solid var(--border-default, #d0d7de)',
          padding: '18px 20px',
          boxShadow: '0 1px 3px rgba(31, 35, 40, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text as="span" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--fg-default, #1f2328)' }}>
            添加新订阅 (Add Subscription)
          </Text>
          <Text as="span" style={{ fontSize: '12px', color: 'var(--fg-muted, #656d76)' }}>
            当前 User-Agent: <code>{UA_OPTIONS.find((o) => o.id === userAgentType)?.ua}</code>
          </Text>
        </div>

        {/* 紧凑单行输入条 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          {/* 1. 前缀输入框：最多 6 个字符，区分大小写 */}
          <div style={{ width: '130px' }}>
            <TextInput
              placeholder="Prefix"
              value={prefix}
              onChange={(e: any) => setPrefix(e.target.value.slice(0, 6))}
              maxLength={6}
              monospace
              block
              aria-label="订阅前缀"
            />
          </div>

          {/* 2. 减号分隔符 */}
          <Text
            as="span"
            style={{
              fontSize: '20px',
              fontWeight: 'bold',
              color: 'var(--fg-muted, #656d76)',
              userSelect: 'none',
            }}
          >
            -
          </Text>

          {/* 3. 输入 URL */}
          <div style={{ flex: 1, minWidth: '280px' }}>
            <TextInput
              placeholder="请输入订阅链接 URL (https://...)"
              value={url}
              onChange={(e: any) => setUrl(e.target.value)}
              block
              aria-label="订阅 URL"
            />
          </div>

          {/* 4. 下拉菜单：User Agent 选择 (不展示完整复杂字符串给用户) */}
          <div style={{ minWidth: '150px' }}>
            <Select
              value={userAgentType}
              onChange={(e: any) => setUserAgentType(e.target.value as UserAgentType)}
              block
              aria-label="User Agent 客户端选择"
            >
              {UA_OPTIONS.map((opt) => (
                <Select.Option key={opt.id} value={opt.id}>
                  {opt.label} ({opt.format.toUpperCase()})
                </Select.Option>
              ))}
            </Select>
          </div>

          {/* 5. 获取按钮 */}
          <Button
            variant="primary"
            onClick={handleFetch}
            loading={isLoading}
            leadingVisual={DownloadIcon}
          >
            获取
          </Button>
        </div>

        <Text as="div" style={{ fontSize: '11px', color: 'var(--fg-muted, #656d76)' }}>
          提示：前缀区分大小写，保存后将在应用配置目录下的 <code>subscription/</code> 文件夹中生成对应{' '}
          <code>{prefix.trim() || '前缀'}.{userAgentType === 'sing-box' ? 'json' : 'yaml'}</code> 文件。
        </Text>
      </div>

      {/* JSON 不合法告警条 (带“点击查看原文”与“我知道了”控制) */}
      {jsonValidationError && (
        <Banner
          variant="critical"
          title="⚠️ JSON 格式校验未通过 (JSON不合法)"
          description={
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              <div style={{ fontSize: '12px', lineHeight: '1.5' }}>
                服务商返回的内容未能通过严格 JSON 校验：
                <strong style={{ marginLeft: '4px' }}>{jsonValidationError.message}</strong>
                {jsonValidationError.line && jsonValidationError.column && (
                  <span style={{ marginLeft: '8px', color: 'var(--fg-muted, #656d76)' }}>
                    (定位: 第 {jsonValidationError.line} 行，第 {jsonValidationError.column} 列)
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Button
                  size="small"
                  variant="default"
                  onClick={() =>
                    openRawViewModal(
                      '订阅返回原文内容（JSON 格式不合法）',
                      jsonValidationError.rawContent,
                      `解析失败定位: 第 ${jsonValidationError.line || 1} 行，第 ${
                        jsonValidationError.column || 1
                      } 列。错误原因: ${jsonValidationError.message}`
                    )
                  }
                >
                  点击查看原文
                </Button>
                <Button size="small" variant="invisible" onClick={dismissJsonValidationError}>
                  我知道了
                </Button>
              </div>
            </div>
          }
          onDismiss={dismissJsonValidationError}
        />
      )}

      {/* 网络请求超时或一般报错提示 */}
      {networkError && (
        <Banner
          variant="critical"
          title="获取订阅失败"
          description={networkError}
          onDismiss={() => setNetworkError(null)}
        />
      )}

      {/* 操作成功提示 */}
      {successMessage && (
        <Banner
          variant="success"
          title="操作成功"
          description={successMessage}
          onDismiss={() => setSuccessMessage(null)}
        />
      )}

      {/* 已添加订阅卡片列表 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileCodeIcon size={16} fill="var(--fg-muted, #656d76)" />
            <Heading as="h2" style={{ fontSize: '16px', margin: 0, fontWeight: 600 }}>
              已管理订阅列表
            </Heading>
          </div>
        </div>

        {subscriptions.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              backgroundColor: 'var(--bg-subtle, #f6f8fa)',
              borderRadius: '8px',
              border: '1px dashed var(--border-default, #d0d7de)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <ShareAndroidIcon size={32} fill="var(--fg-muted, #656d76)" />
            <Text as="p" style={{ fontSize: '14px', color: 'var(--fg-muted, #656d76)', margin: 0 }}>
              暂未添加任何订阅配置。请在上方输入前缀与订阅链接并点击【获取】。
            </Text>
          </div>
        ) : (
          subscriptions.map((sub) => (
            <SubscriptionCard
              key={sub.id}
              subscription={sub}
              isRefreshing={refreshingId === sub.id}
              onRefresh={refreshSubscription}
              onUpdate={updateSubscription}
              onDelete={deleteSubscription}
            />
          ))
        )}
      </div>
    </div>
  );
};
