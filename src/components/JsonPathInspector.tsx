import React, { useState, useMemo, useCallback } from 'react';
import { Heading, Text, Button, TextInput, Label, CounterLabel } from '@primer/react';
import {
  SearchIcon,
  CopyIcon,
  CheckIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  CodeIcon,
  FileCodeIcon,
  PlusIcon,
  TrashIcon,
} from '@primer/octicons-react';
import { JsonPathMatch, ExportedPathEntry } from '../types/subscription';
import { searchJsonPaths, getValueByPath, createExportEntry } from '../utils/subscription';

interface JsonPathInspectorProps {
  prefix: string;
  jsonContent: string;
}

// 单个可折叠 JSON 树节点组件
interface TreeNodeProps {
  key?: React.ReactNode;
  data: any;
  path: string;
  keyName: string;
  depth: number;
  selectedPath: string;
  onSelectPath: (path: string) => void;
  keyword?: string;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  data,
  path,
  keyName,
  depth,
  selectedPath,
  onSelectPath,
  keyword,
}) => {
  // 默认只展开前 2 层，防止大文件初次渲染卡顿
  const [isExpanded, setIsExpanded] = useState<boolean>(depth < 2);

  const isSelected = selectedPath === path;
  const isObject = data !== null && typeof data === 'object' && !Array.isArray(data);
  const isArray = Array.isArray(data);
  const isExpandable = isObject || isArray;

  const isMatched =
    keyword &&
    keyword.trim() &&
    (keyName.toLowerCase().includes(keyword.toLowerCase()) ||
      (!isExpandable && String(data).toLowerCase().includes(keyword.toLowerCase())));

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded((prev) => !prev);
  };

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectPath(path);
  };

  return (
    <div style={{ marginLeft: `${depth * 14}px`, fontSize: '12px', lineHeight: '1.6' }}>
      <div
        onClick={handleSelect}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '2px 6px',
          borderRadius: '4px',
          cursor: 'pointer',
          backgroundColor: isSelected
            ? 'var(--bgColor-accent-muted, #ddf4ff)'
            : isMatched
            ? 'var(--bgColor-attention-muted, #fff8c5)'
            : 'transparent',
          border: isSelected
            ? '1px solid var(--borderColor-accent-emphasis, #0969da)'
            : '1px solid transparent',
          transition: 'background-color 0.15s ease',
        }}
        title={`点击选择此路径: ${path}`}
      >
        {isExpandable ? (
          <span
            onClick={toggleExpand}
            style={{
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px',
              color: 'var(--fg-muted, #656d76)',
            }}
          >
            {isExpanded ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
          </span>
        ) : (
          <span style={{ width: '18px' }} />
        )}

        {/* 字段名 */}
        {keyName && (
          <span
            style={{
              color: 'var(--fg-accent, #0969da)',
              fontWeight: 600,
              fontFamily: 'monospace',
            }}
          >
            {keyName}:
          </span>
        )}

        {/* 值预览 */}
        {isArray ? (
          <span style={{ color: 'var(--fg-muted, #656d76)', fontStyle: 'italic' }}>
            Array({data.length})
          </span>
        ) : isObject ? (
          <span style={{ color: 'var(--fg-muted, #656d76)', fontStyle: 'italic' }}>
            {'{'}...{'}'} ({Object.keys(data).length} 属性)
          </span>
        ) : typeof data === 'string' ? (
          <span style={{ color: 'var(--fg-success, #1a7f37)', fontFamily: 'monospace' }}>
            "{data.length > 50 ? `${data.slice(0, 50)}...` : data}"
          </span>
        ) : typeof data === 'number' ? (
          <span style={{ color: 'var(--fg-severe, #bc4c00)', fontFamily: 'monospace' }}>
            {data}
          </span>
        ) : typeof data === 'boolean' ? (
          <span style={{ color: 'var(--fg-done, #8250df)', fontWeight: 600, fontFamily: 'monospace' }}>
            {String(data)}
          </span>
        ) : (
          <span style={{ color: 'var(--fg-muted, #656d76)', fontStyle: 'italic' }}>null</span>
        )}

        <span
          style={{
            marginLeft: 'auto',
            fontSize: '11px',
            color: 'var(--fg-subtle, #8c959f)',
            fontFamily: 'monospace',
          }}
        >
          {path}
        </span>
      </div>

      {/* 展开子节点 */}
      {isExpandable && isExpanded && (
        <div style={{ borderLeft: '1px solid var(--border-muted, #d8dee4)', marginLeft: '8px' }}>
          {isArray
            ? data.map((item: any, idx: number) => (
                <TreeNode
                  key={`${path}[${idx}]`}
                  data={item}
                  path={`${path}[${idx}]`}
                  keyName={`[${idx}]`}
                  depth={depth + 1}
                  selectedPath={selectedPath}
                  onSelectPath={onSelectPath}
                  keyword={keyword}
                />
              ))
            : Object.entries(data).map(([k, v]) => (
                <TreeNode
                  key={`${path}.${k}`}
                  data={v}
                  path={`${path}.${k}`}
                  keyName={k}
                  depth={depth + 1}
                  selectedPath={selectedPath}
                  onSelectPath={onSelectPath}
                  keyword={keyword}
                />
              ))}
        </div>
      )}
    </div>
  );
};

