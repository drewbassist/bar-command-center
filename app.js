const reviewIntervals = [1, 3, 7, 30];

const SUPABASE_URL = "https://rudhrifkjhretilqdncy.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_TGTjuqPmo8AOx_P2OpxnOw_NGT-1Z9l";

let supabaseClient = null;
let currentUser = null;
let cloudSaveTimer = null;
let appControlsReady = false;

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
let editingEntry = null;

const studyLogActivityIds = [
  "live_lectures",
  "archived_lectures",
  "chat_sessions",
  "study_groups",
  "case_readings",
  "outline_prep",
  "essay_prep",
  "other"
];

let studyLog = createEmptyStudyLog();
let editingStudyLogEntryId = null;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  initializeSupabase();
  setupAuthControls();
  await loadData();
  setupAppControlsOnce();
  renderAll();

  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    setAuthMessage(error.message);
    showSignedOutState();
  } else if (data.session) {
    await openSignedInApp(data.session.user);
  } else {
    showSignedOutState();
  }

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || !session) {
      currentUser = null;
      showSignedOutState();
      return;
    }

    if (event === "SIGNED_IN" && session.user?.id !== currentUser?.id) {
      window.setTimeout(() => openSignedInApp(session.user), 0);
    }
  });
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
  lectures = loadLocalData("bcc_lectures", []);
  reviews = loadLocalData("bcc_reviews", await loadJson("reviews.json", []));
  sessionHistory = loadLocalData("bcc_session_history", []);
  studyLog = normalizeStudyLog(loadLocalData("bcc_study_log", createEmptyStudyLog()));

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
  saveLocalData();
  scheduleCloudSave();
}

function saveLocalData() {
  localStorage.setItem("bcc_essays", JSON.stringify(essays));
  localStorage.setItem("bcc_mcqs", JSON.stringify(mcqs));
  localStorage.setItem("bcc_flashcards", JSON.stringify(flashcards));
  localStorage.setItem("bcc_lectures", JSON.stringify(lectures));
  localStorage.setItem("bcc_reviews", JSON.stringify(reviews));
  localStorage.setItem("bcc_session_history", JSON.stringify(sessionHistory));
  localStorage.setItem("bcc_current_session", String(currentSession));
  localStorage.setItem("bcc_study_mode", currentStudyMode);
  localStorage.setItem("bcc_study_log", JSON.stringify(studyLog));
}

function getCompleteBarOSData() {
  return {
    version: 1,
    essays,
    mcqs,
    flashcards,
    lectures,
    reviews,
    sessionHistory,
    currentSession,
    currentStudyMode,
    studyLog
  };
}

function applyCompleteBarOSData(data) {
  essays = Array.isArray(data?.essays) ? data.essays : [];
  mcqs = Array.isArray(data?.mcqs) ? data.mcqs : [];
  flashcards = Array.isArray(data?.flashcards) ? data.flashcards : [];
  lectures = Array.isArray(data?.lectures) ? data.lectures : [];
  reviews = Array.isArray(data?.reviews) ? data.reviews : [];
  sessionHistory = Array.isArray(data?.sessionHistory) ? data.sessionHistory : [];
  currentSession = Number(data?.currentSession || 1);
  currentStudyMode = data?.currentStudyMode || currentStudyMode || "full";
  studyLog = normalizeStudyLog(data?.studyLog);

  if (!Number.isFinite(currentSession) || currentSession < 1) {
    currentSession = 1;
  }
}

function scheduleCloudSave() {
  if (!currentUser || !supabaseClient) return;

  setCloudStatus("Saving to cloud…", "saving");
  window.clearTimeout(cloudSaveTimer);
  cloudSaveTimer = window.setTimeout(saveCloudData, 350);
}

async function saveCloudData() {
  if (!currentUser || !supabaseClient) return;

  const payload = {
    user_id: currentUser.id,
    data: getCompleteBarOSData(),
    updated_at: new Date().toISOString()
  };

  const { error } = await supabaseClient
    .from("baros_data")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    console.error("Cloud save failed:", error);
    setCloudStatus("Saved locally · Cloud save failed", "error");
    return;
  }

  setCloudStatus(`Cloud saved ${formatTime(new Date())}`, "saved");
}

async function loadCloudData() {
  if (!currentUser || !supabaseClient) return;

  setCloudStatus("Loading cloud data…", "saving");

  const { data, error } = await supabaseClient
    .from("baros_data")
    .select("data, updated_at")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error("Cloud load failed:", error);
    setCloudStatus("Using local data · Cloud unavailable", "error");
    return;
  }

  if (data?.data) {
    applyCompleteBarOSData(data.data);
    saveLocalData();
    setCloudStatus(
      data.updated_at
        ? `Cloud loaded · Saved ${formatDateTime(data.updated_at)}`
        : "Cloud loaded",
      "saved"
    );
    return;
  }

  await saveCloudData();
}

function initializeSupabase() {
  if (!window.supabase?.createClient) {
    throw new Error("Supabase client library did not load.");
  }

  supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );
}

function setupAuthControls() {
  const authForm = document.getElementById("auth-form");
  const createAccountButton = document.getElementById("create-account-button");
  const signOutButton = document.getElementById("sign-out-button");

  if (authForm) {
    authForm.addEventListener("submit", handleSignIn);
  }

  if (createAccountButton) {
    createAccountButton.addEventListener("click", handleCreateAccount);
  }

  if (signOutButton) {
    signOutButton.addEventListener("click", handleSignOut);
  }
}

function setupAppControlsOnce() {
  if (appControlsReady) return;

  setupNavigation();
  setupViewJumpButtons();
  setupRatingDropdowns();
  populateSubjectDropdowns();
  populateSourceDropdowns();
  setupForms();
  setupSessionButton();
  setupStudyModeSelector();
  setupBackupButtons();
  setupStudyLog();

  appControlsReady = true;
}

