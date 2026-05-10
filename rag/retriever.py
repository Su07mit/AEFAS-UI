# rag/retriever.py
from rag.vector_store import LocalFAISSStore
from rag.embedder import LocalEmbedder

def retrieve_context(query: str, embedder=None, vector_store=None, top_k: int = 5) -> list:
    """
    Embed the query and retrieve the top_k most relevant
    chunks from the local FAISS vector store.
    """
    # Use passed-in instances or create new ones
    if embedder is None:
        embedder = LocalEmbedder()
    if vector_store is None:
        vector_store = LocalFAISSStore()

    # Embed the query
    query_embedding = embedder.embed(query)

    # Search for similar chunks
    results = vector_store.search(query_embedding, top_k=top_k)
    return results