import json
import requests


OLLAMA_URL = "[localhost](http://localhost:11434/api/generate)"
MODEL_NAME = "qwen2.5:3b"


def build_prompt(retrieved_chunks, discipline, category, topic, difficulty, counts):
    context = "\n\n".join([
        f"[Source: {c['source_file']} | Page: {c['page']} | Chunk: {c['chunk_id']}]\n{c['text']}"
        for c in retrieved_chunks
    ])

    return f"""
You are an assessment generation engine.

Use ONLY the provided context from teacher-uploaded PDFs.
Do not invent facts outside the context.
Generate high-quality formative assessment questions.

Discipline: {discipline}
Question category: {category}
Topic: {topic}
Difficulty: {difficulty}

Required counts:
- multiple_choice: {counts['multiple_choice']}
- true_false: {counts['true_false']}
- short_answer: {counts['short_answer']}
- essay: {counts['essay']}
- numerical: {counts['numerical']}
- matching: {counts['matching']}

Rules:
1. Questions must be grounded in the context.
2. Match difficulty level.
3. Include answer and explanation.
4. For MCQ, provide exactly 4 options.
5. Return STRICT JSON only.
6. Use this schema:

{{
  "questions": [
    {{
      "type": "multiple_choice",
      "difficulty": "easy",
      "topic": "string",
      "question": "string",
      "options": ["a", "b", "c", "d"],
      "answer": "string",
      "explanation": "string",
      "source_file": "string",
      "page": 1,
      "chunk_id": 0
    }}
  ]
}}

Context:
{context}
    """


def generate_questions_with_ollama(retrieved_chunks, discipline, category, topic, difficulty, counts):
    prompt = build_prompt(retrieved_chunks, discipline, category, topic, difficulty, counts)

    response = requests.post(
        OLLAMA_URL,
        json={
            "model": MODEL_NAME,
            "prompt": prompt,
            "stream": False,
            "format": "json"
        },
        timeout=180
    )

    response.raise_for_status()
    raw = response.json()["response"]

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {
            "questions": [],
            "raw_output": raw,
            "error": "Model did not return valid JSON"
        }
