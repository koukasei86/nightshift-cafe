import {test,expect} from '@playwright/test';
test.use({viewport:{width:844,height:390},hasTouch:true});
test('音の解除・14試聴・音量・消音保存・購入音・バックグラウンド停止',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 const audio=()=>page.evaluate(()=>(window as any).nightshiftQA.audio);
 expect((await audio()).state).toBe('locked');await page.getByRole('button',{name:'効果音の設定'}).tap();
 await expect.poll(async()=>(await audio()).state).toBe('running');
 const samples=page.locator('[data-action=audition]');await expect(samples).toHaveCount(14);
 for(let i=0;i<14;i++){await samples.nth(i).tap();await page.waitForTimeout(180);}
 const heard=(await audio()).events.map((e:any)=>e.id);for(const id of ['door','arrival','cook','ready','plate','cash','infect','level','buy','rotate','place','error','rest'])expect(heard).toContain(id);
 await page.locator('#sound-volume').fill('25');expect((await audio()).volume).toBe(.25);
 await page.locator('#sound-enabled').uncheck();expect((await audio()).active).toBe(0);expect((await audio()).enabled).toBe(false);
 await page.reload();await page.getByRole('button',{name:'効果音の設定'}).tap();expect((await audio()).enabled).toBe(false);expect((await audio()).volume).toBe(.25);
 await page.locator('#sound-enabled').check();await expect.poll(async()=>(await audio()).state).toBe('running');
 await page.getByRole('button',{name:'メニューを閉じる'}).tap();await page.locator('#shop').tap();await page.getByRole('button',{name:'コンロを購入',exact:true}).tap();expect((await audio()).events.map((e:any)=>e.id)).toContain('buy');
 await page.getByRole('button',{name:'メニューを閉じる'}).tap();await page.getByRole('button',{name:'効果音の設定'}).tap();
 await page.getByRole('button',{name:'ゾンビ化',exact:true}).tap();expect((await audio()).active).toBeGreaterThan(0);
 await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await expect.poll(async()=>(await audio()).state).toBe('suspended');expect((await audio()).active).toBe(0);
 await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));await expect.poll(async()=>(await audio()).state).toBe('running');
 await page.screenshot({path:'../../outputs/nightshift-sound-settings.png'});expect(errors).toEqual([]);
});
test('実営業の調理・完成・配膳・会計のタイミングに音が鳴る',async({page})=>{
 test.setTimeout(75000);await page.goto('/?mode=playtest');await page.locator('#crew').tap();await page.locator('#auto-stock').check();await page.getByRole('button',{name:'メニューを閉じる'}).tap();
 await page.locator('#game canvas').tap({position:{x:202.4,y:165}});await page.getByRole('button',{name:'調理する',exact:true}).tap();await page.getByRole('button',{name:'メニューを閉じる'}).tap();
 await expect.poll(async()=>page.evaluate(()=>(window as any).nightshiftQA.audio.events.some((e:any)=>e.id==='cash')),{timeout:65000}).toBe(true);
 const ids=await page.evaluate(()=>(window as any).nightshiftQA.audio.events.map((e:any)=>e.id));for(const id of ['cook','ready','plate','arrival','cash'])expect(ids).toContain(id);
});
