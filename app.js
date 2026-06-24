const reviewIntervals = [1, 3, 7, 30];

let subjects = [];
let essaySources = [];
let mcqSources = [];
let flashcardSources = [];
let studyGoals = {};
let studyCycle = [];

let essays = [];
let mcqs = [];
let flashcards = [];
let reviews = [];

document.addEventListener("DOMContentLoaded", init);

async function init() {
  await loadData();

  setupNavigation();
  setupRatingDropdowns();
  populateSubjectDropdowns();
  populateSourceDropdowns();
  setupForms();

  renderAll();
}

async function loadData() {
  subjects = await loadJson("subjects.json", []);
  essaySources = await loadJson("essaySources.json", []);
  mcqSources = await loadJson("mcqSources.json", []);
  flashcardSources = await loadJson("flashcardSources.json", []);
  studyGoals = await loadJson("studyGoals.json", {});
  studyCycle = await loadJson("studyCycle.json", []);

  essays = loadLocalData("bcc_essays", await loadJson("essays.json", []));
  mcqs = loadLocalData("bcc_mcqs", await loadJson("mcqs.json", []));
  flashcards = loadLocalData("bcc_flashcards", await loadJson("flashcards.json", []));
  reviews = loadLocalData("bcc_reviews", await loadJson("reviews.json", []));
}

async function loadJson(path, fallback) {
  try {
    const response = await fetch(path);
    if (!response.ok) return fallback;
    return await response.json();
  } catch (error) {
    return fallback;
  }
}

function loadLocalData(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch (error) {
    return fallback;
  }
}

function saveData() {
  localStorage.setItem("bcc_essays", JSON.stringify(essays));
  localStorage.setItem("bcc_mcqs", JSON.stringify(mcqs));
  localStorage.setItem("bcc_flashcards", JSON.stringify(flashcards));
  localStorage.setItem("bcc_reviews", JSON.stringify(reviews));
}

function setupNavigation() {
  const buttons = document.querySelectorAll(".bcc-nav-button");
  const views = document.querySelectorAll(".bcc-view");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.view;

      buttons.forEach((btn) => btn.classList.remove("active"));
      views.forEach((view) => view.classList.remove("active"));

      button.classList.add("active");
      document.getElementById(target).classList.add("active");
    });
  });
}

function setupRatingDropdowns() {
  const ratingSelects = [
    document.getElementById("essay-rating"),
    document.getElementById("mcq-rating"),
    document.getElementById("flashcard-rating")
  ];

  ratingSelects.forEach((select) => {
    select.innerHTML = "";

    for (let i = 1; i <= 10; i++) {
      const option = document.createElement("option");
      option.value = String(i);
      option.textContent = String(i);
      select.appendChild(option);
    }

    select.value = "5";
  });
}

function populateSubjectDropdowns() {
  const dropdowns = [
    document.getElementById("essay-subject"),
    document.getElementById("mcq-subject"),
    document.getElementById("flashcard-subject")
  ];

  dropdowns.forEach((dropdown) => {
    dropdown.innerHTML = "";

    subjects.forEach((subject) => {
      const option = document.createElement("option");
      option.value = subject.id;
      option.textContent = subject.name;
      dropdown.appendChild(option);
    });
  });
}

function populateSourceDropdowns() {
  populateDropdown("essay-source", essaySources);
  populateDropdown("mcq-source", mcqSources);
  populateDropdown("flashcard-source", flashcardSources);
}

function populateDropdown(id, items) {
  const dropdown = document.getElementById(id);
  if (!dropdown) return;

  dropdown.innerHTML = "";

  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = item;
    dropdown.appendChild(option);
  });
}

function setupForms() {
  document.getElementById("essay-form").addEventListener("submit", handleEssaySubmit);
  document.getElementById("mcq-form").addEventListener("submit", handleMcqSubmit);
  document.getElementById("flashcard-form").addEventListener("submit", handleFlashcardSubmit);
}

function handleEssaySubmit(event) {
  event.preventDefault();

  const essay = {
    id: createId("essay"),
    type: "essay",
    subject: getValue("essay-subject"),
    source: getValue("essay-source"),
    title: getValue("essay-title"),
    questionNumber: getValue("essay-question-number"),
    rating: Number(getValue("essay-rating")),
    notes: getValue("essay-notes"),
    completedDate: todayString(),
    nextReview: addDays(todayString(), 1)
  };

  essays.push(essay);
  createReviewsForItem(essay);
  saveData();

  resetForm(event.target);
  renderAll();
}

