import logging
from django.db import transaction
from django.conf import settings
from uuid import UUID
from django.shortcuts import get_object_or_404 
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.authtoken.models import Token
from rest_framework import status
from .models import UserMemory, Document, Conversation
from .serializers import (
    UserMemorySerializer,
    UserMemoryCreateSerializer,
    DocumentUploadSerializer,
    DocumentSerializer,
    ConversationListSerializer,
    UserSerializer,
    UserRegisterSerializer,
    UserLoginSerializer,
)
from .tasks import process_document, extract_conversation_memories
from .services.memory_service import get_memories, save_memory
from .services.document_service import get_document_context, chat_with_document, get_conversation_messages, delete_document
from ai_engine.checkpoint import get_checkpointer

logger = logging.getLogger(__name__)


def serialize_messages(messages):
    serialized = []

    for message in messages:
        role = message.type

        if role == "ai":
            role = "assistant"

        serialized.append({
            "role": role,
            "content": message.content
        })

    return serialized

class UserMemoriesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        memories = get_memories(request.user)

        serializer = UserMemorySerializer(
            memories,
            many=True
        )

        return Response(serializer.data)

    def post(self, request):
        serializer = UserMemoryCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        memory = save_memory(
            request.user,
            serializer.validated_data
        )

        response_serializer = UserMemorySerializer(memory)

        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED
        )
        

class UserMemoryDetailView(APIView):
    permission_classes = [IsAuthenticated]    

    def delete(self, request, id):
        memory = get_object_or_404(
            UserMemory,
            id=id,
            user=request.user
        )

        memory.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)


class DocumentUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        serializer = DocumentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uploaded_file = serializer.validated_data["file"]
        logger.info(
            "User %s uploading document: '%s' (%s bytes, content_type=%s)",
            request.user.username,
            uploaded_file.name,
            uploaded_file.size,
            getattr(uploaded_file, "content_type", "unknown"),
        )

        document = serializer.save(
            user=request.user,
            file_size=uploaded_file.size,
            status=Document.DocumentStatus.PENDING
        )
        logger.info(
            "Document %s ('%s') created with status PENDING for user %s",
            document.id,
            document.title,
            request.user.username,
        )

        response_serializer = DocumentUploadSerializer(document)

        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED
        )

    def get(self, request):
        documents = Document.objects.filter(
            user=request.user
        ).order_by("-created_at")

        serializer = DocumentSerializer(
            documents,
            many=True
        )

        return Response(serializer.data)


class DocumentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, id):
        document = get_object_or_404(
            Document,
            id=id,
            user=request.user
        )

        logger.info(
            "User %s deleting document %s ('%s')",
            request.user.username,
            document.id,
            document.title,
        )
        delete_document(document)
        logger.info("Document %s and associated resources deleted successfully", id)

        return Response(
            status=status.HTTP_204_NO_CONTENT
        )


