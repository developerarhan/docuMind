from django.core.management.base import BaseCommand
from django.conf import settings
from pathlib import Path
import chromadb


class Command(BaseCommand):
    help = "Inspect chunks and metadata stored in ChromaDB."

    def add_arguments(self, parser):
        parser.add_argument(
            "--doc-id",
            type=int,
            dest="document_id",
            help="Filter chunks by specific Document ID",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=5,
            help="Maximum number of chunks to print (default: 5)",
        )

    def handle(self, *args, **options):
        candidates = [
            settings.BASE_DIR / "chroma_db",
            settings.BASE_DIR.parent / "chroma_db",
            Path("./chroma_db"),
        ]
        db_path = next((p for p in candidates if p.exists()), candidates[0])

        self.stdout.write(self.style.NOTICE(f"Connecting to Chroma at: {db_path}"))

        try:
            client = chromadb.PersistentClient(path=str(db_path))
            collection = client.get_collection("documind_documents")
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Failed to load Chroma collection: {e}"))
            return

        total_count = collection.count()
        self.stdout.write(self.style.SUCCESS(f"Total chunks stored in collection 'documind_documents': {total_count}"))

        doc_id = options.get("document_id")
        limit = options.get("limit")

        where_filter = {"document_id": doc_id} if doc_id is not None else None

        results = collection.get(
            where=where_filter,
            include=["documents", "metadatas"],
            limit=limit,
        )

        ids = results.get("ids", [])
        documents = results.get("documents", [])
        metadatas = results.get("metadatas", [])

        if not ids:
            if doc_id is not None:
                self.stdout.write(self.style.WARNING(f"No chunks found for Document ID {doc_id}."))
            else:
                self.stdout.write(self.style.WARNING("Collection is empty."))
            return

        self.stdout.write(self.style.SUCCESS(f"\nFound {len(ids)} chunk(s) (displaying up to {limit}):\n"))

        for idx, (chunk_id, doc_text, meta) in enumerate(zip(ids, documents, metadatas), 1):
            page = meta.get("page", meta.get("page_label", "Unknown")) if meta else "Unknown"
            doc_id_val = meta.get("document_id", "Unknown") if meta else "Unknown"
            self.stdout.write(f"--- Chunk #{idx} ---")
            self.stdout.write(f"  Chunk ID   : {chunk_id}")
            self.stdout.write(f"  Document ID: {doc_id_val}")
            self.stdout.write(f"  Page       : {page}")
            self.stdout.write(f"  Length     : {len(doc_text)} characters")
            snippet = doc_text[:200].replace("\n", " ") + ("..." if len(doc_text) > 200 else "")
            self.stdout.write(f"  Preview    : {snippet}\n")
