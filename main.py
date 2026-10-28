import asyncio
import os

from dotenv import load_dotenv

from agentscope.agent import Agent
from agentscope.message import UserMsg
from agentscope.model import OpenAIChatModel
from agentscope.credential import OpenAICredential

load_dotenv(override=True)


def _env(*names: str, default: str = "") -> str:
    """按顺序读取第一个非空环境变量，兼容多种命名习惯。"""
    for name in names:
        value = os.getenv(name)
        if value:
            return value
    return default


# 配置
API_KEY = _env("OPENAI_API_KEY", "API_KEY")
BASE_URL = _env("OPENAI_BASE_URL", "BASE_URL")  # 留空则走 OpenAI 官方地址
MODEL_NAME = _env("OPENAI_MODEL", "MODEL", default="gpt-4o-mini")

EXIT_WORDS = {"/exit", "/quit", "exit", "quit", "q"}


def build_model() -> OpenAIChatModel:
    return OpenAIChatModel(
        credential=OpenAICredential(
            api_key=API_KEY,
            base_url=BASE_URL or None,
        ),
        model=MODEL_NAME,
    )


async def chat_loop(agent: Agent) -> None:
    while True:
        try:
            text = input("\n你 > ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nbye~")
            return
        if not text:
            continue
        if text.lower() in EXIT_WORDS:
            print("bye~")
            return
        try:
            reply = await agent.reply(UserMsg(name="user", content=text))
            content = (reply.get_text_content() or "").strip()
            print(f"{agent.name} > {content}")
        except Exception as exc:
            print(f"【出错】{type(exc).__name__}: {exc}")


async def main():
    if not API_KEY:
        raise SystemExit(
            "未读到 API key。请在 .env 中设置 OPENAI_API_KEY（或 API_KEY）。"
        )

    agent = Agent(
        name="Kitty",
        system_prompt=(
            "你叫 Kitty，是一个天才工作助手。"
            "说话直接、简短，不超过两句话。"
        ),
        model=build_model(),
    )

    print(f"good morning~  (model: {MODEL_NAME}, 输入 /exit 退出)")
    await chat_loop(agent)


if __name__ == "__main__":
    asyncio.run(main())
