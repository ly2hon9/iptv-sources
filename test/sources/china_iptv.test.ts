import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  china_iptv_filter,
  china_iptv_sources,
  DEFAULT_IPTV_PROXY_IP_RANGES,
  LAN_IP_PREFIXES,
  parseChinaIptvFileName,
  parseIptvProxyIpRanges,
  replaceWithLanProxyUrl,
} from '../../src/sources/china_iptv';
import { normalizeSourceFilterResults } from '../../src/sources/utils';

const raw = [
  '央视,#genre#',
  'CCTV1,rtp://239.3.1.129:8008',
  'CCTV2,',
  '卫视,#genre#',
  '北京卫视,udp://239.3.1.241:8000',
  '外网,http://example.com/live.m3u8',
].join('\n');

const filter = (filename: string) =>
  normalizeSourceFilterResults(china_iptv_filter(raw, 'skip', undefined, filename));

describe('china_iptv_filter', () => {
  it('converts genre txt to m3u and skips empty urls', () => {
    const [result] = filter('iptv/unicast/hebei/unicom');

    expect(result.filename).toBe('iptv/unicast/hebei/unicom');
    expect(result.channelCount).toBe(3);
    expect(result.m3u).toContain('group-title="央视",CCTV1\nrtp://239.3.1.129:8008');
    expect(result.m3u).toContain('group-title="卫视",北京卫视');
    expect(result.m3u).not.toContain('CCTV2');
  });

  it('creates only the raw result for unicast sources', () => {
    expect(filter('iptv/unicast/hebei/unicom')).toHaveLength(1);
  });

  it('creates one LAN proxy result per gateway for multicast sources', () => {
    const results = filter('iptv/multicast/hebei/unicom');

    expect(LAN_IP_PREFIXES).toHaveLength(13);
    expect(results).toHaveLength(1 + 13);
    expect(results.map(({ filename }) => filename)).toEqual([
      'iptv/multicast/hebei/unicom',
      ...LAN_IP_PREFIXES.map((p) => `iptv/multicast/hebei/unicom_${p.replace(/\./g, '_')}`),
    ]);

    const proxied = results.find(({ filename }) => filename.endsWith('_192_168_1'));
    expect(proxied?.m3u).toContain('http://192.168.1.1:23234/rtp/239.3.1.129:8008');
    expect(proxied?.m3u).toContain('http://192.168.1.1:23234/udp/239.3.1.241:8000');
    expect(proxied?.m3u).toContain('http://example.com/live.m3u8');
    expect(proxied?.channelCount).toBe(3);
  });
});

describe('replaceWithLanProxyUrl', () => {
  it('only rewrites rtp and udp urls', () => {
    expect(replaceWithLanProxyUrl('rtp://239.0.0.1:1234', '10.0.0')).toBe(
      'http://10.0.0.1:23234/rtp/239.0.0.1:1234'
    );
    expect(replaceWithLanProxyUrl('rtsp://1.2.3.4/live', '10.0.0')).toBe('rtsp://1.2.3.4/live');
  });

  it('uses the given proxy port', () => {
    expect(replaceWithLanProxyUrl('rtp://239.0.0.1:1234', '10.0.0', 4022)).toBe(
      'http://10.0.0.1:4022/rtp/239.0.0.1:1234'
    );
  });
});

describe('parseIptvProxyIpRanges', () => {
  it('expands ranges in any octet and removes duplicates', () => {
    expect(parseIptvProxyIpRanges(' 192.168.1-3 , 10.0-1.0, 192.168.2 ')).toEqual([
      '192.168.1',
      '192.168.2',
      '192.168.3',
      '10.0.0',
      '10.1.0',
    ]);
  });

  it('parses the default ranges into 13 prefixes', () => {
    expect(parseIptvProxyIpRanges(DEFAULT_IPTV_PROXY_IP_RANGES)).toHaveLength(13);
  });

  it.each(['', '192.168', '192.168.1.1', '192.168.10-1', '192.168.256', '192.168.a'])(
    'rejects invalid value %j',
    (value) => {
      expect(parseIptvProxyIpRanges(value)).toBeUndefined();
    }
  );
});

describe('IPTV proxy environment variables', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  const load = async () => {
    vi.resetModules();
    return import('../../src/sources/china_iptv');
  };

  it('uses defaults when not provided', async () => {
    vi.stubEnv('IPTV_PROXY_IP_RANGES', '');
    vi.stubEnv('IPTV_PROXY_PORT', '');
    const mod = await load();

    expect(mod.LAN_IP_PREFIXES).toHaveLength(13);
    expect(mod.IPTV_PROXY_PORT).toBe(23234);
  });

  it('reads custom ranges and port', async () => {
    vi.stubEnv('IPTV_PROXY_IP_RANGES', '172.16.0-1');
    vi.stubEnv('IPTV_PROXY_PORT', '4022');
    const mod = await load();

    expect(mod.LAN_IP_PREFIXES).toEqual(['172.16.0', '172.16.1']);
    expect(mod.IPTV_PROXY_PORT).toBe(4022);
    expect(mod.replaceWithLanProxyUrl('rtp://239.0.0.1:1234', '172.16.0')).toBe(
      'http://172.16.0.1:4022/rtp/239.0.0.1:1234'
    );
  });

  it('falls back to defaults on invalid values', async () => {
    vi.stubEnv('IPTV_PROXY_IP_RANGES', '192.168');
    vi.stubEnv('IPTV_PROXY_PORT', '70000');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mod = await load();

    expect(mod.LAN_IP_PREFIXES).toHaveLength(13);
    expect(mod.IPTV_PROXY_PORT).toBe(23234);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});

describe('parseChinaIptvFileName', () => {
  it('parses iptv file names', () => {
    expect(parseChinaIptvFileName('iptv/multicast/guangdong/broadent')).toEqual({
      type: 'multicast',
      province: 'guangdong',
      operator: 'broadent',
    });
    expect(parseChinaIptvFileName('iptv/multicast/beijing/unicom_192_168_1')).toBeUndefined();
    expect(parseChinaIptvFileName('q_bj_iptv_unicom_m')).toBeUndefined();
  });
});

describe('china_iptv_sources', () => {
  it('lists every upstream file', () => {
    expect(china_iptv_sources).toHaveLength(189);
    expect(new Set(china_iptv_sources.map(({ f_name }) => f_name)).size).toBe(189);
    expect(china_iptv_sources).toContainEqual(
      expect.objectContaining({
        name: 'CHINA-IPTV 北京 联通 组播',
        f_name: 'iptv/multicast/beijing/unicom',
        url: 'https://raw.githubusercontent.com/xisohi/CHINA-IPTV/main/Multicast/beijing/unicom.txt',
      })
    );
    expect(china_iptv_sources.filter(({ f_name }) => f_name.endsWith('/broadent'))).toHaveLength(3);
  });
});
