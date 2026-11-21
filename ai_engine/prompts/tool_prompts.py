from langchain_core.prompts import ChatPromptTemplate

summary_prompt = ChatPromptTemplate.from_messages([
    (
        "system",
        "You are a helpful document summarization assistant. "
        "Summarize the provided document in simple English. "
        "Keep summary concise, clear and well organised. "
        "Limit the summary to 2-3 lines. "
        "Use only information from the supplied document. "
        "Do not invent facts or concepts. "
        "If the document lacks enough information, provide fewer items rather than fabricating content. "
    ),
    (
        "human",
        "Please summarize the following document: \n\n{text}"
    )
])

concepts_prompt = ChatPromptTemplate.from_messages([
    (
        "system",
        "You are a helpful document analyzer assistant. "
        "Extract the 5 most important concepts from document, each with short explanation. "
        "Use only information from the supplied document. "
        "Do not invent facts or concepts. "
        "If the document lacks enough information, provide fewer items rather than fabricating content. "
    ),
    (
        "human",
        "Please analyze the following document: \n\n{text}"
    )
])

questions_prompt = ChatPromptTemplate.from_messages([
    (
        "system",
        "You are a helpful document analyzer assistant. "
        "Generate 5 questions that someone could ask about the document."
        "Use only information from the supplied document. "
        "Do not invent facts or concepts. "
        "If the document lacks enough information, provide fewer items rather than fabricating content. "
    ),
    (
        "human",
        "Please analyze the following document: \n\n{text}"
    )
])

detailed_prompt = ChatPromptTemplate.from_messages([
    (
        "system",
        "You are a helpful document analyzer assistant. "
        "Summarize the provided document in simple English. "
        "Keep summary concise, clear and well organised. "
        "Extract the 5 most important concepts from document, each with short explanation. "
        "Generate 5 questions that someone could ask about the document. "
        "Use only information from the supplied document. "
        "Do not invent facts or concepts. "
        "If the document lacks enough information, provide fewer items rather than fabricating content. "
    ),
    (
        "human",
        "Please analyze the following document: \n\n{text}"
    )
])
