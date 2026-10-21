'use strict';
// Shared, dependency-free content. Mission choices never imply consent or approval.
(function(root){
 const patterns=Object.freeze({Geometric:'기하학',Traditional:'전통 문양',Symbol:'상징',Letter:'문자',Nature:'자연',Other:'분류 없음'});
 const missions=Object.freeze([
  {id:'rhythm',type:'photo',pattern:'Other',title:'오늘 발견한 동그란 것은?',prompt:'컵, 바퀴, 열매, 맨홀. 주변에서 찾은 동그란 모양을 사진으로 남겨주세요.',hint:'무엇을 발견했나요?',art:'rings',word:'ROUND'},
  {id:'letter',type:'photo',pattern:'Other',title:'길에서 만난 동그라미',prompt:'바퀴나 둥근 창문, 길 위의 맨홀처럼 걷다가 눈에 들어온 동그란 것을 찍어보세요.',hint:'어디에서 무엇을 발견했나요?',art:'orbit',word:'STREET'},
  {id:'nature',type:'photo',pattern:'Other',title:'자연에서 찾은 동그라미',prompt:'동그란 열매, 물방울, 꽃의 가운데. 가까이 들여다보고 사진으로 남겨주세요.',hint:'어떤 동그란 모양을 찾았나요?',art:'petals',word:'NATURE'},
  {id:'story',type:'text',pattern:null,title:'사진 없이 글만 남겨도 좋아요',prompt:'발견한 동그란 것이나 전시를 보며 떠오른 생각을 적어주세요.',hint:'어떤 생각이 들었나요?',art:'orbit',word:'STORY'}
 ].map(Object.freeze));
 const getMission=id=>missions.find(m=>m.id===id)||null;
 const nextMission=index=>(Number.isInteger(index)&&index>=0?index+1:0)%missions.length;
 const uploadUrl=(base,id)=>base+'/upload/'+(getMission(id)?'?mission='+encodeURIComponent(id):'');
 const api=Object.freeze({patterns,missions,getMission,nextMission,uploadUrl});
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.CIRCLE_DISCOVERY=api;
})(typeof window!=='undefined'?window:globalThis);
