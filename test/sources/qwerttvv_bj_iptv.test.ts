import { afterEach, describe, expect, it, vi } from 'vitest';

import { LAN_IP_PREFIXES } from '../../src/sources/china_iptv';
import {
  qwerttvv_bj_iptv_filter,
  qwerttvv_bj_iptv_sources,
} from '../../src/sources/qwerttvv_bj_iptv';
import { normalizeSourceFilterResults } from '../../src/sources/utils';

const raw = [
  '#EXTM3U',
  '#EXTINF:-1,HTTP Channel',
  'http://192.168.123.1:23234/rtp/239.3.1.118:8001',
  '#EXTINF:-1,RTP Channel',
  'rtp://239.3.1.159:8000',
].join('\n');

describe('qwerttvv_bj_iptv_filter', () => {
  it('creates one result for every supported LAN IP prefix', () => {
    const results = normalizeSourceFilterResults(
      qwerttvv_bj_iptv_filter(raw, 'skip', undefined, 'q_bj_iptv')
    );

    expect(LAN_IP_PREFIXES).toHaveLength(13);
    expect(results).toHaveLength(13);
    expect(results.map(({ filename }) => filename)).toEqual(
      LAN_IP_PREFIXES.map((p) => `bj_iptv/q_bj_iptv_${p.replace(/\./g, '_')}`)
    );
    expect(results[0].filename).toBe('bj_iptv/q_bj_iptv_192_168_0');
    expect(results[12].filename).toBe('bj_iptv/q_bj_iptv_10_0_0');
  });

  it('rewrites HTTP and RTP channel URLs to each LAN gateway', () => {
    const results = normalizeSourceFilterResults(
      qwerttvv_bj_iptv_filter(raw, 'skip', undefined, 'q_bj_iptv')
    );
    const result = results.find(({ filename }) => filename === 'bj_iptv/q_bj_iptv_192_168_6');

    expect(result).toBeDefined();
    expect(result?.m3u).toContain('http://192.168.6.1:23234/rtp/239.3.1.118:8001');
    expect(result?.m3u).toContain('http://192.168.6.1:23234/rtp/239.3.1.159:8000');
    expect(result?.m3u).not.toContain('192.168.123.1');
    expect(result?.channelCount).toBe(2);
  });

  it('collects rewritten URLs from every generated result', () => {
    const collectFn = vi.fn();

    qwerttvv_bj_iptv_filter(raw, 'normal', collectFn, 'q_bj_iptv');

    expect(collectFn).toHaveBeenCalledTimes(13 * 2);
    expect(collectFn).toHaveBeenCalledWith(
      'http channel',
      'http://10.0.0.1:23234/rtp/239.3.1.118:8001'
    );
  });
});

describe('qwerttvv_bj_iptv multicast sources', () => {
  it.each(['q_bj_iptv_unicom_m', 'q_bj_iptv_mobile_m'])(
    'preserves channel URLs and emits one playlist for %s',
    (filename) => {
      const source = qwerttvv_bj_iptv_sources.find(({ f_name }) => f_name === filename);
      expect(source).toBeDefined();

      const collectFn = vi.fn();
      const results = normalizeSourceFilterResults(
        source!.filter(raw, 'normal', collectFn, filename)
      );

      expect(results).toEqual([{ filename, m3u: raw, channelCount: 2 }]);
      expect(collectFn).toHaveBeenCalledTimes(2);
      expect(collectFn).toHaveBeenCalledWith(
        'http channel',
        'http://192.168.123.1:23234/rtp/239.3.1.118:8001'
      );
      expect(collectFn).toHaveBeenCalledWith('rtp channel', 'rtp://239.3.1.159:8000');
    }
  );
});

describe('qwerttvv_bj_iptv proxy environment variables', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('follows IPTV_PROXY_IP_RANGES and IPTV_PROXY_PORT', async () => {
    vi.stubEnv('IPTV_PROXY_IP_RANGES', '172.16.0-1');
    vi.stubEnv('IPTV_PROXY_PORT', '4022');
    vi.resetModules();
    const mod = await import('../../src/sources/qwerttvv_bj_iptv');

    const results = normalizeSourceFilterResults(
      mod.qwerttvv_bj_iptv_filter(raw, 'skip', undefined, 'q_bj_iptv')
    );

    expect(results.map(({ filename }) => filename)).toEqual([
      'bj_iptv/q_bj_iptv_172_16_0',
      'bj_iptv/q_bj_iptv_172_16_1',
    ]);
    expect(results[1].m3u).toContain('http://172.16.1.1:4022/rtp/239.3.1.118:8001');
    expect(results[1].m3u).toContain('http://172.16.1.1:4022/rtp/239.3.1.159:8000');
  });
});
