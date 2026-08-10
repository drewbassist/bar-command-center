console.log("FLASHCARDS+");

// =========================
// Supabase
// =========================

const SUPABASE_URL = "https://rudhrifkjhretilqdncy.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_TGTjuqPmo8AOx_P2OpxnOw_NGT-1Z9l";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

let currentUser = null;
let flashcards = [];
let editingCardId = null;

const $ = id => document.getElementById(id);

// =========================
// Authentication
// =========================

async function initializeSupabase() {

    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
        console.error(error);
        return false;
    }

    currentUser = data.session?.user ?? null;

    if (!currentUser) {
        console.log("No authenticated user.");
        return false;
    }

    return true;

}

// =========================
// Load Cards
// =========================

async function loadCards() {

    const { data, error } = await supabaseClient
        .from("flashcards_plus")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("subject")
        .order("subsubject")
        .order("question");

    if (error) {
        console.error(error);
        return;
    }

    flashcards = data || [];

    renderCardList();

}

// =========================
// Card List
// =========================

function renderCardList() {

    const list = $("card-list");

    if (!list) return;

    if (!flashcards.length) {
        list.innerHTML = "<p>No flashcards yet.</p>";
        return;
    }

    list.innerHTML = flashcards.map(card => `
        <div class="card-row">
            <strong>${card.subject}</strong><br>
            ${card.subsubject || ""}<br>
            <button class="edit-card" data-id="${card.id}">
                ${card.question}
            </button>
        </div>
    `).join("");

    document.querySelectorAll(".edit-card").forEach(button => {
        button.addEventListener("click", () => editCard(button.dataset.id));
    });

}

// =========================
// Editor
// =========================

function clearEditor() {

    editingCardId = null;

    $("fc-subject").value = "";
    $("fc-subsubject").value = "";
    $("fc-question").value = "";
    $("fc-answer").value = "";
    $("save-message").textContent = "";

}

function editCard(id) {

    const card = flashcards.find(c => String(c.id) === String(id));

    if (!card) return;

    editingCardId = card.id;

    $("fc-subject").value = card.subject;
    $("fc-subsubject").value = card.subsubject || "";
    $("fc-question").value = card.question;
    $("fc-answer").value = card.answer;

    $("editor-title").textContent = "Edit Flashcard";

    window.scrollTo({top:0,behavior:"smooth"});

}

// =========================
// Save
// =========================

async function saveCard() {

    const record = {
        subject: $("fc-subject").value.trim(),
        subsubject: $("fc-subsubject").value.trim(),
        question: $("fc-question").value.trim(),
        answer: $("fc-answer").value.trim()
    };

    if (!record.subject || !record.question || !record.answer) {
        $("save-message").textContent =
            "Subject, Question and Answer are required.";
        return;
    }

    let response;

    if (editingCardId) {

        response = await supabaseClient
            .from("flashcards_plus")
            .update(record)
            .eq("id", editingCardId)
            .eq("user_id", currentUser.id);

    } else {

        response = await supabaseClient
            .from("flashcards_plus")
            .insert({
                user_id: currentUser.id,
                ...record
            });

    }

    if (response.error) {

    console.error(response.error);

    $("save-message").textContent =
        response.error.message;

    return;

}

    $("save-message").textContent =
        editingCardId ? "Flashcard updated." : "Flashcard saved.";

    $("editor-title").textContent = "Flashcard Editor";

    clearEditor();

    await loadCards();

}

// =========================
// Startup
// =========================

document.addEventListener("DOMContentLoaded", async () => {

    if (!(await initializeSupabase())) return;

    $("save-card").addEventListener("click", saveCard);

    clearEditor();

    await loadCards();

});
