import {test,expect} from '@playwright/test';
test.use({viewport:{width:844,height:390},hasTouch:true});
test('BGMは1本だけループし、効果音と独立して音量・消音・復帰を扱う',async({page})=>{
 await page.addInitScript(()=>{(window as any).musicStarts=[];const original=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args:Parameters<typeof original>){if(this.loop){const b=this.buffer!,d=b.getChannelData(0);(window as any).musicStarts.push({duration:b.duration,seam:Math.abs(d[0]-d[d.length-1]),channels:b.numberOfChannels});}return original.apply(this,args);};});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');const status=()=>page.evaluate(()=>(window as any).nightshiftQA.audio);
 expect((await status()).state).toBe('locked');await page.getByRole('button',{name:'効果音の設定'}).tap();await expect.poll(async()=>(await status()).music.playing).toBe(true);
 expect(await page.evaluate(()=>(window as any).musicStarts.length)).toBe(1);
 await page.locator('#sound-enabled').uncheck();expect((await status()).enabled).toBe(false);expect((await status()).music.playing).toBe(true);
 await page.locator('#music-volume').fill('18');expect((await status()).music.volume).toBe(.18);
 await page.locator('#music-enabled').uncheck();expect((await status()).music.playing).toBe(false);
 await page.locator('#sound-enabled').check();await page.getByRole('button',{name:'料理完成',exact:true}).tap();expect((await status()).events.some((e:any)=>e.id==='ready')).toBe(true);
 await page.locator('#music-enabled').check();expect((await status()).music.playing).toBe(true);expect(await page.evaluate(()=>(window as any).musicStarts.length)).toBe(1);
 await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await expect.poll(async()=>(await status()).state).toBe('suspended');const position=(await status()).music.position;
 await page.waitForTimeout(200);expect((await status()).music.position).toBe(position);
 await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));await expect.poll(async()=>(await status()).music.playing).toBe(true);expect((await status()).music.position).toBeGreaterThanOrEqual(position);
 const loops=await page.evaluate(()=>(window as any).musicStarts);expect(loops).toHaveLength(2);for(const l of loops){expect(l.duration).toBeCloseTo(128*60/76,3);expect(l.channels).toBe(2);expect(l.seam).toBeLessThan(.00001);}
 await page.locator('#music-enabled').uncheck();await page.reload();await page.getByRole('button',{name:'効果音の設定'}).tap();expect((await status()).music.enabled).toBe(false);expect((await status()).music.volume).toBe(.18);expect((await status()).enabled).toBe(true);
 await page.screenshot({path:'../../outputs/nightshift-music-settings.png'});expect(errors).toEqual([]);
});
test('旧版で消音した端末はBGMも消音のまま移行する',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('nightshift-cafe-sound-v1',JSON.stringify({enabled:false,volume:.25})));await page.goto('/');await page.getByRole('button',{name:'効果音の設定'}).tap();
 const state=await page.evaluate(()=>(window as any).nightshiftQA.audio);expect(state.music.enabled).toBe(false);expect(state.state).toBe('locked');
});
