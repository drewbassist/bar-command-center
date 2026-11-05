/* Independent, completion-gated Blind-Struggle training. Does not mutate Basick or archive data. */
(()=>{
'use strict';
const KEY='bcc_blind_struggle_v2', START='2026-11-02';
const DAYS=[
 [['75 min','Blind essay','Write a closed-book IRAC answer; prioritize complete issue spotting.'],['45 min','Compare Answers A and B','Identify missed issues, inaccurate rules, and weak factual analysis.'],['30 min','Blind rule reconstruction','Recall governing rules without notes; check and correct.'],['15 min','Targeted essay reconstruction','Rewrite the weakest issue or application from memory.'],['15 min','Error Log and due reviews','Record mistakes and prioritize overdue retrieval within this block.']],
 [['30 min','Compare Answers A and B','Target the areas missed on Day 1.'],['45 min','Blind rule reconstruction','Retrieve elements, exceptions, distinctions and factual triggers.'],['45 min','Essay rewrite','Rewrite the most important portions from the original question.'],['30 min','Strategies & Tactics MCQs','Answer and review questions, including guessed answers.'],['30 min','Error Log and due reviews','Update errors and complete due retrieval within this block.']],
 [['45 min','New hypothetical / transfer','Apply the rules to a variation or new subissues.'],['30 min','Blind rule reconstruction','Retrieve key rules and exceptions without notes.'],['45 min','Essay reconstruction / application','Produce a fresh issue-and-analysis outline and audit it.'],['30 min','Strategies & Tactics MCQs','Practice and review mixed or targeted questions.'],['30 min','Error Log and due reviews','Consolidate corrections and handle due retrieval within this block.']]
];
const names=['Cold Examination','Reconstruction','Essay Mastery & Retention'];
const parse=x=>new Date(x+'T12:00:00');
const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const add=(x,n)=>{const d=parse(x);d.setDate(d.getDate()+n);return iso(d)};
const fmt=x=>parse(x).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
const today=()=>iso(new Date());
const empty=()=>({index:0,day:0,start:START,completed:[],records:{},reviews:{},lastDayCompleted:null});
let state;try{state={...empty(),...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch(e){state=empty()}
const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
const essays=()=>{const out=[];for(let col=0;col<6;col++)for(let row=0;row<12;row++)out.push({subject:BASICK_SUBJECTS[row],date:BASICK_DATES[row][col],q:BASICK_QUESTIONS[row][col],col:col+1,row});return out};
const list=essays();
const record=i=>state.records[i]||(state.records[i]={tasks:{},draft:'',rewrite:'',errors:'',hours:{}});
const dayTasks=()=>DAYS[state.day]||[];
const el=id=>document.getElementById(id);
const text=(tag,value,cls)=>{const n=document.createElement(tag);n.textContent=value;if(cls)n.className=cls;return n};
const clear=n=>n.replaceChildren();
function reviewItems(){const r=[];state.completed.forEach(c=>{for(const offset of [7,21]){const key=`${c.index}-${offset}`,due=add(c.start,offset);r.push({key,index:c.index,offset,due,done:state.reviews[key]})}});if(state.index<72 && state.start && state.day>0){const i=state.index;for(const offset of [7,21]){const key=`${i}-${offset}`;r.push({key,index:i,offset,due:add(state.start,offset),done:state.reviews[key]})}}return r.sort((a,b)=>a.due.localeCompare(b.due))}
function render(){const i=state.index,finished=i>=72,essay=list[Math.min(i,71)],r=record(i);const projected=finished?(state.completed.at(-1)?.end||START):add(state.start,(72-i)*3-state.day-1);const completedHours=Object.values(state.records).reduce((sum,v)=>sum+Object.values(v.hours||{}).reduce((a,b)=>a+(Number(b)||0),0),0);
 el('struggle-metrics').replaceChildren(...[['Completed essays',`${i} / 72`],['Completed training days',`${i*3+state.day} / 216`],['Logged study hours',`${completedHours.toFixed(1)} / 648 planned`],['Estimated finish*',fmt(projected)]].map(([label,value])=>{const d=text('div','', 'struggle-metric');d.append(text('strong',value),text('span',label));return d}));
 const assignment=el('struggle-assignment');clear(assignment);assignment.append(text('strong',finished?'All 72 essay cycles completed':`${essay.subject} · ${essay.date} · Question ${essay.q}`),text('small',finished?'All cycles completed':`Essay ${i+1} of 72 · Column ${essay.col} · Day ${state.day+1} of 3 · Started ${fmt(state.start)} · 3h/day plan · finish date is an estimate`));
 const tabs=el('struggle-day-tabs');clear(tabs);names.forEach((name,n)=>{const b=text('button',`Day ${n+1} · ${name}`);b.type='button';if(n===state.day)b.classList.add('active');b.disabled=finished||n!==state.day;tabs.append(b)});
 const tasks=el('struggle-tasks');clear(tasks);if(!finished)dayTasks().forEach(([duration,title,description],n)=>{const div=text('div','', 'struggle-task'),input=document.createElement('input');input.type='checkbox';input.checked=!!r.tasks[`${state.day}-${n}`];input.addEventListener('change',()=>{r.tasks[`${state.day}-${n}`]=input.checked;save();render()});const label=document.createElement('label');label.append(text('strong',title),text('div',description,'struggle-hint'));div.append(input,label,text('small',duration));tasks.append(div)});
 // Retrieval is part of the final 15/30-minute task, not additional time.
 const budget=el('struggle-retrieval-budget');if(budget){clear(budget);
  if(!finished){const due=reviewItems().filter(x=>!x.done&&x.due<=today());
   budget.append(text('h3','Daily retrieval · included in the 3-hour plan'),
    text('p',`Day ${state.day+1}: use the final ${state.day===0?15:30}-minute Error Log/review block for due retrieval and corrections. Do not add another hour.`, 'struggle-hint'));
   const ruleCount=Number(window.barosDueRuleCount?.()||0);
   budget.append(text('p',`${due.length} essay review(s) due or overdue · ${ruleCount} Error Log rule(s) due. Unfinished items stay pending.`, 'struggle-hint'));
   const queue=text('div','','struggle-retrieval-queue');
   for(const x of due){const e=list[x.index],row=text('div','','struggle-review');
    row.append(text('strong',`Day ${x.offset} · ${e.subject} · ${e.date} Q${e.q}`),text('span',`Due ${fmt(x.due)} · retrieve blind before marking complete`));
    const button=text('button','Mark retrieval complete');button.type='button';button.onclick=()=>{state.reviews[x.key]=today();save();render()};row.append(button);queue.append(row)}
   if(!due.length)queue.append(text('p','No essay reviews due. Retrieve current-essay rules and due Error Log rules.','struggle-hint'));
   budget.append(queue);
   if(due.length>1)budget.append(text('p','Prioritize overdue reviews; carry unfinished work forward rather than exceeding 3 hours.','struggle-hint'));
   const link=document.createElement('a');link.href='#master-error-log';link.textContent='Go to Master Error Log';budget.append(link);
   budget.append(text('p','*Finish estimate assumes one training day per calendar day; actual completion depends on your pace.','struggle-hint'));
  }
 }
 const ready=!finished&&dayTasks().every((_,n)=>r.tasks[`${state.day}-${n}`]);el('struggle-next-day').disabled=!ready||finished;el('struggle-next-day').textContent=state.day===2?'Complete cycle & begin next essay':'Complete this training day';el('struggle-status').textContent=finished?'Program complete':ready?'All tasks checked. Ready to advance.':'Finish each required task before advancing.';
 for(const [id,key] of [['struggle-draft','draft'],['struggle-rewrite','rewrite'],['struggle-errors','errors']]){const field=el(id);field.disabled=finished;field.value=r[key]||'';field.oninput=()=>{r[key]=field.value;save()}}const hours=el('struggle-hours');hours.disabled=finished;hours.value=r.hours[state.day]||0;hours.onchange=()=>{r.hours[state.day]=Math.max(0,Math.min(3,Number(hours.value)||0));save();render()};
 const reviews=el('struggle-reviews');clear(reviews);const items=reviewItems().filter(x=>x.due<=today()||(!x.done&&x.due<=add(today(),21))).slice(0,25);if(!items.length)reviews.append(text('p','No scheduled reviews yet.','struggle-hint'));items.forEach(x=>{const d=text('div','',`struggle-review ${x.done?'done':x.due<today()?'overdue':''}`),e=list[x.index];d.append(text('strong',`${fmt(x.due)} · Day ${x.offset} · ${e.subject}`),text('span',`${e.date} Q${e.q} · ${x.done?'Completed '+fmt(x.done):x.due<today()?'OVERDUE':x.due===today()?'DUE TODAY':'Upcoming'}`));if(!x.done){const b=text('button','Mark retrieval complete');b.type='button';b.onclick=()=>{state.reviews[x.key]=today();save();render()};d.append(b)}reviews.append(d)});
 const upcoming=el('struggle-upcoming');clear(upcoming);for(let k=i;k<Math.min(72,i+7);k++){const e=list[k],offset=k-i,start=add(state.start,offset*3+(offset? -state.day:0));const row=text('div','', 'struggle-upcoming-row');row.append(text('strong',`Essay ${k+1} · ${e.subject}`),text('span',`${e.date} Q${e.q} · ${fmt(start)} (projected)`));upcoming.append(row)}
}
function advance(){if(state.index>=72)return;const r=record(state.index);if(!dayTasks().every((_,n)=>r.tasks[`${state.day}-${n}`]))return;const actual=today();if(state.day===2){state.completed.push({index:state.index,start:state.start,end:actual});state.index++;state.day=0;state.start=state.index<72?add(actual,1):actual}else{state.day++;}state.lastDayCompleted=actual;save();render()}
document.addEventListener('DOMContentLoaded',()=>{if(!el('struggle-training'))return;el('struggle-next-day').onclick=advance;el('struggle-export').onclick=()=>{const blob=new Blob([JSON.stringify({exported:today(),blindStruggle:state},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='baros-blind-struggle-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};render()});
})();
