def retrieve_context(query, embedder, vector_store, top_k=8):
    query_embedding = embedder.encode([query])
    results = vector_store.search(query_embedding, top_k=top_k)
    return results
