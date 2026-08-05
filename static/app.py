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
from db.database import init_db, get_connection  # <-- NEW

UPLOAD_FOLDER = "uploads"
DATA_FOLDER = "data"
ALLOWED_EXTENSIONS = {"pdf"}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(DATA_FOLDER, exist_ok=True)

app = Flask(__name__)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# Initialize DB on startup
init_db()  # <-- NEW

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

    conn = get_connection()  # <-- NEW
    for file in files:
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
            file.save(path)
            saved_files.append(path)

            # Save to DB (ignore if already exists)
            conn.execute(
                "INSERT OR IGNORE INTO uploaded_files (filename) VALUES (?)",
                (filename,)
            )

    conn.commit()
    conn.close()

    return jsonify({"message": "Files uploaded successfully", "files": saved_files})

@app.route("/index", methods=["POST"])
def build_index():
    all_docs = []
    filenames_indexed = []

    for filename in os.listdir(UPLOAD_FOLDER):
        if filename.lower().endswith(".pdf"):
            pdf_path = os.path.join(UPLOAD_FOLDER, filename)
            pages = extract_text_from_pdf(pdf_path)
            for page_num, text in pages:
                all_docs.append({"source_file": filename, "page": page_num, "text": text})
            filenames_indexed.append(filename)

    chunks = chunk_documents(all_docs, chunk_size=800, overlap=150)
    texts = [chunk["text"] for chunk in chunks]
    embeddings = embedder.encode(texts)
    vector_store.build(embeddings, chunks)

    # Mark files as indexed in DB  <-- NEW
    conn = get_connection()
    for filename in filenames_indexed:
        conn.execute(
            "UPDATE uploaded_files SET indexed = 1 WHERE filename = ?",
            (filename,)
        )
    conn.commit()
    conn.close()

    return jsonify({"message": "Index built successfully", "chunks_indexed": len(chunks)})

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

    retrieval_query = f"Discipline: {discipline}\nCategory: {category}\nTopic: {topic}\nDifficulty: {difficulty}"
    retrieved_chunks = retrieve_context(query=retrieval_query, embedder=embedder, vector_store=vector_store, top_k=8)

    questions = generate_questions_with_ollama(
        retrieved_chunks=retrieved_chunks, discipline=discipline,
        category=category, topic=topic, difficulty=difficulty, counts=counts
    )

    # Save generated questions to DB  <-- NEW
    conn = get_connection()
    conn.execute(
        """INSERT INTO question_sets (discipline, category, topic, difficulty, questions_json)
           VALUES (?, ?, ?, ?, ?)""",
        (discipline, category, topic, difficulty, json.dumps(questions))
    )
    conn.commit()
    conn.close()

    return jsonify(questions)

@app.route("/files", methods=["GET"])
def list_files():
    # Now reads from DB instead of filesystem  <-- NEW
    conn = get_connection()
    rows = conn.execute(
        "SELECT filename, uploaded_at, indexed FROM uploaded_files ORDER BY uploaded_at DESC"
    ).fetchall()
    conn.close()
    files = [{"filename": r["filename"], "uploaded_at": r["uploaded_at"], "indexed": bool(r["indexed"])} for r in rows]
    return jsonify({"files": files})

# NEW: Retrieve past question sets
@app.route("/history", methods=["GET"])
def get_history():
    conn = get_connection()
    rows = conn.execute(
        "SELECT id, discipline, category, topic, difficulty, created_at FROM question_sets ORDER BY created_at DESC LIMIT 50"
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

# NEW: Retrieve a specific question set by ID
@app.route("/history/<int:set_id>", methods=["GET"])
def get_question_set(set_id):
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM question_sets WHERE id = ?", (set_id,)
    ).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "Not found"}), 404
    result = dict(row)
    result["questions_json"] = json.loads(result["questions_json"])
    return jsonify(result)

if __name__ == "__main__":
    app.run(debug=True, port=5001)