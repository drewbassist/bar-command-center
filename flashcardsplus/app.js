console.log("FLASHCARDS+");

const SUPABASE_URL="https://rudhrifkjhretilqdncy.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_TGTjuqPmo8AOx_P2OpxnOw_NGT-1Z9l";

const supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);

const $=id=>document.getElementById(id);

let currentUser=null;
let flashcards=[];
let editingCardId=null;

let studyCards=[];
let studyIndex=0;

// ---------- Auth ----------
async function initializeSupabase(){
 const {data,error}=await supabaseClient.auth.getSession();
 if(error){console.error(error);return false;}
 currentUser=data.session?.user??null;
 return !!currentUser;
}

// ---------- Tabs ----------
function showView(view){
 $("review-view").style.display=view==="review"?"block":"none";
 $("manage-view").style.display=view==="manage"?"block":"none";
 $("tab-review").classList.toggle("active",view==="review");
 $("tab-manage").classList.toggle("active",view==="manage");
}

// ---------- Data ----------
async function loadCards(){
 const {data,error}=await supabaseClient
 .from("flashcards_plus")
 .select("*")
 .eq("user_id",currentUser.id)
 .order("subject").order("subsubject").order("question");

 if(error){console.error(error);return;}
 flashcards=data||[];
 renderCardList();
 populateReviewFilters();
}

function renderCardList(){
 const list=$("card-list");
 if(!list)return;
 list.innerHTML=flashcards.map(c=>`
 <div class="card-row">
 <strong>${c.subject}</strong><br>
 ${c.subsubject||""}<br>
 <button class="edit-card" data-id="${c.id}">${c.question}</button>
 </div>`).join("");

 document.querySelectorAll(".edit-card").forEach(b=>{
  b.onclick=()=>{editCard(b.dataset.id);showView("manage");};
 });
}

function populateReviewFilters() {

    const subj = $("review-subject");
    const sub = $("review-subsubject");

    if (!subj || !sub) return;

    const SUBJECTS = [
        "Civil Procedure",
        "Constitutional Law",
        "Contracts / Sales",
        "Criminal Law and Procedure",
        "Evidence",
        "Real Property",
        "Torts",
        "Business Associations",
        "Community Property",
        "Professional Responsibility",
        "Remedies",
        "Trusts",
        "Wills and Succession"
    ];

    subj.innerHTML =
        '<option value="">Select Subject</option>' +
        SUBJECTS.map(subject =>
            `<option value="${subject}">${subject}</option>`
        ).join("");

    subj.onchange = () => {

        const selectedSubject = subj.value;

        const subsubjects = [
            ...new Set(
                flashcards
                    .filter(card => card.subject === selectedSubject)
                    .map(card => card.subsubject)
                    .filter(Boolean)
            )
        ].sort();

        sub.innerHTML =
            '<option value="">All Subsubjects</option>' +
            subsubjects.map(name =>
                `<option value="${name}">${name}</option>`
            ).join("");

    };

}

// ---------- Review ----------
const REVIEW_POSITION_KEY="flashcardsPlusReviewPosition";

function getReviewKey(){
 const s=$("review-subject").value;
 const ss=$("review-subsubject").value||"ALL";
 return `${s}::${ss}`;
}

function getSavedReviewPositions(){
 try{return JSON.parse(localStorage.getItem(REVIEW_POSITION_KEY)||"{}");}
 catch{return {};}
}

function saveReviewPosition(){
 if(!studyCards.length)return;
 const positions=getSavedReviewPositions();
 positions[getReviewKey()]=studyIndex;
 localStorage.setItem(REVIEW_POSITION_KEY,JSON.stringify(positions));
}

