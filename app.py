import os
import json
from flask import Flask, request, jsonify, render_template
from flask_login import LoginManager, login_required, current_user
from werkzeug.utils import secure_filename

from config import Config
from db.models import db, User, Question
from rag.pdf_loader import extract_text_from_pdf
from rag.chunker import chunk_documents
from rag.embedder import LocalEmbedder
from rag.vector_store import LocalFAISSStore
from rag.generator import generate_questions_with_ollama
from rag.retriever import retrieve_context
from Routes.auth_routes import auth_bp
from Routes.dashboard_routes import dashboard_bp
from Routes.moodle_routes import moodle_bp

ALLOWED_EXTENSIONS = {"pdf"}


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
    os.makedirs(app.config["DATA_FOLDER"], exist_ok=True)

    db.init_app(app)

    login_manager = LoginManager()
    login_manager.login_view = "auth.login"
    login_manager.init_app(app)

    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))

    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(moodle_bp)

    with app.app_context():
        db.create_all()

    app.embedder = LocalEmbedder(model_name="sentence-transformers/all-MiniLM-L6-v2")
    app.vector_store = LocalFAISSStore(index_dir=os.path.join(app.config["DATA_FOLDER"], "faiss_index"))

    def allowed_file(filename):
        return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

    @app.route("/")
    @login_required
    def index():
        return render_template("index.html")

    @app.route("/upload", methods=["POST"])
    @login_required
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
        return jsonify({"message": "Files uploaded successfully", "files": saved_files})

    @app.route("/index", methods=["POST"])
    @login_required
    def build_index():
        all_docs = []
        for filename in os.listdir(app.config["UPLOAD_FOLDER"]):
            if filename.lower().endswith(".pdf"):
                pdf_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
                pages = extract_text_from_pdf(pdf_path)
                for page_num, text in pages:
                    all_docs.append({"source_file": filename, "page": page_num, "text": text})
        chunks = chunk_documents(all_docs, chunk_size=800, overlap=150)
        texts = [chunk["text"] for chunk in chunks]
        embeddings = app.embedder.encode(texts)
        app.vector_store.build(embeddings, chunks)
        return jsonify({"message": "Index built successfully", "chunks_indexed": len(chunks)})

    @app.route("/generate-questions", methods=["POST"])
    @login_required
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
        retrieved_chunks = retrieve_context(query=retrieval_query, embedder=app.embedder,
                                             vector_store=app.vector_store, top_k=8)
        questions = generate_questions_with_ollama(
            retrieved_chunks=retrieved_chunks, discipline=discipline,
            category=category, topic=topic, difficulty=difficulty, counts=counts
        )

        # NOTE: assumes questions["questions"] is a list of dicts with
        # type / question_text / options / correct_answer keys — verify
        # against your actual generator.py output and adjust if different.
        saved_ids = []
        for q in questions.get("questions", []):
            row = Question(
                user_id=current_user.id, discipline=discipline, category=category,
                topic=topic, difficulty=difficulty, question_type=q.get("type", "unknown"),
                question_text=q.get("question_text", ""),
                options=json.dumps(q.get("options")) if q.get("options") else None,
                correct_answer=q.get("correct_answer", ""), status="pending",
            )
            db.session.add(row)
            saved_ids.append(row)
        db.session.commit()
        questions["saved_ids"] = [r.id for r in saved_ids]
        return jsonify(questions)

    @app.route("/files", methods=["GET"])
    @login_required
    def list_files():
        files = [f for f in os.listdir(app.config["UPLOAD_FOLDER"]) if f.lower().endswith(".pdf")]
        return jsonify({"files": files})

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=5001)