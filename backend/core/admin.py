from django.contrib import admin
from django.utils.html import escape
from django.utils.safestring import mark_safe
from django.conf import settings
from pathlib import Path

from .models import Document, Conversation, UserMemory
from .services.document_service import get_conversation_messages


def _get_chroma_chunks_for_document(document_id: int):
    """
    Helper to fetch stored chunks from ChromaDB for a given document.
    """
    try:
        import chromadb

        candidates = [
            settings.BASE_DIR / "chroma_db",
            settings.BASE_DIR.parent / "chroma_db",
            Path("./chroma_db"),
        ]
        db_path = next((p for p in candidates if p.exists()), candidates[0])

        client = chromadb.PersistentClient(path=str(db_path))
        try:
            collection = client.get_collection("documind_documents")
        except Exception:
            return []

        results = collection.get(
            where={"document_id": document_id},
            include=["documents", "metadatas"],
        )

        chunks = []
        ids = results.get("ids", [])
        docs = results.get("documents", [])
        metas = results.get("metadatas", [])

        for chunk_id, text, meta in zip(ids, docs, metas):
            meta = meta or {}
            page_val = meta.get("page", meta.get("page_label", "N/A"))
            chunks.append({
                "id": chunk_id,
                "text": text,
                "page": page_val,
                "length": len(text),
            })
        return chunks
    except Exception:
        return []


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "user",
        "status",
        "file_size",
        "chroma_chunks_count",
        "created_at",
    )
    list_filter = ("status", "created_at", "user")
    search_fields = ("title", "user__username")
    readonly_fields = (
        "id",
        "file_size",
        "created_at",
        "updated_at",
        "chroma_chunks_count",
        "chroma_chunks_preview",
    )

    @admin.display(description="Chroma Chunks")
    def chroma_chunks_count(self, obj):
        if not obj.pk:
            return 0
        chunks = _get_chroma_chunks_for_document(obj.id)
        count = len(chunks)
        if count > 0:
            return mark_safe(f'<strong style="color: green;">{count} chunks</strong>')
        return mark_safe('<span style="color: gray;">0 chunks</span>')

    @admin.display(description="Stored Chroma Chunks (Vector Store)")
    def chroma_chunks_preview(self, obj):
        if not obj.pk:
            return "Save document first to view Chroma chunks."

        chunks = _get_chroma_chunks_for_document(obj.id)
        if not chunks:
            safe_status = escape(obj.status)
            return mark_safe(
                '<div style="padding: 10px; background: #fff3cd; color: #856404; border-radius: 4px;">'
                f'No vector chunks found in ChromaDB for this document. Status is <strong>{safe_status}</strong>.'
                '</div>'
            )

        rows = []
        for idx, chunk in enumerate(chunks, 1):
            short_id = escape(chunk["id"][:12] + "..." if len(chunk["id"]) > 12 else chunk["id"])
            page_str = escape(str(chunk["page"]))
            preview_text = chunk["text"][:250] + ("..." if len(chunk["text"]) > 250 else "")
            safe_text = escape(preview_text).replace("\n", "<br/>")

            rows.append(
                f'<tr style="border-bottom: 1px solid #ddd;">'
                f'<td style="padding: 8px; vertical-align: top;"><strong>#{idx}</strong></td>'
                f'<td style="padding: 8px; vertical-align: top;"><code style="font-size: 11px;">{short_id}</code></td>'
                f'<td style="padding: 8px; vertical-align: top; text-align: center;">Page {page_str}</td>'
                f'<td style="padding: 8px; vertical-align: top; text-align: center;">{chunk["length"]} chars</td>'
                f'<td style="padding: 8px; vertical-align: top; font-family: monospace; font-size: 12px; background: #fafafa;">{safe_text}</td>'
                f'</tr>'
            )

        total_chunks = len(chunks)
        table_html = (
            f'<div style="max-height: 450px; overflow-y: auto; border: 1px solid #ccc; border-radius: 4px;">'
            f'<table style="width: 100%; border-collapse: collapse; text-align: left;">'
            f'<thead style="background: #2b3a4a; color: white;">'
            f'<tr>'
            f'<th style="padding: 8px;">#</th>'
            f'<th style="padding: 8px;">Chunk ID</th>'
            f'<th style="padding: 8px;">Page</th>'
            f'<th style="padding: 8px;">Size</th>'
            f'<th style="padding: 8px;">Chunk Text Snippet</th>'
            f'</tr>'
            f'</thead>'
            f'<tbody>'
            f'{"".join(rows)}'
            f'</tbody>'
            f'</table>'
            f'</div>'
            f'<p style="margin-top: 8px; color: #555;">Total indexed chunks in Chroma: <strong>{total_chunks}</strong></p>'
        )

        return mark_safe(table_html)


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "document",
        "checkpoint_thread_status",
        "created_at",
        "updated_at",
    )
    list_filter = ("user", "created_at", "updated_at")
    search_fields = ("id", "user__username", "document__title")
    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
        "checkpoint_thread_id",
        "checkpoint_memory_history",
    )

    @admin.display(description="LangGraph Thread ID")
    def checkpoint_thread_id(self, obj):
        return str(obj.id)

    @admin.display(description="Checkpoint Memory")
    def checkpoint_thread_status(self, obj):
        if not obj.pk:
            return "-"
        try:
            messages = get_conversation_messages(obj)
            count = len(messages)
            if count > 0:
                return mark_safe(f'<strong style="color: green;">{count} messages</strong>')
            return mark_safe('<span style="color: gray;">Empty thread</span>')
        except Exception:
            return mark_safe('<span style="color: red;">Unreachable</span>')

    @admin.display(description="LangGraph Checkpoint History")
    def checkpoint_memory_history(self, obj):
        if not obj.pk:
            return "Save conversation first."

        try:
            messages = get_conversation_messages(obj)
        except Exception as e:
            err_msg = escape(str(e))
            return mark_safe(
                '<div style="padding: 10px; background: #f8d7da; color: #721c24; border-radius: 4px;">'
                f'Unable to retrieve LangGraph checkpoints from PostgreSQL: {err_msg}'
                '</div>'
            )

        if not messages:
            safe_id = escape(str(obj.id))
            return mark_safe(
                '<div style="padding: 10px; background: #f0f0f0; color: #666; border-radius: 4px;">'
                f'No message history found in LangGraph checkpointer for thread <code>{safe_id}</code>.'
                '</div>'
            )

        rendered_messages = []
        for msg in messages:
            msg_type = getattr(msg, "type", "unknown")
            content = getattr(msg, "content", "")
            safe_content = escape(content).replace("\n", "<br/>")

            if msg_type in ("human", "user"):
                badge_style = "background: #007bff; color: white;"
                box_style = "background: #e7f1ff; border-left: 4px solid #007bff;"
                sender_label = "User (Human)"
            elif msg_type in ("ai", "assistant"):
                badge_style = "background: #28a745; color: white;"
                box_style = "background: #eafaf1; border-left: 4px solid #28a745;"
                sender_label = "DocuMind AI"
            elif msg_type == "tool":
                badge_style = "background: #6f42c1; color: white;"
                box_style = "background: #f3e8ff; border-left: 4px solid #6f42c1;"
                tool_name = escape(getattr(msg, "name", "output"))
                sender_label = f"Tool ({tool_name})"
            else:
                badge_style = "background: #6c757d; color: white;"
                box_style = "background: #f8f9fa; border-left: 4px solid #6c757d;"
                sender_label = escape(msg_type.capitalize())

            rendered_messages.append(
                f'<div style="margin-bottom: 12px; padding: 10px; border-radius: 4px; {box_style}">'
                f'<div style="margin-bottom: 6px;">'
                f'<span style="padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; {badge_style}">'
                f'{sender_label}'
                f'</span>'
                f'</div>'
                f'<div style="font-size: 13px; line-height: 1.5; color: #333;">{safe_content}</div>'
                f'</div>'
            )

        safe_obj_id = escape(str(obj.id))
        total_msgs = len(messages)
        history_html = (
            f'<div style="max-height: 500px; overflow-y: auto; padding: 10px; border: 1px solid #ccc; border-radius: 4px; background: #fff;">'
            f'{"".join(rendered_messages)}'
            f'</div>'
            f'<p style="margin-top: 8px; color: #555;">Thread ID: <code>{safe_obj_id}</code> | Total Messages: <strong>{total_msgs}</strong></p>'
        )

        return mark_safe(history_html)


@admin.register(UserMemory)
class UserMemoryAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "category", "short_memory", "created_at")
    list_filter = ("category", "created_at", "user")
    search_fields = ("memory", "user__username")
    readonly_fields = ("created_at",)

    @admin.display(description="Memory Preview")
    def short_memory(self, obj):
        if len(obj.memory) > 80:
            return obj.memory[:80] + "..."
        return obj.memory
