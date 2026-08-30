const ragFiles = [
  { name: "Subject Description.pdf", type: "PDF", status: "Indexed", usage: "Used by AI" },
  { name: "Subject Outcomes.pdf", type: "PDF", status: "Indexed", usage: "Used by AI" },
  { name: "Sample Assessment.pdf", type: "PDF", status: "Indexed", usage: "Used by AI" },
  { name: "Marking Rubric.pdf", type: "PDF", status: "Indexed", usage: "Used by AI" },
  { name: "Assessment Guidelines.pdf", type: "PDF", status: "Indexed", usage: "Used by AI" }
];

let reviewQuestions = [];
let itemBank = [];

const sources = [
  "Subject Outcomes",
  "Marking Rubric",
  "Assessment Sample",
  "Assessment Guidelines",
  "Subject Description"
];

const generateForm = document.getElementById("generateForm");
const totalQuestionCount = document.getElementById("totalQuestionCount");
const reviewList = document.getElementById("reviewList");
const itemBankTableBody = document.getElementById("itemBankTableBody");
const ragFileList = document.getElementById("ragFileList");
const exportPreviewText = document.getElementById("exportPreviewText");

const countInputs = [
  document.getElementById("mcqCount"),
  document.getElementById("tfCount"),
  document.getElementById("shortCount"),
  document.getElementById("essayCount"),
  document.getElementById("numCount"),
  document.getElementById("matchingCount")
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function friendlyFetchError(err) {
  // A raw TypeError here means the request never got a response at all —
  // the server didn't respond, the connection dropped, or it timed out.
  // This is distinct from an application error (which comes back as JSON).
  if (err instanceof TypeError) {
    return "Couldn't reach the server. Question generation can take a while on first run (the AI model is warming up) — wait a moment and try again. If it keeps happening, check that app.py is still running.";
  }
  return err.message;
}

function on(id, event, handler) {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener(event, handler);
  } else {
    console.warn(`[AEFAS] Element #${id} not found — skipping listener. If you just updated the HTML/JS files, hard-refresh (Ctrl+Shift+R) to clear the cache.`);
  }
}

function updateTotalCount() {
  const total = countInputs.reduce((sum, input) => sum + (parseInt(input.value) || 0), 0);
  totalQuestionCount.textContent = total;
  return total;
}

countInputs.forEach(input => {
  input.addEventListener("input", updateTotalCount);
});

function renderRagFiles() {
  ragFileList.innerHTML = "";
  ragFiles.forEach(file => {
    const fileCard = document.createElement("div");
    fileCard.className = "file-card";
    fileCard.innerHTML = `
      <h5>${file.name}</h5>
      <div class="file-meta">
        <span class="meta-tag">${file.type}</span>
        <span class="meta-tag">${file.status}</span>
        <span class="meta-tag">${file.usage}</span>
      </div>
    `;
    ragFileList.appendChild(fileCard);
  });

  document.getElementById("statRagCount").textContent = ragFiles.length;
  document.getElementById("ragContextStatus").textContent = `${ragFiles.length} files active`;
}

// ─── Real File Upload ────────────────────────────────────────────────────────

on("realFileInput", "change", async function () {
  const files = this.files;
  if (!files.length) return;

  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  try {
    const response = await fetch("/upload", {
      method: "POST",
      body: formData
    });
    const result = await response.json();

    // Show uploaded files in the list
    const list = document.getElementById("uploadedFilesList");
    list.innerHTML = "";

    result.files.forEach(f => {
      const name = f.split("/").pop();

      // Add to ragFiles if not already there
      const alreadyExists = ragFiles.some(r => r.name === name);
      if (!alreadyExists) {
        ragFiles.push({
          name: name,
          type: "PDF",
          status: "Uploaded",
          usage: "Pending Index"
        });
      }

      const span = document.createElement("span");
      span.textContent = "✅ " + name;
      span.style.cssText = "display:block; margin:4px 0; font-size:13px;";
      list.appendChild(span);
    });

    renderRagFiles();
    document.getElementById("buildIndexBtn").style.display = "inline-block";

  } catch (err) {
    alert("Upload failed: " + err.message);
  }
});

// ─── Build FAISS Index ───────────────────────────────────────────────────────

