console.log("FLASHCARDS+");

// ========================================
// Supabase
// ========================================

const SUPABASE_URL =
    "https://rudhrifkjhretilqdncy.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "YOUR_PUBLISHABLE_KEY";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

// ========================================
// Application State
// ========================================

let currentUser = null;

let flashcards = [];

let editingCardId = null;

let currentCardIndex = 0;

// ========================================
// Initialize Supabase
// ========================================

async function initializeSupabase() {

    const { data, error } =
        await supabaseClient.auth.getSession();

    if (error) {

        console.error(error);

        return false;

    }

    currentUser = data.session?.user ?? null;

    console.log("Current User:", currentUser);

    if (!currentUser) {

        console.log("No authenticated user.");

        return false;

    }

    return true;

}

// ========================================
// Startup
// ========================================

document.addEventListener("DOMContentLoaded", async () => {

    const authenticated =
        await initializeSupabase();

    if (!authenticated) {

        return;

    }

    console.log("Flashcards+ Ready");

    // loadCards();
    // initializeTabs();
    // initializeStudy();
    // initializeBrowse();

});
