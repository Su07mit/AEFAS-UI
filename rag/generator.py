import json
import re
import platform
from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline
import torch

MODEL_NAME = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"

# Load model once when the module is imported
print(f"Loading {MODEL_NAME}... (first time downloads ~2GB, please wait)")

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

# Prefer NVIDIA CUDA, then Apple MPS, then fall back to CPU
if torch.cuda.is_available():
    device = torch.device("cuda")
    model_dtype = torch.float16
    print(f"Using CUDA GPU ({torch.cuda.get_device_name(0)}) for fast question generation!")
elif torch.backends.mps.is_available():
    device = torch.device("mps")
    model_dtype = torch.float32
    print("Using Apple MPS (GPU) for faster Question generation! PLEASE WAIT")
else:
    device = torch.device("cpu")
    model_dtype = torch.float32
    print("Using CPU — Question generation will be slow")

model = AutoModelForCausalLM.from_pretrained(
    MODEL_NAME,
    torch_dtype=model_dtype,
    low_cpu_mem_usage=True
).to(device)

generator = pipeline(
    "text-generation",
    model=model,
    tokenizer=tokenizer,
    device=device,
    max_new_tokens=256,
    do_sample=True,
    temperature=0.3,
    repetition_penalty=1.1
)

print("Model loaded and ready!")


# ─── Single Question Parser ──────────────────────────────────────────────────

def parse_single_question(raw, q_type, topic, difficulty, source, category):
    """Parse the simple Q/A format into our JSON structure."""
    lines = [l.strip() for l in raw.strip().split("\n") if l.strip()]

    question_text = ""
    options = []
    answer = ""
    explanation = ""

    for line in lines:
        if line.startswith("Q:"):
            question_text = line[2:].strip()
        elif line.startswith("A:") and q_type == "multiple_choice":
            options.append(line[2:].strip())
        elif line.startswith("B:") and q_type == "multiple_choice":
            options.append(line[2:].strip())
        elif line.startswith("C:") and q_type == "multiple_choice":
            options.append(line[2:].strip())
        elif line.startswith("D:") and q_type == "multiple_choice":
            options.append(line[2:].strip())
        elif line.startswith("Answer:"):
            answer = line[7:].strip()
        elif line.startswith("Explanation:"):
            explanation = line[12:].strip()

    # If no question was parsed, use the raw text
    if not question_text:
        question_text = raw[:200].strip()

    return {
        "type": q_type,
        "difficulty": difficulty,
        "topic": topic,
        "question": question_text,
        "options": options if options else None,
        "answer": answer,
        "explanation": explanation,
        "source_file": source,
        "page": 1,
        "chunk_id": 0
    }


# ─── Fallback Single Question ────────────────────────────────────────────────

def fallback_single_question(q_type, topic, discipline, difficulty, source, category):
    """Simple fallback if generation completely fails for one question."""
    templates = {
        "multiple_choice": f"Which of the following best describes {topic} in {discipline}?",
        "true_false": f"True or False: {topic} is a fundamental concept in {discipline}.",
        "short_answer": f"Briefly explain the significance of {topic} in {discipline}.",
        "essay": f"Critically discuss how {topic} applies in {discipline} practice.",
        "numerical": f"Calculate an example related to {topic} in a {discipline} context.",
        "matching": f"Match the key terms related to {topic} with their correct definitions."
    }
    return {
        "type": q_type,
        "difficulty": difficulty,
        "topic": topic,
        "question": templates.get(q_type, f"Question about {topic}"),
        "options": ["Option A", "Option B", "Option C", "Option D"] if q_type == "multiple_choice" else None,
        "answer": "See answer key",
        "explanation": f"This question covers {topic} in {discipline}.",
        "source_file": source,
        "page": 1,
        "chunk_id": 0
    }


# ─── Single Question Generator ───────────────────────────────────────────────

