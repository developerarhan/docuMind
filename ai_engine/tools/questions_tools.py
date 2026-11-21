from langchain_core.tools import tool

from ai_engine.chains.structured import  questions_structured_chain


@tool
def generate_questions(text:str)-> str:
    """
    Extract the five most important questions from the provided document text.
    Use this tool when the user asks to extract important questions from a document.
    
    Args:
        text (str): The complete or extracted text content of the document from which key questions should be identified.
    
    Returns:
        str: Five important questions extracted from the document.
    """
    if not text or not str(text).strip():
        return "No document text was provided to generate questions."

    response = questions_structured_chain.invoke({
        "text": text
    })

    return "\n\n".join(
        f"{i}. {question}"
        for i, question in enumerate(response.questions, start=1)
    )
