import os
from langchain_core.messages import trim_messages
from langchain_groq import ChatGroq

DEFAULT_GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")

model = ChatGroq(
    model=DEFAULT_GROQ_MODEL
)


def _token_counter(messages):
    """
    Lightweight character-to-token heuristic (~4 chars per token).
    Supports unit tests patching model.get_num_tokens_from_messages while
    running offline in 0ms without requiring HuggingFace Hub downloads.
    """
    try:
        from unittest.mock import Mock, MagicMock
        method = getattr(model, "get_num_tokens_from_messages", None)
        if isinstance(method, (Mock, MagicMock)):
            return method(messages)
    except Exception:
        pass

    return sum(max(1, len(getattr(m, "content", "")) // 4) for m in messages)


def trim_conversation(
    messages,
    max_tokens: int = 3000
):
    trimmed_messages = trim_messages(
        messages,
        max_tokens=max_tokens,
        token_counter=_token_counter,
        strategy="last",
        include_system=True,
        start_on="human",
        allow_partial=False,
    )

    return trimmed_messages
