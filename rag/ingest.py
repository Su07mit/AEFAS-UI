from rag.pdf_loader import load_pdfs
from rag.chunker import chunk_text
from rag.embedder import LocalEmbedder # offline ML for me to create embeddings
from rag.vector_store import LocalFAISSStore

print(" Starting ingestion...")

# 1. Load PDFs
documents = load_pdfs("data/raw_text") # can be adjusted of we need

# 2. Chunk
chunks = []
metadata = []

for doc in documents:
    split_chunks = chunk_text(doc["text"])
    for chunk in split_chunks:
        chunks.append(chunk)
        metadata.append({"text": chunk})

print(f" Total chunks: {len(chunks)}")

# 3. Embed
embedder = LocalEmbedder()
embeddings = embedder.batch_embed(chunks)

print(" Embeddings created")

# 4. Store in FAISS
store = LocalFAISSStore()
store.build(embeddings, metadata)

print(" FAISS index built and saved!")