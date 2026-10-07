// One controller per hero. Keep the photograph underneath the video at all times.
window.createHeroMedia = function(hero, settings, {autoplay=false,onAutoplayAttempt=()=>{}}={}) {
  const video=hero.querySelector('#hero-video'),image=hero.querySelector('#hero-image');
  const play=hero.querySelector('#hero-playback'),sound=hero.querySelector('#hero-sound');
  const replay=hero.querySelector('#hero-replay'),seek=hero.querySelector('#hero-seek');
  const timeline=hero.querySelector('.hero-timeline'),clock=hero.querySelector('#hero-time');
  const status=hero.querySelector('#hero-media-status');
  const listeners=[],timers=new Set();let disposed=false,busy=false,finished=false,autoPending=false,autoEligible=false,autoScheduled=false,reported=false;
  let stallTimer,loadTimer,frameId,resumeVisible=false,observer,inView=true,pendingImage;
  const alive=()=>!disposed&&hero.isConnected;
  const later=(fn,ms)=>{const id=setTimeout(()=>{timers.delete(id);if(alive())fn()},ms);timers.add(id);return id};
  const cancel=id=>{clearTimeout(id);timers.delete(id)};
  const on=(target,event,fn)=>{target.addEventListener(event,fn);listeners.push(()=>target.removeEventListener(event,fn))};
  const setPicture=url=>{
    if(image.getAttribute('src')===url)return;
    if(!window.Image){image.src=url;return}
    // Keep the current photograph until the replacement is decoded, including live edits.
    pendingImage=new Image();const candidate=pendingImage;candidate.decoding='async';
    candidate.onload=async()=>{try{await candidate.decode()}catch{}if(alive()&&pendingImage===candidate)image.src=url};
    candidate.onerror=()=>{if(alive()&&pendingImage===candidate)status.textContent='封面图片暂时无法加载，保留当前图片。'};
    candidate.src=url;
  };
  const label=(button,text)=>{button.setAttribute('aria-label',text);button.title=text};
  const icon=(button,path)=>button.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}" /></svg>`;
  const stamp=seconds=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
  const sync=()=>{
    const playing=!video.paused&&!video.ended;
    label(play,busy?'取消视频加载':playing?'暂停视频':finished?'重新播放视频':video.currentTime?'继续播放视频':'播放视频');
    play.classList.toggle('loading',busy);
    icon(play,playing?'M8 5h3v14H8zm6 0h3v14h-3z':'m9 5 11 7-11 7Z');
    label(sound,video.muted?'开启视频声音':'关闭视频声音');sound.setAttribute('aria-pressed',String(!video.muted));
    icon(sound,video.muted?'M11 5 6 9H3v6h3l5 4Z M16 9l5 6m0-6-5 6':'M11 5 6 9H3v6h3l5 4Z M15 8q5 4 0 8m3-11q8 7 0 14');
    const duration=Number.isFinite(video.duration)?video.duration:0;
    seek.disabled=!duration;seek.max=duration||1;seek.value=finished?duration:video.currentTime||0;
    seek.style.setProperty('--seek-progress',`${duration?(Number(seek.value)/duration)*100:0}%`);
    seek.setAttribute('aria-valuetext',`${stamp(Number(seek.value))}，共 ${stamp(duration)}`);
    clock.textContent=`${stamp(Number(seek.value))} / ${stamp(duration)}`;
  };
  const photograph=()=>{hero.classList.remove('video-visible');timeline.hidden=true};
  const release=()=>{video.pause();video.removeAttribute('src');video.preload='none';video.load()};
  const fallback=message=>{
    autoPending=false;autoEligible=false;busy=false;resumeVisible=false;cancel(stallTimer);cancel(loadTimer);
    photograph();release();status.textContent=message;sync();
  };
  image.hidden=false;image.decoding='async';
  if(settings.heroType!=='video'){
    video.hidden=true;photograph();
    play.hidden=sound.hidden=replay.hidden=timeline.hidden=true;
    setPicture(assetUrl(settings.heroUrl));
    on(image,'error',()=>{if(image.getAttribute('src')!==assetUrl('/assets/home-cover.jpg'))image.src=assetUrl('/assets/home-cover.jpg')});
    return {destroy(){disposed=true;if(pendingImage){pendingImage.onload=pendingImage.onerror=null}listeners.forEach(off=>off())}};
  }
  video.hidden=false;video.loop=false;video.muted=false;video.playsInline=true;video.preload='none';
  setPicture(assetUrl('/assets/home-cover.jpg'));
  play.hidden=sound.hidden=replay.hidden=false;label(replay,'从头重播视频');
  const connection=navigator.connection;
  const lightweight=matchMedia('(prefers-reduced-motion: reduce)').matches||connection?.saveData||/^(slow-)?2g$/.test(connection?.effectiveType||'');
  autoEligible=autoplay&&!lightweight;
  const preferSmall=matchMedia('(max-width: 780px)').matches||connection?.saveData||/^(slow-)?[23]g$/.test(connection?.effectiveType||'');
  const source=preferSmall&&/^\/media\/[\w-]+\.(mp4|webm)$/.test(settings.heroMobileUrl||'')?settings.heroMobileUrl:settings.heroUrl;
  const load=()=>{if(!video.getAttribute('src')){video.preload='auto';video.src=assetUrl(source);video.load()}};
  const start=async(manual=false)=>{
    if(!alive()||busy)return;
    busy=true;autoPending=false;autoEligible=false;finished=false;cancel(loadTimer);cancel(stallTimer);
    load();sync();status.textContent=manual?'正在准备视频…':'';
    if(!video.paused&&!video.ended){busy=false;sync();return}
    loadTimer=later(()=>fallback('视频加载较慢，已显示封面图片。可点击播放重试。'),10000);
    try{
      if(!reported){reported=true;onAutoplayAttempt()}
      await video.play();
    }catch(error){
      if(!alive())return;
      if(!manual&&error.name==='NotAllowedError'){
        video.muted=true;
        try{await video.play()}catch{if(alive())fallback('点击播放按钮观看视频。')}
      }else fallback('视频暂时无法播放，可点击重试。');
    }
    if(alive())sync();
  };
  on(video,'playing',()=>{
    busy=false;cancel(stallTimer);cancel(loadTimer);status.textContent='';
    const reveal=()=>{if(alive()&&!video.paused&&!video.ended){hero.classList.add('video-visible');timeline.hidden=false;sync()}};
    // Do not expose a black/unpainted frame between the image and the video.
    if(video.requestVideoFrameCallback)frameId=video.requestVideoFrameCallback(reveal);else reveal();
    sync();
  });
  on(video,'waiting',()=>{
    if(video.paused||video.ended||busy)return;
    cancel(stallTimer);stallTimer=later(()=>fallback('网络缓冲较慢，已切回封面图片。'),1800);
  });
  on(video,'ended',()=>{
    finished=true;busy=false;resumeVisible=false;cancel(stallTimer);cancel(loadTimer);photograph();status.textContent='视频播放完毕。';sync();
    // Stop retaining a large media resource. Replaying explicitly reloads it.
    later(()=>{if(finished){release();sync()}},350);
  });
  on(video,'error',()=>{if(video.getAttribute('src'))fallback('视频加载失败，可点击播放重试。')});
  on(video,'pause',()=>{cancel(stallTimer);sync()});
  for(const event of ['play','volumechange','loadedmetadata','timeupdate','seeked'])on(video,event,sync);
  on(play,'click',()=>{
    resumeVisible=false;
    if(busy){fallback('已取消加载。');return}
    if(!video.paused&&!video.ended){video.pause();sync();return}
    if(finished||video.ended)video.currentTime=0;
    start(true);
  });
  on(sound,'click',()=>{video.muted=!video.muted;sync()});
  on(replay,'click',()=>{if(busy)return;video.currentTime=0;finished=false;start(true)});
  on(seek,'input',()=>{if(Number.isFinite(video.duration)){video.currentTime=Math.min(video.duration,Number(seek.value));sync()}});
  const visibility=visible=>{
    if(!visible){if(autoPending||busy){fallback('点击播放按钮观看视频。');return}if(!video.paused&&!video.ended){resumeVisible=true;video.pause()}}
    else if(resumeVisible){resumeVisible=false;start(false)}
    else if(visible)scheduleAutoplay();
  };
  on(document,'visibilitychange',()=>visibility(!document.hidden&&inView));
  if(window.IntersectionObserver){observer=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;visibility(inView&&!document.hidden)},{threshold:0});observer.observe(hero)}
  function scheduleAutoplay(){
    if(!autoEligible||autoScheduled||document.hidden||!inView)return;
    autoScheduled=true;
    // Let the picture render first, then buffer ahead before the single automatic play.
    later(()=>{
      autoScheduled=false;if(!autoEligible||document.hidden||!inView)return;
      autoEligible=false;
      autoPending=true;load();loadTimer=later(()=>fallback('视频加载较慢，保留封面图片。'),8000);
      const buffered=()=>{
        if(!autoPending)return;
        const end=video.buffered.length?video.buffered.end(video.buffered.length-1):0;
        if(video.readyState>=4||end>=Math.min(4,video.duration||4))start(false);
      };
      on(video,'canplaythrough',()=>{if(autoPending)start(false)});on(video,'progress',buffered);on(video,'canplay',buffered);buffered();
    },300);
  }
  scheduleAutoplay();
  sync();
  return {destroy(){
    disposed=true;observer?.disconnect();listeners.forEach(off=>off());timers.forEach(clearTimeout);photograph();video.hidden=true;
    if(pendingImage){pendingImage.onload=pendingImage.onerror=null}
    if(frameId&&video.cancelVideoFrameCallback)video.cancelVideoFrameCallback(frameId);
    release();
  }};
};