async function handleSignIn(event) {
  event.preventDefault();

  const email = getValue("auth-email");
  const password = getValue("auth-password");

  setAuthMessage("Signing in…", false);

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    setAuthMessage(error.message);
  }
}

async function handleCreateAccount() {
  const email = getValue("auth-email");
  const password = getValue("auth-password");

  if (!email || !password) {
    setAuthMessage("Enter an email and password first.");
    return;
  }

  setAuthMessage("Creating account…", false);

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password
  });

  if (error) {
    setAuthMessage(error.message);
    return;
  }

  if (data.session) {
    setAuthMessage("Account created.", false);
  } else {
    setAuthMessage("Account created. Check your email to confirm it, then sign in.", false);
  }
}

async function handleSignOut() {
  window.clearTimeout(cloudSaveTimer);
  await saveCloudData();
  await supabaseClient.auth.signOut();
}

async function openSignedInApp(user) {
  if (!user) return;

  currentUser = user;
  setAuthMessage("", false);
  setText("signed-in-email", user.email || "");
  showSignedInState();

  await loadCloudData();
  renderAll();
}

function showSignedInState() {
  const authScreen = document.getElementById("auth-screen");
  const appShell = document.getElementById("app-shell");
  const cloudControls = document.getElementById("cloud-controls");

  if (authScreen) authScreen.hidden = true;
  if (appShell) appShell.hidden = false;
  if (cloudControls) cloudControls.hidden = false;
}

function showSignedOutState() {
  const authScreen = document.getElementById("auth-screen");
  const appShell = document.getElementById("app-shell");
  const cloudControls = document.getElementById("cloud-controls");

  if (authScreen) authScreen.hidden = false;
  if (appShell) appShell.hidden = true;
  if (cloudControls) cloudControls.hidden = true;
}

function setAuthMessage(message, isError = true) {
  const element = document.getElementById("auth-message");
  if (!element) return;

  element.textContent = message || "";
  element.style.color = isError ? "#9a1c1c" : "#555555";
}

function setCloudStatus(message, state = "") {
  const element = document.getElementById("cloud-save-status");
  if (!element) return;

  element.textContent = message;
  element.dataset.state = state;
}

function formatTime(date) {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatDateTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
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
  populateNumberDropdown("essay-rating", 1, 10);
  populateNumberDropdown("mcq-rating", 1, 10);
  populateNumberDropdown("flashcard-rating", 1, 10);
  populateNumberDropdown("lecture-rating", 1, 10);
}

