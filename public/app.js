async function loadContent(){const r=await fetch('/api/content');return r.json();}
const el=(tag,cls)=>{const x=document.createElement(tag);if(cls)x.className=cls;return x;};
function card(inner,cls='card'){const d=el('div',cls);d.innerHTML=inner;return d;}

async function track(name,meta={}){
  try{
    await fetch('/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,page:location.pathname,meta})});
  }catch{}
}

function setupReveal(){
  const items=[...document.querySelectorAll('.reveal, .card')];
  if(!('IntersectionObserver' in window)){items.forEach(i=>i.classList.add('in'));return;}
  const io=new IntersectionObserver((entries)=>{
    entries.forEach((e)=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});
  },{threshold:.08,rootMargin:'0px 0px -20px 0px'});
  items.forEach(i=>io.observe(i));
}

function setupClickTracking(){
  document.querySelectorAll('a.btn, nav a').forEach((a)=>{
    a.addEventListener('click',()=>track('cta_click',{label:a.textContent?.trim()||'',href:a.getAttribute('href')||''}));
  });
}

function setupEmailCapture(){
  const form=document.getElementById('emailCaptureForm');
  const input=document.getElementById('emailInput');
  const status=document.getElementById('emailStatus');
  if(!form||!input||!status) return;

  form.addEventListener('submit',async (e)=>{
    e.preventDefault();
    const email=input.value.trim();
    if(!email||!email.includes('@')){status.textContent='Please enter a valid email.';return;}

    try{
      const res=await fetch('/api/lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,source:'results_capture',page:location.pathname})});
      if(!res.ok) throw new Error('capture_failed');
      localStorage.setItem('poet_personality_email',email);
      status.textContent='Saved. We’ll send profile refinement prompts and updates.';
      form.reset();
      track('lead_captured',{source:'results_capture'});
    }catch{
      status.textContent='Could not save right now. Please try again.';
    }
  });
}

function getCollectionToken(){
  const saved=localStorage.getItem('poet_personality_collection_token');
  if(saved) return saved;
  return null;
}

function setCollectionToken(token){
  if(token) localStorage.setItem('poet_personality_collection_token',token);
}

function formatMeta(poem){
  const words=String(poem.text||'').trim().split(/\s+/).filter(Boolean).length;
  const updated=poem.updatedAt?new Date(poem.updatedAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}):'';
  return updated?`${words}w · ${updated}`:`${words}w`;
}

