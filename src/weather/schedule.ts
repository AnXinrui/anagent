import cron from "node-cron";
import { getAccessToken, sendC2CMessage } from "../qq/api";
import { getSubscribers } from "../storage/subscribers";
import { getWeather } from "./getWeather";

const DAILY_WEATHER_SCHEDULE = "0 8 * * *";

/** 天气订阅推送所需的配置。 */
interface WeatherScheduleOptions {
  /** QQ 应用标识。 */
  appId: string;
  /** QQ 应用密钥。 */
  clientSecret: string;
  /** 查询天气的城市。 */
  city: string;
}

/** 按运行环境时区，每天八点向订阅用户推送天气。 */
export function startWeatherSchedule(options: WeatherScheduleOptions): void {
  const { appId, clientSecret, city } = options;

  cron.schedule(DAILY_WEATHER_SCHEDULE, async () => {
    console.log("[scheduler] 开始推送每日天气...");
    try {
      const [weather, subscribers, accessToken] = await Promise.all([
        getWeather(city),
        getSubscribers(),
        getAccessToken(appId, clientSecret),
      ]);

      for (const openId of subscribers) {
        await sendC2CMessage({ accessToken, openId, content: weather });
      }

      console.log(`[scheduler] 推送完成，共 ${subscribers.length} 人`);
    } catch (error) {
      console.error("[scheduler] 推送天气失败:", error);
    }
  });

  console.log("[scheduler] 每日天气推送已注册（每天 08:00）");
}
