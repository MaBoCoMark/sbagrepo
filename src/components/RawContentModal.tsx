import React, { useState } from 'react';
import { Heading, Text, Button, Banner } from '@primer/react';
import { CopyIcon, CheckIcon, AlertIcon } from '@primer/octicons-react';

interface RawContentModalProps {
  isOpen: boolean;
  title: string;
  content: string;
  errorDetails?: string;
  onClose: () => void;
}

export const RawContentModal: React.FC<RawContentModalProps> = ({
  isOpen,
  title,
  content,
  errorDetails,
  onClose,
}) => {
  if (!isOpen) return null;

  const [isCopied, setIsCopied] = useState<boolean>(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const lines = content.split('\n');

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(31, 35, 40, 0.4)', // 浅色半透明遮罩
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
          maxWidth: '850px',
          maxHeight: '85vh',
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
            <AlertIcon size={18} fill="var(--fg-severe, #bc4c00)" />
            <Heading as="h3" style={{ fontSize: '16px', margin: 0, fontWeight: 600, color: 'var(--fg-default, #1f2328)' }}>
              {title || '查看订阅返回原文 (校验未通过)'}
            </Heading>
          </div>
          <Button size="small" variant="invisible" onClick={onClose}>
            ✕
          </Button>
        </div>

        {/* 错误提示条 */}
        {errorDetails && (
          <div style={{ padding: '12px 20px 0 20px' }}>
            <Banner
              variant="critical"
              title="JSON 语法解析异常"
              description={errorDetails}
            />
          </div>
        )}

        {/* 原文内容区域 (纯浅色风格代码框) */}
        <div
          style={{
            flex: 1,
            padding: '16px 20px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text as="span" style={{ fontSize: '12px', color: 'var(--fg-muted, #656d76)' }}>
              共 {lines.length} 行 · {content.length} 个字符
            </Text>
            <Button
              size="small"
              variant="invisible"
              leadingVisual={isCopied ? CheckIcon : CopyIcon}
              onClick={handleCopy}
            >
              {isCopied ? '已复制原文' : '复制原文'}
            </Button>
          </div>

          <div
            style={{
              flex: 1,
              backgroundColor: 'var(--bg-subtle, #f6f8fa)', // 纯浅灰色背景
              borderRadius: '6px',
              border: '1px solid var(--border-default, #d0d7de)', // 浅灰细边框
              overflow: 'auto',
              maxHeight: '460px',
            }}
          >
            <table
              style={{
                borderCollapse: 'collapse',
                width: '100%',
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                fontSize: '12px',
                lineHeight: 1.6,
              }}
            >
              <tbody>
                {lines.map((lineText, idx) => (
                  <tr key={idx} style={{ verticalAlign: 'top' }}>
                    {/* 行号列 */}
                    <td
                      style={{
                        userSelect: 'none',
                        textAlign: 'right',
                        padding: '2px 10px',
                        color: 'var(--fg-muted, #656d76)', // 浅色模式弱化字色
                        borderRight: '1px solid var(--border-muted, #d8dee4)',
                        width: '45px',
                        backgroundColor: 'var(--bg-subtle, #f6f8fa)',
                      }}
                    >
                      {idx + 1}
                    </td>
                    {/* 代码内容列 */}
                    <td
                      style={{
                        padding: '2px 12px',
                        color: 'var(--fg-default, #1f2328)', // 浅色模式正文字色（深黑/深灰）
                        backgroundColor: '#ffffff', // 代码行用纯白背景，层次更分明
                        whiteSpace: 'pre',
                        wordBreak: 'normal',
                      }}
                    >
                      {lineText || ' '}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 底部按钮栏 */}
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
          <Button variant="primary" onClick={onClose}>
            我知道了
          </Button>
        </div>
      </div>
    </div>
  );
};