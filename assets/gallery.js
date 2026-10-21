'use strict';
// One public gallery; source records keep their own storage and access rules.
window.CIRCLE_GALLERY={mount(root,{base,api,esc,createMap}){
 const subjects={all:'전체 보기',manhole:'맨홀',round:'다른 동그라미',text:'글',unknown:'아직 미분류'};
 let state,items=[],result,revision=0,map=null,dialog=null,disposed=false;
 const read=()=>{const q=new URLSearchParams(location.search);return {subject:Object.hasOwn(subjects,q.get('subject'))?q.get('subject'):'all',creator:['rami','participants'].includes(q.get('creator'))?q.get('creator'):(location.hash==='#curated-title'?'rami':'all'),q:q.get('q')||'',author:q.get('author')||'',view:q.get('view')==='map'||location.pathname.endsWith('/map/')?'map':'photos',page:Math.max(1,parseInt(q.get('page'),10)||1),item:q.get('item')||'',focus:q.get('focus')||''};};
 state=read();
 const url=()=>{const q=new URLSearchParams();for(const [k,v]of Object.entries(state))if(v&&v!=='all'&&v!==1&&v!=='photos')q.set(k,v);return base+'/?'+q+'#gallery';};
 const save=(replace=false)=>history[replace?'replaceState':'pushState'](null,'',url());
 const close=()=>{if(dialog){const d=dialog;dialog=null;d.close();d.remove();}};
 const subjectName=item=>subjects[item.subject]||subjects.unknown;
 const cards=()=>items.map(item=>'<article class="card gallery-card"><button class="card-open secondary" data-gallery-item="'+esc(item.item_key)+'" aria-label="'+esc(item.title)+' 상세 보기">'+(item.post_type==='photo'?'<span class="photo-mat"><img src="'+esc(item.thumb)+'" alt="'+esc(item.caption||item.title)+'" loading="lazy"></span>':'<span class="text-art"><span class="card-caption">'+esc(item.caption)+'</span></span>')+'</button><div class="gallery-card-copy"><span class="gallery-kind">'+esc(subjectName(item))+'</span><h3>'+esc(item.title)+'</h3><button class="gallery-author" data-gallery-author="'+esc(item.creator)+'" data-author-name="'+esc(item.author)+'">'+esc(item.author)+'</button></div></article>').join('');
 const change=async patch=>{close();state={...state,focus:'',...patch,item:''};save();await load();root.querySelector('h2')?.focus({preventScroll:true});};
 async function openDetail(index,push=true){
  if(!items[index])return;close();const item=items[index];state.item=item.item_key;if(push)save();
  dialog=document.createElement('dialog');const d=dialog;d.className='gallery-detail';d.setAttribute('aria-label',item.title+' 상세');
  const position=(result.page-1)*24+index+1;
  d.innerHTML='<div class="gallery-detail-top"><button class="secondary" data-close>목록으로</button><span>'+position+' / '+result.total+'</span><button class="text-link" data-all>전체 보기</button></div><div class="gallery-detail-content">'+(item.post_type==='photo'?'<img class="gallery-detail-image" src="'+esc(item.src)+'" alt="'+esc(item.caption||item.title)+'">':'')+'<div class="gallery-detail-copy"><button class="topic-pill" data-subject>'+esc(subjectName(item))+' 모아 보기</button><h2>'+esc(item.title)+'</h2><p class="record-caption">'+esc(item.caption)+'</p><button class="gallery-author" data-author>'+esc(item.author)+(item.creator==='rami'?'의 사진·글 보기':' · 이 이름의 사진·글 보기')+'</button>'+(item.location_label?'<p class="muted">'+esc(item.location_label)+'</p>':'')+(item.public_lat!=null&&item.public_lng!=null?'<button class="text-link" data-map>지도에서 보기</button>':'')+'</div></div><div class="gallery-detail-nav"><button class="secondary" data-prev '+(position===1?'disabled':'')+'>← 이전</button><button class="secondary" data-next '+(position===result.total?'disabled':'')+'>다음 →</button></div>';
  document.body.append(d);
  const restore=()=>{if(dialog!==d)return;dialog=null;d.remove();state.item='';save(true);root.querySelector('[data-gallery-item="'+CSS.escape(item.item_key)+'"]')?.focus({preventScroll:true});};
  d.addEventListener('close',restore);d.querySelector('[data-close]').onclick=()=>d.close();
  d.querySelector('[data-all]').onclick=()=>change({subject:'all',creator:'all',author:'',q:'',view:'photos',page:1});
  d.querySelector('[data-subject]').onclick=()=>change({subject:item.subject,page:1,view:'photos'});
  d.querySelector('[data-author]').onclick=()=>change({creator:item.creator,author:item.creator==='rami'?'':item.author,page:1});
  d.querySelector('[data-map]')?.addEventListener('click',async()=>{await change({view:'map',page:1,focus:item.item_key});});
  const move=async delta=>{
   const next=index+delta;
   if(next>=0&&next<items.length){await openDetail(next);return;}
   if((delta<0&&result.page<=1)||(delta>0&&result.page>=result.pages))return;
   close();state.page+=delta;state.item='';save();await load();if(items.length)await openDetail(delta>0?0:items.length-1);
  };
  d.querySelector('[data-prev]').onclick=()=>move(-1);d.querySelector('[data-next]').onclick=()=>move(1);
  d.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();move(e.key==='ArrowLeft'?-1:1);}};
  d.showModal();d.querySelector('[data-close]').focus();
 }
 async function load(){
  const current=++revision;root.setAttribute('aria-busy','true');
  try{
   const data=await api('gallery&'+new URLSearchParams(state));if(disposed||current!==revision)return;
   result=data;items=data.items;state.page=data.page;map?.remove();map=null;
   root.innerHTML='<div class="gallery-heading"><h2 tabindex="-1">함께 모은 동그라미</h2><a class="button" href="'+base+'/upload/">내 동그라미 올리기</a></div><div class="gallery-toolbar"><div class="filter-tabs" role="group" aria-label="사진과 글 종류">'+Object.entries(subjects).map(([value,label])=>'<button type="button" class="secondary" data-gallery-subject="'+value+'" aria-pressed="'+(state.subject===value)+'">'+label+'</button>').join('')+'</div><form class="gallery-search"><label for="gallery-creator">올린 사람</label><select id="gallery-creator"><option value="all">모두</option><option value="rami">라미</option><option value="participants">참여자</option></select><label class="sr-only" for="gallery-query">이름·장소·글 검색</label><input id="gallery-query" maxlength="80" type="search" value="'+esc(state.q)+'" placeholder="이름, 장소, 글 검색"><button class="secondary" type="submit">검색</button></form><div class="gallery-view" role="group" aria-label="보기 방식"><button class="text-link" data-gallery-view="photos" aria-pressed="'+(state.view==='photos')+'">사진·글로 보기</button><button class="text-link" data-gallery-view="map" aria-pressed="'+(state.view==='map')+'">지도로 보기</button></div></div><p class="muted" role="status">'+data.total+'개의 기록'+(state.author?' · 이름: '+esc(state.author):'')+(state.view==='map'?' · 위치가 확인된 사진만 표시해요. 전체 '+data.all_total+'개 중 '+data.mapped_total+'개':'')+'</p>'+(state.view==='map'?'<div id="gallery-map" class="map" aria-label="현재 페이지의 사진 위치"></div><p class="muted">현재 페이지의 '+items.length+'곳 · 대략적인 촬영 위치입니다.</p>':'')+'<div class="grid gallery-grid">'+(items.length?cards():'<div class="empty"><p>아직 이 조건에 맞는 기록이 없어요.</p><button class="secondary" data-gallery-reset>전체 보기</button></div>')+'</div><div class="row gallery-pagination"><button class="secondary" data-gallery-page="previous" '+(data.page===1?'disabled':'')+'>← 이전</button><span>'+data.page+' / '+data.pages+'</span><button class="secondary" data-gallery-page="next" '+(data.page>=data.pages?'disabled':'')+'>다음 →</button></div>';
   root.querySelector('#gallery-creator').value=state.creator;
   root.querySelectorAll('[data-gallery-subject]').forEach(b=>b.onclick=()=>change({subject:b.dataset.gallerySubject,page:1}));
   root.querySelectorAll('[data-gallery-view]').forEach(b=>b.onclick=()=>change({view:b.dataset.galleryView,page:1}));
   root.querySelector('[data-gallery-reset]')?.addEventListener('click',()=>change({subject:'all',creator:'all',author:'',q:'',view:'photos',page:1}));
   root.querySelector('#gallery-creator').onchange=e=>change({creator:e.target.value,author:'',page:1});
   root.querySelector('form').onsubmit=e=>{e.preventDefault();change({q:root.querySelector('#gallery-query').value.trim(),page:1});};
   root.querySelectorAll('[data-gallery-item]').forEach(b=>b.onclick=()=>openDetail(items.findIndex(i=>i.item_key===b.dataset.galleryItem)));
   root.querySelectorAll('[data-gallery-author]').forEach(b=>b.onclick=()=>change({creator:b.dataset.galleryAuthor,author:b.dataset.galleryAuthor==='rami'?'':b.dataset.authorName,page:1}));
   root.querySelectorAll('[data-gallery-page]').forEach(b=>b.onclick=async()=>{await change({page:state.page+(b.dataset.galleryPage==='next'?1:-1)});root.scrollIntoView({block:'start'});});
   if(state.view==='map'){
    map=createMap('gallery-map');
    if(map&&items.length){const points=[];items.forEach((item,i)=>{const point=[Number(item.public_lat),Number(item.public_lng)];points.push(point);const marker=L.marker(point,{title:item.title,alt:item.author+' · '+item.title}).addTo(map);marker.on('click',()=>openDetail(i));});map.fitBounds(points,{padding:[28,28],maxZoom:15});const focused=items.find(item=>item.item_key===state.focus);if(focused)map.setView([Number(focused.public_lat),Number(focused.public_lng)],16);}
   }
   if(state.item){const i=items.findIndex(item=>item.item_key===state.item);if(i>=0)openDetail(i,false);}
  }catch(err){if(current!==revision||disposed)return;items=[];root.innerHTML='<p role="alert">'+esc(err.message)+'</p><button class="secondary" data-gallery-retry>다시 불러오기</button>';root.querySelector('button').onclick=load;}
  finally{if(current===revision)root.removeAttribute('aria-busy');}
 }
 const onPop=()=>{close();state=read();load();};window.addEventListener('popstate',onPop);
 const scrollToGallery=()=>root.scrollIntoView({block:'start',behavior:'instant'});
 const onGalleryLink=async event=>{const link=event.target.closest('a');if(!link||!['#gallery',base+'/#gallery'].includes(link.getAttribute('href')))return;event.preventDefault();await change({subject:'all',creator:'all',author:'',q:'',view:'photos',page:1});scrollToGallery();};
 document.addEventListener('click',onGalleryLink);
 const ready=load().then(async()=>{if(location.hash==='#gallery'||location.hash==='#curated-title'){await document.fonts.ready;requestAnimationFrame(()=>{if(!disposed)scrollToGallery();});}});
 return {ready,destroy(){disposed=true;revision++;close();map?.remove();window.removeEventListener('popstate',onPop);document.removeEventListener('click',onGalleryLink);}};
}};