function setupPoemUploader(targetId='funnel'){
  const target=document.getElementById(targetId);
  if(!target) return;
  const token=getCollectionToken();
  const box=card(`<section class='poems-shell'>
    <aside class='poems-sidebar'>
      <div class='poems-sidebar-top'>
        <h3>Poems</h3>
        <button class='compose-btn' id='newPoemBtn' type='button' title='New poem'>✎</button>
      </div>
      <div id='threadList' class='thread-list'></div>
    </aside>
    <section class='poems-main' id='poemEditorPane'></section>
  </section>
  <p id='poemSaveStatus' class='footer-note subtle-status'></p>
  <section class='analysis-zone'>
    <div class='analysis-top'>
      <h3>Reveal your poet personality</h3>
      <button class='btn primary' id='analyzePoemsBtn' type='button'>Analyze</button>
    </div>
    <div id='analysisResult' class='analysis-result muted'>Write a few poems, then run analysis for an identity-level reading.</div>
  </section>`, 'poems-wrapper');
  target.append(box);

  const list=box.querySelector('#threadList');
  const editor=box.querySelector('#poemEditorPane');
  const addBtn=box.querySelector('#newPoemBtn');
  const analyzeBtn=box.querySelector('#analyzePoemsBtn');
  const analysisResult=box.querySelector('#analysisResult');
  const status=box.querySelector('#poemSaveStatus');

  let poems=[];
  let selected=-1;
  let saveTimer=null;
  let isSaving=false;

  const syncStatus=(text)=>{status.textContent=text||'';};

  const queueSave=()=>{
    if(selected<0||!poems[selected]) return;
    poems[selected].updatedAt=new Date().toISOString();
    renderList();
    syncStatus('Saving…');
    clearTimeout(saveTimer);
    saveTimer=setTimeout(saveNow, 450);
  };

  const saveNow=async()=>{
    if(isSaving||selected<0||!poems[selected]) return;
    isSaving=true;
    const poem=poems[selected];
    const text=(poem.text||'').trim();
    if(!text){isSaving=false;syncStatus('');return;}

    try{
      const res=await fetch('/api/poems/batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({collectionToken:getCollectionToken(),poems:[{id:poem.id||undefined,title:(poem.title||'').trim()||undefined,text}]})});
      const data=await res.json();
      if(!res.ok||!data.ok) throw new Error(data.error||'save_failed');
      setCollectionToken(data.collection.token);
      const saved=(data.poems||[]).find((p)=>p.id===poem.id)||data.poems?.[data.poems.length-1];
      if(saved){
        poems[selected]={id:saved.id,title:saved.title||'',text:saved.text||'',updatedAt:saved.updated_at};
      }
      syncStatus('Saved');
      track('poems_saved',{count:data.counts?.total||0});
      renderList();
    }catch{
      syncStatus('Could not save');
    }finally{
      isSaving=false;
    }
  };

  const renderEditor=()=>{
    if(selected<0||!poems[selected]){
      editor.innerHTML=`<div class='poems-empty'><h2>Select a poem</h2><p class='muted'>Choose a poem on the left, or create one with the compose button.</p></div>`;
      return;
    }
    const poem=poems[selected];
    editor.innerHTML=`<div class='editor-head'>
      <input id='editorTitle' maxlength='160' value="${String(poem.title||'').replace(/"/g,'&quot;')}" placeholder='Poem title' />
      <button type='button' class='btn secondary' id='deletePoemBtn'>Delete</button>
    </div>
    <textarea id='editorText' maxlength='10000' placeholder='Write or paste your poem...'>${poem.text||''}</textarea>`;

    editor.querySelector('#editorTitle').addEventListener('input',(e)=>{poems[selected].title=e.target.value;queueSave();});
    editor.querySelector('#editorText').addEventListener('input',(e)=>{poems[selected].text=e.target.value;queueSave();});
    editor.querySelector('#deletePoemBtn').addEventListener('click',()=>{
      poems.splice(selected,1);
      selected=Math.min(selected,poems.length-1);
      renderList();
      renderEditor();
      syncStatus('');
    });
  };

  const renderList=()=>{
    if(!poems.length){list.innerHTML=`<div class='thread-empty muted'>No poems yet.</div>`;return;}
    list.innerHTML=poems.map((poem,idx)=>{
      const title=(poem.title||`Untitled poem ${idx+1}`).trim();
      const preview=(poem.text||'').replace(/\s+/g,' ').trim().slice(0,90)||'No content yet';
      return `<button type='button' class='thread-row ${idx===selected?'active':''}' data-idx='${idx}'>
        <div class='thread-main'>
          <div class='thread-title'>${title.replace(/</g,'&lt;')}</div>
          <div class='thread-preview'>${preview.replace(/</g,'&lt;')}</div>
        </div>
        <div class='thread-meta'>${formatMeta(poem)}</div>
      </button>`;
    }).join('');
    list.querySelectorAll('.thread-row').forEach((btn)=>btn.addEventListener('click',()=>{selected=Number(btn.dataset.idx);renderList();renderEditor();}));
  };

  const addPoem=(poem={})=>{
    if(poems.length>=100) return;
    poems.push({id:poem.id,title:poem.title||'',text:poem.text||'',updatedAt:poem.updated_at||poem.updatedAt||null});
    selected=poems.length-1;
    renderList();
    renderEditor();
    queueSave();
  };

  const pickTraitChips=(a)=>{
    const base=[...(a?.observations?.recurringThemes||[])];
    const mood=String(a?.observations?.emotionalPattern||'').toLowerCase();
    if(mood.includes('tender')||mood.includes('ardent')) base.push('Romantic');
    if(mood.includes('contemplative')||mood.includes('inquisitive')) base.push('Philosophical');
    if(mood.includes('elegiac')||mood.includes('vulnerable')) base.push('Melancholic');
    if(mood.includes('controlled')||mood.includes('deliberate')) base.push('Controlled');
    if(mood.includes('luminous')||mood.includes('intense')) base.push('Dreamlike');
    return [...new Set(base)].slice(0,6);
  };

  const renderAnalysis=(payload)=>{
    const a=payload?.analysis;
    if(!a){analysisResult.innerHTML='No analysis yet.';return;}
    const chips=pickTraitChips(a);
    const archetypeHref=a.personalitySlug?`/type/${a.personalitySlug}`:'/types';
    analysisResult.classList.remove('muted');
    analysisResult.innerHTML=`
      <div class='analysis-stage stage-1'>
        <div class='analysis-hero'>
          <p class='kicker'>Matched Archetype</p>
          <h2>${a.personalityTitle}</h2>
          <p class='lead'>${a.summary}</p>
        </div>
      </div>
      <div class='analysis-stage stage-2'>
        <div class='analysis-chips'>${chips.map((t)=>`<span class='analysis-chip'>${t}</span>`).join('')}</div>
      </div>
      <div class='analysis-stage stage-3'>
        <div class='analysis-prose'>
          <h3>Why this personality fits</h3>
          <p>${a.commentary}</p>
        </div>
      </div>
      <div class='analysis-stage stage-4'>
        <div class='analysis-grid'>
          <div><h4>Core emotional signature</h4><p>${a.observations?.emotionalPattern||''}</p></div>
          <div><h4>Recurring themes</h4><p>${(a.observations?.recurringThemes||[]).join(' · ')}</p></div>
          <div><h4>Imagery and symbols</h4><p>${a.observations?.imageryAndTone||''}</p></div>
          <div><h4>Voice and tone</h4><p>${a.observations?.structureAndVoice||''}</p></div>
          <div><h4>Worldview / poetic instincts</h4><p>${a.observations?.worldview||''}</p></div>
        </div>
      </div>
      <div class='analysis-stage stage-5'>
        <div class='analysis-end-action'><a class='btn secondary' href='${archetypeHref}'>Learn more</a></div>
      </div>`;

    const stages=[...analysisResult.querySelectorAll('.analysis-stage')];
    stages.forEach((node,idx)=>setTimeout(()=>node.classList.add('in'),140*idx+120));
  };

  addBtn.addEventListener('click',()=>addPoem({title:'',text:''}));
  analyzeBtn.addEventListener('click',async ()=>{
    const payload=poems.map((p)=>({title:(p.title||'').trim(),text:(p.text||'').trim()})).filter((p)=>p.text);
    if(!payload.length){analysisResult.classList.add('muted');analysisResult.textContent='Add poem text first, then analyze.';return;}
    analyzeBtn.disabled=true;
    analysisResult.classList.add('muted');
    analysisResult.innerHTML=`<div class='analysis-loading'><span class='pulse-dot'></span><span>Analyzing voice, themes, and poetic identity…</span></div>`;
    try{
      const res=await fetch('/api/poems/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({collectionToken:getCollectionToken(),poems:payload})});
      const data=await res.json();
      if(!res.ok||!data.ok) throw new Error('analysis_failed');
      renderAnalysis(data);
    }catch{
      analysisResult.classList.add('muted');
      analysisResult.textContent='Could not analyze right now. Please try again.';
    }finally{analyzeBtn.disabled=false;}
  });

  if(token){
    fetch(`/api/poems?token=${encodeURIComponent(token)}`).then(r=>r.json()).then((data)=>{
      if(data?.ok&&Array.isArray(data.poems)&&data.poems.length){
        poems=data.poems.map((p)=>({id:p.id,title:p.title||'',text:p.text||'',updatedAt:p.updated_at||null}));
        selected=0;
      } else addPoem({title:'',text:''});
      renderList();
      renderEditor();
      syncStatus('');
    }).catch(()=>{addPoem({title:'',text:''});});
  } else {
    addPoem({title:'',text:''});
  }
}

function setupAccountPage(){
  const root=document.getElementById('accountRoot');
  if(!root) return;

  root.append(card(`<section class='auth-shell'>
    <h1>Welcome</h1>
    <p class='muted'>Create an account or sign in to continue.</p>
    <form id='authForm' class='auth-form'>
      <label class='auth-input'>
        <span class='auth-icon'>👤</span>
        <input id='authName' type='text' placeholder='Name' maxlength='120' required />
      </label>
      <label class='auth-input'>
        <span class='auth-icon'>✉️</span>
        <input id='authEmail' type='email' placeholder='E-mail' required />
      </label>
      <label class='auth-input'>
        <span class='auth-icon'>🔒</span>
        <input id='authPassword' type='password' placeholder='Password' minlength='8' required />
      </label>
      <div class='auth-actions'>
        <button class='btn primary auth-pill' id='signUpBtn' type='button'>Sign Up</button>
        <button class='btn secondary auth-pill muted-btn' id='signInBtn' type='button'>Sign In</button>
      </div>
    </form>
    <p id='accountStatus' class='footer-note'></p>
  </section>`));

  const status=root.querySelector('#accountStatus');
  const setStatus=(x)=>status.textContent=x||'';

  const readFields=()=>({
    name:root.querySelector('#authName').value.trim(),
    email:root.querySelector('#authEmail').value.trim(),
    password:root.querySelector('#authPassword').value
  });

  root.querySelector('#signUpBtn').addEventListener('click',async ()=>{
    const {name,email,password}=readFields();
    setStatus('Creating account…');
    try{
      const res=await fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,password})});
      const data=await res.json();
      if(!res.ok||!data.ok) throw new Error(data.error||'register_failed');
      setStatus('You’re signed up.');
    }catch(err){setStatus(`Could not sign up (${err.message}).`);}
  });

  root.querySelector('#signInBtn').addEventListener('click',async ()=>{
    const {email,password}=readFields();
    setStatus('Signing in…');
    try{
      const res=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
      const data=await res.json();
      if(!res.ok||!data.ok) throw new Error(data.error||'login_failed');
      setStatus('You’re signed in.');
    }catch(err){setStatus(`Could not sign in (${err.message}).`);}
  });
}