function handleMcqSubmit(event) {
  event.preventDefault();

  const mcq = {
    id: createId("mcq"),
    type: "mcq",
    subject: getValue("mcq-subject"),
    source: getValue("mcq-source"),
    deck: getValue("mcq-deck"),
    questionNumber: getValue("mcq-question-number"),
    correct: getValue("mcq-correct") === "true",
    rating: Number(getValue("mcq-rating")),
    rule: getValue("mcq-rule"),
    notes: getValue("mcq-notes"),
    completedDate: todayString(),
    nextReview: addDays(todayString(), 1)
  };

  mcqs.push(mcq);
  createReviewsForItem(mcq);
  saveData();

  resetForm(event.target);
  renderAll();
}

function handleFlashcardSubmit(event) {
  event.preventDefault();

  const flashcard = {
    id: createId("flashcard"),
    type: "flashcard",
    subject: getValue("flashcard-subject"),
    source: getValue("flashcard-source"),
    front: getValue("flashcard-front"),
    back: getValue("flashcard-back"),
    rating: Number(getValue("flashcard-rating")),
    completedDate: todayString(),
    nextReview: addDays(todayString(), 1)
  };

  flashcards.push(flashcard);
  createReviewsForItem(flashcard);
  saveData();

  resetForm(event.target);
  renderAll();
}

function resetForm(form) {
  form.reset();
  setupRatingDropdowns();
  populateSubjectDropdowns();
  populateSourceDropdowns();
}

function createReviewsForItem(item) {
  let currentDate = todayString();

  reviewIntervals.forEach((interval, index) => {
    currentDate = addDays(currentDate, interval);

    reviews.push({
      id: createId("review"),
      itemId: item.id,
      itemType: item.type,
      subject: item.subject,
      dueDate: currentDate,
      intervalDays: interval,
      reviewNumber: index + 1,
      status: "pending",
      ratingAtCreation: item.rating
    });
  });
}

function renderAll() {
  renderPlanner();
  renderEssays();
  renderMcqs();
  renderFlashcards();
  renderReviews();
  renderDashboard();
  renderStats();
}

function renderPlanner() {
  const cycleInfo = getCurrentCycleInfo();
  const dayPlan = cycleInfo.dayPlan;

  document.getElementById("planner-cycle").textContent =
    `Cycle ${cycleInfo.cycleNumber} · Day ${cycleInfo.dayNumber} of ${studyCycle.length}`;

  document.getElementById("planner-subjects").innerHTML =
    `<div class="bcc-mission-subjects">${dayPlan.subjects.join(" + ")}</div>`;

  document.getElementById("dashboard-essays-target").textContent = studyGoals.essaysPerDay || 0;
  document.getElementById("dashboard-mcqs-target").textContent = studyGoals.mcqsPerDay || 0;
  document.getElementById("dashboard-flashcards-target").textContent = studyGoals.flashcardsPerDay || 0;

  renderCycleMap(cycleInfo.dayNumber);
}

function renderCycleMap(activeDay) {
  const map = document.getElementById("cycle-map");

  map.innerHTML = studyCycle.map((day) => {
    let className = "bcc-cycle-day";

    if (day.day < activeDay) className += " completed";
    if (day.day === activeDay) className += " active";

    return `
      <div class="${className}">
        Day ${day.day}
      </div>
    `;
  }).join("");
}

function getCurrentCycleInfo() {
  const startKey = "bcc_cycle_start_date";
  let startDate = localStorage.getItem(startKey);

  if (!startDate) {
    startDate = todayString();
    localStorage.setItem(startKey, startDate);
  }

  const daysElapsed = daysBetween(startDate, todayString());
  const cycleLength = studyCycle.length || 15;

  const dayNumber = (daysElapsed % cycleLength) + 1;
  const cycleNumber = Math.floor(daysElapsed / cycleLength) + 1;

  const dayPlan = studyCycle.find((item) => item.day === dayNumber) || {
    day: dayNumber,
    subjects: ["Unassigned"]
  };

  return {
    startDate,
    daysElapsed,
    dayNumber,
    cycleNumber,
    dayPlan
  };
}

function renderDashboard() {
  const dueReviews = getDueReviews();

  document.getElementById("dashboard-reviews-due").textContent = dueReviews.length;

  const todayList = document.getElementById("today-list");

  if (dueReviews.length === 0) {
    todayList.className = "bcc-list-empty";
    todayList.textContent = "No due items yet.";
    return;
  }

  todayList.className = "";
  todayList.innerHTML = dueReviews.map(renderReviewItem).join("");
}

function renderEssays() {
  const list = document.getElementById("essay-list");

  if (essays.length === 0) {
    list.className = "bcc-list-empty";
    list.textContent = "No essays added yet.";
    return;
  }

  list.className = "";
  list.innerHTML = essays.map((essay) => {
    return `
      <div class="bcc-item">
        <div class="bcc-item-title">${escapeHtml(essay.title || "Untitled Essay")}</div>
        <div class="bcc-item-meta">
          ${getSubjectName(essay.subject)} · ${escapeHtml(essay.source)} · ${escapeHtml(essay.questionNumber || "No question number")}
        </div>
        <div class="bcc-rating">Rating: ${essay.rating}/10 · Next Review: ${formatDate(essay.nextReview)}</div>
        ${essay.notes ? `<div class="bcc-item-notes">${escapeHtml(essay.notes)}</div>` : ""}
      </div>
    `;
  }).join("");
}

