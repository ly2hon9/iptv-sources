import fs from 'fs';
import path from 'path';

import {
  CHINA_IPTV_OPERATORS,
  CHINA_IPTV_PROVINCES,
  CHINA_IPTV_SOURCE_PREFIX,
  CHINA_IPTV_TYPES,
  getChinaIptvFileName,
  getChinaIptvOperatorLogo,
  handle_m3u,
  IPTV_PROXY_PORT,
  LAN_IP_PREFIXES,
  parseChinaIptvFileName,
  type TChinaIptvOperator,
  type TChinaIptvType,
} from './sources';
import type { TEPGSource } from './epgs/utils';
import { get_from_info } from './utils';

export interface IREADMESource {
  name: string;
  f_name: string;
  count?: number | undefined;
}

export type TREADMESources = IREADMESource[][];
export type TREADMESourceResult = [status: string, channelCount: number | undefined];
export type TREADMESourceResults = TREADMESourceResult[][];
export type TREADMEEPGSources = TEPGSource[];

const LAN_IP_FILENAME_SUFFIX = /_(\d{1,3}_\d{1,3}_\d{1,3})$/;

const getLanIpDetails = (sourceGroup: IREADMESource[]) =>
  sourceGroup
    .map((source) => {
      const match = LAN_IP_FILENAME_SUFFIX.exec(source.f_name);
      if (!match) return undefined;

      return {
        ip: `${match[1].replace(/_/g, '.')}.1`,
        source,
      };
    })
    .filter((detail): detail is { ip: string; source: IREADMESource } => detail !== undefined);

const hasLanIpOutputs = (sourceGroup: IREADMESource[]) => getLanIpDetails(sourceGroup).length > 0;

const isChinaIptvGroup = (sourceGroup: IREADMESource[]) =>
  !!sourceGroup[0]?.name.startsWith(CHINA_IPTV_SOURCE_PREFIX);

const getMoreListName = (sourceGroup: IREADMESource[]) => {
  const firstSource = sourceGroup[0];
  if (!firstSource) return undefined;

  return firstSource.f_name.replace(LAN_IP_FILENAME_SUFFIX, '');
};

export const renderLanIpList = (sourceGroup: IREADMESource[]) => {
  const source = sourceGroup[0];
  if (!source) return '';

  const links = getLanIpDetails(sourceGroup)
    .map(({ ip, source: ipSource }) => `- [${ip}](/list/${ipSource.f_name}.list)`)
    .join('\n');

  return `# LAN IPs for **${source.name}**\n\n${links}\n\nUpdated at **${new Date()}**`;
};

const writeLanIpLists = (sources: TREADMESources) => {
  const listPath = path.join(path.resolve(), 'm3u', 'list');

  sources.forEach((sourceGroup) => {
    const source = sourceGroup[0];
    const moreListName = getMoreListName(sourceGroup);

    if (!source || !hasLanIpOutputs(sourceGroup) || !moreListName) {
      return;
    }

    const listFile =
      path.join(listPath, ...moreListName.split('/').filter(Boolean)) + '.more.list.md';
    fs.mkdirSync(path.dirname(listFile), { recursive: true });
    fs.writeFileSync(listFile, renderLanIpList(sourceGroup));
  });
};

export const renderSourceRows = (sources: TREADMESources, sourcesResults: TREADMESourceResults) =>
  sources
    .map((sourceGroup, index) => {
      const source = sourceGroup[0];
      const sourceResult = sourcesResults[index]?.[0];

      if (!source || isChinaIptvGroup(sourceGroup)) return '';

      const moreListName = getMoreListName(sourceGroup);
      const moreLink =
        hasLanIpOutputs(sourceGroup) && moreListName
          ? `<br> **[局域网 IP 列表](/list/${moreListName}.more.list)**`
          : '';

      return `| ${source.name} | [${source.f_name}.m3u](/${source.f_name}.m3u) <br> [${
        source.f_name
      }.txt](/txt/${source.f_name}.txt) | [List for ${source.name}](/list/${
        source.f_name
      }.list)${moreLink} | ${
        sourceResult?.[1] === undefined ? 'update failed' : sourceResult[1]
      } | ${sourceResult?.[0] === 'rollback' ? '✅' : '-'} |`;
    })
    .filter(Boolean)
    .join('\n');

const REPO_DOCS_URL = 'https://github.com/yunnysunny/iptv-sources/blob/main/docs';

const describeGateways = (lanIpPrefixes: string[]) => {
  const gateways = lanIpPrefixes.map((prefix) => `${prefix}.1`);
  return gateways.length <= 16 ? gateways.join('、') : `共 ${gateways.length} 个网关`;
};

