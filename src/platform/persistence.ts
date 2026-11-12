import { Cafe } from '../core/simulation/cafe';
const KEY='nightshift-cafe-save-v1', BACKUP=KEY+'-backup';
function checksum(text:string){let hash=2166136261;for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);return (hash>>>0).toString(16);}
export function encodeSave(cafe:Cafe,savedAt:number){const payload=JSON.stringify({savedAt,data:cafe.saveData()});return JSON.stringify({payload,checksum:checksum(payload)});}
export function decodeSave(raw:string){const outer=JSON.parse(raw);if(typeof outer.payload!=='string'||checksum(outer.payload)!==outer.checksum)throw Error('保存データの検査に失敗しました');const {savedAt,data}=JSON.parse(outer.payload);if(!Number.isFinite(savedAt)||savedAt<0)throw Error('保存時刻が不正です');return {cafe:Cafe.fromData(data),savedAt};}
export function restoreCafe(storage:Storage,now=Date.now()){
 let warning='';
 for(const key of [KEY,BACKUP]){try{const raw=storage.getItem(key);if(raw){const restored=decodeSave(raw);const summary=restored.cafe.advanceOffline(Math.max(0,now-restored.savedAt));return {...restored,summary,warning:key===BACKUP?'前回のバックアップから復元しました':warning};}}catch{warning='保存データを読めませんでした。元データは破損バックアップに保持します';try{const raw=storage.getItem(key);if(raw)storage.setItem(key+'-damaged',raw);}catch{}}}
 return {cafe:null,savedAt:now,summary:null,warning};
}
export function attachPersistence(cafe:Cafe,onActive:(active:boolean)=>void){
 let hiddenAt:number|null=null,conflict=false,lastRaw='';
 const status=document.getElementById('save-status');
 const save=()=>{
  if(conflict)return;
  try{const raw=encodeSave(cafe,hiddenAt??Date.now()),previous=localStorage.getItem(KEY);if(previous&&previous!==raw){try{decodeSave(previous);localStorage.setItem(BACKUP,previous);}catch{}}
   localStorage.setItem(KEY,raw);lastRaw=raw;if(status)status.textContent='自動保存済み';
  }catch{if(status)status.textContent='保存できません（ブラウザの容量・設定を確認）';}
 };
 const hide=()=>{if(hiddenAt===null){hiddenAt=Date.now();save();onActive(false);}};
 const resume=()=>{if(conflict)return;if(hiddenAt!==null){cafe.advanceOffline(Math.max(0,Date.now()-hiddenAt));hiddenAt=null;save();}onActive(true);};
 const visibility=()=>document.visibilityState==='hidden'?hide():resume();
 const storage=(e:StorageEvent)=>{if(e.key===KEY&&e.newValue&&e.newValue!==lastRaw){conflict=true;onActive(false);if(status)status.textContent='別タブで更新されました。このタブは再読み込みしてください';}};
 document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',hide);window.addEventListener('pageshow',resume);window.addEventListener('storage',storage);
 const timer=setInterval(()=>{if(hiddenAt===null)save();},2000);save();
 return {save,dispose(){clearInterval(timer);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',hide);window.removeEventListener('pageshow',resume);window.removeEventListener('storage',storage);}};
}
