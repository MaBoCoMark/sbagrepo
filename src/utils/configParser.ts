import { ConfigMeta, SingBoxConfig } from '../types';

export function parseSingBoxConfig(rawJson: string): { config: SingBoxConfig | null; meta: ConfigMeta } {
  try {
    const config: SingBoxConfig = JSON.parse(rawJson);

    const inbounds = Array.isArray(config.inbounds) ? config.inbounds : [];
    const outbounds = Array.isArray(config.outbounds) ? config.outbounds : [];
    const rules = Array.isArray(config.route?.rules) ? config.route.rules : [];

    // Check if TUN inbound exists
    const hasTun = inbounds.some((inbound) => inbound.type?.toLowerCase() === 'tun');

    // Extract ports
    const mixedInbound = inbounds.find((inbound) => inbound.type?.toLowerCase() === 'mixed');
    const socksInbound = inbounds.find((inbound) => inbound.type?.toLowerCase() === 'socks');
    const httpInbound = inbounds.find((inbound) => inbound.type?.toLowerCase() === 'http');

    const mixedPort = mixedInbound?.listen_port ?? null;
    const socksPort = socksInbound?.listen_port ?? null;
    const httpPort = httpInbound?.listen_port ?? null;

    const logLevel = config.log?.level?.toLowerCase() || 'info';

    return {
      config,
      meta: {
        hasTun,
        mixedPort,
        socksPort,
        httpPort,
        logLevel,
        inboundCount: inbounds.length,
        outboundCount: outbounds.length,
        rulesCount: rules.length,
        isValid: true,
      },
    };
  } catch (error: any) {
    return {
      config: null,
      meta: {
        hasTun: false,
        mixedPort: null,
        socksPort: null,
        httpPort: null,
        logLevel: 'unknown',
        inboundCount: 0,
        outboundCount: 0,
        rulesCount: 0,
        isValid: false,
        parseError: error?.message || 'Invalid JSON syntax',
      },
    };
  }
}