export const renderIptvRegionPage = (
  sources: TREADMESources,
  sourcesResults: TREADMESourceResults,
  { lanIpPrefixes = LAN_IP_PREFIXES, proxyPort = IPTV_PROXY_PORT } = {}
) => {
  // f_name -> 频道数（undefined 表示拉取失败）
  const counts = new Map<string, number | undefined>();
  sources.forEach((sourceGroup, index) => {
    const source = sourceGroup[0];
    if (!source || !isChinaIptvGroup(sourceGroup) || !parseChinaIptvFileName(source.f_name)) {
      return;
    }

    counts.set(source.f_name, sourcesResults[index]?.[0]?.[1]);
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
        const f_name = getChinaIptvFileName({ type, province, operator });
        if (!counts.has(f_name)) return '🌐暂无';

        const count = counts.get(f_name);
        if (count === undefined) return '⚠️更新失败';

        const links = [
          `[📺m3u](/${f_name}.m3u)`,
          `[📄txt](/txt/${f_name}.txt)`,
          `[📋列表](/list/${f_name}.list)`,
        ];
        if (type === 'multicast') {
          links.push(`[🏠代理](/list/${f_name}.more.list)`);
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

- 🛰️**组播**：原始地址为 \`rtp://\`，需要在 IPTV 网络内通过 udpxy / rtp2httpd 转发后播放。「🏠代理」页面为以下网关（${describeGateways(lanIpPrefixes)}）生成了 \`http://<网关>:${proxyPort}/rtp/...\` 格式的地址，配置方法见 [OpenWrt udpxy 配置指南](${REPO_DOCS_URL}/openwrt-updpxy.md)、[OpenWrt igmpproxy 配置指南](${REPO_DOCS_URL}/blog-operator-iptv-igmpproxy.md)。
- 🔗**单播**：一般只能在对应运营商的 IPTV 网络内访问。

${renderTable('multicast')}

${renderTable('unicast')}

Updated at **${new Date()}**`;
};

const writeIptvRegionPage = (sources: TREADMESources, sourcesResults: TREADMESourceResults) => {
  const listPath = path.join(path.resolve(), 'm3u', 'list');
  fs.mkdirSync(listPath, { recursive: true });
  fs.writeFileSync(
    path.join(listPath, 'iptv.list.md'),
    renderIptvRegionPage(sources, sourcesResults)
  );
};

export const updateChannelList = (
  name: string,
  f_name: string,
  m3u: string,
  rollback: boolean = false
) => {
  const list_temp_p = path.join(path.resolve(), 'LIST.temp.md');
  const list = fs.readFileSync(list_temp_p, 'utf8').toString();

  const m3uArray = handle_m3u(m3u);
  const channelRegExp = /^#EXTINF:-1([^,]*),(.*)/;
  let i = 1;
  const channels: Array<string>[] = [];
  while (i < m3uArray.length) {
    const reg = channelRegExp.exec(m3uArray[i]);
    if (!reg) {
      i++;
      continue;
    }
    channels.push([
      reg[2].replace(/\|/g, '').trim(),
      get_from_info(m3uArray[i + 1]),
      m3uArray[i + 1],
    ]);
    i += 2;
  }

  const after = list
    .replace(
      '<!-- list_title_here -->',
      `# List for **${name}**${
        rollback ? '(Rollback)' : ''
      }\n\n> M3U: [${f_name}.m3u](/${f_name}.m3u), TXT: [${f_name}.txt](/txt/${f_name}.txt)`
    )
    .replace(
      '<!-- channels_here -->',
      `${channels
        ?.map((c, idx) => `| ${idx + 1} | ${c[0].replace('|', '')} | ${c[1]} | <${c[2]}> |`)
        .join('\n')}\n\nUpdated at **${new Date()}**`
    );

  const list_p = path.join(path.resolve(), 'm3u', 'list');
  // f_name 可能带文件夹前缀（如 `fmml/ipv6`），需要递归创建父目录
  const list_file = path.join(list_p, ...f_name.split('/').filter(Boolean)) + '.list.md';

  fs.mkdirSync(path.dirname(list_file), { recursive: true });

  fs.writeFileSync(list_file, after);
};

export const updateReadme = (
  sources: TREADMESources,
  sources_res: TREADMESourceResults,
  epgs: TREADMEEPGSources,
  epgs_res: Array<[string | undefined]>
) => {
  const readme_temp_p = path.join(path.resolve(), 'README.temp.md');
  const readme = fs.readFileSync(readme_temp_p, 'utf8').toString();

  const after = readme
    .replace('<!-- channels_here -->', renderSourceRows(sources, sources_res))
    .replace(
      '<!-- epgs_here -->',
      `${epgs
        ?.map(
          (e, idx) =>
            `| ${e.name} | [${e.f_name}.xml](/epg/${e.f_name}.xml) | ${
              epgs_res?.[idx]?.[0]
                ? epgs_res?.[idx]?.[0] === 'rollback'
                  ? '✅'
                  : '-'
                : 'update failed'
            } |`
        )
        .join('\n')}
| epg.pw（中国地区聚合） | [epg_pw.xml.gz](/epg/epg_pw.xml.gz) | 独立构建 |

\n\nUpdated at **${new Date()}**`
    );

  writeLanIpLists(sources);
  writeIptvRegionPage(sources, sources_res);

  if (!fs.existsSync(path.join(path.resolve(), 'm3u'))) {
    fs.mkdirSync(path.join(path.resolve(), 'm3u'));
  }

  fs.writeFileSync(path.join(path.resolve(), 'm3u', 'README.md'), after);
};
