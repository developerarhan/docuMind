import logging
from celery import shared_task
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)

from .models import Document, Conversation
from .services.document_service import get_conversation_messages
from .services.memory_service import extract_and_save_memories

User = get_user_model()

@shared_task(bind=True, max_retries=3)
def process_document(self, document_id):
    """
    Process an uploaded PDF using the RAG pipeline.
    """
    from ai_engine.rag.embeddings import get_embedding_model
    from ai_engine.rag.ingestion import load_document, split_documents
    from ai_engine.rag.vector_store import create_vector_store

    try:

        document = Document.objects.get(id=document_id)
        
        document.status = Document.DocumentStatus.PROCESSING
        document.save(update_fields=["status"])

        temp_file_path = None
        try:
            try:
                file_path = document.file.path
            except (NotImplementedError, AttributeError):
                import os
                import tempfile
                with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                    for chunk in document.file.chunks():
                        tmp.write(chunk)
                    temp_file_path = tmp.name
                file_path = temp_file_path

            loaded_documents = load_document(file_path)
            chunks = split_documents(loaded_documents)
        finally:
            if temp_file_path:
                import os
                if os.path.exists(temp_file_path):
                    try:
                        os.remove(temp_file_path)
                    except OSError:
                        pass

        embedding_model = get_embedding_model()

        create_vector_store(
            chunks, 
            embedding_model,
            document_id=document.id,
            user_id=document.user_id
        )

        document.status = Document.DocumentStatus.READY
        document.save(update_fields=["status"])

        return f"Document {document_id} processed successfully."

    except Document.DoesNotExist:
        raise

    except Exception as exc:
        if self.request.retries >= self.max_retries:
            Document.objects.filter(id=document_id).update(
                status=Document.DocumentStatus.FAILED
            )
            raise

        raise self.retry(
            exc=exc,
            countdown=60 * (2 ** self.request.retries)
        )

@shared_task(
    autoretry_for=(Exception,),
    retry_kwargs={"max_retries": 3},
    retry_backoff=True,
)
def extract_conversation_memories(user_id, conversation_id):
    logger.info("Starting memory extraction for user %s, conversation %s", user_id, conversation_id)
    try:
        user = User.objects.get(id=user_id)

        conversation = Conversation.objects.get(
            id=conversation_id,
            user=user
        )

        conversation_messages = get_conversation_messages(
            conversation
        )

        results = extract_and_save_memories(
            user,
            conversation_messages
        )
        logger.info(
            "Extracted and processed %s memories for user %s, conversation %s",
            len(results) if results else 0,
            user_id,
            conversation_id,
        )
        return results
    except Exception as exc:
        logger.exception(
            "Failed memory extraction for user %s, conversation %s: %s",
            user_id,
            conversation_id,
            exc,
        )
        raise
