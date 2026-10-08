# anagent

基于 OpenAI 兼容 API 的本地对话：支持**命令行单轮/多轮**（会话落盘）和 **QQ 机器人私聊**（按用户 openid 区分会话）；两个入口均支持工具调用。

## 环境

- [Bun](https://bun.sh) 1.3+
- 复制 `.env.example` 为 `.env` 并填写。Bun 启动时会自动读取项目根目录的 `.env`

| 变量 | 说明 |
|------|------|
| `API_KEY` | 大模型 API Key |
| `BASE_URL` | API 地址（如 `https://api.xxx/v1`） |
| `MODEL` | 命令行对话模型，不填或为空时默认 `gpt-5-mini`（需支持工具调用）；QQ 对话固定使用 `gpt-5-mini` |
| `QQ_APP_ID` / `QQ_CLIENT_SECRET` | 仅跑 QQ 时需要，在 QQ 开放平台创建机器人后获取 |

## 安装

```bash
bun install
```

## 运行方式

**命令行对话**（默认会话 id 为 `default`，历史在 `sessions/default.jsonl`，支持工具调用）：

```bash
bun src/main.ts "你好"
```

也可以：

```bash
bun run start "你好"
```

指定会话 id（多账号/多会话隔离）：

```bash
bun src/main.ts "你好" my-user
```

**QQ 私聊机器人**（需配置 `QQ_*` 并开通单聊消息权限）：

```bash
bun run qq
```

QQ 入口为 `src/qq/main.ts`，也可直接运行 `bun src/qq/main.ts`。发送“订阅”或“取消订阅”管理厦门天气推送，每天 08:00 按运行环境时区执行。

会话文件目录：当前工作目录下的 `sessions/*.jsonl`；订阅文件：项目根目录下的 `data/subscribers.json`。重构不会迁移已有数据。

## 技能

在项目根目录创建 `.claude/skills/<技能名>/SKILL.md` 即可扩展技能，对话中由模型按需通过 `Skill` 工具加载：

```markdown
---
name: reverse-args
description: Takes two input words and outputs them in reverse order
---
Respond with exactly: $1 $0
```

- `name` 缺省使用目录名；`description` 会随技能清单注入 QQ 系统提示词。
- QQ 私聊中，消息以 `/技能名 参数` 开头时直接展开技能正文（如 `/reverse-args 你好 世界`）；也可以由模型按需调用 `Skill` 工具加载。
- 正文支持 `$ARGUMENTS`、`$0`、`$1` 等占位符，按调用参数替换。
- frontmatter 声明 `context: fork` 时，技能在独立上下文中运行，只把结果返回当前对话。

仓库内置 `.claude/skills/` 下 4 个演示技能（`apple`、`banana`、`checksum`、`reverse-args`），可随时删除或替换。

**注意**：`readFileContent`、`writeFile`、`runCommand` 会直接读写运行主机的文件并执行命令，请仅在个人自用场景下开放 QQ 私聊。

## 源码结构

- `src/main.ts`：命令行入口。
- `src/agent/`：共享客户端与工具调用循环。
- `src/qq/`：QQ API、Gateway 连接、消息处理和启动入口。
- `src/storage/`：会话追加存储和订阅列表持久化。
- `src/tools/`：工具协议、注册表与内置工具（`get_current_datetime`、`readFileContent`、`writeFile`、`runCommand`、`Skill`），由两个入口共用 `registerDefaultTools` 注册。
- `src/skills/`：技能扫描、frontmatter 解析与 `/技能名` 指令展开，技能清单注入 QQ 系统提示词。
- `src/weather/`：天气查询及每日推送调度。

## 验证

```bash
bun run typecheck
bun run test
```

测试脚本将各测试文件放入独立进程，隔离模块级 mock，并关闭 `.env` 自动加载。模型、网络、计时器和文件存储均使用测试替身，不访问真实服务或业务数据。请使用 `bun run test`，避免直接批量执行 `bun test` 导致模块状态相互影响。
