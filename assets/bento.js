(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.CIRCLE_BENTO=api;
})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const clamp=value=>Number.isFinite(value)?Math.min(1,Math.max(0,value)):0;
 function progressAt(scroll,start,distance){
  return distance>0?clamp((scroll-start)/distance):0;
 }
 function frameAt(from,to,progress){
  const p=clamp(progress),frame={};
  for(const key of ['x','y','width','height','radius'])frame[key]=from[key]+(to[key]-from[key])*p;
  return frame;
 }
 // Native sticky + a single scheduled frame, not scroll interception or autoplay.
 // Inspired by GSAP's Scrubbed Bento Gallery; no demo code or remote assets copied.
 function mount(scene){
  if(!scene)return ()=>{};
  const win=scene.ownerDocument.defaultView;
  const stage=scene.querySelector('.bento-stage'),track=scene.querySelector('.bento-scroll');
  const center=scene.querySelector('.object-0'),copy=scene.querySelector('.hero-copy');
  const control=scene.querySelector('[data-bento-toggle]');
  if(!stage||!track||!center||!copy||!control)return ()=>{};
  const photo=center.querySelector('img');
  const sides=Array.from(scene.querySelectorAll('.bento-side'));
  const reduced=win.matchMedia('(prefers-reduced-motion: reduce)');
  let active=false,manualOff=false,destroyed=false,raf=0,resizeTimer=0,metrics=null;
  let current=0,lastTime=0,viewportWidth=win.innerWidth,viewportHeight=win.innerHeight;
  function reset(){
   active=false;metrics=null;current=0;lastTime=0;
   win.cancelAnimationFrame(raf);raf=0;
   scene.classList.remove('bento-motion');
   scene.style.removeProperty('--bento-progress');
   scene.style.removeProperty('--bento-copy-offset');
   scene.style.removeProperty('--bento-copy-top');
   scene.style.removeProperty('--bento-spread');
   track.style.removeProperty('height');
   for(const name of ['width','height','transform','border-radius'])center.style.removeProperty(name);
   copy.inert=false;sides.forEach(side=>side.inert=false);
  }
  function paint(progress){
   const frame=frameAt(metrics.from,metrics.to,progress);
   center.style.width=frame.width+'px';center.style.height=frame.height+'px';
   center.style.transform='translate('+frame.x+'px,'+frame.y+'px)';
   center.style.borderRadius=frame.radius+'px';
   scene.style.setProperty('--bento-progress',String(progress));
   // Faded links must not remain invisible keyboard targets.
   copy.inert=metrics.desktop&&progress>=1/3;
   sides.forEach(side=>side.inert=progress>=.4);
  }
  function tick(time){
   raf=0;if(!active||destroyed)return;
   const target=progressAt(win.scrollY,metrics.start,metrics.distance);
   const delta=lastTime?Math.min(64,time-lastTime):16;lastTime=time;
   current+=(target-current)*(1-Math.exp(-delta/70));
   if(Math.abs(target-current)<.0005)current=target;
   paint(current);
   if(current!==target)raf=win.requestAnimationFrame(tick);else lastTime=0;
  }
  function schedule(){if(active&&!raf)raf=win.requestAnimationFrame(tick);}
  function refresh(){
   if(destroyed)return;
   reset();
   const hasPhoto=photo&&photo.complete&&photo.naturalWidth>0;
   const available=hasPhoto&&!reduced.matches&&win.innerHeight>=480&&win.CSS.supports('position','sticky');
   control.hidden=!available;
   control.textContent=manualOff?'움직임 켜기':'움직임 끄기';
   control.setAttribute('aria-pressed',String(!manualOff&&available));
   if(!available||manualOff)return;
   const desktop=win.innerWidth>=768,top=desktop?24:16;
   const height=stage.getBoundingClientRect().height;
   const offset=desktop?Math.max(0,(height-copy.getBoundingClientRect().height)/2):0;
   const distance=desktop?Math.min(720,win.innerHeight*.78):Math.min(280,win.innerHeight*.34);
   scene.style.setProperty('--bento-copy-offset',offset+'px');
   scene.style.setProperty('--bento-copy-top',(top+offset)+'px');
   track.style.height=(height+distance)+'px';
   scene.classList.add('bento-motion');
   // offsetLeft/Top describe the untransformed tile, even when refreshing mid-scroll.
   const from={x:0,y:0,width:center.offsetWidth,height:center.offsetHeight,radius:24};
   const targetLeft=desktop?scene.getBoundingClientRect().left:stage.getBoundingClientRect().left;
   scene.style.setProperty('--bento-spread',(stage.getBoundingClientRect().left-targetLeft)+'px');
   const to={x:targetLeft-stage.getBoundingClientRect().left-center.offsetLeft,y:-center.offsetTop,
    width:desktop?scene.clientWidth:stage.clientWidth,height,radius:desktop?24:16};
   metrics={from,to,desktop,distance,start:track.getBoundingClientRect().top+win.scrollY-top};
   active=true;
   current=progressAt(win.scrollY,metrics.start,distance);paint(current);
  }
  function resize(){
   // Small mobile address-bar changes should not rebuild a pinned scene.
   if(win.innerWidth===viewportWidth&&Math.abs(win.innerHeight-viewportHeight)<80)return;
   viewportWidth=win.innerWidth;viewportHeight=win.innerHeight;
   win.clearTimeout(resizeTimer);resizeTimer=win.setTimeout(refresh,120);
  }
  function toggle(){
   const top=stage.getBoundingClientRect().top;
   manualOff=!manualOff;refresh();
   // Preserve the visible position when collapsing the extra scroll distance.
   if(manualOff&&top<=24)win.scrollTo({top:Math.max(0,track.getBoundingClientRect().top+win.scrollY-16),behavior:'instant'});
  }
  control.addEventListener('click',toggle);
  win.addEventListener('scroll',schedule,{passive:true});
  win.addEventListener('resize',resize,{passive:true});
  win.addEventListener('pageshow',refresh);
  reduced.addEventListener('change',refresh);
  if(photo){photo.addEventListener('load',refresh);photo.addEventListener('error',refresh);}
  scene.ownerDocument.fonts?.ready.then(()=>{if(!destroyed)refresh();});
  refresh();
  return function destroy(){
   destroyed=true;reset();win.clearTimeout(resizeTimer);
   control.removeEventListener('click',toggle);
   win.removeEventListener('scroll',schedule);win.removeEventListener('resize',resize);
   win.removeEventListener('pageshow',refresh);reduced.removeEventListener('change',refresh);
   if(photo){photo.removeEventListener('load',refresh);photo.removeEventListener('error',refresh);}
  };
 }
 return {clamp,progressAt,frameAt,mount};
});
