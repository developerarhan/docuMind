import os
from langchain_community.document_loaders import PyPDFLoader
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

def load_document(file_path: str) -> list[Document]:
    extension = os.path.splitext(file_path)[1].lower()

    if not os.path.isfile(file_path):
        raise FileNotFoundError("File does not exist.")
    
    if extension != ".pdf": 
        raise ValueError("Please upload a valid PDF document.")

    loader = PyPDFLoader(file_path)

    documents = loader.load()

    # print(documents)

    return documents


def split_documents(documents: list[Document]):
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200
    )

    chunks = splitter.split_documents(documents)

    return chunks
