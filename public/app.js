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
  const status=poem.status==='draft'?'Draft':'Final';
  return `${status} · ${words}w`;
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
      <div class='sidebar-footer'>
        <input id='poemEmailInput' type='email' placeholder='Optional email' />
        <button class='btn primary' id='savePoemsBtn' type='button'>Save batch</button>
      </div>
    </aside>
    <section class='poems-main' id='poemEditorPane'></section>
  </section>
  <p id='poemSaveStatus' class='footer-note'></p>
  <p id='poemReturnLink' class='footer-note'></p>`);
  target.append(box);

  const list=box.querySelector('#threadList');
  const editor=box.querySelector('#poemEditorPane');
  const addBtn=box.querySelector('#newPoemBtn');
  const saveBtn=box.querySelector('#savePoemsBtn');
  const status=box.querySelector('#poemSaveStatus');
  const returnLink=box.querySelector('#poemReturnLink');
  const emailInput=box.querySelector('#poemEmailInput');

  let poems=[];
  let selected=-1;

  const renderEditor=()=>{
    if(selected<0||!poems[selected]){
      editor.innerHTML=`<div class='poems-empty'><h2>Select a poem</h2><p class='muted'>Choose a poem on the left, or create one with the compose button.</p></div>`;
      return;
    }
    const poem=poems[selected];
    editor.innerHTML=`<div class='editor-head'>
      <input id='editorTitle' maxlength='160' value="${String(poem.title||'').replace(/"/g,'&quot;')}" placeholder='Poem title' />
      <div class='row-inline'>
        <label><input type='radio' name='editorStatus' value='final' ${poem.status!=='draft'?'checked':''}/> Final</label>
        <label><input type='radio' name='editorStatus' value='draft' ${poem.status==='draft'?'checked':''}/> Draft</label>
        <button type='button' class='btn secondary' id='deletePoemBtn'>Delete</button>
      </div>
    </div>
    <textarea id='editorText' maxlength='10000' placeholder='Write or paste your poem...'>${poem.text||''}</textarea>`;

    editor.querySelector('#editorTitle').addEventListener('input',(e)=>{poems[selected].title=e.target.value;renderList();});
    editor.querySelector('#editorText').addEventListener('input',(e)=>{poems[selected].text=e.target.value;renderList();});
    editor.querySelectorAll('input[name=editorStatus]').forEach((r)=>r.addEventListener('change',(e)=>{poems[selected].status=e.target.value;renderList();}));
    editor.querySelector('#deletePoemBtn').addEventListener('click',()=>{
      poems.splice(selected,1);
      selected=Math.min(selected,poems.length-1);
      renderList();
      renderEditor();
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
    poems.push({id:poem.id,title:poem.title||'',text:poem.text||'',status:poem.status==='draft'?'draft':'final'});
    selected=poems.length-1;
    renderList();
    renderEditor();
  };

  addBtn.addEventListener('click',()=>addPoem({title:'',text:'',status:'draft'}));

  saveBtn.addEventListener('click',async ()=>{
    if(!poems.length){status.textContent='Add at least one poem first.';return;}
    const payload=poems.map((p)=>({id:p.id||undefined,title:(p.title||'').trim()||undefined,text:(p.text||'').trim(),status:p.status==='draft'?'draft':'final'}));
    if(payload.some((p)=>!p.text)){status.textContent='Each poem needs text before saving.';return;}

    try{
      const res=await fetch('/api/poems/batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({collectionToken:getCollectionToken(),email:emailInput.value.trim(),poems:payload})});
      const data=await res.json();
      if(!res.ok||!data.ok) throw new Error(data.error||'save_failed');
      setCollectionToken(data.collection.token);
      poems=(data.poems||[]).map((p)=>({id:p.id,title:p.title||'',text:p.text||'',status:p.status==='draft'?'draft':'final'}));
      selected=Math.max(0,Math.min(selected,poems.length-1));
      status.textContent='Saved';
      returnLink.innerHTML=`Private return link: <a href='${data.returnLink}'>${location.origin}${data.returnLink}</a>`;
      renderList();
      renderEditor();
      track('poems_saved',{count:data.counts?.total||0});
    }catch{
      status.textContent='Could not save right now. Try again.';
    }
  });

  if(token){
    fetch(`/api/poems?token=${encodeURIComponent(token)}`).then(r=>r.json()).then((data)=>{
      if(data?.ok&&Array.isArray(data.poems)&&data.poems.length){
        poems=data.poems.map((p)=>({id:p.id,title:p.title||'',text:p.text||'',status:p.status==='draft'?'draft':'final'}));
        selected=0;
        returnLink.innerHTML=`Private return link: <a href='/my-poems/${token}'>${location.origin}/my-poems/${token}</a>`;
        if(data.collection?.email) emailInput.value=data.collection.email;
      } else addPoem({title:'',text:'',status:'draft'});
      renderList();
      renderEditor();
    }).catch(()=>{addPoem({title:'',text:'',status:'draft'});});
  } else {
    addPoem({title:'',text:'',status:'draft'});
  }
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
        const row=card(`<h3>${poem.title||`Poem ${idx+1}`}</h3><p class='chip'>${poem.status==='draft'?'Draft':'Final'}</p><pre class='poem-pre'></pre><div class='row-inline'><button class='btn secondary poem-delete' type='button'>Delete</button></div>`);
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
    funnel?.append(card(`<h2>Start in 4 steps</h2><div class='funnel-steps'><div class='funnel-step'><p class='kicker'>Step 1</p><h3>Open Analyze</h3><p>Go to the dedicated Analyze page.</p></div><div class='funnel-step'><p class='kicker'>Step 2</p><h3>Add poems one-by-one</h3><p>Paste each poem and click Add another poem.</p></div><div class='funnel-step'><p class='kicker'>Step 3</p><h3>Choose draft or final</h3><p>Set each poem status and edit as needed.</p></div><div class='funnel-step'><p class='kicker'>Step 4</p><h3>Save batch</h3><p>Save and keep your private return link.</p></div></div><div class='cta-row'><a class='btn primary' href='/analyze'>Analyze now</a><a class='btn secondary' href='/types'>Browse type profiles</a></div>`));
  }

  if(path==='/analyze'){
    const root=document.getElementById('analyzeRoot');
    root?.append(card(`<section class='hero'><p class='kicker'>Analyze</p><h1>Discover Your Poet Personality</h1><p class='lead'>Build your private poem collection and save everything in one batch.</p></section>`,''));
    root?.append(card(`<h2>Start in 3 steps</h2><div class='funnel-steps'><div class='funnel-step'><p class='kicker'>Step 1</p><h3>Add your poems</h3><p>Paste your poems into the form one-by-one.</p></div><div class='funnel-step'><p class='kicker'>Step 2</p><h3>Set draft or final</h3><p>Mark each poem’s status and edit anytime.</p></div><div class='funnel-step'><p class='kicker'>Step 3</p><h3>Save your batch</h3><p>Save your poems and keep your private return link.</p></div></div>`));
    root?.append(card(`<div id='analyzeUploader'></div>`));
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

  if(path.startsWith('/my-poems/')) setupMyPoemsPage();

  setupReveal();
  setupClickTracking();
  setupEmailCapture();
})();