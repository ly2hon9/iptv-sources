import { chinaIptvSources } from './china_iptv';
// import { cymz6LivesSources } from './cymz6_lives';
import { epgPwSources } from './epg_pw';
// import { fanmingmingLiveSources } from './fanmingming_live';
import { hotelTvnSources } from './hotel_tvn';
// import { iptvOrgSources, iptvOrgStreamSources } from './iptv_org';
// import { joevessIptvSources } from './joevess_iptv';
import { qwerttvvBjIptvSources } from './qwerttvv_bj_iptv';
// import { yangM3uSources } from './yang_m3u';
// import { youhunSources } from './youhun';
// import { yuechanLiveSources } from './yuechan_live';
// import { zbdsSources } from './zbds';
import type { TSources } from './utils';

export * from './china_iptv';
export * from './lan_proxy';
export * from './utils';

export const sources: TSources = [
  // ...fanmingmingLiveSources,
  // ...yuechanLiveSources,
  // ...cymz6LivesSources,
  // ...yangM3uSources,
  // ...joevessIptvSources,
  // ...iptvOrgSources,
  // ...iptvOrgStreamSources,
  ...hotelTvnSources,
  ...epgPwSources,
  ...qwerttvvBjIptvSources,
  ...chinaIptvSources,
  // ...youhunSources,
  // ...zbdsSources,
];