on("buildIndexBtn", "click", async function () {
  this.textContent = "⏳ Building index...";
  this.disabled = true;

  try {
    const response = await fetch("/index", {
      method: "POST"
    });
    const result = await response.json();

    alert(`✅ ${result.message} — ${result.chunks_indexed} chunks indexed!`);
    this.textContent = "✅ Index Built";
    this.disabled = false;

    // Update all ragFiles status in place (no reassignment)
    ragFiles.forEach(f => {
      f.status = "Indexed";
      f.usage = "Used by AI";
    });
    renderRagFiles();

  } catch (err) {
    alert("Index build failed: " + err.message);
    this.textContent = "⚡ Build RAG Index";
    this.disabled = false;
  }
});

// ─── Question Rendering ──────────────────────────────────────────────────────

function renderReviewQuestions() {
  if (reviewQuestions.length === 0) {
    reviewList.innerHTML = `
      <div class="empty-state">
        <h4>No generated questions yet</h4>
        <p>Use the Generate Questions section to create prototype assessment items.</p>
      </div>
    `;
    return;
  }

  reviewList.innerHTML = "";

  reviewQuestions.forEach(question => {
    const card = document.createElement("div");
    card.className = "question-card";
    card.innerHTML = `
      <div class="question-top">
        <div>
          <div class="question-id">${question.id}</div>
          <div class="question-meta">
            <span class="tag">${question.type}</span>
            <span class="tag">${question.category}</span>
            <span class="tag">${question.difficulty}</span>
            <span class="tag">${question.topic}</span>
            <span class="tag rag">Grounded by RAG</span>
          </div>
        </div>
      </div>

      <textarea data-id="${question.id}" class="question-textarea">${question.text || ""}</textarea>

      ${question.options ? `
        <div class="question-options" style="margin: 8px 0; padding-left: 12px;">
          ${question.options.map((opt, i) => `<div>${String.fromCharCode(65+i)}. ${opt}</div>`).join("")}
        </div>
      ` : ""}

      ${question.answer ? `
        <div style="margin: 8px 0; font-size: 0.98rem; line-height: 1.5;">
          <strong>Answer:</strong> ${question.answer}
        </div>
      ` : ""}

      ${question.explanation ? `
        <div style="margin: 8px 0; font-size: 0.95rem; line-height: 1.5; color: #475569;">
          <strong>Explanation:</strong> ${question.explanation}
        </div>
      ` : ""}

      <div class="review-actions">
        <button class="primary-btn approve-btn" data-id="${question.id}">Approve</button>
        <button class="secondary-btn save-btn" data-id="${question.id}">Save Edit</button>
        <button class="ghost-btn discard-btn" data-id="${question.id}">Discard</button>

        <select class="difficulty-select" data-id="${question.id}">
          <option ${question.difficulty === "Easy" ? "selected" : ""}>Easy</option>
          <option ${question.difficulty === "Medium" ? "selected" : ""}>Medium</option>
          <option ${question.difficulty === "Hard" ? "selected" : ""}>Hard</option>
          <option ${question.difficulty === "AI Suggested" ? "selected" : ""}>AI Suggested</option>
        </select>
      </div>

      <div class="question-source">
        <strong>RAG Source:</strong> ${question.source || question.source_file || "PDF"}
      </div>
    `;

    reviewList.appendChild(card);
  });

  attachReviewEventHandlers();
}

function attachReviewEventHandlers() {
  document.querySelectorAll(".approve-btn").forEach(button => {
    button.addEventListener("click", function () {
      approveQuestion(this.dataset.id);
    });
  });

  document.querySelectorAll(".save-btn").forEach(button => {
    button.addEventListener("click", async function () {
      const id = this.dataset.id;
      const textarea = document.querySelector(`textarea[data-id="${id}"]`);
      const difficulty = document.querySelector(`select[data-id="${id}"]`).value;
      const question = reviewQuestions.find(q => q.id == id);
      if (!question) return;
      try {
        const res = await fetch(`/dashboard/questions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question_text: textarea.value, difficulty })
        });
        if (!res.ok) throw new Error(`Server responded ${res.status}`);
        question.text = textarea.value;
        question.difficulty = difficulty;
        alert(`Question ${id} saved.`);
      } catch (err) {
        alert(`Failed to save question ${id}: ${err.message}`);
      }
    });
  });

  document.querySelectorAll(".discard-btn").forEach(button => {
    button.addEventListener("click", async function () {
      const id = this.dataset.id;
      try {
        const res = await fetch(`/dashboard/questions/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`Server responded ${res.status}`);
        reviewQuestions = reviewQuestions.filter(q => q.id != id);
        updateStats();
        renderReviewQuestions();
      } catch (err) {
        alert(`Failed to discard question ${id}: ${err.message}`);
      }
    });
  });

  document.querySelectorAll(".difficulty-select").forEach(select => {
    select.addEventListener("change", function () {
      const question = reviewQuestions.find(q => q.id == this.dataset.id);
      if (question) question.difficulty = this.value;
    });
  });
}

