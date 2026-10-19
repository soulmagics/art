'use strict';
// Shared, dependency-free content. Mission choices never imply consent or approval.
(function(root){
 const patterns=Object.freeze({Geometric:'기하학',Traditional:'전통 문양',Symbol:'상징',Letter:'문자',Nature:'자연',Other:'그 밖의 원'});
 const missions=Object.freeze([
  {id:'rhythm',type:'photo',pattern:'Geometric',title:'반복 속의 리듬',prompt:'선이 몇 번이나 만날까요? 반복되는 무늬를 가진 원을 찾아보세요.',hint:'이 무늬는 나에게 무엇처럼 보이나요?',art:'rings',word:'RHYTHM'},
  {id:'letter',type:'photo',pattern:'Letter',title:'도시가 쓴 한마디',prompt:'발밑에도 글자가 있어요. 이름이나 숫자가 새겨진 원을 발견해 보세요.',hint:'원 안에서 어떤 글자나 이름을 읽었나요?',art:'letters',word:'LETTER'},
  {id:'nature',type:'photo',pattern:'Nature',title:'발밑의 작은 정원',prompt:'꽃, 잎, 물결. 단단한 철 위에 숨어 있는 자연을 찾아보세요.',hint:'차가운 철 위에서 어떤 자연을 만났나요?',art:'petals',word:'NATURE'},
  {id:'story',type:'text',pattern:null,title:'사진 없이도, 발견',prompt:'오늘 전시를 보고 떠오른 풍경을 한 문장으로 남겨보세요.',hint:'고개를 숙였을 때, 나는…',art:'orbit',word:'STORY'}
 ].map(Object.freeze));
 const getMission=id=>missions.find(m=>m.id===id)||null;
 const nextMission=index=>(Number.isInteger(index)&&index>=0?index+1:0)%missions.length;
 const uploadUrl=(base,id)=>base+'/upload/'+(getMission(id)?'?mission='+encodeURIComponent(id):'');
 const api=Object.freeze({patterns,missions,getMission,nextMission,uploadUrl});
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.CIRCLE_DISCOVERY=api;
})(typeof window!=='undefined'?window:globalThis);
