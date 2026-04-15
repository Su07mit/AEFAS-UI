async function generateQuestions() {
  const payload = {
    discipline: document.querySelector("#discipline").value,
    questionCategory: document.querySelector("#questionCategory").value,
    topic: document.querySelector("#topic").value,
    difficulty: document.querySelector("#difficulty").value,
    multipleChoice: document.querySelector("#multipleChoice").value,
    trueFalse: document.querySelector("#trueFalse").value,
    shortAnswer: document.querySelector("#shortAnswer").value,
    essay: document.querySelector("#essay").value,
    numerical: document.querySelector("#numerical").value,
    matching: document.querySelector("#matching").value
  };

  const response = await fetch("/generate-questions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  console.log(data);
  renderQuestions(data.questions);
}

function renderQuestions(questions) {
  const output = document.getElementById("results");
  output.innerHTML = "";

  questions.forEach((q, index) => {
    const div = document.createElement("div");
    div.className = "question-card";

    let html = `<h3>Q${index + 1}. ${q.question}</h3>`;
    html += `<p><strong>Type:</strong> ${q.type}</p>`;
    html += `<p><strong>Difficulty:</strong> ${q.difficulty}</p>`;

    if (q.options && q.options.length) {
      html += "<ul>";
      q.options.forEach(opt => {
        html += `<li>${opt}</li>`;
      });
      html += "</ul>";
    }

    html += `<p><strong>Answer:</strong> ${q.answer}</p>`;
    html += `<p><strong>Explanation:</strong> ${q.explanation}</p>`;
    html += `<p><strong>Source:</strong> ${q.source_file} (Page ${q.page})</p>`;

    div.innerHTML = html;
    output.appendChild(div);
  });
}
