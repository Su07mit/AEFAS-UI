const ragFiles = [
  { name: "Subject Description.pdf", type: "PDF", status: "Indexed", usage: "Used by AI" },
  { name: "Subject Outcomes.pdf", type: "PDF", status: "Indexed", usage: "Used by AI" },
  { name: "Sample Assessment.pdf", type: "PDF", status: "Indexed", usage: "Used by AI" },
  { name: "Marking Rubric.pdf", type: "PDF", status: "Indexed", usage: "Used by AI" },
  { name: "Assessment Guidelines.pdf", type: "PDF", status: "Indexed", usage: "Used by AI" }
];

let reviewQuestions = [];
let itemBank = [
  {
    id: "Q1001",
    topic: "Database Design",
    type: "Multiple Choice",
    category: "Theory",
    difficulty: "Easy",
    discipline: "Information Technology",
    source: "Subject Outcomes",
    status: "Approved"
  },
  {
    id: "Q1002",
    topic: "Cybersecurity Policy",
    type: "Essay",
    category: "Application",
    difficulty: "Hard",
    discipline: "Information Systems",
    source: "Assessment Guidelines",
    status: "Approved"
  },
  {
    id: "Q1003",
    topic: "Financial Ratios",
    type: "Short Answer",
    category: "Application",
    difficulty: "Medium",
    discipline: "Accounting",
    source: "Marking Rubric",
    status: "Approved"
  },
  {
    id: "Q1004",
    topic: "Consumer Behaviour",
    type: "True/False",
    category: "Theory",
    difficulty: "Easy",
    discipline: "Business",
    source: "Subject Description",
    status: "Approved"
  },
  {
    id: "Q1005",
    topic: "Leadership Styles",
    type: "Matching",
    category: "Synthesis",
    difficulty: "Medium",
    discipline: "Management",
    source: "Sample Assessment",
    status: "Approved"
  },
  {
    id: "Q1006",
    topic: "Second Language Acquisition",
    type: "Essay",
    category: "Theory",
    difficulty: "Hard",
    discipline: "TESOL",
    source: "Subject Outcomes",
    status: "Approved"
  },
  {
    id: "Q1007",
    topic: "Cloud Architecture",
    type: "Multiple Choice",
    category: "Application",
    difficulty: "Medium",
    discipline: "Information Technology",
    source: "Assessment Guidelines",
    status: "Approved"
  },
  {
    id: "Q1008",
    topic: "ERP Systems",
    type: "Short Answer",
    category: "Synthesis",
    difficulty: "Medium",
    discipline: "Information Systems",
    source: "Sample Assessment",
    status: "Approved"
  },
  {
    id: "Q1009",
    topic: "Budget Forecasting",
    type: "Numerical",
    category: "Application",
    difficulty: "Hard",
    discipline: "Accounting",
    source: "Marking Rubric",
    status: "Approved"
  },
  {
    id: "Q1010",
    topic: "Market Segmentation",
    type: "Multiple Choice",
    category: "Theory",
    difficulty: "Easy",
    discipline: "Business",
    source: "Subject Description",
    status: "Approved"
  },
  {
    id: "Q1011",
    topic: "Project Planning",
    type: "Essay",
    category: "Synthesis",
    difficulty: "Medium",
    discipline: "Management",
    source: "Assessment Guidelines",
    status: "Approved"
  },
  {
    id: "Q1012",
    topic: "Pronunciation Strategies",
    type: "True/False",
    category: "Application",
    difficulty: "Easy",
    discipline: "TESOL",
    source: "Subject Outcomes",
    status: "Approved"
  }
];

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

