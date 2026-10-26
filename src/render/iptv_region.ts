import type { ISourceBuildResult } from '../pipeline/sources';
import {
  CHINA_IPTV_OPERATORS,
  CHINA_IPTV_PROVINCES,
  CHINA_IPTV_TYPES,
  getChinaIptvFileName,
  getChinaIptvOperatorLogo,
  IPTV_PROXY_PORT,
  LAN_IP_PREFIXES,
  parseChinaIptvFileName,
  type TChinaIptvOperator,
  type TChinaIptvType,
} from '../sources';
import { isChinaIptvResult } from './readme';

const describeGateways = (lanIpPrefixes: string[]) => {
  const gateways = lanIpPrefixes.map((prefix) => `${prefix}.1`);
  return gateways.length <= 16 ? gateways.join('、') : `共 ${gateways.length} 个网关`;
};

/** CHINA-IPTV 按省份 × 运营商排列的总览页 */
export const renderIptvRegionPage = (
  results: ISourceBuildResult[],
  { lanIpPrefixes = LAN_IP_PREFIXES, proxyPort = IPTV_PROXY_PORT } = {}
) => {
  // filename -> 频道数（undefined 表示拉取失败）
  const counts = new Map<string, number | undefined>();
  results.forEach((result) => {
    const { filename } = result.source;
    if (!isChinaIptvResult(result) || !parseChinaIptvFileName(filename)) return;

    counts.set(filename, result.outputs[0]?.channelCount);
  });

  const renderTable = (type: TChinaIptvType) => {
    const operators = (Object.keys(CHINA_IPTV_OPERATORS) as TChinaIptvOperator[]).filter(
      (operator) =>
        Object.keys(CHINA_IPTV_PROVINCES).some((province) =>
          counts.has(getChinaIptvFileName({ type, province, operator }))
        )
    );
    if (!operators.length) return '';

    const { icon, label } = CHINA_IPTV_TYPES[type];
    const rows = Object.entries(CHINA_IPTV_PROVINCES).map(([province, provinceName]) => {
      const columns = operators.map((operator) => {
        const filename = getChinaIptvFileName({ type, province, operator });
        if (!counts.has(filename)) return '🌐暂无';

        const count = counts.get(filename);
        if (count === undefined) return '⚠️更新失败';

        const links = [
          `[📺m3u](/${filename}.m3u)`,
          `[📄txt](/txt/${filename}.txt)`,
          `[📋列表](/list/${filename}.list)`,
        ];
        if (type === 'multicast') {
          links.push(`[🏠代理](/list/${filename}.more.list)`);
        }
        return `${links.join(' ')} <br> ${icon}${count} 个频道`;
      });
      return `| ${provinceName} | ${columns.join(' | ')} |`;
    });

    return [
      `## ${icon}${label}`,
      '',
      `| 地区 | ${operators
        .map(
          (operator) =>
            `<img src="${getChinaIptvOperatorLogo(operator)}" alt="${
              CHINA_IPTV_OPERATORS[operator]
            }" height="24"> ${CHINA_IPTV_OPERATORS[operator]}`
        )
        .join(' | ')} |`,
      `| --- | ${operators.map(() => '---').join(' | ')} |`,
      ...rows,
    ].join('\n');
  };

  return `# 🏄‍♀️运营商 IPTV 分地区列表

数据来自 [xisohi/CHINA-IPTV](https://github.com/xisohi/CHINA-IPTV)，按省份和运营商整理。

- 🛰️**组播**：原始地址为 \`rtp://\`，需要在 IPTV 网络内通过 udpxy / rtp2httpd 转发后播放。「🏠代理」页面为以下网关（${describeGateways(lanIpPrefixes)}）生成了 \`http://<网关>:${proxyPort}/rtp/...\` 格式的地址，配置方法见 [OpenWrt udpxy 配置指南](https://mp.weixin.qq.com/s/2BK9NeseH6v-BfGyUl9bGQ)、[OpenWrt igmpproxy 配置指南](https://mp.weixin.qq.com/s/NJvs0mclu6RdUKB-MRbNJA)、[OpenWrt rtp2httpd 配置指南](https://mp.weixin.qq.com/s/5NMVUt8yGiBGdUeaEC6jZw)。
- 🔗**单播**：一般只能在对应运营商的 IPTV 网络内访问。

${renderTable('multicast')}

${renderTable('unicast')}

Updated at **${new Date()}**`;
};
