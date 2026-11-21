from rest_framework import serializers
from django.contrib.auth import get_user_model, authenticate
from pypdf import PdfReader
from pypdf.errors import PdfReadError

from .models import UserMemory, Document, Conversation

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "date_joined"]
        read_only_fields = fields


class UserRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        required=True,
        min_length=8,
        style={"input_type": "password"}
    )
    password_confirm = serializers.CharField(
        write_only=True,
        required=True,
        style={"input_type": "password"}
    )

    class Meta:
        model = User
        fields = ["id", "username", "email", "password", "password_confirm"]
        extra_kwargs = {
            "email": {"required": False, "allow_blank": True}
        }

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data["password"],
        )
        return user


class UserLoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=True)
    password = serializers.CharField(
        required=True,
        write_only=True,
        style={"input_type": "password"}
    )

    def validate(self, attrs):
        username = attrs.get("username")
        password = attrs.get("password")

        user = authenticate(username=username, password=password)
        if not user:
            raise serializers.ValidationError("Invalid username or password.")
        if not user.is_active:
            raise serializers.ValidationError("User account is disabled.")

        attrs["user"] = user
        return attrs

class UserMemorySerializer(serializers.ModelSerializer):
    class Meta:
        model = UserMemory
        fields = ['id', 'memory', 'category', 'created_at']
        read_only_fields = fields


class UserMemoryCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserMemory
        fields = ["memory", "category"]

    def validate_memory(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError(
                "Memory cannot be empty or contain only whitespace."
            )

        return value.strip()


class DocumentUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = [
            "title",
            "file",
            "file_size",
            "status",
            "created_at",
        ]

        read_only_fields = [
            "file_size",
            "status",
            "created_at",
        ]

    def validate_file(self, uploaded_file):
        if uploaded_file.size == 0:
            raise serializers.ValidationError(
                "Uploaded file cannot be empty."
            )
        
        # Configurable maximum file size (10 MB)
        MAX_FILE_SIZE = 10 * 1024 * 1024

        if uploaded_file.size > MAX_FILE_SIZE:
            raise serializers.ValidationError(
                "File size cannot exceed 10 MB."
            )

        uploaded_file.seek(0)
        file_header = uploaded_file.read(5)

        if file_header != b"%PDF-":
            raise serializers.ValidationError(
                "Invalid file format. Only valid PDF files are allowed."
            )

        try:
            uploaded_file.seek(0)

            reader = PdfReader(uploaded_file, strict=True)

            _ = len(reader.pages)

            if reader.is_encrypted:
                raise serializers.ValidationError(
                    "Encrypted PDF files are not supported."
                )

        except serializers.ValidationError:
            raise

        except Exception:
            raise serializers.ValidationError(
                "PDF file is corrupted or unreadable."
            )

        finally:
            uploaded_file.seek(0)

        return uploaded_file


class DocumentSerializer(serializers.ModelSerializer):

    class Meta:
        model = Document
        fields = [
            "id",
            "title",
            "file",
            "file_size",
            "status",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "file_size",
            "status",
            "created_at",
            "updated_at",
        ]


class ConversationDocumentSerializer(serializers.ModelSerializer):

    class Meta:
        model = Document
        fields = ["id", "title"]
        read_only_fields = fields


class ConversationListSerializer(serializers.ModelSerializer):
    document = ConversationDocumentSerializer(read_only=True)

    class Meta:
        model = Conversation
        fields = ['id', 'document', 'created_at', 'updated_at']
        read_only_fields = fields
