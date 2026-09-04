import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Heading, Text, Button, Label, Banner, ProgressBar, Stack } from '@primer/react';
import {
  SyncIcon,
  GearIcon,
  DotFillIcon,
  FileCodeIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  InfoIcon,
} from '@primer/octicons-react';
import { SubscriptionItem, UserAgentType } from '../types/subscription';
import { formatBytes, formatExpireDate } from '../utils/subscription';
import { JsonPathInspector } from './JsonPathInspector';
import { SubscriptionSettingsModal } from './SubscriptionSettingsModal';

interface SubscriptionCardProps {
  key?: React.ReactNode;
  subscription: SubscriptionItem;
  isRefreshing: boolean;
  onRefresh: (id: string) => void;
  onUpdate: (
    id: string,
    updates: { prefix?: string; url?: string; userAgentType?: UserAgentType }
  ) => void;
  onDelete: (id: string) => void;
}

export const SubscriptionCard: React.FC<SubscriptionCardProps> = ({
  subscription,
  isRefreshing,
  onRefresh,
  onUpdate,
  onDelete,
}) => {
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [isInspectorExpanded, setIsInspectorExpanded] = useState<boolean>(false);
  const [fileContent, setFileContent] = useState<string>('');
  const [isLoadingContent, setIsLoadingContent] = useState<boolean>(false);

  // 当用户展开检查器，且还没有加载过内容时，去读取对应的文件
  useEffect(() => {
    if (isInspectorExpanded && !fileContent) {
      setIsLoadingContent(true);
      invoke<string>('read_subscription_file', { filename: subscription.filename })
        .then((content) => {
          setFileContent(content);
        })
        .catch((err) => {
          console.error('读取订阅文件失败:', err);
          setFileContent('// 读取文件失败，请检查文件是否存在');
        })
        .finally(() => {
          setIsLoadingContent(false);
        });
    }
  }, [isInspectorExpanded, subscription.filename, fileContent]);

  const { prefix, format, userAgentType, lastUpdated, userInfo, filename } = subscription;

  // 流量使用百分比计算
  const total = userInfo?.total || 0;
  const upload = userInfo?.upload || 0;
  const download = userInfo?.download || 0;
  const remaining = total > 0 ? Math.max(0, total - upload - download) : 0;

  const uploadPercent = total > 0 ? Math.min(100, Math.round((upload / total) * 1000) / 10) : 0;
  const downloadPercent = total > 0 ? Math.min(100, Math.round((download / total) * 1000) / 10) : 0;
  const remainingPercent =
    total > 0 ? Math.max(0, Math.round((remaining / total) * 1000) / 10) : 0;

  const expireStr = formatExpireDate(userInfo?.expire);

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-canvas, #ffffff)',
        borderRadius: '8px',
        border: '1px solid var(--border-default, #d0d7de)',
        boxShadow: '0 1px 3px rgba(31, 35, 40, 0.04)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        transition: 'border-color 0.2s ease',
      }}
    >
      {/* 弹窗设置 */}
      {showSettings && (
        <SubscriptionSettingsModal
          subscription={subscription}
          onClose={() => setShowSettings(false)}
          onSave={onUpdate}
          onDelete={onDelete}
        />
      )}

      {/* 卡片头部 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          borderBottom: '1px solid var(--border-muted, #d8dee4)',
          paddingBottom: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <FileCodeIcon size={20} fill="var(--fg-accent, #0969da)" />
          {/* 卡片名称即为前缀 (注意区分大小写) */}
          <Heading as="h3" style={{ fontSize: '18px', margin: 0, fontWeight: 700, fontFamily: 'monospace' }}>
            {prefix}
          </Heading>

          <Label variant={format === 'json' ? 'accent' : 'attention'} size="small">
            {format.toUpperCase()}
          </Label>

          <Label variant="secondary" size="small">
            {userAgentType === 'sing-box' ? 'Sing-Box' : 'Clash Verge'}
          </Label>

          <Text as="span" style={{ fontSize: '12px', color: 'var(--fg-muted, #656d76)' }}>
            (文件: <code>subscription/{filename}</code>)
          </Text>
        </div>

        {/* 顶部右侧操作栏：显示上次更新时间、刷新按钮、设置按钮 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <Text as="span" style={{ fontSize: '12px', color: 'var(--fg-muted, #656d76)' }}>
            上次更新: <strong style={{ color: 'var(--fg-default, #1f2328)' }}>{lastUpdated || '未更新'}</strong>
          </Text>

          <Button
            size="small"
            variant="default"
            leadingVisual={SyncIcon}
            onClick={() => onRefresh(subscription.id)}
            loading={isRefreshing}
          >
            刷新
          </Button>

          <Button
            size="small"
            variant="invisible"
            leadingVisual={GearIcon}
            onClick={() => setShowSettings(true)}
            title="修改链接或删除订阅"
          >
            设置
          </Button>
        </div>
      </div>

      {/* Clash Verge (YAML) 格式提示卡片 */}
      {format === 'yaml' && (
        <Banner
          variant="info"
          title="暂不支持 YAML 格式解析"
          description={
            <div style={{ fontSize: '12px', lineHeight: '1.5' }}>
              当前订阅为 Clash Verge 规则格式，文件已保存至{' '}
              <code>subscription/{filename}</code>。
              当前版本暂不支持解析 YAML 内容，但订阅配置与流量信息已正常同步并添加到管理列表中。
            </div>
          }
        />
      )}

      {/* 流量用量进度条与图例 (subscription-userinfo) */}
      <div
        style={{
          backgroundColor: 'var(--bg-subtle, #f6f8fa)',
          borderRadius: '6px',
          border: '1px solid var(--border-muted, #d8dee4)',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Text as="span" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--fg-default, #1f2328)' }}>
            流量套餐用量 (subscription-userinfo)
          </Text>
          <Text as="span" style={{ fontSize: '12px', color: 'var(--fg-muted, #656d76)' }}>
            到期时间: <strong style={{ color: userInfo?.expire ? 'var(--fg-severe, #bc4c00)' : 'var(--fg-success, #1a7f37)' }}>{expireStr}</strong>
          </Text>
        </div>

        {userInfo && total > 0 ? (
          <>
            {/* 多段分段进度条 */}
            <ProgressBar aria-label="订阅用量" aria-valuenow={Math.min(100, uploadPercent + downloadPercent)}>
              <ProgressBar.Item
                progress={uploadPercent}
                style={{ backgroundColor: 'var(--bgColor-accent-emphasis, #0969da)' }}
                aria-label={`上传: ${formatBytes(upload)} (${uploadPercent}%)`}
              />
              <ProgressBar.Item
                progress={downloadPercent}
                style={{ backgroundColor: 'var(--bgColor-success-emphasis, #1a7f37)' }}
                aria-label={`下载: ${formatBytes(download)} (${downloadPercent}%)`}
              />
              <ProgressBar.Item
                progress={remainingPercent}
                style={{ backgroundColor: 'var(--border-default, #d0d7de)' }}
                aria-label={`剩余: ${formatBytes(remaining)} (${remainingPercent}%)`}
              />
            </ProgressBar>

            {/* 流量图例 Stack (直接显示各单位数值，无需用户做计算) */}
            <Stack direction="horizontal" wrap="wrap" role="presentation" gap="normal">
              <Stack direction="horizontal" gap="condensed" align="center">
                <DotFillIcon fill="var(--bgColor-accent-emphasis, #0969da)" />
                <span style={{ fontSize: '12px', color: 'var(--fg-default, #1f2328)' }}>
                  上传: <strong>{formatBytes(upload)}</strong> ({uploadPercent}%)
                </span>
              </Stack>

              <Stack direction="horizontal" gap="condensed" align="center">
                <DotFillIcon fill="var(--bgColor-success-emphasis, #1a7f37)" />
                <span style={{ fontSize: '12px', color: 'var(--fg-default, #1f2328)' }}>
                  下载: <strong>{formatBytes(download)}</strong> ({downloadPercent}%)
                </span>
              </Stack>

              <Stack direction="horizontal" gap="condensed" align="center">
                <DotFillIcon fill="var(--fg-muted, #656d76)" />
                <span style={{ fontSize: '12px', color: 'var(--fg-muted, #656d76)' }}>
                  剩余: <strong>{formatBytes(remaining)}</strong> ({remainingPercent}%)
                </span>
              </Stack>

              <Stack direction="horizontal" gap="condensed" align="center">
                <DotFillIcon fill="var(--bgColor-done-emphasis, #8250df)" />
                <span style={{ fontSize: '12px', color: 'var(--fg-default, #1f2328)' }}>
                  总量: <strong>{formatBytes(total)}</strong>
                </span>
              </Stack>
            </Stack>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--fg-muted, #656d76)' }}>
            <InfoIcon size={14} fill="var(--fg-muted, #656d76)" />
            <span>服务商未在响应头提供 subscription-userinfo 流量统计字段</span>
          </div>
        )}
      </div>

      {/* JSON 模式：配置展开与 JSONPath 解释器 */}
      {format === 'json' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Button
              size="small"
              variant="invisible"
              leadingVisual={isInspectorExpanded ? ChevronDownIcon : ChevronRightIcon}
              onClick={() => setIsInspectorExpanded(!isInspectorExpanded)}
            >
              {isInspectorExpanded ? '折叠 JSON 解释器与路径提取器' : '展开 JSON 解释器与路径提取器'}
            </Button>
            <Text as="span" style={{ fontSize: '11px', color: 'var(--fg-muted, #656d76)' }}>
              可输入关键字（如 outbounds）搜索节点并导出对应的 JSONPath
            </Text>
          </div>

          {isInspectorExpanded && (
            isLoadingContent ? (
              <div style={{ padding: '12px', fontSize: '13px', color: 'var(--fg-muted)' }}>
                正在从文件读取配置内容...
              </div>
            ) : (
              <JsonPathInspector prefix={subscription.prefix} jsonContent={fileContent} />
            )
          )}
        </div>
      )}
    </div>
  );
};
