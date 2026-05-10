# AEFAS-UI — AI-Enhanced Formative Assessment System

> An intelligent, locally-run web application that helps university lecturers generate high-quality formative assessment questions grounded in their own subject materials using RAG (Retrieval-Augmented Generation) and a local LLM.

---

## 📌 Overview

AEFAS-UI is a Flask-based web application that allows educators to:

- Upload subject PDFs (lecture notes, rubrics, guidelines, outcomes)
- Automatically index and embed content using FAISS vector search
- Generate discipline-specific assessment questions using a local TinyLlama LLM
- Review, edit, approve, or discard AI-generated questions
- Export approved questions to GIFT or XML format for LMS integration

All AI processing runs **100% locally** — no external APIs, no internet required after setup, no data leaves your machine.

---

## 🗂️ Project Structure

```
AEFAS-UI/
├── app.py                  # Flask backend — main server & routes
├── config.py               # App configuration
├── requirements.txt        # Python dependencies
│
├── rag/                    # RAG pipeline
│   ├── pdf_loader.py       # Extract text from uploaded PDFs
│   ├── chunker.py          # Split documents into chunks
│   ├── embedder.py         # Sentence embeddings (all-MiniLM-L6-v2)
│   ├── vector_store.py     # FAISS index build & search
│   ├── retriever.py        # Query the vector store
│   └── generator.py        # TinyLlama question generation
│
├── Routes/                 # Flask route handlers
├── data/                   # FAISS index storage
├── db/                     # Database layer
├── uploads/                # Teacher-uploaded PDFs
│
├── static/
│   ├── script.js           # Frontend logic
│   └── style.css           # Stylesheet
│
└── templates/
    └── index.html          # Main UI
```

---

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- macOS (Apple Silicon M-series recommended) or Windows/Linux with 8GB+ RAM
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/Su07mit/AEFAS-UI.git
cd AEFAS-UI
```

### 2. Create a Virtual Environment

```bash
python -m venv .venv
source .venv/bin/activate        # macOS/Linux
.venv\Scripts\activate           # Windows
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Run the App

```bash
python app.py
```

Open your browser and go to: `http://127.0.0.1:5001`

> **First run:** TinyLlama (~2.2GB) and the embedding model will download automatically. This takes a few minutes once only.

---

## 🧠 How It Works

```
Teacher uploads PDF
        ↓
Text extracted (PyMuPDF) → chunked → embedded (MiniLM) → stored in FAISS
        ↓
Teacher fills assessment form (discipline, topic, difficulty, question types)
        ↓
Query embedded → top chunks retrieved from FAISS (RAG)
        ↓
TinyLlama generates questions grounded in PDF content
        ↓
Human-in-the-loop review: Approve / Edit / Discard
        ↓
Approved questions exported to GIFT/XML for LMS
```

---

## 🎓 Supported Question Types

| Type | Description |
|---|---|
| Multiple Choice | 4-option questions with correct answer |
| True / False | Statement-based questions |
| Short Answer | Brief written response questions |
| Essay | Extended discussion/analysis questions |
| Numerical | Calculation-based questions |
| Matching | Term-to-definition matching |

---

## 🏫 Supported Disciplines

- Information Technology
- Information Systems
- Accounting
- Business
- Management
- TESOL

---

## ⚙️ Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python, Flask |
| LLM | TinyLlama-1.1B-Chat (local, HuggingFace Transformers) |
| Embeddings | sentence-transformers/all-MiniLM-L6-v2 |
| Vector Store | FAISS (faiss-cpu) |
| PDF Processing | PyMuPDF, pypdf |
| RAG Framework | LangChain |
| Frontend | HTML, CSS, JavaScript (vanilla) |
| Database | SQLAlchemy |
| GPU Acceleration | Apple MPS (M-series) / CUDA (NVIDIA) |

---

## 📋 Key Features

- **100% Local** — No API keys, no cloud, no data sharing
- **RAG-Grounded** — Questions generated from actual uploaded content
- **Human-in-the-Loop** — All questions reviewed before approval
- **Multi-Discipline** — Supports 6 academic disciplines
- **Multi-Type** — 6 question formats supported
- **Difficulty Control** — Easy / Medium / Hard / AI Suggested
- **Export Ready** — GIFT and XML export for Moodle/LMS
- **Apple Silicon Optimised** — Uses MPS GPU on M-series Macs

---

## 🖥️ Usage Guide

### Step 1 — Upload Subject PDFs
Go to the **Upload Teaching Resources** section and click **Choose PDF Files** to upload your subject materials (lecture notes, rubrics, assessment guidelines etc).

### Step 2 — Build the RAG Index
Click **⚡ Build RAG Index** to process and embed your uploaded PDFs into the vector store.

### Step 3 — Generate Questions
Fill in the assessment form:
- Select **Discipline** and **Question Category**
- Enter a **Topic**
- Choose **Difficulty**
- Set counts for each question type
- Click **Generate Questions**

### Step 4 — Review & Approve
In the **Human-in-the-Loop Review** section:
- Read each generated question
- Edit the text if needed
- Click **Approve** to add to the Item Bank, or **Discard** to remove

### Step 5 — Export
Go to the **Export** section to download approved questions in GIFT or XML format for your LMS.

---

## ⚠️ Known Limitations

- TinyLlama is a 1.1B parameter model — question quality improves with better subject PDFs
- Generation takes 30–90 seconds per batch depending on hardware
- Scanned/image-based PDFs without text layers cannot be indexed
- Currently supports single-session question banks (no persistent database yet)

---

## 🔮 Planned Features

- [ ] User authentication (Teacher / Student roles)
- [ ] Persistent question bank database
- [ ] Student practice mode with AI feedback
- [ ] Direct Moodle LMS integration
- [ ] Support for larger models (Mistral 7B, Llama 3)
- [ ] OCR support for scanned PDFs
- [ ] Analytics dashboard

---

## 👨‍💻 Author

**Sumit Kafle**
Bachelor of Information Technology
GitHub: [@Su07mit](https://github.com/Su07mit)

---

## 📄 License

This project is for academic purposes. All rights reserved.
