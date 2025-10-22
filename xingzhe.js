if ($response.body) {
  let body = $response.body;
  body = body.replace(/"home_page_online":\[[\s\S]*?\]/, '"home_page_online":[]');
  $done({ body });
} else {
  $done({});
}