async function approveQuestion(id) {
  const question = reviewQuestions.find(q => q.id == id);
  if (!question) return;

  try {
    const res = await fetch(`/dashboard/questions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" })
    });
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
  } catch (err) {
    alert(`Failed to approve question ${id}: ${err.message}`);
    return;
  }

  reviewQuestions = reviewQuestions.filter(q => q.id != id);
  renderReviewQuestions();
  updateStats();
  await loadItemBank();
}

// ─── Generate Questions (Real API Call) ─────────────────────────────────────

generateForm.addEventListener("submit", async function (e) {
  e.preventDefault();

  const discipline = document.getElementById("discipline").value;
  const category = document.getElementById("category").value;
  const topic = document.getElementById("topic").value.trim() || "General Academic Topic";
  const difficulty = document.getElementById("difficulty").value;

  const total = updateTotalCount();
  if (total === 0) {
    alert("Please enter at least one question to generate.");
    return;
  }
  if (total > 100) {
    alert("Maximum session limit is 100 questions.");
    return;
  }

  // Show loading state
  const submitBtn = generateForm.querySelector("[type=submit]");
  const originalText = submitBtn ? submitBtn.textContent : "";
  if (submitBtn) {
    submitBtn.textContent = "⏳ Generating...";
    submitBtn.disabled = true;
  }

  reviewList.innerHTML = `
    <div class="empty-state">
      <h4>⏳ Generating questions...</h4>
      <p>TinyLlama is reading your PDFs and generating questions. This may take 30–60 seconds.</p>
    </div>
  `;

  try {
    const response = await fetch("/generate-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        discipline: discipline,
        questionCategory: category,
        topic: topic,
        difficulty: difficulty,
        multipleChoice: parseInt(document.getElementById("mcqCount").value) || 0,
        trueFalse: parseInt(document.getElementById("tfCount").value) || 0,
        shortAnswer: parseInt(document.getElementById("shortCount").value) || 0,
        essay: parseInt(document.getElementById("essayCount").value) || 0,
        numerical: parseInt(document.getElementById("numCount").value) || 0,
        matching: parseInt(document.getElementById("matchingCount").value) || 0
      })
    });

    const result = await response.json();

    if (result.error) {
      alert("Generation error: " + result.error);
      reviewList.innerHTML = `<div class="empty-state"><h4>Generation failed</h4><p>${result.error}</p></div>`;
      return;
    }

    // Map API response to review questions format — use the REAL database
    // ids returned in saved_ids so Approve/Discard/Save can hit the backend.
    const savedIds = result.saved_ids || [];
    const questions = (result.questions || []).map((q, i) => ({
      id: savedIds[i], // real Question.id from the database
      type: formatType(q.type),
      category: category,
      difficulty: q.difficulty || difficulty,
      topic: q.topic || topic,
      discipline: discipline,
      source: q.source_file || sources[i % sources.length],
      text: q.question || "",
      options: q.options || null,
      answer: q.answer || "",
      explanation: q.explanation || ""
    }));

    reviewQuestions = questions;
    renderReviewQuestions();
    updateStats();
    document.getElementById("review").scrollIntoView({ behavior: "smooth" });

  } catch (err) {
    alert("Failed to generate questions: " + err.message);
    reviewList.innerHTML = `<div class="empty-state"><h4>Request failed</h4><p>${err.message}</p></div>`;
  } finally {
    if (submitBtn) {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  }
});

function formatType(type) {
  const map = {
    "multiple_choice": "Multiple Choice",
    "true_false": "True/False",
    "short_answer": "Short Answer",
    "essay": "Essay",
    "numerical": "Numerical",
    "matching": "Matching"
  };
  return map[type] || type || "Multiple Choice";
}

// ─── Item Bank ───────────────────────────────────────────────────────────────

function renderItemBank(data) {
  itemBankTableBody.innerHTML = "";
  if (data.length === 0) {
    itemBankTableBody.innerHTML = `<tr><td colspan="8">No approved questions yet — approve items in the Review section.</td></tr>`;
    return;
  }
  data.forEach(item => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${item.id}</td>
      <td>${item.topic}</td>
      <td>${item.type}</td>
      <td>${item.category}</td>
      <td>${item.difficulty}</td>
      <td>${item.discipline}</td>
      <td>${item.source}</td>
      <td><span class="tag">${item.status}</span></td>
    `;
    itemBankTableBody.appendChild(row);
  });
}

