import React from 'react';
import { Heading, Text, Label } from '@primer/react';
import { ServerIcon } from '@primer/octicons-react';

interface HeaderProps {
  runningMode: 'stopped' | 'normal' | 'admin';
}

export const Header: React.FC<HeaderProps> = ({ runningMode }) => {
  const isMac = navigator.userAgent.toLowerCase().includes('mac');
  const targetArch = isMac ? 'Apple Silicon (aarch64)' : 'Windows (x86_64)';

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        backgroundColor: 'var(--bg-subtle, #f6f8fa)',
        borderBottom: '1px solid var(--border-default, #d0d7de)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '6px',
            backgroundColor: 'var(--color-accent, #0969da)',
            color: '#ffffff',
          }}
        >
          <ServerIcon size={20} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Heading as="h1" style={{ fontSize: '18px', fontWeight: 600, margin: 0, lineHeight: 1.2 }}>
              sing-box Desktop
            </Heading>
            <Label variant="accent" size="small">
              MVP
            </Label>
          </div>
          <Text as="p" style={{ fontSize: '12px', color: 'var(--fg-muted, #656d76)', margin: 0 }}>
            Next-generation proxy platform GUI controller
          </Text>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Label variant="secondary" size="small">
          {targetArch}
        </Label>
        {runningMode === 'stopped' && (
          <Label variant="default" size="large">
            未运行
          </Label>
        )}
        {runningMode === 'normal' && (
          <Label variant="accent" size="large">
            ● 普通运行中
          </Label>
        )}
        {runningMode === 'admin' && (
          <Label variant="danger" size="large">
            ● 管理员提权运行中
          </Label>
        )}
      </div>
    </header>
  );
};
