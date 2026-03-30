import cron from 'node-cron'
import { getAccessToken } from '../im/qq/qq-api.js'
import { getSubscribers } from '../stores/subscribers'
import { fetchWeather } from './weather.js'
import { sendC2CMessage } from '../im/qq/qq-api.js'

export function startScheduler(params: {
    appId: string
    clientSecret: string
    city: string
}): void {
    const { appId, clientSecret, city } = params

    cron.schedule('0 8 * * *', async () => {
        console.log('[scheduler] 开始推送每日天气...')
        try {
            const [weather, subscribers, accessToken] = await Promise.all([
                fetchWeather(city),
                getSubscribers(),
                getAccessToken(appId, clientSecret),
            ])

            for (const openid of subscribers) {
                await sendC2CMessage({ accessToken, openid, content: weather })
            }

            console.log(`[scheduler] 推送完成，共 ${subscribers.length} 人`)
        } catch (err) {
            console.error('[scheduler] 推送天气失败:', err)
        }
    })

    console.log('[scheduler] 每日天气推送已注册（每天 08:00）')
}