import { describe, expect, it } from 'vitest';

import { renderIptvRegionPage, renderLanIpList, renderSourceRows } from '../src/readme';

describe('renderSourceRows', () => {
  it('renders only the first result when a source has multiple outputs', () => {
    const markdown = renderSourceRows(
      [
        [
          { name: 'Multi source', f_name: 'multi_192_168_0' },
          { name: 'Multi source', f_name: 'multi_192_168_1' },
        ],
        [{ name: 'Single source', f_name: 'single' }],
      ],
      [
        [
          ['normal', 10],
          ['normal', 20],
        ],
        [['rollback', 30]],
      ]
    );

    expect(markdown).toContain('multi_192_168_0.m3u');
    expect(markdown).not.toContain('multi_192_168_1.m3u');
    expect(markdown).toContain('| 10 | - |');
    expect(markdown).toContain('single.m3u');
    expect(markdown).toContain('| 30 | ✅ |');
  });

  it('adds a more link for LAN outputs', () => {
    const markdown = renderSourceRows(
      [
        [
          { name: 'LAN source', f_name: 'lan' },
          { name: 'LAN source', f_name: 'lan_192_168_0' },
          { name: 'LAN source', f_name: 'lan_10_0_0' },
        ],
      ],
      [
        [
          ['normal', 10],
          ['normal', 10],
          ['normal', 10],
        ],
      ]
    );

    expect(markdown).toContain('**[局域网 IP 列表](/list/lan.more.list)**');
  });

  it('skips CHINA-IPTV sources in the channel table', () => {
    const markdown = renderSourceRows(
      [
        [{ name: 'CHINA-IPTV 北京 联通 单播', f_name: 'iptv/unicast/beijing/unicom' }],
        [{ name: 'Single source', f_name: 'single' }],
      ],
      [[['normal', 10]], [['normal', 20]]]
    );

    expect(markdown).not.toContain('iptv/');
    expect(markdown).toContain('single.m3u');
  });

  it('renders LAN IP links to their individual source lists', () => {
    const markdown = renderLanIpList([
      { name: 'CHINA-IPTV 北京 联通 组播', f_name: 'iptv/multicast/beijing/unicom' },
      { name: 'CHINA-IPTV 北京 联通 组播', f_name: 'iptv/multicast/beijing/unicom_192_168_0' },
      { name: 'CHINA-IPTV 北京 联通 组播', f_name: 'iptv/multicast/beijing/unicom_10_0_0' },
    ]);

    expect(markdown).toContain('[192.168.0.1](/list/iptv/multicast/beijing/unicom_192_168_0.list)');
    expect(markdown).toContain('[10.0.0.1](/list/iptv/multicast/beijing/unicom_10_0_0.list)');
    expect(markdown).not.toContain('(/list/iptv/multicast/beijing/unicom.list)');
  });

  it('ignores an empty source result group', () => {
    expect(renderSourceRows([[]], [[]])).toBe('');
  });
});

describe('renderIptvRegionPage', () => {
  const markdown = renderIptvRegionPage(
    [
      [
        { name: 'CHINA-IPTV 北京 联通 组播', f_name: 'iptv/multicast/beijing/unicom' },
        { name: 'CHINA-IPTV 北京 联通 组播', f_name: 'iptv/multicast/beijing/unicom_192_168_0' },
      ],
      [{ name: 'CHINA-IPTV 广东 广电 组播', f_name: 'iptv/multicast/guangdong/broadent' }],
      [{ name: 'CHINA-IPTV 北京 移动 单播', f_name: 'iptv/unicast/beijing/mobile' }],
      [{ name: 'Single source', f_name: 'single' }],
    ],
    [
      [
        ['normal', 86],
        ['normal', 86],
      ],
      [['normal', undefined]],
      [['normal', 120]],
      [['normal', 5]],
    ]
  );
  const [multicast, unicast] = markdown.split('## 🔗单播');

  it('renders multicast cells with proxy links', () => {
    expect(multicast).toContain('## 🛰️组播');
    expect(multicast).toContain(
      '| 地区 | <img src="https://chinaiptv.pages.dev/logo/unicom.png" alt="联通" height="24"> 联通 | <img src="https://chinaiptv.pages.dev/logo/broadent.png" alt="广电" height="24"> 广电 |'
    );
    expect(multicast).toContain(
      '| 北京 | [📺m3u](/iptv/multicast/beijing/unicom.m3u) [📄txt](/txt/iptv/multicast/beijing/unicom.txt) [📋列表](/list/iptv/multicast/beijing/unicom.list) [🏠代理](/list/iptv/multicast/beijing/unicom.more.list) <br> 🛰️86 个频道 | 🌐暂无 |'
    );
    expect(multicast).toContain('| 广东 | 🌐暂无 | ⚠️更新失败 |');
  });

  it('renders unicast cells without proxy links', () => {
    expect(unicast).toContain('alt="移动" height="24"> 移动 |');
    expect(unicast).toContain(
      '[📋列表](/list/iptv/unicast/beijing/mobile.list) <br> 🔗120 个频道 |'
    );
    expect(unicast).not.toContain('代理');
  });

  it('ignores non CHINA-IPTV sources', () => {
    expect(markdown).not.toContain('single');
  });

  it('describes the configured gateways and proxy port', () => {
    expect(markdown).toContain('192.168.0.1、192.168.1.1');
    expect(markdown).toContain('`http://<网关>:23234/rtp/...`');

    const custom = renderIptvRegionPage([], [], {
      lanIpPrefixes: ['172.16.0', '172.16.1'],
      proxyPort: 4022,
    });
    expect(custom).toContain('以下网关（172.16.0.1、172.16.1.1）');
    expect(custom).toContain('`http://<网关>:4022/rtp/...`');

    const many = renderIptvRegionPage([], [], {
      lanIpPrefixes: Array.from({ length: 20 }, (_, i) => `192.168.${i}`),
    });
    expect(many).toContain('以下网关（共 20 个网关）');
  });
});
