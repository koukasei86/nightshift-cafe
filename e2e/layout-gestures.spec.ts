import {test,expect} from '@playwright/test';
test.use({viewport:{width:844,height:390},hasTouch:true});
const screen=(x:number,y:number)=>({x:422+(x-500)*1.2,y:195+(y-250)*1.2});
test('タップ選択・再タップ回転・長押し移動・不正ドロップ・キャンセル',async({page,context})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'模様替え',exact:true}).click();
 const stove=screen(317,225),q=()=>page.evaluate(()=>(window as any).nightshiftQA);
 await page.touchscreen.tap(stove.x,stove.y);expect((await q()).editSelected).toBe('stove-0');expect((await q()).editing[0].rotation).toBe(0);
 await page.touchscreen.tap(stove.x,stove.y);expect((await q()).editing[0].rotation).toBe(1);
 const client=await context.newCDPSession(page);
 const drag=async(from:{x:number;y:number},to:{x:number;y:number},cancel=false)=>{
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...from,id:1}]});await page.waitForTimeout(520);
  await expect(page.locator('#game')).toHaveClass(/furniture-grabbed/);
  await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...to,id:1}]});
  await client.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});await page.waitForTimeout(70);
 };
 const moved=screen(275,246);await drag(stove,moved);expect((await q()).editing[0]).toMatchObject({x:0,y:5,rotation:1});
 // Occupied counter tile: revert to the previous location, with no rotation on release.
 await drag(moved,screen(401,267));expect((await q()).editing[0]).toMatchObject({x:0,y:5,rotation:1});
 await drag(moved,stove,true);expect((await q()).editing[0]).toMatchObject({x:0,y:5,rotation:1});
 await page.screenshot({path:'../../outputs/nightshift-drag-v71.png'});
 await page.getByRole('button',{name:'配置を確定',exact:true}).click();await page.waitForTimeout(250);await page.reload();
 expect((await q()).furniture[0]).toMatchObject({x:0,y:5,rotation:1});expect(errors).toEqual([]);
});

test('回転したコンロの全方向に不透明な側面がある',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {box,rotatedProjection,tileCenter}=await import(/* @vite-ignore */ String('/src/game/art/geometry.ts'));
  const values:number[][]=[];
  for(let rotation=0;rotation<4;rotation++){
   const canvas=document.createElement('canvas');canvas.width=120;canvas.height=140;const ctx=canvas.getContext('2d')!,tile={x:0,y:4},center=tileCenter(tile);
   ctx.translate(60-center.x,110-center.y);rotatedProjection(tile,rotation,()=>box(ctx,.05,4.07,.9,.86,0,31,['#efeee8','#d6d4cd','#bcbbb5']));
   values.push([-18,0,18].map(dx=>ctx.getImageData(60+dx,100,1,1).data[3]));
  }
  return values;
 });
 expect(result.flat().every(a=>a===255),JSON.stringify(result)).toBe(true);
});

test('既存の6種類すべてを直接タップして選択し時計回りに回転できる',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'模様替え',exact:true}).click();
 for(const [id,x,y] of [['stove-0',317,225],['sink-1',359,206],['fridge-2',401,150],['counter-3',401,269],['table-9',527,250],['chair-10',485,236]] as const){
  const p=screen(x,y);await page.touchscreen.tap(p.x,p.y);
  const state=await page.evaluate(()=>(window as any).nightshiftQA);expect(state.editSelected).toBe(id);
  const before=state.editing.find((f:any)=>f.id===id).rotation;
  await page.touchscreen.tap(p.x,p.y);
  expect(await page.evaluate(id=>(window as any).nightshiftQA.editing.find((f:any)=>f.id===id).rotation,id)).toBe((before+1)%4);
 }
 await page.screenshot({path:'../../outputs/nightshift-objects-v71.png'});
});
