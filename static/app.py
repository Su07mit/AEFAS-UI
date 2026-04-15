import os
import json
from flask import Flask, request, jsonify, render_template
from werkzeug.utils import secure_filename
from rag.pdf_loader import extract_text_from_pdf
from rag.chunker import chunk_documents
from rag.embedder import LocalEmbedder
from rag.vector_store import LocalFAISSStore
from rag.generator import generate_questions_with_ollama
from rag.retriever import retrieve_context

UPLOAD_FOLDER = "uploads"
DATA_FOLDER = "data"
ALLOWED_EXTENSIONS = {"pdf"}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(DATA_FOLDER, exist_ok=True)

app = Flask(__name__)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

embedder = LocalEmbedder(model_name="sentence-transformers/all-MiniLM-L6-v2")
vector_store = LocalFAISSStore(index_dir="data/faiss_index")


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/upload", methods=["POST"])
def upload_files():
    if "files" not in request.files:
        return jsonify({"error": "No files uploaded"}), 400

    files = request.files.getlist("files")
    saved_files = []

    for file in files:
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
            file.save(path)
            saved_files.append(path)

    return jsonify({
        "message": "Files uploaded successfully",
        "files": saved_files
    })


@app.route("/index", methods=["POST"])
def build_index():
    all_docs = []

    for filename in os.listdir(UPLOAD_FOLDER):
        if filename.lower().endswith(".pdf"):
            pdf_path = os.path.join(UPLOAD_FOLDER, filename)
            pages = extract_text_from_pdf(pdf_path)
            for page_num, text in pages:
                all_docs.append({
                    "source_file": filename,
                    "page": page_num,
                    "text": text
                })

    chunks = chunk_documents(all_docs, chunk_size=800, overlap=150)
    texts = [chunk["text"] for chunk in chunks]
    embeddings = embedder.encode(texts)
    vector_store.build(embeddings, chunks)

    return jsonify({
        "message": "Index built successfully",
        "chunks_indexed": len(chunks)
    })


@app.route("/generate-questions", methods=["POST"])
def generate_questions():
    data = request.json

    discipline = data.get("discipline", "")
    category = data.get("questionCategory", "")
    topic = data.get("topic", "")
    difficulty = data.get("difficulty", "Easy")

    counts = {
        "multiple_choice": int(data.get("multipleChoice", 0)),
        "true_false": int(data.get("trueFalse", 0)),
        "short_answer": int(data.get("shortAnswer", 0)),
        "essay": int(data.get("essay", 0)),
        "numerical": int(data.get("numerical", 0)),
        "matching": int(data.get("matching", 0)),
    }

    retrieval_query = f"""
    Discipline: {discipline}
    Category: {category}
    Topic: {topic}
    Difficulty: {difficulty}
    Generate assessment questions based on the uploaded teaching materials.
    """

    retrieved_chunks = retrieve_context(
        query=retrieval_query,
        embedder=embedder,
        vector_store=vector_store,
        top_k=8
    )

    questions = generate_questions_with_ollama(
        retrieved_chunks=retrieved_chunks,
        discipline=discipline,
        category=category,
        topic=topic,
        difficulty=difficulty,
        counts=counts
    )

    return jsonify(questions)


@app.route("/files", methods=["GET"])
def list_files():
    files = [f for f in os.listdir(UPLOAD_FOLDER) if f.lower().endswith(".pdf")]
    return jsonify({"files": files})


if __name__ == "__main__":
    app.run(debug=True)
