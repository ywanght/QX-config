/**
 * 两步路 (2bulu) 去广告 · 合并脚本
 * 一份脚本管两个接口，按请求地址自动分流：
 *
 *   /adConfig/get  → 广告总开关改为关闭（splashAd/interstitialAd on:false）
 *                    App 认为广告关闭，不去调 TopOn(Taku) SDK，开屏秒过
 *   /getSplash     → 返回空广告列表，挡自售开屏素材
 *
 * 配套 rewrite（[rewrite_local]，两行用同一个脚本 URL）：
 *   ^https?:\/\/helper\.2bulu\.com\/adConfig\/get url script-response-body <此脚本URL>
 *   ^https?:\/\/helper\.2bulu\.com\/getSplash(\?|$) url script-response-body <此脚本URL>
 *
 * 前提：开启 MitM，hostname 包含 helper.2bulu.com
 */

const url = $request.url;

if (url.indexOf('/adConfig/get') !== -1) {
    // 广告总开关：关
    let body = $response.body;
    body = body.replace(/"splashAd":\s*\{\s*"on":\s*true/, '"splashAd":{"on":false');
    body = body.replace(/"interstitialAd":\s*\{\s*"on":\s*true/, '"interstitialAd":{"on":false');
    $done({ body });
} else {
    // getSplash：返回空广告列表
    $done({
        body: JSON.stringify({ errCode: "0", infos: [] })
    });
}
