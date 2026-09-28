const $ = id => document.getElementById(id);
let token = sessionStorage.getItem('briefly-key') || '', state = null, job = null, selected = null, polling = false, revision = 0;
const form = $('settings-form');
const el = (tag, text, cls) => { const e = document.createElement(tag); if(text !== undefined)e.textContent=text; if(cls)e.className=cls; return e; };
function notice(text, undo) {
  $('notice').replaceChildren(el('span',text));
  if(undo){const button=el('button','Undo');button.onclick=async()=>{button.disabled=true;try{await undo();}catch(e){notice(e.message);}};$('notice').append(button);}
  $('notice').hidden=false;clearTimeout(notice.timer);notice.timer=setTimeout(()=>$('notice').hidden=true,undo?15000:7000);
}
function setSidebar(collapsed){document.body.classList.toggle('sidebar-collapsed',collapsed);$('toggle-chats').setAttribute('aria-expanded',String(!collapsed));$('toggle-chats').setAttribute('aria-label',collapsed?'Show chats':'Hide chats');}
setSidebar(sessionStorage.getItem('briefly-sidebar')==='closed' || (sessionStorage.getItem('briefly-sidebar')===null && matchMedia('(max-width:720px)').matches));
$('toggle-chats').onclick=()=>{const collapsed=!document.body.classList.contains('sidebar-collapsed');setSidebar(collapsed);sessionStorage.setItem('briefly-sidebar',collapsed?'closed':'open');};
function closeMenus(){for(const menu of document.querySelectorAll('.chat-menu'))menu.hidden=true;for(const button of document.querySelectorAll('.chat-more'))button.setAttribute('aria-expanded','false');}
document.addEventListener('click',e=>{if(!e.target.closest('.chat-row'))closeMenus();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){const opened=document.querySelector('.chat-more[aria-expanded=true]');closeMenus();opened?.focus();}});
async function deleteChat(id){
  try {
    revision++;state=await api('delete',{id});
    if(selected===id){selected=job=null;$('question').value='';renderJob();}
    renderState();$('new').focus();
    notice('Chat deleted.',async()=>{revision++;state=await api('restore',{id});renderState();notice('Chat restored.');});
  }catch(e){notice(e.message);}
}
function locked() { $('login').hidden=false; $('workspace').hidden=true; for(const id of ['new','settings-button','lock'])$(id).hidden=true; }
async function api(path, body) {
  const response = await fetch('/api/'+path,{method:body===undefined?'GET':'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const result=await response.json();
  if(response.status===401) { token=''; sessionStorage.removeItem('briefly-key'); locked(); }
  if(!response.ok)throw new Error(result.error || 'The request failed.');
  return result;
}
function renderState() {
  $('login').hidden=true; $('workspace').hidden=false;
  for(const id of ['new','settings-button','lock'])$(id).hidden=false;
  $('budget').textContent=`${state.config.source_limit} pages · up to ${state.config.word_limit} words`;
  $('ask').disabled=!!state.active; $('settings-button').disabled=!!state.active;
  $('ask').replaceChildren(document.createTextNode(state.active?'Researching…':'Research'),el('span','↑'));
  const signature=JSON.stringify([state.history,selected,state.active]);
  if($('history').dataset.signature===signature)return;
  $('history').dataset.signature=signature;$('history').replaceChildren();
  if(!state.history.length)$('history').append(el('p','No chats yet.','sidebar-empty'));
  for(const item of state.history) {
    const row=el('div',undefined,'chat-row'+(selected===item.id?' selected':'')),line=el('div',undefined,'chat-line');
    const button=el('button',item.question,'chat-open');button.title=item.question;button.onclick=()=>{loadJob(item.id);if(matchMedia('(max-width:720px)').matches)setSidebar(true);};
    const more=el('button','…','chat-more');more.title='Chat options';more.setAttribute('aria-label','Options for '+item.question);more.setAttribute('aria-haspopup','menu');more.setAttribute('aria-expanded','false');
    const menu=el('div',undefined,'chat-menu');menu.hidden=true;menu.setAttribute('role','menu');menu.id='menu-'+item.id;more.setAttribute('aria-controls',menu.id);
    const remove=el('button','Delete chat');remove.setAttribute('role','menuitem');remove.disabled=state.active===item.id;if(remove.disabled)remove.title='Wait for this answer to finish';remove.onclick=()=>deleteChat(item.id);menu.append(remove);
    more.onclick=()=>{const open=menu.hidden;closeMenus();menu.hidden=!open;more.setAttribute('aria-expanded',String(open));if(open)remove.focus();};
    more.onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();more.click();}};
    line.append(button,more);row.append(line,menu);$('history').append(row);
  }
}
function citeText(target, text, ids) {
  const parts=text.split(/(\[\d+\])/);
  for(const part of parts) {
    const match=/^\[(\d+)\]$/.exec(part);
    if(match && ids.has(Number(match[1]))) { const a=el('a',match[1],'citation'); a.href='#source-'+match[1]; a.setAttribute('aria-label','Source '+match[1]); target.append(a); }
    else target.append(document.createTextNode(part));
  }
}
function renderJob() {
  const hasJob=!!job;
  $('intro').hidden=hasJob; $('result').hidden=!hasJob;
  if(!job)return;
  $('result-question').textContent=job.question; $('job-date').textContent=new Date(job.created*1000).toLocaleDateString(undefined,{month:'short',day:'numeric'});
  $('stage').textContent=job.stage; $('progress').className=job.status==='working'?'working':'';
  $('failure').hidden=!job.error; $('failure').textContent=job.error;
  const signature=JSON.stringify([job.id,job.answer,job.sources,job.warnings,job.status]);
  if($('answer').dataset.signature!==signature) {
    $('answer').dataset.signature=signature; $('answer').replaceChildren();
    const ids=new Set(job.sources.filter(s=>s.excerpt).map(s=>s.id));
    for(const text of job.answer.split(/\n\s*\n/).filter(Boolean)) {const p=el('p');citeText(p,text,ids);$('answer').append(p);}
    $('warnings').replaceChildren(...job.warnings.map(w=>el('p',w)));
    $('sources').replaceChildren();
    for(const source of job.sources) {
      const card=el('article',undefined,'source');card.id='source-'+source.id;
      const domain=el('div',undefined,'source-domain');domain.append(el('span',new URL(source.url).hostname),el('span',String(source.id).padStart(2,'0'),'source-number'));
      const link=el('a',source.title); link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';
      const badge=el('span',source.basis==='page'?'Page read':'Search snippet','source-basis'+(source.basis==='snippet'?' snippet':''));
      const details=el('details');details.append(el('summary','View evidence'),el('p',source.excerpt || 'No readable evidence.'));
      if(source.read_error)details.append(el('p','Page unavailable: '+source.read_error,'read-error'));
      card.append(domain,link,badge,details);$('sources').append(card);
    }
  }
  $('source-count').textContent=`${job.sources.length} sources · ${job.sources.filter(s=>s.basis==='page').length} pages read`;
  $('answer-meta').textContent=job.status==='working'?'':`${job.model} · ${job.duration}s · ${job.search_provider}`;
  $('events').replaceChildren(...job.events.map(text=>el('li',text)));
}
async function loadJob(id) {
  selected=id;
  try {const result=await api('answer?id='+encodeURIComponent(id));if(selected!==id)return;job=result;renderJob();renderState();}
  catch(e){notice(e.message);}
}
async function refresh(initial=false) {
  if(!token || polling)return;
  polling=true;
  const requestToken=token,requestRevision=revision;
  try {const nextState=await api('state');if(token!==requestToken || revision!==requestRevision)return;state=nextState;if(initial && !selected){selected=state.active || state.history[0]?.id || null;}renderState();
    if(selected){const id=selected;const next=await api('answer?id='+encodeURIComponent(id));if(selected===id){job=next;renderJob();}}
  } catch(e){notice(e.message);}finally{polling=false;}
}
$('login-form').onsubmit=async e=>{e.preventDefault();token=$('key').value.trim();await refresh(true);if(!$('workspace').hidden){sessionStorage.setItem('briefly-key',token);$('key').value='';}};
$('lock').onclick=()=>{token='';sessionStorage.removeItem('briefly-key');state=job=selected=null;$('history').replaceChildren();delete $('history').dataset.signature;locked();};
$('new').onclick=()=>{selected=job=null;$('question').value='';renderJob();renderState();$('question').focus();};
$('ask-form').onsubmit=async e=>{
  e.preventDefault();$('ask').disabled=true;
  try {job=await api('ask',{question:$('question').value});selected=job.id;state.active=job.id;renderJob();renderState();await refresh();}
  catch(e){notice(e.message);if(state)renderState();}
};
$('question').addEventListener('keydown',e=>{if(e.key==='Enter' && (e.ctrlKey || e.metaKey)){e.preventDefault();if(!state?.active)$('ask-form').requestSubmit();}});
$('settings-button').onclick=()=>{for(const [key,value] of Object.entries(state.config))form.elements[key].value=value;$('test-result').textContent='';$('settings').showModal();};
$('close-settings').onclick=()=>$('settings').close();
function readSettings(){const values=Object.fromEntries(new FormData(form));for(const key of ['source_limit','word_limit','max_tokens','timeout_seconds'])values[key]=Number(values[key]);return values;}
form.onsubmit=async e=>{e.preventDefault();$('save').disabled=true;try{state=await api('settings',readSettings());renderState();$('settings').close();notice('Settings saved.');}catch(e){notice(e.message);}finally{$('save').disabled=false;}};
$('test').onclick=async()=>{if(!form.reportValidity())return;$('test').disabled=true;$('test-result').textContent='Checking available models; no generation…';try{const result=await api('test',readSettings());$('test-result').textContent='Connected. Models: '+(result.models.join(', ') || 'No models listed.');}catch(e){$('test-result').textContent=e.message;}finally{$('test').disabled=false;}};
setInterval(()=>{if(!document.hidden && (state?.active || job?.status==='working'))refresh();},1800);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
refresh(true);