function populateNumberDropdown(id, min, max) {
  const dropdown = document.getElementById(id);
  if (!dropdown) return;

  dropdown.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Rating";
  placeholder.disabled = true;
  placeholder.selected = true;
  dropdown.appendChild(placeholder);

  for (let i = min; i <= max; i++) {
    const option = document.createElement("option");
    option.value = String(i);
    option.textContent = String(i);
    dropdown.appendChild(option);
  }

  dropdown.value = "";
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

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.disabled = true;
  placeholder.selected = true;

  if (id.includes("source")) {
    placeholder.textContent = "Select Source";
  } else if (id.includes("rating")) {
    placeholder.textContent = "Rating";
  } else {
    placeholder.textContent = "Select";
  }

  dropdown.appendChild(placeholder);

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

  const essayData = {
    type: "essay",
    subject: normalizeSubjectSelection(getValue("essay-subject"), getValue("essay-source")),
    source: getValue("essay-source"),
    title: getValue("essay-title"),
    pageNumber: getValue("essay-page-number"),
    questionNumber: getValue("essay-question-number"),
    rating: Number(getValue("essay-rating")),
    notes: getValue("essay-notes")
  };

  if (editingEntry && editingEntry.type === "essay") {
    const existing = essays.find((item) => item.id === editingEntry.id);
    if (existing) {
      Object.assign(existing, essayData, {
        id: existing.id,
        completedDate: existing.completedDate,
        editedAt: new Date().toISOString()
      });
      syncReviewsForEditedItem(existing);
      finishEditing(event.target);
      return;
    }
  }

  const essay = {
    id: createId("essay"),
    ...essayData,
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

  const mcqData = {
    type: "mcq",
    subject: normalizeSubjectSelection(getValue("mcq-subject"), getValue("mcq-source")),
    source: getValue("mcq-source"),
    count,
    correctCount,
    incorrectCount,
    accuracy,
    rating: Number(getValue("mcq-rating")),
    notes: getValue("mcq-notes")
  };

  if (editingEntry && editingEntry.type === "mcq") {
    const existing = mcqs.find((item) => item.id === editingEntry.id);
    if (existing) {
      Object.assign(existing, mcqData, {
        id: existing.id,
        completedDate: existing.completedDate,
        editedAt: new Date().toISOString()
      });
      syncReviewsForEditedItem(existing);
      finishEditing(event.target);
      return;
    }
  }

  const mcq = {
    id: createId("mcq"),
    ...mcqData,
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

  const cardRange = getValue("flashcard-card-range");
  const count = getCountFromCardRange(cardRange);

  const flashcardData = {
    type: "flashcard",
    subject: normalizeSubjectSelection(getValue("flashcard-subject"), getValue("flashcard-source")),
    source: getValue("flashcard-source"),
    cardRange,
    count,
    rating: Number(getValue("flashcard-rating")),
    notes: getValue("flashcard-notes")
  };

  if (editingEntry && editingEntry.type === "flashcard") {
    const existing = flashcards.find((item) => item.id === editingEntry.id);
    if (existing) {
      Object.assign(existing, flashcardData, {
        id: existing.id,
        completedDate: existing.completedDate,
        editedAt: new Date().toISOString()
      });
      syncReviewsForEditedItem(existing);
      finishEditing(event.target);
      return;
    }
  }

  const flashcard = {
    id: createId("flashcard"),
    ...flashcardData,
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

  const lectureData = {
    type: "lecture",
    subject: getValue("lecture-subject"),
    source: "AIL",
    title: getValue("lecture-title"),
    minutes: Number(getValue("lecture-minutes")) || 0,
    rating: Number(getValue("lecture-rating")),
    notes: getValue("lecture-notes")
  };

  if (editingEntry && editingEntry.type === "lecture") {
    const existing = lectures.find((item) => item.id === editingEntry.id);
    if (existing) {
      Object.assign(existing, lectureData, {
        id: existing.id,
        completedDate: existing.completedDate,
        editedAt: new Date().toISOString()
      });
      syncReviewsForEditedItem(existing);
      finishEditing(event.target);
      return;
    }
  }

  const lecture = {
    id: createId("lecture"),
    ...lectureData,
    completedDate: todayString()
  };

  lectures.push(lecture);
  createReviewsForItem(lecture);
  saveData();
  resetForm(event.target);
  renderAll();
}


function startEditEntry(type, id) {
  const item = findItem(id, type);
  if (!item) return;

  editingEntry = { type, id };

  if (type === "essay") {
    setFormValue("essay-subject", item.subject);
    setFormValue("essay-source", item.source);
    setFormValue("essay-title", item.title);
    setFormValue("essay-page-number", item.pageNumber);
    setFormValue("essay-question-number", item.questionNumber);
    setFormValue("essay-rating", item.rating);
    setFormValue("essay-notes", item.notes);
    setSubmitButtonText("essay-form", "Save Edit");
    showEditNotice("essay-form", "Editing saved essay entry. Existing review schedule will be retained.");
    goToView("essays");
  }

  if (type === "mcq") {
    setFormValue("mcq-subject", item.subject);
    setFormValue("mcq-source", item.source);
    setFormValue("mcq-count", item.count);
    setFormValue("mcq-correct-count", item.correctCount);
    setFormValue("mcq-rating", item.rating);
    setFormValue("mcq-notes", item.notes);
    setSubmitButtonText("mcq-form", "Save Edit");
    showEditNotice("mcq-form", "Editing saved MCQ entry. Existing review schedule will be retained.");
    goToView("mcqs");
  }

  if (type === "flashcard") {
    setFormValue("flashcard-subject", item.subject);
    setFormValue("flashcard-source", item.source);
    setFormValue("flashcard-card-range", item.cardRange);
    setFormValue("flashcard-rating", item.rating);
    setFormValue("flashcard-notes", item.notes);
    setSubmitButtonText("flashcard-form", "Save Edit");
    showEditNotice("flashcard-form", "Editing saved flashcard entry. Existing review schedule will be retained.");
    goToView("flashcards");
  }

  if (type === "lecture") {
    setFormValue("lecture-subject", item.subject);
    setFormValue("lecture-title", item.title);
    setFormValue("lecture-minutes", item.minutes);
    setFormValue("lecture-rating", item.rating);
    setFormValue("lecture-notes", item.notes);
    setSubmitButtonText("lecture-form", "Save Edit");
    showEditNotice("lecture-form", "Editing saved lecture entry. Existing review schedule will be retained.");
    goToView("lectures");
  }

  const form = document.getElementById(`${type === "mcq" ? "mcq" : type}-form`);
  if (form) {
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function cancelEditEntry(form) {
  editingEntry = null;
  resetForm(form);
  renderAll();
}

function finishEditing(form) {
  saveData();
  editingEntry = null;
  resetForm(form);
  renderAll();
}

function syncReviewsForEditedItem(item) {
  reviews.forEach((review) => {
    if (review.itemId === item.id && review.itemType === item.type) {
      review.subject = item.subject;
      review.ratingAtCreation = item.rating;
    }
  });
}

function showEditNotice(formId, message) {
  const form = document.getElementById(formId);
  if (!form) return;

  let notice = form.querySelector(".bcc-edit-notice");

  if (!notice) {
    notice = document.createElement("div");
    notice.className = "bcc-edit-notice";
    notice.style.margin = "8px 0";
    notice.style.fontSize = "12px";
    notice.style.color = "#555555";
    form.prepend(notice);
  }

  notice.innerHTML = `${escapeHtml(message)} <button type="button" class="bcc-small-button" onclick="cancelEditEntry(this.closest('form'))">Cancel</button>`;
}

function clearEditNotice(form) {
  if (!form) return;
  const notice = form.querySelector(".bcc-edit-notice");
  if (notice) notice.remove();
}

function setSubmitButtonText(formId, text) {
  const form = document.getElementById(formId);
  if (!form) return;

  const button = form.querySelector('button[type="submit"]');
  if (button) button.textContent = text;
}

function resetSubmitButtonText(form) {
  if (!form) return;

  const button = form.querySelector('button[type="submit"]');
  if (!button) return;

  if (form.id === "essay-form") button.textContent = "Add Essay";
  if (form.id === "mcq-form") button.textContent = "Add MCQ Session";
  if (form.id === "flashcard-form") button.textContent = "Add Flashcard Session";
  if (form.id === "lecture-form") button.textContent = "Add Lecture Review";
}

function setFormValue(id, value) {
  const element = document.getElementById(id);
  if (!element) return;
  element.value = value ?? "";
}

function goToView(viewId) {
  if (window.activateBccView) {
    window.activateBccView(viewId);
  }
}

window.startEditEntry = startEditEntry;
window.cancelEditEntry = cancelEditEntry;


function resetForm(form) {
  form.reset();
  setupRatingDropdowns();
  populateSubjectDropdowns();
  populateSourceDropdowns();
  clearEditNotice(form);
  resetSubmitButtonText(form);
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
    currentSession,
    currentStudyMode,
    studyLog
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
      currentStudyMode = backup.currentStudyMode || currentStudyMode || "full";
      studyLog = normalizeStudyLog(backup.studyLog);

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
  renderStudyLog();
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
      <button class="bcc-small-button" type="button" onclick="startEditEntry('essay', '${escapeHtml(essay.id)}')">Edit</button>
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
      <button class="bcc-small-button" type="button" onclick="startEditEntry('mcq', '${escapeHtml(mcq.id)}')">Edit</button>
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
        ${escapeHtml(card.source || "No source")} · ${Number(card.count) || 0} cards reviewed
      </div>
      <div class="bcc-rating">Rating: ${card.rating}/10 · Next Review: ${formatDate(getNextReviewDate(card.id, "flashcard"))}</div>
      <button class="bcc-small-button" type="button" onclick="startEditEntry('flashcard', '${escapeHtml(card.id)}')">Edit</button>
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
      <button class="bcc-small-button" type="button" onclick="startEditEntry('lecture', '${escapeHtml(lecture.id)}')">Edit</button>
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
  const detail = getReviewDetailLine(item, group.itemType);

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
      <div class="bcc-item-meta">
        ${escapeHtml(getTypeLabel(group.itemType))} · ${escapeHtml(subject)}
        ${detail ? ` · ${escapeHtml(detail)}` : ""}
      </div>
      <div class="bcc-review-grid">
        ${cells}
      </div>
    </div>
  `;
}

function renderReviewItem(review) {
  const item = findItem(review.itemId, review.itemType);
  const title = getItemTitle(item, review.itemType);
  const detail = getReviewDetailLine(item, review.itemType);

  return `
    <div class="bcc-item">
      <div class="bcc-item-title">${escapeHtml(title)}</div>
      <div class="bcc-item-meta">
        ${escapeHtml(getTypeLabel(review.itemType))} · ${escapeHtml(getSubjectName(review.subject))}
        ${detail ? ` · ${escapeHtml(detail)}` : ""}
        · Review ${escapeHtml(review.reviewNumber || "")} · Due ${formatDate(review.dueDate)} · ${escapeHtml(capitalize(review.status))}
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
  const pendingReviews = reviews.filter(r => r.status === "pending").length;

  const essaysWritten = essays.length;
  const essaysReviewed = countReviewedItems("essay");

  const mcqsDone = mcqs.reduce((t,m)=>t+(Number(m.count)||0),0);
  const mcqsReviewed = reviews.filter(r=>r.itemType==="mcq" && r.status==="completed")
    .reduce((t,r)=>{
      const m = mcqs.find(x=>x.id===r.itemId);
      return t + (m ? (Number(m.count)||0) : 0);
    },0);
  const mcqsCorrect = mcqs.reduce((t,m)=>t+(Number(m.correctCount)||0),0);
  const mcqAccuracy = mcqsDone ? Math.round(mcqsCorrect/mcqsDone*100) : 0;

  const flashcardsDone = flashcards.reduce((t,f)=>t+(Number(f.count)||0),0);
  const flashcardsReviewed = reviews.filter(r=>r.itemType==="flashcard" && r.status==="completed")
    .reduce((t,r)=>{
      const f=flashcards.find(x=>x.id===r.itemId);
      return t + (f ? (Number(f.count)||0) : 0);
    },0);

  const lectureMinutesDone = lectures.reduce((t,l)=>t+(Number(l.minutes)||0),0);
  const lectureMinutesReviewed = reviews.filter(r=>r.itemType==="lecture" && r.status==="completed")
    .reduce((t,r)=>{
      const l=lectures.find(x=>x.id===r.itemId);
      return t + (l ? (Number(l.minutes)||0) : 0);
    },0);

  setText("stats-essays", essaysWritten);
  setText("stats-mcqs", mcqsDone);
  setText("stats-flashcards", flashcardsDone);
  setText("stats-lectures", lectureMinutesDone);
  setText("stats-reviews", pendingReviews);

  setText("stats-essay-sets-done", essaysWritten);
  setText("stats-essay-sets-reviewed", essaysReviewed);

  setText("stats-mcq-sets-done", mcqsDone);
  setText("stats-mcq-sets-reviewed", mcqsReviewed);

  setText("stats-flashcard-sets-done", flashcardsDone);
  setText("stats-flashcard-sets-reviewed", flashcardsReviewed);

  setText("stats-lecture-sets-done", lectureMinutesDone);
  setText("stats-lecture-sets-reviewed", lectureMinutesReviewed);

  const panel=document.getElementById("session-stats-panel");
  if(panel) panel.remove();
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
function countReviewedItems(type) {
  const reviewedItems = new Set();

  reviews.forEach((review) => {
    if (review.itemType === type && review.status === "completed") {
      reviewedItems.add(review.itemId);
    }
  });

  return reviewedItems.size;
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
  const range = card.cardRange || "";

  if (range) {
    return `${subject} · ${source} · Cards ${range}`;
  }

  return `${subject} · ${source} · Flashcard Session`;
}

function getReviewDetailLine(item, type) {
  if (!item) return "";

  if (type === "flashcard") {
    const source = item.source || "Flashcards";
    const range = item.cardRange ? `Cards ${item.cardRange}` : `${Number(item.count) || 0} cards`;
    return `${source} · ${range}`;
  }

  if (type === "mcq") {
    const source = item.source || "No source";
    const count = getMcqCountValue(item);
    return `${source} · ${count} questions`;
  }

  if (type === "essay") {
    const source = item.source || "No source";
    const page = item.pageNumber ? `Page ${item.pageNumber}` : "No page";
    const question = item.questionNumber ? `Question ${item.questionNumber}` : "No question";
    return `${source} · ${page} · ${question}`;
  }

  return "";
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
function getCountFromCardRange(range) {
  const match = String(range || "").match(/(\d+)\s*[-–]\s*(\d+)/);

  if (!match) return 0;

  const start = Number(match[1]);
  const end = Number(match[2]);

  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return 0;
  }

  return end - start + 1;
}

function createEmptyStudyLog() {
  return {
    configured: false,
    studentName: "",
    subject: "",
    startDate: "",
    numberOfWeeks: 18,
    requiredHours: 299,
    otherLabel: "Other",
    entries: []
  };
}

function normalizeStudyLog(value) {
  const base = createEmptyStudyLog();
  const source = value && typeof value === "object" ? value : {};

  return {
    configured: Boolean(source.configured),
    studentName: String(source.studentName || ""),
    subject: String(source.subject || ""),
    startDate: String(source.startDate || ""),
    numberOfWeeks: Math.max(1, Number(source.numberOfWeeks || 18)),
    requiredHours: Math.max(0, Number(source.requiredHours || 299)),
    otherLabel: String(source.otherLabel || "Other"),
    entries: Array.isArray(source.entries) ? source.entries.map(normalizeStudyLogEntry) : []
  };
}

function normalizeStudyLogEntry(entry) {
  return {
    id: String(entry?.id || createId("study_log")),
    date: String(entry?.date || ""),
    activity: studyLogActivityIds.includes(entry?.activity) ? entry.activity : "other",
    minutes: Math.max(0, Number(entry?.minutes || 0)),
    notes: String(entry?.notes || ""),
    createdAt: String(entry?.createdAt || new Date().toISOString()),
    editedAt: entry?.editedAt ? String(entry.editedAt) : ""
  };
}

function setupStudyLog() {
  const setupForm = document.getElementById("study-log-setup-form");
  const entryForm = document.getElementById("study-log-entry-form");
  const resetButton = document.getElementById("study-log-reset-button");
  const editSetupButton = document.getElementById("study-log-edit-setup-button");
  const printButton = document.getElementById("study-log-print-button");
  const cancelEntryButton = document.getElementById("study-log-entry-cancel");

  if (setupForm) setupForm.addEventListener("submit", handleStudyLogSetupSubmit);
  if (entryForm) entryForm.addEventListener("submit", handleStudyLogEntrySubmit);
  if (resetButton) resetButton.addEventListener("click", resetStudyLog);
  if (editSetupButton) editSetupButton.addEventListener("click", editStudyLogSetup);
  if (printButton) printButton.addEventListener("click", printStudyLog);
  if (cancelEntryButton) cancelEntryButton.addEventListener("click", cancelStudyLogEntryEdit);

  populateStudyLogActivityDropdown();
  setDefaultStudyLogEntryDate();
}

function populateStudyLogActivityDropdown() {
  const select = document.getElementById("study-log-entry-activity");
  if (!select) return;

  select.innerHTML = studyLogActivityIds.map((activityId) => {
    return `<option value="${escapeHtml(activityId)}">${escapeHtml(getStudyLogActivityLabel(activityId))}</option>`;
  }).join("");
}

function handleStudyLogSetupSubmit(event) {
  event.preventDefault();

  const startDate = getValue("study-log-start-date");
  const numberOfWeeks = Math.max(1, Number(getValue("study-log-weeks")) || 1);
  const requiredHours = Math.max(0, Number(getValue("study-log-required-hours")) || 0);

  if (!startDate) {
    setStudyLogMessage("Choose a start date.");
    return;
  }

  studyLog = {
    ...studyLog,
    configured: true,
    studentName: getValue("study-log-student-name"),
    subject: getValue("study-log-subject"),
    startDate,
    numberOfWeeks,
    requiredHours,
    otherLabel: getValue("study-log-other-label") || "Other",
    entries: Array.isArray(studyLog.entries) ? studyLog.entries : []
  };

  populateStudyLogActivityDropdown();
  saveData();
  renderAll();
  setStudyLogMessage("");
}

function editStudyLogSetup() {
  fillStudyLogSetupForm();
  const panel = document.getElementById("study-log-setup-panel");
  if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetStudyLog() {
  if (!studyLog.configured && studyLog.entries.length === 0) return;

  const confirmed = window.confirm(
    "Reset the entire Study Log? This will permanently remove its setup and all time entries."
  );

  if (!confirmed) return;

  studyLog = createEmptyStudyLog();
  editingStudyLogEntryId = null;
  saveData();
  fillStudyLogSetupForm();
  renderAll();
}

function fillStudyLogSetupForm() {
  setFormValue("study-log-student-name", studyLog.studentName);
  setFormValue("study-log-subject", studyLog.subject);
  setFormValue("study-log-start-date", studyLog.startDate);
  setFormValue("study-log-weeks", studyLog.numberOfWeeks || 18);
  setFormValue("study-log-required-hours", studyLog.requiredHours || 299);
  setFormValue("study-log-other-label", studyLog.otherLabel || "Other");
}

function setDefaultStudyLogEntryDate() {
  const input = document.getElementById("study-log-entry-date");
  if (!input || input.value) return;

  const today = todayString();

  if (!studyLog.configured) {
    input.value = today;
    return;
  }

  const endDate = addDays(studyLog.startDate, studyLog.numberOfWeeks * 7 - 1);

  if (today >= studyLog.startDate && today <= endDate) {
    input.value = today;
  } else {
    input.value = studyLog.startDate;
  }
}

function handleStudyLogEntrySubmit(event) {
  event.preventDefault();

  if (!studyLog.configured) {
    setStudyLogMessage("Create the Study Log setup first.");
    return;
  }

  const date = getValue("study-log-entry-date");
  const activity = getValue("study-log-entry-activity");
  const hours = Math.max(0, Number(getValue("study-log-entry-hours")) || 0);
  const minuteRemainder = Math.max(0, Math.min(59, Number(getValue("study-log-entry-minutes")) || 0));
  const totalMinutes = Math.round(hours * 60 + minuteRemainder);
  const notes = getValue("study-log-entry-notes");

  if (!date) {
    setStudyLogMessage("Choose a date.");
    return;
  }

  if (!isDateInsideStudyLog(date)) {
    const range = getStudyLogOverallRange();
    setStudyLogMessage(`Date must be within ${formatDate(range.start)} through ${formatDate(range.end)}.`);
    return;
  }

  if (totalMinutes <= 0) {
    setStudyLogMessage("Enter at least one minute.");
    return;
  }

  if (editingStudyLogEntryId) {
    const existing = studyLog.entries.find((entry) => entry.id === editingStudyLogEntryId);

    if (existing) {
      Object.assign(existing, {
        date,
        activity,
        minutes: totalMinutes,
        notes,
        editedAt: new Date().toISOString()
      });
    }
  } else {
    studyLog.entries.push({
      id: createId("study_log"),
      date,
      activity,
      minutes: totalMinutes,
      notes,
      createdAt: new Date().toISOString(),
      editedAt: ""
    });
  }

  studyLog.entries.sort((a, b) => {
    return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
  });

  editingStudyLogEntryId = null;
  saveData();
  resetStudyLogEntryForm();
  renderAll();
  setStudyLogMessage("");
}

function startStudyLogEntryEdit(entryId) {
  const entry = studyLog.entries.find((item) => item.id === entryId);
  if (!entry) return;

  editingStudyLogEntryId = entryId;

  setFormValue("study-log-entry-date", entry.date);
  setFormValue("study-log-entry-activity", entry.activity);
  setFormValue("study-log-entry-hours", Math.floor(entry.minutes / 60));
  setFormValue("study-log-entry-minutes", entry.minutes % 60);
  setFormValue("study-log-entry-notes", entry.notes);

  const submitButton = document.getElementById("study-log-entry-submit");
  const cancelButton = document.getElementById("study-log-entry-cancel");

  if (submitButton) submitButton.textContent = "Save Edit";
  if (cancelButton) cancelButton.hidden = false;

  const form = document.getElementById("study-log-entry-form");
  if (form) form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function cancelStudyLogEntryEdit() {
  editingStudyLogEntryId = null;
  resetStudyLogEntryForm();
  setStudyLogMessage("");
}

function resetStudyLogEntryForm() {
  const form = document.getElementById("study-log-entry-form");
  if (form) form.reset();

  const submitButton = document.getElementById("study-log-entry-submit");
  const cancelButton = document.getElementById("study-log-entry-cancel");

  if (submitButton) submitButton.textContent = "Save Time Entry";
  if (cancelButton) cancelButton.hidden = true;

  populateStudyLogActivityDropdown();
  setDefaultStudyLogEntryDate();
  setFormValue("study-log-entry-hours", 0);
  setFormValue("study-log-entry-minutes", 0);
}

function deleteStudyLogEntry(entryId) {
  const entry = studyLog.entries.find((item) => item.id === entryId);
  if (!entry) return;

  const confirmed = window.confirm(
    `Delete ${getStudyLogActivityLabel(entry.activity)} on ${formatDate(entry.date)}?`
  );

  if (!confirmed) return;

  studyLog.entries = studyLog.entries.filter((item) => item.id !== entryId);

  if (editingStudyLogEntryId === entryId) {
    editingStudyLogEntryId = null;
    resetStudyLogEntryForm();
  }

  saveData();
  renderAll();
}

function renderStudyLog() {
  const setupPanel = document.getElementById("study-log-setup-panel");
  const activeArea = document.getElementById("study-log-active-area");

  if (!setupPanel || !activeArea) return;

  fillStudyLogSetupForm();
  setupPanel.hidden = studyLog.configured;
  activeArea.hidden = !studyLog.configured;

  if (!studyLog.configured) return;

  const totals = calculateStudyLogTotals();
  const range = getStudyLogOverallRange();

  setText("study-log-total-hours", formatDecimalHours(totals.totalMinutes));
  setText("study-log-hours-remaining", Math.max(0, studyLog.requiredHours - totals.totalHours).toFixed(2));
  setText("study-log-completion-percent", `${totals.percentage.toFixed(2)}%`);
  setText("study-log-needed-per-week", totals.neededPerRemainingWeek.toFixed(2));

  setText("study-log-heading", `${studyLog.subject || "Study Log"} · ${studyLog.studentName || "Student"}`);
  setText(
    "study-log-period-meta",
    `${studyLog.numberOfWeeks} weeks · ${formatDate(range.start)}–${formatDate(range.end)} · ${Number(studyLog.requiredHours).toFixed(2)} required hours`
  );

  populateStudyLogActivityDropdown();
  renderStudyLogEntries();
  renderStudyLogWeeklyTotals();
  renderStudyLogActivityTotals();
  setDefaultStudyLogEntryDate();
}

function renderStudyLogEntries() {
  const list = document.getElementById("study-log-entry-list");
  if (!list) return;

  if (studyLog.entries.length === 0) {
    list.className = "bcc-list-empty";
    list.textContent = "No study time entered yet.";
    return;
  }

  list.className = "";
  list.innerHTML = studyLog.entries.slice(0, 40).map((entry) => {
    const weekNumber = getStudyLogWeekNumber(entry.date);

    return `
      <div class="bcc-item">
        <div class="bcc-item-title">
          ${escapeHtml(formatDate(entry.date))} · ${escapeHtml(getStudyLogActivityLabel(entry.activity))} · ${escapeHtml(formatMinutes(entry.minutes))}
        </div>
        <div class="bcc-item-meta">
          Week ${escapeHtml(weekNumber)}
          ${entry.notes ? ` · ${escapeHtml(entry.notes)}` : ""}
        </div>
        <div class="bcc-entry-button-row">
          <button type="button" class="bcc-small-button" onclick="startStudyLogEntryEdit('${escapeHtml(entry.id)}')">Edit</button>
          <button type="button" class="bcc-small-button" onclick="deleteStudyLogEntry('${escapeHtml(entry.id)}')">Delete</button>
        </div>
      </div>
    `;
  }).join("");
}

function renderStudyLogWeeklyTotals() {
  const body = document.getElementById("study-log-weekly-body");
  if (!body) return;

  const weeks = calculateStudyLogWeeks();

  body.innerHTML = weeks.map((week) => `
    <tr>
      <td>Week ${week.weekNumber}</td>
      <td>${escapeHtml(formatDateShort(week.startDate))}–${escapeHtml(formatDateShort(week.endDate))}</td>
      <td>${week.weekHours.toFixed(2)}</td>
      <td>${week.cumulativeHours.toFixed(2)}</td>
      <td>${week.percentage.toFixed(2)}%</td>
    </tr>
  `).join("");
}

function renderStudyLogActivityTotals() {
  const container = document.getElementById("study-log-activity-totals");
  if (!container) return;

  const activityTotals = calculateStudyLogActivityTotals();

  container.innerHTML = studyLogActivityIds.map((activityId) => `
    <div class="bcc-card">
      <div class="bcc-card-label">${escapeHtml(getStudyLogActivityLabel(activityId))}</div>
      <div class="bcc-study-log-activity-number">${activityTotals[activityId].toFixed(2)}</div>
    </div>
  `).join("");
}

function calculateStudyLogTotals() {
  const totalMinutes = studyLog.entries.reduce((total, entry) => total + Number(entry.minutes || 0), 0);
  const totalHours = totalMinutes / 60;
  const percentage = studyLog.requiredHours > 0
    ? (totalHours / studyLog.requiredHours) * 100
    : 0;

  const currentWeek = getCurrentStudyLogWeek();
  const remainingWeeks = Math.max(0, studyLog.numberOfWeeks - currentWeek + 1);
  const remainingHours = Math.max(0, studyLog.requiredHours - totalHours);
  const neededPerRemainingWeek = remainingWeeks > 0 ? remainingHours / remainingWeeks : 0;

  return {
    totalMinutes,
    totalHours,
    percentage,
    remainingWeeks,
    neededPerRemainingWeek
  };
}

function calculateStudyLogWeeks() {
  let cumulativeMinutes = 0;

  return Array.from({ length: studyLog.numberOfWeeks }, (_, index) => {
    const weekNumber = index + 1;
    const startDate = addDays(studyLog.startDate, index * 7);
    const endDate = addDays(startDate, 6);

    const weekMinutes = studyLog.entries
      .filter((entry) => entry.date >= startDate && entry.date <= endDate)
      .reduce((total, entry) => total + Number(entry.minutes || 0), 0);

    cumulativeMinutes += weekMinutes;

    const cumulativeHours = cumulativeMinutes / 60;
    const percentage = studyLog.requiredHours > 0
      ? (cumulativeHours / studyLog.requiredHours) * 100
      : 0;

    return {
      weekNumber,
      startDate,
      endDate,
      weekMinutes,
      weekHours: weekMinutes / 60,
      cumulativeMinutes,
      cumulativeHours,
      percentage
    };
  });
}

function calculateStudyLogActivityTotals() {
  const result = Object.fromEntries(studyLogActivityIds.map((id) => [id, 0]));

  studyLog.entries.forEach((entry) => {
    if (result[entry.activity] === undefined) result[entry.activity] = 0;
    result[entry.activity] += Number(entry.minutes || 0) / 60;
  });

  return result;
}

function getStudyLogActivityLabel(activityId) {
  const labels = {
    live_lectures: "Live Lectures",
    archived_lectures: "Archived Lectures",
    chat_sessions: "Chat Sessions",
    study_groups: "Study Groups",
    case_readings: "Case Readings",
    outline_prep: "Outline Prep",
    essay_prep: "Essay Prep",
    other: studyLog.otherLabel || "Other"
  };

  return labels[activityId] || activityId;
}

function getStudyLogOverallRange() {
  const start = studyLog.startDate;
  const end = start ? addDays(start, studyLog.numberOfWeeks * 7 - 1) : "";

  return { start, end };
}

function isDateInsideStudyLog(date) {
  const range = getStudyLogOverallRange();
  return Boolean(range.start && range.end && date >= range.start && date <= range.end);
}

function getStudyLogWeekNumber(date) {
  if (!studyLog.startDate || !date) return "";

  const start = new Date(`${studyLog.startDate}T00:00:00`);
  const target = new Date(`${date}T00:00:00`);
  const difference = Math.floor((target - start) / 86400000);

  return Math.floor(difference / 7) + 1;
}

function getCurrentStudyLogWeek() {
  if (!studyLog.configured) return 1;

  const today = todayString();

  if (today <= studyLog.startDate) return 1;

  const range = getStudyLogOverallRange();

  if (today > range.end) return studyLog.numberOfWeeks;

  return Math.min(studyLog.numberOfWeeks, Math.max(1, getStudyLogWeekNumber(today)));
}

function setStudyLogMessage(message) {
  const element = document.getElementById("study-log-entry-message");
  if (!element) return;
  element.textContent = message || "";
}

function formatMinutes(minutes) {
  const safeMinutes = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;

  return `${hours}:${String(remainder).padStart(2, "0")}`;
}

function formatDecimalHours(minutes) {
  return (Math.max(0, Number(minutes) || 0) / 60).toFixed(2);
}

function formatDateShort(dateString) {
  if (!dateString) return "";

  const date = new Date(`${dateString}T00:00:00`);

  return date.toLocaleDateString(undefined, {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit"
  });
}

function printStudyLog() {
  if (!studyLog.configured) return;

  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    setStudyLogMessage("Allow pop-ups to download or print the Study Log.");
    return;
  }

  const weeks = calculateStudyLogWeeks();
  const totals = calculateStudyLogTotals();
  const activityLabels = studyLogActivityIds.map((id) => ({
    id,
    label: getStudyLogActivityLabel(id)
  }));

  const weekSections = weeks.map((week) => {
    const dates = Array.from({ length: 7 }, (_, dayIndex) => addDays(week.startDate, dayIndex));

    const activityRows = activityLabels.map(({ id, label }) => {
      const dailyCells = dates.map((date) => {
        const minutes = studyLog.entries
          .filter((entry) => entry.date === date && entry.activity === id)
          .reduce((sum, entry) => sum + Number(entry.minutes || 0), 0);

        return `<td>${escapeHtml(formatMinutes(minutes))}</td>`;
      }).join("");

      const rowMinutes = studyLog.entries
        .filter((entry) => entry.date >= week.startDate && entry.date <= week.endDate && entry.activity === id)
        .reduce((sum, entry) => sum + Number(entry.minutes || 0), 0);

      return `
        <tr>
          <th>${escapeHtml(label)}</th>
          ${dailyCells}
          <td>${formatDecimalHours(rowMinutes)}</td>
        </tr>
      `;
    }).join("");

    return `
      <section class="week">
        <table>
          <thead>
            <tr class="week-summary">
              <th colspan="3">Week ${week.weekNumber}</th>
              <th colspan="3">${escapeHtml(formatDateShort(week.startDate))}–${escapeHtml(formatDateShort(week.endDate))}</th>
              <th>Total Hrs / Wk</th>
              <th>Total Hours</th>
              <th>Total %</th>
            </tr>
            <tr class="week-summary-values">
              <th colspan="6"></th>
              <td>${week.weekHours.toFixed(2)}</td>
              <td>${week.cumulativeHours.toFixed(2)}</td>
              <td>${week.percentage.toFixed(2)}%</td>
            </tr>
            <tr>
              <th>Activity</th>
              <th>Sun</th>
              <th>Mon</th>
              <th>Tue</th>
              <th>Wed</th>
              <th>Thu</th>
              <th>Fri</th>
              <th>Sat</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>${activityRows}</tbody>
        </table>
      </section>
    `;
  }).join("");

  const range = getStudyLogOverallRange();

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(studyLog.subject)} Study Log</title>
  <style>
    @page { size: letter portrait; margin: 0.35in; }
    body { font-family: Arial, sans-serif; color: #111; margin: 0; font-size: 10px; }
    header { border: 2px solid #111; padding: 8px; margin-bottom: 8px; }
    h1 { font-size: 21px; text-align: center; margin: 0 0 8px; }
    .summary { display: grid; grid-template-columns: 2fr 1fr 1fr; border-top: 1px solid #111; }
    .summary > div { padding: 6px; border-right: 1px solid #111; }
    .summary > div:last-child { border-right: none; }
    .week { break-inside: avoid; margin-bottom: 9px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #222; padding: 3px 2px; text-align: center; }
    tbody th { text-align: right; width: 24%; }
    .week-summary th { background: #9fd4e4; font-size: 11px; }
    .week-summary-values td { font-weight: bold; }
    .certification { break-inside: avoid; border: 1px solid #111; padding: 10px; margin-top: 12px; font-size: 10px; line-height: 1.35; }
    .signature { margin-top: 25px; display: grid; grid-template-columns: 1fr 220px; gap: 25px; }
    .line { border-bottom: 1px solid #111; height: 18px; }
    .print-controls { margin-bottom: 12px; text-align: right; }
    .print-controls button { padding: 8px 14px; }
    @media print { .print-controls { display: none; } }
  </style>
</head>
<body>
  <div class="print-controls"><button onclick="window.print()">Print / Save as PDF</button></div>

  <header>
    <h1>Student Study Log</h1>
    <div class="summary">
      <div><strong>${escapeHtml(studyLog.studentName)}</strong><br>${escapeHtml(studyLog.subject)}</div>
      <div><strong>${studyLog.numberOfWeeks} Weeks</strong><br>${escapeHtml(formatDateShort(range.start))}–${escapeHtml(formatDateShort(range.end))}</div>
      <div><strong>${Number(studyLog.requiredHours).toFixed(2)} Required Hours</strong><br>${totals.totalHours.toFixed(2)} Hours · ${totals.percentage.toFixed(2)}%</div>
    </div>
  </header>

  ${weekSections}

  <div class="certification">
    <h2>Electronic Signature Agreement and Certification</h2>
    <p>
      By signing this Study Log electronically, the student certifies that the information provided is true,
      correct, and an accurate accounting of the study activities recorded for this course period.
    </p>
    <div class="signature">
      <div>Signature<div class="line"></div></div>
      <div>Date<div class="line"></div></div>
    </div>
  </div>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
}

window.startStudyLogEntryEdit = startStudyLogEntryEdit;
window.deleteStudyLogEntry = deleteStudyLogEntry;

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
