const reviewIntervals = [1, 3, 7, 30];

let subjects = [];
let essaySources = [];
let mcqSources = [];
let flashcardSources = [];
let studyModes = [];
let studyGoals = {};
let studyCycle = [];

let essays = [];
let mcqs = [];
let flashcards = [];
let reviews = [];
let sessionHistory = [];
let currentSession = 1;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  await loadData();

  setupNavigation();
  setupRatingDropdowns();
  setupStudyModeDropdowns();
  populateSubjectDropdowns();
  populateSourceDropdowns();
  setupForms();
  setupSessionButton();

  renderAll();
}

async function loadData() {
  subjects = await loadJson("subjects.json", []);
  essaySources = await loadJson("essaySources.json", []);
  mcqSources = await loadJson("mcqSources.json", []);
  flashcardSources = await loadJson("flashcardSources.json", []);
  studyModes = await loadJson("studyModes.json", [
    "Standard Study",
    "Essay Focus",
    "MCQ Focus",
    "Flashcard Focus",
    "Review Mode"
  ]);

  studyGoals = await loadJson("studyGoals.json", {});
  studyCycle = await loadJson("studyCycle.json", []);

  essays = loadLocalData("bcc_essays", await loadJson("essays.json", []));
  mcqs = loadLocalData("bcc_mcqs", await loadJson("mcqs.json", []));
  flashcards = loadLocalData("bcc_flashcards", await loadJson("flashcards.json", []));
  reviews = loadLocalData("bcc_reviews", await loadJson("reviews.json", []));
  sessionHistory = loadLocalData("bcc_session_history", []);

  currentSession = Number(localStorage.getItem("bcc_current_session") || "1");

  if (!Number.isFinite(currentSession) || currentSession < 1) {
    currentSession = 1;
  }

  if (studyCycle.length > 0 && currentSession > studyCycle.length) {
    currentSession = 1;
    localStorage.setItem("bcc_current_session", String(currentSession));
  }
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
  localStorage.setItem("bcc_session_history", JSON.stringify(sessionHistory));
  localStorage.setItem("bcc_current_session", String(currentSession));
}

function setupNavigation() {
  const buttons = document.querySelectorAll(".bcc-nav-button");
  const views = document.querySelectorAll(".bcc-view");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.view;
      const targetView = document.getElementById(target);

      if (!targetView) return;

      buttons.forEach((btn) => btn.classList.remove("active"));
      views.forEach((view) => view.classList.remove("active"));

      button.classList.add("active");
      targetView.classList.add("active");
    });
  });
}

function setupSessionButton() {
  const button = document.getElementById("complete-session-button");
  if (!button) return;

  button.addEventListener("click", completeCurrentSession);
}

function completeCurrentSession() {
  const sessionInfo = getCurrentSessionInfo();

  const alreadyCompletedToday = sessionHistory.some((session) => {
    return session.sessionNumber === sessionInfo.sessionNumber &&
      session.completedDate === todayString();
  });

  if (alreadyCompletedToday) return;

  sessionHistory.push({
    id: createId("session"),
    sessionNumber: sessionInfo.sessionNumber,
    completedDate: todayString(),
    subjects: sessionInfo.sessionPlan.subjects,
    essaysTarget: studyGoals.essaysPerDay || 0,
    mcqsTarget: studyGoals.mcqsPerDay || 0,
    flashcardsTarget: studyGoals.flashcardsPerDay || 0
  });

  currentSession += 1;

  if (studyCycle.length > 0 && currentSession > studyCycle.length) {
    currentSession = 1;
  }

  saveData();
  renderAll();
}

