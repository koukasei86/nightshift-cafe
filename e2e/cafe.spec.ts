import { expect, test } from '@playwright/test';

test('コンロで調理担当と料理を選び、取り出して会計まで進む', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?mode=playtest');
  await expect(page.locator('#game canvas')).toBeVisible();
  await page.getByRole('button', { name: 'コンロ', exact: true }).click();
  await page.getByRole('button', { name: 'ドクロカレー' }).click();
  await expect(page.getByRole('button', { name: 'Lv.2で解放' })).toBeDisabled();
  await page.getByLabel('調理担当').selectOption('0');
  await page.getByRole('button', { name: '沼のポタージュ' }).click();
  await page.getByRole('button', { name: '調理する' }).click();
  await expect(page.locator('#coins')).toHaveText('112');
  await expect(page.getByRole('progressbar', { name: '調理の進捗' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'カウンターに出す' })).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#stock')).toHaveText('在庫 0');
  await page.getByRole('button', { name: 'カウンターに出す' }).click();
  await expect(page.locator('#stock')).toHaveText('在庫 2');
  await expect.poll(async () => Number(await page.locator('#sales').textContent()), { timeout: 20000 }).toBeGreaterThan(0);
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
    await expect(page.getByRole('button', { name: /#1.*料理待ち/ })).toBeVisible({ timeout: 15000 });
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
  await page.getByRole('button',{name:'コンロ',exact:true}).click();
  await expect(page.locator('.recipe-entry')).toContainText('120秒');
  await page.getByRole('button',{name:'時間モードを切り替え'}).click();
  await expect(page.locator('.recipe-entry')).toContainText('5秒');
  await page.getByRole('button',{name:'調理する'}).click();
  await page.getByLabel('移す配膳台').selectOption('counter-4',{timeout:10000});
  await page.getByRole('button',{name:'カウンターに出す'}).click();
  await page.getByRole('button',{name:'カウンター',exact:true}).click();
  await expect(page.locator('#detail-body')).toContainText('配膳台 B');
  await expect(page.locator('#detail-body')).toContainText('2食');
  await page.getByLabel('配膳順').selectOption('nearest');
  await page.getByRole('button',{name:'メニューを閉じる'}).click();
  await expect.poll(async()=>Number(await page.locator('#served').textContent()),{timeout:25000}).toBeGreaterThan(0);
});

test('人物の選択はコンロのレシピ帳を開いても残る',async({page})=>{
  await page.goto('/?mode=playtest');
  await page.getByRole('button',{name:'従業員',exact:true}).click();
  await page.getByRole('button',{name:/シェフ・モス/}).click();
  await page.getByRole('button',{name:'コンロ',exact:true}).click();
  await expect(page.getByLabel('調理担当')).toHaveValue('0');
  expect(await page.evaluate(()=> (window as unknown as {nightshiftQA:{selected:number}}).nightshiftQA.selected)).toBe(0);
});
