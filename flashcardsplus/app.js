document.addEventListener("DOMContentLoaded", () => {

    // -------------------------
    // Progressive Reveal
    // -------------------------

    const answer = document.getElementById("answer");
    const rule = document.getElementById("rule");
    const notes = document.getElementById("notes");

    const showAnswer = document.getElementById("show-answer");
    const showRule = document.getElementById("show-rule");
    const showNotes = document.getElementById("show-notes");

    const rating = document.querySelector(".rating");

    if (showAnswer) {

        showAnswer.addEventListener("click", () => {

            answer.hidden = false;

            showAnswer.hidden = true;
            showRule.hidden = false;

        });

    }

    if (showRule) {

        showRule.addEventListener("click", () => {

            rule.hidden = false;

            showRule.hidden = true;
            showNotes.hidden = false;

        });

    }

    if (showNotes) {

        showNotes.addEventListener("click", () => {

            notes.hidden = false;

            showNotes.hidden = true;

            rating.hidden = false;

        });

    }

});


const studyView=document.querySelector(".study");
const browseView=document.getElementById("browse-view");
const newView=document.getElementById("new-view");
function show(view){
 studyView.style.display=view==="study"?"flex":"none";
 browseView.style.display=view==="browse"?"block":"none";
 newView.style.display=view==="new"?"block":"none";
 document.getElementById("tab-study").classList.toggle("active",view==="study");
 document.getElementById("tab-browse").classList.toggle("active",view==="browse");
 document.getElementById("tab-new").classList.toggle("active",view==="new");
}
document.getElementById("tab-study").onclick=()=>show("study");
document.getElementById("tab-browse").onclick=()=>show("browse");
document.getElementById("tab-new").onclick=()=>show("new");
document.getElementById("save-card").onclick=()=>{
 const card={
 subject:fc-subject.value,
 question:fc-question.value,
 answer:fc-answer.value,
 rule:fc-rule.value,
 notes:fc-notes.value
 };
 localStorage.setItem("flashcardplus_last",JSON.stringify(card));
 document.getElementById("save-message").textContent="Sample card saved locally.";
};
