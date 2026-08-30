// ─── Student Portal: upload → build index → generate → view history ────────

const sCountInputs = [
  document.getElementById("sMcqCount"),
  document.getElementById("sTfCount"),
  document.getElementById("sShortCount"),
];

function sUpdateTotal() {
  const total = sCountInputs.reduce((sum, el) => sum + (parseInt(el.value) || 0), 0);
  document.getElementById("sTotalCount").textContent = total;
  return total;
}
sCountInputs.forEach(el => el.addEventListener("input", sUpdateTotal));

// ─── Upload ──────────────────────────────────────────────────────────────
document.getElementById("sFileInput").addEventListener("change", async function () {
  const files = this.files;
  if (!files.length) return;

  const formData = new FormData();
  for (const file of files) formData.append("files", file);

  try {
    const res = await fetch("/upload", { method: "POST", body: formData });
    const result = await res.json();
    const list = document.getElementById("sUploadedList");
    list.innerHTML = "";
    (result.files || []).forEach(f => {
      const span = document.createElement("span");
      span.textContent = "✅ " + f.split("/").pop();
      list.appendChild(span);
    });
    document.getElementById("sBuildIndexBtn").style.display = "inline-block";
  } catch (err) {
    alert("Upload failed: " + err.message);
  }
});

// ─── Build index ─────────────────────────────────────────────────────────
document.getElementById("sBuildIndexBtn").addEventListener("click", async function () {
  this.textContent = "⏳ Building index...";
  this.disabled = true;
  try {
    const res = await fetch("/index", { method: "POST" });
    const result = await res.json();
    this.textContent = `✅ Indexed (${result.chunks_indexed} chunks)`;
  } catch (err) {
    alert("Index build failed: " + err.message);
    this.textContent = "⚡ Build Index";
  } finally {
    this.disabled = false;
  }
});

// ─── Generate questions ──────────────────────────────────────────────────
document.getElementById("sGenerateForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const discipline = document.getElementById("sDiscipline").value;
  const category = document.getElementById("sCategory").value;
  const topic = document.getElementById("sTopic").value.trim() || "General Academic Topic";
  const difficulty = document.getElementById("sDifficulty").value;
  const total = sUpdateTotal();

  if (total === 0) {
    alert("Please enter at least one question to generate.");
    return;
  }

  const resultsList = document.getElementById("sResultsList");
  const submitBtn = this.querySelector("[type=submit]");
  submitBtn.textContent = "⏳ Generating...";
  submitBtn.disabled = true;
  resultsList.innerHTML = '<div class="s-empty">⏳ Generating your questions — this can take up to a minute...</div>';

  try {
    const res = await fetch("/generate-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        discipline, questionCategory: category, topic, difficulty,
        multipleChoice: parseInt(document.getElementById("sMcqCount").value) || 0,
        trueFalse: parseInt(document.getElementById("sTfCount").value) || 0,
        shortAnswer: parseInt(document.getElementById("sShortCount").value) || 0,
        essay: 0, numerical: 0, matching: 0
      })
    });
    const result = await res.json();

    if (result.error) {
      resultsList.innerHTML = `<div class="s-empty">Generation failed: ${result.error}</div>`;
      return;
    }

    const questions = result.questions || [];
    if (!questions.length) {
      resultsList.innerHTML = '<div class="s-empty">No questions came back — try uploading and indexing a PDF first.</div>';
      return;
    }

    resultsList.innerHTML = "";
    questions.forEach(q => {
      const card = document.createElement("div");
      card.className = "s-question";
      let optsHtml = "";
      if (q.options && q.options.length) {
        optsHtml = "<ul class='s-opts'>" + q.options.map(o => `<li>${o}</li>`).join("") + "</ul>";
      }
      card.innerHTML = `
        <div class="s-qtag">${(q.type || "question").replace("_", " ")} · ${q.difficulty || difficulty}</div>
        <div class="s-qtext">${q.question || ""}</div>
        ${optsHtml}
        <button class="s-reveal-btn">Show Answer</button>
        <div class="s-answer">
          <strong>Answer:</strong> ${q.answer || "—"}
          ${q.explanation ? `<br><strong>Why:</strong> ${q.explanation}` : ""}
        </div>
      `;
      const revealBtn = card.querySelector(".s-reveal-btn");
      const answerBox = card.querySelector(".s-answer");
      revealBtn.addEventListener("click", () => {
        const showing = answerBox.style.display === "block";
        answerBox.style.display = showing ? "none" : "block";
        revealBtn.textContent = showing ? "Show Answer" : "Hide Answer";
      });
      resultsList.appendChild(card);
    });

    loadHistory();
    document.getElementById("results").scrollIntoView({ behavior: "smooth" });

  } catch (err) {
    resultsList.innerHTML = `<div class="s-empty">Request failed: ${err.message}</div>`;
  } finally {
    submitBtn.textContent = "Generate Questions";
    submitBtn.disabled = false;
  }
});

// ─── History ─────────────────────────────────────────────────────────────
async function loadHistory() {
  const box = document.getElementById("sHistoryList");
  try {
    const res = await fetch("/student/questions");
    const items = await res.json();
    if (!items.length) {
      box.innerHTML = '<div class="s-empty">You haven\'t generated any questions yet.</div>';
      return;
    }
    box.innerHTML = "";
    items.forEach(i => {
      const card = document.createElement("div");
      card.className = "s-question";
      card.innerHTML = `
        <div class="s-qtag">${(i.question_type || "").replace("_", " ")} · ${i.topic || ""} · ${i.created_at}</div>
        <div class="s-qtext">${i.question_text}</div>
      `;
      box.appendChild(card);
    });
  } catch (err) {
    box.innerHTML = `<div class="s-empty">Couldn't load history: ${err.message}</div>`;
  }
}

loadHistory();