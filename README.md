# anagent

基于 OpenAI 兼容 API 的本地对话：支持**命令行单轮/多轮**（会话落盘）和 **QQ 机器人私聊**（按用户 openid 区分会话）。

## 环境

- Node.js 20+
- 复制 `.env` 示例并填写：

| 变量 | 说明 |
|------|------|
| `API_KEY` | 大模型 API Key |
| `BASE_URL` | API 地址（如 `https://api.xxx/v1`） |
| `QQ_APP_ID` / `QQ_CLIENT_SECRET` | 仅跑 QQ 时需要，在 QQ 开放平台创建机器人后获取 |

## 安装

```bash
npm install
```

## 运行方式

**命令行对话**（默认会话 id 为 `default`，历史在 `sessions/default.jsonl`）：

```bash
npx tsx src/index.ts "你好"
```

指定会话 id（多账号/多会话隔离）：

```bash
npx tsx src/index.ts "你好" my-user
```

**QQ 私聊机器人**（需配置 `QQ_*` 并开通单聊消息权限）：

```bash
npm run qq
```

会话文件目录：`sessions/*.jsonl`。