export const JsonPathInspector: React.FC<JsonPathInspectorProps> = ({
  prefix,
  jsonContent,
}) => {
  const [keyword, setKeyword] = useState<string>('outbounds');
  const [selectedPath, setSelectedPath] = useState<string>('$.outbounds');
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState<boolean>(false);
  const [exportedPaths, setExportedPaths] = useState<ExportedPathEntry[]>([]);
  const [copiedAllExport, setCopiedAllExport] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'split' | 'tree' | 'snippet'>('split');

  // 解析并缓存 JSON 数据
  const parsedData = useMemo(() => {
    try {
      return JSON.parse(jsonContent);
    } catch {
      return null;
    }
  }, [jsonContent]);

  // 根据关键字搜索出的 JSONPath 列表
  const searchResults: JsonPathMatch[] = useMemo(() => {
    if (!parsedData || !keyword.trim()) return [];
    return searchJsonPaths(parsedData, keyword.trim(), 40);
  }, [parsedData, keyword]);

  // 当前选中路径对应的数据子集
  const selectedValue = useMemo(() => {
    if (!parsedData) return null;
    return getValueByPath(parsedData, selectedPath);
  }, [parsedData, selectedPath]);

  // 格式化当前选中子集
  const formattedSelectedJson = useMemo(() => {
    if (selectedValue === undefined) return '// 未找到路径对应的数据';
    try {
      return JSON.stringify(selectedValue, null, 2);
    } catch {
      return String(selectedValue);
    }
  }, [selectedValue]);

  // 复制文本到剪贴板辅助函数
  const copyToClipboard = useCallback(async (text: string, onDone: () => void) => {
    try {
      await navigator.clipboard.writeText(text);
      onDone();
    } catch (e) {
      console.warn('[JsonPathInspector] 复制失败，降级使用 textarea:', e);
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      onDone();
    }
  }, []);

  const handleCopyPath = (path: string) => {
    copyToClipboard(path, () => {
      setCopiedPath(path);
      setTimeout(() => setCopiedPath(null), 2000);
    });
  };

  const handleCopySnippet = () => {
    copyToClipboard(formattedSelectedJson, () => {
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2000);
    });
  };

  // 添加路径到导出清单
  const handleAddToExport = (path: string) => {
    if (!parsedData) return;
    if (exportedPaths.some((p) => p.path === path)) return;

    const entry = createExportEntry(parsedData, path);
    setExportedPaths((prev) => [...prev, entry]);
  };

  const handleRemoveExport = (path: string) => {
    setExportedPaths((prev) => prev.filter((p) => p.path !== path));
  };

  // 一键复制已导出的路径清单
  const handleCopyAllExportedPaths = () => {
    const payload = {
      prefix,
      exportedAt: new Date().toISOString(),
      paths: exportedPaths.map((p) => p.path),
      entries: exportedPaths.map((p) => ({
        path: p.path,
        type: p.type,
        itemCount: p.itemCount,
        preview: p.preview,
      })),
    };
    copyToClipboard(JSON.stringify(payload, null, 2), () => {
      setCopiedAllExport(true);
      setTimeout(() => setCopiedAllExport(false), 2500);
    });
  };

  if (!parsedData) {
    return (
      <div style={{ padding: '16px', color: 'var(--fg-danger, #cf222e)', fontSize: '13px' }}>
        无法解析配置内容为合法 JSON，请检查文件完整性。
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        backgroundColor: 'var(--bg-canvas, #ffffff)',
        border: '1px solid var(--border-default, #d0d7de)',
        borderRadius: '8px',
        padding: '16px',
        marginTop: '12px',
      }}
    >
      {/* 标题与说明 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          borderBottom: '1px solid var(--border-muted, #d8dee4)',
          paddingBottom: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CodeIcon size={18} fill="var(--fg-accent, #0969da)" />
          <Heading as="h4" style={{ fontSize: '15px', margin: 0, fontWeight: 600 }}>
            JSON 解释器与路径提取器 (JSONPath Inspector)
          </Heading>
          <Label variant="accent" size="small">
            serde_json_path 兼容
          </Label>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <Button
            size="small"
            variant={viewMode === 'split' ? 'primary' : 'default'}
            onClick={() => setViewMode('split')}
          >
            双栏并排
          </Button>
          <Button
            size="small"
            variant={viewMode === 'tree' ? 'primary' : 'default'}
            onClick={() => setViewMode('tree')}
          >
            展开树
          </Button>
          <Button
            size="small"
            variant={viewMode === 'snippet' ? 'primary' : 'default'}
            onClick={() => setViewMode('snippet')}
          >
            目标 JSON
          </Button>
        </div>
      </div>

      {/* 搜索控制栏 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          backgroundColor: 'var(--bg-subtle, #f6f8fa)',
          padding: '12px',
          borderRadius: '6px',
          border: '1px solid var(--border-muted, #d8dee4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: '260px', gap: '8px' }}>
          <TextInput
            leadingVisual={SearchIcon}
            placeholder="搜索节点关键字 (如 outbounds, hysteria2, servers)..."
            value={keyword}
            onChange={(e: any) => setKeyword(e.target.value)}
            block
            size="small"
          />
          {keyword && (
            <Button size="small" variant="invisible" onClick={() => setKeyword('')}>
              清空
            </Button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Text as="span" style={{ fontSize: '12px', color: 'var(--fg-muted, #656d76)' }}>
            快捷检索推荐:
          </Text>
          {['outbounds', 'dns', 'inbounds', 'route', 'rules'].map((kw) => (
            <Button
              key={kw}
              size="small"
              variant={keyword === kw ? 'primary' : 'outline'}
              onClick={() => setKeyword(kw)}
              style={{ fontSize: '11px', padding: '2px 8px' }}
            >
              {kw}
            </Button>
          ))}
        </div>
      </div>

      {/* 搜索结果快速匹配条目 */}
      {keyword.trim() && (
        <div
          style={{
            backgroundColor: 'var(--bg-subtle, #f6f8fa)',
            borderRadius: '6px',
            border: '1px solid var(--border-muted, #d8dee4)',
            padding: '10px 14px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Text as="span" style={{ fontSize: '12px', fontWeight: 600 }}>
                关键字「{keyword}」检索匹配项:
              </Text>
              <CounterLabel scheme="primary">{searchResults.length}</CounterLabel>
            </div>
            <Text as="span" style={{ fontSize: '11px', color: 'var(--fg-muted, #656d76)' }}>
              点击条目即可定位并展开对应分支
            </Text>
          </div>

          {searchResults.length === 0 ? (
            <Text as="div" style={{ fontSize: '12px', color: 'var(--fg-muted, #656d76)', padding: '6px 0' }}>
              未在配置 JSON 中找到包含「{keyword}」的字段或内容。
            </Text>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '8px',
                maxHeight: '160px',
                overflowY: 'auto',
              }}
            >
              {searchResults.map((m) => {
                const isItemActive = selectedPath === m.path;
                return (
                  <div
                    key={m.path}
                    onClick={() => setSelectedPath(m.path)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      backgroundColor: isItemActive
                        ? 'var(--bgColor-accent-muted, #ddf4ff)'
                        : 'var(--bg-canvas, #ffffff)',
                      border: isItemActive
                        ? '1px solid var(--borderColor-accent-emphasis, #0969da)'
                        : '1px solid var(--border-default, #d0d7de)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          fontFamily: 'monospace',
                          color: 'var(--fg-accent, #0969da)',
                        }}
                      >
                        {m.path}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          color: 'var(--fg-muted, #656d76)',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                        }}
                      >
                        {m.valuePreview}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0, marginLeft: '8px' }}>
                      <Button
                        size="small"
                        variant="invisible"
                        leadingVisual={copiedPath === m.path ? CheckIcon : CopyIcon}
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          handleCopyPath(m.path);
                        }}
                        title="复制路径"
                      />
                      <Button
                        size="small"
                        variant="invisible"
                        leadingVisual={PlusIcon}
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          handleAddToExport(m.path);
                        }}
                        title="加入导出清单"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 当前选中的路径焦点操作栏 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          padding: '8px 12px',
          backgroundColor: 'var(--bgColor-accent-muted, #ddf4ff)',
          border: '1px solid var(--borderColor-accent-muted, #54aeff)',
          borderRadius: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Text as="span" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--fg-default, #1f2328)' }}>
            当前定位路径:
          </Text>
          <code
            style={{
              padding: '2px 8px',
              backgroundColor: 'var(--bg-canvas, #ffffff)',
              border: '1px solid var(--border-default, #d0d7de)',
              borderRadius: '4px',
              fontWeight: 700,
              fontSize: '13px',
              color: 'var(--fg-accent, #0969da)',
            }}
          >
            {selectedPath}
          </code>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            size="small"
            leadingVisual={copiedPath === selectedPath ? CheckIcon : CopyIcon}
            onClick={() => handleCopyPath(selectedPath)}
          >
            {copiedPath === selectedPath ? '路径已复制' : '复制此路径'}
          </Button>

          <Button
            size="small"
            variant="default"
            leadingVisual={PlusIcon}
            onClick={() => handleAddToExport(selectedPath)}
          >
            加入导出清单
          </Button>
        </div>
      </div>

      {/* 主视图区域：树形浏览 与 对应节点 JSON 片段 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: viewMode === 'split' ? '1fr 1fr' : '1fr',
          gap: '12px',
          minHeight: '340px',
        }}
      >
        {/* 左侧/全局树形结构 */}
        {(viewMode === 'split' || viewMode === 'tree') && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--bg-subtle, #f6f8fa)',
              border: '1px solid var(--border-muted, #d8dee4)',
              borderRadius: '6px',
              padding: '12px',
              maxHeight: '420px',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
                paddingBottom: '6px',
                borderBottom: '1px solid var(--border-muted, #d8dee4)',
              }}
            >
              <Text as="span" style={{ fontSize: '12px', fontWeight: 600 }}>
                配置层级结构树 (可点击选择节点)
              </Text>
              <Button size="small" variant="invisible" onClick={() => setSelectedPath('$')}>
                返回根节点 ($)
              </Button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <TreeNode
                data={parsedData}
                path="$"
                keyName="$ (root)"
                depth={0}
                selectedPath={selectedPath}
                onSelectPath={setSelectedPath}
                keyword={keyword}
              />
            </div>
          </div>
        )}

        {/* 右侧/目标 JSON 片段预览 */}
        {(viewMode === 'split' || viewMode === 'snippet') && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--bg-inset, #0d1117)',
              border: '1px solid var(--border-muted, #30363d)',
              borderRadius: '6px',
              maxHeight: '420px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderBottom: '1px solid #30363d',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileCodeIcon size={14} fill="#7d8590" />
                <span style={{ fontSize: '12px', color: 'var(--fg-default)', fontFamily: 'monospace' }}>
                  {selectedPath} (JSON 内容)
                </span>
              </div>

              <Button
                size="small"
                variant="invisible"
                leadingVisual={copiedSnippet ? CheckIcon : CopyIcon}
                onClick={handleCopySnippet}
                style={{ color: '#e6edf3' }}
              >
                {copiedSnippet ? '已复制内容' : '复制此段 JSON'}
              </Button>
            </div>

            <pre
              style={{
                margin: 0,
                padding: '14px',
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                fontSize: '12px',
                lineHeight: 1.5,
                color: 'var(--fg-default)',
                overflow: 'auto',
                flex: 1,
              }}
            >
              <code>{formattedSelectedJson}</code>
            </pre>
          </div>
        )}
      </div>

      {/* 已选待导出路径清单面板 (Roadmap 准备: 供用户一键导出提取路径丢给下次开发) */}
      <div
        style={{
          borderTop: '1px solid var(--border-muted, #d8dee4)',
          paddingTop: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Heading as="h5" style={{ fontSize: '13px', margin: 0, fontWeight: 600 }}>
              已收集提取路径清单 (Roadmap 导出专区)
            </Heading>
            <CounterLabel scheme="secondary">{exportedPaths.length}</CounterLabel>
            <Text as="span" style={{ fontSize: '11px', color: 'var(--fg-muted, #656d76)' }}>
              （用于后续出站聚合、前缀重命名及 SRS 编译整合）
            </Text>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {exportedPaths.length > 0 && (
              <Button
                size="small"
                variant="invisible"
                leadingVisual={TrashIcon}
                onClick={() => setExportedPaths([])}
              >
                清空清单
              </Button>
            )}
            <Button
              size="small"
              variant="primary"
              leadingVisual={copiedAllExport ? CheckIcon : CopyIcon}
              onClick={handleCopyAllExportedPaths}
              disabled={exportedPaths.length === 0}
            >
              {copiedAllExport ? '清单已导出复制' : '一键复制提取清单 (JSON)'}
            </Button>
          </div>
        </div>

        {exportedPaths.length === 0 ? (
          <div
            style={{
              padding: '12px',
              backgroundColor: 'var(--bg-subtle, #f6f8fa)',
              borderRadius: '6px',
              border: '1px dashed var(--border-default, #d0d7de)',
              fontSize: '12px',
              color: 'var(--fg-muted, #656d76)',
              textAlign: 'center',
            }}
          >
            尚未添加任何提取路径。您可以通过上方的【加入导出清单】按钮收集如 <code>$.outbounds</code>、
            <code>$.dns.servers</code> 等需要提取重组的路径。下次开发时直接将生成的清单丢入即可直接使用！
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              backgroundColor: 'var(--bg-subtle, #f6f8fa)',
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid var(--border-muted, #d8dee4)',
            }}
          >
            {exportedPaths.map((ep) => (
              <div
                key={ep.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'var(--bg-canvas, #ffffff)',
                  border: '1px solid var(--border-default, #d0d7de)',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
              >
                <span style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--fg-accent, #0969da)' }}>
                  {ep.path}
                </span>
                <span style={{ color: 'var(--fg-muted, #656d76)', fontSize: '11px' }}>
                  ({ep.preview})
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveExport(ep.path)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: 'var(--fg-muted, #656d76)',
                    fontSize: '14px',
                    lineHeight: 1,
                    padding: '0 2px',
                  }}
                  title="移除此路径"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
