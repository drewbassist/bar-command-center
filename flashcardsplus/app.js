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
let editingCardId = null;
let currentCardIndex = 0;

async function initializeSupabase() {

    const { data, error } =
        await supabaseClient.auth.getSession();

    if (error) {
        console.error(error);
        return;
    }

    currentUser = data.session?.user ?? null;

    console.log("Current User:", currentUser);

}   // <-- initializeSupabase ENDS HERE


// =========================
// Load Cards
// =========================

async function loadCards() {

    if (!currentUser) return;

    const { data, error } = await supabaseClient
        .from("flashcards_plus")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    flashcards = data || [];

    console.log("Flashcards:", flashcards);
    renderCards();

}
function renderCards() {

    const browseView = document.getElementById("browse-view");

    if (!browseView) return;

    if (flashcards.length === 0) {

        browseView.innerHTML = `
            <h2>Browse</h2>
            <p>No flashcards yet.</p>
        `;

        return;

    }

    let html = "<h2>Browse</h2>";

    flashcards.forEach(card => {

        html += `
            <div style="border:1px solid #ddd;padding:16px;margin-bottom:16px;border-radius:8px;">

                <strong>${card.subject}</strong><br><br>

                <strong>Question:</strong><br>
                ${card.question}<br><br>

                <strong>Answer:</strong><br>
                ${card.answer}<br><br>

                <button onclick="editCard('${card.id}')">
    Edit
</button>

            </div>
        `;

    });

    browseView.innerHTML = html;

}

97 // =========================
98 // Display Study Card
99 // =========================

100 function displayStudyCard() {

    if (flashcards.length === 0) return;

    const card = flashcards[currentCardIndex];

    document.querySelector(".study-header span:first-child").textContent =
        card.subject;

    document.querySelector(".study-header span:last-child").textContent =
        `Card ${currentCardIndex + 1} of ${flashcards.length}`;

    document.getElementById("question").textContent =
        card.question;

    document.querySelector("#answer p").textContent =
        card.answer || "";

    document.querySelector("#rule p").textContent =
        card.rule || "";

    document.querySelector("#notes p").textContent =
        card.notes || "";

    document.getElementById("answer").hidden = true;
    document.getElementById("rule").hidden = true;
    document.getElementById("notes").hidden = true;

    document.getElementById("show-answer").hidden = false;
    document.getElementById("show-rule").hidden = true;
    document.getElementById("show-notes").hidden = true;

    document.querySelector(".rating").hidden = true;

}

// =========================
// Edit Card
// =========================

function editCard(id) {

    const card = flashcards.find(c => c.id === id);

    if (!card) return;

    editingCardId = id;

    document.getElementById("fc-subject").value = card.subject || "";
    document.getElementById("fc-question").value = card.question || "";
    document.getElementById("fc-answer").value = card.answer || "";
    document.getElementById("fc-rule").value = card.rule || "";
    document.getElementById("fc-notes").value = card.notes || "";

    document.getElementById("tab-new").click();

    document.getElementById("save-message").textContent =
        "Editing existing flashcard.";

}
document.addEventListener("DOMContentLoaded", async () => {

    await initializeSupabase();
await loadCards();
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
    const studySubject = document.getElementById("study-subject");
const beginStudyButton = document.getElementById("begin-study");
const studyCount = document.getElementById("study-count");

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

// =========================
// Tab navigation events
// =========================

if (tabStudy) {

    tabStudy.addEventListener("click", () => {

        showView("study");

    });

}

if (tabBrowse) {

    tabBrowse.addEventListener("click", async () => {

        await loadCards();

        showView("browse");

    });

}

if (tabNew) {

    tabNew.addEventListener("click", () => {

        showView("new");

    });

}


// =========================
// Begin Study
// =========================

if (beginStudyButton) {

    beginStudyButton.addEventListener("click", async () => {

        const subject = studySubject.value;

        if (!subject) {

            studyCount.textContent =
                "Please choose a subject.";

            return;

        }

        const { data, error } =
            await supabaseClient
                .from("flashcards_plus")
                .select("*")
                .eq("user_id", currentUser.id)
                .eq("subject", subject);

        if (error) {

            console.error(error);

            studyCount.textContent =
                "Unable to load cards.";

            return;

        }

        flashcards = data || [];

currentCardIndex = 0;

displayStudyCard();
        document.getElementById("study-screen").style.display = "block";

showView("study");

    });

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

            let error;

if (editingCardId) {

    ({ error } = await supabaseClient
        .from("flashcards_plus")
        .update({

            subject: card.subject,
            question: card.question,
            answer: card.answer,
            rule: card.rule,
            notes: card.notes

        })
        .eq("id", editingCardId)
        .eq("user_id", currentUser.id));

} else {

    ({ error } = await supabaseClient
        .from("flashcards_plus")
        .insert({

            user_id: currentUser.id,

            subject: card.subject,
            question: card.question,
            answer: card.answer,
            rule: card.rule,
            notes: card.notes

        }));

}

            

if (error) {

    console.error(error);

    if (saveMessage) {

        saveMessage.textContent =
            "Save failed.";

    }

} else {

    if (saveMessage) {

        saveMessage.textContent =
            editingCardId
                ? "Flashcard updated."
                : "Flashcard saved.";

        await loadCards();

        editingCardId = null;

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
