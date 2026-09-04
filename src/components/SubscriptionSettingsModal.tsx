import React, { useState } from 'react';
import { Heading, Text, Button, TextInput, Select, FormControl } from '@primer/react';
import { GearIcon, TrashIcon, AlertIcon } from '@primer/octicons-react';
import { SubscriptionItem, UserAgentType } from '../types/subscription';
import { UA_OPTIONS } from '../utils/subscription';

interface SubscriptionSettingsModalProps {
  subscription: SubscriptionItem | null;
  onClose: () => void;
  onSave: (
    id: string,
    updates: { prefix?: string; url?: string; userAgentType?: UserAgentType }
  ) => void;
  onDelete: (id: string) => void;
}

export const SubscriptionSettingsModal: React.FC<SubscriptionSettingsModalProps> = ({
  subscription,
  onClose,
  onSave,
  onDelete,
}) => {
  if (!subscription) return null;

  const [prefix, setPrefix] = useState<string>(subscription.prefix);
  const [url, setUrl] = useState<string>(subscription.url);
  const [uaType, setUaType] = useState<UserAgentType>(subscription.userAgentType);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSave = () => {
    const cleanPrefix = prefix.trim();
    const cleanUrl = url.trim();

    if (!cleanPrefix) {
      setErrorMessage('前缀不能为空！');
      return;
    }
    if (cleanPrefix.length > 6) {
      setErrorMessage('前缀最多只能为 6 个字符！');
      return;
    }
    if (!cleanUrl) {
      setErrorMessage('订阅 URL 链接不能为空！');
      return;
    }

    setErrorMessage(null);
    onSave(subscription.id, {
      prefix: cleanPrefix,
      url: cleanUrl,
      userAgentType: uaType,
    });
    onClose();
  };

  const handleDelete = () => {
    onDelete(subscription.id);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(1, 4, 9, 0.72)',
        backdropFilter: 'blur(4px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: 'var(--bg-canvas, #ffffff)',
          borderRadius: '12px',
          border: '1px solid var(--border-default, #d0d7de)',
          boxShadow: '0 8px 24px rgba(140, 149, 159, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* 头部 */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-muted, #d8dee4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-subtle, #f6f8fa)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GearIcon size={18} fill="var(--fg-muted, #656d76)" />
            <Heading as="h3" style={{ fontSize: '16px', margin: 0, fontWeight: 600 }}>
              订阅设置 ({subscription.prefix})
            </Heading>
          </div>
          <Button size="small" variant="invisible" onClick={onClose}>
            ✕
          </Button>
        </div>

        {/* 表单主体 */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {errorMessage && (
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: 'var(--bgColor-danger-muted, #ffebe9)',
                border: '1px solid var(--borderColor-danger-muted, #ff8182)',
                borderRadius: '6px',
                color: 'var(--fg-danger, #cf222e)',
                fontSize: '12px',
              }}
            >
              {errorMessage}
            </div>
          )}

          {/* 前缀 */}
          <FormControl>
            <FormControl.Label>前缀 (Prefix，区分大小写，最多6个字符)</FormControl.Label>
            <TextInput
              value={prefix}
              onChange={(e: any) => setPrefix(e.target.value.slice(0, 6))}
              maxLength={6}
              monospace
              block
            />
            <FormControl.Caption>
              用于区分不同订阅出站与文件名 ({prefix.trim() || '前缀'}.
              {uaType === 'sing-box' ? 'json' : 'yaml'})
            </FormControl.Caption>
          </FormControl>

          {/* URL */}
          <FormControl>
            <FormControl.Label>订阅链接 (Subscription URL)</FormControl.Label>
            <TextInput
              value={url}
              onChange={(e: any) => setUrl(e.target.value)}
              placeholder="https://..."
              block
            />
          </FormControl>

          {/* User Agent */}
          <FormControl>
            <FormControl.Label>客户端类型 (User Agent)</FormControl.Label>
            <Select
              value={uaType}
              onChange={(e: any) => setUaType(e.target.value as UserAgentType)}
              block
            >
              {UA_OPTIONS.map((opt) => (
                <Select.Option key={opt.id} value={opt.id}>
                  {opt.label} ({opt.format.toUpperCase()})
                </Select.Option>
              ))}
            </Select>
            <FormControl.Caption>
              实际请求头: {UA_OPTIONS.find((o) => o.id === uaType)?.ua}
            </FormControl.Caption>
          </FormControl>

          {/* 危险操作区：删除订阅 */}
          <div
            style={{
              marginTop: '8px',
              padding: '12px',
              border: '1px solid var(--borderColor-danger-muted, #ff8182)',
              borderRadius: '6px',
              backgroundColor: 'var(--bgColor-danger-muted, #ffebe9)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertIcon size={16} fill="var(--fg-danger, #cf222e)" />
              <Text as="span" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--fg-danger, #cf222e)' }}>
                危险操作
              </Text>
            </div>
            <Text as="p" style={{ fontSize: '12px', color: 'var(--fg-danger, #cf222e)', margin: 0 }}>
              删除此订阅将连同保存在 <code>subscription/{subscription.filename}</code> 的本地文件彻底移除。
            </Text>

            {isConfirmingDelete ? (
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <Button size="small" variant="danger" leadingVisual={TrashIcon} onClick={handleDelete}>
                  确认彻底删除
                </Button>
                <Button size="small" variant="default" onClick={() => setIsConfirmingDelete(false)}>
                  取消
                </Button>
              </div>
            ) : (
              <div style={{ marginTop: '4px' }}>
                <Button
                  size="small"
                  variant="outline"
                  leadingVisual={TrashIcon}
                  onClick={() => setIsConfirmingDelete(true)}
                  style={{ color: 'var(--fg-danger, #cf222e)' }}
                >
                  删除此订阅 (Delete)
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* 底部按钮 */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-muted, #d8dee4)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            backgroundColor: 'var(--bg-subtle, #f6f8fa)',
          }}
        >
          <Button variant="default" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" onClick={handleSave}>
            保存修改
          </Button>
        </div>
      </div>
    </div>
  );
};
