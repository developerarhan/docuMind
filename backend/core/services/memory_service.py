import logging
import numpy as np
from django.db import transaction
from langchain_core.messages import HumanMessage, AIMessage

logger = logging.getLogger(__name__)

from core.models import UserMemory as UserMemoryModel
from ai_engine.chains.memory_extraction import memory_extraction_chain
from ai_engine.chains.memory_decision import memory_decision_chain
from ai_engine.memory.schemas import UserMemory as UserMemorySchema, MemoryDecision
from ai_engine.rag.embeddings import get_embedding_model

def save_memory(user, memory):
    """
    Save one memory (either Pydantic UserMemory schema or dictionary) into the Django database.
    """
    if isinstance(memory, dict):
        text = memory.get("memory", "")
        category = memory.get("category", UserMemoryModel.Category.OTHER)
    else:
        text = getattr(memory, "memory", "")
        category = getattr(memory, "category", UserMemoryModel.Category.OTHER)

    if not text or not text.strip():
        return None

    record = UserMemoryModel.objects.create(
        user=user,
        memory=text.strip(),
        category=category
    )

    return record

def save_memories(user, memories: list[UserMemorySchema]):
    """
    Save multiple Pydantic memory objects into the database.
    Skip empty memories, database duplicates, and batch duplicates.
    """
    valid_memories = []
    seen = set()

    for memory in memories:
        if not memory.memory or not memory.memory.strip():
            continue

        normalized_memory = memory.memory.strip()
        key = (memory.category, normalized_memory)
        if key in seen:
            continue

        # Skip duplicate memories
        if is_duplicate_memory(user, memory):
            continue

        seen.add(key)
        valid_memories.append(memory)

    # return if empty list
    if not valid_memories:
        return []
        
    memory_objects = [
        UserMemoryModel(
            user=user,
            memory=memory.memory.strip(),
            category=memory.category
        )
        for memory in valid_memories
    ]

    with transaction.atomic():
        created_records = UserMemoryModel.objects.bulk_create(
            memory_objects
        )

    return created_records

def get_memories(user):
    """
    Retrieve all memories belonging to a specific user.
    Newest memories appear first.
    """
    return UserMemoryModel.objects.filter(
        user=user
    ).order_by("-created_at", "-id")

def format_memories_for_agent(user):
    """
    Retrieve and format user memories for the AI agent.
    """

    memories = get_memories(user)

    if not memories.exists():
        return "No stored memories about this user."

    formatted_memories = []

    for memory in memories:
        formatted_memories.append(
            f"- [{memory.category}] {memory.memory}"
        )

    return "\n".join(formatted_memories)

def is_duplicate_memory(user, memory):
    return UserMemoryModel.objects.filter(
        user=user,
        memory=memory.memory,
        category=memory.category
    ).exists()

def calculate_similarity(text1: str, text2: str) -> float:
    """
    Calculate cosine similarity between two text strings
    using HuggingFace embeddings.
    """
    embedding_model = get_embedding_model()

    embeddings = embedding_model.embed_documents([text1, text2])

    vector1 = np.array(embeddings[0])
    vector2 = np.array(embeddings[1])
    
    similarity = np.dot(vector1, vector2) / (
        np.linalg.norm(vector1) * np.linalg.norm(vector2)
    )

    return float(np.clip(similarity, -1.0, 1.0))

def find_similar_memories(
    user,
    new_memory,
    threshold: float = 0.85
):
    """
    Find existing user memories similar to the new memory.
    Returns matching memories along with similarity scores.
    """
    existing_memories = get_memories(user)

    similar_memories = []

    for memory in existing_memories:
        if memory.category != new_memory.category:
            continue

        similarity = calculate_similarity(
            new_memory.memory,
            memory.memory
        )

        if similarity >= threshold:
            similar_memories.append({
                "memory": memory,
                "similarity": similarity
            })

    similar_memories.sort(
        key=lambda item: item["similarity"],
        reverse=True
    )

    return similar_memories

def process_new_memory(user, new_memory):
    """
    Process a new memory and decide what action to take.
    """
    similar_memories = find_similar_memories(user, new_memory)

    if not similar_memories:
        return MemoryDecision(
            action="CREATE",
            reason="No existing similar memories found for this user."
        )

    existing_memories = [
        {
            "id": item["memory"].id,
            "memory": item["memory"].memory,
            "category": item["memory"].category,
            "similarity": item["similarity"]
        }
        for item in similar_memories
    ]

    response = memory_decision_chain.invoke({
        "new_memory": new_memory.memory,
        "existing_memories": existing_memories
    })

    return response

def execute_memory_decision(user, new_memory, decision):
    """
    Execute the memory decision safely.
    """
    if decision.action == "CREATE":
        return save_memories(user, [new_memory])

    if decision.action == "NO_ACTION":
        return None

    if decision.action in ("UPDATE", "DELETE"):

        with transaction.atomic():

            # Verify memory belongs to the supplied user
            existing_memory = (
                UserMemoryModel.objects
                .select_for_update()
                .filter(
                    id=decision.memory_id,
                    user=user
                )
                .first()
            )

            # Never trust an ID without ownership verification
            if existing_memory is None:
                raise ValueError(
                    "Memory not found or does not belong to this user."
                )

            # UPDATE
            if decision.action == "UPDATE":

                existing_memory.memory = new_memory.memory.strip()
                existing_memory.category = new_memory.category

                existing_memory.save(
                    update_fields=["memory", "category"]
                )

                return existing_memory

            # DELETE
            elif decision.action == "DELETE":
                existing_memory.delete()
                return None

    raise ValueError(
        f"Unsupported memory action: {decision.action}"
    )

def format_conversation_for_memory(conversation):
    formatted_messages = []

    if not conversation:
        return ""

    for message in conversation:
        role = None
        content = ""

        if isinstance(message, dict):
            m_type = str(message.get("type") or message.get("role") or "").lower()
            if m_type in ("human", "user"):
                role = "User"
            elif m_type in ("ai", "assistant"):
                role = "Assistant"
            content = message.get("content", "")
        else:
            msg_type = str(getattr(message, "type", "")).lower()
            if isinstance(message, HumanMessage) or msg_type in ("human", "user"):
                role = "User"
            elif isinstance(message, AIMessage) or msg_type in ("ai", "assistant"):
                role = "Assistant"
            content = getattr(message, "content", "")

        if not role:
            continue

        if not isinstance(content, str) or not content.strip():
            continue

        formatted_messages.append(
            f"{role}: {content.strip()}"
        )

    return "\n\n".join(formatted_messages)

def extract_and_save_memories(user, conversation):
    """
    Extract useful memories from a conversation
    and save them for the given Django user.
    """
    if hasattr(conversation, "id") and not isinstance(conversation, (list, tuple)):
        from core.services.document_service import get_conversation_messages
        conversation = get_conversation_messages(conversation)

    formatted_conversation = format_conversation_for_memory(
        conversation
    )

    if not formatted_conversation.strip():
        logger.info("No conversation messages found to extract memories for user %s", user.id)
        return []

    result = memory_extraction_chain.invoke({
        "conversation": formatted_conversation
    })

    memories = result.memories

    execution_results = []

    for memory in memories:
        try:
            decision = process_new_memory(user, memory)

            execution_result = execute_memory_decision(
                user, memory, decision
            )

            execution_results.append({
                "memory": memory,
                "success": True,
                "result": execution_result
            })
        except Exception as e:
            logger.exception("Failed to process extracted memory for user %s: %s", user.id, e)
            execution_results.append({
                "memory": memory,
                "success": False,
                "error": str(e)
            })

    return execution_results
