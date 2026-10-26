import type { TSources } from './utils';

/**
 * vbskycn/iptv 发布在 live.zbds.top 的列表。
 * 只接入 IPv4 版本：iptv6.m3u 目前只剩一条「更新时间」占位条目，没有真实频道。
 */
export const zbdsSources: TSources = [
  {
    name: 'vbskycn/iptv ipv4',
    filename: 'zbds_ipv4',
    url: 'https://live.zbds.top/tv/iptv4.m3u',
  },
];
