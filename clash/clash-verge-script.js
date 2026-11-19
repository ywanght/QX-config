// ============================================================
// Clash Verge Rev 全局扩展脚本 (Global Extend Script)
// Author : wanght
// Repo   : https://github.com/ywanght/QX-config
//
// 核心特性：
//   1. 自动接管任意机场订阅（保留节点，完全替换机场自带的粗糙规则和 DNS）
//   2. 所有个人规则（直连/去广告/AI通用/Claude专属/进程直连）均自动同步自
//      GitHub 仓库 QX-config/rules/*.list（圈X主规则单源维护）
//   3. 按地区智能分组（香港/台湾/日本/新加坡/美国/欧洲），AI 组自动彻底排除香港节点
//   4. 进程级强制直连（DingTalk.exe / Weixin.exe / WeChatAppEx.exe 等）+
//      防 Fake-IP 污染的黄金 DNS，彻底根治钉钉断连与微信发图/朋友圈裂图
// ============================================================

const RAW_BASE = "https://raw.githubusercontent.com/ywanght/QX-config/main/clash/rules";
const META_GEOSITE = "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite";
const META_GEOIP = "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip";

const TEST_URL = "https://www.gstatic.com/generate_204";

// 过滤掉机场信息占位节点（如“剩余流量”、“套餐到期”、“官网”、“教程”、“客户端”等）
const INFO_NODE_REGEX = /剩余|流量|到期|过期|套餐|官网|网址|重置|更新|通知|维护|群组|频道|联系|测试|教程|客户端|安卓|第三方|舍弃|无法使用|Expire|Traffic|Reset/i;

const REGION_DEFS = [
  { name: "🇭🇰 香港节点", regex: /🇭🇰|香港|港|HK|Hong\s?Kong/i },
  { name: "🇸🇬 新加坡节点", regex: /🇸🇬|新加坡|狮城|坡|SG|Singapore/i },
  { name: "🇯🇵 日本节点", regex: /🇯🇵|日本|东京|大阪|JP|Japan/i },
  { name: "🇺🇸 美国节点", regex: /🇺🇸|美国|美|US|United\s?States|America/i },
  { name: "🇹🇼 台湾节点", regex: /🇹🇼|台湾|台北|台|TW|Taiwan/i },
  { name: "🇪🇺 欧洲节点", regex: /🇬🇧|🇩🇪|🇫🇷|🇳🇱|🇸🇪|🇨🇭|英国|德国|法国|荷兰|瑞典|瑞士|欧洲|UK|GB|DE|FR|NL|SE|EU/i },
];

// 专门筛选“非香港、非澳门、非中国”的 AI 可用节点
const NON_HK_EXCLUDE_REGEX = /🇭🇰|🇲🇴|🇨🇳|香港|澳门|中国|回国|HK|MO|CN|Hong\s?Kong|Macau/i;
// 优先匹配机场专门标注的 GPT/AI 优化节点（排除欧洲节点，避免 Gemini/Grok 触发欧盟 GDPR 限制）
const EU_REGEX = /🇬🇧|🇩🇪|🇫🇷|🇳🇱|🇸🇪|🇨🇭|英国|德国|法国|荷兰|瑞典|瑞士|欧洲|UK|GB|DE|FR|NL|SE|EU/i;
// 优先匹配家宽 / 住宅 IP 节点（Claude / Meta Muse 强风控保号专用）
const RESIDENTIAL_REGEX = /家宽|住宅|ISP|Residential|4837家宽|芝加哥家宽/i;
const AI_OPT_REGEX = /GPT|AI|OpenAI|大厂优化|解锁/i;

