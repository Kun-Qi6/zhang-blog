let articles=[];
let site=null;
let heroAutoplayAttempted=false;
let renderedRoute='/home',contentRefreshing=false,contentRefreshPending=false,contentRefreshTimer;
const staticContent=window.BlogStaticData||null;
async function readPublicData(resource){
  if(staticContent)return staticContent[resource];
  const response=await fetch('/api/'+resource,{cache:'no-store'});
  if(!response.ok)throw Error('内容无法加载');
  return response.json();
}
function card(a){return `<a class="article-card" href="#/article/${encodeURIComponent(a.id)}"><div class="article-cover"><img src="${coverUrl(a.cover)}" alt="" loading="lazy"><span class="article-tag">${escapeText(channelName(a.kind))}</span></div><div class="article-body"><h3>${escapeText(a.title)}</h3><p>${escapeText(a.excerpt)}</p><div class="article-meta"><time>${escapeText(a.date)}</time><span>${escapeText(a.topic)}</span></div></div></a>`}
document.querySelector('#latest-grid').innerHTML=articles.slice(0,3).map(card).join('');
const app=document.querySelector('#app');
const homeMarkup=app.innerHTML;
function channelName(kind){return site?.channels.find(channel=>channel.kind===kind)?.title||{reading:'读书文章',tech:'技术博客',exam:'考研总结'}[kind]||'文章'}
function applySiteHeader(){
  document.querySelector('.avatar img').src=assetUrl(site.profile.photo);
  document.querySelector('.avatar img').alt=`${site.profile.name}的头像`;
  for(const channel of site.channels){
    for(const selector of ['.desktop-nav','.mobile-nav']){const link=document.querySelector(`${selector} a[href="#/category/${channel.kind}"]`);if(link)link.textContent=channel.title}
    const side=document.querySelector(`.side-nav a[href="#/category/${channel.kind}"]`);if(side){side.querySelector('.side-label').textContent=channel.title;side.title=channel.title;side.setAttribute('aria-label',channel.title)}
  }
}
function renderHomeContent(){
  if(!site)return;
  const p=site.profile;
  const profile=document.querySelector('.profile-block');profile.querySelector('h2').textContent=p.name;profile.querySelector('p:not(.kicker)').textContent=p.summary;profile.querySelector('img').src=assetUrl(p.photo);profile.querySelector('img').alt=`${p.name}的头像`;
  document.querySelector('.avatar img').src=assetUrl(p.photo);
  document.querySelector('.channel-list').innerHTML='<p class="kicker">CHANNELS</p>'+site.channels.map((item,index)=>`<a href="#/category/${item.kind}"><span>${String(index+1).padStart(2,'0')}</span><strong>${escapeText(item.title)}</strong><small>${escapeText(item.subtitle)}</small></a>`).join('');
  document.querySelector('#topic-grid').innerHTML=site.topics.map(item=>`<a class="topic-card" href="#/category/${item.kind}${item.board?'/topic/'+encodeURIComponent(item.board):''}"><strong>${escapeText(item.title)}</strong><span>${escapeText(item.description)}</span></a>`).join('');
  const note=document.querySelector('.note-block');note.querySelector('p:not(.kicker)').textContent=site.note.text;note.querySelector('span').textContent=site.note.signature;
}
async function renderHero(){
  const hero=document.querySelector('.home-hero-compact');if(!hero)return;
  hero.querySelector('.hero-bottom>a').onclick=event=>{event.preventDefault();document.querySelector('#latest')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})};
  try{
    const settings=await readPublicData('appearance');if(!hero.isConnected)return;
    hero.style.setProperty('--hero-height',`${settings.heroHeight}px`);hero.classList.toggle('media-only',!settings.showText);
    const image=hero.querySelector('#hero-image'),video=hero.querySelector('#hero-video'),button=hero.querySelector('#hero-playback');
    if(settings.heroType==='video'){
      video.src=assetUrl(settings.heroUrl);video.loop=false;video.muted=false;video.hidden=true;image.hidden=false;button.hidden=false;
      const sync=()=>{
        const playing=!video.paused&&!video.ended;
        const label=video.ended?'重新播放视频':playing&&video.muted?'开启视频声音':playing?'暂停视频':video.currentTime?'继续播放视频':'播放视频';
        button.innerHTML=playing&&!video.muted?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zm7 0h4v14h-4z" fill="currentColor" /></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 11 7-11 7Z" fill="currentColor" /></svg>';
        button.setAttribute('aria-label',label);button.title=label;
      };
      video.addEventListener('play',sync);video.addEventListener('pause',sync);
      video.addEventListener('volumechange',sync);
      video.addEventListener('playing',()=>{video.hidden=false;image.hidden=true;sync()});
      video.addEventListener('ended',()=>{video.hidden=true;image.hidden=false;sync()});
      video.addEventListener('error',()=>{video.hidden=true;image.hidden=false;button.hidden=true});
      const toggle=async()=>{
        if(!video.paused&&!video.muted){video.pause();return}
        if(video.ended)video.currentTime=0;
        video.muted=false;
        try{await video.play();sync()}catch{video.hidden=true;image.hidden=false;button.setAttribute('aria-label','视频暂时无法播放，点击重试');button.title='视频暂时无法播放，点击重试'}
      };
      button.onclick=toggle;
      sync();
      if(!heroAutoplayAttempted){
        heroAutoplayAttempted=true;
        try{await video.play()}catch(error){
          // Browsers may require a user gesture for sound; still show the video once.
          if(error.name==='NotAllowedError'&&hero.isConnected){video.muted=true;try{await video.play()}catch{video.hidden=true;image.hidden=false;sync()}}
        }
      }
    }else{button.hidden=true;video.pause();video.hidden=true;image.hidden=false;image.src=assetUrl(settings.heroUrl);image.onerror=()=>{image.onerror=null;image.src=assetUrl('/assets/home-cover.jpg')}}
  }catch{/* The built-in photograph remains available if settings cannot load. */}
}
function renderYearSummary(){
  const year=new Date().getFullYear(),yearArticles=articles.filter(article=>article.date?.startsWith(String(year)));
  const counts={reading:0,tech:0,exam:0};const monthly=Array(12).fill(0);
  for(const article of yearArticles){if(article.kind in counts)counts[article.kind]++;const month=Number(article.date.slice(5,7));if(month>=1&&month<=12)monthly[month-1]++}
  const elapsed=Math.max(0,Math.min(100,Math.round((Date.now()-new Date(year,0,1))/(new Date(year+1,0,1)-new Date(year,0,1))*100)));
  document.querySelector('#summary-year').textContent=year;document.querySelector('#summary-total').textContent=yearArticles.length;
  for(const kind of Object.keys(counts))document.querySelector('#summary-'+kind).textContent=counts[kind];
  document.querySelector('#summary-time').textContent=`${elapsed}%`;document.querySelector('#summary-ring').style.setProperty('--year-progress',`${elapsed}%`);
  document.querySelector('#summary-days').textContent=Math.floor((new Date().setHours(0,0,0,0)-new Date(year,0,1))/86400000)+1;
  document.querySelector('#summary-active-months').textContent=`${monthly.filter(Boolean).length} 个活跃月`;
  const chart=document.querySelector('#summary-months');chart.replaceChildren();const max=Math.max(1,...monthly);
  monthly.forEach((count,index)=>{const bar=document.createElement('span');bar.className=count?'month-bar':'month-bar inactive';bar.style.setProperty('--bar-height',`${Math.max(7,Math.round(count/max*100))}%`);bar.title=`${index+1} 月发布 ${count} 篇`;bar.setAttribute('aria-label',bar.title);chart.append(bar)});
}
async function renderTasks(){
  const list=document.querySelector('#task-widget-list');if(!list)return;
  try{const tasks=await readPublicData('tasks');if(!list.isConnected)return;list.replaceChildren();
    if(!tasks.length){const empty=document.createElement('div');empty.className='widget-empty task-empty';empty.innerHTML='<span class="empty-task-index">01 / 下一个目标</span><strong>从一件想做的事开始</strong><div class="empty-task-track" aria-hidden="true"></div><p>添加任务，记录进度与投入。</p>';list.append(empty);return}
    for(const task of tasks){
      const item=document.createElement('article');item.className='mini-task';
      const head=document.createElement('div');head.className='mini-task-head';const title=document.createElement('strong');title.textContent=task.title;const value=document.createElement('span');value.textContent=`${task.progress}%`;head.append(title,value);
      const bar=document.createElement('div');bar.className='mini-task-bar';bar.setAttribute('role','progressbar');bar.setAttribute('aria-label',task.title);bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax','100');bar.setAttribute('aria-valuenow',String(task.progress));const fill=document.createElement('span');fill.style.width=`${task.progress}%`;bar.append(fill);
const themes={mountain:'home-cover.jpg',reading:'hobby-reading.png',campus:'campus-hero.png'};const background=/^\/assets\/[\w/-]+\.(?:png|jpe?g|webp|gif)$/i.test(task.background||'')?assetUrl(task.background):`./assets/${themes[task.theme]||themes.campus}`;item.style.setProperty('--task-image',`url("${background}")`);
      const status=document.createElement('span');status.className='task-state';status.textContent=task.progress===100?'已完成':task.progress===0?'未开始':'进行中';
      const dates=document.createElement('p');dates.className='task-date-range';dates.textContent=task.startDate&&task.dueDate?`${task.startDate} — ${task.dueDate}`:task.dueDate?`截止 ${task.dueDate}`:task.startDate?`开始 ${task.startDate}`:'按自己的节奏前进';
      item.append(status,head,dates,bar);
      if(task.note){const note=document.createElement('p');note.className='mini-task-note';note.textContent=task.note;item.append(note)}
      const metrics=document.createElement('div');metrics.className='task-metrics';
      const days=task.dueDate?Math.round((new Date(`${task.dueDate}T00:00:00`)-new Date().setHours(0,0,0,0))/86400000):null;
      const deadline=document.createElement('div');const remaining=document.createElement('strong');remaining.textContent=task.progress===100?'完成':days===null?'—':`${Math.abs(days)}`;const label=document.createElement('span');label.textContent=task.progress===100?'目标已达成':days===null?'未设截止日期':days<0?'天 · 已超期':days===0?'今天截止':'天 · 距离截止';deadline.append(remaining,label);
      const effort=document.createElement('div');const hours=document.createElement('strong');hours.textContent=Number(task.totalHours||0).toLocaleString('zh-CN',{maximumFractionDigits:1});const caption=document.createElement('span');caption.textContent='小时 · 累计投入';effort.append(hours,caption);metrics.append(deadline,effort);item.append(metrics);
      list.append(item);
    }
  }catch{list.textContent='任务暂时无法加载。'}
}
const categoryData={
  reading:{name:'读书文章',en:'READING',desc:'读后感、随手摘录，以及读完之后仍然想继续琢磨的问题。',subs:['文学作品','哲学思考','历史书籍','科普阅读','书籍推荐']},
  tech:{name:'技术博客',en:'TECH',desc:'网络实验、编程练习和项目记录。尽量说明问题是怎么发生、怎么解决的。',subs:['网络工程','编程开发','人工智能','项目实践']},
  exam:{name:'考研总结',en:'EXAM',desc:'复习过程中整理的知识点、真题复盘和阶段总结。',subs:['数学','操作系统','数据结构','计算机网络','英语','专业课']},
  all:{name:'所有文章',en:'ARCHIVE',desc:'按发布时间排列的全部记录。',subs:['全部','读书文章','技术博客','考研总结']}
};
const articleBodies={
  'order-in-reading':`<p class="dropcap">阅读最动人的地方，不是替我们给出答案，而是让原本混乱的经验逐渐显影。当一本书真正进入生活，它会改变我们观察日常的方式。</p><h2>从输入到理解</h2><p>过去我常把“读完”当作阅读的终点：划线、摘抄、合上书页，然后奔向下一本。后来才发现，真正留下来的从来不是数量，而是那些被自己重新组织过的观点。</p><blockquote>好的记录不是复述，而是一次诚实的对话：这段文字为什么打动我，它改变了什么？</blockquote><h2>建立自己的阅读秩序</h2><p>现在，我会在阅读后留下三个问题：作者真正回应了什么；我同意与不同意的部分是什么；它能够与既有经验产生怎样的连接。</p><p>秩序并不是把生活变得僵硬。恰恰相反，它为注意力腾出空间，让我们可以更从容地面对那些尚未想明白的事。</p>`,
  'bgp-practice':`<p class="dropcap">BGP 是自治系统之间交换路由信息的核心协议。理解它，不能只记住命令，还要看清路径属性如何共同影响决策。</p><h2>先建立整体视图</h2><p>一个可靠的学习顺序是：邻居建立、路由通告、属性传播、最优路径选择，最后再进入策略控制。这样配置命令就不再是零散片段，而是协议状态变化的具体表达。</p><pre><code>router bgp 65001\n neighbor 10.0.12.2 remote-as 65002\n network 192.168.1.0 mask 255.255.255.0</code></pre><h2>实验中的检查清单</h2><p>先确认 TCP 179 端口与邻居状态，再查看路由是否进入 BGP 表，最后检查下一跳可达性。遇到问题时，沿着控制平面逐层定位，比重复敲命令更有效。</p><blockquote>协议学习的目标，是能够解释每一次状态变化，而不只是得到正确的终端输出。</blockquote>`,
  'os-knowledge':`<p class="dropcap">操作系统的知识点看似庞杂，核心始终围绕资源：处理器、内存、文件和设备如何被安全而高效地管理。</p><h2>用问题串联章节</h2><p>进程与线程回答“工作如何被组织”；调度回答“谁先使用处理器”；同步互斥回答“并发如何保持正确”；虚拟内存回答“有限空间如何服务更多程序”。</p><h2>复习中的三层结构</h2><p>第一层记住概念与条件，第二层掌握典型算法，第三层能够在题目场景中判断该调用哪一类模型。把错题归因到这三层之一，复盘会更有针对性。</p><blockquote>真题的价值不只是检验记忆，更是暴露知识之间尚未建立的连接。</blockquote>`
};
function categoryView(kind,board=''){
  const builtIn=categoryData[kind]||categoryData.all;
  const channel=site?.channels.find(item=>item.kind===kind);
  const d={...builtIn,name:channel?.title||builtIn.name,desc:channel?.description||builtIn.desc};
  const list=(kind==='all'?articles:articles.filter(article=>article.kind===kind)).filter(article=>!board||article.topic===board);
  const links=kind==='all'?[{name:'全部',href:'#/category/all'},...(site?.channels||[]).map(item=>({name:item.title,href:'#/category/'+item.kind}))]:[{name:'全部',href:'#/category/'+kind},...(channel?.boards||builtIn.subs).map(name=>({name,href:'#/category/'+kind+'/topic/'+encodeURIComponent(name)}))];
  return `<section class="page-hero category-hero"><div class="container"><p class="eyebrow">${escapeText(d.en)}</p><h1>${escapeText(d.name)}</h1><p>${escapeText(d.desc)}</p><div class="subnav">${links.map((item,index)=>`<a class="${(!board&&index===0)||item.name===board?'selected':''}" href="${item.href}">${escapeText(item.name)}</a>`).join('')}</div></div></section><section class="container listing section-pad"><div class="listing-top"><p><strong>${list.length}</strong> 篇记录${board?' · '+escapeText(board):''}</p><span>按时间排序</span></div><div class="article-grid">${list.map(card).join('')||'<p>这个板块还没有文章。</p>'}</div></section>`;
}
function aboutView(){
 const p=site?.profile;if(!p)return '';
 const fields=[['学校',p.school],['坐标',p.location],['研究方向',p.research],['兴趣方向',p.interests]].filter(([,value])=>value);
 const hobbyImages={'阅读':'hobby-reading-marker.png','吃饭':'hobby-food-marker.png','旅行':'hobby-travel-marker.png'};
 const dailyNote=p.dailyNote||'在书里找答案，在饭点找快乐，在路上找新鲜感。偶尔和代码较较劲，也会为了好吃的绕一点路。这个小站装着我的学习笔记和生活碎片，欢迎随便逛逛。';
 const skills=p.skills.filter(group=>group.items.length);
 return `<section class="about-hero-page"><div class="container about-hero-grid"><div class="about-hero-copy"><p class="eyebrow">ABOUT / 关于</p><h1>你好，我是<br><span>${escapeText(p.name)}。</span></h1>${p.tagline?`<h2>${escapeText(p.tagline)}</h2>`:''}${p.lead?`<p class="about-lead">${escapeText(p.lead)}</p>`:''}<div class="about-actions">${p.email?`<a class="primary-button" href="mailto:${escapeText(p.email)}">给我写信 <span aria-hidden="true">↗</span></a>`:''}<a class="soft-button" href="#/category/all">看看文章</a></div><div class="about-daily"><p class="kicker">LIFE, LATELY / 日常碎片</p><p>${escapeText(dailyNote)}</p><a class="about-interest-link" href="#about-interests">${p.hobbies.map(item=>escapeText(item.title)).join('<span aria-hidden="true"> / </span>')}<span aria-hidden="true"> ↓</span></a></div></div><figure class="about-portrait"><div class="about-portrait-frame"><img src="${escapeText(assetUrl(p.photo))}" alt="${escapeText(p.name)}的头像"></div><figcaption><span>${escapeText(p.name)}</span>${p.location?`<small>${escapeText(p.location)}</small>`:''}</figcaption></figure></div></section>
 <section class="container about-content section-pad${skills.length?'':' without-skills'}"><div class="identity-card"><p class="kicker">PROFILE</p><h2>我的身份</h2><dl>${fields.map(([title,value])=>`<div><dt>${escapeText(title)}</dt><dd>${escapeText(value)}</dd></div>`).join('')}</dl></div><div class="bio-card"><p class="kicker">INTRODUCTION</p><h2>个人简介</h2>${[p.bio1,p.bio2].filter(Boolean).map(text=>`<p>${escapeText(text)}</p>`).join('')}${p.quote?`<blockquote>${escapeText(p.quote)}</blockquote>`:''}</div>${skills.length?`<div class="skill-card"><p class="kicker">SKILLS</p><h2>技能栈</h2>${skills.map(group=>`<div class="skill-row"><strong>${escapeText(group.group)}</strong><div>${group.items.map(item=>`<span>${escapeText(item)}</span>`).join('')}</div></div>`).join('')}</div>`:''}</section>
 ${p.hobbies.length?`<section class="interest-section" id="about-interests"><div class="container section-pad"><div class="section-heading"><div><p class="kicker">BEYOND THE SCREEN</p><h2>屏幕之外</h2></div><p>读点书，吃顿饭，去远一点的地方。</p></div><div class="interest-grid">${p.hobbies.map((item,index)=>`<article><img src="./assets/${hobbyImages[item.title]||['hobby-reading-marker.png','hobby-food-marker.png','hobby-travel-marker.png'][index%3]}" alt="${escapeText(item.title)}主题配图" loading="lazy"><div><span class="interest-number">${String(index+1).padStart(2,'0')}</span><h3>${escapeText(item.title)}</h3><p>${escapeText(item.description)}</p></div></article>`).join('')}</div></div></section>`:''}`;
}
function articleView(id){
 const a=articles.find(x=>x.id===decodeURIComponent(id));
 if(!a)return '<section class="page-hero container"><h1>文章不存在或尚未发布</h1><a href="#/home">返回首页</a></section>';
 return `<article class="article-page"><header class="article-header container"><a class="back-link" href="#/category/${a.kind}">← 返回${escapeText(channelName(a.kind))}</a><p class="eyebrow">${escapeText(a.topic)}</p><h1>${escapeText(a.title)}</h1><p class="article-deck">${escapeText(a.excerpt)}</p><time>${escapeText(a.date)}</time></header><div class="article-banner"><img src="${coverUrl(a.cover)}" alt=""></div><div class="article-layout container"><aside><a href="#/category/all">全部文章</a></aside><div class="prose">${renderMarkdown(a.content)}</div></div></article>`;
}
function setActive(path){
  let activePath=path.startsWith('/category/')?path.split('/').slice(0,3).join('/'):path;
  if(path.startsWith('/article/')){const article=articles.find(item=>item.id===decodeURIComponent(path.split('/')[2]));if(article)activePath='/category/'+article.kind}
  document.querySelectorAll('.desktop-nav a,.side-nav a[data-route]').forEach(link=>{const active=link.getAttribute('href')===`#${activePath}`;link.classList.toggle('active',active);if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current')});
}
const sideNavigation=document.querySelector('#side-navigation'),sideToggle=document.querySelector('#side-nav-toggle');
function setSideNavigation(open){sideNavigation.classList.toggle('expanded',open);sideToggle.setAttribute('aria-expanded',String(open));sideToggle.setAttribute('aria-label',open?'收起导航':'展开导航');sideToggle.title=open?'收起导航':'展开导航'}
sideToggle.addEventListener('click',()=>setSideNavigation(!sideNavigation.classList.contains('expanded')));
sideNavigation.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>setSideNavigation(false)));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&sideNavigation.classList.contains('expanded')){setSideNavigation(false);sideToggle.focus()}});
document.addEventListener('click',event=>{if(!sideNavigation.contains(event.target))setSideNavigation(false)});
document.addEventListener('click',event=>{const link=event.target.closest('a[href^="#/"]');if(link&&link.getAttribute('href')===location.hash)window.scrollTo({top:0,behavior:'smooth'})});
function route(resetScroll=true,overridePath){
  const path=overridePath||location.hash.slice(1)||'/home';
  if(!path.startsWith('/')){document.getElementById(path)?.scrollIntoView();return}
  renderedRoute=path;
  app.querySelector('#hero-video')?.pause();
  if(path==='/home'){app.innerHTML=homeMarkup;document.querySelector('#latest-grid').innerHTML=articles.slice(0,3).map(card).join('');renderHomeContent();renderYearSummary();renderTasks();renderHero()}
  else if(path==='/about')app.innerHTML=aboutView();
  else if(path.startsWith('/category/')){const [, ,kind,marker,encoded]=path.split('/');app.innerHTML=categoryView(kind,marker==='topic'&&encoded?decodeURIComponent(encoded):'')}
  else if(path.startsWith('/article/'))app.innerHTML=articleView(path.split('/')[2]);
  setActive(path);if(resetScroll)window.scrollTo(0,0);
}
const menu=document.querySelector('#mobile-nav'),menuBtn=document.querySelector('#menu-toggle');
menuBtn.addEventListener('click',()=>{const open=menu.classList.toggle('open');menuBtn.setAttribute('aria-expanded',open)});menu.addEventListener('click',()=>{menu.classList.remove('open');menuBtn.setAttribute('aria-expanded','false')});
const theme=document.querySelector('#theme-toggle');theme.addEventListener('click',()=>{document.body.classList.toggle('dark');localStorage.setItem('theme',document.body.classList.contains('dark')?'dark':'light')});if(localStorage.getItem('theme')==='dark')document.body.classList.add('dark');
const search=document.querySelector('#search-input'),panel=document.querySelector('#search-panel'),results=document.querySelector('#search-results');search.addEventListener('input',e=>{const q=e.target.value.trim().toLowerCase();if(!q){panel.classList.remove('open');panel.setAttribute('aria-hidden','true');return}const hits=articles.filter(a=>`${a.title}${a.excerpt}${a.type}${a.topic}`.toLowerCase().includes(q));results.innerHTML=hits.length?hits.map(a=>`<a href="#/article/${encodeURIComponent(a.id)}"><span>${escapeText(a.type)} · ${escapeText(a.topic)}</span><br>${escapeText(a.title)}</a>`).join(''):'<p>没有找到相关文章，换个关键词试试。</p>';panel.classList.add('open');panel.setAttribute('aria-hidden','false')});
document.querySelector('#close-search').addEventListener('click',()=>{panel.classList.remove('open');search.value=''});results.addEventListener('click',()=>panel.classList.remove('open'));
async function refreshContent(){
 if(staticContent){
   articles=staticContent.articles;site=staticContent.site;
   applySiteHeader();route(false,location.hash.startsWith('#/')?location.hash.slice(1):'/home');return;
 }
 if(contentRefreshing){contentRefreshPending=true;return}
 contentRefreshing=true;
 try{const [articleResponse,siteResponse]=await Promise.all([fetch('/api/articles',{cache:'no-store'}),fetch('/api/site',{cache:'no-store'})]);if(!articleResponse.ok||!siteResponse.ok)throw Error();
   const [nextArticles,nextSite]=await Promise.all([articleResponse.json(),siteResponse.json()]);
   const changed=JSON.stringify(articles)!==JSON.stringify(nextArticles)||JSON.stringify(site)!==JSON.stringify(nextSite);
   const initial=!site;
   articles=nextArticles;site=nextSite;
   if(changed){
     applySiteHeader();const y=window.scrollY;
     if(!initial&&renderedRoute==='/home'&&document.querySelector('.home-hero')){
       document.querySelector('#latest-grid').innerHTML=articles.slice(0,3).map(card).join('');renderHomeContent();renderYearSummary();
     }else route(false,initial?(location.hash.startsWith('#/')?location.hash.slice(1):'/home'):renderedRoute);
     window.scrollTo(0,y);
     if(search.value)search.dispatchEvent(new Event('input'));
   }
 }
 catch{if(!site)app.innerHTML='<section class="page-hero container"><h1>暂时无法加载文章</h1><p>请使用博客服务打开页面，然后刷新重试。</p></section>';}
 finally{contentRefreshing=false;if(contentRefreshPending){contentRefreshPending=false;scheduleContentRefresh()}}
}
function scheduleContentRefresh(){clearTimeout(contentRefreshTimer);contentRefreshTimer=setTimeout(refreshContent,120)}
const pendingSyncResources=new Set();let resourceSyncTimer;
window.BlogContentSync?.subscribe(resource=>{
  pendingSyncResources.add(resource);clearTimeout(resourceSyncTimer);
  resourceSyncTimer=setTimeout(()=>{
    const pending=new Set(pendingSyncResources);pendingSyncResources.clear();
    if(pending.has('site')||pending.has('articles'))scheduleContentRefresh();
    if(renderedRoute==='/home'&&document.querySelector('.home-hero')){
      if(pending.has('appearance')){const y=window.scrollY;route(false,'/home');window.scrollTo(0,y)}
      else if(pending.has('tasks'))renderTasks();
    }
  },120);
});
function refreshVisibleContent(){if(document.hidden)return;scheduleContentRefresh();if(renderedRoute==='/home'&&document.querySelector('#task-widget-list'))renderTasks()}
if(!staticContent){
 window.addEventListener('focus',refreshVisibleContent);
 document.addEventListener('visibilitychange',refreshVisibleContent);
 setInterval(refreshVisibleContent,30000);
}
window.addEventListener('hashchange',route);
refreshContent();