function beginReview(forceStart=false){
 const s=$("review-subject").value;
 const ss=$("review-subsubject").value;
 if(!s){
  studyCards=[];
  studyIndex=0;
  $("study-progress").textContent="Select a subject to begin.";
  $("study-question").textContent="";
  $("study-answer").hidden=true;
  return;
 }
 studyCards=flashcards.filter(c=>c.subject===s && (!ss||c.subsubject===ss));

 if(!studyCards.length){
  studyIndex=0;
  displayCard();
  return;
 }

 if(forceStart){
  studyIndex=0;
 }else{
  const saved=getSavedReviewPositions()[getReviewKey()];
  studyIndex=Number.isInteger(saved)?Math.min(saved,studyCards.length-1):0;
 }
 displayCard();
 saveReviewPosition();
}

function displayCard(){
 const progress=$("study-progress");
 if(!studyCards.length){
  progress.textContent="0 of 0";
  $("study-question").textContent="No flashcards found.";
  $("study-answer").hidden=true;
  $("previous-card").disabled=true;
  $("next-card").disabled=true;
  return;
 }
 const c=studyCards[studyIndex];
 progress.textContent=`Card ${studyIndex+1} of ${studyCards.length}`;
 $("study-question").textContent=c.question;
 $("study-answer").hidden=true;
 $("study-answer").querySelector("p").textContent=c.answer;
 $("previous-card").disabled=false;
 $("next-card").disabled=false;
}

function editCard(id){
 const c=flashcards.find(x=>String(x.id)===String(id));
 if(!c)return;
 editingCardId=c.id;
 $("editor-title").textContent="Edit Flashcard";
 $("fc-subject").value=c.subject;
 $("fc-subsubject").value=c.subsubject||"";
 $("fc-question").value=c.question;
 $("fc-answer").value=c.answer;
}

async function saveCard(){
 const record={
  subject:$("fc-subject").value.trim(),
  subsubject:$("fc-subsubject").value.trim(),
  question:$("fc-question").value.trim(),
  answer:$("fc-answer").value.trim()
 };
 if(!record.subject||!record.question||!record.answer){
  $("save-message").textContent="Subject, Question and Answer are required.";
  return;
 }
 let response;
 if(editingCardId){
  response=await supabaseClient.from("flashcards_plus").update(record).eq("id",editingCardId).eq("user_id",currentUser.id);
 }else{
  response=await supabaseClient.from("flashcards_plus").insert({user_id:currentUser.id,...record});
 }
 if(response.error){
  $("save-message").textContent=response.error.message;
  return;
 }
 editingCardId=null;
 $("save-message").textContent="Saved.";
 ["fc-subject","fc-subsubject","fc-question","fc-answer"].forEach(id=>$(id).value="");
 await loadCards();
}

document.addEventListener("DOMContentLoaded",async()=>{
 const beginBtn=$("begin-review");
 const showBtn=$("show-answer");
 const prevBtn=$("previous-card");
 const nextBtn=$("next-card");
 const restartBtn=$("restart-review");

 // Bind review controls immediately so the UI never appears dead.
 beginBtn.addEventListener("click",()=>beginReview(false));
 showBtn.addEventListener("click",()=>{
  if(studyCards.length) $("study-answer").hidden=false;
 });
 prevBtn.addEventListener("click",()=>{
  if(!studyCards.length)return;
  studyIndex=(studyIndex-1+studyCards.length)%studyCards.length;
  displayCard();
  saveReviewPosition();
 });
 nextBtn.addEventListener("click",()=>{
  if(!studyCards.length)return;
  studyIndex=(studyIndex+1)%studyCards.length;
  displayCard();
  saveReviewPosition();
 });
 restartBtn.addEventListener("click",()=>beginReview(true));
 $("tab-review").addEventListener("click",()=>showView("review"));
 $("tab-manage").addEventListener("click",()=>showView("manage"));
 $("save-card").addEventListener("click",saveCard);

 showView("review");

 const authed=await initializeSupabase();
 if(!authed){
  $("study-progress").textContent="Please sign in to BarOS to load flashcards.";
  return;
 }
 await loadCards();
});
