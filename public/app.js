async function loadContent(){const r=await fetch('/api/content');return r.json();}
const el=(tag,cls)=>{const x=document.createElement(tag);if(cls)x.className=cls;return x;};
function card(inner,cls='card'){const d=el('div',cls);d.innerHTML=inner;return d;}

(async()=>{
  const data=await loadContent();
  const path=location.pathname;

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
    if(!t){elRoot?.append(card('<h2>Type not found</h2><p class="muted">Try browsing from the 16 types page.</p>'));return;}

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
})();