if(document.modelContext?.registerTool) {
  const lifecycle=new AbortController();
  const register=tool=>{try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch(_){}};
  register({name:'ask_research_question',description:'Search the public web and start one concise answer using the configured local model. Sends the question to external search providers.',inputSchema:{type:'object',properties:{question:{type:'string',minLength:1,maxLength:700}},required:['question'],additionalProperties:false},annotations:{readOnlyHint:false},async execute(input){
    if(!input || typeof input.question!=='string' || !input.question.trim() || input.question.length>700 || Object.keys(input).some(k=>k!=='question'))throw new Error('Provide one question between 1 and 700 characters.');
    const result=await api('ask',input);job=result;selected=job.id;state=await api('state');$('question').value=input.question;renderState();renderJob();return {id:job.id,status:job.status};
  }});
  register({name:'read_research_answer',description:'Read the selected research answer, progress, and public source links.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},async execute(input){
    if(!input || typeof input!=='object' || Array.isArray(input) || Object.keys(input).length)throw new Error('Expected an empty object.');
    if(!selected)return {status:'No answer selected'};
    job=await api('answer?id='+encodeURIComponent(selected));renderJob();return {status:job.status,answer:job.answer,sources:job.sources.map(s=>({id:s.id,url:s.url,basis:s.basis})),error:job.error};
  }});
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
