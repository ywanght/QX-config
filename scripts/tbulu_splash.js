/**
 * 两步路 (2bulu) 开屏广告清空脚本
 * 触发接口：^https?:\/\/helper\.2bulu\.com\/getSplash
 * 作用：返回空的广告列表，跳过开屏广告展示
 */

let body = JSON.stringify({
  errCode: "0",
  infos: []
});

$done({ body });
