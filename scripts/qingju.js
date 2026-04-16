/**
 * 青桔单车 (DiDi 青桔小程序) 去广告脚本
 * 触发接口：^https:\/\/htwkop\.xiaojukeji\.com\/gateway\?api=hm\.fa\.homeConfig
 * 作用：
 *   - 将开屏广告展示时长归零（show_time / delay_time / ad_time）
 *   - 过滤首页模块列表中 type 包含 "ad" 的广告模块
 */

if ($response.body) {
  let obj = JSON.parse($response.body);
  if (obj && obj.data) {
    if (obj.data.show_time) obj.data.show_time = 0;
    if (obj.data.delay_time) obj.data.delay_time = 0;
    if (obj.data.ad_time) obj.data.ad_time = 0;
    if (Array.isArray(obj.data.modules)) {
      obj.data.modules = obj.data.modules.filter(m => !m.type.includes('ad'));
    }
  }
  $done({ body: JSON.stringify(obj) });
} else {
  $done({});
}
