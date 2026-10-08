import { currentDateTimeTool } from "../tools/getCurrentDateTime";
import { skillTool } from "../tools/loadSkill";
import { readFileTool } from "../tools/readFile";
import { registerTool } from "../tools/registry";
import { runCommandTool } from "../tools/runCommand";
import { writeFileTool } from "../tools/writeFile";
import { startWeatherSchedule } from "../weather/schedule";
import { startQQBot } from "./bot";
import { handleMessage } from "./handleMessage";

const WEATHER_CITY = "厦门";

/** 校验 QQ 配置，注册工具并启动天气调度与私聊机器人。 */
async function main(): Promise<void> {
  const appId = process.env.QQ_APP_ID;
  const clientSecret = process.env.QQ_CLIENT_SECRET;
  if (!appId || !clientSecret) {
    console.error("请在 .env 配置 QQ_APP_ID 和 QQ_CLIENT_SECRET");
    process.exit(1);
  }

  registerTool(currentDateTimeTool);
  registerTool(readFileTool);
  registerTool(writeFileTool);
  registerTool(runCommandTool);
  registerTool(skillTool);
  console.log("[qq] 启动中，AppID:", appId);
  startWeatherSchedule({ appId, clientSecret, city: WEATHER_CITY });
  await startQQBot({ appId, clientSecret, onMessage: handleMessage });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