# /api/documents/{id}/process/
class DocumentProcessView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, id):
        with transaction.atomic():
            document = get_object_or_404(
                Document.objects.select_for_update(),
                id=id,
                user=request.user
            )

            allowed_statuses = [
                Document.DocumentStatus.PENDING,
                Document.DocumentStatus.FAILED
            ]

            if document.status not in allowed_statuses:

                if document.status == Document.DocumentStatus.PROCESSING:
                    message = "Document is already being processed."

                elif document.status == Document.DocumentStatus.READY:
                    message = "Document has already been processed."

                else:
                    message = "Document cannot be processed in its current state."

                logger.warning(
                    "User %s attempted to process document %s but invalid status: %s",
                    request.user.username,
                    document.id,
                    document.status,
                )
                return Response(
                    {"detail": message},
                    status=status.HTTP_400_BAD_REQUEST
                )

            document.status = Document.DocumentStatus.PROCESSING

            document.save(update_fields=["status"])


        try:
            logger.info("Dispatching Celery process_document task for document %s", document.id)
            process_document.delay(document.id)
        except Exception as exc:
            logger.exception("Failed to dispatch Celery task for document %s: %s", document.id, exc)
            document.status = Document.DocumentStatus.FAILED
            document.save(update_fields=["status"])

            return Response(
                {
                    "detail": "Failed to dispatch document processing task.",
                    "document_id": document.id,
                    "status": document.status
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        logger.info("Celery process_document task dispatched for document %s", document.id)
        return Response(
            {
                "message": "Document processing started.",
                "document_id": document.id,
                "status": document.status
            },
            status=status.HTTP_202_ACCEPTED
        )


# POST /api/documents/<int:id>/chat/
# Request body:
# {
#     "question": "Explain backpropagation."
# }
class DocumentChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, id):
        question = request.data.get("question")

        if not isinstance(question, str) or not question.strip():
            return Response(
                {"error": "Question is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        question = question.strip()

        try:
            document = Document.objects.get(
                id=id,
                user=request.user
            )
        except Document.DoesNotExist:
            return Response(
                {"error": "Document not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        if document.status !=  Document.DocumentStatus.READY:
            return Response(
                {
                    "error": "Document is not ready for chat.",
                    "document_status":  document.status
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        conversation_id = request.data.get("conversation_id")

        if conversation_id:

            # Validate UUID format
            try:
                conversation_id = UUID(str(conversation_id))
            except (ValueError, TypeError, AttributeError):
                return Response(
                    {"error": "Invalid conversation ID."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Validate ownership and document association
            try:
                conversation = Conversation.objects.get(
                    id=conversation_id,
                    user=request.user,
                    document=document
                )
            except Conversation.DoesNotExist:
                return Response(
                    {"error": "Conversation not found."},
                    status=status.HTTP_404_NOT_FOUND
                )

        else:
            conversation = Conversation.objects.create(
                user=request.user,
                document=document
            )

        thread_id = str(conversation.id)
        logger.info(
            "User %s initiating chat with document %s (thread_id=%s, question='%s')",
            request.user.username,
            id,
            thread_id,
            question[:80],
        )

        try:
            try:
                conversation_history = get_conversation_messages(conversation)
            except Exception:
                conversation_history = []

            result = chat_with_document(
                document=document,
                user=request.user,
                question=question,
                thread_id=thread_id,
                conversation_history=conversation_history
            )
            logger.info(
                "Chat success for document %s (thread_id=%s): generated answer with %s source citation(s)",
                id,
                thread_id,
                len(result.get("sources", [])),
            )

        except Exception as e:
            logger.exception("Failed to chat with document %s (thread %s): %s", id, thread_id, e)
            error_data = {"error": "Failed to generate document answer."}
            if settings.DEBUG:
                error_data["detail"] = str(e)
            return Response(
                error_data,
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        conversation.save(update_fields=["updated_at"])

        try:
            extract_conversation_memories.delay(
                request.user.id,
                conversation.id
            )
        except Exception as e:
            logger.warning(
                "Celery dispatch failed for memory extraction: %s. Attempting synchronous extraction fallback.",
                e
            )
            try:
                extract_conversation_memories(
                    request.user.id,
                    conversation.id
                )
            except Exception as sync_err:
                logger.warning("Synchronous memory extraction also failed: %s", sync_err)

        return Response(
            {
                "message": "Answer generated successfully.",
                "conversation_id": str(conversation.id),
                "document_id": document.id,
                "question": question,
                "answer": result["answer"],
                "sources": result["sources"]
            },
            status=status.HTTP_200_OK
        )


class ConversationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        conversations = Conversation.objects.filter(
            user=request.user
        ).select_related(
            "document"
        ).order_by("-updated_at")

        serializer = ConversationListSerializer(
            conversations,
            many=True
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK
        )


class ConversationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, conversation_id):

        try:
            conversation = Conversation.objects.select_related(
                "document"
            ).get(
                id=conversation_id,
                user=request.user
            )

        except Conversation.DoesNotExist:
            return Response(
                {"detail": "Conversation not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = ConversationListSerializer(conversation)

        return Response(
            serializer.data,
            status=status.HTTP_200_OK
        )

    def delete(self, request, conversation_id):
        try:
            conversation = Conversation.objects.get(
                id=conversation_id,
                user=request.user
            )

        except Conversation.DoesNotExist:
            return Response(
                {"detail": "Conversation not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        thread_id = str(conversation.id)

        checkpointer = get_checkpointer()

        checkpointer.delete_thread(thread_id)

        conversation.delete()

        return Response(
            status=status.HTTP_204_NO_CONTENT
        )
    

# GET /api/conversations/<uuid>/messages/
class ConversationMessagesView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request, conversation_id):
        try:
            conversation = Conversation.objects.get(
                id=conversation_id,
                user=request.user
            )

        except Conversation.DoesNotExist:
            return Response(
                {"detail": "Conversation not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        messages = get_conversation_messages(conversation)

        serialized_messages = serialize_messages(messages) 

        return Response(
            {
                "conversation_id": str(conversation.id),
                "messages": serialized_messages
            },
            status=status.HTTP_200_OK
        )


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = UserRegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        logger.info("New user registered successfully: id=%s, username='%s'", user.id, user.username)

        token, _ = Token.objects.get_or_create(user=user)

        return Response(
            {
                "message": "User registered successfully.",
                "token": token.key,
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = UserLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        logger.info("User login successful: id=%s, username='%s'", user.id, user.username)

        token, _ = Token.objects.get_or_create(user=user)

        return Response(
            {
                "message": "Login successful.",
                "token": token.key,
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_200_OK,
        )


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if hasattr(request.user, "auth_token"):
            request.user.auth_token.delete()

        return Response(
            {"message": "Logged out successfully."},
            status=status.HTTP_200_OK,
        )


class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)      
