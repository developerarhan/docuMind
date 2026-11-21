from langchain_core.tools import tool

from ai_engine.chains.structured import summary_structured_chain

@tool
def summarize_document(text: str)-> str:
    """
    Summarize the provided document text into a concise, structured summary.
    Use this tool when the user asks to summarize a document.
    The tool processes the input text using an LLM-based structured summarization chain and returns the generated summary as a string.

    Args:
        text (str): The complete or extracted text content of the document that needs to be summarized.

    Returns:
        str: A concise summary of the document.
    """
    if not text or not str(text).strip():
        return "No document text was provided to summarize."

    response = summary_structured_chain.invoke({
        "text": text
    })

    return response.summary
