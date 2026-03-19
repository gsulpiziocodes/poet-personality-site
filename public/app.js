async function loadContent(){const r=await fetch('/api/content');return r.json();}
const el=(tag,cls)=>{const x=document.createElement(tag);if(cls)x.className=cls;return x;};
function card(inner,cls='card'){const d=el('div',cls);d.innerHTML=inner;return d;}

function escapeHtml(value=''){return String(value).replace(/[&<>"']/g,(ch)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));}

function titleCaseWords(value=''){return String(value).split(/\s+/).filter(Boolean).map((w)=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ');}

function buildRadarChart(type){
  const profile=type.radarProfile||{};
  const axes=[
    {key:'emotionalIntensity',label:'Emotional Intensity'},
    {key:'imagerySymbolism',label:'Imagery & Symbolism'},
    {key:'structuralControl',label:'Structural Control'},
    {key:'narrativeDrive',label:'Narrative Drive'},
    {key:'directness',label:'Directness'},
    {key:'vulnerability',label:'Vulnerability'}
  ];

  const values=axes.map((a)=>Math.max(0,Math.min(100,Number(profile[a.key]||0))));

  // Use a larger viewBox with generous padding so labels never clip.
  const size=440;
  const c=size/2;
  const radarRadius=108;
  const labelRadius=162;
  const steps=[20,40,60,80,100];

  const point=(idx,val,radius=radarRadius)=>{
    const angle=(-Math.PI/2)+(idx*(Math.PI*2/axes.length));
    const rr=(val/100)*radius;
    return [c+Math.cos(angle)*rr,c+Math.sin(angle)*rr,angle];
  };

  const splitLabel=(label)=>{
    const words=String(label||'').split(' ');
    if(words.length<=2) return [label];
    const first=[];
    const second=[];
    words.forEach((w)=>{
      const target=(first.join(' ').length<=second.join(' ').length)?first:second;
      target.push(w);
    });
    return [first.join(' '),second.join(' ')].filter(Boolean).slice(0,2);
  };

  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const poly=(val)=>axes.map((_,i)=>{const [x,y]=point(i,val);return `${x},${y}`;}).join(' ');
  const area=values.map((v,i)=>{const [x,y]=point(i,v);return `${x},${y}`;}).join(' ');

  const axisLines=axes.map((_,i)=>{const [x,y]=point(i,100);return `<line x1='${c}' y1='${c}' x2='${x}' y2='${y}'/>`;}).join('');
  const rings=steps.map((s)=>`<polygon points='${poly(s)}'/>`).join('');

  const labels=axes.map((a,i)=>{
    let [lx,ly,angle]=point(i,100,labelRadius);
    lx=clamp(lx,30,size-30);
    ly=clamp(ly,30,size-30);

    const cos=Math.cos(angle);
    const sin=Math.sin(angle);
    let anchor='middle';
    if(cos<-0.28) anchor='end';
    if(cos>0.28) anchor='start';

    const lines=splitLabel(a.label);
    const lineHeight=12;
    const scoreGap=sin>0.45?9:8;
    const labelStartY=ly;
    const scoreY=labelStartY-scoreGap;

    const labelLines=lines.map((line,idx)=>`<tspan x='${lx}' dy='${idx===0?0:lineHeight}'>${escapeHtml(line)}</tspan>`).join('');

    return `<g class='radar-label-group'>
      <text class='radar-value' x='${lx}' y='${scoreY}' text-anchor='${anchor}'>${values[i]}</text>
      <text class='radar-label' x='${lx}' y='${labelStartY}' text-anchor='${anchor}'>${labelLines}</text>
    </g>`;
  }).join('');

  return `
    <section class='type-radar-card' aria-label='Signature trait map'>
      <div class='type-radar-head'>
        <h3>Signature Trait Map</h3>
        <p class='muted'>Baseline pattern for ${escapeHtml(type.name)} (0–100)</p>
      </div>
      <svg class='type-radar' viewBox='0 0 ${size} ${size}' preserveAspectRatio='xMidYMid meet' role='img' aria-label='Radar chart of ${escapeHtml(type.name)} traits'>
        <g class='radar-rings'>${rings}</g>
        <g class='radar-axes'>${axisLines}</g>
        <polygon class='radar-area' points='${area}'/>
        <polygon class='radar-outline' points='${area}'/>
        ${labels}
      </svg>
    </section>`;
}

function buildOverviewSections(type){
  const strengths=(type.strengths||[]).slice(0,4).map(titleCaseWords);
  const challenges=(type.challenges||[]).slice(0,3).map(titleCaseWords);
  const signals=(type.analyzerDetects||[]).slice(0,3).map(titleCaseWords);

  return [
    {
      title:`What is ${type.name} like?`,
      body:[
        `${type.name} is a poetic orientation shaped by recurring themes, tonal instincts, and craft decisions over time.`,
        `${type.overview}`
      ]
    },
    {
      title:'Words that capture this type',
      list:strengths
    },
    {
      title:`How to recognize ${type.name}`,
      body:[
        `You can usually recognize this type through patterns such as ${signals.join(', ')}.`,
        `In practice, this voice tends to feel consistent in emotional posture and aesthetic choices across poems.`
      ]
    },
    {
      title:`What ${type.name} values`,
      body:[
        `This type values emotional and artistic integrity: writing that says something true, sounds intentional, and leaves resonance.`,
        `Its healthiest expression blends authenticity with craft rather than choosing one over the other.`
      ]
    },
    {
      title:'Growth edges',
      body:[`Common growth edges include ${challenges.join(', ')}. Developing range here usually deepens both clarity and impact.`]
    }
  ];
}

function buildStrengthsShadowSections(type){
  const strengths=(type.strengths||[]).slice(0,4).map(titleCaseWords);
  const challenges=(type.challenges||[]).slice(0,4).map(titleCaseWords);
  const groupStress={
    'Visionaries':`Under stress, ${type.name} may retreat into abstraction and become harder to read emotionally.`,
    'Romantics':`Under stress, ${type.name} may become emotionally overextended and read situations through longing or fear.`,
    'Truth-Tellers':`Under stress, ${type.name} may sharpen into defensiveness, intensity, or emotional hard lines.`,
    'Makers':`Under stress, ${type.name} may over-focus on delivery or structure and lose contact with emotional center.`
  };
  const groupMotivation={
    'Visionaries':`What motivates this type most is discovery: finding new meaning, deeper coherence, and hidden pattern.`,
    'Romantics':`What motivates this type most is emotional resonance: writing that creates closeness, beauty, and felt connection.`,
    'Truth-Tellers':`What motivates this type most is honesty: saying what matters clearly, courageously, and without pretense.`,
    'Makers':`What motivates this type most is craft mastery: shaping language with precision, momentum, and memorable form.`
  };

  return [
    {
      title:`The most prominent ${type.name} strengths`,
      list:strengths
    },
    {
      title:`The key ${type.name} shadows`,
      list:challenges
    },
    {
      title:'How this type handles stress',
      body:[
        groupStress[type.group]||`${type.name} tends to narrow toward familiar instincts under pressure.`,
        `When this pattern is unexamined, common shadow expressions include ${challenges.join(', ').toLowerCase()}.`
      ]
    },
    {
      title:`What motivates ${type.name}`,
      body:[
        groupMotivation[type.group]||`This type is motivated by meaningful expression and artistic integrity.`,
        `At its best, motivation increases when there is both emotional truth and clear artistic direction.`
      ]
    },
    {
      title:`How to grow as ${type.name}`,
      body:[
        `Practice range intentionally: keep your strengths, but write against your default habits at least once per week.`,
        `Choose one shadow to work on at a time—for example, moving from "${(challenges[0]||'over-control').toLowerCase()}" toward clarity and balance.`,
        `Use revision as integration: preserve your voice while improving readability, contrast, and emotional precision.`
      ]
    }
  ];
}

function buildLoveRelationshipSections(type){
  const traits=(type.strengths||[]).slice(0,3).map((x)=>x.toLowerCase());
  const shadows=(type.challenges||[]).slice(0,3).map((x)=>x.toLowerCase());
  const groupPartnerFocus={
    'Visionaries':'an intellectually curious partner who welcomes depth, complexity, and independent thought',
    'Romantics':'an emotionally available partner who values tenderness, intimacy, and expressive affection',
    'Truth-Tellers':'an emotionally courageous partner who values honesty, accountability, and direct communication',
    'Makers':'a grounded partner who appreciates craft, consistency, and expressive discipline'
  };
  const loveLanguageByType={
    'The Alchemist':'Emotional attunement',
    'The Oracle':'Deep conversation',
    'The Architect':'Reliable follow-through',
    'The Seeker':'Intellectual companionship',
    'The Lover':'Affection and closeness',
    'The Dreamer':'Tender quality time',
    'The Muse':'Verbal affirmation',
    'The Devotee':'Acts of devotion',
    'The Confessor':'Radical honesty',
    'The Witness':'Steady presence',
    'The Rebel':'Authentic freedom',
    'The Mourner':'Gentle reassurance',
    'The Storyteller':'Shared experiences',
    'The Minimalist':'Clear communication',
    'The Performer':'Expressive affirmation',
    'The Weaver':'Nuanced understanding'
  };

  return [
    {
      title:`What is ${type.name} like in romantic relationships?`,
      body:[
        `${type.name} often loves through ${traits.join(', ')}, and typically seeks connection that feels emotionally real rather than performative.`,
        `In close bonds, this type tends to value autonomy and depth at the same time—space to remain themselves, and enough trust to be fully known.`
      ]
    },
    {
      title:`What ${type.name} looks for in a partner`,
      body:[
        `This type is often drawn to ${groupPartnerFocus[type.group]||'a partner who is emotionally mature, communicative, and growth-oriented'}.`,
        `Compatibility is highest when both people can respect differences in process while still meeting each other with consistency.`
      ]
    },
    {
      title:`${type.name} love language`,
      body:[`A common love-language pattern for this type is ${loveLanguageByType[type.name]||'Intentional presence'}—consistent signals of care that feel sincere, not performative.`]
    },
    {
      title:`How to love ${type.name}`,
      body:[
        `Lead with direct, respectful communication; this type usually responds best to clarity over mind-reading.`,
        `Support their strengths (${traits.join(', ')}) while helping them regulate shadow patterns like ${shadows.join(', ')} under stress.`,
        `Give appreciation in the form they naturally recognize, and keep conflict focused on repair rather than point-scoring.`
      ]
    }
  ];
}

function buildCoreTraitSections(type){
  const traits=(type.strengths||[]).slice(0,4).map(titleCaseWords);
  const signals=(type.analyzerDetects||[]).slice(0,3).map(titleCaseWords);
  const groupLens={
    'Visionaries':'interpretive depth and meaning-making',
    'Romantics':'emotional atmosphere and relational resonance',
    'Truth-Tellers':'candor, realism, and moral clarity',
    'Makers':'craft control, delivery, and form intelligence'
  };

  return [
    {
      title:`What defines ${type.name}`,
      body:[
        `${type.name} is primarily defined by ${groupLens[type.group]||'a distinct emotional and stylistic center'}, expressed consistently across poems.`,
        `These traits usually show up regardless of topic, because they describe your default poetic operating system.`
      ]
    },
    {
      title:`Core ${type.name} traits`,
      list:traits
    },
    {
      title:'How these traits appear in real writing',
      body:[
        `In practice, this type often reveals itself through signals such as ${signals.join(', ')}.`,
        `The strongest trait expression feels intentional, not accidental—it repeats with variation over time.`
      ]
    },
    {
      title:'Trait range: healthy vs overextended',
      body:[
        `At healthy range, these traits produce coherence and signature voice.`,
        `When overextended, strengths can harden into rigidity, overuse, or tonal imbalance.`
      ]
    }
  ];
}

function buildWritingStyleSections(type){
  const signals=(type.analyzerDetects||[]).slice(0,3).map(titleCaseWords);
  const groupCraft={
    'Visionaries':'symbolic layering and conceptual movement',
    'Romantics':'sensory lyricism and emotional pacing',
    'Truth-Tellers':'direct diction and grounded scene pressure',
    'Makers':'form architecture, rhythm, and compositional control'
  };

  return [
    {
      title:`How ${type.name} writes`,
      body:[
        `${type.name} writing is usually recognizable by its recurring relationship to ${groupCraft[type.group]||'voice, structure, and emotional movement'}.`,
        `The page-level choices matter as much as theme: syntax, line breaks, pacing, and imagery all reinforce type identity.`
      ]
    },
    {
      title:'Signature writing signals',
      list:signals
    },
    {
      title:'Voice and line movement',
      body:[
        `This type typically carries a distinct cadence pattern—how lines breathe, accelerate, pause, and resolve.`,
        `Readers often recognize the voice before they can name the technique behind it.`
      ]
    },
    {
      title:'Revision guidance for this style',
      body:[
        `Keep the signature signals, but reduce repetition by varying scale (line, stanza, and structural turn).`,
        `Edit toward precision: preserve your emotional center while increasing clarity and reread value.`
      ]
    }
  ];
}

function renderTypeProfileTabs(root,t,siblings){
  const traits=(t.strengths||[]).slice(0,3);
  const shadows=(t.challenges||[]).slice(0,3);
  const signals=(t.analyzerDetects||[]).slice(0,3);
  const custom=t.profileTabs||{};

  const mergeTab=(base,customTab)=>{
    if(!customTab) return base;
    const out={...base,...customTab};
    if(Array.isArray(customTab.list)) out.list=customTab.list.map((x)=>`<li>${escapeHtml(x)}</li>`);
    if(customTab.split){
      out.split={
        leftTitle:customTab.split.leftTitle||base.split?.leftTitle||'Strengths',
        leftItems:Array.isArray(customTab.split.leftItems)&&customTab.split.leftItems.length?customTab.split.leftItems:(base.split?.leftItems||[]),
        rightTitle:customTab.split.rightTitle||base.split?.rightTitle||'Shadows',
        rightItems:Array.isArray(customTab.split.rightItems)&&customTab.split.rightItems.length?customTab.split.rightItems:(base.split?.rightItems||[])
      };
    }
    return out;
  };

  const tabs=[
    mergeTab({
      id:'overview',
      label:'Overview',
      heading:`${t.name}: Overview`,
      kicker:t.group,
      intro:t.subtitle,
      body:[
        t.overview,
        `This profile sits inside the ${t.group} family, where poetic energy tends to prioritize ${signals.join(', ')}.`
      ],
      callout:`${t.idealTagline}`
    },custom.overview),
    mergeTab({
      id:'core-traits',
      label:'Core traits',
      heading:`Core traits of ${t.name}`,
      kicker:'Poetic signature',
      intro:'The recurring energies this type returns to across poems.',
      list:traits.map((x)=>`<li>${escapeHtml(x)}</li>`),
      body:[`At its center, this type carries a distinct pattern of voice, emotional stance, and aesthetic instinct.`]
    },custom.coreTraits),
    mergeTab({
      id:'strengths-shadows',
      label:'Strengths & shadows',
      heading:'Strengths & shadows',
      kicker:'Range and risk',
      intro:'Every poetic gift has an edge. This section maps both.',
      split:{leftTitle:'Strengths',leftItems:traits,rightTitle:'Shadows',rightItems:shadows},
      body:['When consciously balanced, this type can produce deeply memorable work with both force and nuance.']
    },custom.strengthsShadows),
    mergeTab({
      id:'writing-style',
      label:'Writing style',
      heading:'Writing style',
      kicker:'Craft signals',
      intro:'How this voice typically appears on the page.',
      list:signals.map((x)=>`<li>${escapeHtml(x)}</li>`),
      body:[`Readers often experience ${t.name} writing as intentional, textured, and emotionally coherent.`]
    },custom.writingStyle),
    mergeTab({
      id:'love-relationships',
      label:'In love & relationships',
      heading:'In love & relationships',
      kicker:'Relational expression',
      intro:'How this poetic energy may show up in intimacy, attachment, and emotional language.',
      body:[
        `${t.name} energy in relationships often mirrors its writing tendencies: ${traits.join(', ')}.`,
        `In close bonds, the shadow side can look like ${shadows.join(', ')}, especially under stress or uncertainty.`,
        'When grounded, this type tends to communicate with sincerity, depth, and a strong desire to be truly understood.'
      ]
    },custom.loveRelationships)
  ];

  const typeImageSrc=`/images/${t.slug}.png`;

  const shell=card(`
    <section class='type-tabs-wrap'>
      <aside class='type-tabs-nav' aria-label='Type profile sections'>
        <div class='type-tabs-card' role='tablist' aria-orientation='vertical'>
          ${tabs.map((tab,idx)=>`<button class='type-tab-btn ${idx===0?'active':''}' role='tab' aria-selected='${idx===0?'true':'false'}' data-tab='${tab.id}' id='tab-${tab.id}'>${tab.label}</button>`).join('')}
        </div>
      </aside>
      <section class='type-tabs-panel' aria-live='polite'>
        <div class='type-panel-hero type-panel-hero-split'>
          <div class='type-panel-hero-copy'>
            <p class='kicker'>${escapeHtml(t.group)}</p>
            <h1>${escapeHtml(t.name)}</h1>
            <p class='lead'>${escapeHtml(t.subtitle)}</p>
          </div>
          <figure class='type-hero-art' data-type='${escapeHtml(t.slug)}'><img src='${escapeHtml(typeImageSrc)}' alt='${escapeHtml(t.name)} personality illustration' loading='lazy'/></figure>
        </div>
        <article id='typeTabContent' class='type-panel-content'></article>
      </section>
    </section>
  `,'card type-tabs-shell');

  const content=shell.querySelector('#typeTabContent');
  const buttons=[...shell.querySelectorAll('.type-tab-btn')];

  const renderBody=(tab)=>{
    const bodyHtml=(tab.body||[]).map((p)=>`<p>${escapeHtml(p)}</p>`).join('');
    const listHtml=tab.list?.length?`<ul class='list'>${tab.list.join('')}</ul>`:'';
    const splitHtml=tab.split?`
      <div class='two-col'>
        <section>
          <h3>${escapeHtml(tab.split.leftTitle)}</h3>
          <ul class='list'>${tab.split.leftItems.map((x)=>`<li>${escapeHtml(x)}</li>`).join('')}</ul>
        </section>
        <section>
          <h3>${escapeHtml(tab.split.rightTitle)}</h3>
          <ul class='list'>${tab.split.rightItems.map((x)=>`<li>${escapeHtml(x)}</li>`).join('')}</ul>
        </section>
      </div>
    `:'';

    const detailSections=(tab.id==='overview')
      ? (tab.sections||buildOverviewSections(t))
      : (tab.id==='core-traits')
        ? (tab.sections||buildCoreTraitSections(t))
        : (tab.id==='strengths-shadows')
          ? (tab.sections||buildStrengthsShadowSections(t))
          : (tab.id==='writing-style')
            ? (tab.sections||buildWritingStyleSections(t))
            : (tab.id==='love-relationships')
              ? (tab.sections||buildLoveRelationshipSections(t))
              : [];
    const sectionNav=detailSections.length>1?`<nav class='type-section-nav' aria-label='Section quick links'>${detailSections.map((section,idx)=>`<a href='#type-section-${idx}' class='type-section-link'>${escapeHtml(section.title||`Section ${idx+1}`)}</a>`).join('')}</nav>`:'';
    const sectionHtml=detailSections.length?detailSections.map((section,idx)=>{
      const sBody=(section.body||[]).map((p)=>`<p>${escapeHtml(p)}</p>`).join('');
      const sList=(section.list||[]).length?`<ul class='list'>${section.list.map((x)=>`<li>${escapeHtml(x)}</li>`).join('')}</ul>`:'';
      return `<section class='type-detail-block' id='type-section-${idx}'><h3>${escapeHtml(section.title||'')}</h3>${sBody}${sList}</section>`;
    }).join(''):'';

    const radarHtml=(tab.id==='overview')?buildRadarChart(t):'';
    const related=siblings.length?`<p class='footer-note'>Related in ${escapeHtml(t.group)}: ${siblings.map((x)=>`<a href='/type/${x.slug}'>${escapeHtml(x.name)}</a>`).join(' · ')}</p>`:'';
    const poets=`<p class='footer-note'>${escapeHtml(t.famousPoetsWithSimilarEnergy.copy)}<br/><span class='muted'>${escapeHtml(t.famousPoetsWithSimilarEnergy.disclaimer)}</span></p>`;

    content.classList.remove('in');
    window.requestAnimationFrame(()=>{
      content.innerHTML=`
        <div class='type-panel-inner'>
          <p class='kicker'>${escapeHtml(tab.kicker||'')}</p>
          <h2>${escapeHtml(tab.heading)}</h2>
          ${tab.id==='overview'
            ? `<p class='lead'>${escapeHtml(tab.intro||'')}</p>${bodyHtml}${listHtml}${splitHtml}${sectionNav}<div class='overview-radar-row'>${radarHtml}</div>${sectionHtml}`
            : `<p class='lead'>${escapeHtml(tab.intro||'')}</p>${bodyHtml}${listHtml}${splitHtml}${radarHtml}${sectionNav}${sectionHtml}`}
          ${tab.callout?`<p class='quote type-pull-quote'><strong>${escapeHtml(tab.callout)}</strong></p>`:''}
          ${tab.id==='overview'?poets:''}
          ${related}
        </div>`;
      content.classList.add('in');
    });
  };

  buttons.forEach((btn)=>btn.addEventListener('click',()=>{
    const tab=tabs.find((x)=>x.id===btn.dataset.tab);
    if(!tab) return;
    buttons.forEach((b)=>{const active=b===btn;b.classList.toggle('active',active);b.setAttribute('aria-selected',active?'true':'false');});
    renderBody(tab);
  }));

  renderBody(tabs[0]);
  root.append(shell);
}

function getPreferredTheme(){
  const saved=localStorage.getItem('pp_theme');
  if(saved==='light'||saved==='dark') return saved;
  return window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
}

function applyTheme(theme){
  document.documentElement.setAttribute('data-theme',theme);
  localStorage.setItem('pp_theme',theme);
}

function setupThemeToggle(){
  const top=document.querySelector('.site-top');
  const current=document.documentElement.getAttribute('data-theme')||'light';
  const next=current==='dark'?'light':'dark';
  const label=current==='dark'?'☀ Light':'🌙 Dark';

  const btn=el('button','theme-toggle');
  btn.type='button';
  btn.textContent=label;
  btn.setAttribute('aria-label',`Switch to ${next} mode`);
  btn.addEventListener('click',()=>{applyTheme(next);setupThemeToggle();});

  if(top){
    const existing=top.querySelector('.theme-toggle');
    if(existing) existing.remove();
    top.append(btn);
    return;
  }

  const floating=document.querySelector('.theme-floating');
  if(floating) floating.remove();
  const wrap=el('div','theme-floating');
  wrap.style.position='fixed';
  wrap.style.top='14px';
  wrap.style.right='14px';
  wrap.style.zIndex='999';
  wrap.append(btn);
  document.body.append(wrap);
}

async function setupGlobalAccountButton(){
  const top=document.querySelector('.site-top');
  if(!top) return;

  let user=null;
  try{
    const res=await fetch('/api/auth/me');
    const data=await res.json();
    user=data?.user||null;
  }catch{}

  const existing=top.querySelector('.account-corner');
  if(existing) existing.remove();

  const wrap=el('div','account-corner');
  const link=el('a','account-corner-btn');
  if(user){
    const userLabel=(user.name||String(user.email||'').split('@')[0]||'Account').trim();
    link.href='/settings';
    link.textContent=userLabel;
    link.title='Account settings';
  }else{
    link.href='/account';
    link.textContent='Sign In';
  }
  wrap.append(link);
  top.append(wrap);
}

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

function setupTopNav(){
  const currentPath=location.pathname;
  const activeHref=currentPath.startsWith('/type/')?'/types':currentPath;
  document.querySelectorAll('.site-top nav a[href^="/"]').forEach((a)=>{
    const hrefRaw=a.getAttribute('href')||'';
    const href=hrefRaw==='/'?'/':hrefRaw.replace(/\/+$/,'');
    const isCurrent=activeHref===href;
    const baseLabel=(a.dataset.baseLabel||a.textContent||'').trim();
    a.dataset.baseLabel=baseLabel;
    a.classList.toggle('active',isCurrent);
    if(isCurrent){
      a.setAttribute('aria-current','page');
    }else{
      a.removeAttribute('aria-current');
    }
    a.textContent=baseLabel;
  });
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

async function setupAccountPage(){
  const root=document.getElementById('accountRoot');
  if(!root) return;

  try{
    const res=await fetch('/api/auth/me');
    const data=await res.json();
    if(data?.user){location.href='/settings';return;}
  }catch{}

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
      <div class='password-feedback hidden' id='passwordFeedback'>
        <div class='password-strength-row'>
          <span class='password-strength-label'>Password strength</span>
          <span id='passwordStrength' class='password-strength-value weak'>Weak</span>
        </div>
        <ul class='password-rules'>
          <li id='ruleLength' class='unmet'><span>8+ characters</span><small id='ruleLengthMeta'>0 characters</small></li>
          <li id='ruleSpecial' class='unmet'><span>1 special character</span><small id='ruleSpecialMeta'>0 special characters</small></li>
          <li id='ruleNumber' class='unmet'><span>1 number</span></li>
          <li id='ruleUpper' class='unmet'><span>1 uppercase letter</span></li>
        </ul>
      </div>
      <div class='auth-actions'>
        <button class='btn primary auth-pill' id='signUpBtn' type='button'>Sign Up</button>
        <button class='btn secondary auth-pill muted-btn' id='signInBtn' type='button'>Sign In</button>
      </div>
      <a class='auth-sub-link' href='/forgot-password'>Forgot password?</a>
    </form>
    <p id='accountStatus' class='footer-note'></p>
  </section>`));

  const status=root.querySelector('#accountStatus');
  const passwordInput=root.querySelector('#authPassword');
  const passwordFeedback=root.querySelector('#passwordFeedback');
  const strengthEl=root.querySelector('#passwordStrength');
  const ruleLength=root.querySelector('#ruleLength');
  const ruleSpecial=root.querySelector('#ruleSpecial');
  const ruleNumber=root.querySelector('#ruleNumber');
  const ruleUpper=root.querySelector('#ruleUpper');
  const ruleLengthMeta=root.querySelector('#ruleLengthMeta');
  const ruleSpecialMeta=root.querySelector('#ruleSpecialMeta');
  const setStatus=(x)=>status.textContent=x||'';

  const setRuleState=(el,met)=>{
    el.classList.toggle('met',!!met);
    el.classList.toggle('unmet',!met);
  };

  const updatePasswordFeedback=()=>{
    const password=passwordInput.value||'';
    passwordFeedback.classList.toggle('hidden',password.length===0);
    const len=password.length;
    const specialCount=(password.match(/[^A-Za-z0-9]/g)||[]).length;
    const hasLength=len>=8;
    const hasSpecial=specialCount>=1;
    const hasNumber=/\d/.test(password);
    const hasUpper=/[A-Z]/.test(password);

    ruleLengthMeta.textContent=`${len} character${len===1?'':'s'}`;
    ruleSpecialMeta.textContent=`${specialCount} special character${specialCount===1?'':'s'}`;

    setRuleState(ruleLength,hasLength);
    setRuleState(ruleSpecial,hasSpecial);
    setRuleState(ruleNumber,hasNumber);
    setRuleState(ruleUpper,hasUpper);

    const metCount=[hasLength,hasSpecial,hasNumber,hasUpper].filter(Boolean).length;
    let label='Weak';
    let tone='weak';

    if(len>=14 && metCount===4){label='Excellent';tone='excellent';}
    else if(len>=10 && metCount>=3){label='Strong';tone='strong';}
    else if(len>=8 && metCount>=2){label='Good';tone='good';}

    strengthEl.textContent=label;
    strengthEl.className=`password-strength-value ${tone}`;
  };

  updatePasswordFeedback();
  passwordInput.addEventListener('input',updatePasswordFeedback);

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
      location.href='/dashboard';
    }catch(err){setStatus(`Could not sign up (${err.message}).`);}
  });

  root.querySelector('#signInBtn').addEventListener('click',async ()=>{
    const {email,password}=readFields();
    setStatus('Signing in…');
    try{
      const res=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
      const data=await res.json();
      if(!res.ok||!data.ok) throw new Error(data.error||'login_failed');
      location.href='/dashboard';
    }catch(err){setStatus(`Could not sign in (${err.message}).`);}
  });
}

async function setupDashboardPage(){
  const root=document.getElementById('dashboardRoot');
  if(!root) return;

  try{
    const res=await fetch('/api/auth/me');
    const data=await res.json();
    if(!data?.user){location.href='/account';return;}

    const name=(data.user.name||data.user.email||'Writer').trim();

    root.append(card(`<section class='hero'>
      <p class='kicker'>Dashboard</p>
      <h1>Welcome, ${name.replace(/</g,'&lt;')}</h1>
      <p class='lead'>You’re signed in. Ready to keep building your Versiq?</p>
      <div class='cta-row'>
        <a class='btn primary' href='/analyze'>Continue Writing</a>
        <a class='btn secondary' href='/settings'>Account Settings</a>
      </div>
    </section>`,''));
  }catch{
    location.href='/account';
  }
}

async function setupSettingsPage(){
  const root=document.getElementById('settingsRoot');
  if(!root) return;

  try{
    const res=await fetch('/api/auth/me');
    const data=await res.json();
    if(!data?.user){location.href='/account';return;}

    const user=data.user;
    const displayName=(user.name||'').trim()||'Writer';
    const safeName=displayName.replace(/</g,'&lt;');
    const safeEmail=String(user.email||'').replace(/</g,'&lt;');
    const username=safeEmail.split('@')[0]||'poet';


    root.append(card(`<section class='settings-shell'>
      <aside class='settings-sidebar'>
        <a href='#profile' class='active'>Profile</a>
        <a href='#account'>Account</a>
        <a href='#billing'>Billing</a>
        <a href='#preferences'>Preferences</a>
        <a href='#security'>Security</a>
      </aside>
      <section class='settings-main'>
        <article id='profile' class='settings-card'>
          <div class='settings-head'><h2>Profile</h2><p>How your identity appears in the app.</p></div>
          <div class='profile-row'>
            <div class='avatar'>${safeName.slice(0,1).toUpperCase()}</div>
            <div>
              <h3>${safeName}</h3>
              <p class='muted'>${safeEmail}</p>
            </div>
          </div>
          <div class='settings-grid'>
            <label><span>Display name</span><input id='setDisplayName' value='${safeName.replace(/'/g,'&#39;')}' /></label>
            <label><span>Email address</span><input id='setEmailProfile' value='${safeEmail.replace(/'/g,'&#39;')}' /></label>
            <label><span>Username</span><input value='${username.replace(/'/g,'&#39;')}' /></label>
          </div>
          <div class='settings-actions'><button class='btn primary' id='saveProfileBtn'>Edit profile</button></div>
        </article>

        <article id='account' class='settings-card'>
          <div class='settings-head'><h2>Account Information</h2><p>Core account details and recovery identity.</p></div>
          <div class='settings-grid'>
            <label><span>Name</span><input id='setName' value='${safeName.replace(/'/g,'&#39;')}' /></label>
            <label><span>Email</span><input id='setEmail' value='${safeEmail.replace(/'/g,'&#39;')}' /></label>
            <label><span>Password</span><input type='password' value='••••••••••' /></label>
          </div>
          <div class='settings-actions'><button class='btn secondary' id='changePasswordBtn'>Change password</button><button class='btn secondary' id='updateEmailBtn'>Update email</button></div>
        </article>

        <article id='billing' class='settings-card'>
          <div class='settings-head'><h2>Subscription / Plan</h2><p>Billing and plan controls.</p></div>
          <div class='settings-grid compact'>
            <div><span class='label'>Current plan</span><strong>Free</strong></div>
            <div><span class='label'>Billing status</span><strong>Active</strong></div>
            <div><span class='label'>Renewal date</span><strong>—</strong></div>
          </div>
          <div class='settings-actions'><button class='btn primary'>Upgrade / Manage Plan</button></div>
        </article>

        <article id='preferences' class='settings-card'>
          <div class='settings-head'><h2>Preferences</h2><p>Control how and when we contact you.</p></div>
          <div class='toggle-list'>
            <label class='toggle-row'><span><strong>Notification preferences</strong><small>Product updates and key alerts</small></span><input type='checkbox' id='prefNotify' checked /></label>
            <label class='toggle-row'><span><strong>Email updates</strong><small>Important account-related emails</small></span><input type='checkbox' id='prefEmail' checked /></label>
            <label class='toggle-row'><span><strong>Marketing emails</strong><small>Tips, launches, and offers</small></span><input type='checkbox' id='prefMarketing' /></label>
            <label class='toggle-row'><span><strong>Appearance</strong><small>Prefer dark theme</small></span><input type='checkbox' id='prefTheme' /></label>
          </div>
        </article>

        <article id='security' class='settings-card danger-wrap'>
          <div class='settings-head'><h2>Privacy / Security</h2><p>Keep your account safe and under your control.</p></div>
          <div class='settings-actions'><button class='btn secondary'>Enable Two-Factor Authentication</button><button class='btn secondary'>View Login Activity</button><button class='btn secondary' id='logoutAllBtn'>Sign out of all devices</button></div>
          <div class='danger-zone'>
            <h3>Danger zone</h3>
            <p class='muted'>This action is permanent and cannot be undone.</p>
            <button class='btn danger' id='deleteAccountBtn'>Delete account</button>
          </div>
        </article>

        <div class='settings-save-row'>
          <button class='btn primary' id='saveSettingsBtn'>Save Changes</button>
          <p id='settingsStatus' class='footer-note'></p>
        </div>
      </section>
    </section>`));

    const status=root.querySelector('#settingsStatus');
    const setStatus=(m)=>{status.textContent=m||'';};

    const prefKeys=['prefNotify','prefEmail','prefMarketing','prefTheme'];
    const saved=JSON.parse(localStorage.getItem('pp_settings_prefs')||'{}');
    prefKeys.forEach((k)=>{const el=root.querySelector(`#${k}`);if(el&&typeof saved[k]==='boolean')el.checked=saved[k];});

    root.querySelector('#saveProfileBtn')?.addEventListener('click',()=>setStatus('Profile edits staged. Click Save Changes to confirm.'));
    root.querySelector('#changePasswordBtn')?.addEventListener('click',()=>setStatus('Password update flow coming next.'));
    root.querySelector('#updateEmailBtn')?.addEventListener('click',()=>setStatus('Email update flow coming next.'));

    root.querySelector('#logoutAllBtn')?.addEventListener('click',async ()=>{
      await fetch('/api/auth/logout',{method:'POST'});
      location.href='/account';
    });

    root.querySelector('#deleteAccountBtn')?.addEventListener('click',()=>setStatus('Delete account is intentionally protected. Add backend confirm flow before enabling.'));

    root.querySelector('#saveSettingsBtn')?.addEventListener('click',()=>{
      const prefs={};
      prefKeys.forEach((k)=>{const el=root.querySelector(`#${k}`);if(el)prefs[k]=!!el.checked;});
      localStorage.setItem('pp_settings_prefs',JSON.stringify(prefs));
      setStatus('Changes saved.');
    });

  }catch{
    location.href='/account';
  }
}

