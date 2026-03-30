
/**
 * 获取天气
 * @param city 城市名称
 * @returns 天气信息
 */
export async function fetchWeather(city: string): Promise<string> {
    const url = `https://wttr.in/${encodeURIComponent(city)}?format=3`
    const res = await fetch(url, {
        headers: { 'User-Agent': 'curl/8.0' },
    })
    if (!res.ok) {
        throw new Error(`weather request failed: ${res.status}`)
    }
    const text = await res.text()
    console.log(text)
    return text
}