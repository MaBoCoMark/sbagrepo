import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  SubscriptionItem,
  SubscriptionUserInfo,
  UserAgentType,
  JsonValidationError,
  FetchSubscriptionResult,
} from '../types/subscription';
import {
  UA_OPTIONS,
  parseSubscriptionUserInfo,
  validateJson,
  getCurrentFormattedTime,
} from '../utils/subscription';

const STORAGE_KEY = 'singbox_subscriptions_list';

// 初始预置示例（基于用户需求中提供的真实样例，开箱即用且便于随时验证）
const INITIAL_DEMO_SUBSCRIPTIONS: SubscriptionItem[] = []
// [
//   {
//     id: 'sub_yf_demo',
//     prefix: 'YF',
//     url: 'https://api.example.com/sub/singbox?token=demo123',
//     userAgentType: 'sing-box',
//     userAgentString: 'SFI (sing-box 1.14.0; language en_US)',
//     filename: 'YF.json',
//     format: 'json',
//     lastUpdated: '2026-09-04 10:15:30',
//     userInfo: {
//       upload: 179195782,
//       download: 5181888235,
//       total: 107374182400,
//       expire: null,
//     },
//     content: JSON.stringify(
//       {
//         log: { disabled: false, level: 'info', timestamp: true },
//         dns: {
//           servers: [
//             { tag: 'remote', type: 'udp', server: '1.1.1.1', detour: '节点选择' },
//             { tag: 'local', type: 'https', server: '223.5.5.5', detour: 'direct' },
//             { tag: 'block', type: 'rcode', code: 'refused' },
//           ],
//           rules: [
//             { rule_set: 'geosite-category-ads-all', server: 'block' },
//             { rule_set: 'geosite-cn', server: 'local' },
//             { clash_mode: 'Global', server: 'remote' },
//             { clash_mode: 'Direct', server: 'local' },
//           ],
//           final: 'remote',
//           strategy: 'ipv4_only',
//         },
//         inbounds: [
//           {
//             type: 'tun',
//             tag: 'tun-in',
//             address: ['172.19.0.1/30', '2001:470:f9da:fdfa::1/64'],
//             mtu: 9000,
//             auto_route: true,
//             strict_route: true,
//             stack: 'system',
//           },
//           {
//             type: 'mixed',
//             tag: 'mixed-in',
//             listen: '127.0.0.1',
//             listen_port: 11111,
//           },
//         ],
//         outbounds: [
//           {
//             type: 'selector',
//             tag: '节点选择',
//             outbounds: [
//               '自动选择',
//               '🇯🇵 日本专线-Hysteria2',
//               '🇺🇸 洛杉矶专线-Hysteria2',
//               '🇸🇬 新加坡专线-Hysteria2',
//               '🇯🇵 日本移动-Reality',
//               '🇺🇸 美国专线-WS',
//             ],
//             default: '自动选择',
//           },
//           {
//             type: 'urltest',
//             tag: '自动选择',
//             outbounds: [
//               '🇯🇵 日本专线-Hysteria2',
//               '🇺🇸 洛杉矶专线-Hysteria2',
//               '🇸🇬 新加坡专线-Hysteria2',
//               '🇯🇵 日本移动-Reality',
//               '🇺🇸 美国专线-WS',
//             ],
//             url: 'https://www.gstatic.com/generate_204',
//             interval: '3m',
//           },
//           { type: 'direct', tag: 'direct' },
//           {
//             type: 'hysteria2',
//             tag: '🇯🇵 日本专线-Hysteria2',
//             server: 'jp-hy2.example.com',
//             server_port: 443,
//             password: 'YOUR_PASSWORD',
//             tls: { enabled: true, insecure: true, server_name: 'www.bing.com' },
//           },
//           {
//             type: 'hysteria2',
//             tag: '🇺🇸 洛杉矶专线-Hysteria2',
//             server: 'us-hy2.example.com',
//             server_port: 20000,
//             password: 'YOUR_PASSWORD',
//             tls: { enabled: true, insecure: true, server_name: 'www.bing.com' },
//           },
//           {
//             type: 'hysteria2',
//             tag: '🇸🇬 新加坡专线-Hysteria2',
//             server: 'sg-hy2.example.com',
//             server_port: 50000,
//             password: 'YOUR_PASSWORD',
//             tls: { enabled: true, insecure: true, server_name: 'www.bing.com' },
//           },
//           {
//             type: 'vless',
//             tag: '🇯🇵 日本移动-Reality',
//             server: 'jp-reality.example.com',
//             server_port: 443,
//             uuid: 'YOUR_UUID',
//             flow: 'xtls-rprx-vision',
//             packet_encoding: 'xudp',
//             tls: {
//               enabled: true,
//               server_name: 'osxapps.itunes.apple.com',
//               reality: {
//                 enabled: true,
//                 public_key: 'YOUR_REALITY_PUBLIC_KEY',
//                 short_id: 'YOUR_SHORT_ID',
//               },
//               utls: { enabled: true, fingerprint: 'chrome' },
//             },
//           },
//           {
//             type: 'vless',
//             tag: '🇺🇸 美国专线-WS',
//             server: 'us-ws.example.com',
//             server_port: 443,
//             uuid: 'YOUR_UUID',
//             packet_encoding: 'xudp',
//             tls: { enabled: true, server_name: 'us-ws.example.com', utls: { enabled: true, fingerprint: 'chrome' } },
//             transport: {
//               type: 'ws',
//               path: '/yfjc/us1',
//               headers: { Host: 'us-ws.example.com' },
//               max_early_data: 2048,
//               early_data_header_name: 'Sec-WebSocket-Protocol',
//             },
//           },
//         ],
//         route: {
//           auto_detect_interface: true,
//           rules: [
//             { action: 'sniff' },
//             { protocol: 'dns', action: 'hijack-dns' },
//             { clash_mode: 'Direct', outbound: 'direct' },
//             { clash_mode: 'Global', outbound: '节点选择' },
//             { rule_set: 'geosite-category-ads-all', action: 'reject' },
//             { rule_set: ['geosite-cn', 'geoip-cn'], outbound: 'direct' },
//             { ip_is_private: true, outbound: 'direct' },
//           ],
//           rule_set: [
//             {
//               tag: 'geosite-cn',
//               type: 'remote',
//               format: 'binary',
//               url: 'https://testingcf.jsdelivr.net/gh/SagerNet/sing-geosite@rule-set/geosite-cn.srs',
//               download_detour: '节点选择',
//             },
//             {
//               tag: 'geosite-category-ads-all',
//               type: 'remote',
//               format: 'binary',
//               url: 'https://testingcf.jsdelivr.net/gh/SagerNet/sing-geosite@rule-set/geosite-category-ads-all.srs',
//               download_detour: '节点选择',
//             },
//             {
//               tag: 'geoip-cn',
//               type: 'remote',
//               format: 'binary',
//               url: 'https://testingcf.jsdelivr.net/gh/Loyalsoldier/geoip@release/srs/cn.srs',
//               download_detour: '节点选择',
//             },
//           ],
//           final: '节点选择',
//         },
//         experimental: {
//           cache_file: { enabled: true },
//           clash_api: {
//             external_controller: '127.0.0.1:9090',
//             secret: '',
//             default_mode: 'Rule',
//           },
//         },
//       },
//       null,
//       2
//     ),
//   },
//   {
//     id: 'sub_clash_demo',
//     prefix: 'CL',
//     url: 'https://api.example.com/sub/clash?token=clash456',
//     userAgentType: 'clash-verge',
//     userAgentString: 'clash-verge/v2.4.7',
//     filename: 'CL.yaml',
//     format: 'yaml',
//     lastUpdated: '2026-09-04 09:30:12',
//     userInfo: {
//       upload: 524288000,
//       download: 10737418240,
//       total: 214748364800,
//       expire: 1780000000,
//     },
//     content: `port: 7890
// socks-port: 7891
// allow-lan: false
// mode: rule
// log-level: info
// proxies:
//   - name: "🇯🇵 日本节点"
//     type: ss
//     server: 1.2.3.4
//     port: 8388
//     cipher: aes-128-gcm
//     password: "demo"
// rules:
//   - MATCH,DIRECT
// `,
//   },
// ];