document.getElementById("realFileInput").addEventListener("change", async function () {
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

document.getElementById("buildIndexBtn").addEventListener("click", async function () {
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
        <div style="margin: 6px 0; font-size: 13px;">
          <strong>Answer:</strong> ${question.answer}
        </div>
      ` : ""}

      ${question.explanation ? `
        <div style="margin: 6px 0; font-size: 13px; color: #555;">
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
    button.addEventListener("click", function () {
      const id = this.dataset.id;
      const textarea = document.querySelector(`textarea[data-id="${id}"]`);
      const difficulty = document.querySelector(`select[data-id="${id}"]`).value;
      const question = reviewQuestions.find(q => q.id === id);
      if (question) {
        question.text = textarea.value;
        question.difficulty = difficulty;
        alert(`Question ${id} updated successfully.`);
      }
    });
  });

  document.querySelectorAll(".discard-btn").forEach(button => {
    button.addEventListener("click", function () {
      const id = this.dataset.id;
      reviewQuestions = reviewQuestions.filter(q => q.id !== id);
      updateStats();
      renderReviewQuestions();
    });
  });

  document.querySelectorAll(".difficulty-select").forEach(select => {
    select.addEventListener("change", function () {
      const question = reviewQuestions.find(q => q.id === this.dataset.id);
      if (question) question.difficulty = this.value;
    });
  });
}

function approveQuestion(id) {
  const question = reviewQuestions.find(q => q.id === id);
  if (!question) return;

  itemBank.unshift({
    id: question.id,
    topic: question.topic,
    type: question.type,
    category: question.category,
    difficulty: question.difficulty,
    discipline: question.discipline,
    source: question.source || question.source_file || "PDF",
    status: "Approved"
  });

  reviewQuestions = reviewQuestions.filter(q => q.id !== id);
  renderReviewQuestions();
  renderItemBank(itemBank);
  updateStats();
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

    // Map API response to review questions format
    const questions = (result.questions || []).map((q, i) => ({
      id: `G${Date.now().toString().slice(-5)}${i + 1}`,
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

function updateStats() {
  document.getElementById("statGeneratedCount").textContent = reviewQuestions.length;
  document.getElementById("statApprovedCount").textContent = itemBank.length;
  document.getElementById("statBankCount").textContent = itemBank.length;
}

// ─── Form Controls ───────────────────────────────────────────────────────────

document.getElementById("resetFormBtn").addEventListener("click", () => {
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

document.getElementById("sampleDemoBtn").addEventListener("click", loadSampleDemo);
document.getElementById("demoFillBtn").addEventListener("click", loadSampleDemo);

document.getElementById("scrollGenerateBtn").addEventListener("click", () => {
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

document.getElementById("searchBankBtn").addEventListener("click", filterBank);

document.getElementById("resetBankBtn").addEventListener("click", () => {
  document.getElementById("bankTopicFilter").value = "";
  document.getElementById("bankDifficultyFilter").value = "";
  document.getElementById("bankCategoryFilter").value = "";
  document.getElementById("bankTypeFilter").value = "";
  document.getElementById("bankDisciplineFilter").value = "";
  renderItemBank(itemBank);
});

// ─── Export ──────────────────────────────────────────────────────────────────

document.getElementById("selectExportBtn").addEventListener("click", () => {
  document.getElementById("export").scrollIntoView({ behavior: "smooth" });
});

document.getElementById("generatePracticeBtn").addEventListener("click", () => {
  const topic = document.getElementById("studyTopic").value.trim() || "Academic Writing";
  const difficulty = document.getElementById("studyDifficulty").value;
  const mode = document.getElementById("practiceMode").value;

  document.getElementById("studentResults").innerHTML = `
    <div class="result-card">
      <h4>Practice Question</h4>
      <p>Generate a ${difficulty.toLowerCase()}-level response about <strong>${topic}</strong> in ${mode} mode.</p>
    </div>
    <div class="result-card">
      <h4>Explanation</h4>
      <p>This prototype explanation shows how an AI tutor could provide guided clarification for the selected topic.</p>
    </div>
    <div class="result-card">
      <h4>Confidence Hint</h4>
      <p>Your current practice confidence is estimated as developing. Review core definitions and examples.</p>
    </div>
    <div class="result-card">
      <h4>Recommended Revision</h4>
      <p>Revise the underlying principles, terminology, and lecturer-provided examples related to ${topic}.</p>
    </div>
  `;
});

document.getElementById("getExplanationBtn").addEventListener("click", () => {
  alert("Prototype mode: AI explanation is visually demonstrated only.");
});

function buildGiftPreview() {
  const sample = itemBank.slice(0, 3).map(item => {
    return `::${item.id}::${item.topic} (${item.type}) { =Prototype Answer }`;
  }).join("\n\n");
  exportPreviewText.textContent = sample || "No approved questions available for export.";
}

function buildXmlPreview() {
  const sample = itemBank.slice(0, 2).map(item => {
    return `<question type="${item.type}">
  <name><text>${item.id}</text></name>
  <questiontext><text>${item.topic} - Prototype export item</text></questiontext>
</question>`;
  }).join("\n\n");
  exportPreviewText.textContent = sample || "No approved questions available for export.";
}

document.getElementById("giftExportBtn").addEventListener("click", () => {
  buildGiftPreview();
  document.getElementById("statExportStatus").textContent = "GIFT Prepared";
});

document.getElementById("xmlExportBtn").addEventListener("click", () => {
  buildXmlPreview();
  document.getElementById("statExportStatus").textContent = "XML Prepared";
});

document.getElementById("previewExportBtn").addEventListener("click", () => {
  buildGiftPreview();
});

document.getElementById("downloadPrototypeBtn").addEventListener("click", () => {
  const content = exportPreviewText.textContent || "Prototype Export File";
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "aefas-prototype-export.txt";
  a.click();
  URL.revokeObjectURL(url);
});

// ─── Help Modal ──────────────────────────────────────────────────────────────

const helpModal = document.getElementById("helpModal");
document.getElementById("openHelpModal").addEventListener("click", () => {
  helpModal.classList.remove("hidden");
});
document.getElementById("closeHelpModal").addEventListener("click", () => {
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
renderItemBank(itemBank);
updateStats();
updateTotalCount();