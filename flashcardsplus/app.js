console.log("FLASHCARDS APP VERSION 2");
// =========================
// Supabase
// =========================

const SUPABASE_URL =
    "https://rudhrifkjhretilqdncy.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_TGTjuqPmo8AOx_P2OpxnOw_NGT-1Z9l";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

let currentUser = null;
let flashcards = [];

async function initializeSupabase() {

    const { data, error } =
        await supabaseClient.auth.getSession();

    if (error) {

        console.error(error);
        return;

    }

    currentUser = data.session?.user ?? null;

    console.log("Current User:", currentUser);

}document.addEventListener("DOMContentLoaded", async () => {

    await initializeSupabase();
    // =========================
    // DOM references
    // =========================

    const studyView = document.querySelector(".study");
    const browseView = document.getElementById("browse-view");
    const newView = document.getElementById("new-view");

    const tabStudy = document.getElementById("tab-study");
    const tabBrowse = document.getElementById("tab-browse");
    const tabNew = document.getElementById("tab-new");

    const answer = document.getElementById("answer");
    const rule = document.getElementById("rule");
    const notes = document.getElementById("notes");

    const showAnswerButton = document.getElementById("show-answer");
    const showRuleButton = document.getElementById("show-rule");
    const showNotesButton = document.getElementById("show-notes");

    const rating = document.querySelector(".rating");

    const subjectInput = document.getElementById("fc-subject");
    const questionInput = document.getElementById("fc-question");
    const answerInput = document.getElementById("fc-answer");
    const ruleInput = document.getElementById("fc-rule");
    const notesInput = document.getElementById("fc-notes");

    const saveCardButton = document.getElementById("save-card");
    const saveMessage = document.getElementById("save-message");

    // =========================
    // Progressive reveal
    // =========================

    if (showAnswerButton && answer && showRuleButton) {
        showAnswerButton.addEventListener("click", () => {
            answer.hidden = false;
            showAnswerButton.hidden = true;
            showRuleButton.hidden = false;
        });
    }

    if (showRuleButton && rule && showNotesButton) {
        showRuleButton.addEventListener("click", () => {
            rule.hidden = false;
            showRuleButton.hidden = true;
            showNotesButton.hidden = false;
        });
    }

    if (showNotesButton && notes) {
        showNotesButton.addEventListener("click", () => {
            notes.hidden = false;
            showNotesButton.hidden = true;

            if (rating) {
                rating.hidden = false;
            }
        });
    }

    // =========================
    // Tab navigation
    // =========================

    function showView(view) {
        if (studyView) {
            studyView.style.display = view === "study" ? "flex" : "none";
        }

        if (browseView) {
            browseView.style.display = view === "browse" ? "block" : "none";
        }

        if (newView) {
            newView.style.display = view === "new" ? "block" : "none";
        }

        if (tabStudy) {
            tabStudy.classList.toggle("active", view === "study");
        }

        if (tabBrowse) {
            tabBrowse.classList.toggle("active", view === "browse");
        }

        if (tabNew) {
            tabNew.classList.toggle("active", view === "new");
        }
    }

    if (tabStudy) {
        tabStudy.addEventListener("click", () => showView("study"));
    }

    if (tabBrowse) {
        tabBrowse.addEventListener("click", () => showView("browse"));
    }

    if (tabNew) {
        tabNew.addEventListener("click", () => showView("new"));
    }

    // =========================
    // Save new card locally
    // =========================

    if (saveCardButton) {
        saveCardButton.addEventListener("click", async () => {
            const card = {
                subject: subjectInput?.value.trim() || "",
                question: questionInput?.value.trim() || "",
                answer: answerInput?.value.trim() || "",
                rule: ruleInput?.value.trim() || "",
                notes: notesInput?.value.trim() || ""
            };

            if (!card.subject || !card.question || !card.answer) {
                if (saveMessage) {
                    saveMessage.textContent =
                        "Enter a subject, question, and answer.";
                }

                return;
            }

            const { error } =
    await supabaseClient
        .from("flashcards_plus")
        .insert({

            user_id: currentUser.id,

            subject: card.subject,
            question: card.question,
            answer: card.answer,
            rule: card.rule,
            notes: card.notes

        });

if (error) {

    console.error(error);

    if (saveMessage) {

        saveMessage.textContent =
            "Save failed.";

    }

} else {

    if (saveMessage) {

        saveMessage.textContent =
            "Flashcard saved.";

    }

}

            if (subjectInput) subjectInput.value = "";
            if (questionInput) questionInput.value = "";
            if (answerInput) answerInput.value = "";
            if (ruleInput) ruleInput.value = "";
            if (notesInput) notesInput.value = "";
        });
    }

    showView("study");
});
