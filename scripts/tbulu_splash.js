const url = $request.url;
if (url.indexOf('/adConfig/get') !== -1) {
    let body = $response.body;
    body = body.replace(/"splashAd":\s*\{\s*"on":\s*true/, '"splashAd":{"on":false');
    body = body.replace(/"interstitialAd":\s*\{\s*"on":\s*true/, '"interstitialAd":{"on":false');
    $done({ body });
} else {
    $done({ body: JSON.stringify({ errCode: "0", infos: [] }) });
}
