import {test,expect} from '@playwright/test';
test('人物一覧の4方向切替と頭部・歩行・着席・運搬の全種類描画',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.locator('#visitors').click();await page.getByRole('button',{name:'人物一覧 · 肉体労働者まで'}).click();
 const pictures:string[]=[];for(const name of ['↙ 手前左','↘ 手前右','↖ 奥左','↗ 奥右']){await page.getByRole('button',{name,exact:true}).click();await expect(page.getByRole('button',{name,exact:true})).toHaveAttribute('aria-pressed','true');pictures.push((await page.getByAltText('肉体労働者',{exact:true}).getAttribute('src'))!);}
 expect(new Set(pictures).size).toBe(4);
 const data=await page.evaluate(async()=>{
  const {paintPerson}=await import(/* @vite-ignore */ String('/src/game/art/people.ts'));
  const types=[[-1,'シェフ'],[10,'短髪'],[11,'ボブ'],[14,'会計士'],[15,'金髪'],[16,'前髪'],[25,'白髪'],[28,'青髪'],[30,'巻き毛'],[32,'中央分け'],[35,'ヘルメット']] as const;
  const canvas=document.createElement('canvas');canvas.width=880;canvas.height=types.length*200+40;const c=canvas.getContext('2d')!;c.fillStyle='#e2d9bf';c.fillRect(0,0,canvas.width,canvas.height);c.font='16px sans-serif';c.textAlign='center';c.fillStyle='#342e25';['↙ 手前左','↘ 手前右','↖ 奥左','↗ 奥右'].forEach((n,i)=>c.fillText(n,i*220+110,24));
  for(const [row,[style,name]] of types.entries())for(const [col,facing] of ['sw','se','nw','ne'].entries()){
   c.save();c.translate(col*220+5,row*200+35);c.scale(2,2);paintPerson(c,style,0,facing);c.restore();c.fillStyle='#342e25';c.fillText(name,col*220+110,row*200+228);
  }
  const scratch=document.createElement('canvas');scratch.width=210;scratch.height=188;const sc=scratch.getContext('2d')!;sc.scale(2,2);
  for(let style=-1;style<36;style++)for(const facing of ['sw','se','nw','ne'])for(const frame of [0,1,6,13,16,18])for(const zombie of [0,1000]){sc.clearRect(0,0,105,94);paintPerson(sc,style<0?-1:style+zombie,frame,facing,frame===18);}
  return canvas.toDataURL();
 });
 await page.setContent(`<img id="sheet" src="${data}">`);await page.locator('#sheet').screenshot({path:'../../outputs/nightshift-four-directions.png'});expect(errors).toEqual([]);
});
