const reviewIntervals = [1, 3, 7, 30];

let subjects = [];
let essaySources = [];
let mcqSources = [];
let flashcardSources = [];

let studyGoals = {};
let studyCycle = [];
let studyModes = {};
let currentStudyMode = "full";

let essays = [];
let mcqs = [];
let flashcards = [];
let lectures = [];
let reviews = [];
let sessionHistory = [];
let currentSession = 1;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  await loadData();

  setupNavigation();
  setupViewJumpButtons();
  setupRatingDropdowns();
  populateSubjectDropdowns();
  populateSourceDropdowns();
  setupForms();

  setupStudyModeSelector();
  setupBackupButtons();

  renderAll();
}

async function loadData() {
  subjects = await loadJson("subjects.json", []);
  essaySources = await loadJson("essaySources.json", []);
  mcqSources = await loadJson("mcqSources.json", []);
  flashcardSources = await loadJson("flashcardSources.json", []);

  studyGoals = await loadJson("studyGoals.json", {});
  studyCycle = await loadJson("studyCycle.json", []);
  studyModes = await loadJson("studyModes.json", {});
  currentStudyMode = localStorage.getItem("bcc_study_mode") || "full";

  essays = loadLocalData("bcc_essays", await loadJson("essays.json", []));
  mcqs = loadLocalData("bcc_mcqs", await loadJson("mcqs.json", []));
  flashcards = loadLocalData("bcc_flashcards", await loadJson("flashcards.json", []));
  lectures = loadLocalData("bcc_lectures", await loadJson("lectures.json", []));
  reviews = loadLocalData("bcc_reviews", await loadJson("reviews.json", []));
  sessionHistory = loadLocalData("bcc_session_history", []);

  currentSession = Number(localStorage.getItem("bcc_current_session") || "1");

  if (!Number.isFinite(currentSession) || currentSession < 1) {
    currentSession = 1;
  }

  if (studyCycle.length > 0 && currentSession > studyCycle.length) {
    currentSession = 1;
  }
}

async function loadJson(path, fallback) {
  try {
    const response = await fetch(path);

    if (!response.ok) {
      console.warn(`Could not load ${path}`);
      return fallback;
    }

    return await response.json();
  } catch (error) {
    console.warn(`Error loading ${path}`, error);
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
  localStorage.setItem("bcc_lectures", JSON.stringify(lectures));
  localStorage.setItem("bcc_reviews", JSON.stringify(reviews));
  localStorage.setItem("bcc_session_history", JSON.stringify(sessionHistory));
  localStorage.setItem("bcc_current_session", String(currentSession));
  localStorage.setItem("bcc_study_mode", currentStudyMode);
}

function setupNavigation() {
  const buttons = document.querySelectorAll(".bcc-nav-button");
  const views = document.querySelectorAll(".bcc-view");

  window.activateBccView = function (viewId) {
    const targetView = document.getElementById(viewId);
    if (!targetView) return;

    buttons.forEach((button) => {
      button.classList.toggle("active", button.dataset.view === viewId);
    });

    views.forEach((view) => {
      view.classList.toggle("active", view.id === viewId);
    });

    localStorage.setItem("bcc_active_view", viewId);
  };

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      window.activateBccView(button.dataset.view);
    });
  });

  const savedView = localStorage.getItem("bcc_active_view") || "dashboard";
  window.activateBccView(savedView);
}

function setupViewJumpButtons() {
  const jumpButtons = document.querySelectorAll("[data-view-jump]");

  jumpButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (window.activateBccView) {
        window.activateBccView(button.dataset.viewJump);
      }
    });
  });
}

function setupSessionButton() {
  const button = document.getElementById("complete-session-button");
  if (!button) return;

  button.addEventListener("click", completeCurrentSession);
}