export function useSubscriptionManager() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[useSubscriptionManager] 读取本地存储失败:', e);
    }
    return INITIAL_DEMO_SUBSCRIPTIONS;
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  // JSON 语法错误状态（用于展示“JSON不合法”及点击查看原文）
  const [jsonValidationError, setJsonValidationError] = useState<JsonValidationError | null>(null);

  // 原文查看模态弹窗状态
  const [rawViewModal, setRawViewModal] = useState<{
    isOpen: boolean;
    title: string;
    content: string;
    errorDetails?: string;
  }>({
    isOpen: false,
    title: '',
    content: '',
  });

  // 持久化到 Tauri 后端及 localStorage
  const persistSubscriptions = useCallback(async (items: SubscriptionItem[]) => {
    setSubscriptions(items);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('[useSubscriptionManager] 保存到 localStorage 失败:', e);
    }

    try {
      // 尝试调用后端持久化宏观配置文件 subscriptions.json
      await invoke('save_subscription_metadata', {
        metadataJson: JSON.stringify(items, null, 2),
      });
    } catch {
      // 浏览器环境或后端未启用时静默兼容
    }
  }, []);

  // 初始化尝试从 Rust 后端同步读取 subscriptions.json
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const remoteMeta = await invoke<string>('load_subscriptions');
        if (remoteMeta && isMounted) {
          const parsed = JSON.parse(remoteMeta);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSubscriptions(parsed);
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
            } catch {}
          }
        }
      } catch {
        // 后端无响应时使用本地默认值
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // 执行获取订阅
  const fetchSubscription = useCallback(
    async (
      prefix: string,
      url: string,
      userAgentType: UserAgentType,
      overrideRawContent?: string,
      overrideUserInfoHeader?: string
    ): Promise<FetchSubscriptionResult> => {
      const cleanPrefix = prefix.trim();
      const cleanUrl = url.trim();

      if (!cleanPrefix) {
        return { success: false, error: '前缀不能为空！' };
      }
      if (cleanPrefix.length > 6) {
        return { success: false, error: '前缀长度不能超过 6 个字符！' };
      }
      if (!cleanUrl) {
        return { success: false, error: '订阅链接 URL 不能为空！' };
      }

      setIsLoading(true);

      const uaOption = UA_OPTIONS.find((o) => o.id === userAgentType) || UA_OPTIONS[0];
      const targetFormat = uaOption.format;
      const targetFilename = `${cleanPrefix}.${targetFormat}`;

      try {
        let rawContent = overrideRawContent || '';
        let userInfo: SubscriptionUserInfo | null = null;
        let responseHeaders: Record<string, string> = {};

        // 如果未指定 override 内容，发起真实网络请求
        if (!overrideRawContent) {
          try {
            // 优先尝试 Tauri 后端使用 curl/reqwest 发起，无跨域限制
            const backendRes = await invoke<{
              body: string;
              headers: Record<string, string>;
              status: number;
              userInfoHeader?: string;
            }>('fetch_subscription_url', {
              url: cleanUrl,
              userAgent: uaOption.ua,
            });

            rawContent = backendRes.body;
            responseHeaders = backendRes.headers || {};
            const headerVal =
              backendRes.userInfoHeader ||
              responseHeaders['subscription-userinfo'] ||
              responseHeaders['Subscription-Userinfo'];
            userInfo = parseSubscriptionUserInfo(headerVal);
          } catch (backendErr: any) {
            console.warn('[useSubscriptionManager] Tauri 后端请求失败，降级尝试 fetch API:', backendErr);

            // 降级尝试原生 fetch
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 12000);

            try {
              const res = await fetch(cleanUrl, {
                method: 'GET',
                headers: {
                  'User-Agent': uaOption.ua,
                },
                signal: controller.signal,
              });
              clearTimeout(timer);

              if (!res.ok) {
                throw new Error(`HTTP 请求失败: 状态码 ${res.status} (${res.statusText})`);
              }

              rawContent = await res.text();
              const headerVal = res.headers.get('subscription-userinfo');
              userInfo = parseSubscriptionUserInfo(headerVal);
            } catch (fetchErr: any) {
              clearTimeout(timer);
              if (fetchErr.name === 'AbortError') {
                throw new Error('订阅链接请求超时 (12秒)，请检查网络或目标服务商连通性。');
              }
              throw fetchErr;
            }
          }
        } else {
          // 使用传入的模拟/覆盖数据
          if (overrideUserInfoHeader) {
            userInfo = parseSubscriptionUserInfo(overrideUserInfoHeader);
          }
        }

        // 校验返回内容与格式
        if (targetFormat === 'json') {
          const valRes = validateJson(rawContent);
          if (!valRes.valid) {
            const errObj: JsonValidationError = {
              message: valRes.error,
              line: valRes.line,
              column: valRes.column,
              rawContent,
            };
            setJsonValidationError(errObj);
            return {
              success: false,
              invalidJson: true,
              validationError: errObj,
              error: `JSON 不合法：${valRes.error} (第 ${valRes.line} 行第 ${valRes.column} 列)`,
            };
          }
        }

        // 保存文件到后端 subscription 文件夹
        try {
          await invoke('save_subscription_file', {
            filename: targetFilename,
            content: rawContent,
          });
        } catch (e) {
          console.log('[useSubscriptionManager] 后端写入文件跳过或未支持:', e);
        }

        // 构建新的订阅条目
        const updatedTime = getCurrentFormattedTime();
        const existingIdx = subscriptions.findIndex((s) => s.prefix === cleanPrefix);

        const newEntry: SubscriptionItem = {
          id: existingIdx !== -1 ? subscriptions[existingIdx].id : `sub_${Date.now()}_${cleanPrefix}`,
          prefix: cleanPrefix,
          url: cleanUrl,
          userAgentType,
          userAgentString: uaOption.ua,
          filename: targetFilename,
          format: targetFormat,
          lastUpdated: updatedTime,
          userInfo,
        };

        let newItems: SubscriptionItem[];
        if (existingIdx !== -1) {
          newItems = [...subscriptions];
          newItems[existingIdx] = newEntry;
        } else {
          newItems = [newEntry, ...subscriptions];
        }

        await persistSubscriptions(newItems);

        // 成功后清理错误状态
        setJsonValidationError(null);

        return {
          success: true,
          content: rawContent,
          userInfo,
          rawHeaders: responseHeaders,
        };
      } catch (err: any) {
        const msg = err.message || String(err);
        return {
          success: false,
          error: `获取订阅失败: ${msg}`,
        };
      } finally {
        setIsLoading(false);
      }
    },
    [subscriptions, persistSubscriptions]
  );

  // 刷新单个订阅
  const refreshSubscription = useCallback(
    async (id: string): Promise<boolean> => {
      const target = subscriptions.find((s) => s.id === id);
      if (!target) return false;

      setRefreshingId(id);
      try {
        const res = await fetchSubscription(
          target.prefix,
          target.url,
          target.userAgentType
        );
        return res.success;
      } finally {
        setRefreshingId(null);
      }
    },
    [subscriptions, fetchSubscription]
  );

  // 修改订阅（更新 URL、User Agent 或前缀）
  const updateSubscription = useCallback(
    async (
      id: string,
      updates: {
        prefix?: string;
        url?: string;
        userAgentType?: UserAgentType;
      }
    ) => {
      const idx = subscriptions.findIndex((s) => s.id === id);
      if (idx === -1) return;

      const current = subscriptions[idx];
      const newPrefix = updates.prefix !== undefined ? updates.prefix.trim() : current.prefix;
      const newUrl = updates.url !== undefined ? updates.url.trim() : current.url;
      const newUaType = updates.userAgentType !== undefined ? updates.userAgentType : current.userAgentType;

      const uaOpt = UA_OPTIONS.find((o) => o.id === newUaType) || UA_OPTIONS[0];
      const newFormat = uaOpt.format;
      const newFilename = `${newPrefix}.${newFormat}`;

      // 若前缀或格式修改，通知后端处理文件重命名
      if (current.filename !== newFilename) {
        try {
          await invoke('delete_subscription_file', { filename: current.filename });
          await invoke('save_subscription_file', {
            filename: newFilename,
          });
        } catch {}
      }

      const updated: SubscriptionItem = {
        ...current,
        prefix: newPrefix,
        url: newUrl,
        userAgentType: newUaType,
        userAgentString: uaOpt.ua,
        filename: newFilename,
        format: newFormat,
      };

      const newItems = [...subscriptions];
      newItems[idx] = updated;
      await persistSubscriptions(newItems);
    },
    [subscriptions, persistSubscriptions]
  );

  // 删除订阅
  const deleteSubscription = useCallback(
    async (id: string) => {
      const target = subscriptions.find((s) => s.id === id);
      if (target) {
        try {
          await invoke('delete_subscription_file', { filename: target.filename });
        } catch {}
      }
      const newItems = subscriptions.filter((s) => s.id !== id);
      await persistSubscriptions(newItems);
    },
    [subscriptions, persistSubscriptions]
  );

  // 关闭 JSON 校验错误
  const dismissJsonValidationError = useCallback(() => {
    setJsonValidationError(null);
  }, []);

  // 打开原文查看弹窗
  const openRawViewModal = useCallback((title: string, content: string, errorDetails?: string) => {
    setRawViewModal({
      isOpen: true,
      title,
      content,
      errorDetails,
    });
  }, []);

  const closeRawViewModal = useCallback(() => {
    setRawViewModal((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return {
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
  };
}
