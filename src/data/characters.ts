/** Stable appearance IDs: 0–2 are reserved for saves made before v0.8. */
export type Hair = 'messy'|'bob'|'bald'|'blonde'|'quiff'|'blue'|'flat'|'bowl'|'helmet'|'white';
export type Outfit = 'polo'|'redvest'|'tie'|'tracksuit'|'skirt'|'bluevest'|'skull';
export interface CharacterLook { name:string; category:string; hair:Hair; outfit:Outfit; female?:boolean; dark?:boolean; old?:boolean; glasses?:boolean; broad?:boolean; reference:boolean; }
const look=(name:string,category:string,hair:Hair,outfit:Outfit,extra:Partial<CharacterLook>={}):CharacterLook=>({name,category,hair,outfit,reference:true,...extra});
export const characterLooks: readonly CharacterLook[] = [
 look('配達員','旧セーブ','messy','polo'),look('常連客','旧セーブ','white','bluevest',{old:true,glasses:true}),look('整備士','旧セーブ','flat','skull',{dark:true,glasses:true}),
 look('無職 1','無職','messy','polo',{reference:false}),look('無職 2','無職','bob','polo',{female:true,reference:false}),look('無職 3','無職','bowl','redvest',{glasses:true,reference:false}),look('無職 4','無職','flat','skull',{dark:true,reference:false}),look('無職 5','無職','bald','bluevest',{old:true,reference:false}),
 look('怠け者 男','怠け者','messy','polo',{reference:false}),look('怠け者 女','怠け者','bob','polo',{female:true,reference:false}),
 look('テレフォンアポインター 男','テレフォンアポインター','messy','polo'),look('テレフォンアポインター 女','テレフォンアポインター','bob','polo',{female:true}),
 look('教師 男','教師','messy','redvest'),look('教師 女','教師','bob','redvest',{female:true,reference:false}),
 look('会計士','会計士','bald','tie',{old:true,glasses:true}),look('ヨガの先生','ヨガの先生','blonde','tracksuit',{female:true}),
 look('ビジネスマン','ビジネスマン','quiff','tie'),look('OL','OL','bob','skirt',{female:true}),
 look('政治家 男','政治家','quiff','tie'),look('政治家 女','政治家','bob','skirt',{female:true,reference:false}),
 look('企業幹部 男','企業幹部','quiff','tie'),look('企業幹部 女','企業幹部','bob','skirt',{female:true}),
 look('社長 男','社長','quiff','tie'),look('社長 女','社長','bob','skirt',{female:true,reference:false}),
 look('退職者 男','退職者','bald','bluevest',{old:true,glasses:true}),look('退職者 女','退職者','white','bluevest',{female:true,old:true,glasses:true,reference:false}),
 look('退役軍人','退役軍人','bald','polo',{old:true,broad:true,reference:false}),look('100歳','100歳','bald','bluevest',{old:true,glasses:true}),
 look('10代','10代','blue','skull'),look('パンク','パンク','blue','skull'),look('落ちこぼれ','落ちこぼれ','flat','skull',{dark:true,glasses:true}),look('クラスの笑いもの','クラスの笑いもの','blue','skull'),
 look('オタク','オタク','bowl','redvest',{glasses:true}),look('数学マニア','数学マニア','bowl','redvest',{glasses:true,reference:false}),look('情報主任','情報主任','bowl','bluevest',{glasses:true}),look('肉体労働者','肉体労働者','helmet','skull',{broad:true}),
];
export const ZOMBIE_STYLE_OFFSET=1000;
export const characterLook=(style:number)=>characterLooks[(style>=ZOMBIE_STYLE_OFFSET?style-ZOMBIE_STYLE_OFFSET:style)]??characterLooks[0];
export const characterWidth=(style:number)=>style<0?.87:characterLook(style).broad?.95:characterLook(style).female?.80:.84;
