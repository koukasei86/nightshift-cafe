import { expect, test, type Page } from '@playwright/test';

test.setTimeout(90000);
async function tapWorldObject(page:Page,x:number,y:number){const canvas=page.locator('#game canvas');await expect(canvas).toBeVisible();const b=(await canvas.boundingBox())!,z=Math.min(b.width/625,b.height/325);await canvas.click({position:{x:b.width/2+(x-500)*z,y:b.height/2+(y-250)*z}});}
async function stove(page:Page){await tapWorldObject(page,317,225);}
async function fridge(page:Page){await tapWorldObject(page,401,167);}

test('コンロで調理担当と料理を選び、取り出して会計まで進む', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?mode=playtest');
  await expect(page.locator('#game canvas')).toBeVisible();
  await stove(page);
  await page.getByRole('button', { name: 'ドクロカレー' }).click();
  await expect(page.getByRole('button', { name: 'Lv.2で解放' })).toBeDisabled();
  await page.getByLabel('調理担当').selectOption('0');
  await page.getByRole('button', { name: '沼のポタージュ' }).click();
  await page.getByRole('button', { name: '調理する' }).click();
  await expect(page.locator('#coins')).toHaveText('112');
  await expect(page.getByRole('progressbar', { name: '調理の進捗' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'カウンターに出す' })).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#kitchen')).toHaveCount(0);await expect(page.locator('#counter')).toHaveCount(0);
  await page.getByRole('button', { name: 'カウンターに出す' }).click();
  await fridge(page);await expect(page.locator('#detail-body')).toContainText('2食');await page.getByRole('button',{name:'メニューを閉じる'}).click();
  await expect.poll(async () => Number(await page.locator('#sales').textContent()), { timeout: 65000 }).toBeGreaterThan(0);
  await expect(page.locator('#served')).toHaveText(/^[12]$/);
  await page.getByRole('button', { name: '営業中' }).click();
  await expect(page.getByRole('button', { name: '受付終了' })).toBeVisible();
  await page.getByRole('button', { name: '受付終了' }).click();
  expect(errors).toEqual([]);
});

