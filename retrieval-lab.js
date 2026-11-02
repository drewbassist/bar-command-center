(()=>{'use strict';
const $=id=>document.getElementById(id);
let current=null;
const modes={
 blind:['State the complete rule from memory.','Identify elements, triggers, exceptions and correct application before revealing.'],
 reverse:['Identify the doctrine from its factual trigger.','Name the doctrine, state its rule, and explain why these facts trigger it.'],
 exception:['Retrieve the exception or distinction FIRST.','State the exception/distinction, then the general rule and decisive facts.'],
 confidence:['Retrieve the rule and predict your accuracy.','Write your answer, then select confidence BEFORE revealing.'],
 uncued:['Uncued recall: identify the doctrine.','No subject or doctrine label is shown. Use the clue to identify the doctrine and rule.']
};
const entries=()=>typeof window.barosRetrievalLabEntries==='function'?window.barosRetrievalLabEntries():[];
function refreshSubjects(){const sel=$('rl-subject'),old=sel.value,subjects=[...new Set(entries().map(e=>e.subject).filter(Boolean))].sort();sel.replaceChildren(new Option('All subjects',''));subjects.forEach(x=>sel.add(new Option(x,x)));sel.value=subjects.includes(old)?old:'';}
function setText(id,value){$(id).textContent=value||'';}
function pick(){
 refreshSubjects();const pool=entries().filter(e=>(!$('rl-subject').value||e.subject===$('rl-subject').value)&&e.rule);
 current=pool.length?pool[Math.floor(Math.random()*pool.length)]:null;
 $('rl-card').hidden=!current;$('rl-reference').hidden=true;$('rl-reference').replaceChildren();$('rl-answer').value='';$('rl-confidence').value='';
 if(!current){setText('rl-status','No saved rules available in this subject. Add concepts in the Master Error Log first, or wait for Supabase to load.');return;}
 const mode=$('rl-mode').value,m=modes[mode];setText('rl-status',`${pool.length} saved concepts available · experimental practice only`);
 $('rl-confidence-wrap').hidden=mode!=='confidence';setText('rl-prompt',m[0]);
 const cue=mode==='reverse'?(current.trigger||'No issue trigger saved. Add one in the Master Error Log.'):
 mode==='exception'?'Doctrine: '+(current.concept||'Unnamed concept'):
 mode==='uncued'?(current.trigger||current.originalError||'No factual clue saved. Add an issue trigger.'):
 'Doctrine: '+(current.concept||'Unnamed concept');
 setText('rl-cue',cue+' — '+m[1]);
 setText('rl-meta',mode==='uncued'?'Subject and doctrine hidden until reveal':(current.subject||'General')+' · '+(current.source||'Independent entry'));
 updateReveal();
}
function updateReveal(){$('rl-reveal').disabled=!current||!$('rl-answer').value.trim()||($('rl-mode').value==='confidence'&&!$('rl-confidence').value);}
function reveal(){if(!current)return;const box=$('rl-reference');box.replaceChildren();const fields=[['Subject','subject'],['Doctrine','concept'],['Rule / definition','rule'],['Issue trigger','trigger'],['Exception / distinction','distinction'],['Original error','originalError'],['Correct analysis','analysis'],['Source essay','source']];for(const [label,key] of fields){if(!current[key])continue;const p=document.createElement('p'),b=document.createElement('strong');b.textContent=label+': ';p.append(b,document.createTextNode(current[key]));box.append(p)}if($('rl-mode').value==='confidence'){const p=document.createElement('p');p.textContent='Your confidence before reveal: '+$('rl-confidence').selectedOptions[0].text;p.style.fontWeight='bold';box.prepend(p)}box.hidden=false;}
document.addEventListener('DOMContentLoaded',()=>{if(!$('rl-mode'))return;
 $('rl-next').addEventListener('click',pick);$('rl-mode').addEventListener('change',pick);$('rl-subject').addEventListener('change',pick);
 $('rl-answer').addEventListener('input',updateReveal);$('rl-confidence').addEventListener('change',updateReveal);
 $('rl-reveal').addEventListener('click',reveal);$('rl-reset').addEventListener('click',()=>{if(!current)return;$('rl-answer').value='';$('rl-confidence').value='';$('rl-reference').hidden=true;updateReveal();$('rl-answer').focus()});
 document.querySelector('[data-view="retrieval-lab"]')?.addEventListener('click',()=>setTimeout(pick,0));
 setTimeout(pick,1400);
});
})();