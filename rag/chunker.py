def chunk_text(text, chunk_size=800, overlap=150):
    chunks = []
    start = 0
    text_length = len(text)

    while start < text_length:
        end = min(start + chunk_size, text_length)
        chunk = text[start:end]
        chunks.append(chunk)
        start += chunk_size - overlap

    return chunks


def chunk_documents(documents, chunk_size=800, overlap=150):
    all_chunks = []
    chunk_id = 0

    for doc in documents:
        text_chunks = chunk_text(doc["text"], chunk_size, overlap)
        for chunk in text_chunks:
            all_chunks.append({
                "chunk_id": chunk_id,
                "source_file": doc["source_file"],
                "page": doc["page"],
                "text": chunk
            })
            chunk_id += 1

    return all_chunks