function setupRatingDropdowns() {
  const ratingSelects = [
    document.getElementById("essay-rating"),
    document.getElementById("mcq-rating"),
    document.getElementById("flashcard-rating")
  ];

  ratingSelects.forEach((select) => {
    if (!select) return;

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

function setupStudyModeDropdowns() {
  const dropdowns = [
    document.getElementById("study-mode"),
    document.getElementById("planner-study-mode"),
    document.getElementById("dashboard-study-mode")
  ];

  dropdowns.forEach((dropdown) => {
    if (!dropdown) return;

    dropdown.innerHTML = "";

    studyModes.forEach((mode) => {
      const option = document.createElement("option");

      if (typeof mode === "string") {
        option.value = mode;
        option.textContent = mode;
      } else {
        option.value = mode.id || mode.name || "";
        option.textContent = mode.name || mode.label || mode.id || "";
      }

      dropdown.appendChild(option);
    });
  });
}

function populateSubjectDropdowns() {
  const dropdowns = [
    document.getElementById("essay-subject"),
    document.getElementById("mcq-subject"),
    document.getElementById("flashcard-subject")
  ];

  dropdowns.forEach((dropdown) => {
    if (!dropdown) return;

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
  const essayForm = document.getElementById("essay-form");
  const mcqForm = document.getElementById("mcq-form");
  const flashcardForm = document.getElementById("flashcard-form");

  if (essayForm) essayForm.addEventListener("submit", handleEssaySubmit);
  if (mcqForm) mcqForm.addEventListener("submit", handleMcqSubmit);
  if (flashcardForm) flashcardForm.addEventListener("submit", handleFlashcardSubmit);
}

function handleEssaySubmit(event) {
  event.preventDefault();

  const essay = {
    id: createId("essay"),
    type: "essay",
    studyMode: getValue("study-mode"),
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
    studyMode: getValue("study-mode"),
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
    studyMode: getValue("study-mode"),
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
  setupStudyModeDropdowns();
  populateSubjectDropdowns();
  populateSourceDropdowns();
}

function createReviewsForItem(item) {
  reviewIntervals.forEach((interval, index) => {
    reviews.push({
      id: createId("review"),
      itemId: item.id,
      itemType: item.type,
      subject: item.subject,
      dueDate: addDays(todayString(), interval),
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
  const sessionInfo = getCurrentSessionInfo();
  const sessionPlan = sessionInfo.sessionPlan;

  setText("planner-cycle", `Session ${sessionInfo.sessionNumber} of ${studyCycle.length || 15}`);

  const plannerSubjects = document.getElementById("planner-subjects");
  if (plannerSubjects) {
    plannerSubjects.innerHTML =
      `<div class="bcc-mission-subjects">${sessionPlan.subjects.join(" + ")}</div>`;
  }

  setText("dashboard-essays-target", studyGoals.essaysPerDay || 0);
  setText("dashboard-mcqs-target", studyGoals.mcqsPerDay || 0);
  setText("dashboard-flashcards-target", studyGoals.flashcardsPerDay || 0);

  renderSessionMap(sessionInfo.sessionNumber);
}

function renderSessionMap(activeSession) {
  const map = document.getElementById("cycle-map");
  if (!map) return;

  map.innerHTML = studyCycle.map((session) => {
    let className = "bcc-cycle-day";

    if (session.day < activeSession) className += " completed";
    if (session.day === activeSession) className += " active";

    return `
      <div class="${className}">
        Session ${session.day}
      </div>
    `;
  }).join("");
}

function getCurrentSessionInfo() {
  const cycleLength = studyCycle.length || 15;

  if (currentSession < 1) {
    currentSession = 1;
  }

  if (currentSession > cycleLength) {
    currentSession = 1;
  }

  const sessionPlan = studyCycle.find((item) => item.day === currentSession) || {
    day: currentSession,
    subjects: ["Unassigned"]
  };

  return {
    sessionNumber: currentSession,
    sessionPlan
  };
}

function renderDashboard() {
  const dueReviews = getDueReviews();

  setText("dashboard-reviews-due", dueReviews.length);

  const todayList = document.getElementById("today-list");
  if (!todayList) return;

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
  if (!list) return;

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
        <div class="bcc-rating">Rating: ${essay.rating}/10 · Next Review: ${formatDate(getNextReviewDate(essay.id, "essay"))}</div>
        ${essay.notes ? `<div class="bcc-item-notes">${escapeHtml(essay.notes)}</div>` : ""}
      </div>
    `;
  }).join("");
}

function renderMcqs() {
  const list = document.getElementById("mcq-list");
  if (!list) return;

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
        <div class="bcc-rating">Rating: ${mcq.rating}/10 · Next Review: ${formatDate(getNextReviewDate(mcq.id, "mcq"))}</div>
        ${mcq.rule ? `<div class="bcc-item-notes">Rule: ${escapeHtml(mcq.rule)}</div>` : ""}
        ${mcq.notes ? `<div class="bcc-item-notes">${escapeHtml(mcq.notes)}</div>` : ""}
      </div>
    `;
  }).join("");
}

function renderFlashcards() {
  const list = document.getElementById("flashcard-list");
  if (!list) return;

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
        <div class="bcc-rating">Rating: ${card.rating}/10 · Next Review: ${formatDate(getNextReviewDate(card.id, "flashcard"))}</div>
        <div class="bcc-item-notes">${escapeHtml(card.back || "")}</div>
      </div>
    `;
  }).join("");
}

function renderReviews() {
  const list = document.getElementById("review-list");
  if (!list) return;

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
        ${capitalize(review.itemType)} · ${getSubjectName(review.subject)} · Review ${review.reviewNumber || ""} · Due ${formatDate(review.dueDate)} · ${capitalize(review.status)}
      </div>
      ${
        review.status === "pending"
          ? `<button class="bcc-small-button" onclick="completeReview('${review.id}')">Mark Reviewed</button>`
          : ""
      }
    </div>
  `;
}

function completeReview(reviewId) {
  const review = reviews.find((item) => item.id === reviewId);
  if (!review) return;

  review.status = "completed";
  review.completedDate = todayString();

  saveData();
  renderAll();
}

function renderStats() {
  const weekCount = countSessionsSince(7);
  const monthCount = countSessionsSince(30);
  const pendingReviewCount = reviews.filter((review) => review.status === "pending").length;

  setText("stats-essays", essays.length);
  setText("stats-mcqs", mcqs.length);
  setText("stats-flashcards", flashcards.length);
  setText("stats-reviews", pendingReviewCount);

  const statsSection = document.getElementById("stats");
  if (!statsSection) return;

  let sessionStats = document.getElementById("session-stats-panel");

  if (!sessionStats) {
    sessionStats = document.createElement("div");
    sessionStats.id = "session-stats-panel";
    sessionStats.className = "bcc-panel";
    statsSection.appendChild(sessionStats);
  }

  sessionStats.innerHTML = `
    <h2>Session History</h2>
    <div class="bcc-item">
      <div class="bcc-item-title">Sessions completed this week: ${weekCount}</div>
      <div class="bcc-item-meta">Sessions completed this month: ${monthCount}</div>
      <div class="bcc-item-meta">Total completed sessions: ${sessionHistory.length}</div>
    </div>
  `;
}

function countSessionsSince(days) {
  const cutoff = addDays(todayString(), -days);

  return sessionHistory.filter((session) => {
    return session.completedDate >= cutoff;
  }).length;
}

function getDueReviews() {
  const today = todayString();

  return reviews.filter((review) => {
    return review.status === "pending" && review.dueDate <= today;
  });
}

function getNextReviewDate(itemId, itemType) {
  const pendingReviews = reviews
    .filter((review) => {
      return review.itemId === itemId &&
        review.itemType === itemType &&
        review.status === "pending";
    })
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  return pendingReviews.length > 0 ? pendingReviews[0].dueDate : "";
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
  const element = document.getElementById(id);
  return element ? element.value.trim() : "";
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = value;
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
  if (!text) return "";
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
