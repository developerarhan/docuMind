from django.urls import path


from .views import (
    UserMemoriesView,
    UserMemoryDetailView,
    DocumentUploadView,
    DocumentDetailView,
    DocumentProcessView,
    DocumentChatView,
    ConversationListView,
    ConversationDetailView,
    ConversationMessagesView,
    RegisterView,
    LoginView,
    LogoutView,
    UserProfileView,
)

urlpatterns = [
    # Authentication endpoints
    path("auth/register/", RegisterView.as_view(), name="auth-register"),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("auth/me/", UserProfileView.as_view(), name="auth-me"),

    # User memories
    path(
        "memories/",
        UserMemoriesView.as_view(),
        name="user-memories"
    ),
    path(
        "memories/<int:id>/",
        UserMemoryDetailView.as_view(),
        name="user-memory-detail"
    ),
    path(
        "documents/",
        DocumentUploadView.as_view(),
        name="document"
    ),
    path(
        "documents/<int:id>/",
        DocumentDetailView.as_view(),
        name="document-detail"
    ),
    path(
        "documents/<int:id>/process/",
        DocumentProcessView.as_view(),
        name="document-process"
    ),
    path(
        "documents/<int:id>/chat/",
        DocumentChatView.as_view(),
        name="document-chats"    
    ),
    path(
        "conversations/",
        ConversationListView.as_view(),
        name="conversation-list"
    ),
    path(
        "conversations/<uuid:conversation_id>/",
        ConversationDetailView.as_view(),
        name="conversation-detail"
    ),
    path(
        "conversations/<uuid:conversation_id>/messages/",
        ConversationMessagesView.as_view(),
        name="conversation-messages"
    ),

]
