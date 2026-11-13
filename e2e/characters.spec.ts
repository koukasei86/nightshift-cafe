import {test,expect} from '@playwright/test';
test('22項目の人物一覧と人間・ゾンビの全方向アニメーション',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await page.locator('#visitors').click();await page.getByRole('button',{name:'人物一覧 · 肉体労働者まで'}).click();
 await expect(page.locator('.character-grid figure')).toHaveCount(33);
 await expect(page.getByAltText('肉体労働者',{exact:true})).toHaveCount(1);
 await page.getByRole('button',{name:'ゾンビの姿を見る'}).click();await expect(page.getByAltText('肉体労働者のゾンビ姿')).toHaveCount(1);
 const result=await page.evaluate(async()=>{
  const {paintPerson}=await import(/* @vite-ignore */ String('/src/game/art/people.ts'));
  const {characterLooks}=await import(/* @vite-ignore */ String('/src/data/characters.ts'));
  const canvas=document.createElement('canvas');canvas.width=1260;canvas.height=1320;const c=canvas.getContext('2d')!;
  c.fillStyle='#ded5bb';c.fillRect(0,0,1260,1320);
  let frames=0;const scratch=document.createElement('canvas');scratch.width=210;scratch.height=188;const sc=scratch.getContext('2d')!;sc.scale(2,2);
  for(let i=3;i<characterLooks.length;i++){
   const n=i-3,x=n%6*210,y=Math.floor(n/6)*220;
   c.save();c.translate(x,y);c.scale(2,2);paintPerson(c,i,0,'sw');c.restore();
   c.fillStyle='#332d23';c.font='14px sans-serif';c.textAlign='center';c.fillText(characterLooks[i].name,x+105,y+194);c.font='11px sans-serif';c.fillText(characterLooks[i].reference?'掲載画像あり':'掲載画像なし・補完',x+105,y+212);
   for(const zombie of [0,1000])for(const f of ['se','sw','ne','nw'])for(const step of [0,1,4,7,10,13,16,17,20,21,25,29,30]){
    sc.clearRect(0,0,105,94);paintPerson(sc,i+zombie,step,f,step>=17&&step<=20);frames++;
    if(!sc.getImageData(0,0,210,188).data.some((v:number,j:number)=>j%4===3&&v>0))throw Error('empty sprite');
   }
  }
  return {data:canvas.toDataURL().split(',')[1],frames};
 });
 await page.setContent(`<img id="roster" src="data:image/png;base64,${result.data}">`);
 await page.locator('#roster').screenshot({path:'../../outputs/nightshift-character-roster-v08.png'});
 expect(result.frames).toBe(3432);expect(errors).toEqual([]);
});