function passwordChecks(password=''){
  const len=password.length;
  const specialCount=(password.match(/[^A-Za-z0-9]/g)||[]).length;
  return {
    len,
    specialCount,
    hasLength:len>=8,
    hasSpecial:specialCount>=1,
    hasNumber:/\d/.test(password),
    hasUpper:/[A-Z]/.test(password)
  };
}

function setupForgotPasswordPage(){
  const root=document.getElementById('forgotRoot');
  if(!root) return;

  root.innerHTML=`<section class='auth-shell auth-card'>
    <p class='kicker'>Account Recovery</p>
    <h1>Forgot Password?</h1>
    <p class='muted'>Enter your email and we’ll send a secure password reset link.</p>
    <form id='forgotForm' class='auth-form'>
      <label class='auth-input'>
        <span class='auth-icon'>✉️</span>
        <input id='forgotEmail' type='email' placeholder='E-mail' required />
      </label>
      <p id='forgotError' class='inline-error hidden'>Please enter a valid email address.</p>
      <button class='btn primary auth-pill' id='forgotSendBtn' type='submit' disabled>Send Reset Link</button>
      <a class='auth-sub-link' href='/account'>Back to Sign In</a>
    </form>
    <section id='forgotSent' class='hidden'>
      <div class='status-good'>Password reset email sent.</div>
      <p class='muted'>If an account exists for <strong id='forgotSentEmail'></strong>, we’ve sent reset instructions. Check inbox and spam.</p>
      <div class='auth-actions single'>
        <button class='btn secondary auth-pill' id='resendBtn' type='button'>Resend email</button>
      </div>
      <a class='auth-sub-link' href='/account'>Back to Sign In</a>
    </section>
  </section>`;

  const emailInput=root.querySelector('#forgotEmail');
  const sendBtn=root.querySelector('#forgotSendBtn');
  const form=root.querySelector('#forgotForm');
  const sent=root.querySelector('#forgotSent');
  const err=root.querySelector('#forgotError');
  const sentEmail=root.querySelector('#forgotSentEmail');

  const isValidEmail=(email)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email||'').trim());
  const update=()=>{sendBtn.disabled=!isValidEmail(emailInput.value);err.classList.add('hidden');};
  emailInput.addEventListener('input',update);
  update();

  const submit=async()=>{
    const email=emailInput.value.trim();
    if(!isValidEmail(email)){err.classList.remove('hidden');return;}
    sendBtn.disabled=true;
    const original=sendBtn.textContent;
    sendBtn.textContent='Sending…';
    try{
      await fetch('/api/auth/forgot-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});
      sentEmail.textContent=email;
      form.classList.add('hidden');
      sent.classList.remove('hidden');
    }finally{
      sendBtn.textContent=original;
      update();
    }
  };

  form.addEventListener('submit',async (e)=>{e.preventDefault();await submit();});
  root.querySelector('#resendBtn')?.addEventListener('click',submit);
}

