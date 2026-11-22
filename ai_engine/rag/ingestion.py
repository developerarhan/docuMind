import os
import logging
from langchain_community.document_loaders import PyPDFLoader
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

logger = logging.getLogger(__name__)

def load_document(file_path: str) -> list[Document]:
    extension = os.path.splitext(file_path)[1].lower()

    if not os.path.isfile(file_path):
        logger.error("File does not exist: %s", file_path)
        raise FileNotFoundError("File does not exist.")
    
    if extension != ".pdf": 
        logger.error("Invalid file extension: %s (expected .pdf)", extension)
        raise ValueError("Please upload a valid PDF document.")

    logger.debug("Loading PDF via PyPDFLoader from path: %s", file_path)
    loader = PyPDFLoader(file_path)

    documents = loader.load()
    logger.info("Loaded %s page(s) from %s", len(documents), file_path)

    return documents


def split_documents(documents: list[Document]):
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200
    )

    chunks = splitter.split_documents(documents)
    logger.debug("Split %s document page(s) into %s chunks", len(documents), len(chunks))

    return chunks
