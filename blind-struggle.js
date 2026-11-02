/* Standalone training records; never mutates the Basick answer/checkmark stores. */
(function(){
'use strict';
const START=new Date(2026,10,2,12), DAY=86400000;
const plans=[
{title:'Cold Examination',note:'No notes, outlines, or model answers until the first complete draft is finished.',tasks:[['90 min','Blind essay','Complete IRAC draft entirely cold.'],['90 min','Forensic audit','Compare draft with both model answers A and B.'],['60 min','Master Error Log','Record missed issues, triggers and correct rules.'],['60 min','Closed-book retrieval','Say every corrected rule aloud; write and verify it.']]},
{title:'Reconstruction',note:'Return to the original fact pattern, not yesterday’s completed answer.',tasks:[['60 min','Cold rule recall','Speak and write the rules without looking.'],['90 min','Doctrinal repair','Repair elements, exceptions, and competing arguments.'],['90 min','Complete blind rewrite','Rewrite full IRAC answer without notes.'],['60 min','Second forensic audit','Check both models; mark persistent errors.']]},
{title:'Transfer & Retention',note:'Use unfamiliar facts to test transfer, not recognition of the original story.',tasks:[['60 min','Blind issue spotting','Outline a different essay prompt.'],['60 min','Mixed MCQs','Answer, explain and correct each item.'],['60 min','Cumulative rule recall','Speak and write previously missed rules.'],['90 min','Next-subject foundation','Study doctrine without previewing next prompt.'],['30 min','Error Log consolidation','Identify weak rules and retrieval priorities.']]}
];
const key='bcc_blind_struggle_v1';let state={};try{state=JSON.parse(localStorage.getItem(key)||'{}')||{}}catch(e){state={}};
state.essays ||= {};state.retrieval ||= {};
const $=id=>document.getElementById(id);
const save=()=>localStorage.setItem(key,JSON.stringify(state));
const fmt=d=>d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
const dateAt=n=>new Date(START.getTime()+n*DAY);
const schedule=[];
for(let col=0;col<6;col++)for(let row=0;row<12;row++)schedule.push({row,col,date:BASICK_DATES[row][col],question:BASICK_QUESTIONS[row][col],subject:BASICK_SUBJECTS[row]});
let current=0,day=0;
const record=()=>state.essays[current] ||= {tasks:{},draft:'',rewrite:'',errors:'',scores:{},hours:{}};
function draw(){
const e=schedule[current],r=record(),p=plans[day];$('bs-essay').value=String(current);$('bs-day').value=String(day);
$('bs-assignment').textContent=`Essay ${current+1} of 72 · Column ${e.col+1} · ${e.subject} · ${e.date} · Q${e.question} · ${fmt(dateAt(current*3))}–${fmt(dateAt(current*3+2))}`;
$('bs-day-title').textContent=`Day ${day+1} — ${p.title}`;$('bs-day-note').textContent=p.note;
$('bs-tasks').replaceChildren();p.tasks.forEach(([duration,name,detail],i)=>{let wrap=document.createElement('label');wrap.className='bs-task';let check=document.createElement('input');check.type='checkbox';check.checked=!!r.tasks[day+'-'+i];check.addEventListener('change',()=>{r.tasks[day+'-'+i]=check.checked;save();stats()});let body=document.createElement('span');let strong=document.createElement('strong');strong.textContent=name;let small=document.createElement('small');small.textContent=detail;body.append(strong,small);let time=document.createElement('span');time.className='bs-duration';time.textContent=duration;wrap.append(check,body,time);$('bs-tasks').append(wrap)});
for(const [id,field] of [['bs-draft','draft'],['bs-rewrite','rewrite'],['bs-errors','errors']])$(id).value=r[field]||'';
$('bs-issue-score').value=r.scores.issue??'';$('bs-rule-score').value=r.scores.rule??'';$('bs-actual-hours').value=r.hours[day]??'';
retrieval();stats();
}
function stats(){let completed=0,hours=0;for(let i=0;i<72;i++){const r=state.essays[i];if(!r)continue;if(plans.every((p,d)=>p.tasks.every((_,j)=>r.tasks?.[d+'-'+j])))completed++;hours+=Object.values(r.hours||{}).reduce((a,b)=>a+(Number(b)||0),0)}$('bs-cycles').textContent=completed+' / 72';$('bs-hours').textContent=hours.toFixed(1)+' / 1,080';$('bs-date').textContent=fmt(dateAt(215))}
function retrieval(){let host=$('bs-retrieval');host.replaceChildren();let now=new Date();now.setHours(12,0,0,0);let count=0;
for(let i=0;i<72;i++){let r=state.essays[i];if(!r?.tasks?.['0-0'])continue;for(const offset of [7,21]){const due=dateAt(i*3+offset);if(due>now)continue;let k=i+'-'+offset;if(state.retrieval[k])continue;count++;let item=document.createElement('div');item.className='bs-retrieval-item';let label=document.createElement('label'),cb=document.createElement('input');cb.type='checkbox';cb.addEventListener('change',()=>{state.retrieval[k]=cb.checked;save();retrieval()});let text=document.createElement('span');let e=schedule[i];text.textContent=`${fmt(due)} · Day ${offset} · ${e.subject}, ${e.date} Q${e.question} · speak + write rules blind`;label.append(cb,text);item.append(label);host.append(item)}}if(!count)host.textContent='No retrievals due yet.'}
$('bs-essay').replaceChildren();schedule.forEach((e,i)=>{let o=document.createElement('option');o.value=i;o.textContent=`${i+1}. ${e.subject} · ${e.date} Q${e.question}`;$('bs-essay').append(o)});
$('bs-essay').addEventListener('change',e=>{current=Number(e.target.value);day=0;draw()});$('bs-day').addEventListener('change',e=>{day=Number(e.target.value);draw()});
$('bs-prev').addEventListener('click',()=>{if(day>0)day--;else if(current>0){current--;day=2}draw()});$('bs-next').addEventListener('click',()=>{if(day<2)day++;else if(current<71){current++;day=0}draw()});
for(const [id,field] of [['bs-draft','draft'],['bs-rewrite','rewrite'],['bs-errors','errors']])$(id).addEventListener('input',e=>{record()[field]=e.target.value;save()});
for(const [id,field] of [['bs-issue-score','issue'],['bs-rule-score','rule']])$(id).addEventListener('input',e=>{record().scores[field]=e.target.value;save()});
$('bs-actual-hours').addEventListener('input',e=>{record().hours[day]=e.target.value;save();stats()});
$('bs-export').addEventListener('click',()=>{let blob=new Blob([JSON.stringify({type:'baros-blind-struggle-v1',state},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='baros-blind-struggle-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
$('bs-import').addEventListener('change',async e=>{let file=e.target.files?.[0];if(!file)return;try{let data=JSON.parse(await file.text());if(data.type!=='baros-blind-struggle-v1'||!data.state?.essays||!data.state?.retrieval)throw Error('Not a valid Blind-Struggle backup');if(!confirm('Replace current Blind-Struggle training records with this backup? Other BarOS data will not be changed.'))return;state=data.state;save();draw()}catch(err){alert('Import failed: '+err.message)}finally{e.target.value=''}});
draw();
})();
