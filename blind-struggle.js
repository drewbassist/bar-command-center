/* Independent, completion-gated Blind-Struggle training. Does not mutate Basick or archive data. */
(()=>{
'use strict';
const KEY='bcc_blind_struggle_v2', START='2026-11-02';
const TASKS=[
 ['Blind essay','Write the essay closed-book, identifying issues and applying rules.'],
 ['Compare Answers A and B','Audit issues, rules, factual triggers and application against both selected answers.'],
 ['Consolidated essay guide','Create and attach the essay-specific guide grounded in the prompt and Answers A/B.'],
 ['20 mini-lessons and written answers','Complete twenty pertinent mini-lessons, written applications, individual grades and a score out of 20; pause for questions after each.'],
 ['Blind rule and essay reconstruction','Retrieve rules without notes and rewrite weak portions of the essay.'],
 ['Log master rules','Collect rules, triggers, exceptions and distinctions in the Log; use Edit, Blind and Needs More.'],
 ['Due spaced retrieval','Review prior essays and guides due at +1, +3, +5, +7 and +14; unfinished reviews remain pending.']
];
const OFFSETS=[1,3,5,7,14];
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
const dayTasks=()=>TASKS;
const el=id=>document.getElementById(id);
const text=(tag,value,cls)=>{const n=document.createElement(tag);n.textContent=value;if(cls)n.className=cls;return n};
const clear=n=>n.replaceChildren();
// Legacy completed cycles retain their existing +3/+5/+7/+14/+21 review keys and dates.
// New one-day completions use +1/+3/+5/+7/+14 from the essay training date.
function reviewItems(){const r=[];const seen=new Set();
 for(const c of state.completed){if(!Number.isInteger(c.index)||!c.start)continue;const offsets=c.scheduleVersion===1?OFFSETS:[3,5,7,14,21];const anchor=c.scheduleVersion===1?(c.trainingDate||c.start):(c.reviewAnchor||c.start);
  for(const offset of offsets){const key=`${c.index}-${offset}`;if(seen.has(key))continue;seen.add(key);r.push({key,index:c.index,offset,due:add(anchor,offset),done:state.reviews[key]})}}
 return r.sort((a,b)=>a.due.localeCompare(b.due))}
// Four-month calendar view over the existing Blind-Struggle review records.
let calendarShift=0;
function renderSpacedTracker(){
 const panel=el('struggle-spaced-tracker');if(!panel)return;
 clear(panel);
 const heading=text('div','','study-cal-header');
 const intro=document.createElement('div');intro.append(text('h3','Study Calendar · spaced repetition'),text('p','New essays: +1, +3, +5, +7, +14 days from the training date. Historical completed cycles retain their original review dates.','struggle-hint'));
 const nav=text('div','','study-cal-nav');
 for(const [label,delta] of [['← Previous',-4],['Today',null],['Next →',4]]){
  const btn=text('button',label);btn.type='button';btn.onclick=()=>{calendarShift=delta===null?0:calendarShift+delta;renderSpacedTracker()};nav.append(btn);
 }
 heading.append(intro,nav);panel.append(heading);
 const events=new Map();
 for(const item of reviewItems()){const e=list[item.index];if(!e)continue;if(!events.has(item.due))events.set(item.due,[]);events.get(item.due).push({...item,essay:e})}
 const base=parse(today());base.setDate(1);base.setMonth(base.getMonth()+calendarShift);
 const months=text('div','','study-cal-months');
 for(let m=0;m<4;m++){
  const first=new Date(base.getFullYear(),base.getMonth()+m,1,12);
  const year=first.getFullYear(),month=first.getMonth();
  const block=text('section','','study-cal-month');block.append(text('h4',first.toLocaleDateString('en-US',{month:'long',year:'numeric'})));
  const grid=text('div','','study-cal-grid');
  for(const day of ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'])grid.append(text('span',day,'study-cal-weekday'));
  for(let i=0;i<first.getDay();i++)grid.append(text('div','','study-cal-blank'));
  const total=new Date(year,month+1,0).getDate();
  for(let day=1;day<=total;day++){
   const date=iso(new Date(year,month,day,12));const items=events.get(date)||[];
   const cell=text('div','','study-cal-day');if(date===today())cell.classList.add('is-today');
   if(items.some(x=>!x.done&&x.due<today()))cell.classList.add('has-overdue');
   cell.append(text('strong',String(day),'study-cal-date'));
   for(const item of items){const label=text('label','','study-cal-event');if(item.done)label.classList.add('is-done');
    const check=document.createElement('input');check.type='checkbox';check.checked=!!item.done;
    check.setAttribute('aria-label',`${item.essay.subject} ${item.essay.date} Q${item.essay.q}, D+${item.offset}, ${fmt(date)}`);
    check.addEventListener('change',()=>{if(check.checked)state.reviews[item.key]=today();else delete state.reviews[item.key];save();render()});
    const name=text('span',`${item.essay.subject} · ${item.essay.date} Q${item.essay.q} · D+${item.offset}`);
    label.append(check,name);cell.append(label);
   }
   grid.append(cell);
  }
  block.append(grid);months.append(block);
 }
 panel.append(months);
 const overdue=[...events.values()].flat().filter(x=>!x.done&&x.due<today()).length;
 const foot=text('p',`${overdue} overdue review(s) across all started essays. Green = completed; peach = overdue. Unfinished reviews remain on their original dates.`, 'struggle-hint');panel.append(foot);
}
function render(){const i=state.index,finished=i>=72,essay=list[Math.min(i,71)],r=record(i);const projected=finished?(state.completed.at(-1)?.end||START):add(state.start,72-i-1);const completedHours=Object.values(state.records).reduce((sum,v)=>sum+Object.values(v.hours||{}).reduce((a,b)=>a+(Number(b)||0),0),0);const elapsedDays=Math.max(0,Math.floor((new Date(today()+'T12:00:00')-new Date(START+'T12:00:00'))/86400000)+1);const cumulativePlannedHours=elapsedDays*5;
 el('struggle-metrics').replaceChildren(...[['Completed essays',`${i} / 72`],['Essays advanced',`${i} / 72`],['Actual logged essay hours',`${completedHours.toFixed(1)}`],['Cumulative planned study hours · 5/day',`${cumulativePlannedHours.toFixed(1)}`],['Estimated finish*',fmt(projected)]].map(([label,value])=>{const d=text('div','', 'struggle-metric');d.append(text('strong',value),text('span',label));return d}));
 const assignment=el('struggle-assignment');clear(assignment);assignment.append(text('strong',finished?'All 72 essay cycles completed':`${essay.subject} · ${essay.date} · Question ${essay.q}`),text('small',finished?'All cycles completed':`Essay ${i+1} of 72 · Column ${essay.col} · One essay per training day · Training date ${fmt(state.start)} · finish date is an estimate`));
 renderSpacedTracker();
 const tabs=el('struggle-day-tabs');clear(tabs);tabs.append(text('strong','Single-day essay workflow · seven required steps')); 
 const tasks=el('struggle-tasks');clear(tasks);if(!finished)dayTasks().forEach(([title,description],n)=>{const div=text('div','', 'struggle-task'),input=document.createElement('input');input.type='checkbox';input.checked=!!r.tasks[`single-${n}`];input.addEventListener('change',()=>{r.tasks[`single-${n}`]=input.checked;save();render()});const label=document.createElement('label');label.append(text('strong',title),text('div',description,'struggle-hint'));div.append(input,label);tasks.append(div)});
 // Retrieval is part of the final 15/30-minute task, not additional time.
 const budget=el('struggle-retrieval-budget');if(budget){clear(budget);
  if(!finished){const due=reviewItems().filter(x=>!x.done&&x.due<=today());
   budget.append(text('h3','Daily retrieval · cumulative review'),
    text('p','Review prior essays and guides alongside the new essay. Preserve the separate daily Civil Procedure block and stay within the five-hour total study cap; carry unfinished work forward.', 'struggle-hint'));
   const ruleCount=Number(window.barosDueRuleCount?.()||0);
   budget.append(text('p',`${due.length} essay review(s) due or overdue · ${ruleCount} Log rule(s) due. Unfinished items stay pending.`, 'struggle-hint'));
   const queue=text('div','','struggle-retrieval-queue');
   for(const x of due){const e=list[x.index],row=text('div','','struggle-review');
    row.append(text('strong',`Day ${x.offset} · ${e.subject} · ${e.date} Q${e.q}`),text('span',`Due ${fmt(x.due)} · retrieve blind before marking complete`));
    const button=text('button','Mark retrieval complete');button.type='button';button.onclick=()=>{state.reviews[x.key]=today();save();render()};row.append(button);queue.append(row)}
   if(!due.length)queue.append(text('p','No essay reviews due. Retrieve current-essay rules and due Log rules.','struggle-hint'));
   budget.append(queue);
   if(due.length>1)budget.append(text('p','Prioritize overdue reviews; carry unfinished work forward rather than exceeding the daily study cap.','struggle-hint'));
   const link=document.createElement('a');link.href='#master-error-log';link.textContent='Go to Log';budget.append(link);
   budget.append(text('p','*Finish estimate assumes one training day per calendar day; actual completion depends on your pace.','struggle-hint'));
  }
 }
 const ready=!finished&&dayTasks().every((_,n)=>r.tasks[`single-${n}`]);el('struggle-next-day').disabled=!ready||finished;el('struggle-next-day').textContent='Complete essay & begin next essay';el('struggle-status').textContent=finished?'Program complete':ready?'All tasks checked. Ready to advance.':'Finish each required task before advancing.';
 for(const [id,key] of [['struggle-draft','draft'],['struggle-rewrite','rewrite'],['struggle-errors','errors']]){const field=el(id);field.disabled=finished;field.value=r[key]||'';field.oninput=()=>{r[key]=field.value;save()}}const hours=el('struggle-hours');hours.disabled=finished;hours.value=r.hours.single||0;hours.onchange=()=>{r.hours.single=Math.max(0,Math.min(5,Number(hours.value)||0));save();render()};
 const reviews=el('struggle-reviews');clear(reviews);const items=reviewItems().filter(x=>x.due<=today()||(!x.done&&x.due<=add(today(),21)));if(!items.length)reviews.append(text('p','No scheduled reviews yet.','struggle-hint'));items.forEach(x=>{const d=text('div','',`struggle-review ${x.done?'done':x.due<today()?'overdue':''}`),e=list[x.index];d.append(text('strong',`${fmt(x.due)} · Day ${x.offset} · ${e.subject}`),text('span',`${e.date} Q${e.q} · ${x.done?'Completed '+fmt(x.done):x.due<today()?'OVERDUE':x.due===today()?'DUE TODAY':'Upcoming'}`));if(!x.done){const b=text('button','Mark retrieval complete');b.type='button';b.onclick=()=>{state.reviews[x.key]=today();save();render()};d.append(b)}reviews.append(d)});
 const upcoming=el('struggle-upcoming');clear(upcoming);for(let k=i;k<Math.min(72,i+7);k++){const e=list[k],offset=k-i,start=add(state.start,offset);const row=text('div','', 'struggle-upcoming-row');row.append(text('strong',`Essay ${k+1} · ${e.subject}`),text('span',`${e.date} Q${e.q} · ${fmt(start)} (projected)`));upcoming.append(row)}
}
function advance(){if(state.index>=72)return;const r=record(state.index);if(!dayTasks().every((_,n)=>r.tasks[`single-${n}`]))return;
 const actual=today();const trainingDate=actual; // first single-day completion is anchored to its actual completion date, not a legacy Day-1 date
 // Preserve historical cycles and their completion/review records. Never rewrite old entries.
 if(!state.completed.some(c=>c.index===state.index))state.completed.push({index:state.index,start:trainingDate,trainingDate,end:actual,scheduleVersion:1});
 state.index++;state.day=0;state.start=state.index<72?add(actual,1):actual;state.lastDayCompleted=actual;save();render()}
document.addEventListener('DOMContentLoaded',()=>{if(!el('struggle-training'))return;el('struggle-next-day').onclick=advance;el('struggle-export').onclick=()=>{const blob=new Blob([JSON.stringify({exported:today(),blindStruggle:state},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='baros-blind-struggle-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};render()});
})();