function setupResetPasswordPage(){
  const root=document.getElementById('resetRoot');
  if(!root) return;
  const token=new URLSearchParams(location.search).get('token')||'';

  root.innerHTML=`<section class='auth-shell auth-card'>
    <h1>Reset Your Password</h1>
    <p class='muted'>Choose a new secure password for your account.</p>
    <div id='resetInvalid' class='status-bad hidden'>This reset link is invalid or expired. Request a new one.</div>
    <form id='resetForm' class='auth-form hidden'>
      <label class='auth-input'>
        <span class='auth-icon'>🔒</span>
        <input id='newPassword' type='password' placeholder='New password' required />
        <button class='input-toggle' id='toggleNewPassword' type='button'>Show</button>
      </label>
      <div class='password-feedback' id='resetFeedback'>
        <div class='password-strength-row'>
          <span class='password-strength-label'>Password strength</span>
          <span id='resetStrength' class='password-strength-value weak'>Weak</span>
        </div>
        <ul class='password-rules'>
          <li id='rLen' class='unmet'><span>8+ characters</span><small id='rLenMeta'>0 characters</small></li>
          <li id='rSpec' class='unmet'><span>1 special character</span><small id='rSpecMeta'>0 special characters</small></li>
          <li id='rNum' class='unmet'><span>1 number</span></li>
          <li id='rUp' class='unmet'><span>1 uppercase letter</span></li>
        </ul>
      </div>
      <label class='auth-input'>
        <span class='auth-icon'>🔒</span>
        <input id='confirmPassword' type='password' placeholder='Confirm new password' required />
        <button class='input-toggle' id='toggleConfirmPassword' type='button'>Show</button>
      </label>
      <p id='matchError' class='inline-error hidden'>Passwords do not match.</p>
      <button class='btn primary auth-pill' id='resetBtn' type='submit' disabled>Reset Password</button>
    </form>
    <section id='resetSuccess' class='hidden'>
      <div class='status-good'>Password successfully updated.</div>
      <p class='muted'>Your password has been reset. You can now log in with your new password.</p>
      <a class='btn primary auth-pill' href='/account'>Sign In</a>
    </section>
  </section>`;

  const invalid=root.querySelector('#resetInvalid');
  const form=root.querySelector('#resetForm');
  const success=root.querySelector('#resetSuccess');
  const newPassword=root.querySelector('#newPassword');
  const confirmPassword=root.querySelector('#confirmPassword');
  const resetBtn=root.querySelector('#resetBtn');
  const matchError=root.querySelector('#matchError');
  const strength=root.querySelector('#resetStrength');
  const toggleNew=root.querySelector('#toggleNewPassword');
  const toggleConfirm=root.querySelector('#toggleConfirmPassword');
  const rLen=root.querySelector('#rLen');
  const rSpec=root.querySelector('#rSpec');
  const rNum=root.querySelector('#rNum');
  const rUp=root.querySelector('#rUp');
  const rLenMeta=root.querySelector('#rLenMeta');
  const rSpecMeta=root.querySelector('#rSpecMeta');

  const setRule=(el,ok)=>{el.classList.toggle('met',ok);el.classList.toggle('unmet',!ok);};

  const refresh=()=>{
    const checks=passwordChecks(newPassword.value||'');
    rLenMeta.textContent=`${checks.len} character${checks.len===1?'':'s'}`;
    rSpecMeta.textContent=`${checks.specialCount} special character${checks.specialCount===1?'':'s'}`;
    setRule(rLen,checks.hasLength);
    setRule(rSpec,checks.hasSpecial);
    setRule(rNum,checks.hasNumber);
    setRule(rUp,checks.hasUpper);

    const met=[checks.hasLength,checks.hasSpecial,checks.hasNumber,checks.hasUpper].filter(Boolean).length;
    let label='Weak'; let tone='weak';
    if(checks.len>=14&&met===4){label='Excellent';tone='excellent';}
    else if(checks.len>=10&&met>=3){label='Strong';tone='strong';}
    else if(checks.len>=8&&met>=2){label='Good';tone='good';}
    strength.textContent=label;
    strength.className=`password-strength-value ${tone}`;

    const matches=(newPassword.value||'')===(confirmPassword.value||'')&&confirmPassword.value.length>0;
    const valid=checks.hasLength&&checks.hasSpecial&&checks.hasNumber&&checks.hasUpper&&matches;
    matchError.classList.toggle('hidden',confirmPassword.value.length===0||matches);
    resetBtn.disabled=!valid;
  };

  const bindToggle=(btn,input)=>{
    btn?.addEventListener('click',()=>{
      const reveal=input.type==='password';
      input.type=reveal?'text':'password';
      btn.textContent=reveal?'Hide':'Show';
    });
  };

  bindToggle(toggleNew,newPassword);
  bindToggle(toggleConfirm,confirmPassword);

  newPassword.addEventListener('input',refresh);
  confirmPassword.addEventListener('input',refresh);

  const init=async()=>{
    if(!token){invalid.classList.remove('hidden');return;}
    const res=await fetch(`/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`);
    if(!res.ok){invalid.classList.remove('hidden');return;}
    form.classList.remove('hidden');
    refresh();
  };

  form.addEventListener('submit',async (e)=>{
    e.preventDefault();
    refresh();
    if(resetBtn.disabled) return;
    const original=resetBtn.textContent;
    resetBtn.disabled=true;
    resetBtn.textContent='Resetting…';
    const res=await fetch('/api/auth/reset-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,password:newPassword.value})});
    if(!res.ok){
      invalid.classList.remove('hidden');
      form.classList.add('hidden');
      return;
    }
    form.classList.add('hidden');
    success.classList.remove('hidden');
    resetBtn.textContent=original;
  });

  init().catch(()=>invalid.classList.remove('hidden'));
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
  applyTheme(getPreferredTheme());
  const data=await loadContent();
  const path=location.pathname;
  setupTopNav();
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
    root?.append(card(`<section class='hero'><p class='kicker'>Analyze</p><h1>Discover Your Versiq</h1><p class='lead'>Build your private poem collection and save everything in one batch.</p></section>`,''));
    root?.append(card(`<h2>Start in 3 steps</h2><div class='funnel-steps'><div class='funnel-step'><p class='kicker'>Step 1</p><h3>Add your poems</h3><p>Paste your poems into the workspace one-by-one.</p></div><div class='funnel-step'><p class='kicker'>Step 2</p><h3>Organize and refine</h3><p>Open any poem from the sidebar and edit anytime.</p></div><div class='funnel-step'><p class='kicker'>Step 3</p><h3>Keep writing</h3><p>Everything auto-saves while you work.</p></div></div>`));
root?.insertAdjacentHTML('beforeend',`<section id='analyzeUploader' class='reveal'></section>`);
    setupPoemUploader('analyzeUploader');
  }

  if(path==='/types'){
    const grid=document.getElementById('typesGrid');
    data.types.forEach(t=>grid?.append(card(`<div class='type-card'><figure class='type-card-art'><img src='/images/${t.slug}.png' alt='${t.name} personality illustration' loading='lazy'/></figure><span class='chip'>${t.group}</span><h3>${t.name}</h3><p>${t.shortBlurb}</p><a class='type-card-cta' href='/type/${t.slug}'><span>View full profile</span><span aria-hidden='true'>→</span></a></div>`)));
  }

  if(path.startsWith('/type/')){
    const slug=path.split('/').pop();
    const t=data.types.find(x=>x.slug===slug);
    const all=data.types;
    const elRoot=document.getElementById('typePage');
    if(!t){elRoot?.append(card('<h2>Type not found</h2><p class="muted">Try browsing from the 16 types page.</p>'));setupReveal();setupClickTracking();return;}

    const siblings=all.filter(x=>x.group===t.group && x.slug!==t.slug).slice(0,3);
    renderTypeProfileTabs(elRoot,t,siblings);
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

  if(path==='/account') await setupAccountPage();
  if(path==='/forgot-password') setupForgotPasswordPage();
  if(path==='/reset-password') setupResetPasswordPage();
  if(path==='/dashboard') setupDashboardPage();
  if(path==='/settings') setupSettingsPage();
  if(path.startsWith('/my-poems/')) setupMyPoemsPage();

  setupReveal();
  setupClickTracking();
  setupEmailCapture();
  setupThemeToggle();
  await setupGlobalAccountButton();
})();