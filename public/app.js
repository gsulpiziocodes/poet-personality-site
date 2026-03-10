async function loadContent(){const r=await fetch('/api/content');return r.json();}
function card(inner){const d=document.createElement('div');d.className='card';d.innerHTML=inner;return d;}

(async()=>{
  const data=await loadContent();
  const path=location.pathname;

  if(path==='/' ){
    const hero=document.getElementById('hero');
    const h=data.homepage.hero;
    hero.append(card(`<p>${h.kicker}</p><h1>${h.title}</h1><p>${h.subtitle}</p><p>${h.body}</p><p><a href='/types'>${h.secondaryCta}</a> · <a href='/results-demo'>${h.primaryCta}</a></p>`));
    const how=document.getElementById('how');
    how.append(card(`<h2>${data.howItWorks.title}</h2><p>${data.howItWorks.intro}</p>`));
    data.howItWorks.steps.forEach(s=>how.append(card(`<h3>${s.title}</h3><p>${s.body}</p>`)));
  }

  if(path==='/types'){
    const grid=document.getElementById('typesGrid');
    data.types.forEach(t=>grid.append(card(`<h3>${t.name}</h3><p class='muted'>${t.group}</p><p>${t.shortBlurb}</p><a href='/type/${t.slug}'>View type</a>`)));
  }

  if(path.startsWith('/type/')){
    const slug=path.split('/').pop();
    const t=data.types.find(x=>x.slug===slug);
    const el=document.getElementById('typePage');
    if(!t){el.append(card('<h2>Type not found</h2>'));return;}
    el.append(card(`<p class='muted'>${t.group}</p><h1>${t.name}</h1><p>${t.subtitle}</p><p>${t.overview}</p>`));
    el.append(card(`<h2>Strengths</h2><ul>${t.strengths.map(x=>`<li>${x}</li>`).join('')}</ul>`));
    el.append(card(`<h2>Challenges</h2><ul>${t.challenges.map(x=>`<li>${x}</li>`).join('')}</ul>`));
    el.append(card(`<h2>What the analyzer detects</h2><ul>${t.analyzerDetects.map(x=>`<li>${x}</li>`).join('')}</ul>`));
    el.append(card(`<h2>Ideal tagline</h2><p><strong>${t.idealTagline}</strong></p>`));
    el.append(card(`<h2>Famous poets with similar energy</h2><p>${t.famousPoetsWithSimilarEnergy.copy}</p><p class='muted'>${t.famousPoetsWithSimilarEnergy.disclaimer}</p>`));
  }

  if(path==='/categories'){
    const c=document.getElementById('categories');
    data.groups.forEach(g=>c.append(card(`<h2>${g.name}</h2><p>${g.description}</p><p class='muted'>${g.types.length} types</p>`)));
  }
})();