async function loadItemBank() {
  try {
    const res = await fetch("/dashboard/questions?status=approved");
    const items = await res.json();
    itemBank = items.map(i => ({
      id: i.id,
      topic: i.topic || "—",
      type: formatType(i.question_type),
      category: i.category || "—",
      difficulty: i.difficulty || "—",
      discipline: i.discipline || "—",
      source: "PDF",
      status: "Approved"
    }));
    renderItemBank(itemBank);
    updateStats();
  } catch (err) {
    console.error("Failed to load item bank:", err);
  }
}

function updateStats() {
  document.getElementById("statGeneratedCount").textContent = reviewQuestions.length;
  document.getElementById("statApprovedCount").textContent = itemBank.length;
  document.getElementById("statBankCount").textContent = itemBank.length;
}

// ─── Form Controls ───────────────────────────────────────────────────────────

on("resetFormBtn", "click", () => {
  generateForm.reset();
  document.getElementById("mcqCount").value = 2;
  document.getElementById("tfCount").value = 1;
  document.getElementById("shortCount").value = 1;
  document.getElementById("essayCount").value = 1;
  document.getElementById("numCount").value = 0;
  document.getElementById("matchingCount").value = 0;
  updateTotalCount();
});

function loadSampleDemo() {
  document.getElementById("discipline").value = "Information Technology";
  document.getElementById("category").value = "Application";
  document.getElementById("topic").value = "Database Normalization";
  document.getElementById("difficulty").value = "AI Suggested";
  document.getElementById("mcqCount").value = 3;
  document.getElementById("tfCount").value = 2;
  document.getElementById("shortCount").value = 2;
  document.getElementById("essayCount").value = 1;
  document.getElementById("numCount").value = 0;
  document.getElementById("matchingCount").value = 1;
  updateTotalCount();
}

on("sampleDemoBtn", "click", loadSampleDemo);
on("demoFillBtn", "click", loadSampleDemo);

on("scrollGenerateBtn", "click", () => {
  document.getElementById("generate").scrollIntoView({ behavior: "smooth" });
});

// ─── Bank Filters ────────────────────────────────────────────────────────────

function filterBank() {
  const topic = document.getElementById("bankTopicFilter").value.toLowerCase().trim();
  const difficulty = document.getElementById("bankDifficultyFilter").value;
  const category = document.getElementById("bankCategoryFilter").value;
  const type = document.getElementById("bankTypeFilter").value;
  const discipline = document.getElementById("bankDisciplineFilter").value;

  const filtered = itemBank.filter(item => {
    const topicMatch = !topic || item.topic.toLowerCase().includes(topic);
    const difficultyMatch = !difficulty || item.difficulty === difficulty;
    const categoryMatch = !category || item.category === category;
    const typeMatch = !type || item.type === type;
    const disciplineMatch = !discipline || item.discipline === discipline;
    return topicMatch && difficultyMatch && categoryMatch && typeMatch && disciplineMatch;
  });

  renderItemBank(filtered);
}

on("searchBankBtn", "click", filterBank);

on("resetBankBtn", "click", () => {
  document.getElementById("bankTopicFilter").value = "";
  document.getElementById("bankDifficultyFilter").value = "";
  document.getElementById("bankCategoryFilter").value = "";
  document.getElementById("bankTypeFilter").value = "";
  document.getElementById("bankDisciplineFilter").value = "";
  renderItemBank(itemBank);
});

// ─── Export ──────────────────────────────────────────────────────────────────

on("selectExportBtn", "click", () => {
  document.getElementById("export").scrollIntoView({ behavior: "smooth" });
});

let lastPracticeQuestion = null;

