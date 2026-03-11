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

function renderPoemEditor(poem={},index=0){
  const id=poem.id?`data-id='${poem.id}'`:'';
  const status=poem.status==='draft'?'draft':'final';
  return `<div class='poem-item' ${id}>
    <div class='row-inline'><strong>Poem ${index+1}</strong><button type='button' class='btn secondary poem-remove'>Remove</button></div>
    <input class='poem-title' placeholder='Poem title' maxlength='160' value="${String(poem.title||'').replace(/"/g,'&quot;')}" />
    <textarea class='poem-text' maxlength='10000' placeholder='Paste poem text (max 10,000 characters)'>${poem.text||''}</textarea>
    <div class='row-inline'>
      <label><input type='radio' name='poem-status-${index}' value='final' ${status==='final'?'checked':''}/> Final</label>
      <label><input type='radio' name='poem-status-${index}' value='draft' ${status==='draft'?'checked':''}/> Draft</label>
    </div>
  </div>`;
}

function setupPoemUploader(){
  const target=document.getElementById('funnel');
  if(!target) return;
  const token=getCollectionToken();
  const box=card(`<h2>Build your private poem library</h2>
    <p class='muted'>Add poems one-by-one, then save as a batch. 10,000 chars each, up to 100 poems total.</p>
    <div id='poemList'></div>
    <div class='row-inline'>
      <button class='btn secondary' id='addPoemBtn' type='button'>Add another poem</button>
      <button class='btn primary' id='savePoemsBtn' type='button'>Save batch</button>
    </div>
    <div class='capture-form'><input id='poemEmailInput' type='email' placeholder='Optional email to attach later' /></div>
    <p id='poemSaveStatus' class='footer-note'></p>
    <p id='poemReturnLink' class='footer-note'></p>`);
  target.append(box);

  const list=box.querySelector('#poemList');
  const addBtn=box.querySelector('#addPoemBtn');
  const saveBtn=box.querySelector('#savePoemsBtn');
  const status=box.querySelector('#poemSaveStatus');
  const returnLink=box.querySelector('#poemReturnLink');
  const emailInput=box.querySelector('#poemEmailInput');

  const addPoem=(poem={})=>{
    const idx=list.querySelectorAll('.poem-item').length;
    const wrap=document.createElement('div');
    wrap.innerHTML=renderPoemEditor(poem,idx);
    const node=wrap.firstElementChild;
    list.append(node);
    node.querySelector('.poem-remove').addEventListener('click',()=>{node.remove();reindex();});
  };

  const reindex=()=>{
    [...list.querySelectorAll('.poem-item')].forEach((node,idx)=>{
      node.querySelector('strong').textContent=`Poem ${idx+1}`;
      node.querySelectorAll('input[type=radio]').forEach((r)=>{r.name=`poem-status-${idx}`;});
    });
  };

  addBtn.addEventListener('click',()=>{if(list.querySelectorAll('.poem-item').length<100)addPoem();});

  saveBtn.addEventListener('click',async ()=>{
    const nodes=[...list.querySelectorAll('.poem-item')];
    if(!nodes.length){status.textContent='Add at least one poem first.';return;}

    const poems=nodes.map((node)=>({
      id:node.dataset.id||undefined,
      title:node.querySelector('.poem-title').value.trim()||undefined,
      text:node.querySelector('.poem-text').value.trim(),
      status:node.querySelector('input[type=radio]:checked')?.value==='draft'?'draft':'final'
    }));

    if(poems.some((p)=>!p.text)){status.textContent='Each poem needs text before saving.';return;}

    try{
      const res=await fetch('/api/poems/batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({collectionToken:getCollectionToken(),email:emailInput.value.trim(),poems})});
      const data=await res.json();
      if(!res.ok||!data.ok) throw new Error(data.error||'save_failed');

      setCollectionToken(data.collection.token);
      status.textContent='Saved';
      returnLink.innerHTML=`Private return link: <a href='${data.returnLink}'>${location.origin}${data.returnLink}</a>`;
      list.innerHTML='';
      (data.poems||[]).forEach((p)=>addPoem(p));
      reindex();
      track('poems_saved',{count:data.counts?.total||0});
    }catch{
      status.textContent='Could not save right now. Try again.';
    }
  });

  addPoem();
  if(token){
    fetch(`/api/poems?token=${encodeURIComponent(token)}`).then(r=>r.json()).then((data)=>{
      if(!data?.ok||!data.poems?.length) return;
      list.innerHTML='';
      data.poems.forEach((p)=>addPoem(p));
      reindex();
      returnLink.innerHTML=`Private return link: <a href='/my-poems/${token}'>${location.origin}/my-poems/${token}</a>`;
      if(data.collection?.email) emailInput.value=data.collection.email;
    }).catch(()=>{});
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
      card(`<section class='hero'><p class='kicker'>${h.kicker}</p><h1>${h.title}</h1><p class='lead'>${h.subtitle}</p><p>${h.body}</p><div class='cta-row'><a class='btn primary' href='/results-demo'>${h.primaryCta}</a><a class='btn secondary' href='/types'>${h.secondaryCta}</a></div></section>`,'')
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
    funnel?.append(card(`<h2>Start in 3 steps</h2><div class='funnel-steps'><div class='funnel-step'><p class='kicker'>Step 1</p><h3>Submit your poem</h3><p>Start your profile with one piece.</p></div><div class='funnel-step'><p class='kicker'>Step 2</p><h3>Get your type</h3><p>See your primary type and adjacent traits.</p></div><div class='funnel-step'><p class='kicker'>Step 3</p><h3>Refine over time</h3><p>Add more poems to increase confidence and nuance.</p></div></div><div class='cta-row'><a class='btn primary' href='/results-demo'>See a results preview</a><a class='btn secondary' href='/types'>Browse type profiles</a></div>`));

    setupPoemUploader();
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