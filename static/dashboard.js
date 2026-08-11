const state = { status: "pending" };

async function loadQuestions(status) {
  state.status = status;
  const res = await fetch(`/dashboard/questions?status=${status}`);
  const items = await res.json();
  const list = document.getElementById("questionList");
  list.innerHTML = "";
  items.forEach(q => {
    const row = document.createElement("div");
    row.className = "q-row";
    row.innerHTML = `
      <input type="checkbox" class="q-check" data-id="${q.id}">
      <div class="q-body">
        <strong>[${q.question_type}]</strong> ${q.question_text}
        <div class="q-meta">${q.discipline} · ${q.topic} · ${q.difficulty} · ${q.status}</div>
      </div>
      <button class="approve" data-id="${q.id}">Approve</button>
      <button class="discard" data-id="${q.id}">Discard</button>`;
    list.appendChild(row);
  });
}

document.querySelectorAll(".filters button").forEach(btn =>
  btn.addEventListener("click", () => loadQuestions(btn.dataset.status)));

document.getElementById("questionList").addEventListener("click", async (e) => {
  const id = e.target.dataset.id;
  if (!id) return;
  const status = e.target.classList.contains("approve") ? "approved"
               : e.target.classList.contains("discard") ? "discarded" : null;
  if (!status) return;
  await fetch(`/dashboard/questions/${id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });
  loadQuestions(state.status);
});

document.getElementById("exportGift").addEventListener("click", () => {
  const ids = [...document.querySelectorAll(".q-check:checked")].map(c => c.dataset.id);
  window.location.href = `/dashboard/export/gift${ids.length ? `?ids=${ids.join(",")}` : ""}`;
});

document.getElementById("saveMoodle").addEventListener("click", async () => {
  const moodle_url = document.getElementById("moodleUrl").value;
  const moodle_token = document.getElementById("moodleToken").value;
  const res = await fetch("/dashboard/moodle/settings", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ moodle_url, moodle_token })
  });
  document.getElementById("moodleStatus").textContent = res.ok ? "Saved." : "Save failed.";
});

document.getElementById("testMoodle").addEventListener("click", async () => {
  const res = await fetch("/dashboard/moodle/test", { method: "POST" });
  const data = await res.json();
  document.getElementById("moodleStatus").textContent = data.ok
    ? `Connected to ${data.site_name} as ${data.username} (Moodle ${data.moodle_version})`
    : `Error: ${data.error}`;
});

document.getElementById("loadCourses").addEventListener("click", async () => {
  const res = await fetch("/dashboard/moodle/courses");
  const data = await res.json();
  const select = document.getElementById("courseSelect");
  select.innerHTML = "";
  if (data.ok) data.courses.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = `${c.shortname} - ${c.fullname}`;
    select.appendChild(opt);
  });
});

document.getElementById("pushMoodle").addEventListener("click", async () => {
  const ids = [...document.querySelectorAll(".q-check:checked")].map(c => Number(c.dataset.id));
  const course_id = Number(document.getElementById("courseSelect").value);
  if (!ids.length || !course_id) return alert("Select questions and a course first.");
  const res = await fetch("/dashboard/moodle/push", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question_ids: ids, course_id })
  });
  const data = await res.json();
  document.getElementById("moodleStatus").textContent = data.ok ? data.message : `Error: ${data.error}`;
});

loadQuestions("pending");