function setupStudyModeSelector() {
  const selector = document.getElementById("study-mode-select");
  if (!selector) return;

  selector.innerHTML = "";

  Object.entries(studyModes).forEach(([modeId, mode]) => {
    const option = document.createElement("option");
    option.value = modeId;
    option.textContent = mode.label || capitalize(modeId);
    selector.appendChild(option);
  });

  if (!studyModes[currentStudyMode]) {
    currentStudyMode = Object.keys(studyModes)[0] || "full";
  }

  selector.value = currentStudyMode;

  selector.addEventListener("change", () => {
    currentStudyMode = selector.value;
    saveData();
    renderAll();
  });
}

function completeCurrentSession() {
  const sessionInfo = getCurrentSessionInfo();

  sessionHistory.push({
    id: createId("session"),
    sessionNumber: sessionInfo.sessionNumber,
    completedDate: todayString(),
    subjects: sessionInfo.sessionPlan.subjects,
    essaysTarget: getEssayGoal(),
    mcqsTarget: getMcqGoal(),
    flashcardsTarget: getFlashcardGoal(),
    lecturesTarget: getLectureGoal()
  });

  currentSession += 1;

  if (studyCycle.length > 0 && currentSession > studyCycle.length) {
    currentSession = 1;
  }

  saveData();
  renderAll();
}

function setupRatingDropdowns() {
  populateNumberDropdown("essay-rating", 1, 10, "5");
  populateNumberDropdown("mcq-rating", 1, 10, "5");
  populateNumberDropdown("flashcard-rating", 1, 10, "5");
  populateNumberDropdown("lecture-rating", 1, 10, "5");
}

function populateNumberDropdown(id, min, max, selectedValue) {
  const dropdown = document.getElementById(id);
  if (!dropdown) return;

  dropdown.innerHTML = "";

  for (let i = min; i <= max; i++) {
    const option = document.createElement("option");
    option.value = String(i);
    option.textContent = String(i);
    dropdown.appendChild(option);
  }

  dropdown.value = selectedValue;
}

function populateSubjectDropdowns() {
  populateSubjectDropdown("essay-subject");
  populateSubjectDropdown("mcq-subject");
  populateSubjectDropdown("flashcard-subject");
  populateSubjectDropdown("lecture-subject");
}

