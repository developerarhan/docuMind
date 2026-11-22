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
        logger.info(
            "Starting processing for document_id=%s (attempt %s/%s)",
            document_id,
            self.request.retries + 1,
            self.max_retries + 1,
        )

        document = Document.objects.get(id=document_id)
        
        document.status = Document.DocumentStatus.PROCESSING
        document.save(update_fields=["status"])
        logger.info("Document %s ('%s') marked as PROCESSING", document.id, document.title)

        temp_file_path = None
        try:
            try:
                file_path = document.file.path
                logger.debug("Using local document filesystem path: %s", file_path)
            except (NotImplementedError, AttributeError):
                import os
                import tempfile
                logger.info("Streaming remote document file chunks to temporary file for document %s", document.id)
                with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                    for chunk in document.file.chunks():
                        tmp.write(chunk)
                    temp_file_path = tmp.name
                file_path = temp_file_path
                logger.debug("Remote document streamed to temp file: %s", file_path)

            loaded_documents = load_document(file_path)
            chunks = split_documents(loaded_documents)
            logger.info(
                "Document %s: loaded %s page(s), split into %s chunks",
                document.id,
                len(loaded_documents),
                len(chunks),
            )
        finally:
            if temp_file_path:
                import os
                if os.path.exists(temp_file_path):
                    try:
                        os.remove(temp_file_path)
                        logger.debug("Cleaned up temp file: %s", temp_file_path)
                    except OSError:
                        pass

        embedding_model = get_embedding_model()
        logger.info(
            "Creating vector store for document %s using model %s",
            document.id,
            getattr(embedding_model, "model_name", type(embedding_model).__name__),
        )

        create_vector_store(
            chunks, 
            embedding_model,
            document_id=document.id,
            user_id=document.user_id
        )
        logger.info("Vector store successfully created and indexed for document %s", document.id)

        document.status = Document.DocumentStatus.READY
        document.save(update_fields=["status"])
        logger.info("Document %s status updated to READY", document.id)

        return f"Document {document_id} processed successfully."

    except Document.DoesNotExist:
        logger.error("Document %s does not exist in database.", document_id)
        raise

    except Exception as exc:
        logger.exception(
            "Error processing document %s (attempt %s/%s): %s",
            document_id,
            self.request.retries + 1,
            self.max_retries + 1,
            exc,
        )
        if self.request.retries >= self.max_retries:
            logger.error("Max retries exceeded for document %s. Marking status as FAILED.", document_id)
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
