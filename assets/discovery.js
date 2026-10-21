'use strict';
// Shared, dependency-free content. Mission choices never imply consent or approval.
(function(root){
 const patterns=Object.freeze({Geometric:'기하학',Traditional:'전통 문양',Symbol:'상징',Letter:'문자',Nature:'자연',Other:'그 밖의 원'});
 const missions=Object.freeze([
  {id:'rhythm',type:'photo',pattern:'Geometric',title:'같은 무늬가 몇 번 반복될까요?',prompt:'선을 따라가 보세요. 같은 모양이 어디에서 다시 나오나요?',hint:'눈에 띈 무늬를 적어주세요.',art:'rings',word:'RHYTHM'},
  {id:'letter',type:'photo',pattern:'Letter',title:'어떤 글자가 쓰여 있나요?',prompt:'맨홀에 새겨진 이름이나 숫자를 찾아보세요.',hint:'원 안에서 어떤 글자나 이름을 읽었나요?',art:'letters',word:'LETTER'},
  {id:'nature',type:'photo',pattern:'Nature',title:'꽃이나 잎을 찾아보세요',prompt:'꽃, 잎, 물결을 닮은 무늬가 있나요?',hint:'무엇을 닮은 무늬인가요?',art:'petals',word:'NATURE'},
  {id:'story',type:'text',pattern:null,title:'사진 없이 글만 남겨도 좋아요',prompt:'전시를 보며 떠오른 생각이나 걷다가 본 풍경을 적어주세요.',hint:'어떤 생각이 들었나요?',art:'orbit',word:'STORY'}
 ].map(Object.freeze));
 const getMission=id=>missions.find(m=>m.id===id)||null;
 const nextMission=index=>(Number.isInteger(index)&&index>=0?index+1:0)%missions.length;
 const uploadUrl=(base,id)=>base+'/upload/'+(getMission(id)?'?mission='+encodeURIComponent(id):'');
 const api=Object.freeze({patterns,missions,getMission,nextMission,uploadUrl});
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.CIRCLE_DISCOVERY=api;
})(typeof window!=='undefined'?window:globalThis);
