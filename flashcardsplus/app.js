console.log("FLASHCARDS+");

// =========================
// Supabase
// =========================

const SUPABASE_URL = "https://rudhrifkjhretilqdncy.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_TGTjuqPmo8AOx_P2OpxnOw_NGT-1Z9l";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

let currentUser = null;
let flashcards = [];
let editingCardId = null;

// =========================
// Auth
// =========================

async function initializeSupabase() {

    const { data, error } =
        await supabaseClient.auth.getSession();

    if (error) return console.error(error);

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

    if (error) return console.error(error);

    flashcards = data || [];

    renderCardList();
}

// =========================
// Card List
// =========================

function renderCardList() {

    const list = document.getElementById("card-list");
    if (!list) return;

    if (!flashcards.length) {
        list.innerHTML = "<p>No flashcards.</p>";
        return;
    }

    list.innerHTML = flashcards.map(card => `
        <div class="card-row">
            <button class="edit-card" data-id="${card.id}">
                <strong>${card.subject}</strong><br>
                ${card.subsubject || ""}<br>
                ${card.question}
            </button>
        </div>
    `).join("");

    document.querySelectorAll(".edit-card").forEach(button => {
        button.addEventListener("click", () => {
            editCard(button.dataset.id);
        });
    });
}

// =========================
// New Card
// =========================

function newCard() {

    editingCardId = null;

    document.getElementById("fc-subject").value = "";
    document.getElementById("fc-subsubject").value = "";
    document.getElementById("fc-question").value = "";
    document.getElementById("fc-answer").value = "";
    document.getElementById("save-message").textContent = "";
}

// =========================
// Edit Card
// =========================

function editCard(id) {

    const card = flashcards.find(c => c.id == id);
    if (!card) return;

    editingCardId = id;

    fc_subject.value = card.subject;
    fc_subsubject.value = card.subsubject || "";
    fc_question.value = card.question;
    fc_answer.value = card.answer;
}

// =========================
// Save Card
// =========================

async function saveCard() {

    const card = {
        subject: fc_subject.value.trim(),
        subsubject: fc_subsubject.value.trim(),
        question: fc_question.value.trim(),
        answer: fc_answer.value.trim()
    };

    if (!card.subject || !card.question || !card.answer) {
        save_message.textContent = "Subject, Question and Answer required.";
        return;
    }

    let query = supabaseClient.from("flashcards_plus");

    const result = editingCardId
        ? await query.update(card)
            .eq("id", editingCardId)
            .eq("user_id", currentUser.id)
        : await query.insert({
            user_id: currentUser.id,
            ...card
        });

    if (result.error) {
        console.error(result.error);
        save_message.textContent = "Save failed.";
        return;
    }

    save_message.textContent = editingCardId
        ? "Flashcard updated."
        : "Flashcard saved.";

    newCard();
    loadCards();
}

// =========================
// Startup
// =========================

document.addEventListener("DOMContentLoaded", async () => {

    window.fc_subject = document.getElementById("fc-subject");
    window.fc_subsubject = document.getElementById("fc-subsubject");
    window.fc_question = document.getElementById("fc-question");
    window.fc_answer = document.getElementById("fc-answer");
    window.save_message = document.getElementById("save-message");

    if (!(await initializeSupabase())) return;

    document.getElementById("save-card")
        .addEventListener("click", saveCard);

    document.getElementById("tab-new")
        .addEventListener("click", newCard);

    loadCards();

});
