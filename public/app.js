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
        <p class='muted'>Baseline pattern for ${escapeHtml(type.name)} (0-100)</p>
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
      title:`The key ${type.name} weaknesses`,
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
        `Choose one shadow to work on at a time-for example, moving from "${(challenges[0]||'over-control').toLowerCase()}" toward clarity and balance.`,
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
  const compatibilityByType={
    'The Alchemist':['The Muse','The Devotee','The Witness'],
    'The Oracle':['The Seeker','The Weaver','The Lover'],
    'The Architect':['The Minimalist','The Witness','The Weaver'],
    'The Seeker':['The Oracle','The Dreamer','The Confessor'],
    'The Lover':['The Muse','The Devotee','The Storyteller'],
    'The Dreamer':['The Seeker','The Lover','The Mourner'],
    'The Muse':['The Lover','The Alchemist','The Performer'],
    'The Devotee':['The Lover','The Witness','The Storyteller'],
    'The Confessor':['The Witness','The Seeker','The Rebel'],
    'The Witness':['The Confessor','The Architect','The Devotee'],
    'The Rebel':['The Confessor','The Performer','The Alchemist'],
    'The Mourner':['The Dreamer','The Witness','The Lover'],
    'The Storyteller':['The Performer','The Lover','The Devotee'],
    'The Minimalist':['The Architect','The Witness','The Weaver'],
    'The Performer':['The Storyteller','The Muse','The Rebel'],
    'The Weaver':['The Oracle','The Architect','The Minimalist']
  };
  const compatibilityReasonByName={
    'The Muse':'brings warmth and expressive affirmation that keeps connection emotionally alive',
    'The Devotee':'offers steady loyalty and tenderness that supports emotional safety',
    'The Witness':'grounds the relationship with calm presence and practical stability',
    'The Seeker':'adds curiosity and deep conversation that keeps growth active',
    'The Weaver':'helps both people feel understood through nuance and emotional intelligence',
    'The Lover':'strengthens closeness through affection, openness, and emotional responsiveness',
    'The Minimalist':'adds clarity, structure, and low-drama communication habits',
    'The Dreamer':'softens intensity with imagination, empathy, and emotional gentleness',
    'The Confessor':'supports honest repair by naming hard truths directly and respectfully',
    'The Rebel':'protects authenticity and encourages freedom without emotional pretense',
    'The Mourner':'brings depth and compassion when vulnerability is needed most',
    'The Storyteller':'creates shared meaning and emotional momentum through lived narrative',
    'The Performer':'adds energy, play, and expressive confidence to connection',
    'The Architect':'stabilizes the bond through consistency, boundaries, and reliability',
    'The Alchemist':'transforms conflict into insight and emotional growth over time',
    'The Oracle':'offers perspective and intuitive clarity in emotionally complex moments'
  };
  const compatible=compatibilityByType[type.name]||[];

  return [
    {
      title:`What is ${type.name} like in romantic relationships?`,
      body:[
        `${type.name} often loves through ${traits.join(', ')}, and typically seeks connection that feels emotionally real rather than performative.`,
        `In close bonds, this type tends to value autonomy and depth at the same time-space to remain themselves, and enough trust to be fully known.`
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
      body:[`A common love-language pattern for this type is ${loveLanguageByType[type.name]||'Intentional presence'}-consistent signals of care that feel sincere, not performative.`]
    },
    {
      title:`How to love ${type.name}`,
      body:[
        `Lead with direct, respectful communication; this type usually responds best to clarity over mind-reading.`,
        `Support their strengths (${traits.join(', ')}) while helping them regulate weaker patterns like ${shadows.join(', ')} under stress.`,
        `Give appreciation in the form they naturally recognize, and keep conflict focused on repair rather than point-scoring.`
      ]
    },
    {
      title:`Most compatible poet personalities for ${type.name}`,
      body:[
        compatible.length
          ? `Best-fit pairings are typically ${compatible.join(', ')} because they balance this type's emotional style and communication rhythm.`
          : `Compatibility is strongest with partners who can meet this type with consistency, emotional maturity, and reciprocal respect.`
      ],
      list:compatible.map((name)=>`${name} - ${compatibilityReasonByName[name]||'complements this type with balanced emotional and communication dynamics'}`)
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
        `The strongest trait expression feels intentional, not accidental-it repeats with variation over time.`
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
        `This type typically carries a distinct cadence pattern-how lines breathe, accelerate, pause, and resolve.`,
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

function buildFamousPoetSections(type){
  const poetProfiles={
    'Rumi':{years:'1207-1273',bio:'Persian mystic poet whose ecstatic, spiritual verse explores love, union, and transformation.',works:['Masnavi','Divan-e Shams-e Tabrizi','The Essential Rumi']},
    'Sylvia Plath':{years:'1932-1963',bio:'American confessional poet known for psychologically intense, image-rich poems and emotional candor.',works:['Ariel','Daddy','Lady Lazarus']},
    'Seamus Heaney':{years:'1939-2013',bio:'Irish Nobel Prize-winning poet whose work fuses memory, place, history, and moral reflection.',works:['Death of a Naturalist','North','Field Work']},
    'Emily Dickinson':{years:'1830-1886',bio:'American lyric poet celebrated for compressed form, paradox, and spiritually charged interiority.',works:['Because I could not stop for Death','I heard a Fly buzz-when I died','I\'m Nobody! Who are you?']},
    'T. S. Eliot':{years:'1888-1965',bio:'Modernist poet-critic whose layered allusion and formal control reshaped twentieth-century poetry.',works:['The Waste Land','Four Quartets','The Love Song of J. Alfred Prufrock']},
    'Elizabeth Bishop':{years:'1911-1979',bio:'American poet admired for exact observation, tonal restraint, and quietly devastating emotional precision.',works:['One Art','The Fish','Questions of Travel']},
    'Robert Frost':{years:'1874-1963',bio:'American poet of formal clarity and philosophical depth, often using rural scenes to examine human choice.',works:['Stopping by Woods on a Snowy Evening','Mending Wall','The Road Not Taken']},
    'Walt Whitman':{years:'1819-1892',bio:'American poet of expansive free verse who celebrated selfhood, democracy, and the shared body of humanity.',works:['Leaves of Grass','Song of Myself','Crossing Brooklyn Ferry']},
    'John Keats':{years:'1795-1821',bio:'English Romantic poet known for sensuous imagery, emotional intensity, and meditations on beauty and mortality.',works:['Ode to a Nightingale','Ode on a Grecian Urn','To Autumn']},
    'Pablo Neruda':{years:'1904-1973',bio:'Chilean Nobel Prize-winning poet whose work spans intimate love lyrics, surrealism, and political witness.',works:['Twenty Love Poems and a Song of Despair','Residence on Earth','Canto General']},
    'Sappho':{years:'c. 630-c. 570 BCE',bio:'Archaic Greek lyric poet whose surviving fragments remain foundational for intimate, desire-centered poetry.',works:['Fragment 31','Ode to Aphrodite','If Not, Winter (fragments)']},
    'Bashō':{years:'1644-1694',bio:'Japanese master of haikai and haiku whose minimalist nature imagery carries philosophical and emotional depth.',works:['The Narrow Road to the Deep North','Old Pond (haiku)','Nozarashi Kiko']},
    'Mary Oliver':{years:'1935-2019',bio:'American poet known for lucid, contemplative poems rooted in nature, attention, and spiritual tenderness.',works:['American Primitive','Dream Work','Devotions']},
    'Anne Sexton':{years:'1928-1974',bio:'American confessional poet whose work confronts trauma, gender, and mental health with fierce intimacy.',works:['Live or Die','Transformations','The Awful Rowing Toward God']},
    'Maya Angelou':{years:'1928-2014',bio:'American poet and memoirist whose voice blends resilience, dignity, and oratorical power.',works:['And Still I Rise','Phenomenal Woman','Just Give Me a Cool Drink of Water \'fore I Diiie']},
    'Langston Hughes':{years:'1902-1967',bio:'Central Harlem Renaissance poet whose musical, clear, and socially grounded work reshaped American verse.',works:['The Weary Blues','Montage of a Dream Deferred','I, Too']},
    'Allen Ginsberg':{years:'1926-1997',bio:'Beat poet known for long-breath lines, countercultural urgency, and radical public voice.',works:['Howl','Kaddish','America']},
    'Audre Lorde':{years:'1934-1992',bio:'Poet and essayist whose writing joins political clarity, erotic power, and uncompromising self-definition.',works:['Coal','The Black Unicorn','Sister Outsider']},
    'Adrienne Rich':{years:'1929-2012',bio:'American poet-essayist whose work evolved from formal mastery into bold feminist and political inquiry.',works:['Diving into the Wreck','Snapshots of a Daughter-in-Law','An Atlas of the Difficult World']}
  };

  const poetMap={
    'the-alchemist':['Rumi','Sylvia Plath','Seamus Heaney'],
    'the-oracle':['Emily Dickinson','Rumi','T. S. Eliot'],
    'the-architect':['Elizabeth Bishop','Robert Frost','T. S. Eliot'],
    'the-seeker':['Walt Whitman','John Keats','Seamus Heaney'],
    'the-lover':['Pablo Neruda','Sappho','John Keats'],
    'the-dreamer':['John Keats','Bashō','Emily Dickinson'],
    'the-muse':['Sappho','Pablo Neruda','Mary Oliver'],
    'the-devotee':['Mary Oliver','Rumi','Walt Whitman'],
    'the-confessor':['Sylvia Plath','Anne Sexton','Maya Angelou'],
    'the-witness':['Elizabeth Bishop','Langston Hughes','Seamus Heaney'],
    'the-rebel':['Allen Ginsberg','Audre Lorde','Adrienne Rich'],
    'the-mourner':['Sylvia Plath','Anne Sexton','Elizabeth Bishop'],
    'the-storyteller':['Maya Angelou','Langston Hughes','Seamus Heaney'],
    'the-minimalist':['Bashō','Emily Dickinson','Robert Frost'],
    'the-performer':['Maya Angelou','Langston Hughes','Allen Ginsberg'],
    'the-weaver':['Adrienne Rich','T. S. Eliot','Emily Dickinson']
  };

  const names=poetMap[type.slug]||[];
  return names.map((name)=>{
    const poet=poetProfiles[name];
    if(!poet) return {title:name,body:[]};
    return {
      title:name,
      body:[
        `${poet.years}. ${poet.bio}`,
        `Famous works: ${poet.works.join('; ')}.`
      ]
    };
  });
}

function renderTypeProfileTabs(root,t,siblings,allTypes=[]){
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
        rightTitle:customTab.split.rightTitle||base.split?.rightTitle||'Weaknesses',
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
      label:'Strengths & weaknesses',
      heading:'Strengths & weaknesses',
      kicker:'Range and risk',
      intro:'Every poetic gift has an edge. This section maps both.',
      split:{leftTitle:'Strengths',leftItems:traits,rightTitle:'Weaknesses',rightItems:shadows},
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
      id:'famous-poets',
      label:'Famous Poets',
      heading:'Famous Poets',
      kicker:'Creative affinities',
      intro:'Three poets whose work often shares energy with this type.',
      body:[
        t.famousPoetsWithSimilarEnergy?.copy||''
      ]
    },custom.famousPoets),
    mergeTab({
      id:'love-relationships',
      label:'In love & relationships',
      heading:'In love & relationships',
      kicker:'Relational expression',
      intro:'How this poetic energy may show up in intimacy, attachment, and emotional language.',
      body:[
        `${t.name} energy in relationships often mirrors its writing tendencies: ${traits.join(', ')}.`,
        `In close bonds, weaker patterns can look like ${shadows.join(', ')}, especially under stress or uncertainty.`,
        'When grounded, this type tends to communicate with sincerity, depth, and a strong desire to be truly understood.'
      ]
    },custom.loveRelationships)
  ];

  const typeImageSrc=`/images/${t.slug}.png`;
  const hoverVideoFile=TYPE_HOVER_VIDEO_BY_SLUG[t.slug]||'';
  const typeHeroMedia=hoverVideoFile
    ? `<img src='${escapeHtml(typeImageSrc)}' alt='${escapeHtml(t.name)} personality illustration' loading='lazy'/><video class='type-hover-video' muted loop playsinline preload='metadata' poster='${escapeHtml(typeImageSrc)}'><source src='/videos/${escapeHtml(hoverVideoFile)}' type='video/mp4'></video>`
    : `<img src='${escapeHtml(typeImageSrc)}' alt='${escapeHtml(t.name)} personality illustration' loading='lazy'/>`;
  const currentIndex=Math.max(0,allTypes.findIndex((x)=>x.slug===t.slug));
  const prevType=currentIndex>0?allTypes[currentIndex-1]:null;
  const nextType=currentIndex<allTypes.length-1?allTypes[currentIndex+1]:null;

  const shell=card(`
    <section class='type-tabs-wrap'>
      <aside class='type-tabs-nav' aria-label='Type profile sections'>
        <div class='type-tabs-mobile-head'>
          <strong>Sections</strong>
          <button class='type-tabs-close' type='button' aria-label='Close sections'>✕</button>
        </div>
        <div class='type-tabs-card' role='tablist' aria-orientation='vertical'>
          ${tabs.map((tab,idx)=>`<button class='type-tab-btn ${idx===0?'active':''}' role='tab' aria-selected='${idx===0?'true':'false'}' data-tab='${tab.id}' id='tab-${tab.id}'>${tab.label}</button>`).join('')}
        </div>
      </aside>
      <section class='type-tabs-panel' aria-live='polite'>
        <button class='type-mobile-sections-toggle' type='button' aria-label='Open sections'>Sections</button>
        <div class='type-panel-hero type-panel-hero-split'>
          <div class='type-panel-hero-copy'>
            <p class='kicker'>${escapeHtml(t.group)}</p>
            <h1>${escapeHtml(t.name)}</h1>
            <p class='lead'>${escapeHtml(t.subtitle)}</p>
          </div>
          <figure class='type-hero-art ${hoverVideoFile?'has-hover-video':''}' data-type='${escapeHtml(t.slug)}'>${typeHeroMedia}</figure>
        </div>
        <article id='typeTabContent' class='type-panel-content'></article>
        <nav class='type-prev-next' aria-label='Personality navigation'>
          ${prevType?`<a class='btn secondary' href='/type/${prevType.slug}' aria-label='Previous personality: ${escapeHtml(prevType.name)}'>← Previous</a>`:`<span></span>`}
          ${nextType?`<a class='btn secondary' href='/type/${nextType.slug}' aria-label='Next personality: ${escapeHtml(nextType.name)}'>Next →</a>`:`<span></span>`}
        </nav>
      </section>
    </section>
  `,'card type-tabs-shell');

  const content=shell.querySelector('#typeTabContent');
  const buttons=[...shell.querySelectorAll('.type-tab-btn')];
  const navAside=shell.querySelector('.type-tabs-nav');
  const navOpenBtn=shell.querySelector('.type-mobile-sections-toggle');
  const navCloseBtn=shell.querySelector('.type-tabs-close');
  const heroArt=shell.querySelector('.type-hero-art');
  const heroVideo=shell.querySelector('.type-hero-art .type-hover-video');

  if(heroArt&&heroVideo){
    heroVideo.pause();
    heroVideo.currentTime=0;
    heroVideo.addEventListener('loadeddata',()=>{ heroVideo.currentTime=0.01; heroVideo.pause(); });
    const play=()=>{ heroVideo.currentTime=0; heroVideo.play().catch(()=>{}); };
    const stop=()=>{ heroVideo.pause(); heroVideo.currentTime=0.01; };
    heroArt.addEventListener('mouseenter',play);
    heroArt.addEventListener('mouseleave',stop);
    heroArt.addEventListener('focusin',play);
    heroArt.addEventListener('focusout',stop);
  }

  const closeMobileSections=()=>navAside?.classList.remove('open');
  const openMobileSections=()=>navAside?.classList.add('open');
  navOpenBtn?.addEventListener('click',openMobileSections);
  navCloseBtn?.addEventListener('click',closeMobileSections);

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
            : (tab.id==='famous-poets')
              ? (tab.sections||buildFamousPoetSections(t))
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
    const poets='';

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
    closeMobileSections();
  }));

  renderBody(tabs[0]);
  root.append(shell);
}