function populateSubjectDropdown(id) {
  const dropdown = document.getElementById(id);
  if (!dropdown) return;

  dropdown.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select Subject";
  placeholder.disabled = true;
  placeholder.selected = true;
  dropdown.appendChild(placeholder);

  subjects.forEach((subject) => {
    const option = document.createElement("option");
    option.value = subject.id;
    option.textContent = subject.name;
    dropdown.appendChild(option);
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
  const lectureForm = document.getElementById("lecture-form");

  if (essayForm) essayForm.addEventListener("submit", handleEssaySubmit);
  if (mcqForm) mcqForm.addEventListener("submit", handleMcqSubmit);
  if (flashcardForm) flashcardForm.addEventListener("submit", handleFlashcardSubmit);
  if (lectureForm) lectureForm.addEventListener("submit", handleLectureSubmit);
}

function handleEssaySubmit(event) {
  event.preventDefault();

  const essay = {
    id: createId("essay"),
    type: "essay",
    subject: normalizeSubjectSelection(getValue("essay-subject"), getValue("essay-source")),
    source: getValue("essay-source"),
    title: getValue("essay-title"),
    pageNumber: getValue("essay-page-number"),
    questionNumber: getValue("essay-question-number"),
    rating: Number(getValue("essay-rating")),
    notes: getValue("essay-notes"),
    completedDate: todayString()
  };

  essays.push(essay);
  createReviewsForItem(essay);
  saveData();
  resetForm(event.target);
  renderAll();
}

function handleMcqSubmit(event) {
  event.preventDefault();

  const count = Number(getValue("mcq-count")) || 0;
  const correctCount = Number(getValue("mcq-correct-count")) || 0;
  const incorrectCount = Math.max(count - correctCount, 0);
  const accuracy = count > 0 ? Math.round((correctCount / count) * 100) : 0;

  const mcq = {
    id: createId("mcq"),
    type: "mcq",
    subject: normalizeSubjectSelection(getValue("mcq-subject"), getValue("mcq-source")),
    source: getValue("mcq-source"),
    count,
    correctCount,
    incorrectCount,
    accuracy,
    rating: Number(getValue("mcq-rating")),
    notes: getValue("mcq-notes"),
    completedDate: todayString()
  };

  mcqs.push(mcq);
  createReviewsForItem(mcq);
  saveData();
  resetForm(event.target);
  renderAll();
}

function handleFlashcardSubmit(event) {
  event.preventDefault();

  const startCard = getValue("flashcard-start-card");
  const endCard = getValue("flashcard-end-card");
  const countFromRange = getCountFromRange(startCard, endCard);

  const flashcard = {
    id: createId("flashcard"),
    type: "flashcard",
    subject: normalizeSubjectSelection(getValue("flashcard-subject"), getValue("flashcard-source")),
    source: getValue("flashcard-source"),
    startCard,
    endCard,
    count: Number(getValue("flashcard-count")) || countFromRange || 0,
    newCount: Number(getValue("flashcard-new-count")) || 0,
    rating: Number(getValue("flashcard-rating")),
    notes: getValue("flashcard-notes"),
    completedDate: todayString()
  };

  flashcards.push(flashcard);
  createReviewsForItem(flashcard);
  saveData();
  resetForm(event.target);
  renderAll();
}

function handleLectureSubmit(event) {
  event.preventDefault();

  const lecture = {
    id: createId("lecture"),
    type: "lecture",
    subject: getValue("lecture-subject"),
    source: "AIL",
    title: getValue("lecture-title"),
    minutes: Number(getValue("lecture-minutes")) || 0,
    rating: Number(getValue("lecture-rating")),
    notes: getValue("lecture-notes"),
    completedDate: todayString()
  };

  lectures.push(lecture);
  createReviewsForItem(lecture);
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

function setupBackupButtons() {
  const exportButton = document.getElementById("export-backup-button");
  const importInput = document.getElementById("import-backup-input");

  if (exportButton) exportButton.addEventListener("click", exportBackup);
  if (importInput) importInput.addEventListener("change", importBackup);
}

function exportBackup() {
  const backup = {
    exportedAt: new Date().toISOString(),
    app: "Drew's BarOS",
    essays,
    mcqs,
    flashcards,
    lectures,
    reviews,
    sessionHistory,
    currentSession
  };

  const file = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(file);
  const link = document.createElement("a");

  link.href = url;
  link.download = `baros-backup-${todayString()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = function () {
    try {
      const backup = JSON.parse(reader.result);

      essays = Array.isArray(backup.essays) ? backup.essays : [];
      mcqs = Array.isArray(backup.mcqs) ? backup.mcqs : [];
      flashcards = Array.isArray(backup.flashcards) ? backup.flashcards : [];
      lectures = Array.isArray(backup.lectures) ? backup.lectures : [];
      reviews = Array.isArray(backup.reviews) ? backup.reviews : [];
      sessionHistory = Array.isArray(backup.sessionHistory) ? backup.sessionHistory : [];
      currentSession = Number(backup.currentSession || 1);

      if (!Number.isFinite(currentSession) || currentSession < 1) {
        currentSession = 1;
      }

      saveData();
      renderAll();

      event.target.value = "";
      alert("Backup imported successfully.");
    } catch (error) {
      event.target.value = "";
      alert("Could not import backup. The file is not valid BarOS JSON.");
    }
  };

  reader.readAsText(file);
}

function renderAll() {
  renderPlanner();
  renderEssays();
  renderMcqs();
  renderFlashcards();
  renderLectures();
  renderReviews();
  renderDashboard();
  renderStats();
}

function renderPlanner() {
  const essaysToday = getTodayCount(essays);
  const mcqsToday = getTodayMcqTotal();
  const flashcardsToday = getTodayFlashcardTotal();
  const lectureMinutesToday = getTodayLectureMinutes();
  const sessionInfo = getCurrentSessionInfo();
  const subjectsToday = Array.isArray(sessionInfo.sessionPlan.subjects)
    ? sessionInfo.sessionPlan.subjects
    : [];

  setText("dashboard-essays-target", essaysToday);
  setText("dashboard-mcqs-target", mcqsToday);
  setText("dashboard-flashcards-target", flashcardsToday);
  setText("dashboard-lectures-target", lectureMinutesToday);

  setText("dashboard-essays-target-minimum", essaysToday);
  setText("dashboard-mcqs-target-minimum", mcqsToday);
  setText("dashboard-flashcards-target-minimum", flashcardsToday);
  setText("dashboard-lectures-target-minimum", lectureMinutesToday);

  setText("dashboard-essays-goal", getEssayGoal());
  setText("dashboard-mcqs-goal", getMcqGoal());
  setText("dashboard-flashcards-goal", getFlashcardGoal());
  setText("dashboard-lectures-goal", getLectureGoal());

  setText("dashboard-session-number", sessionInfo.sessionNumber);
  setText("dashboard-study-mode-label", getCurrentStudyModeLabel());
  setText("dashboard-mission-subjects", subjectsToday.join(" + ") || "Unassigned");
  setText("dashboard-mission-targets", `Essay ${getEssayGoal()} · MCQs ${getMcqGoal()} · Flashcards ${getFlashcardGoal()} · Lecture minutes ${getLectureGoal()}`);

  renderCycleMap();
}

function renderCycleMap() {
  const map = document.getElementById("cycle-map");
  if (!map) return;

  map.innerHTML = studyCycle.map((day) => {
    const dayNumber = Number(day.day);
    const isActive = dayNumber === Number(currentSession);
    const wasCompleted = sessionHistory.some((session) => Number(session.sessionNumber) === dayNumber);
    const subjectsText = Array.isArray(day.subjects) ? day.subjects.join(" + ") : "Unassigned";

    return `
      <div class="bcc-cycle-day ${isActive ? "active" : ""} ${wasCompleted ? "completed" : ""}">
        <div>Day ${escapeHtml(dayNumber)}</div>
        <div>${escapeHtml(subjectsText)}</div>
      </div>
    `;
  }).join("");
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
  list.innerHTML = essays.map((essay) => `
    <div class="bcc-item">
      <div class="bcc-item-title">${escapeHtml(essay.title || "Untitled Essay")}</div>
      <div class="bcc-item-meta">
        ${escapeHtml(getSubjectName(essay.subject))} · ${escapeHtml(essay.source || "No source")} · ${escapeHtml(essay.pageNumber || "No page number")} · ${escapeHtml(essay.questionNumber || "No question number")}
      </div>
      <div class="bcc-rating">Rating: ${essay.rating}/10 · Next Review: ${formatDate(getNextReviewDate(essay.id, "essay"))}</div>
      ${essay.notes ? `<div class="bcc-item-notes">${escapeHtml(essay.notes)}</div>` : ""}
    </div>
  `).join("");
}

function renderMcqs() {
  const list = document.getElementById("mcq-list");
  if (!list) return;

  if (mcqs.length === 0) {
    list.className = "bcc-list-empty";
    list.textContent = "No MCQ sessions added yet.";
    return;
  }

  list.className = "";
  list.innerHTML = mcqs.map((mcq) => `
    <div class="bcc-item">
      <div class="bcc-item-title">${escapeHtml(getSubjectName(mcq.subject))} · ${getMcqCountValue(mcq)} questions</div>
      <div class="bcc-item-meta">
        ${escapeHtml(mcq.source || "No source")} · ${Number(mcq.correctCount) || 0} correct · ${getMcqAccuracy(mcq)}%
      </div>
      <div class="bcc-rating">Rating: ${mcq.rating}/10 · Next Review: ${formatDate(getNextReviewDate(mcq.id, "mcq"))}</div>
      ${mcq.notes ? `<div class="bcc-item-notes">${escapeHtml(mcq.notes)}</div>` : ""}
    </div>
  `).join("");
}

function renderFlashcards() {
  const list = document.getElementById("flashcard-list");
  if (!list) return;

  if (flashcards.length === 0) {
    list.className = "bcc-list-empty";
    list.textContent = "No flashcard sessions added yet.";
    return;
  }

  list.className = "";
  list.innerHTML = flashcards.map((card) => `
    <div class="bcc-item">
      <div class="bcc-item-title">${escapeHtml(getFlashcardTitle(card))}</div>
      <div class="bcc-item-meta">
        ${escapeHtml(card.source || "No source")} · ${Number(card.count) || 0} cards reviewed · ${Number(card.newCount) || 0} new cards
      </div>
      <div class="bcc-rating">Rating: ${card.rating}/10 · Next Review: ${formatDate(getNextReviewDate(card.id, "flashcard"))}</div>
      ${card.notes ? `<div class="bcc-item-notes">${escapeHtml(card.notes)}</div>` : ""}
    </div>
  `).join("");
}

function renderLectures() {
  const list = document.getElementById("lecture-list");
  if (!list) return;

  if (lectures.length === 0) {
    list.className = "bcc-list-empty";
    list.textContent = "No lecture reviews added yet.";
    return;
  }

  list.className = "";
  list.innerHTML = lectures.map((lecture) => `
    <div class="bcc-item">
      <div class="bcc-item-title">${escapeHtml(lecture.title || "Untitled Lecture")}</div>
      <div class="bcc-item-meta">
        ${escapeHtml(getSubjectName(lecture.subject))} · ${escapeHtml(lecture.source || "AIL")} · ${Number(lecture.minutes) || 0} min
      </div>
      <div class="bcc-rating">Rating: ${lecture.rating}/10 · Next Review: ${formatDate(getNextReviewDate(lecture.id, "lecture"))}</div>
      ${lecture.notes ? `<div class="bcc-item-notes">${escapeHtml(lecture.notes)}</div>` : ""}
    </div>
  `).join("");
}

function renderReviews() {
  const list = document.getElementById("review-list");
  if (!list) return;

  if (reviews.length === 0) {
    list.className = "bcc-list-empty";
    list.textContent = "No reviews scheduled yet.";
    return;
  }

  const groups = getReviewGroups();

  if (groups.length === 0) {
    list.className = "bcc-list-empty";
    list.textContent = "No reviews scheduled yet.";
    return;
  }

  list.className = "";
  list.innerHTML = groups.map(renderReviewGroup).join("");
}

function renderReviewGroup(group) {
  const item = findItem(group.itemId, group.itemType);
  const title = getItemTitle(item, group.itemType);
  const subject = getSubjectName(group.subject);

  const cells = group.reviews.map((review) => {
    const isCompleted = review.status === "completed";
    const isDue = review.status === "pending" && review.dueDate <= todayString();

    return `
      <div class="bcc-review-cell ${isCompleted ? "completed" : ""} ${isDue ? "due" : ""}">
        <div class="bcc-review-label">Day ${escapeHtml(review.intervalDays || "")}</div>
        <div class="bcc-review-date">${formatDate(review.dueDate)}</div>
        <button class="bcc-small-button" onclick="completeReview('${escapeHtml(review.id)}')" ${isCompleted ? "disabled" : ""}>
          ${isCompleted ? "Reviewed" : "Mark Reviewed"}
        </button>
      </div>
    `;
  }).join("");

  return `
    <div class="bcc-item bcc-review-row">
      <div class="bcc-item-title">${escapeHtml(title)}</div>
      <div class="bcc-item-meta">${escapeHtml(getTypeLabel(group.itemType))} · ${escapeHtml(subject)}</div>
      <div class="bcc-review-grid">
        ${cells}
      </div>
    </div>
  `;
}

function renderReviewItem(review) {
  const item = findItem(review.itemId, review.itemType);
  const title = getItemTitle(item, review.itemType);

  return `
    <div class="bcc-item">
      <div class="bcc-item-title">${escapeHtml(title)}</div>
      <div class="bcc-item-meta">
        ${escapeHtml(getTypeLabel(review.itemType))} · ${escapeHtml(getSubjectName(review.subject))} · Review ${escapeHtml(review.reviewNumber || "")} · Due ${formatDate(review.dueDate)} · ${escapeHtml(capitalize(review.status))}
      </div>
      ${
        review.status === "pending"
          ? `<button class="bcc-small-button" onclick="completeReview('${escapeHtml(review.id)}')">Mark Reviewed</button>`
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
  const pendingReviews = reviews.filter((review) => review.status === "pending").length;

  setText("stats-essays", essays.length);
  setText("stats-mcqs", getMcqTotal());
  setText("stats-flashcards", getFlashcardTotal());
  setText("stats-lectures", getLectureMinutesTotal());
  setText("stats-reviews", pendingReviews);

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

function getReviewGroups() {
  const groups = {};

  reviews.forEach((review) => {
    const key = `${review.itemType}_${review.itemId}`;

    if (!groups[key]) {
      groups[key] = {
        itemId: review.itemId,
        itemType: review.itemType,
        subject: review.subject,
        reviews: []
      };
    }

    groups[key].reviews.push(review);
  });

  return Object.values(groups)
    .map((group) => {
      group.reviews.sort((a, b) => Number(a.reviewNumber) - Number(b.reviewNumber));
      return group;
    })
    .sort((a, b) => {
      const nextA = getGroupNextDueDate(a);
      const nextB = getGroupNextDueDate(b);
      return new Date(nextA || "9999-12-31") - new Date(nextB || "9999-12-31");
    });
}

function getGroupNextDueDate(group) {
  const pending = group.reviews
    .filter((review) => review.status === "pending")
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  return pending.length > 0 ? pending[0].dueDate : "";
}

function countSessionsSince(days) {
  const cutoff = addDays(todayString(), -days);

  return sessionHistory.filter((session) => {
    return session.completedDate >= cutoff;
  }).length;
}

function getTodayCount(items) {
  const today = todayString();
  return items.filter((item) => item.completedDate === today).length;
}

function getTodayMcqTotal() {
  const today = todayString();
  return mcqs
    .filter((mcq) => mcq.completedDate === today)
    .reduce((total, mcq) => total + getMcqCountValue(mcq), 0);
}

function getMcqTotal() {
  return mcqs.reduce((total, mcq) => total + getMcqCountValue(mcq), 0);
}

function getMcqCountValue(mcq) {
  if (Number(mcq.count) > 0) return Number(mcq.count);

  if (mcq.questionNumber || typeof mcq.correct === "boolean") {
    return 1;
  }

  return 0;
}

function getMcqAccuracy(mcq) {
  const count = getMcqCountValue(mcq);
  const correct = Number(mcq.correctCount) || (mcq.correct ? 1 : 0);

  if (count <= 0) return 0;

  return Math.round((correct / count) * 100);
}

function getTodayFlashcardTotal() {
  const today = todayString();
  return flashcards
    .filter((card) => card.completedDate === today)
    .reduce((total, card) => total + (Number(card.count) || 0), 0);
}

function getFlashcardTotal() {
  return flashcards.reduce((total, card) => total + (Number(card.count) || 0), 0);
}

function getTodayLectureMinutes() {
  const today = todayString();
  return lectures
    .filter((lecture) => lecture.completedDate === today)
    .reduce((total, lecture) => total + (Number(lecture.minutes) || 0), 0);
}

function getLectureMinutesTotal() {
  return lectures.reduce((total, lecture) => total + (Number(lecture.minutes) || 0), 0);
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
  if (type === "lecture") return lectures.find((item) => item.id === id);
  return null;
}

function getItemTitle(item, type) {
  if (!item) return "Missing Item";

  if (type === "essay") return item.title || "Untitled Essay";
  if (type === "mcq") return `${getSubjectName(item.subject)} MCQ Session`;
  if (type === "flashcard") return getFlashcardTitle(item);
  if (type === "lecture") return item.title || `${getSubjectName(item.subject)} Lecture Review`;

  return "Untitled Item";
}

function getFlashcardTitle(card) {
  if (!card) return "Flashcard Session";

  const subject = getSubjectName(card.subject);
  const source = card.source || "Flashcards";
  const start = card.startCard || "";
  const end = card.endCard || "";

  if (start && end) {
    return `${subject} · ${source} · Cards ${start}-${end}`;
  }

  if (start) {
    return `${subject} · ${source} · Card ${start}`;
  }

  return `${subject} · ${source} · Flashcard Session`;
}

function getTypeLabel(type) {
  if (type === "mcq") return "MCQ Session";
  if (type === "flashcard") return "Flashcard Session";
  if (type === "lecture") return "Lecture Review";
  return capitalize(type);
}

function getCurrentSessionInfo() {
  const cycleLength = studyCycle.length || 1;

  if (currentSession < 1) currentSession = 1;
  if (currentSession > cycleLength) currentSession = 1;

  const sessionPlan = studyCycle.find((item) => Number(item.day) === Number(currentSession)) || {
    day: currentSession,
    subjects: ["Unassigned"]
  };

  return {
    sessionNumber: currentSession,
    sessionPlan
  };
}

function getEssayGoal() {
  const mode = getCurrentStudyMode();
  return Number(mode.essaysPerDay ?? studyGoals.essaysPerDay ?? studyGoals.essayGoal ?? studyGoals.essays ?? 0);
}

function getMcqGoal() {
  const mode = getCurrentStudyMode();
  return Number(mode.mcqsPerDay ?? studyGoals.mcqsPerDay ?? studyGoals.mcqGoal ?? studyGoals.mcqs ?? 0);
}

function getFlashcardGoal() {
  const mode = getCurrentStudyMode();
  return Number(
    mode.flashcardsPerDay ??
    studyGoals.flashcardsPerDay ??
    studyGoals.flashcardGoal ??
    studyGoals.flashcards ??
    studyGoals.cardsPerDay ??
    0
  );
}

function getLectureGoal() {
  return Number(
    studyGoals.lectureMinutesPerDay ||
    studyGoals.lecturesPerDay ||
    studyGoals.lectureReviewsPerDay ||
    studyGoals.lectureGoal ||
    studyGoals.lectures ||
    0
  );
}

function getCurrentStudyMode() {
  return studyModes[currentStudyMode] || {};
}

function getCurrentStudyModeLabel() {
  const mode = getCurrentStudyMode();
  return mode.label || capitalize(currentStudyMode);
}

function normalizeSubjectSelection(selectedSubject, sourceText) {
  const inferredSubject = inferSubjectFromText(sourceText);

  if (inferredSubject && (!selectedSubject || selectedSubject === subjects[0]?.id)) {
    return inferredSubject;
  }

  return selectedSubject;
}

function inferSubjectFromText(text) {
  const value = String(text || "").toLowerCase();

  const matches = [
    ["constitutional", "constitutional_law"],
    ["con law", "constitutional_law"],
    ["civil procedure", "civil_procedure"],
    ["civ pro", "civil_procedure"],
    ["contracts", "contracts_sales"],
    ["sales", "contracts_sales"],
    ["criminal", "criminal_law_procedure"],
    ["evidence", "evidence"],
    ["real property", "real_property"],
    ["property", "real_property"],
    ["torts", "torts"],
    ["business", "business_associations"],
    ["community property", "community_property"],
    ["professional responsibility", "professional_responsibility"],
    ["remedies", "remedies"],
    ["trusts", "trusts"],
    ["wills", "wills_succession"],
    ["succession", "wills_succession"]
  ];

  const match = matches.find(([needle]) => value.includes(needle));
  return match ? match[1] : "";
}

function getCountFromRange(start, end) {
  const startNumber = Number(start);
  const endNumber = Number(end);

  if (!Number.isFinite(startNumber) || !Number.isFinite(endNumber)) {
    return 0;
  }

  if (endNumber < startNumber) {
    return 0;
  }

  return endNumber - startNumber + 1;
}

function getSubjectName(subjectId) {
  const subject = subjects.find((item) => item.id === subjectId);
  return subject ? subject.name : subjectId || "";
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

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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
  return String(text).charAt(0).toUpperCase() + String(text).slice(1);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
