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
