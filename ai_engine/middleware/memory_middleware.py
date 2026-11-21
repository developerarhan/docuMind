from langchain.agents.middleware import wrap_model_call
from langchain_core.messages import SystemMessage

try:
    from core.services.memory_service import format_memories_for_agent
except ImportError:
    from backend.core.services.memory_service import format_memories_for_agent


@wrap_model_call
def memory_middleware(request, handler):
    runtime = getattr(request, "runtime", None)
    context = getattr(runtime, "context", None) if runtime else None

    if isinstance(context, dict):
        user = context.get("user")
    elif context is not None:
        user = getattr(context, "user", None)
    else:
        user = None

    memories = format_memories_for_agent(user) if user else ""

    existing_system_message = request.system_message

    # checks both string and message-object formats
    if isinstance(existing_system_message, str):
        original_prompt = existing_system_message

    elif existing_system_message is not None:
        original_prompt = existing_system_message.content

    else:
        original_prompt = ""

    memory_context = f"""
    ## User Long-Term Memories

    The following information represents stored memories
    about the user:

    {memories}

    Use these memories when relevant.
    Do not invent personal information.
    """

    updated_system_prompt = (
        f"{original_prompt}\n\n{memory_context}"
    )

    modified_request = request.override(
        system_message=SystemMessage(
            content=updated_system_prompt
        )
    )

    # Pass the modified request to model
    return handler(modified_request)