function main(config, profileName) {
  const proxies = Array.isArray(config.proxies) ? config.proxies : [];
  if (proxies.length === 0) {
    return config;
  }

  // 1. 提取有效代理节点名
  const allNames = proxies
    .map((p) => p && p.name)
    .filter((name) => typeof name === "string" && name.trim() !== "" && !INFO_NODE_REGEX.test(name));

  const validNames = allNames.length > 0 ? allNames : proxies.map((p) => p.name);

  // 2. 按地区归类节点
  const regionGroups = [];
  const availableRegionNames = [];
  for (const r of REGION_DEFS) {
    const matched = validNames.filter((n) => r.regex.test(n));
    if (matched.length > 0) {
      availableRegionNames.push(r.name);
      regionGroups.push({
        name: r.name,
        type: "url-test",
        proxies: matched,
        url: TEST_URL,
        interval: 300,
        tolerance: 50,
      });
    }
  }

  // 3. 构建非港 AI 可用节点池（自动优选优先非港且非欧的 GPT/大厂优化节点）
  const nonHkNodes = validNames.filter((n) => !NON_HK_EXCLUDE_REGEX.test(n));
  const nonHkNonEuNodes = nonHkNodes.filter((n) => !EU_REGEX.test(n));
  const aiPreferredNodes = nonHkNonEuNodes.filter((n) => AI_OPT_REGEX.test(n));
  const aiAutoPool = aiPreferredNodes.length > 0
    ? aiPreferredNodes
    : (nonHkNonEuNodes.length > 0 ? nonHkNonEuNodes : (nonHkNodes.length > 0 ? nonHkNodes : validNames));

  // Claude / Muse 强风控保号组：只列具体单节点（严禁放入 url-test 自动切 IP 组！）
  // 优先置顶非港「家宽」单节点（默认第一个即为美国/日本家宽），彻底杜绝自动换 IP 封号
  const residentialNonHk = nonHkNonEuNodes.filter((n) => RESIDENTIAL_REGEX.test(n));
  const usResidential = residentialNonHk.filter((n) => /🇺🇸|美国|美|US/i.test(n));
  const otherResidential = residentialNonHk.filter((n) => !/🇺🇸|美国|美|US/i.test(n));
  const claudeProxies = [
    ...usResidential,
    ...otherResidential,
    ...nonHkNonEuNodes,
    ...nonHkNodes,
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  // AI 通用候选：默认走“AI自动优选(非港)”，也可随时切新加坡/日本/美国或具体节点
  const aiGeneralRegions = ["🇸🇬 新加坡节点", "🇯🇵 日本节点", "🇺🇸 美国节点", "🇹🇼 台湾节点"]
    .filter((r) => availableRegionNames.includes(r));
  const aiGeneralProxies = [
    "⚡ AI自动优选(非港)",
    ...aiGeneralRegions,
    ...aiPreferredNodes,
    ...nonHkNodes,
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  // 4. 组装策略组
  config["proxy-groups"] = [
    {
      name: "🚀 节点选择",
      type: "select",
      proxies: [
        "♻️ 自动选择",
        ...availableRegionNames,
        "DIRECT",
        ...validNames,
      ],
    },
    {
      name: "♻️ 自动选择",
      type: "url-test",
      proxies: validNames,
      url: TEST_URL,
      interval: 300,
      tolerance: 50,
    },
    {
      name: "🤖 AI 通用",
      type: "select",
      proxies: aiGeneralProxies,
    },
    {
      name: "🔒 Claude/Muse 防封家宽",
      type: "select",
      proxies: claudeProxies.length > 0 ? claudeProxies : ["🚀 节点选择"],
    },
    {
      name: "⚡ AI自动优选(非港)",
      type: "url-test",
      proxies: aiAutoPool,
      url: TEST_URL,
      interval: 300,
      tolerance: 50,
    },
    {
      name: "📺 YouTube",
      type: "select",
      proxies: ["🚀 节点选择", ...availableRegionNames, "DIRECT"],
    },
    {
      name: "✈️ Telegram",
      type: "select",
      proxies: ["🚀 节点选择", ...availableRegionNames, "DIRECT"],
    },
    {
      name: "💻 GitHub / 开发",
      type: "select",
      proxies: ["🚀 节点选择", ...availableRegionNames, "DIRECT"],
    },
    {
      name: "🎯 全球直连",
      type: "select",
      proxies: ["DIRECT", "🚀 节点选择"],
    },
    {
      name: "🛑 广告拦截",
      type: "select",
      proxies: ["REJECT", "DIRECT"],
    },
    {
      name: "🐟 漏网之鱼",
      type: "select",
      proxies: ["🚀 节点选择", "DIRECT", ...availableRegionNames],
    },
    ...regionGroups,
  ];

  // 5. 核心通用优化（开启进程识别 + TCP 并发 + 统一延迟）
  config["find-process-mode"] = "always";
  config["tcp-concurrent"] = true;
  config["unified-delay"] = true;
  config["keep-alive-interval"] = 30;
  config["global-client-fingerprint"] = "chrome";

  // 6. 黄金 DNS 配置（国内直连阿里/腾讯 DoH，防止微信/钉钉/股票被 Fake-IP 污染）
  config["dns"] = {
    enable: true,
    ipv6: false,
    "prefer-h3": false,
    "respect-rules": true,
    "enhanced-mode": "fake-ip",
    "fake-ip-range": "198.18.0.1/16",
    "fake-ip-filter": [
      "*.lan",
      "*.local",
      "localhost.ptlogin2.qq.com",
      "localhost.sec.qq.com",
      "+.srv.nintendo.net",
      "+.stun.playstation.net",
      "xbox.*.microsoft.com",
      "+.xboxlive.com",
      "+.msftconnecttest.com",
      "+.msftncsi.com",
      // 微信 / 钉钉 / 金融行情跳过 Fake-IP，直接返回真实国内 IP
      "+.qpic.cn",
      "+.qlogo.cn",
      "+.gtimg.com",
      "+.qq.com",
      "+.weixin.qq.com",
      "+.wechat.com",
      "+.dingtalk.com",
      "+.alicdn.com",
      "+.eastmoney.com",
      "+.baostock.com",
    ],
    "default-nameserver": ["223.5.5.5", "119.29.29.29"],
    "proxy-server-nameserver": ["https://dns.alidns.com/dns-query", "https://doh.pub/dns-query"],
    nameserver: ["https://dns.alidns.com/dns-query", "https://doh.pub/dns-query"],
    "nameserver-policy": {
      "geosite:cn,private": ["https://dns.alidns.com/dns-query", "https://doh.pub/dns-query"],
      "geosite:geolocation-!cn": ["https://dns.cloudflare.com/dns-query", "https://dns.google/dns-query"],
    },
  };

  // 7. 域名嗅探配置（避免嗅探国内行情/微信/钉钉引发异常）
  config["sniffer"] = {
    enable: true,
    "force-dns-mapping": true,
    "parse-pure-ip": true,
    "override-destination": false,
    sniff: {
      HTTP: { ports: [80, "8080-8880"], "override-destination": false },
      TLS: { ports: [443, 8443] },
      QUIC: { ports: [443, 8443] },
    },
    "skip-domain": [
      "Mijia Cloud",
      "+.push.apple.com",
      "+.eastmoney.com",
      "+.baostock.com",
      "+.qq.com",
      "+.qpic.cn",
      "+.wechat.com",
      "+.dingtalk.com",
    ],
  };

  // 8. 规则集（Rule Providers）：个人主库(自动同步自圈X) + MetaCubeX 官方二进制 .mrs 规则库
  config["rule-providers"] = {
    // ── 个人自维护规则（同步自 ywanght/QX-config/rules/*.list） ──
    custom_process_direct: {
      type: "http",
      behavior: "classical",
      format: "yaml",
      url: `${RAW_BASE}/desktop-process.yaml`,
      path: "./ruleset/qx_desktop_process.yaml",
      interval: 3600,
    },
    custom_direct: {
      type: "http",
      behavior: "classical",
      format: "yaml",
      url: `${RAW_BASE}/direct.yaml`,
      path: "./ruleset/qx_direct.yaml",
      interval: 3600,
    },
    custom_reject: {
      type: "http",
      behavior: "classical",
      format: "yaml",
      url: `${RAW_BASE}/reject.yaml`,
      path: "./ruleset/qx_reject.yaml",
      interval: 3600,
    },
    custom_ai_claude: {
      type: "http",
      behavior: "classical",
      format: "yaml",
      url: `${RAW_BASE}/ai-claude.yaml`,
      path: "./ruleset/qx_ai_claude.yaml",
      interval: 3600,
    },
    custom_ai_general: {
      type: "http",
      behavior: "classical",
      format: "yaml",
      url: `${RAW_BASE}/ai-general.yaml`,
      path: "./ruleset/qx_ai_general.yaml",
      interval: 3600,
    },

    // ── MetaCubeX 官方高速二进制规则集 (.mrs) ──
    meta_ai_non_cn: {
      type: "http",
      behavior: "domain",
      format: "mrs",
      url: `${META_GEOSITE}/category-ai-!cn.mrs`,
      path: "./ruleset/meta_ai_non_cn.mrs",
      interval: 86400,
    },
    meta_youtube: {
      type: "http",
      behavior: "domain",
      format: "mrs",
      url: `${META_GEOSITE}/youtube.mrs`,
      path: "./ruleset/meta_youtube.mrs",
      interval: 86400,
    },
    meta_telegram_domain: {
      type: "http",
      behavior: "domain",
      format: "mrs",
      url: `${META_GEOSITE}/telegram.mrs`,
      path: "./ruleset/meta_telegram_domain.mrs",
      interval: 86400,
    },
    meta_telegram_ip: {
      type: "http",
      behavior: "ipcidr",
      format: "mrs",
      url: `${META_GEOIP}/telegram.mrs`,
      path: "./ruleset/meta_telegram_ip.mrs",
      interval: 86400,
    },
    meta_github: {
      type: "http",
      behavior: "domain",
      format: "mrs",
      url: `${META_GEOSITE}/github.mrs`,
      path: "./ruleset/meta_github.mrs",
      interval: 86400,
    },
    meta_apple: {
      type: "http",
      behavior: "domain",
      format: "mrs",
      url: `${META_GEOSITE}/apple-cn.mrs`,
      path: "./ruleset/meta_apple_cn.mrs",
      interval: 86400,
    },
    meta_private: {
      type: "http",
      behavior: "domain",
      format: "mrs",
      url: `${META_GEOSITE}/private.mrs`,
      path: "./ruleset/meta_private.mrs",
      interval: 86400,
    },
    meta_cn_domain: {
      type: "http",
      behavior: "domain",
      format: "mrs",
      url: `${META_GEOSITE}/cn.mrs`,
      path: "./ruleset/meta_cn_domain.mrs",
      interval: 86400,
    },
    meta_cn_ip: {
      type: "http",
      behavior: "ipcidr",
      format: "mrs",
      url: `${META_GEOIP}/cn.mrs`,
      path: "./ruleset/meta_cn_ip.mrs",
      interval: 86400,
    },
    meta_geolocation_non_cn: {
      type: "http",
      behavior: "domain",
      format: "mrs",
      url: `${META_GEOSITE}/geolocation-!cn.mrs`,
      path: "./ruleset/meta_geolocation_non_cn.mrs",
      interval: 86400,
    },
  };

  // 9. 分流规则（严格按优先级从高到低排列）
  config["rules"] = [
    // ① 桌面端进程级强制直连（钉钉/微信/网盘，最高优先级，彻底免疫代理波动）
    "RULE-SET,custom_process_direct,DIRECT",

    // ② 个人自定义直连（微信 CDN / 钉钉 / 国内 AI / 股票 / Strava / 内网）
    "RULE-SET,custom_direct,🎯 全球直连",

    // ③ 个人自定义去广告（同步自圈X reject.list）
    "RULE-SET,custom_reject,🛑 广告拦截",

    // ④ Claude / Meta Muse 强风控保号分流（锁定单一非港家宽 IP，严禁自动切 IP）
    "PROCESS-NAME,Muse,🔒 Claude/Muse 防封家宽",
    "PROCESS-NAME,claude,🔒 Claude/Muse 防封家宽",
    "RULE-SET,custom_ai_claude,🔒 Claude/Muse 防封家宽",

    // ⑤ AI 通用分流（自维护最新列表 + MetaCubeX 官方大库兜底，彻底避开香港）
    "RULE-SET,custom_ai_general,🤖 AI 通用",
    "RULE-SET,meta_ai_non_cn,🤖 AI 通用",

    // ⑥ 常用海外服务
    "RULE-SET,meta_youtube,📺 YouTube",
    "RULE-SET,meta_telegram_domain,✈️ Telegram",
    "RULE-SET,meta_telegram_ip,✈️ Telegram,no-resolve",
    "RULE-SET,meta_github,💻 GitHub / 开发",

    // ⑦ 本地/局域网 & 苹果国内服务 & 国内域名/IP 直连
    "RULE-SET,meta_private,DIRECT",
    "IP-CIDR,127.0.0.0/8,DIRECT,no-resolve",
    "IP-CIDR,10.0.0.0/8,DIRECT,no-resolve",
    "IP-CIDR,172.16.0.0/12,DIRECT,no-resolve",
    "IP-CIDR,192.168.0.0/16,DIRECT,no-resolve",
    "RULE-SET,meta_apple,🎯 全球直连",
    "RULE-SET,meta_cn_domain,🎯 全球直连",
    "RULE-SET,meta_geolocation_non_cn,🚀 节点选择",
    "RULE-SET,meta_cn_ip,🎯 全球直连",

    // ⑧ 兜底
    "MATCH,🐟 漏网之鱼",
  ];

  return config;
}
