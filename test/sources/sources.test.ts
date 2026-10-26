import { describe, expect, it } from 'vitest';
import { getContent } from '../../src/file';
import { collectSourceUrls } from '../../src/pipeline/sources';
import { playlistToTxt } from '../../src/playlist';
import { buildSourceOutputs, sources } from '../../src/sources';
import { hotelTvnSources } from '../../src/sources/hotel_tvn';
import { youhunSources } from '../../src/sources/youhun';
import { zbdsSources } from '../../src/sources/zbds';
describe('sources', () => {
  it('sources should be a non-empty array', () => {
    expect(Array.isArray(sources)).toBe(true);
    expect(sources.length).toBeGreaterThan(0);
  });

  it('each source should match ISource structure', () => {
    for (const sr of sources) {
      expect(sr).toHaveProperty('name');
      expect(sr).toHaveProperty('filename');
      expect(sr).toHaveProperty('url');
    }
  });
});

describe('zbdsSources', () => {
  it('should only contain the ipv4 source', () => {
    expect(zbdsSources).toHaveLength(1);
    expect(zbdsSources[0].filename).toBe('zbds_ipv4');
  });

  it('should be registered in sources', () => {
    expect(sources).toContain(zbdsSources[0]);
  });

  it('url should point to m3u', () => {
    for (const s of zbdsSources) {
      expect(s.url).toMatch(/\.m3u$/);
    }
  });
});

describe('hotelTvnSources', () => {
  it('should contain hotel_tvn source', () => {
    expect(hotelTvnSources).toHaveLength(1);
    expect(hotelTvnSources[0].filename).toBe('hotel_tvn');
  });
});

describe('youhunSources', () => {
  it('should collect youhun live data and get m3u data structure', { timeout: 15000 }, async () => {
    const sr = youhunSources[0];
    const [ok, text] = await getContent(sr);
    expect(ok).toBe(true);
    expect(text).toBeDefined();
    expect(typeof text).toBe('string');
    expect((text as string).length).toBeGreaterThan(0);

    const outputs = buildSourceOutputs(sr, text as string);
    const [result] = outputs;

    expect(result.filename).toBe(sr.filename);
    expect(result.playlist.channels.length).toBeGreaterThan(0);
    expect(result.playlist.header?.startsWith('#EXTM3U')).toBe(true);

    const collected = collectSourceUrls(sr, outputs);
    expect(collected.size).toBeGreaterThan(0);
    for (const [, urls] of collected) {
      expect(Array.isArray(urls)).toBe(true);
      expect(urls.length).toBeGreaterThan(0);
      expect(urls.every((u) => typeof u === 'string' && u.length > 0)).toBe(true);
    }

    const txt = playlistToTxt(result.playlist);
    expect(typeof txt).toBe('string');
    expect(txt.length).toBeGreaterThan(0);
  });
});