test('スマートフォン横幅で右奥の扉、コンロ、来客を直接操作する', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
  try {
    const page = await context.newPage();
    await page.goto('/?mode=playtest');
    const canvas = page.locator('#game canvas');
    await expect(canvas).toBeVisible();
    const bounds = (await canvas.boundingBox())!;
    const zoom = Math.min(bounds.width / 625, bounds.height / 325);
    const tapWorld = (x: number, y: number) => canvas.tap({ position: {
      x: bounds.width / 2 + (x - 500) * zoom, y: bounds.height / 2 + (y - 250) * zoom,
    } });
    await tapWorld(758, 255);
    await expect(page.locator('#store-toggle')).toHaveText('受付終了');
    await expect(page.locator('#notice')).toContainText('入口を閉めました');
    await tapWorld(758, 255);
    await expect(page.locator('#store-toggle')).toHaveText('営業中');
    await tapWorld(401, 211);
    await expect(page.getByRole('heading', { name: 'シェフ・モス' })).toBeVisible();
    await tapWorld(317, 225);
    await expect(page.getByRole('heading', { name: 'コンロ · レシピ帳' })).toBeVisible();
    await expect(page.getByLabel('調理担当')).toHaveValue('0');
    await page.getByRole('button', { name: 'メニューを閉じる' }).tap();

    await page.getByRole('button', { name: '来客', exact: true }).tap();
    await expect(page.getByRole('button', { name: /#1.*料理待ち/ })).toBeVisible({ timeout: 25000 });
    await page.getByRole('button', { name: 'メニューを閉じる' }).tap();
    await tapWorld(485, 215);
    await page.getByRole('button', { name: /感染させて雇う/ }).tap();
    await expect(page.locator('#crew-label')).toHaveText('従業員 2/3');
    await expect(page.locator('#toxin')).toHaveText(/^[12]$/);
    await page.getByRole('button', { name: '休憩させる' }).tap();
    await expect(page.getByRole('button', { name: '仕事に戻す' })).toBeVisible();
    await page.getByRole('button', { name: '仕事に戻す' }).tap();
    await expect(page.getByRole('button', { name: '休憩させる' })).toBeVisible();
    expect(await page.evaluate(() => ({
      width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight,
    }))).toEqual({ width: 844, height: 390 });
  } finally {
    await context.close();
  }
});


test('通常時間と試遊時間を切り替え、B台に完成品を置く', async ({page})=>{
  await page.goto('/');
  await stove(page);
  await expect(page.locator('.recipe-entry')).toContainText('120秒');
  await page.getByRole('button',{name:'時間モードを切り替え'}).click();
  await expect(page.locator('.recipe-entry')).toContainText('5秒');
  await page.getByRole('button',{name:'調理する'}).click();
  await page.getByLabel('移す配膳台').selectOption('counter-4',{timeout:10000});
  await page.getByRole('button',{name:'カウンターに出す'}).click();
  await fridge(page);
  await expect(page.locator('#detail-body')).toContainText('配膳台 B');
  await expect(page.locator('#detail-body')).toContainText('2食');
  await page.getByLabel('配膳順').selectOption('nearest');
  await page.getByRole('button',{name:'メニューを閉じる'}).click();
  await expect.poll(async()=>Number(await page.locator('#served').textContent()),{timeout:65000}).toBeGreaterThan(0);
});

test('人物の選択はコンロのレシピ帳を開いても残る',async({page})=>{
  await page.goto('/?mode=playtest');
  await page.getByRole('button',{name:'従業員',exact:true}).click();
  await page.getByRole('button',{name:/シェフ・モス/}).click();
  await stove(page);
  await expect(page.getByLabel('調理担当')).toHaveValue('0');
  expect(await page.evaluate(()=> (window as unknown as {nightshiftQA:{selected:number}}).nightshiftQA.selected)).toBe(0);
});


test('家具ショップで購入し、追加コンロで調理する', async ({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?mode=playtest');
 await page.getByRole('button',{name:'家具ショップ',exact:true}).click();
 await expect(page.getByRole('button',{name:'先にテーブルを購入してください'})).toBeDisabled();
 await page.getByRole('button',{name:'コンロを購入',exact:true}).click();
 await expect(page.locator('#coins')).toHaveText('20');
 await expect(page.getByRole('button',{name:'設置スペースがいっぱいです'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'コインが足りません'})).toBeDisabled();
 await page.screenshot({path:'../../outputs/nightshift-shop-v6.png'});
 await page.getByRole('button',{name:'メニューを閉じる'}).click();
 await stove(page);
 await page.getByLabel('調理するコンロ').selectOption('bought-stove-0');
 await page.getByRole('button',{name:'調理する',exact:true}).click();
 await expect(page.locator('#coins')).toHaveText('12');
 await page.getByRole('button',{name:'カウンターに出す'}).click({timeout:12000});
 await expect.poll(async()=>Number(await page.locator('#sales').textContent()),{timeout:65000}).toBeGreaterThan(0);
 expect(errors).toEqual([]);
});

test('テーブルと椅子の購入で接客席を増やす',async({page})=>{
 await page.goto('/?mode=playtest');
 await page.getByRole('button',{name:'家具ショップ',exact:true}).click();
 await page.getByRole('button',{name:'テーブルを購入',exact:true}).click();
 await expect(page.locator('#coins')).toHaveText('75');
 await page.getByRole('button',{name:'椅子を購入',exact:true}).click();
 await expect(page.locator('#coins')).toHaveText('50');
 await expect(page.locator('#detail-body')).toContainText('接客席 5');
 await page.getByRole('button',{name:'メニューを閉じる'}).click();
 await page.screenshot({path:'../../outputs/nightshift-furniture-v6.png'});
});


test('全家具の移動・回転と取り消し、再読み込みによる復元',async({page})=>{
 await page.setViewportSize({width:844,height:390});await page.goto('/?mode=playtest');
 await page.getByRole('button',{name:'模様替え',exact:true}).click();
 await page.getByLabel('家具',{exact:true}).selectOption('fridge-2');
 await page.getByLabel('横のマス').selectOption({value:'1'});
 await page.getByRole('button',{name:/90°回転/}).click();
 await page.getByRole('button',{name:'配置を確定',exact:true}).click();
 await expect(page.locator('#notice')).toContainText('配置を保存');
 await page.waitForTimeout(300);await page.reload();
 await page.getByRole('button',{name:'模様替え',exact:true}).click();
 await page.getByLabel('家具',{exact:true}).selectOption('fridge-2');
 await expect(page.getByLabel('横のマス')).toHaveValue('1');
 await expect(page.getByRole('button',{name:/90°回転/})).toContainText('↙');
 await page.screenshot({path:'../../outputs/nightshift-layout-v7.png'});
 await page.getByLabel('横のマス').selectOption({value:'6'});await page.getByLabel('奥行のマス').selectOption({value:'0'});
 await expect(page.getByRole('button',{name:'配置を確定',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'変更を取り消す',exact:true}).click();
 await page.getByRole('button',{name:'模様替え',exact:true}).click();await page.getByLabel('家具',{exact:true}).selectOption('fridge-2');
 await expect(page.getByLabel('横のマス')).toHaveValue('1');
});

test('料理イラスト、担当指定と自動配膳台移動を保存する',async({page})=>{
 await page.setViewportSize({width:844,height:390});await page.goto('/?mode=playtest');await stove(page);
 await expect(page.locator('.recipe-entry img')).toBeVisible();
 await page.screenshot({path:'../../outputs/nightshift-recipes-v7.png'});
 await page.getByRole('button',{name:'メニューを閉じる'}).click();
 await page.getByRole('button',{name:'従業員',exact:true}).click();await page.getByLabel('完成料理を自動で配膳台に移す').check();
 await page.getByRole('button',{name:/シェフ・モス/}).click();await page.getByLabel('担当',{exact:true}).selectOption('cook');
 await page.waitForTimeout(300);await page.reload();await page.getByRole('button',{name:'従業員',exact:true}).click();
 await expect(page.getByLabel('完成料理を自動で配膳台に移す')).toBeChecked();
 await page.getByRole('button',{name:/シェフ・モス/}).click();await expect(page.getByLabel('担当',{exact:true})).toHaveValue('cook');
});


test('閉店中にアプリを閉じた時間で料理が完成し、再開後に二重反映しない',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'営業中',exact:true}).click();await stove(page);await page.getByRole('button',{name:'調理する',exact:true}).click();
 await page.waitForFunction(()=>{const q=(window as any).nightshiftQA;return q?.orders[0]?.[1].status==='cooking';});
 await page.waitForTimeout(2200);
 const future=Date.now()+180000;await page.addInitScript((time)=>{Date.now=()=>time;},future);
 await page.reload();
 await page.waitForFunction(()=>{const q=(window as any).nightshiftQA;return q?.orders[0]?.[1].status==='ready';});
 await expect(page.locator('#coins')).toHaveText('112');await expect(page.locator('#store-toggle')).toHaveText('受付終了');
 const before=await page.evaluate(()=>{const q=(window as any).nightshiftQA;return {coins:q.coins,energy:q.staff[0].energy};});
 await page.reload();const after=await page.evaluate(()=>{const q=(window as any).nightshiftQA;return {coins:q.coins,energy:q.staff[0].energy};});
 expect(after).toEqual(before);
});
