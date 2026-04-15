from sentence_transformers import SentenceTransformer

class LocalEmbedder:
    def __init__(self, model_name="sentence-transformers/all-MiniLM-L6-v2"):
        self.model = SentenceTransformer(model_name)

    def embed(self, text):
        return self.model.encode([text], convert_to_numpy=True)[0]

    def batch_embed(self, texts):
        return self.model.encode(texts, convert_to_numpy=True)
