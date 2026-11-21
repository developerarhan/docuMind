from langchain.agents.middleware import wrap_model_call

from ai_engine.agents.trim_messages import trim_conversation

@wrap_model_call
def trim_messages_middleware(request, handler):
    # Receive the model request
    messages = request.messages

    # Applying existing trimming logic
    trimmed_messages = trim_conversation(messages)

    # Update the request with trimmed messages
    modified_request = request.override(
        messages=trimmed_messages
    )

    # Pass the modified request to model
    return handler(modified_request)