def generate_single_question(q_type, label, context, source, discipline, topic, difficulty, category):
    """Generate one question at a time — much more reliable than asking for all at once."""

    if q_type == "multiple_choice":
        prompt = f"""<|system|>
You are a university lecturer creating exam questions. Be specific and use the context provided.</s>
<|user|>
Context from {source}: "{context}"

Write 1 multiple choice question about {topic} for {discipline} students ({difficulty} level).
Format exactly like this:
Q: [your question here]
A: [correct answer]
B: [wrong answer]
C: [wrong answer]
D: [wrong answer]
Answer: A
Explanation: [one sentence why A is correct]</s>
<|assistant|>
Q:"""

    elif q_type == "true_false":
        prompt = f"""<|system|>
You are a university lecturer creating exam questions.</s>
<|user|>
Context from {source}: "{context}"

Write 1 true/false question about {topic} for {discipline} students ({difficulty} level).
Format exactly like this:
Q: [statement that is clearly true or false]
Answer: True
Explanation: [one sentence explanation]</s>
<|assistant|>
Q:"""

    elif q_type == "short_answer":
        prompt = f"""<|system|>
You are a university lecturer creating exam questions.</s>
<|user|>
Context from {source}: "{context}"

Write 1 short answer question about {topic} for {discipline} students ({difficulty} level).
Format exactly like this:
Q: [your question]
Answer: [2-3 sentence model answer]
Explanation: [why this answer is correct]</s>
<|assistant|>
Q:"""

    elif q_type == "essay":
        prompt = f"""<|system|>
You are a university lecturer creating exam questions.</s>
<|user|>
Context from {source}: "{context}"

Write 1 essay question about {topic} for {discipline} students ({difficulty} level).
Format exactly like this:
Q: [discussion/analysis question]
Answer: [key points to cover in the essay]
Explanation: [marking guidance]</s>
<|assistant|>
Q:"""

    elif q_type == "numerical":
        prompt = f"""<|system|>
You are a university lecturer creating exam questions.</s>
<|user|>
Context from {source}: "{context}"

Write 1 numerical question about {topic} for {discipline} students ({difficulty} level).
Format exactly like this:
Q: [calculation question with numbers]
Answer: [numerical answer with working]
Explanation: [how to solve it]</s>
<|assistant|>
Q:"""

    else:  # matching
        prompt = f"""<|system|>
You are a university lecturer creating exam questions.</s>
<|user|>
Context from {source}: "{context}"

Write 1 matching question about {topic} for {discipline} students ({difficulty} level).
Format exactly like this:
Q: Match each term with its definition: Term1, Term2, Term3
A: Term1 = [definition]
B: Term2 = [definition]
C: Term3 = [definition]
Answer: A, B, C matched correctly
Explanation: [brief explanation]</s>
<|assistant|>
Q:"""

    # Generate
    import time
    start = time.time()
    try:
        output = generator(prompt)
        elapsed = time.time() - start
        generated = output[0]["generated_text"]
        raw = generated.split("<|assistant|>")[-1].strip()
        if not raw.startswith("Q:"):
            raw = "Q: " + raw
        print(f"✅ Generated {q_type} question in {elapsed:.1f}s")
        return parse_single_question(raw, q_type, topic, difficulty, source, category)
    except Exception as e:
        elapsed = time.time() - start
        print(f"⚠️ Failed to generate {q_type} after {elapsed:.1f}s: {e} — using fallback")
        return fallback_single_question(q_type, topic, discipline, difficulty, source, category)


# ─── Build All Questions ─────────────────────────────────────────────────────

def build_prompt(retrieved_chunks, discipline, category, topic, difficulty, counts):
    """Generate all questions one at a time using RAG context."""

    # Use the most relevant chunk for context
    context = retrieved_chunks[0]["text"][:500] if retrieved_chunks else ""
    source = retrieved_chunks[0].get("source_file", "PDF") if retrieved_chunks else "PDF"

    type_labels = {
        "multiple_choice": "Multiple Choice",
        "true_false": "True/False",
        "short_answer": "Short Answer",
        "essay": "Essay",
        "numerical": "Numerical",
        "matching": "Matching"
    }

    questions_needed = []
    for q_type, label in type_labels.items():
        for i in range(counts.get(q_type, 0)):
            questions_needed.append((q_type, label))

    print(f"Generating {len(questions_needed)} questions one at a time...")

    all_questions = []
    for q_type, label in questions_needed:
        q = generate_single_question(
            q_type, label, context, source,
            discipline, topic, difficulty, category
        )
        all_questions.append(q)

    return all_questions


# ─── Practice-Mode Explanation Generator ─────────────────────────────────────

def generate_explanation(question_text, context, topic):
    """Generate a tutor-style explanation for a practice question. Used by the
    Student Practice Mode 'Get AI Explanation' feature."""
    prompt = f"""<|system|>
You are a supportive university tutor helping a student understand a concept.</s>
<|user|>
Context: "{context}"

The student is practicing this question about {topic}:
"{question_text}"

Write a clear, encouraging explanation (3-4 sentences) that helps the student
understand the underlying concept. Do not just repeat the question.</s>
<|assistant|>
"""
    try:
        output = generator(prompt)
        generated = output[0]["generated_text"]
        explanation = generated.split("<|assistant|>")[-1].strip()
        return explanation or f"Review your source material on {topic} — focus on the core definitions and how they apply in practice."
    except Exception as e:
        print(f"⚠️ Explanation generation failed: {e}")
        return f"Explanation unavailable right now. Review your source material on {topic} in the meantime."


# ─── Main Entry Point ────────────────────────────────────────────────────────

def generate_questions_with_ollama(retrieved_chunks, discipline, category, topic, difficulty, counts):
    """
    Main function called by app.py.
    Same name kept so app.py needs zero changes.
    """
    if not retrieved_chunks:
        return {
            "questions": [],
            "error": "No RAG context found — please upload and index PDFs first"
        }

    print(f"Starting generation: {discipline} | {topic} | {difficulty}")
    questions = build_prompt(retrieved_chunks, discipline, category, topic, difficulty, counts)

    print(f"✅ Done — {len(questions)} questions generated")
    return {"questions": questions}