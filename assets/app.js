'use strict';
const {base,kakaoKey,googleClientId,editorial=[],collection=[]}=window.CIRCLE_CONFIG;
const app=document.querySelector('#app');
const $=id=>document.getElementById(id);
let uploadKey=crypto.randomUUID().replaceAll('-',''),csrf='',googleNonce='',currentUser=null,isAdmin=false,posts=[],page=1;
let map,markers,coords=null,source='pin',selectedPhoto=null,previewUrl=null,noticeTimer;
const route=location.pathname.slice(base.length).replace(/^\/+|\/+$/g,'')||'home';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const img=(p,thumb=true)=>base+'/api.php?action=image&id='+encodeURIComponent(p.id)+(thumb?'&thumb=1':'');
const isPhoto=p=>p.post_type==='photo';
const {patterns,missions,getMission,nextMission,uploadUrl}=window.CIRCLE_DISCOVERY;
const patternLabel=value=>patterns[value]||value||'';
const routeQuery=new URLSearchParams(location.search);
let missionIndex=0;
let filters={type:routeQuery.get('type')||'all',pattern:routeQuery.get('pattern')||'',q:routeQuery.get('q')||''};
if(route==='archive')page=Math.max(1,Math.min(10000,parseInt(routeQuery.get('page'),10)||1));
let archiveRevision=0,destroyBento=()=>{},destroyArchiveGrid=()=>{};
document.body.dataset.route=route;
document.querySelectorAll('nav [data-route]').forEach(link=>{if(link.dataset.route===route)link.setAttribute('aria-current','page');});
function patternArt(kind='rings'){return '<span class="pattern-art '+kind+'" aria-hidden="true"><i></i><i></i><i></i><b>◎</b></span>';}
function notice(message){$('notice').textContent=message;$('notice').style.display='block';clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').style.display='none',7000);}
function error(e){notice(e.message||'오류가 발생했습니다.');}
async function api(action,options={}){
 const response=await fetch(base+'/api.php?action='+action,{...options,headers:{'X-CSRF-Token':csrf,...options.headers},signal:options.signal||AbortSignal.timeout(25000)});
 let data;try{data=await response.json();}catch{throw Error('서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');}
 if(!response.ok){const err=Error(data.error||'요청에 실패했습니다.');err.status=response.status;throw err;}return data;
}
function post(action,data){return api(action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});}
async function googleButton(targetId,afterLogin){
 const target=$(targetId);if(!target)return;
 if(!googleClientId){target.textContent='구글 로그인 설정을 확인해 주세요.';return;}
 try{
  if(!window.google?.accounts?.id)await new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.onload=resolve;script.onerror=()=>reject(Error('구글 로그인 화면을 불러오지 못했습니다.'));document.head.append(script);
  });
  if(!target.isConnected)return;
  google.accounts.id.initialize({client_id:googleClientId,nonce:googleNonce,auto_select:false,callback:async response=>{
   try{const result=await post('google-login',{credential:response.credential});currentUser=result.user;isAdmin=result.admin;googleNonce=(await api('session')).google_nonce;await afterLogin();}
   catch(err){error(err);}
  }});
  google.accounts.id.renderButton(target,{type:'standard',theme:'outline',size:'large',text:'signin_with',shape:'pill',width:260});
  target.querySelector('div[role=button]')?.setAttribute('aria-label','Google 계정으로 로그인');
 }catch(err){target.textContent=err.message;}
}
function logoutButton(id){const button=$(id);if(button)button.onclick=async()=>{try{await post('logout',{});location.reload();}catch(err){error(err);}};}
async function accountPage(){
 if(!currentUser){
  app.innerHTML='<section class="account-page"><p class="eyebrow">YOUR OWN FIELD NOTES</p><h1>내가 발견한<br><em class="handwritten">원의 기록.</em></h1><p>Google 계정으로 로그인하면 지금부터 남기는 사진과 글이 내 아카이브에 모입니다.</p><div id="google-button" class="google-button" role="group" aria-label="구글 로그인"></div><p class="muted">로그인 없이도 참여할 수 있어요. 이전 익명 기록은 작성자를 확인할 수 없어 자동으로 연결되지 않습니다.</p><div class="row"><a class="button secondary" href="'+base+'/upload/">로그인 없이 참여하기 ↗</a><a class="button secondary" href="'+base+'/archive/#curated-title">공개된 작가의 수집 보기 ↗</a></div></section>';
  await googleButton('google-button',accountPage);return;
 }
 const data=await api('mine&page='+page);posts=data.posts;
 const labels={pending:'승인 대기',approved:'공개',hidden:'숨김',rejected:'거절'};
 app.innerHTML='<section class="account-page"><p class="eyebrow">YOUR OWN FIELD NOTES</p><div class="controls"><div><h1>내 아카이브<span class="heading-dot">.</span></h1><p>'+esc(currentUser.display_name)+'님의 기록 · '+data.total+'개</p></div><button type="button" id="account-logout" class="secondary">로그아웃</button></div><p class="muted">로그인한 상태에서 올린 기록만 보여요. 승인 전 기록은 본인과 관리자에게만 보입니다. 공개된 글을 수정하면 다시 승인 대기로 바뀝니다.</p><div class="row"><a class="button" href="'+base+'/upload/">새 기록 남기기 ↗</a><a class="button secondary" href="'+base+'/archive/#curated-title">공개된 작가의 수집 보기 ↗</a></div><div class="grid account-grid">'+(posts.length?posts.map(p=>'<div class="account-record"><p class="account-status">'+esc(labels[p.status]||p.status)+'</p>'+cards([p])+'<button class="secondary" type="button" data-edit="'+esc(p.id)+'">'+(isPhoto(p)?'이름·설명 수정':'이름·글 수정')+'</button></div>').join(''):'<p class="empty">아직 내 기록이 없습니다. 첫 발견을 남겨 주세요.</p>')+'</div>'+pagination(data.total,page)+'</section>';
 wireDetails();app.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>recordEdit(posts.find(p=>p.id===b.dataset.edit),accountPage));logoutButton('account-logout');$('previous').onclick=()=>{page--;accountPage().catch(error);};$('next').onclick=()=>{page++;accountPage().catch(error);};
}
function recordEdit(p,refresh){
 if(!p)return;const dialog=document.createElement('dialog');dialog.setAttribute('aria-label','기록 수정');
 dialog.innerHTML='<form class="edit-form"><h2>'+(isPhoto(p)?'사진 설명 수정':'글 수정')+'</h2><p class="muted">내용이 바뀌면 승인 대기로 돌아가며 공개 화면과 지도에서 잠시 숨겨집니다.</p><label for="edit-nickname">발견자 이름</label><input id="edit-nickname" name="nickname" maxlength="60" value="'+esc(p.nickname)+'"><label for="edit-caption">'+(isPhoto(p)?'사진 설명':'글 내용')+'</label><textarea id="edit-caption" name="caption" maxlength="500" '+(isPhoto(p)?'':'required')+'>'+esc(p.caption)+'</textarea><label><input name="consent" type="checkbox" required>수정한 이름과 글이 승인 후 공개되는 데 동의합니다.</label><p class="edit-error" role="alert"></p><div class="row"><button type="button" class="secondary" data-close>취소</button><button type="submit">수정 저장</button></div></form>';
 document.body.append(dialog);dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
 const form=dialog.querySelector('form');form.onsubmit=async e=>{e.preventDefault();const save=form.querySelector('[type=submit]');save.disabled=true;try{const result=await post('edit',{id:p.id,nickname:form.elements.namedItem('nickname').value,caption:form.elements.namedItem('caption').value,consent:form.elements.namedItem('consent').checked?'yes':'no'});dialog.close();await refresh();notice(result.changed?'수정했습니다. 다시 승인받으면 공개됩니다.':'변경된 내용이 없습니다.');}catch(err){form.querySelector('.edit-error').textContent=err.message;save.disabled=false;}};
}
function collectionEdit(item,refresh){
 const dialog=document.createElement('dialog');dialog.setAttribute('aria-label','작가의 수집 수정');
 const savedLat=item.draft_lat??item.public_lat??'',savedLng=item.draft_lng??item.public_lng??'';
 dialog.innerHTML='<form class="edit-form"><h2>작가의 수집 수정</h2><img src="'+esc(item.src)+'" alt="'+esc(item.title)+' 사진">'+
 '<label for="collection-title">제목</label><input id="collection-title" name="title" maxlength="120" required value="'+esc(item.title)+'">'+
 '<label for="collection-description">설명</label><textarea id="collection-description" name="description" maxlength="500">'+esc(item.description||'')+'</textarea>'+
 '<fieldset class="collection-location"><legend>촬영 위치</legend><p class="muted">원본 사진의 GPS는 장소 확인을 위한 제안입니다. 원본 사진은 서버로 전송하지 않습니다.</p>'+
 '<label for="collection-original">해당 사진의 원본 선택</label><input id="collection-original" name="original" type="file" accept="image/*">'+
 '<div class="row location-actions"><button id="collection-read-gps" class="secondary" type="button" disabled>사진 GPS 읽고 지도 보기</button><button id="collection-preview-coords" class="secondary" type="button">입력한 좌표 지도에서 보기</button></div>'+
 '<p id="collection-gps-status" class="muted" role="status">'+(savedLat!==''&&savedLng!==''?'저장된 위치 후보가 있습니다. 아래 좌표로 지도에서 확인할 수 있습니다.':'원본을 선택한 뒤 GPS 읽기 버튼을 누르거나 좌표를 직접 입력해 주세요.')+'</p>'+
 '<div id="collection-location-preview" class="collection-location-preview" role="img" aria-label="촬영 위치 후보 지도" hidden></div><p class="muted">원본 사진은 업로드하지 않습니다. 좌표는 저장할 때만 서버로 전송하며, 공개 지도에는 대략적인 위치만 표시합니다. 지도 배경을 열면 대략적인 지도 영역을 OpenStreetMap에 요청합니다.</p>'+
 '<label for="collection-location">장소 이름 · 예: 서울 종로구 인사동</label><input id="collection-location" name="location_label" maxlength="150" value="'+esc(item.draft_location_label||'')+'">'+
 '<div class="row coordinate-row"><label for="collection-lat">위도<input id="collection-lat" name="lat" type="number" step="any" min="-90" max="90" value="'+esc(savedLat)+'"></label><label for="collection-lng">경도<input id="collection-lng" name="lng" type="number" step="any" min="-180" max="180" value="'+esc(savedLng)+'"></label></div>'+
 '<label><input name="location_confirmed" type="checkbox" '+(item.location_confirmed?'checked':'')+'>이 사진의 촬영 장소를 확인했습니다. 장소 이름과 대략적인 위치를 공개합니다.</label></fieldset>'+
 '<p class="muted">제목·설명은 저장 즉시 공개됩니다. 확인 전 위치는 공개하거나 지도에 표시하지 않습니다.</p><p class="edit-error" role="alert"></p><div class="row"><button type="button" class="secondary" data-close>취소</button><button type="submit">수정 저장</button></div></form>';
 document.body.append(dialog);dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.showModal();
 const form=dialog.querySelector('form'),status=dialog.querySelector('#collection-gps-status'),preview=dialog.querySelector('#collection-location-preview');
 let locationMap=null,locationPin=null;
 const clearPreview=()=>{locationMap?.remove();locationMap=null;locationPin=null;preview.hidden=true;};
 const showPreview=(lat,lng)=>{
  if(!window.L){status.textContent='지도 화면을 불러오지 못했습니다. 좌표는 아래에서 확인할 수 있습니다.';return;}
  preview.hidden=false;
  if(!locationMap){
   locationMap=L.map(preview,{scrollWheelZoom:false}).setView([lat,lng],15);
   L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(locationMap).on('tileerror',()=>{status.textContent='지도 배경 연결이 원활하지 않습니다. 아래 좌표는 확인할 수 있습니다.';});
   locationPin=L.marker([lat,lng],{title:'사진 위치 후보'}).addTo(locationMap);
  }else{locationMap.setView([lat,lng],15);locationPin.setLatLng([lat,lng]);}
  requestAnimationFrame(()=>locationMap?.invalidateSize());preview.scrollIntoView({block:'nearest'});
 };
 dialog.addEventListener('close',()=>{clearPreview();dialog.remove();});
 form.elements.namedItem('original').onchange=()=>{
  const file=form.elements.namedItem('original').files[0];dialog.querySelector('#collection-read-gps').disabled=!file;
  clearPreview();form.elements.namedItem('location_confirmed').checked=false;
  if(file){form.elements.namedItem('lat').value='';form.elements.namedItem('lng').value='';}
  status.textContent=file?'선택한 파일: '+file.name+' · GPS 읽기 버튼을 눌러 위치를 확인해 주세요.':'원본을 선택한 뒤 GPS 읽기 버튼을 눌러 주세요.';
 };
 dialog.querySelector('#collection-read-gps').onclick=async()=>{
  const file=form.elements.namedItem('original').files[0];if(!file){status.textContent='이 사진의 원본 파일을 먼저 선택해 주세요.';return;}
  const button=dialog.querySelector('#collection-read-gps');button.disabled=true;status.textContent='선택한 사진의 GPS를 읽고 있습니다…';
  try{
   if(!window.exifr?.gps)throw Error('사진 위치 읽기 기능을 불러오지 못했습니다.');
   const gps=await exifr.gps(file);if(form.elements.namedItem('original').files[0]!==file)return;
   if(!gps||!Number.isFinite(gps.latitude)||!Number.isFinite(gps.longitude)||Math.abs(gps.latitude)>90||Math.abs(gps.longitude)>180)throw Error('이 사진에 유효한 GPS 위치가 없습니다. 장소를 직접 입력해 주세요.');
   form.elements.namedItem('lat').value=gps.latitude.toFixed(6);form.elements.namedItem('lng').value=gps.longitude.toFixed(6);
   form.elements.namedItem('location_confirmed').checked=false;status.textContent='사진에서 위치 후보를 찾았습니다. 장소 이름을 확인하고 공개 여부를 선택해 주세요. 아직 저장되지 않았습니다.';
   showPreview(gps.latitude,gps.longitude);
  }catch(err){status.textContent=err.message;clearPreview();}finally{button.disabled=!form.elements.namedItem('original').files[0];}
 };
 dialog.querySelector('#collection-preview-coords').onclick=()=>{
  const latText=form.elements.namedItem('lat').value.trim(),lngText=form.elements.namedItem('lng').value.trim(),lat=Number(latText),lng=Number(lngText);
  if(!latText||!lngText||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180){status.textContent='유효한 위도와 경도를 함께 입력해 주세요.';return;}
  status.textContent='입력한 좌표의 위치 후보입니다. 장소 이름을 확인하고 공개 여부를 선택해 주세요. 아직 저장되지 않았습니다.';
  try{showPreview(lat,lng);}catch{status.textContent='지도 화면을 표시하지 못했습니다. 입력한 좌표는 아래에서 확인할 수 있습니다.';clearPreview();}
 };
 for(const name of ['lat','lng'])form.elements.namedItem(name).oninput=()=>{clearPreview();form.elements.namedItem('location_confirmed').checked=false;};
 form.elements.namedItem('location_label').oninput=()=>{form.elements.namedItem('location_confirmed').checked=false;};
 form.onsubmit=async e=>{
  e.preventDefault();const save=form.querySelector('[type=submit]');save.disabled=true;
  try{
   const field=name=>form.elements.namedItem(name),lat=field('lat').value.trim(),lng=field('lng').value.trim(),confirmed=field('location_confirmed').checked;
   if(Boolean(lat)!==Boolean(lng))throw Error('위도와 경도를 함께 입력해 주세요.');
   if(confirmed&&(!field('location_label').value.trim()||!lat||!lng))throw Error('공개할 장소 이름과 좌표를 확인해 주세요.');
   const payload={slug:item.slug,title:field('title').value,description:field('description').value,location_label:field('location_label').value,location_confirmed:confirmed?'yes':'no'};
   if(lat&&lng){payload.draft_lat=lat;payload.draft_lng=lng;}
   if(confirmed){payload.lat=lat;payload.lng=lng;}
   const result=await post('collection-update',payload);Object.assign(item,result);dialog.close();await refresh();notice(confirmed?'작가의 수집과 확인된 위치를 공개했습니다.':'작가의 수집을 저장했습니다. 확인 전 위치는 비공개입니다.');
  }catch(err){form.querySelector('.edit-error').textContent=err.message;save.disabled=false;}
 };
}
function cards(items,adminMode=false){
 return items.map(p=>'<article class="card '+(isPhoto(p)?'photo-card':'text-card')+'"><button class="card-open secondary" data-detail="'+p.id+'" aria-label="'+esc(isPhoto(p)?p.location_label+' 사진 보기':p.nickname+'님의 글 보기')+'">'+
  (isPhoto(p)?'<span class="photo-mat"><img src="'+img(p)+'" alt="'+esc(p.caption||'도시의 멘홀')+'" loading="lazy"><span class="photo-tag">'+esc(patternLabel(p.pattern_type))+'</span></span>':'<span class="text-art"><span class="eyebrow">FIELD NOTE · 도시의 이야기</span><span class="card-caption">'+esc(p.caption)+'</span><span class="note-mark" aria-hidden="true">↗</span></span>')+'</button><p>'+
  (isPhoto(p)?'<strong>'+esc(p.location_label)+'</strong><br>':'')+'<span class="muted">'+esc(p.nickname)+(isPhoto(p)?' · '+esc(patternLabel(p.pattern_type)):' · 글')+'</span></p>'+
  (adminMode?'<p class="muted">공개 동의 · '+esc(p.consent_version)+'</p>':'')+'</article>').join('')||
  '<p class="empty">'+(adminMode?'이 상태의 기록이 없습니다.':'아직 공개된 기록이 없습니다. 첫 발견을 함께 나눠 주세요.')+'</p>';
}
function wireDetails(){app.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>detail(posts.find(p=>p.id===b.dataset.detail)));}
function detail(p){
 if(!p)return;const dialog=document.createElement('dialog');
 dialog.innerHTML='<button class="secondary" data-close>닫기</button>'+
  (isPhoto(p)?'<img src="'+img(p,false)+'" alt="'+esc(p.caption||'멘홀 사진')+'">':'')+
  '<h2>'+esc(isPhoto(p)?p.location_label:'도시에 남긴 이야기')+'</h2><p class="record-caption">'+esc(p.caption)+'</p><p class="muted">'+esc(p.nickname)+(isPhoto(p)?' · '+esc(patternLabel(p.pattern_type)):'')+'</p>'+
  (isPhoto(p)&&(!p.status||p.status==='approved')?'<a class="button" href="'+base+'/map/?lat='+encodeURIComponent(p.public_lat)+'&lng='+encodeURIComponent(p.public_lng)+'">지도에서 보기</a>':'');
 document.body.append(dialog);dialog.setAttribute('aria-label',isPhoto(p)?p.location_label:'도시에 남긴 이야기');dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
}
function collectionMarkup(){
 if(!collection.length)return '';
 return '<section class="curated-section" aria-labelledby="curated-title"><div class="controls"><div><p class="eyebrow">THE ARTIST’S COLLECTION</p><h2 id="curated-title">작가의 수집 <small>'+collection.length+'장</small></h2></div><p class="curated-intro">누구나 로그인 없이 볼 수 있습니다. 촬영 장소를 확인한 사진만 지도에도 표시합니다.</p></div><div class="grid curated-grid">'+collection.map((item,i)=>'<article class="card curated-card"><button class="card-open secondary" type="button" data-curated="'+i+'" aria-label="'+esc(item.title)+' 사진 크게 보기"><span class="photo-mat"><img src="'+esc(item.src)+'" alt="'+esc(item.title)+' 멘홀 사진" loading="lazy"><span class="photo-tag">작가의 수집</span></span></button><p><strong>'+esc(item.title)+'</strong><br>'+(item.description?'<span class="curated-description">'+esc(item.description)+'</span><br>':'')+'<span class="muted">'+esc(item.location_label||'장소 미확인')+' · '+(isMappedCollection(item)?'지도에서 보기 가능':'지도 표시 없음')+'</span></p></article>').join('')+'</div></section>';
}
function isMappedCollection(item){return !!item.location_label&&item.public_lat!=null&&item.public_lng!=null&&Number.isFinite(Number(item.public_lat))&&Number.isFinite(Number(item.public_lng));}
function collectionDetail(item){
 if(!item)return;
 const dialog=document.createElement('dialog');dialog.innerHTML='<button class="secondary" data-close>닫기</button><img src="'+esc(item.src)+'" alt="'+esc(item.title)+' 멘홀 사진"><h2>'+esc(item.title)+'</h2>'+(item.description?'<p class="record-caption">'+esc(item.description)+'</p>':'')+'<p class="muted">작가의 수집 · '+esc(item.location_label||'촬영 장소 미확인')+'</p>'+(isMappedCollection(item)?'<a class="button" href="'+(route==='map'?base+'/archive/#curated-title':base+'/map/?lat='+encodeURIComponent(item.public_lat)+'&lng='+encodeURIComponent(item.public_lng))+'">'+(route==='map'?'아카이브에서 보기':'지도에서 보기')+'</a>':'<p class="muted">지도 표시 없음</p>');
 document.body.append(dialog);dialog.setAttribute('aria-label',item.title+' 사진');dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
}
function wireCollection(){app.querySelectorAll('[data-curated]').forEach(button=>button.onclick=()=>collectionDetail(collection[Number(button.dataset.curated)]));}
function pagination(total,current){return '<div class="row pagination"><button id="previous" class="secondary" '+(current===1?'disabled':'')+'>← 이전</button><span>'+current+' / '+Math.max(1,Math.ceil(total/60))+' 페이지</span><button id="next" class="secondary" '+(current*60>=total?'disabled':'')+'>다음 →</button></div>';}
function missionMarkup(){
 const m=missions[missionIndex];
 return '<div class="mission-copy" aria-live="polite"><p class="eyebrow">OBSERVATION '+String(missionIndex+1).padStart(2,'0')+' / 04</p><h3>'+m.title+'</h3><p>'+m.prompt+'</p></div><div class="mission-art">'+patternArt(m.art)+'</div><div class="mission-actions"><a class="button" href="'+uploadUrl(base,m.id)+'">이 미션으로 참여하기 ↗</a><button class="secondary" id="next-mission">다른 관찰 제안 ↻</button></div>';
}
function wireMission(){const button=$('next-mission');if(button)button.onclick=()=>{missionIndex=nextMission(missionIndex);$('mission-card').innerHTML=missionMarkup();wireMission();$('next-mission').focus({preventScroll:true});};}
function filmMarkup(){
 const film=base+'/assets/video/why-round-manhole.mp4',poster=base+'/assets/video/why-round-manhole-poster.jpg';
 return '<section class="field-film" aria-labelledby="field-film-title"><div class="field-film-copy"><p class="eyebrow">30 SECOND FIELD NOTE</p><h2 id="field-film-title">발밑의 원에는<br>이유가 있다.</h2><p>맨홀 뚜껑은 왜 둥글까요? 잠깐 보고 나면 익숙한 길 위의 원이 조금 다르게 보입니다.</p><a class="text-link" href="'+base+'/upload/">나의 발견 남기기 ↗</a></div><figure class="field-film-media"><video controls playsinline preload="none" poster="'+poster+'" width="720" height="1280" aria-label="맨홀 뚜껑이 둥근 이유를 보여 주는 30초 영상"><source src="'+film+'" type="video/mp4"><p>영상을 재생할 수 없습니다. <a href="'+film+'">영상 파일 열기</a></p></video><figcaption>원의 도시 · 30초 시각 노트</figcaption></figure><details class="field-film-summary"><summary>영상 내용 텍스트로 보기</summary><p>영상은 네모와 세모 뚜껑의 방향에 따른 모양을 원형과 비교합니다. 마지막에는 원형 뚜껑은 어느 방향으로 돌려도 폭이 같고, 아래 구멍보다 조금 커서 빠지지 않는다는 설명으로 마무리합니다.</p></details></section>';
}
function homeMarkup(data){
 const photos=posts.filter(isPhoto).slice(0,3);
 const tiles=editorial.length===5?[0,1,2,3,4]:[0,1,2];
 const descriptions=['황금빛 기하학 무늬의 멘홀','글자와 원형 구멍이 새겨진 멘홀','꽃과 동심원 무늬의 덮개','노란 원으로 둘러싸인 멘홀','주황빛 작은 원형 덮개'];
 const objects=tiles.map((i)=>'<div class="orbit-object object-'+i+(i?' bento-side':'')+'">'+(editorial[i]?'<div class="hero-photo editorial-photo"><img src="'+esc(editorial[i])+'" alt="'+(editorial.length===5?descriptions[i]:'작가의 멘홀 수집 사진 '+(i+1))+'" decoding="async"'+(i===0?' fetchpriority="high"':'')+'></div>':photos[i]?'<button class="hero-photo" data-detail="'+photos[i].id+'" aria-label="'+esc(photos[i].location_label)+' 사진 보기"><img src="'+img(photos[i])+'" alt="'+esc(photos[i].location_label)+' 멘홀"></button>':patternArt(['rings','petals','orbit'][i]))+'</div>').join('');
 const extraTiles=editorial.length===5?'':'<div class="bento-word bento-side" aria-hidden="true">Every<br>circle,<br>a story.</div><div class="bento-pattern bento-side">'+patternArt('orbit')+'</div>';
 return `<section class="hero bento-hero" data-bento><div class="hero-copy"><p class="eyebrow">원의 도시 · A COLLECTIVE FIELD JOURNAL</p><h1>우리가 지나친,<br>작은 <em>우주.</em></h1><p class="hero-english">A whole world, under your feet.</p><p class="hero-description">고개를 들면 하늘이 있고,<br>고개를 숙이면 도시가 있습니다.<br>당신이 발견한 원으로 이 전시를 이어주세요.</p><div class="hero-actions"><a class="button" href="${base}/upload/">나의 발견 남기기 <span aria-hidden="true">↗</span></a><a class="text-link" href="${base}/archive/">먼저 둘러볼게요 →</a></div><p class="hero-note">사진 한 장, 또는 짧은 이야기. 회원가입 없이.</p></div><div class="bento-scroll"><figure class="hero-universe bento-stage"><span class="universe-label bento-side">COLLECTED MOMENTS / 01</span>${objects}${extraTiles}<span class="bento-scroll-hint">스크롤해 조금 더 가까이 ↓</span><div class="bento-controls"><a class="bento-skip" href="#discoveries">건너뛰기 ↓</a><button class="secondary" type="button" data-bento-toggle hidden>움직임 끄기</button></div><figcaption class="art-label">${editorial.length?'작가의 수집 · 관람객 기록과 별도 전시 이미지':photos.length?'승인된 발견과 무늬 스케치':'무늬 스케치 · 첫 사진을 기다리고 있어요'}</figcaption></figure></div></section>
 <section id="discoveries" class="collection-strip" aria-label="참여 안내" tabindex="-1"><div class="collection-count"><span class="eyebrow">OUR GROWING COLLECTION</span><p><strong>${data.total}</strong>개의 발견이 모였어요</p></div><div class="collection-orbit" aria-hidden="true"><span></span><span></span><i>◎</i></div><p class="collection-line">하나의 원이 모여,<br><em class="handwritten">우리의 도시</em>가 됩니다.</p><a href="${base}/map/" class="text-link">지도 위에서 만나기 ↗</a></section>
 ${filmMarkup()}
 <section class="mission-section"><div class="section-intro"><p class="eyebrow">A LITTLE CURIOSITY</p><h2>오늘은 무엇을<br> 발견할까요?</h2><p class="muted">익숙한 길도 작은 질문 하나면<br> 새로운 전시장이 됩니다.</p><span class="safety-note">걷다가 잠깐 멈춰서, 안전한 곳에서 관찰해 주세요.</span></div><div id="mission-card" class="mission-card">${missionMarkup()}</div></section>
 <section class="recent-section"><div class="controls"><div><p class="eyebrow">THE COLLECTIVE FIELD NOTES</p><h2>함께 발견한 도시</h2></div><a class="text-link" href="${base}/archive/">모든 기록 보기 ↗</a></div><div class="grid">${cards(posts.slice(0,4))}</div><button class="secondary surprise-button" id="surprise" ${posts.length?'':'disabled'}>↝ 우연히 만난 기록 하나</button><p class="muted surprise-help">최근 불러온 공개 기록에서 하나를 펼쳐봅니다.</p></section>
 <section class="join-section"><span class="join-circle" aria-hidden="true">◎</span><p class="eyebrow">YOUR TURN TO LOOK DOWN</p><h2>다음 원은,<br><em class="handwritten">당신의 발견</em>입니다.</h2><a class="button" href="${base}/upload/">전시에 나의 기록 더하기 ↗</a><p>기록은 관리자 확인 후 온라인 아카이브와 전시장에 공개됩니다.</p></section><footer class="project-footer"><span>원의 도시 · CITY OF CIRCLES</span><span>〈하늘과 땅 사이〉에서 이어지는 도시 관찰</span></footer>`;
}
function archiveMarkup(data){
 const typeButtons=[['all','모든 기록'],['photo','사진'],['text','이야기']].map(([type,label])=>'<button type="button" class="secondary" data-type="'+type+'" aria-pressed="'+(filters.type===type)+'">'+label+'</button>').join('');
 const topicButtons=[['','모든 사진'],...Object.entries(patterns)].map(([pattern,label])=>'<button type="button" class="topic-pill" data-pattern="'+pattern+'" aria-pressed="'+(filters.type==='photo'&&filters.pattern===pattern)+'"><span class="topic-dot" aria-hidden="true"></span>'+label+'</button>').join('');
 const showCollection=collection.length>0;
 return '<div class="page-heading archive-heading"><p class="eyebrow">THE CITY, COLLECTED</p><h1>도시의 원 아카이브<span class="heading-dot">.</span></h1><p>서로 다른 길에서 발견한 사진과 이야기. 당신의 시선으로 둘러보세요.</p></div>'+(showCollection?collectionMarkup():'')+'<section class="community-section" aria-label="관람객 기록"><div class="community-heading"><p class="eyebrow">THE COLLECTIVE FIELD NOTES</p><h2>함께 쌓이는 기록</h2><p>관리자 확인을 마친 관람객 기록만 표시합니다. 사진은 위치가 확인된 경우에만 지도에 표시됩니다.</p></div><form id="archive-search" class="archive-tools"><div class="filter-tabs" aria-label="기록 유형">'+typeButtons+'</div><div class="search-row"><label class="sr-only" for="archive-q">장소·이름·이야기 검색</label><input id="archive-q" type="search" maxlength="80" value="'+esc(filters.q)+'" placeholder="장소, 이름, 이야기를 찾아보세요"><button type="submit" class="secondary">검색 ↗</button></div><div class="topic-explorer"><p>무늬를 따라 발견하기 <span>사진의 무늬를 골라 둘러보세요</span></p><div class="topic-list" role="group" aria-label="사진 무늬로 탐색">'+topicButtons+'</div></div></form><div class="controls result-info"><p role="status">'+data.total+'개의 관람객 기록'+(filters.q?' · “'+esc(filters.q)+'”':'')+'</p><button class="text-link" id="surprise" '+(posts.length?'':'disabled')+'>↝ 이 페이지에서 우연히 하나</button></div><section class="grid archive-grid" aria-label="공개 기록">'+(posts.length?cards(posts):'<div class="empty"><span aria-hidden="true">◎</span><h2>관람객 기록을 기다리고 있어요.</h2><p>첫 발견을 남겨 주세요. 관리자 확인 후 이곳에 공개됩니다.</p><a class="button" href="'+base+'/upload/">나의 발견 남기기 ↗</a></div>')+'</section>'+pagination(data.total,page)+'</section>';
}
function mountArchiveGrid(grid){
 if(!grid||!window.ResizeObserver)return ()=>{};
 const cards=[...grid.querySelectorAll('.card')];if(!cards.length)return ()=>{};
 let frame=0;
 const layout=()=>{
  frame=0;
  for(const card of cards){
   const span=Math.max(1,Math.ceil((card.getBoundingClientRect().height+8)/16));
   card.style.gridRowEnd='span '+span;
  }
  grid.classList.add('is-masonry');
 };
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(layout);};
 const observer=new ResizeObserver(schedule);
 cards.forEach(card=>observer.observe(card));
 grid.querySelectorAll('img').forEach(image=>image.addEventListener('load',schedule));
 window.addEventListener('resize',schedule);
 schedule();
 return ()=>{observer.disconnect();window.removeEventListener('resize',schedule);if(frame)cancelAnimationFrame(frame);};
}
async function archive(home=false){
 const revision=++archiveRevision;
 const query=new URLSearchParams(home?{page:1}:{...filters,page});
 const data=await api('list&'+query);if(revision!==archiveRevision)return;destroyBento();destroyArchiveGrid();posts=data.posts;app.innerHTML=home?homeMarkup(data):archiveMarkup(data);
 if(!home&&location.hash==='#curated-title')requestAnimationFrame(()=>document.getElementById('curated-title')?.scrollIntoView({block:'start'}));
 if(home)destroyBento=window.CIRCLE_BENTO?.mount(app.querySelector('[data-bento]'))||(()=>{});
 else destroyArchiveGrid=mountArchiveGrid(app.querySelector('.archive-grid'));
 wireDetails();wireCollection();wireMission();$('surprise').onclick=()=>{if(posts.length)detail(posts[Math.floor(Math.random()*posts.length)]);};
 if(!home){
  const apply=()=>{const query=new URLSearchParams({...filters,page});history.replaceState(null,'',base+'/archive/?'+query);archive().then(()=>app.focus({preventScroll:true})).catch(error);};
  $('archive-search').onsubmit=e=>{e.preventDefault();filters.q=$('archive-q').value.trim();page=1;apply();};
  app.querySelectorAll('[data-type]').forEach(b=>b.onclick=()=>{filters.type=b.dataset.type;if(filters.type==='text')filters.pattern='';page=1;apply();});
  app.querySelectorAll('[data-pattern]').forEach(b=>b.onclick=()=>{filters.type='photo';filters.pattern=b.dataset.pattern;page=1;apply();});
  $('previous').onclick=()=>{page--;apply();};$('next').onclick=()=>{page++;apply();};
 }
}
function createMap(id,click){
 if(!window.L){$(id).textContent='지도를 불러오지 못했습니다. 사진 참여에는 아래 좌표 입력을 사용해 주세요.';return null;}
 const instance=L.map(id).setView([37.5665,126.978],12);
 let warned=false;
 L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(instance).on('tileerror',()=>{if(!warned){warned=true;notice('지도 연결이 원활하지 않습니다. 좌표 입력이나 글 참여를 이용할 수 있습니다.');}});
 if(click)instance.on('click',e=>click(e.latlng.lat,e.latlng.lng));return instance;
}
function setCoords(lat,lng,via){
 coords=[Number(lat),Number(lng)];source=via;
 $('lat').value=coords[0].toFixed(6);$('lng').value=coords[1].toFixed(6);$('confirmed').checked=false;
 if(map){markers.clearLayers();L.marker(coords).addTo(markers);map.setView(coords,16);}
 $('location-state').textContent='발견한 장소가 맞는지 확인해 주세요.';
}
async function searchPlace(){
 const query=$('search').value.trim();if(!query||!kakaoKey)return;
 if(!window.kakao?.maps?.services)await new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://dapi.kakao.com/v2/maps/sdk.js?appkey='+encodeURIComponent(kakaoKey)+'&libraries=services&autoload=false';
  script.onload=()=>window.kakao?.maps?window.kakao.maps.load(resolve):reject(Error('장소 검색 설정을 확인해 주세요.'));
  script.onerror=()=>reject(Error('장소 검색을 불러오지 못했습니다.'));document.head.append(script);
 });
 new kakao.maps.services.Places().keywordSearch(query,(data,status)=>{
  const results=$('results');results.replaceChildren();if(status!==kakao.maps.services.Status.OK){results.textContent='검색 결과가 없습니다.';return;}
  data.slice(0,5).forEach(place=>{const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=place.place_name+' · '+place.address_name;b.onclick=()=>{setCoords(place.y,place.x,'search');$('location').value=place.address_name;results.replaceChildren();};results.append(b);});
 });
}
function upload(){
 const mission=getMission(routeQuery.get('mission'));
 app.innerHTML='<div class="form"><p class="eyebrow">YOUR FIELD NOTE</p><h1>당신의 발견을<br>나눠 주세요<span class="heading-dot">.</span></h1><p>멘홀 사진이나 전시를 보며 떠오른 이야기를 남길 수 있습니다.</p><p class="account-hint">'+(currentUser?'현재 로그인: '+esc(currentUser.display_name)+' · 새 기록은 <a href="'+base+'/account/">내 아카이브</a>에 저장됩니다.':'회원가입 없이 참여할 수 있어요. 내 기록을 모으려면 먼저 <a href="'+base+'/account/">Google 계정으로 로그인</a>해 주세요.')+'</p>'+
 (mission?'<aside class="chosen-mission"><span class="eyebrow">선택한 관찰 미션</span><h2>'+mission.title+'</h2><p>'+mission.prompt+'</p><span class="muted">다른 이야기로 바꿔도 좋아요.</span></aside>':'')+
 '<div class="entry-steps" aria-label="참여 순서"><span><b>01</b> 기록하기</span><span><b>02</b> 관리자 확인</span><span><b>03</b> 함께 보기</span></div>'+
 '<form id="upload-form"><fieldset id="entry-fields"><legend class="sr-only">참여 내용</legend>'+
 '<fieldset class="mode-picker"><legend>참여 방법</legend><label><input type="radio" name="post_type" value="photo" checked>사진 올리기</label><label><input type="radio" name="post_type" value="text">글 남기기</label></fieldset>'+
 '<fieldset id="photo-fields"><legend class="sr-only">사진과 발견 장소</legend><label for="photo">직접 찍은 멘홀 사진</label><input id="photo" type="file" accept="image/*" required><p class="muted">앨범 또는 카메라에서 선택하세요. 원본은 30MB까지 선택할 수 있으며 전송 전에 압축합니다. 공개 사진의 GPS 메타데이터는 제거됩니다.</p><img id="preview" class="preview" alt="선택한 사진 미리보기" hidden>'+
 '<h2>발견 장소 확인</h2><p id="location-state" class="muted">사진 위치를 확인하거나 지도에서 장소를 선택해 주세요.</p><button type="button" id="gps" class="secondary">현재 위치 사용</button>'+
 (kakaoKey?'<div class="row"><input id="search" placeholder="장소명·주소 검색" aria-label="장소 검색"><button type="button" id="search-button" class="secondary">검색</button></div><div id="results" class="row"></div>':'')+
 '<div id="upload-map" class="map"></div><details id="coordinate-details"><summary>좌표 직접 입력 / 지도 이용 불가 시</summary><label for="lat">위도</label><input id="lat" type="number" step="any" min="-90" max="90" required><label for="lng">경도</label><input id="lng" type="number" step="any" min="-180" max="180" required><button type="button" id="apply-coords" class="secondary">좌표 적용</button></details>'+
 '<label for="location">발견 장소 이름</label><input id="location" maxlength="150" placeholder="예: 서울 성동구 성수동" required><p class="muted">상세 집 주소 등 개인을 특정할 수 있는 장소는 적지 마세요. 지도에는 대략적인 위치를 표시합니다.</p><label><input id="confirmed" type="checkbox" required>사진을 찍은 장소가 맞습니다.</label>'+
 '<label for="pattern">어떤 무늬를 발견했나요?</label><select id="pattern">'+Object.entries(patterns).map(([value,label])=>'<option value="'+value+'">'+label+'</option>').join('')+'</select></fieldset>'+
 '<label for="nickname">발견자 이름 · 선택</label><input id="nickname" maxlength="60" placeholder="도시 관찰자"><label id="caption-label" for="caption">발견자의 한마디 · 선택</label><textarea id="caption" maxlength="500" placeholder="'+esc(mission?.hint||'이 원을 처음 발견한 순간은 어땠나요?')+'" aria-describedby="caption-count"></textarea><p id="caption-count" class="character-count">0 / 500</p>'+
 '<label><input id="consent" type="checkbox" required><span id="consent-label"></span></label><p class="muted">사람의 얼굴·차량 번호·개인정보가 포함되지 않도록 확인해 주세요. 삭제 요청: Instagram @cloud.visualizer</p>'+
 '<button id="submit" type="submit">기록 남기기</button></fieldset><p id="progress" role="status"></p></form></div>';
 let mode='photo',photoRevision=0,submitting=false;
 const consentPhoto='직접 촬영한 사진이며, 사진·이름·글·대략적인 장소가 온라인 아카이브와 전시장 화면에 공개되는 데 동의합니다.';
 const consentText='작성한 이름과 글이 온라인 아카이브와 전시장 화면에 공개되는 데 동의합니다.';
 $('consent-label').textContent=consentPhoto;
 map=createMap('upload-map',(lat,lng)=>{if(!submitting)setCoords(lat,lng,'pin');});if(map)markers=L.layerGroup().addTo(map);else $('coordinate-details').open=true;
 app.querySelectorAll('[name=post_type]').forEach(radio=>radio.onchange=()=>{
  mode=radio.value;$('photo-fields').hidden=mode==='text';$('photo-fields').disabled=mode==='text';$('caption').required=mode==='text';
  $('caption-label').textContent=mode==='text'?'전시 감상 또는 도시 이야기 · 1~500자':'발견자의 한마디 · 선택';
  $('consent-label').textContent=mode==='text'?consentText:consentPhoto;$('consent').checked=false;
  if(mode==='photo'&&map)map.invalidateSize();
 });
 if(mission){if(mission.pattern)$('pattern').value=mission.pattern;const radio=app.querySelector('[name=post_type][value="'+mission.type+'"]');radio.checked=true;radio.onchange();}
 $('caption').oninput=()=>{$('caption-count').textContent=Array.from($('caption').value).length+' / 500';};
 $('photo').onchange=async e=>{
  const revision=++photoRevision;selectedPhoto=e.target.files[0]||null;coords=null;
  $('lat').value='';$('lng').value='';$('confirmed').checked=false;if(markers)markers.clearLayers();
  if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}$('preview').hidden=true;$('location-state').textContent='사진의 발견 장소를 선택해 주세요.';
  if(!selectedPhoto)return;
  previewUrl=URL.createObjectURL(selectedPhoto);$('preview').src=previewUrl;$('preview').hidden=false;
  try{const gps=window.exifr?await exifr.gps(selectedPhoto):null;if(revision!==photoRevision||submitting)return;
   if(gps&&Number.isFinite(gps.latitude)&&Number.isFinite(gps.longitude)){setCoords(gps.latitude,gps.longitude,'exif');notice('사진에서 위치를 찾았습니다.');}
   else notice('사진에 위치 정보가 없습니다. 발견한 장소를 선택해 주세요.');
  }catch{if(revision===photoRevision)notice('사진 위치를 읽지 못했습니다. 지도에서 선택해 주세요.');}
 };
 $('gps').onclick=()=>{
  if(!navigator.geolocation)return notice('현재 위치를 사용할 수 없습니다.');
  navigator.geolocation.getCurrentPosition(p=>{if(!submitting)setCoords(p.coords.latitude,p.coords.longitude,'device');},()=>notice('위치 권한 또는 GPS를 확인해 주세요. 지도에서도 선택할 수 있습니다.'),{timeout:10000,enableHighAccuracy:true});
 };
 if(kakaoKey)$('search-button').onclick=()=>searchPlace().catch(error);
 ['lat','lng','location'].forEach(id=>$(id).oninput=()=>{$('confirmed').checked=false;if(id!=='location')coords=null;});
 $('apply-coords').onclick=()=>{
  const lat=Number($('lat').value),lng=Number($('lng').value);
  if(!$('lat').value.trim()||!$('lng').value.trim()||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return notice('위도와 경도를 모두 입력해 주세요.');
  setCoords(lat,lng,'pin');
 };
 $('upload-form').addEventListener('invalid',e=>{if(e.target.id==='lat'||e.target.id==='lng')$('coordinate-details').open=true;},true);
 $('upload-form').onsubmit=async e=>{
  e.preventDefault();if(submitting)return;
  if(mode==='photo'&&(!coords||!selectedPhoto))return notice('사진과 위치를 확인해 주세요. 좌표를 입력했다면 좌표 적용을 눌러 주세요.');
  if(mode==='text'&&!$('caption').value.trim())return notice('이야기를 한 글자 이상 남겨 주세요.');
  const fd=new FormData();fd.append('post_type',mode);fd.append('request_key',uploadKey);
  fd.append('nickname',$('nickname').value);fd.append('caption',$('caption').value);fd.append('consent',$('consent').checked?'yes':'no');
  if(mode==='photo'){for(const id of ['location','pattern'])fd.append(id,$(id).value);fd.append('lat',coords[0]);fd.append('lng',coords[1]);fd.append('source',source);fd.append('confirmed',$('confirmed').checked?'yes':'no');}
  submitting=true;$('entry-fields').disabled=true;
  try{
   $('progress').textContent=mode==='photo'?'사진을 준비하고 있습니다…':'기록을 보내고 있습니다…';
   if(mode==='photo')fd.append('photo',await compress(selectedPhoto),'circle.jpg');
   await uploadXHR(fd,n=>$('progress').textContent='기록 전송 중 '+n+'%');
   if(previewUrl)URL.revokeObjectURL(previewUrl);
   app.innerHTML='<div class="form receipt"><div class="receipt-stamp" aria-hidden="true">◎<small>RECEIVED</small></div><p class="eyebrow">ONE MORE STORY FOR OUR CITY</p><h1><em class="handwritten">당신의 발견</em>이<br>도시에 더해졌어요.</h1><p class="receipt-state" role="status">접수 완료 · 관리자 확인 대기</p><p>기록이 접수되었습니다.<br>관리자 확인 후 아카이브와 전시장 화면에 공개됩니다.<br>지금은 다른 관람객에게 보이지 않아요.</p><div class="row"><a class="button" href="'+base+'/archive/">다른 발견 만나기 ↗</a>'+(currentUser?'<a class="button secondary" href="'+base+'/account/">내 아카이브 보기</a>':'')+'<a class="button secondary" href="'+base+'/upload/">새 기록 남기기</a></div></div>';app.focus();
  }catch(err){$('progress').textContent=err.message+' 입력 내용은 이 화면에 남아 있습니다. 연결을 확인하고 다시 시도해 주세요.';$('entry-fields').disabled=false;submitting=false;}
 };
}
async function compress(file){
 if(file.size>30*1024*1024)throw Error('사진이 너무 큽니다. 30MB 이하 사진을 선택해 주세요.');
 const url=URL.createObjectURL(file);
 try{
  const im=new Image();im.src=url;try{await im.decode();}catch{throw Error('사진을 변환하지 못했습니다. HEIC 사진은 JPEG로 변환해 다시 선택해 주세요.');}
  if(im.naturalWidth*im.naturalHeight>60000000)throw Error('사진 해상도가 너무 큽니다.');
  const scale=Math.min(1,2000/Math.max(im.naturalWidth,im.naturalHeight)),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(im.naturalWidth*scale));canvas.height=Math.max(1,Math.round(im.naturalHeight*scale));
  const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(im,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.88));
  if(!blob||blob.size>8*1024*1024)throw Error('사진 변환에 실패했습니다. 작은 사진으로 다시 선택해 주세요.');return blob;
 }finally{URL.revokeObjectURL(url);}
}
function uploadXHR(fd,onProgress){
 return new Promise((resolve,reject)=>{
  const xhr=new XMLHttpRequest();xhr.open('POST',base+'/api.php?action=upload');xhr.setRequestHeader('X-CSRF-Token',csrf);xhr.timeout=45000;
  xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(Math.round(e.loaded/e.total*100));};
  xhr.onload=()=>{try{const data=JSON.parse(xhr.responseText);if(xhr.status>=200&&xhr.status<300&&data.ok)resolve(data);else reject(Error(data.error||'전송을 완료하지 못했습니다.'));}catch{reject(Error('서버 응답을 확인하지 못했습니다.'));}};
  xhr.onerror=()=>reject(Error('네트워크 연결을 확인해 주세요.'));xhr.ontimeout=()=>reject(Error('응답 시간이 초과되었습니다. 같은 요청으로 안전하게 다시 시도할 수 있습니다.'));xhr.send(fd);
 });
}
async function mapPage(){
 app.innerHTML='<div class="page-heading"><p class="eyebrow">A DIFFERENT MAP OF THE CITY</p><h1>발견은 여기서<br>이어집니다<span class="heading-dot">.</span></h1><p>핀을 눌러 누군가의 발밑에서 시작된 이야기를 만나보세요.</p></div><p class="muted">관리자가 촬영 장소를 확인한 작가 사진과 승인된 관람객 사진의 대략적인 위치만 표시합니다. 실제 촬영 지점과 다를 수 있으며 완전한 익명화를 보장하지 않습니다. 글 기록은 아카이브에서 볼 수 있습니다.</p><div id="archive-map" class="map"></div><p id="map-count" role="status"></p><section id="map-grid" class="grid"></section>';
 map=createMap('archive-map');if(!map){$('map-count').textContent='지도 연결을 확인해 주세요.';return;}markers=L.layerGroup().addTo(map);
 const query=new URLSearchParams(location.search);if(query.has('lat')&&query.has('lng')){const lat=Number(query.get('lat')),lng=Number(query.get('lng'));if(Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180)map.setView([lat,lng],16);}
 let controller,timer,revision=0;
 async function refresh(){
  const current=++revision;controller?.abort();controller=new AbortController();const bounds=map.getBounds();
  try{
   const data=await api('list&south='+Math.max(-90,bounds.getSouth())+'&north='+Math.min(90,bounds.getNorth())+'&west='+Math.max(-180,bounds.getWest())+'&east='+Math.min(180,bounds.getEast()),{signal:controller.signal});
   if(current!==revision)return;posts=data.posts;markers.clearLayers();posts.forEach(p=>L.marker([p.public_lat,p.public_lng]).addTo(markers).on('click',()=>detail(p)));
   const visibleArtists=collection.filter(item=>isMappedCollection(item)&&bounds.contains([Number(item.public_lat),Number(item.public_lng)]));
   const artistIcon=L.divIcon({className:'artist-map-pin',html:'<span aria-hidden="true">◎</span>',iconSize:[34,34],iconAnchor:[17,17]});
   visibleArtists.forEach(item=>L.marker([Number(item.public_lat),Number(item.public_lng)],{icon:artistIcon,title:item.title+' · 작가의 수집'}).addTo(markers).on('click',()=>collectionDetail(item)));
   $('map-count').textContent='현재 지도에서 작가의 수집 '+visibleArtists.length+'장 · 관람객 사진 '+posts.length+'장'+(posts.length===200?' · 관람객 사진 표시 한도에 도달했습니다. 확대해 주세요.':'');
   $('map-grid').innerHTML=visibleArtists.map(item=>'<article class="card map-curated-card"><button class="card-open secondary" type="button" data-curated-map="'+esc(item.slug)+'" aria-label="'+esc(item.title)+' 작가 사진 보기"><span class="photo-mat"><img src="'+esc(item.src)+'" alt="'+esc(item.title)+' 멘홀 사진" loading="lazy"><span class="photo-tag">작가의 수집</span></span></button><p><strong>'+esc(item.title)+'</strong><br><span class="muted">'+esc(item.location_label)+'</span></p></article>').join('')+(posts.length?cards(posts):visibleArtists.length?'':'<p class="empty">현재 지도 범위에 확인된 사진이 없습니다. 지도를 움직이거나 축소해 보세요.</p>');
   app.querySelectorAll('[data-curated-map]').forEach(button=>button.onclick=()=>collectionDetail(collection.find(item=>item.slug===button.dataset.curatedMap)));wireDetails();
  }catch(err){if(err.name!=='AbortError')error(err);}
 }
 map.on('moveend',()=>{clearTimeout(timer);timer=setTimeout(refresh,300);});await refresh();
}
let manageStatus='pending',managePage=1;
async function adminPage(){
 if(!isAdmin){
  app.innerHTML='<div class="form"><h2>관리자 로그인</h2><p>관리자로 연결된 Google 계정 또는 기존 관리자 비밀번호로 로그인하세요.</p><div id="admin-google-button" class="google-button" role="group" aria-label="관리자 구글 로그인"></div><p class="muted">Google 계정이 관리자에 연결되지 않았다면 아래 비밀번호를 사용하세요.</p><form id="login"><label for="password">관리자 비밀번호</label><input id="password" type="password" autocomplete="current-password" required><button id="login-button">로그인</button></form></div>';
  googleButton('admin-google-button',async()=>{if(isAdmin)await adminPage();else notice('이 Google 계정은 관리자에 연결되지 않았습니다.');});
  $('login').onsubmit=async e=>{e.preventDefault();$('login-button').disabled=true;try{await post('login',{password:$('password').value});isAdmin=true;await adminPage();}catch(err){error(err);if($('login-button'))$('login-button').disabled=false;}};return;
 }
 let data,managedCollection;try{const result=await Promise.all([api('manage&status='+manageStatus+'&page='+managePage),api('collection-manage')]);data=result[0];managedCollection=result[1].items;}catch(err){if(err.status===401){isAdmin=false;await adminPage();}throw err;}
 posts=data.posts;const labels={pending:'승인 대기',approved:'공개',hidden:'숨김',rejected:'거절'};
 app.innerHTML='<div class="controls"><h2>'+labels[manageStatus]+' · '+data.total+'</h2><button id="logout" class="secondary">로그아웃</button></div><div class="row" aria-label="관리 상태">'+
 Object.entries(labels).map(([status,label])=>'<button class="secondary" data-status="'+status+'" aria-pressed="'+(status===manageStatus)+'">'+label+'</button>').join('')+'<button id="reload" class="secondary">새로고침</button></div><section id="managed-records" class="grid">'+cards(posts,true)+'</section>'+pagination(data.total,managePage)+(managedCollection.length?'<section class="admin-collection"><div class="controls"><div><p class="eyebrow">THE ARTIST’S COLLECTION</p><h2>작가의 수집 관리</h2><p class="muted">제목·설명과 사진 속 장소를 확인해 저장합니다. 확인 전 GPS 후보는 비공개입니다.</p></div><a class="text-link" href="'+base+'/archive/#curated-title">공개 화면 보기 ↗</a></div><div class="grid curated-grid">'+managedCollection.map((item,i)=>'<article class="card"><img src="'+esc(item.src)+'" alt="'+esc(item.title)+' 멘홀 사진" loading="lazy"><p><strong>'+esc(item.title)+'</strong>'+(item.description?'<br><span class="muted">'+esc(item.description)+'</span>':'')+'<br><span class="muted">'+esc(item.location_label||((item.draft_lat!==null&&item.draft_lng!==null)?'좌표 후보 있음 · 장소 확인 필요':'위치 미입력'))+'</span></p><button type="button" class="secondary" data-collection-edit="'+i+'">제목·설명·위치 수정</button></article>').join('')+'</div></section>':'');
 wireDetails();
 app.querySelectorAll('[data-collection-edit]').forEach(b=>b.onclick=()=>collectionEdit(managedCollection[Number(b.dataset.collectionEdit)],adminPage));
 app.querySelectorAll('[data-status]').forEach(b=>b.onclick=()=>{manageStatus=b.dataset.status;managePage=1;adminPage().catch(error);});
 app.querySelectorAll('#managed-records .card').forEach((card,i)=>{
  const row=document.createElement('div');row.className='row';const actions=manageStatus==='pending'?['approved','rejected']:manageStatus==='approved'?['hidden']:['approved'];
  const edit=document.createElement('button');edit.type='button';edit.className='secondary';edit.textContent='글 수정';edit.onclick=()=>recordEdit(posts[i],adminPage);row.append(edit);
  actions.forEach(status=>{const b=document.createElement('button');b.textContent={approved:manageStatus==='pending'?'승인':'재승인',rejected:'거절',hidden:'숨김'}[status];b.onclick=async()=>{row.querySelectorAll('button').forEach(button=>button.disabled=true);try{await post('moderate',{id:posts[i].id,status});await adminPage();}catch(err){error(err);row.querySelectorAll('button').forEach(button=>button.disabled=false);}};row.append(b);});card.append(row);
 });
 $('reload').onclick=()=>adminPage().catch(error);
 $('previous').onclick=()=>{managePage--;adminPage().catch(error);};$('next').onclick=()=>{managePage++;adminPage().catch(error);};
 logoutButton('logout');
}
async function live(){
 document.body.classList.add('live-mode');
 app.innerHTML='<div class="controls"><h2>원의 도시 · LIVE ARCHIVE</h2><span id="live-count"></span></div><p id="live-status" class="muted">연결 중…</p><div id="live-new"></div><section class="grid" id="live-grid"></section>';
 let seen=new Set(),first=true,bannerTimer;
 async function tick(){
  try{
   const data=await api('list');posts=data.posts;const fresh=posts.find(p=>!seen.has(p.id));
   $('live-count').textContent=data.total+' RECORDS';$('live-status').textContent='최근 동기화 '+new Date().toLocaleTimeString('ko-KR');
   $('live-grid').innerHTML=cards(posts);wireDetails();clearTimeout(bannerTimer);$('live-new').replaceChildren();
   if(fresh&&!first){$('live-new').innerHTML='<div class="live-banner">'+(isPhoto(fresh)?'<img src="'+img(fresh)+'" alt="새로 발견한 원">':'<p class="record-caption">'+esc(fresh.caption)+'</p>')+'<strong>새 기록 · '+esc(isPhoto(fresh)?fresh.location_label:fresh.nickname)+'</strong></div>';bannerTimer=setTimeout(()=>$('live-new').replaceChildren(),5000);}
   seen=new Set(posts.map(p=>p.id));first=false;
  }catch{$('live-status').textContent='연결을 다시 시도하고 있습니다. 마지막 화면을 유지합니다.';}
  finally{setTimeout(tick,3000);}
 }
 await tick();
}
(async()=>{try{
 const session=await api('session');csrf=session.csrf;googleNonce=session.google_nonce;currentUser=session.user;isAdmin=session.admin;
 switch(route){case'home':await archive(true);break;case'archive':await archive();break;case'upload':upload();break;case'map':await mapPage();break;case'admin':await adminPage();break;case'account':await accountPage();break;case'live':await live();break;default:app.innerHTML='<h2>페이지를 찾을 수 없습니다.</h2>';}
}catch(err){app.innerHTML='<h2>잠시 연결하지 못했습니다.</h2><p>'+esc(err.message)+'</p><button id="retry">다시 시도</button>';$('retry').onclick=()=>location.reload();}})();