on("generatePracticeBtn", "click", async () => {
  const topic = document.getElementById("studyTopic").value.trim() || "Academic Writing";
  const difficulty = document.getElementById("studyDifficulty").value;
  const mode = document.getElementById("practiceMode").value;
  const resultsEl = document.getElementById("studentResults");

  resultsEl.innerHTML = `<div class="result-card"><h4>⏳ Generating…</h4><p>Retrieving context and generating a practice question.</p></div>`;

  try {
    const res = await fetch("/practice/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, difficulty, mode })
    });
    const result = await res.json();
    if (result.error) {
      resultsEl.innerHTML = `<div class="result-card"><h4>Couldn't generate a question</h4><p>${result.error}</p></div>`;
      return;
    }

    lastPracticeQuestion = { question: result.question, topic };

    const optionsHtml = result.options
      ? `<p>${result.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join("<br>")}</p>`
      : "";

    resultsEl.innerHTML = `
      <div class="result-card">
        <h4>Practice Question</h4>
        <p>${result.question}</p>
        ${optionsHtml}
      </div>
      <div class="result-card">
        <h4>Answer</h4>
        <p>${result.answer || "—"}</p>
      </div>
      <div class="result-card">
        <h4>Explanation</h4>
        <p>${result.explanation || "Click \"Get AI Explanation\" below for a deeper walkthrough."}</p>
      </div>
      <div class="result-card">
        <h4>Source</h4>
        <p>Grounded in <strong>${result.source}</strong> from your uploaded materials.</p>
      </div>
    `;
  } catch (err) {
    console.error("Practice generate failed:", err);
    resultsEl.innerHTML = `<div class="result-card"><h4>Request failed</h4><p>${friendlyFetchError(err)}</p></div>`;
  }
});

on("getExplanationBtn", "click", async () => {
  const resultsEl = document.getElementById("studentResults");
  if (!lastPracticeQuestion) {
    alert("Generate a practice question first.");
    return;
  }
  try {
    const res = await fetch("/practice/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lastPracticeQuestion)
    });
    const result = await res.json();
    if (result.error) {
      alert(result.error);
      return;
    }
    resultsEl.insertAdjacentHTML("beforeend", `
      <div class="result-card">
        <h4>AI Explanation</h4>
        <p>${result.explanation}</p>
      </div>
    `);
  } catch (err) {
    alert("Failed to get explanation: " + friendlyFetchError(err));
  }
});

async function fetchApprovedIds() {
  const res = await fetch("/dashboard/questions?status=approved");
  const items = await res.json();
  return items.map(i => i.id);
}

async function fetchGiftText() {
  const ids = await fetchApprovedIds();
  if (!ids.length) return { ids, text: null };
  const res = await fetch(`/dashboard/export/gift?ids=${ids.join(",")}`);
  if (!res.ok) {
    let detail = `Server responded ${res.status}`;
    try {
      const errBody = await res.json();
      if (errBody.error) detail = errBody.error;
    } catch (_) { /* not JSON, keep generic message */ }
    throw new Error(detail);
  }
  return { ids, text: await res.text() };
}

function downloadText(content, filename) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

on("giftExportBtn", "click", async () => {
  try {
    const { ids, text } = await fetchGiftText();
    if (!text) {
      exportPreviewText.textContent = "No approved questions yet — approve items in Review first.";
      return;
    }
    exportPreviewText.textContent = text;
    document.getElementById("statExportStatus").textContent = `GIFT exported (${ids.length})`;
    downloadText(text, "aefas_export.gift");
  } catch (err) {
    exportPreviewText.textContent = "Export failed: " + err.message;
  }
});

on("xmlExportBtn", "click", () => {
  exportPreviewText.textContent =
    "Moodle XML export isn't implemented on the backend yet — only GIFT is currently supported.\n" +
    "GIFT is fully accepted by Moodle's Question Bank importer, so use \"Export as GIFT\" instead.";
});

on("previewExportBtn", "click", async () => {
  exportPreviewText.textContent = "Loading preview…";
  try {
    const { text } = await fetchGiftText();
    exportPreviewText.textContent = text || "No approved questions yet — approve items in Review first.";
  } catch (err) {
    exportPreviewText.textContent = "Preview failed: " + err.message;
  }
});

on("downloadPrototypeBtn", "click", async () => {
  try {
    const { text } = await fetchGiftText();
    if (!text) {
      alert("No approved questions yet — approve items in Review first.");
      return;
    }
    downloadText(text, "aefas_export.gift");
  } catch (err) {
    alert("Download failed: " + err.message);
  }
});

