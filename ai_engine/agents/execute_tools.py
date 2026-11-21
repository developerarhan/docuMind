from ai_engine.tools.concepts_tools import extract_concepts
from ai_engine.tools.document_tools import summarize_document
from ai_engine.tools.questions_tools import generate_questions


tools = [extract_concepts, generate_questions, summarize_document]

tool_map = {
    tool.name: tool
    for tool in tools
}


def execute_tool(tool_call):
    tool_name = tool_call["name"]

    selected_tool = tool_map.get(tool_name)

    if selected_tool is None:
        raise ValueError(f"Tool '{tool_name}' not found.")

    arguments = tool_call["args"]

    print(selected_tool)

    result = selected_tool.invoke(arguments)

    return result