function getPreferredTheme(){
  const saved=localStorage.getItem('pp_theme');
  if(saved==='light'||saved==='dark') return saved;
  return 'light';
}

function applyTheme(theme){
  document.documentElement.setAttribute('data-theme',theme);
  localStorage.setItem('pp_theme',theme);
}

function setupThemeToggle(){
  const current=document.documentElement.getAttribute('data-theme')||'light';
  const next=current==='dark'?'light':'dark';
  const label=current==='dark'?'☀ Light':'🌙 Dark';

  const bind=(btn)=>{
    if(!btn) return;
    btn.textContent=label;
    btn.setAttribute('aria-label',`Switch to ${next} mode`);
    btn.onclick=()=>{applyTheme(next);setupThemeToggle();};
  };

  bind(document.getElementById('themeToggleInline'));
  bind(document.getElementById('themeToggleMobile'));
}

async function setupGlobalAccountButton(){
  let user=null;
  try{
    const res=await fetch('/api/auth/me');
    const data=await res.json();
    user=data?.user||null;
  }catch{}

  const desktopLink=document.getElementById('accountInlineBtn');
  const mobileLink=document.querySelector('#mobileNav a[href="/account"]');
  const userLabel=user?(user.name||String(user.email||'').split('@')[0]||'Account').trim():'Sign In';
  const href=user?'/settings':'/account';

  if(desktopLink){
    desktopLink.href=href;
    desktopLink.textContent=userLabel;
    desktopLink.title=user?'Account settings':'Sign in';
  }
  if(mobileLink){
    mobileLink.href=href;
    mobileLink.textContent=user?'Account':'Account';
  }
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

function ensureResponsiveHeader(){
  const top=document.querySelector('.site-top');
  if(!top) return;

  const nav=top.querySelector('nav');
  if(nav && !nav.id) nav.id='primaryNav';

  if(!top.querySelector('#menuToggle')){
    const btn=el('button','menu-toggle');
    btn.id='menuToggle';
    btn.setAttribute('aria-expanded','false');
    btn.setAttribute('aria-controls','mobileNav');
    btn.setAttribute('aria-label','Open menu');
    btn.textContent='☰';
    top.insertBefore(btn, nav||top.querySelector('.top-right-controls')||null);
  }

  if(!top.querySelector('.top-right-controls')){
    const controls=el('div','top-right-controls');
    controls.innerHTML="<button class='theme-toggle' id='themeToggleInline' type='button'>🌙 Dark</button><a href='/account' class='account-corner-btn' id='accountInlineBtn'>Sign In</a>";
    top.append(controls);
  }

  if(!document.getElementById('mobileNav')){
    const drawer=el('aside','mobile-drawer');
    drawer.id='mobileNav';
    drawer.setAttribute('aria-hidden','true');
    drawer.innerHTML="<div class='mobile-drawer-head'><strong>Menu</strong><button id='menuClose' class='menu-close' aria-label='Close menu'>✕</button></div><a class='btn primary mobile-primary' href='/analyze'>Analyze</a><a href='/types'>16 Types</a><a href='/categories'>Categories</a><a href='/results-demo'>Results Demo</a><a href='/account'>Account</a><button class='theme-toggle mobile-theme' id='themeToggleMobile' type='button'>🌙 Dark</button>";
    top.insertAdjacentElement('afterend',drawer);
  }

  if(!document.getElementById('mobileNavBackdrop')){
    const backdrop=el('div','mobile-backdrop');
    backdrop.id='mobileNavBackdrop';
    backdrop.hidden=true;
    const wrap=document.querySelector('main.wrap')||document.body;
    wrap.insertAdjacentElement('afterend',backdrop);
  }
}

function setupTopNav(){
  const currentPath=location.pathname;
  const activeHref=currentPath.startsWith('/type/')?'/types':currentPath;
  document.querySelectorAll('.site-top nav a[href^="/"], #mobileNav a[href^="/"]').forEach((a)=>{
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

  const menu=document.getElementById('mobileNav');
  const backdrop=document.getElementById('mobileNavBackdrop');
  const toggle=document.getElementById('menuToggle');
  const close=document.getElementById('menuClose');

  if(menu&&toggle&&backdrop){
    const open=()=>{
      menu.classList.add('open');
      menu.setAttribute('aria-hidden','false');
      toggle.setAttribute('aria-expanded','true');
      backdrop.hidden=false;
      document.body.style.overflow='hidden';
    };
    const shut=()=>{
      menu.classList.remove('open');
      menu.setAttribute('aria-hidden','true');
      toggle.setAttribute('aria-expanded','false');
      backdrop.hidden=true;
      document.body.style.overflow='';
    };

    toggle.onclick=open;
    if(close) close.onclick=shut;
    backdrop.onclick=shut;
    menu.querySelectorAll('a').forEach((link)=>link.addEventListener('click',shut));
  }
}

function setupHeaderScroll(){
  const top=document.querySelector('.site-top');
  if(!top) return;
  const sync=()=>top.classList.toggle('scrolled',window.scrollY>10);
  sync();
  window.addEventListener('scroll',sync,{passive:true});
}

function setupClickTracking(){
  document.querySelectorAll('a.btn, nav a').forEach((a)=>{
    a.addEventListener('click',()=>track('cta_click',{label:a.textContent?.trim()||'',href:a.getAttribute('href')||''}));
  });
}

function setupStickyCta(){
  const sticky=document.getElementById('stickyCta');
  const dismiss=document.getElementById('stickyDismiss');
  if(!sticky||!dismiss) return;

  const dismissed=localStorage.getItem('pp_sticky_cta_dismissed')==='1';
  if(dismissed) sticky.classList.add('hidden');

  dismiss.addEventListener('click',()=>{
    sticky.classList.add('hidden');
    localStorage.setItem('pp_sticky_cta_dismissed','1');
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
      status.textContent="Saved. We'll send profile refinement prompts and updates.";
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
  if(!poem.updatedAt) return `${words} words`;

  const dt=new Date(poem.updatedAt);
  const datePart=dt.toLocaleDateString('en-US',{month:'2-digit',day:'2-digit',year:'2-digit'});
  const timePart=dt.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true}).toLowerCase();
  return `${words} words · ${datePart} · ${timePart}`;
}

function setupPoemUploader(targetId='funnel',types=[]){
  const ANALYSIS_CACHE_KEY='poet_personality_last_analysis';
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
    <input id='analysisEmail' type='email' autocomplete='email' hidden />
    <div id='analysisResult' class='analysis-result muted'>Write a few poems, then run analysis for an identity-level reading.</div>
  </section>`, 'poems-wrapper');
  target.append(box);

  const list=box.querySelector('#threadList');
  const editor=box.querySelector('#poemEditorPane');
  const addBtn=box.querySelector('#newPoemBtn');
  const analyzeBtn=box.querySelector('#analyzePoemsBtn');
  const analysisResult=box.querySelector('#analysisResult');
  const analysisEmail=box.querySelector('#analysisEmail');
  const status=box.querySelector('#poemSaveStatus');

  let poems=[];
  let selected=-1;
  let saveTimer=null;
  let isSaving=false;

  const isValidEmail=(email)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email||'').trim());
  const rememberedEmail=localStorage.getItem('poet_personality_email')||'';
  if(analysisEmail&&rememberedEmail) analysisEmail.value=rememberedEmail;

  const syncStatus=(text)=>{status.textContent=text||'';};

  const queueSave=()=>{
    if(selected<0||!poems[selected]) return;
    const poemRef=poems[selected];
    poemRef.updatedAt=new Date().toISOString();
    renderList();
    syncStatus('Saving…');
    clearTimeout(saveTimer);
    saveTimer=setTimeout(()=>saveNow(poemRef), 450);
  };

  const saveNow=async(targetPoem=null)=>{
    if(isSaving) return;

    const poem=targetPoem||poems[selected];
    if(!poem) return;

    const idx=poems.findIndex((p)=>p===poem || (poem.id && p.id===poem.id));
    if(idx<0) return;

    isSaving=true;
    const text=(poem.text||'').trim();
    if(!text){isSaving=false;syncStatus('');return;}

    try{
      const res=await fetch('/api/poems/batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({collectionToken:getCollectionToken(),poems:[{id:poem.id||undefined,title:(poem.title||'').trim()||undefined,text}]})});
      const data=await res.json();
      if(!res.ok||!data.ok) throw new Error(data.error||'save_failed');
      setCollectionToken(data.collection.token);
      const saved=(data.poems||[]).find((p)=>p.id===poem.id)||data.poems?.[data.poems.length-1];
      if(saved){
        poems[idx]={id:saved.id,title:saved.title||'',text:saved.text||'',updatedAt:saved.updated_at};
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
    editor.querySelector('#deletePoemBtn').addEventListener('click',async ()=>{
      const poemToDelete=poems[selected];
      if(!poemToDelete) return;

      try{
        if(poemToDelete.id){
          syncStatus('Deleting…');
          const token=getCollectionToken();
          if(!token) throw new Error('missing_token');
          const del=await fetch(`/api/poems/${encodeURIComponent(poemToDelete.id)}?token=${encodeURIComponent(token)}`,{method:'DELETE'});
          const delData=await del.json().catch(()=>({}));
          if(!del.ok||!delData.ok) throw new Error(delData.error||'delete_failed');
        }

        poems.splice(selected,1);
        selected=Math.min(selected,poems.length-1);

        if(!poems.length){
          poems.push({id:null,title:'',text:'',updatedAt:null});
          selected=0;
        }

        renderList();
        renderEditor();
        syncStatus('Deleted');
      }catch{
        syncStatus('Could not delete poem');
      }
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

  const typeSlugByName=new Map((types||[]).map((t)=>[String(t.name||'').toLowerCase(),t.slug]));

  const getAnalysisCache=()=>{
    try{return JSON.parse(localStorage.getItem(ANALYSIS_CACHE_KEY)||'null');}catch{return null;}
  };
  const setAnalysisCache=(payload)=>{
    try{
      localStorage.setItem(ANALYSIS_CACHE_KEY,JSON.stringify({
        token:getCollectionToken()||null,
        payload,
        savedAt:new Date().toISOString()
      }));
    }catch{}
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
    const personalityImageSrc=a.personalitySlug?`/images/${a.personalitySlug}.png`:'';
    analysisResult.innerHTML=`
      <div class='analysis-stage stage-1'>
        <div class='analysis-hero analysis-hero-with-image'>
          <div>
            <p class='kicker'>Matched Archetype</p>
            <h2>${a.personalityTitle}</h2>
            <p class='lead'>${a.summary}</p>
          </div>
          ${personalityImageSrc?`<figure class='analysis-hero-art'><img src='${personalityImageSrc}' alt='${a.personalityTitle} personality illustration' loading='lazy'/></figure>`:''}
        </div>
      </div>
      <div class='analysis-stage stage-2'>
        <div class='analysis-chips'>${chips.map((t)=>{
          const slug=typeSlugByName.get(String(t||'').toLowerCase());
          return slug
            ? `<a class='analysis-chip analysis-chip-link' href='/type/${slug}'>${t}</a>`
            : `<span class='analysis-chip'>${t}</span>`;
        }).join('')}</div>
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
    setAnalysisCache(payload);
  };

  addBtn.addEventListener('click',()=>addPoem({title:'',text:''}));
  analyzeBtn.addEventListener('click',async ()=>{
    const payload=poems.map((p)=>({title:(p.title||'').trim(),text:(p.text||'').trim()})).filter((p)=>p.text);

    let email=String(analysisEmail?.value||'').trim().toLowerCase();
    if(!isValidEmail(email)){
      const enteredEmail=window.prompt('Enter your email to receive your results:', email||rememberedEmail||'');
      if(enteredEmail===null) return;
      email=String(enteredEmail||'').trim().toLowerCase();
      if(analysisEmail) analysisEmail.value=email;
    }

    if(!isValidEmail(email)){
      analysisResult.classList.add('muted');
      analysisResult.textContent='Please enter a valid email to analyze your poems.';
      return;
    }

    if(!payload.length){analysisResult.classList.add('muted');analysisResult.textContent='Add poem text first, then analyze.';return;}
    analyzeBtn.disabled=true;
    analysisResult.classList.add('muted');
    analysisResult.innerHTML=`<div class='analysis-loading'><span class='pulse-dot'></span><span>Analyzing voice, themes, and poetic identity…</span></div>`;
    try{
      const res=await fetch('/api/poems/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({collectionToken:getCollectionToken(),poems:payload,email})});
      const data=await res.json();
      if(!res.ok||!data.ok){
        if(data?.error==='invalid_email'){
          analysisResult.classList.add('muted');
          analysisResult.textContent='Please enter a valid email to analyze your poems.';
          throw new Error('invalid_email');
        }
        throw new Error('analysis_failed');
      }
      localStorage.setItem('poet_personality_email',email);
      renderAnalysis(data);
      if(data?.emailSent===true){
        syncStatus('Results emailed.');
      }
    }catch(error){
      if(error?.message!=='invalid_email'){
        analysisResult.classList.add('muted');
        analysisResult.textContent='Could not analyze right now. Please try again.';
      }
    }finally{analyzeBtn.disabled=false;}
  });

  const cachedAnalysis=getAnalysisCache();
  if(cachedAnalysis?.payload && (!cachedAnalysis.token || cachedAnalysis.token===token)){
    renderAnalysis(cachedAnalysis.payload);
  }

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
      <p class='lead'>You're signed in. Ready to keep building your Poet Personality profile?</p>
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
            <div><span class='label'>Renewal date</span><strong>-</strong></div>
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
    <p class='muted'>Enter your email and we'll send a secure password reset link.</p>
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
      <p class='muted'>If an account exists for <strong id='forgotSentEmail'></strong>, we've sent reset instructions. Check inbox and spam.</p>
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

const TYPE_HOVER_VIDEO_BY_SLUG={
  'the-alchemist':'alchemist-hover.mp4',
  'the-oracle':'the-oracle-hover.mp4',
  'the-architect':'the-architect-hover.mp4',
  'the-seeker':'the-seeker-hover.mp4',
  'the-lover':'the-lover-hover.mp4',
  'the-dreamer':'the-dreamer-hover.mp4',
  'the-muse':'the-muse-hover.mp4',
  'the-devotee':'the-devotee-hover.mp4',
  'the-confessor':'the-confessor-hover.mp4',
  'the-witness':'the-witness-hover.mp4',
  'the-rebel':'the-rebel-hover.mp4',
  'the-mourner':'the-mourner-hover.mp4',
  'the-storyteller':'the-storyteller-hover.mp4',
  'the-minimalist':'the-minimalist-hover.mp4',
  'the-performer':'the-performer-hover.mp4',
  'the-weaver':'the-weaver-hover.mp4'
};

const POET_COACH_BY_SLUG={
  'the-alchemist':{name:'The Alchemist',first:"Hey, I'm The Alchemist. If you want, start with a moment that changed you and we can shape it together.",tips:['Turn one object into a symbol of transformation.','Move from wound to wisdom by line 6.','Use fire, water, or metal imagery to anchor the poem.']},
  'the-oracle':{name:'The Oracle',first:"Hi, I'm The Oracle. Tell me one sign or strange moment from today, and we'll build a poem from it.",tips:['Write in short visionary fragments.','Ask one haunting question in the middle.','End with an image that feels fated.']},
  'the-architect':{name:'The Architect',first:"Hey, I'm The Architect. We can keep this simple and clean. Start with a scene and I'll help you structure the rest.",tips:['Keep one central image in every stanza.','Trim soft filler words after your first draft.','Use line breaks to control emphasis.']},
  'the-seeker':{name:'The Seeker',first:"Hey, I'm The Seeker. What question has been following you lately? Start there and we'll explore it.",tips:['Let curiosity drive each stanza.','Use one concrete detail from your room.','End open, not solved.']},
  'the-lover':{name:'The Lover',first:"Hi, I'm The Lover. Give me one small moment of closeness, and we'll turn it into something beautiful.",tips:['Make emotion physical, not abstract.','Use closeness and distance as tension.','End with a line that aches softly.']},
  'the-dreamer':{name:'The Dreamer',first:"Hey, I'm The Dreamer. Start with one image that feels dreamy, then ground it with one real detail.",tips:['Let transitions feel soft and fluid.','Use moon, light, or mist imagery with restraint.','Close like waking up slowly.']},
  'the-muse':{name:'The Muse',first:"Hi, I'm The Muse. Drop your favorite opening line and we can build the rhythm from there.",tips:['Read aloud and tune by ear.','Repeat one phrase with variation.','Prioritize image and cadence over explanation.']},
  'the-devotee':{name:'The Devotee',first:"Hey, I'm The Devotee. Who are you writing for right now? Start there and I'll help shape the voice.",tips:['Let sincerity lead the language.','Name one ritual and why it matters.','End with a vow or promise.']},
  'the-confessor':{name:'The Confessor',first:"Hi, I'm The Confessor. You can say it plain here. Start with one honest line and we'll build from it.",tips:['First stanza: no metaphor, just truth.','Name body sensations while writing.','Revise for honesty, not polish first.']},
  'the-witness':{name:'The Witness',first:"Hey, I'm The Witness. Look around and tell me exactly what you notice. We can turn that into a poem.",tips:['Use sensory detail from the scene.','Trust observation to carry feeling.','Keep diction clear and grounded.']},
  'the-rebel':{name:'The Rebel',first:"Hi, I'm The Rebel. What are you done tolerating? Say it direct and we'll sharpen it.",tips:['Use active verbs in each line.','Break one rule on purpose.','Turn anger into clarity.']},
  'the-mourner':{name:'The Mourner',first:"Hey, I'm The Mourner. If you want, start with what feels missing lately. We'll write it gently.",tips:['Say less and let silence work.','Use gentle domestic details.','End with one line of tenderness.']},
  'the-storyteller':{name:'The Storyteller',first:"Hey, I'm The Storyteller. Start in the middle of a moment and I'll help you shape the arc.",tips:['Build before and after movement.','Carry one object through the narrative.','Final line reveals what changed.']},
  'the-minimalist':{name:'The Minimalist',first:"Hi, I'm The Minimalist. Keep it clean. Start with a few short lines and we'll trim what does not hit.",tips:['Cut anything non-essential.','One image per line is enough.','Keep ending plain and sharp.']},
  'the-performer':{name:'The Performer',first:"Hey, I'm The Performer. Write it like you are saying it out loud to someone right now.",tips:['Use repetition for momentum.','Read aloud and revise by sound.','End with your strongest spoken line.']},
  'the-weaver':{name:'The Weaver',first:"Hi, I'm The Weaver. Pick two threads from your life and we'll braid them into one piece.",tips:['Alternate threads by stanza.','Repeat an image to stitch layers.','Let both threads meet at the end.']}
};

function setupPersonalityCoachChat(root,t){
  if(!root||!t?.slug) return;
  const coach=POET_COACH_BY_SLUG[t.slug]||{name:t.name,first:'Share your first 6-10 lines and I will coach your next draft.',tips:['Add concrete detail.','Clarify emotional turn.','Read aloud and refine rhythm.']};
  const host=el('section','poet-chat card reveal in');
  host.innerHTML=`<div class='poet-chat-head'><p class='kicker'>Poet Guide</p><h3>Chat with ${escapeHtml(coach.name)}</h3></div><div class='poet-chat-log' id='poetChatLog'></div><form class='poet-chat-form' id='poetChatForm'><input id='poetChatInput' type='text' placeholder='Share a line, draft, or question…' autocomplete='off'/><button class='btn primary' type='submit'>Send</button></form>`;

  const log=host.querySelector('#poetChatLog');
  const form=host.querySelector('#poetChatForm');
  const input=host.querySelector('#poetChatInput');
  let turn=0;
  let styleProfile=null;

  const addMsg=(who,text)=>{
    const row=el('div',`poet-chat-msg ${who}`);
    row.innerHTML=`<p>${escapeHtml(text)}</p>`;
    log.append(row);
    log.scrollTop=log.scrollHeight;
  };

  const styleLine=()=>{
    if(!styleProfile||!styleProfile.poemCount) return '';
    const words=(styleProfile.signatureWords||[]).slice(0,3).join(', ');
    return `I'm tuning to your style (${styleProfile.poemCount} poems, ~${styleProfile.avgLineWords||0} words/line${words?`, signature words: ${words}`:''}).`;
  };

  const makeReply=(userText)=>{
    const text=String(userText||'').trim();
    const words=text.split(/\s+/).filter(Boolean).length;
    const tip=coach.tips[turn%coach.tips.length];
    const open=words<8
      ? `Good start. Give me 4-6 more lines so we can build momentum.`
      : `Strong material. I can hear the ${coach.name.toLowerCase()} energy.`;
    const styleNudge=styleProfile?.poemCount
      ? `Try writing this next pass around ${Math.max(4,Math.min(12,Math.round(styleProfile.avgLineWords||8)))} words per line to match your natural rhythm.`
      : '';
    const follow=words<20
      ? `Try this now: ${tip}`
      : `Revision pass: ${tip}`;
    const q=turn%2===0?'What line feels most honest to you right now?':'Want me to help tighten rhythm line-by-line?';
    turn+=1;
    return [open,styleNudge,follow,q].filter(Boolean).join(' ');
  };

  root.append(host);
  addMsg('bot',coach.first);

  const token=getCollectionToken();
  if(token){
    fetch(`/api/style-profile?token=${encodeURIComponent(token)}`)
      .then((r)=>r.json())
      .then((data)=>{
        if(data?.ok&&data?.profile&&data.profile.poemCount>0){
          styleProfile=data.profile;
          addMsg('bot',styleLine());
        }
      })
      .catch(()=>{});
  }

  form?.addEventListener('submit',(e)=>{
    e.preventDefault();
    const text=String(input?.value||'').trim();
    if(!text) return;
    addMsg('user',text);
    if(input) input.value='';
    setTimeout(()=>addMsg('bot',makeReply(text)),220);
  });
}

function setupTypeHoverVideos(scope=document){
  const cards=[...scope.querySelectorAll('.type-card .type-card-art')];
  cards.forEach((card)=>{
    const video=card.querySelector('video.type-hover-video');
    if(!video||video.dataset.bound==='1') return;
    video.dataset.bound='1';
    video.pause();
    video.currentTime=0;
    video.addEventListener('loadeddata',()=>{
      if(!video.dataset.previewReady){
        video.currentTime=0.01;
        video.pause();
        video.dataset.previewReady='1';
      }
    });

    const play=()=>{
      video.currentTime=0;
      video.play().catch(()=>{});
    };
    const stop=()=>{
      video.pause();
      video.currentTime=0.01;
    };

    card.addEventListener('mouseenter',play);
    card.addEventListener('mouseleave',stop);
    card.addEventListener('focusin',play);
    card.addEventListener('focusout',stop);
  });
}

function setupLandingHeroHoverVideo(scope=document){
  const video=scope.querySelector('.hero-image-video');
  if(!video||video.dataset.bound==='1') return;
  video.dataset.bound='1';
  video.pause();
  video.currentTime=0;

  const holder=video.closest('.hero-image')||video;
  const play=()=>{ video.currentTime=0; video.play().catch(()=>{}); };
  const stop=()=>{ video.pause(); video.currentTime=0.01; };

  holder.addEventListener('mouseenter',play);
  holder.addEventListener('mouseleave',stop);
  holder.addEventListener('focusin',play);
  holder.addEventListener('focusout',stop);
  video.addEventListener('loadeddata',stop);
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

function setupStorytellerGuide(types=[]){
  const allowed=['/','/analyze','/types'];
  const isTypeProfile=location.pathname.startsWith('/type/');
  if(!allowed.includes(location.pathname)&&!isTypeProfile) return;
  // Show guide on each page load (do not persist dismiss across refresh).

  const tipDeckByType={
    'The Alchemist':[
      'Think of a hard moment that changed you. Write it as if it were turning metal into gold.',
      'Pick one ordinary object in the room and make it stand for your transformation.',
      'Start in darkness, then let one image slowly become light by the last lines.',
      'Write about a wound, but spend more time on what grew from it.',
      'Use words like ash, flame, salt, or iron to give the poem a ritual feeling.'
    ],
    'The Oracle':[
      'Write as if you are receiving a message, not forcing one.',
      'Sit quietly for a minute and note three signs around you-light, sound, movement.',
      'Use short, clear lines like visions. Let each stanza reveal one piece.',
      'Ask one question in the poem that you cannot fully answer yet.',
      'End with an image that feels fated, like it was always waiting for you.'
    ],
    'The Architect':[
      'Choose a form first-3 stanzas, 4 lines each-and build inside it.',
      'Map your poem before drafting: opening image, turn, final resolution.',
      'Take one messy feeling and give it clean structure.',
      'Let every line earn its place; if it does not hold weight, cut it.',
      'Read it once for rhythm, once for logic, and once for emotional precision.'
    ],
    'The Seeker':[
      'Begin with something you are still trying to understand.',
      'Write the poem like a walk: observation, question, deeper question, insight.',
      'Notice what in your surroundings feels symbolic right now and bring it in.',
      'Let uncertainty stay alive; you do not need to solve everything.',
      'End with a line that opens a door instead of closing one.'
    ],
    'The Lover':[
      'Write about closeness through detail: skin, breath, distance, warmth.',
      'Think of one memory of tenderness and build the poem around that scene.',
      'Use touch, scent, and sound to make emotion physical.',
      'Let longing speak directly in one line without hiding behind metaphor.',
      'End on a gentle line that still aches a little.'
    ],
    'The Dreamer':[
      'Start with a dream image and follow where it drifts.',
      'Blend memory and imagination, but anchor each stanza with one concrete detail.',
      'Look around you and pick one strange object to thread through the poem.',
      'Use soft transitions, as if the poem is moving through mist.',
      'Let the final line feel like waking up slowly.'
    ],
    'The Muse':[
      'Begin with your most musical line and trust your ear.',
      'Write with color and texture first, explanation second.',
      'Notice what beauty exists in your current surroundings and name it freshly.',
      'Repeat one key phrase with variation to create lyrical echo.',
      'Read it aloud and adjust until it sounds effortless.'
    ],
    'The Devotee':[
      'Write to someone or something you are deeply loyal to.',
      'Treat the poem like an offering: sincere, intentional, and specific.',
      'Name a daily ritual and show why it matters emotionally.',
      'Use gratitude and ache in the same poem-they can coexist.',
      'End with a vow, prayer, or promise that feels true.'
    ],
    'The Confessor':[
      'Start with a truth you usually avoid saying out loud.',
      'Write in first person and keep the first stanza brutally plain.',
      'Notice what your body does as you write-tight chest, shaking hand-and include it.',
      'Do not justify yourself too quickly; let the raw line stand.',
      'Finish with one line that feels like relief after honesty.'
    ],
    'The Witness':[
      'Describe one real scene from today before adding interpretation.',
      'Take note of small details in your surroundings: shoes, steam, streetlight, hands.',
      'Let the facts carry emotion; trust the image.',
      'Keep the tone grounded, observant, and clear.',
      'End with the detail that still lingers in your mind.'
    ],
    'The Rebel':[
      'Write about what you refuse to accept right now.',
      'Break one craft rule on purpose to match your emotion.',
      'Use sharp verbs and direct language-no softening.',
      'Turn anger into clarity, not just noise.',
      'End with a line that sounds like a decision.'
    ],
    'The Mourner':[
      'Think of what is missing, then describe the shape it left behind.',
      'Use quiet images from your surroundings to hold grief gently.',
      'Write slowly and leave space between thoughts.',
      'Say less than you feel; restraint will deepen the poem.',
      'End with a small gesture of tenderness toward yourself or the lost thing.'
    ],
    'The Storyteller':[
      'Start with a scene: where are we, who is there, what just happened?',
      'Give the poem a clear movement-before, turning point, after.',
      'Let one object travel through the poem as a thread.',
      'Use simple narrative language, then lift one moment into poetry.',
      'Close with the line that reveals what the story was really about.'
    ],
    'The Minimalist':[
      'Write a short draft, then cut it in half.',
      'Keep only the lines that still hold power when read quietly.',
      'Use clean images from your immediate environment-one per line if possible.',
      'Avoid explanation; let silence do some of the work.',
      'End with a final line that is plain but unforgettable.'
    ],
    'The Performer':[
      'Write for the ear first: rhythm, breath, emphasis.',
      'Stand up and speak your draft while you revise.',
      'Use repetition and contrast to build momentum.',
      'Imagine a live audience and mark where you want pause or punch.',
      'End with your strongest spoken line-the one that lands in the room.'
    ],
    'The Weaver':[
      'Choose two threads-past/present, love/loss, self/world-and braid them.',
      'Let each stanza switch perspective while staying emotionally connected.',
      'Take notes from your surroundings and place them into both threads.',
      'Use recurring words or images to stitch the poem together.',
      'End where both threads meet and reveal a deeper pattern.'
    ]
  };

  const orderedFallback=[
    'The Alchemist','The Oracle','The Architect','The Seeker',
    'The Lover','The Dreamer','The Muse','The Devotee',
    'The Confessor','The Witness','The Rebel','The Mourner',
    'The Storyteller','The Minimalist','The Performer','The Weaver'
  ];

  const typeRows=types.map((t)=>({
    name:t?.name,
    slug:t?.slug,
    subtitle:t?.subtitle||'',
    overview:t?.overview||'',
    strengths:Array.isArray(t?.strengths)?t.strengths:[],
    challenges:Array.isArray(t?.challenges)?t.challenges:[],
    detects:Array.isArray(t?.analyzerDetects)?t.analyzerDetects:[],
    idealTagline:t?.idealTagline||'',
    writingIntro:t?.profileTabs?.writingStyle?.intro||'',
    loveIntro:t?.profileTabs?.loveRelationships?.intro||''
  })).filter(t=>t.name&&t.slug);
  const typeByName=Object.fromEntries(typeRows.map((t)=>[t.name,t]));
  const ordered=(typeRows.length?typeRows.map(t=>t.name):orderedFallback);

  const slugByName={
    ...Object.fromEntries(typeRows.map(t=>[t.name,t.slug])),
    'The Alchemist':'the-alchemist',
    'The Oracle':'the-oracle',
    'The Architect':'the-architect',
    'The Seeker':'the-seeker',
    'The Lover':'the-lover',
    'The Dreamer':'the-dreamer',
    'The Muse':'the-muse',
    'The Devotee':'the-devotee',
    'The Confessor':'the-confessor',
    'The Witness':'the-witness',
    'The Rebel':'the-rebel',
    'The Mourner':'the-mourner',
    'The Storyteller':'the-storyteller',
    'The Minimalist':'the-minimalist',
    'The Performer':'the-performer',
    'The Weaver':'the-weaver'
  };

  const root=el('aside','story-guide');
  root.setAttribute('aria-live','polite');
  root.innerHTML=`
    <button class='story-guide-close' type='button' aria-label='Close writing helper'>×</button>
    <div class='story-guide-panel'>
      <p class='story-guide-intro'></p>
      <label class='story-guide-label' for='storyGuideType'>Pick a personality</label>
      <select id='storyGuideType' class='story-guide-select'>
        ${ordered.map(name=>`<option value='${escapeHtml(name)}'>${escapeHtml(name)}</option>`).join('')}
      </select>
      <div class='story-guide-dialogue'>
        <p class='story-guide-speaker'>The Storyteller</p>
        <div class='story-guide-chatlog' id='storyGuideChatLog'></div>
        <form class='story-guide-chatform' id='storyGuideChatForm'>
          <input id='storyGuideChatInput' type='text' placeholder='Share a line, draft, or question…' autocomplete='off'/>
          <button type='submit' class='btn secondary'>Send</button>
        </form>
      </div>
    </div>
    <figure class='story-guide-art'><video class='story-guide-art-video' muted loop playsinline preload='metadata' poster='/images/the-storyteller.png'><source src='/videos/the-storyteller-hover.mp4' type='video/mp4'></video></figure>`;

  document.body.append(root);
  requestAnimationFrame(()=>root.classList.add('in'));

  const intro=root.querySelector('.story-guide-intro');
  const select=root.querySelector('#storyGuideType');
  const chatLog=root.querySelector('#storyGuideChatLog');
  const chatForm=root.querySelector('#storyGuideChatForm');
  const chatInput=root.querySelector('#storyGuideChatInput');
  const speaker=root.querySelector('.story-guide-speaker');
  const artVideo=root.querySelector('.story-guide-art-video');
  const closeBtn=root.querySelector('.story-guide-close');
  const opening='Need some help?';
  if(intro) intro.textContent=opening;

  let styleProfile=null;
  const token=getCollectionToken();
  if(token){
    fetch(`/api/style-profile?token=${encodeURIComponent(token)}`)
      .then((r)=>r.json())
      .then((data)=>{ if(data?.ok&&data?.profile?.poemCount>0) styleProfile=data.profile; })
      .catch(()=>{});
  }

  const addMsg=(who,text,opts={})=>{
    if(!chatLog) return;
    const row=el('div',`story-guide-msg ${who}${opts.clickable?' clickable':''}`);
    row.innerHTML=`<p>${escapeHtml(text)}</p>`;
    if(opts.clickable&&typeof opts.onClick==='function'){
      row.setAttribute('role','button');
      row.setAttribute('tabindex','0');
      row.title='Click to use this starter';
      row.addEventListener('click',opts.onClick);
      row.addEventListener('keydown',(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); opts.onClick(); }});
    }
    chatLog.append(row);
    chatLog.scrollTop=chatLog.scrollHeight;
  };

  const getCoach=(name)=>{
    const slug=slugByName[name]||'the-storyteller';
    const rich=typeByName[name];
    const base=POET_COACH_BY_SLUG[slug]||{name,first:'Share your first lines and I will help you shape the next draft.',tips:(tipDeckByType[name]||[]).slice(0,3)};

    if(!rich){
      return { slug, coach: base };
    }

    const introLine=`Hi, I am ${rich.name}. ${rich.subtitle||''}`.trim();
    const first=(introLine||base.first||`Hi, I am ${rich.name}.`).trim();
    const dynamicTips=[
      rich.detects[0]?`Your style usually leans toward ${rich.detects[0]}. Try opening there.`:'',
      rich.strengths[0]?`Lead with your strength: ${rich.strengths[0]}.`:'',
      rich.challenges[0]?`Watch for this while drafting: ${rich.challenges[0]}.`:'',
      rich.writingIntro||'',
      rich.loveIntro||'',
      rich.idealTagline?`North star: ${rich.idealTagline}`:''
    ].filter(Boolean);

    return {
      slug,
      coach:{
        ...base,
        name:rich.name,
        first,
        tips:[...dynamicTips, ...(base.tips||[])].slice(0,6)
      }
    };
  };

  const updateCoachMedia=(slug)=>{
    const videoFile=TYPE_HOVER_VIDEO_BY_SLUG[slug]||'the-storyteller-hover.mp4';
    if(artVideo){
      artVideo.poster=`/images/${slug}.png`;
      artVideo.innerHTML=`<source src='/videos/${videoFile}' type='video/mp4'>`;
      artVideo.load();
    }
  };

  if(artVideo){
    const playVideo=()=>{ artVideo.currentTime=0; artVideo.play().catch(()=>{}); };
    const stopVideo=()=>{ artVideo.pause(); artVideo.currentTime=0.01; };
    artVideo.addEventListener('mouseenter',playVideo);
    artVideo.addEventListener('mouseleave',stopVideo);
    artVideo.addEventListener('focusin',playVideo);
    artVideo.addEventListener('focusout',stopVideo);
    artVideo.addEventListener('loadeddata',stopVideo);
  }

  let turn=0;
  const renderCoach=(reset=true)=>{
    const name=select?.value||'The Storyteller';
    const {slug,coach}=getCoach(name);
    if(speaker) speaker.textContent=coach.name;
    updateCoachMedia(slug);
    if(reset&&chatLog){
      chatLog.innerHTML='';
      turn=0;
      addMsg('bot',coach.first||'Share your first lines and I will help.',{
        clickable:true,
        onClick:()=>{
          if(chatInput){
            chatInput.value=coach.first||'';
            chatInput.focus();
          }
        }
      });
      if(styleProfile?.poemCount){
        addMsg('bot',`I'm tuning to your voice from ${styleProfile.poemCount} saved poems (~${styleProfile.avgLineWords||0} words per line).`);
      }
    }
    return coach;
  };

  const makeReply=(coach,userText)=>{
    const text=String(userText||'').trim();
    const lower=text.toLowerCase();
    const words=text.split(/\s+/).filter(Boolean).length;

    const smallTalk= /^(hi|hello|hey|yo|sup|what'?s up|how are you|good morning|good afternoon|good evening)\b/.test(lower);
    const asksWhatToDo = /what should i write|how do i start|help me start|where do i start|what now/.test(lower);
    const looksLikePoem = /\n/.test(text) || words>=12;

    if(smallTalk && !looksLikePoem){
      return `Hey, good to meet you. I am ${coach.name}. Want to just chat first, or do you want a quick prompt to start writing?`;
    }

    if(asksWhatToDo && !looksLikePoem){
      const firstTip=(coach.tips&&coach.tips[0])?coach.tips[0]:'Start with one honest image from your day.';
      return `Great question. Easiest way in is this: ${firstTip} If you want, I can give you a softer prompt or a more intense one.`;
    }

    const tips=(coach.tips&&coach.tips.length)?coach.tips:['Add one concrete image.','Tighten your emotional turn.','Read aloud and refine rhythm.'];
    const tip=tips[turn%tips.length];
    const rhythm=styleProfile?.avgLineWords?`Try around ${Math.max(4,Math.min(12,Math.round(styleProfile.avgLineWords)))} words per line in your next pass.`:'';
    const open=words<10?'Nice start. Keep going with whatever feels natural and I will help shape it.':`This is good. I can hear your voice coming through.`;
    turn+=1;
    return [open, rhythm, `Next move: ${tip}`, (turn%2?'What line feels truest right now?':'Want a line by line tightening pass?')].filter(Boolean).join(' ');
  };

  select?.addEventListener('change',()=>renderCoach(true));
  renderCoach(true);

  chatForm?.addEventListener('submit',(e)=>{
    e.preventDefault();
    const text=String(chatInput?.value||'').trim();
    if(!text) return;
    const coach=renderCoach(false);
    addMsg('user',text);
    if(chatInput) chatInput.value='';
    setTimeout(()=>addMsg('bot',makeReply(coach,text)),220);
  });

  closeBtn?.addEventListener('click',()=>{
    root.classList.remove('in');
    setTimeout(()=>root.remove(),220);
  });
}

(async()=>{
  try{
  applyTheme(getPreferredTheme());
  const data=await loadContent();
  const path=location.pathname;
  ensureResponsiveHeader();
  setupTopNav();
  track('page_view',{path});

  if(path==='/'){
    document.getElementById('hero')?.append(
      card(`<section class='hero hero-with-image'><div class='hero-copy'><p class='kicker'>Poetry Personality Analysis</p><h1>Discover the personality in your poetry.</h1><p class='lead'>Paste your poems and get a clear personality profile inspired by poetic style, tone, and emotional patterns.</p><p>Thoughtful insights in seconds-beautifully organized, easy to explore.</p><div class='cta-row'><a class='btn primary' href='/analyze'>Analyze Your Poems</a><a class='btn secondary' href='/results-demo'>View Sample Result</a></div></div><figure class='hero-image'><video class='hero-image-video' muted loop playsinline preload='metadata' poster='/images/landing-page.png'><source src='/videos/landing-page-hover.mp4' type='video/mp4'></video></figure></section>`,'')
    );
    setupLandingHeroHoverVideo(document);

    const proof=document.getElementById('proof');
    const proofMoments=[
      {kicker:'Signal',title:'Pattern-based analysis',body:'Across your submitted poems, recurring structure, tone, and imagery reveal your deeper poetic signature.'},
      {kicker:'Archetypes',title:'16 original poetry personalities',body:'A crafted typology designed for poets-distinct energies, not generic labels.'},
      {kicker:'Depth',title:'Confidence grows over time',body:'Each new submission refines your profile, moving from impression toward identity.'}
    ];
    proof?.classList.add('proof-moment-grid');
    proofMoments.forEach((m,idx)=>proof?.append(card(`<div class='proof-card'><div class='proof-ornament'>✦</div><p class='proof-kicker'>${m.kicker}</p><h3 class='proof-title'>${m.title}</h3><p class='proof-body'>${m.body}</p></div>`, `proof-wrap proof-${idx+1}`)));

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
    root?.insertAdjacentHTML('beforeend',`<section id='analyzeUploader' class='reveal'></section>`);
    setupPoemUploader('analyzeUploader',data.types||[]);
  }

  if(path==='/types'){
    const grid=document.getElementById('typesGrid');

    // If server already rendered cards, do not re-render client-side.
    // This avoids mobile flicker/disappear from DOM replacement.
    if(grid?.querySelector('.type-card')){
      // Make sure cards are visible even if reveal scripts fail.
      grid.classList.add('in');
      setupTypeHoverVideos(grid);
    }else{
      const renderTypes=(types)=>{
        if(!grid) return;
        grid.innerHTML='';
        types.forEach(t=>{
          const videoFile=TYPE_HOVER_VIDEO_BY_SLUG[t.slug];
          const hoverVideo=videoFile?`<video class='type-hover-video' muted loop playsinline preload='metadata' poster='/images/${t.slug}.png'><source src='/videos/${videoFile}' type='video/mp4'></video>`:'';
          grid.append(card(`<div class='type-card ${videoFile?'has-hover-video':''}' data-type-slug='${t.slug}'><a class='type-card-art-link' href='/type/${t.slug}' aria-label='Open ${t.name} profile'><figure class='type-card-art'><img src='/images/${t.slug}.png' alt='${t.name} personality illustration' loading='lazy'/>${hoverVideo}</figure></a><span class='chip'>${t.group}</span><h3>${t.name}</h3><p>${t.shortBlurb}</p><a class='type-card-cta' href='/type/${t.slug}'><span>View full profile</span><span aria-hidden='true'>→</span></a></div>`));
        });
        setupTypeHoverVideos(grid);
      };

      const types=Array.isArray(data?.types)?data.types:[];
      if(types.length){
        renderTypes(types);
      }else{
        grid?.append(card("<h3>Type profiles are loading…</h3><p class='muted'>If this persists, refresh once.</p>"));
      }

      setTimeout(async ()=>{
        if(!grid || grid.querySelector('.type-card')) return;
        try{
          const retryData=await loadContent();
          const retryTypes=Array.isArray(retryData?.types)?retryData.types:[];
          if(retryTypes.length) renderTypes(retryTypes);
        }catch{}
      },1200);
    }
  }

  if(path.startsWith('/type/')){
    const slug=path.split('/').pop();
    const t=data.types.find(x=>x.slug===slug);
    const all=data.types;
    const elRoot=document.getElementById('typePage');
    if(!t){elRoot?.append(card('<h2>Type not found</h2><p class="muted">Try browsing from the 16 types page.</p>'));setupReveal();setupClickTracking();return;}

    const siblings=all.filter(x=>x.group===t.group && x.slug!==t.slug).slice(0,3);
    renderTypeProfileTabs(elRoot,t,siblings,all);
  }

  if(path==='/categories'){
    const c=document.getElementById('categories');
    const groupVideoBySlug={
      'visionaries':'visionaries-group.mp4',
      'romantics':'romantics-group.mp4',
      'truth-tellers':'truth-tellers-group.mp4',
      'makers':'makers-group.mp4'
    };
    data.groups.forEach(g=>{
      const list=g.types
        .map(slug=>data.types.find(t=>t.slug===slug))
        .filter(Boolean)
        .map(t=>`<a href='/type/${t.slug}'>${t.name}</a>`)
        .join('');
      const videoFile=groupVideoBySlug[g.slug];
      const media=videoFile
        ? `<video muted loop autoplay playsinline preload='metadata' poster='/images/${g.slug}.png'><source src='/videos/${videoFile}' type='video/mp4'></video>`
        : `<img src='/images/${g.slug}.png' alt='${g.name} category illustration' loading='lazy'/>`;
      c?.append(card(`<figure class='category-card-art'>${media}</figure><h2>${g.name}</h2><p>${g.description}</p><div class='category-type-links'>${list}</div>`));
    });
  }

  if(path==='/account') await setupAccountPage();
  if(path==='/forgot-password') setupForgotPasswordPage();
  if(path==='/reset-password') setupResetPasswordPage();
  if(path==='/dashboard') setupDashboardPage();
  if(path==='/settings') setupSettingsPage();
  if(path.startsWith('/my-poems/')) setupMyPoemsPage();

  setupReveal();
  setupHeaderScroll();
  setupClickTracking();
  setupEmailCapture();
  setupStickyCta();
  setupStorytellerGuide(data.types||[]);
  setupThemeToggle();
  await setupGlobalAccountButton();
  }catch(error){
    console.error('App bootstrap failed', error);
    const root=document.getElementById('typesGrid')||document.getElementById('hero')||document.querySelector('main');
    if(root){
      root.append(card("<h3>We couldn't load this content right now.</h3><p class='muted'>Please refresh in a few seconds.</p>"));
    }
  }
})();