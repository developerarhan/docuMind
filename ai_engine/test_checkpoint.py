import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from langgraph.graph import StateGraph, START, END, MessagesState
from langchain_core.messages import HumanMessage, AIMessage

from ai_engine.checkpoint import get_checkpointer


def test_conversation_continuity():

    # 1. Get PostgreSQL checkpointer
    checkpointer = get_checkpointer()

    # 2. Create chatbot node
    def chatbot(state: MessagesState):

        messages = state["messages"]

        # Read the previous conversation
        user_message = messages[-1].content

        if "my name is Rahul" in user_message.lower():
            response = "Hello Rahul! Nice to meet you."

        elif "what is my name" in user_message.lower():
            response = "Your name is Rahul!"

        else:
            response = "I am listening!"

        return {
            "messages": [
                AIMessage(content=response)
            ]
        }

    # 3. Create graph
    builder = StateGraph(MessagesState)

    builder.add_node("chatbot", chatbot)

    builder.add_edge(START, "chatbot")
    builder.add_edge("chatbot", END)

    # 4. Compile graph
    graph = builder.compile(
        checkpointer=checkpointer
    )

    # 5. Same thread ID for both invocations
    config = {
        "configurable": {
            "thread_id": "continuity_test_001"
        }
    }

    # 6. First invocation
    print("\n--- FIRST INVOCATION ---")

    result1 = graph.invoke(
        {
            "messages": [
                HumanMessage(
                    content="Hi, my name is Rahul."
                )
            ]
        },
        config=config
    )

    for message in result1["messages"]:
        print(f"{message.type}: {message.content}")

    # 7. Second invocation with SAME thread ID
    print("\n--- SECOND INVOCATION ---")

    result2 = graph.invoke(
        {
            "messages": [
                HumanMessage(
                    content="What is my name?"
                )
            ]
        },
        config=config
    )

    for message in result2["messages"]:
        print(f"{message.type}: {message.content}")

    # 8. Retrieve final state from PostgreSQL
    print("\n--- RETRIEVED CHECKPOINT STATE ---")

    state = graph.get_state(config)

    for message in state.values["messages"]:
        print(f"{message.type}: {message.content}")

    # 9. Verify conversation continuity
    messages = state.values["messages"]

    assert len(messages) == 4

    assert messages[0].content == "Hi, my name is Rahul."
    assert messages[2].content == "What is my name?"

    assert messages[3].content == "Your name is Rahul!"

    print("\nSUCCESS: Conversation continuity verified!")


if __name__ == "__main__":
    test_conversation_continuity()