function setupMyPoemsPage(){
  const root=document.getElementById('myPoems');
  if(!root) return;
  const token=location.pathname.split('/').pop();
  root.append(card(`<h1>My Poems</h1><p class='muted'>This page is private to your return link token.</p><div id='myPoemsList'></div><p id='myPoemsStatus' class='footer-note'></p>`));
  const list=root.querySelector('#myPoemsList');
  const status=root.querySelector('#myPoemsStatus');

  const load=async()=>{
    try{
      const res=await fetch(`/api/poems?token=${encodeURIComponent(token)}`);
      const data=await res.json();
      if(!res.ok||!data.ok) throw new Error('fetch_failed');
      setCollectionToken(token);
      list.innerHTML='';
      (data.poems||[]).forEach((poem,idx)=>{
        const row=card(`<h3>${poem.title||`Poem ${idx+1}`}</h3><pre class='poem-pre'></pre><div class='row-inline'><button class='btn secondary poem-delete' type='button'>Delete</button></div>`);
        row.querySelector('.poem-pre').textContent=poem.text||'';
        row.querySelector('.poem-delete').addEventListener('click',async ()=>{
          const del=await fetch(`/api/poems/${encodeURIComponent(poem.id)}?token=${encodeURIComponent(token)}`,{method:'DELETE'});
          if(del.ok){status.textContent='Deleted';load();}
        });
        list.append(row);
      });
      status.textContent='Saved';
    }catch{
      status.textContent='Could not load poems.';
    }
  };
  load();
}

