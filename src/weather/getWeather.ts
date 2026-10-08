/** 获取指定城市的天气摘要，保留服务返回的原始文本。 */
export async function getWeather(city: string): Promise<string> {
  const url = `https://wttr.in/${encodeURIComponent(city)}?format=3`;
  const response = await fetch(url, {
    headers: { "User-Agent": "curl/8.0" },
  });
  if (!response.ok) {
    throw new Error(`weather request failed: ${response.status}`);
  }

  const weather = await response.text();
  console.log(weather);
  return weather;
}