// ─── Moodle Connection & Push (Real API) ────────────────────────────────────

const moodleStatusText = document.getElementById("moodleStatusText");
const moodleCourseSelect = document.getElementById("moodleCourseSelect");

async function loadMoodleSettings() {
  try {
    const res = await fetch("/dashboard/moodle/settings");
    const data = await res.json();
    document.getElementById("moodleUrlInput").value = data.moodle_url || "";
    if (data.moodle_token) {
      document.getElementById("moodleTokenInput").placeholder = "Token saved (hidden)";
    }
    moodleStatusText.textContent = data.moodle_url
      ? `Configured for ${data.moodle_url}`
      : "Not configured yet.";
  } catch (err) {
    console.error("Failed to load Moodle settings:", err);
  }
}

on("saveMoodleBtn", "click", async () => {
  const moodle_url = document.getElementById("moodleUrlInput").value.trim();
  const moodle_token = document.getElementById("moodleTokenInput").value.trim();
  try {
    const res = await fetch("/dashboard/moodle/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moodle_url, moodle_token })
    });
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    moodleStatusText.textContent = `Saved. Configured for ${moodle_url}`;
  } catch (err) {
    moodleStatusText.textContent = "Failed to save Moodle settings: " + err.message;
  }
});

on("testMoodleBtn", "click", async () => {
  moodleStatusText.textContent = "Testing connection…";
  try {
    const res = await fetch("/dashboard/moodle/test", { method: "POST" });
    const result = await res.json();
    moodleStatusText.textContent = result.ok
      ? `Connected to "${result.site_name}" (Moodle ${result.moodle_version}) as ${result.username}`
      : "Connection failed: " + result.error;
  } catch (err) {
    moodleStatusText.textContent = "Connection failed: " + err.message;
  }
});

on("loadCoursesBtn", "click", async () => {
  moodleCourseSelect.innerHTML = `<option value="">Loading…</option>`;
  try {
    const res = await fetch("/dashboard/moodle/courses");
    const result = await res.json();
    if (!result.ok) {
      moodleCourseSelect.innerHTML = `<option value="">Failed to load</option>`;
      moodleStatusText.textContent = "Failed to load courses: " + result.error;
      return;
    }
    moodleCourseSelect.innerHTML = result.courses
      .map(c => `<option value="${c.id}">${c.fullname} (${c.shortname})</option>`)
      .join("");
  } catch (err) {
    moodleCourseSelect.innerHTML = `<option value="">Failed to load</option>`;
    moodleStatusText.textContent = "Failed to load courses: " + err.message;
  }
});

on("pushMoodleBtn", "click", async () => {
  const course_id = moodleCourseSelect.value;
  if (!course_id) {
    alert("Load and select a Moodle course first.");
    return;
  }
  const ids = await fetchApprovedIds();
  if (!ids.length) {
    alert("No approved questions yet — approve items in Review first.");
    return;
  }
  moodleStatusText.textContent = "Pushing to Moodle…";
  try {
    const res = await fetch("/dashboard/moodle/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question_ids: ids, course_id })
    });
    const result = await res.json();
    moodleStatusText.textContent = result.ok ? `✅ ${result.message}` : "Push failed: " + result.error;
    if (result.ok) await loadItemBank();
  } catch (err) {
    moodleStatusText.textContent = "Push failed: " + err.message;
  }
});

// ─── Help Modal ──────────────────────────────────────────────────────────────

const helpModal = document.getElementById("helpModal");
on("openHelpModal", "click", () => {
  helpModal.classList.remove("hidden");
});
on("closeHelpModal", "click", () => {
  helpModal.classList.add("hidden");
});
helpModal.addEventListener("click", (e) => {
  if (e.target === helpModal) helpModal.classList.add("hidden");
});

// ─── Nav ─────────────────────────────────────────────────────────────────────

document.querySelectorAll(".nav-link").forEach(link => {
  link.addEventListener("click", function () {
    document.querySelectorAll(".nav-link").forEach(nav => nav.classList.remove("active"));
    this.classList.add("active");
  });
});

// ─── Init ────────────────────────────────────────────────────────────────────

renderRagFiles();
renderReviewQuestions();
loadItemBank();
loadMoodleSettings();
updateTotalCount();