(async()=>{
  const data=await loadContent();
  const path=location.pathname;
  track('page_view',{path});

  if(path==='/'){
    const h=data.homepage.hero;
    document.getElementById('hero')?.append(
      card(`<section class='hero'><p class='kicker'>${h.kicker}</p><h1>${h.title}</h1><p class='lead'>${h.subtitle}</p><p>${h.body}</p><div class='cta-row'><a class='btn primary' href='/analyze'>${h.primaryCta}</a><a class='btn secondary' href='/types'>${h.secondaryCta}</a></div></section>`,'')
    );

    const proof=document.getElementById('proof');
    (data.homepage.proofStrip||[]).forEach(line=>proof?.append(card(`<p>${line}</p>`)));

    const how=document.getElementById('how');
    how?.append(card(`<h2>${data.howItWorks.title}</h2><p class='muted'>${data.howItWorks.intro}</p>`));
    const grid=el('section','grid');
    data.howItWorks.steps.forEach((s,i)=>grid.append(card(`<p class='kicker'>Step ${i+1}</p><h3>${s.title}</h3><p>${s.body}</p>`)));
    how?.append(grid);

    const tiers=el('section','card');
    tiers.innerHTML=`<h2>Profile Strength</h2><div class='statline'>${data.profileStrength.map(p=>`<span class='stat'>${p.label} · ${p.range}</span>`).join('')}</div><p class='footer-note'>One poem can reflect a mood. Multiple poems reveal durable patterns.</p>`;
    how?.append(tiers);

    const funnel=document.getElementById('funnel');
    funnel?.append(card(`<h2>Start in 3 steps</h2><div class='funnel-steps'><div class='funnel-step'><p class='kicker'>Step 1</p><h3>Open Analyze</h3><p>Go to the dedicated Analyze page.</p></div><div class='funnel-step'><p class='kicker'>Step 2</p><h3>Add poems one-by-one</h3><p>Paste each poem and click compose to add another.</p></div><div class='funnel-step'><p class='kicker'>Step 3</p><h3>Edit freely</h3><p>Your poems auto-save while you write.</p></div></div><div class='cta-row'><a class='btn primary' href='/analyze'>Analyze now</a><a class='btn secondary' href='/types'>Browse type profiles</a></div>`));
  }

  if(path==='/analyze'){
    const root=document.getElementById('analyzeRoot');
    root?.append(card(`<section class='hero'><p class='kicker'>Analyze</p><h1>Discover Your Poet Personality</h1><p class='lead'>Build your private poem collection and save everything in one batch.</p></section>`,''));
    root?.append(card(`<h2>Start in 3 steps</h2><div class='funnel-steps'><div class='funnel-step'><p class='kicker'>Step 1</p><h3>Add your poems</h3><p>Paste your poems into the workspace one-by-one.</p></div><div class='funnel-step'><p class='kicker'>Step 2</p><h3>Organize and refine</h3><p>Open any poem from the sidebar and edit anytime.</p></div><div class='funnel-step'><p class='kicker'>Step 3</p><h3>Keep writing</h3><p>Everything auto-saves while you work.</p></div></div>`));
root?.insertAdjacentHTML('beforeend',`<section id='analyzeUploader' class='reveal'></section>`);
    setupPoemUploader('analyzeUploader');
  }

  if(path==='/types'){
    const grid=document.getElementById('typesGrid');
    data.types.forEach(t=>grid?.append(card(`<div class='type-card'><span class='chip'>${t.group}</span><h3>${t.name}</h3><p>${t.shortBlurb}</p><a href='/type/${t.slug}'>View full profile →</a></div>`)));
  }

  if(path.startsWith('/type/')){
    const slug=path.split('/').pop();
    const t=data.types.find(x=>x.slug===slug);
    const all=data.types;
    const elRoot=document.getElementById('typePage');
    if(!t){elRoot?.append(card('<h2>Type not found</h2><p class="muted">Try browsing from the 16 types page.</p>'));setupReveal();setupClickTracking();return;}

    const siblings=all.filter(x=>x.group===t.group && x.slug!==t.slug).slice(0,3);

    elRoot?.append(card(`<section class='hero'><p class='kicker'>${t.group}</p><h1>${t.name}</h1><p class='lead'>${t.subtitle}</p><p>${t.overview}</p><p class='quote'><strong>${t.idealTagline}</strong></p></section>`,''));
    elRoot?.append(card(`<div class='two-col'><section><h2>Strengths</h2><ul class='list'>${t.strengths.map(x=>`<li>${x}</li>`).join('')}</ul></section><section><h2>Challenges</h2><ul class='list'>${t.challenges.map(x=>`<li>${x}</li>`).join('')}</ul></section></div>`));
    elRoot?.append(card(`<h2>What the analyzer detects</h2><ul class='list'>${t.analyzerDetects.map(x=>`<li>${x}</li>`).join('')}</ul>`));
    elRoot?.append(card(`<h2>Famous poets with similar energy</h2><p>${t.famousPoetsWithSimilarEnergy.copy}</p><p class='footer-note'>${t.famousPoetsWithSimilarEnergy.disclaimer}</p>`));
    elRoot?.append(card(`<h2>Related types in ${t.group}</h2><p class='inline-links'>${siblings.map(x=>`<a href='/type/${x.slug}'>${x.name}</a>`).join(' · ')}</p>`));
  }

  if(path==='/categories'){
    const c=document.getElementById('categories');
    data.groups.forEach(g=>{
      const list=g.types
        .map(slug=>data.types.find(t=>t.slug===slug))
        .filter(Boolean)
        .map(t=>`<a href='/type/${t.slug}'>${t.name}</a>`)
        .join(' · ');
      c?.append(card(`<h2>${g.name}</h2><p>${g.description}</p><p class='inline-links'>${list}</p>`));
    });
  }

  if(path==='/account') setupAccountPage();
  if(path.startsWith('/my-poems/')) setupMyPoemsPage();

  setupReveal();
  setupClickTracking();
  setupEmailCapture();
})();