import os
from functools import lru_cache
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.output_parsers import StrOutputParser

load_dotenv()


@lru_cache(maxsize=1)
def get_query_rewriter_model():
    """Reuse the Groq model instance."""
    groq_model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
    return ChatGroq(
        model=groq_model,
        temperature=0,
    )


def normalize_history_role(role: str) -> str:
    """Normalize dictionary and LangChain message roles."""
    role_mapping = {
        "human": "user",
        "user": "user",
        "ai": "assistant",
        "assistant": "assistant",
        "system": "system",
        "tool": "tool",
    }
    return role_mapping.get(str(role).lower(), "unknown")


def rewrite_query(
    question: str,
    conversation_history: list = None
) -> str:
    """
    Rewrite a conversational follow-up question into a standalone query
    using conversation history, ensuring accurate vector retrieval.
    """
    if not isinstance(question, str) or not question.strip():
        return question

    if not conversation_history:
        return question.strip()

    recent_history = conversation_history[-8:]
    history_parts = []

    for message in recent_history:
        if isinstance(message, dict):
            role = message.get("role", "unknown")
            content = message.get("content", "")
        else:
            role = getattr(message, "type", "unknown")
            content = getattr(message, "content", "")

        if not isinstance(content, str) or not content.strip():
            continue

        normalized_role = normalize_history_role(role)
        if normalized_role in ("unknown", "system", "tool"):
            continue

        history_parts.append(f"{normalized_role}: {content.strip()}")

    if not history_parts:
        return question.strip()

    history_text = "\n".join(history_parts)

    system_prompt = (
        "You are a query rewriting assistant for a conversational document retrieval system.\n\n"
        "Your task is to rewrite the latest user question into a standalone question using conversation history.\n\n"
        "RULES:\n"
        "1. Resolve pronouns and ambiguous references such as 'it', 'that', 'this', 'step 3', 'explain more', 'why'.\n"
        "2. Preserve the user's original intent.\n"
        "3. Do not answer the question.\n"
        "4. Do not introduce unsupported information.\n"
        "5. If the question is already standalone, return it unchanged.\n"
        "6. Return ONLY the rewritten question without prefixes or explanations."
    )

    human_prompt = (
        f"CONVERSATION HISTORY:\n{history_text}\n\n"
        f"LATEST USER QUESTION:\n{question.strip()}\n\n"
        "Standalone question:"
    )

    try:
        model = get_query_rewriter_model()

        response = model.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=human_prompt)
        ])

        content = getattr(response, "content", str(response))

        if isinstance(content, str) and content.strip():
            rewritten = content.strip().strip('"').strip("'")
            return rewritten

        return question.strip()

    except Exception:
        # Preserve original question if model call fails
        return question.strip()
