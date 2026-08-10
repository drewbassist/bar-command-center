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

function populateReviewFilters(){
 const subj=$("review-subject");
 const sub=$("review-subsubject");
 if(!subj||!sub)return;

 const subjects=[...new Set(flashcards.map(c=>c.subject))];
 subj.innerHTML='<option value="">Select Subject</option>'+subjects.map(s=>`<option>${s}</option>`).join("");

 subj.onchange=()=>{
   const vals=[...new Set(flashcards.filter(c=>c.subject===subj.value).map(c=>c.subsubject).filter(Boolean))];
   sub.innerHTML='<option value="">All Subsubjects</option>'+vals.map(v=>`<option>${v}</option>`).join("");
 };
}

// ---------- Review ----------
function beginReview(){
 const s=$("review-subject").value;
 const ss=$("review-subsubject").value;
 studyCards=flashcards.filter(c=>c.subject===s && (!ss||c.subsubject===ss));
 studyIndex=0;
 displayCard();
}

function displayCard(){
 if(!studyCards.length){
  $("study-question").textContent="No flashcards found.";
  $("study-answer").hidden=true;
  return;
 }
 const c=studyCards[studyIndex];
 $("study-question").textContent=c.question;
 $("study-answer").hidden=true;
 $("study-answer").querySelector("p").textContent=c.answer;
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
 if(!(await initializeSupabase()))return;
 $("tab-review").onclick=()=>showView("review");
 $("tab-manage").onclick=()=>showView("manage");
 $("begin-review").onclick=beginReview;
 $("show-answer").onclick=()=>$("study-answer").hidden=false;
 $("previous-card").onclick=()=>{if(studyIndex>0){studyIndex--;displayCard();}};
 $("next-card").onclick=()=>{if(studyIndex<studyCards.length-1){studyIndex++;displayCard();}};
 $("save-card").onclick=saveCard;
 showView("review");
 await loadCards();
});
