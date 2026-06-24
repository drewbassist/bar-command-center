const reviewIntervals = [1, 4, 14, 45, 90, 180, 365];

let subjects = [];
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
  setupForms();

  renderAll();
}

async function loadData() {
  subjects = await loadJson("subjects.json", []);
  essays = await loadJson("essays.json", []);
  mcqs = await loadJson("mcqs.json", []);
  flashcards = await loadJson("flashcards.json", []);
  reviews = await loadJson("reviews.json", []);
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

function setupForms() {
  const essayForm = document.getElementById("essay-form");
  const mcqForm = document.getElementById("mcq-form");
  const flashcardForm = document.getElementById("flashcard-form");

  essayForm.addEventListener("submit", handleEssaySubmit);
  mcqForm.addEventListener("submit", handleMcqSubmit);
  flashcardForm.addEventListener("submit", handleFlashcardSubmit);
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

  event.target.reset();
  setupRatingDropdowns();
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

  event.target.reset();
  setupRatingDropdowns();
  renderAll();
}

function handleFlashcardSubmit(event) {
  event.preventDefault();

  const flashcard = {
    id: createId("flashcard"),
    type: "flashcard",
    subject: getValue("flashcard-subject"),
    front: getValue("flashcard-front"),
    back: getValue("flashcard-back"),
    rating: Number(getValue("flashcard-rating")),
    completedDate: todayString(),
    nextReview: addDays(todayString(), 1)
  };

  flashcards.push(flashcard);
  createReviewsForItem(flashcard);

  event.target.reset();
  setupRatingDropdowns();
  renderAll();
}

function createReviewsForItem(item) {
  reviewIntervals.forEach((interval) => {
    reviews.push({
      id: createId("review"),
      itemId: item.id,
      itemType: item.type,
      subject: item.subject,
      dueDate: addDays(todayString(), interval),
      intervalDays: interval,
      status: "pending",
      ratingAtCreation: item.rating
    });
  });
}

function renderAll() {
  renderEssays();
  renderMcqs();
  renderFlashcards();
  renderReviews();
  renderDashboard();
  renderStats();
}

function renderDashboard() {
  const dueReviews = getDueReviews();

  document.getElementById("dashboard-reviews-due").textContent = dueReviews.length;

  const dueFlashcards = dueReviews.filter((review) => review.itemType === "flashcard");
  document.getElementById("dashboard-flashcards-due").textContent = dueFlashcards.length;

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
        <div class="bcc-item-meta">${getSubjectName(card.subject)}</div>
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
        ${capitalize(review.itemType)} · ${getSubjectName(review.subject)} · Due ${formatDate(review.dueDate)} · ${review.intervalDays} days
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

  if (type === "essay") {
    return item.title || "Untitled Essay";
  }

  if (type === "mcq") {
    return `${getSubjectName(item.subject)} Question ${item.questionNumber || ""}`;
  }

  if (type === "flashcard") {
    return item.front || "Untitled Flashcard";
  }

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
