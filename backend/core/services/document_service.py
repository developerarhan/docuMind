import logging
from langchain_core.messages import HumanMessage, AIMessage

from ai_engine.rag.retrieval import retrieve_documents
from ai_engine.rag.embeddings import get_embedding_model
from ai_engine.rag.vector_store import get_vector_store, get_document_chunks_by_id
from ai_engine.agents.documind_agent import ask_document_question
from ai_engine.agents.documind_agent import get_agent
from ai_engine.citations import validate_source_citations
from ai_engine.checkpoint import get_checkpointer
from ai_engine.chains.query_rewriter import rewrite_query
from core.models import Conversation

logger = logging.getLogger(__name__)


def is_document_analysis_query(question: str) -> bool:
    """
    Check if the user is asking a broad document-level query such as
    summarization, key concepts extraction, question generation, or overview.
    """
    if not question or not isinstance(question, str):
        return False
    q = question.lower().strip()
    keywords = [
        "summar",
        "overview",
        "key concept",
        "important concept",
        "extract concept",
        "main concept",
        "generate question",
        "important question",
        "questions this document can answer",
        "what is this document about",
        "what does this document discuss",
        "brief",
        "tldr",
        "tl;dr",
        "synopsis",
        "takeaway",
    ]
    return any(kw in q for kw in keywords)


def get_document_context(document, question, user_id=None):
    embedding_model = get_embedding_model()

    vector_store = get_vector_store(embedding_model)

    target_user_id = user_id if user_id is not None else document.user_id

    is_analysis = is_document_analysis_query(question)
    logger.debug(
        "Retrieving document context: document_id=%s, user_id=%s, is_analysis=%s, question='%s'",
        document.id,
        target_user_id,
        is_analysis,
        question[:80],
    )

    if is_analysis:
        retrieved_docs, scores = retrieve_documents(
            vector_store=vector_store,
            question=question,
            embedding_model=embedding_model,
            document_id=document.id,
            user_id=target_user_id,
            threshold=0.20
        )
        if not retrieved_docs:
            logger.info("Analysis query yielded 0 chunks with threshold=0.20, falling back to top chunks")
            fallback_chunks = get_document_chunks_by_id(
                vector_store=vector_store,
                document_id=document.id,
                user_id=target_user_id,
                limit=6
            )
            if fallback_chunks:
                retrieved_docs = fallback_chunks
                scores = [0.85] * len(fallback_chunks)
    else:
        retrieved_docs, scores = retrieve_documents(
            vector_store=vector_store,
            question=question,
            embedding_model=embedding_model,
            document_id=document.id,
            user_id=target_user_id
        )

    logger.debug("Retrieved %s chunks for document_id=%s", len(retrieved_docs), document.id)
    return retrieved_docs, scores

def chat_with_document(document, user, question, thread_id, conversation_history=None):
    if conversation_history:
        rewritten_question = rewrite_query(question, conversation_history)
    else:
        rewritten_question = question

    retrieved_docs, scores = get_document_context(
        document=document,
        question=rewritten_question,
        user_id=document.user_id
    )

    if not retrieved_docs:
        # If there is existing conversation history, let the agent answer from conversation context
        # (e.g. conversational follow-ups, rephrasing, or summarizing what was just said)
        if conversation_history and len(conversation_history) > 0:
            answer = ask_document_question(
                user=user,
                question=question,
                context="",
                thread_id=thread_id
            )
            return {
                "answer": answer,
                "sources": [],
                "citation_validation": {
                    "is_valid": True,
                    "has_citations": False,
                    "valid_citations": [],
                    "invalid_citations": []
                }
            }

        return {
            "answer": (
                "I couldn't find relevant information "
                "in this document to answer your question."
            ),
            "sources": []
        }

    context_parts = []

    sources = []

    for index, (doc, score) in enumerate(
        zip(retrieved_docs, scores),
        start=1
    ):
        metadata = doc.metadata or {}

        page_index = metadata.get("page")
        page_number = (
            page_index + 1
            if isinstance(page_index, int)
            else None
        )

        context_parts.append(
            f"""
            [Source {index}]
            Page: {page_number if page_number is not None else "Unknown"}
            Content: {doc.page_content}
            """
        )

        sources.append({
            "source_id": index,
            "page": page_number,
            "relevance_score": round(float(score), 4)
        })

    context = "\n\n".join(context_parts)

    answer = ask_document_question(
        user=user,
        question=question,
        context=context,
        thread_id=thread_id
    )

    citation_validation = validate_source_citations(
        answer=answer,
        sources=sources
    )

    if not citation_validation["is_valid"]:
        return {
            "answer": (
                "I couldn't generate a reliable answer with "
                "valid document citations. Please try again."
            ),
            "sources": [],
            "citation_validation": citation_validation
        }

    trusted_sources = [
        source
        for source in sources
        if source["source_id"] in citation_validation["valid_citations"]
    ]

    return {
        "answer": answer,
        "sources": trusted_sources,
        "citation_validation": citation_validation
    }

def get_conversation_messages(conversation):
    """
    Retrieve messages from a conversation's LangGraph checkpoint.
    """
    thread_id = str(conversation.id)

    agent = get_agent()

    config = {
        "configurable": {
            "thread_id": thread_id
        }
    }

    state = agent.get_state(config)

    if not state or not state.values:
        return []

    messages = state.values.get("messages", [])

    filtered_messages = [
        message
        for message in messages
        if isinstance(message, (HumanMessage, AIMessage))
        or getattr(message, "type", None) in ("human", "user", "ai", "assistant")
    ]

    return filtered_messages

def delete_document(document):
    """
    Delete a document and its associated resources:
    - Chroma vectors
    - LangGraph conversation checkpoints
    - Uploaded PDF file
    - Django document record
    """
    embedding_model = get_embedding_model()
    vector_store = get_vector_store(embedding_model)

    vector_store._collection.delete(
        where={
            "$and": [
                {"document_id": document.id},
                {"user_id": document.user_id}
            ]
        }
    )

    conversation_ids = document.conversations.values_list(
        "id",
        flat=True
    )

    checkpointer = get_checkpointer()

    for conversation_id in conversation_ids:
        thread_id = str(conversation_id)
        checkpointer.delete_thread(thread_id)

    if document.file and document.file.name:
        storage = document.file.storage
        file_name = document.file.name

        if storage.exists(file_name):
            storage.delete(file_name)

    document.delete()
