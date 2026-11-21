from langchain_core.tools import tool

from ai_engine.chains.structured import concepts_structured_chain


@tool
def extract_concepts(text:str)-> str:
    """
    Extract the five most important concepts from the provided document text, along with a brief explanation of each concept.
    Use this tool when the user asks to identify, extract, or understand the key concepts, important information, or major takeaways from a document.
    Args:
        text(str): The complete or extracted text content of the document from which key concepts should be identified.
    Returns:
        str: Five key concepts extracted from the document, each accompanied by a concise explanation based strictly on the provided text.
    """
    if not text or not str(text).strip():
        return "No document text was provided to extract concepts."

    response = concepts_structured_chain.invoke({
        "text": text
    })

    return "\n\n".join(
        f"{i}. {concept.name}\n"
        f"   Explanation: {concept.explanation}"
        for i, concept in enumerate(response.concepts, start=1)
    )