function renderMcqs() {
  const list = document.getElementById("mcq-list");

  if (mcqs.length === 0) {
    list.className = "bcc-list-empty";
    list.textContent = "No MCQs added yet.";
    return;
  }

  list.className = "";
  list.innerHTML = mcqs.map((mcq) => {
    return `
      <div class="bcc-item">
        <div class="bcc-item-title">${getSubjectName(mcq.subject)} · Question ${escapeHtml(mcq.questionNumber || "")}</div>
        <div class="bcc-item-meta">
          ${escapeHtml(mcq.source)} · ${escapeHtml(mcq.deck || "No deck")} · ${mcq.correct ? "Correct" : "Incorrect"}
        </div>
        <div class="bcc-rating">Rating: ${mcq.rating}/10 · Next Review: ${formatDate(mcq.nextReview)}</div>
        ${mcq.rule ? `<div class="bcc-item-notes">Rule: ${escapeHtml(mcq.rule)}</div>` : ""}
        ${mcq.notes ? `<div class="bcc-item-notes">${escapeHtml(mcq.notes)}</div>` : ""}
      </div>
    `;
  }).join("");
}

function renderFlashcards() {
  const list = document.getElementById("flashcard-list");

  if (flashcards.length === 0) {
    list.className = "bcc-list-empty";
    list.textContent = "No flashcards added yet.";
    return;
  }

  list.className = "";
  list.innerHTML = flashcards.map((card) => {
    return `
      <div class="bcc-item">
        <div class="bcc-item-title">${escapeHtml(card.front || "Untitled Flashcard")}</div>
        <div class="bcc-item-meta">${getSubjectName(card.subject)} · ${escapeHtml(card.source || "No source")}</div>
        <div class="bcc-rating">Rating: ${card.rating}/10 · Next Review: ${formatDate(card.nextReview)}</div>
        <div class="bcc-item-notes">${escapeHtml(card.back || "")}</div>
      </div>
    `;
  }).join("");
}

function renderReviews() {
  const list = document.getElementById("review-list");

  if (reviews.length === 0) {
    list.className = "bcc-list-empty";
    list.textContent = "No reviews scheduled yet.";
    return;
  }

  const sortedReviews = [...reviews].sort((a, b) => {
    return new Date(a.dueDate) - new Date(b.dueDate);
  });

  list.className = "";
  list.innerHTML = sortedReviews.map(renderReviewItem).join("");
}

function renderReviewItem(review) {
  const item = findItem(review.itemId, review.itemType);
  const title = getItemTitle(item, review.itemType);

  return `
    <div class="bcc-item">
      <div class="bcc-item-title">${escapeHtml(title)}</div>
      <div class="bcc-item-meta">
        ${capitalize(review.itemType)} · ${getSubjectName(review.subject)} · Review ${review.reviewNumber || ""} · Due ${formatDate(review.dueDate)}
      </div>
    </div>
  `;
}

function renderStats() {
  document.getElementById("stats-essays").textContent = essays.length;
  document.getElementById("stats-mcqs").textContent = mcqs.length;
  document.getElementById("stats-flashcards").textContent = flashcards.length;
  document.getElementById("stats-reviews").textContent = reviews.length;
}

function getDueReviews() {
  const today = todayString();

  return reviews.filter((review) => {
    return review.status === "pending" && review.dueDate <= today;
  });
}

function findItem(id, type) {
  if (type === "essay") return essays.find((item) => item.id === id);
  if (type === "mcq") return mcqs.find((item) => item.id === id);
  if (type === "flashcard") return flashcards.find((item) => item.id === id);
  return null;
}

function getItemTitle(item, type) {
  if (!item) return "Missing Item";

  if (type === "essay") return item.title || "Untitled Essay";
  if (type === "mcq") return `${getSubjectName(item.subject)} Question ${item.questionNumber || ""}`;
  if (type === "flashcard") return item.front || "Untitled Flashcard";

  return "Untitled Item";
}

function getSubjectName(subjectId) {
  const subject = subjects.find((item) => item.id === subjectId);
  return subject ? subject.name : subjectId;
}

function getValue(id) {
  return document.getElementById(id).value.trim();
}

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function todayString() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

function addDays(dateString, days) {
  const date = new Date(dateString + "T00:00:00");
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(startDate, endDate) {
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  const diff = end - start;
  return Math.floor(diff / 86400000);
}

function formatDate(dateString) {
  if (!dateString) return "";

  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
