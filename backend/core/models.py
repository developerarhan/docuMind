import uuid
from django.db import models
from django.conf import settings


class UserMemory(models.Model):
    class Category(models.TextChoices):
        PREFERENCE = "preference", "Preference"
        LEARNING_GOAL = "learning_goal", "Learning Goal"
        PERSONAL_CONTEXT = "personal_context", "Personal Context"
        INTEREST = "interest", "Interest"
        OTHER = "other", "Other"
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name="memories"
    )
    memory = models.TextField()
    category = models.CharField(
        max_length=30,
        choices=Category.choices,
        default=Category.OTHER
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user} - {self.category}: {self.memory[:50]}"
    

class Document(models.Model):
    class DocumentStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        READY = "ready", "Ready"
        FAILED = "failed", "Failed"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="documents"
    )
    title = models.CharField(max_length=255)
    file = models.FileField(
        upload_to="documents/%Y/%m/"
    )
    file_size = models.PositiveBigIntegerField()
    status = models.CharField(
        max_length=20,
        choices=DocumentStatus.choices,
        default=DocumentStatus.PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title


class Conversation(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="conversations"
    )
    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="conversations"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Conversation {self.id}"
