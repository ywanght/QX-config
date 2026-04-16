/**
 * 行者骑行 (imxingzhe) 去广告脚本
 * 触发接口：^https:\/\/www\.imxingzhe\.com\/api\/v(?:1|4)\/.*
 * 作用：清空响应体中的首页在线广告列表 (home_page_online)
 */

if ($response.body) {
  let body = $response.body;
  body = body.replace(/"home_page_online":\[[\s\S]*?\]/, '"home_page_online":[]');
  $done({ body });
} else {
  $done({});
}
