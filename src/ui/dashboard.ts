import type { CafeAudio } from '../audio/engine';
import { soundLabels,type SoundId } from '../audio/effects';
import { characterLooks } from '../data/characters';
import { personPortrait } from '../game/art/people';
import { foodImage } from '../game/art/food';
import type { Furniture } from '../core/simulation/layout';
import type { Cafe, GuestState, StaffState } from '../core/simulation/cafe';
import { archetypes, counters, LEVEL_XP, STAFF_LIMIT } from '../data/cafe';
import type { CafeScene } from '../game/scenes/CafeScene';

const stateLabels: Record<GuestState | StaffState, string> = {
  pickup: '料理を受取中', returning: '料理を戻しています', approach: '入店中', seating: '席へ移動中', waiting: '料理待ち', eating: '食事中',
  paying: '会計中', leaving: '退店中', idle: '待機中', toStove: 'コンロへ移動中',
  cooking: '調理中', toCounter: '料理を取りに移動中', toTable: '料理を運んでいます',
  serving: '配膳中', toClean: '食器を片付けに移動中', cleaning: '片付け中',
  resting: '休憩中', outburst: '暴走中',
};
const get = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
function show(el: HTMLElement | null, value: string | number) {
  if (el && el.textContent !== String(value)) el.textContent = String(value);
}

type Menu = 'stove' | 'counter' | 'crew' | 'visitors' | 'shop' | 'layout' | 'characters' | 'sound';
type Pane = { kind: Menu } | { kind: 'actor'; id: number } | null;

export function createDashboard(cafe: Cafe,audio:CafeAudio) {
  const tools = { crew: get('crew'), visitors: get('visitors'), shop: get('shop'), layout:get('layout') };
  const details = get('details'), heading = get('details-title'), body = get('detail-body');
  const coins = get('coins'), sales = get('sales'), served = get('served'), toxin = get('toxin');
  const notice = get('notice'), rating = get('rating'), level = get('level'), xp = get<HTMLProgressElement>('xp');
  const xpLabel = get('xp-label'), stock = get('stock'), cookLabel = get('stove-label');
  const crewLabel = get('crew-label'), visitorsLabel = get('visitors-label'), store = get('store-toggle');
  let view: CafeScene | undefined;
  let pane: Pane = null;
  let cookId: number | undefined;
  let selectedCounter: string | undefined;
  let recipeIndex = 0;
  let galleryZombie=false;
  let draft: Furniture[]|null=null;
  let furnitureId='stove-0';
  let advancedOpen=false;
  const names:Record<string,string>={stove:'コンロ',chair:'椅子',table:'テーブル',counter:'配膳台',sink:'流し',fridge:'冷蔵庫'};
  function beginLayout(){advancedOpen=false;draft=structuredClone(cafe.furniture);if(view){view.editItems=draft;view.editSelected=null;}showPane({kind:'layout'});}
  function syncDraft(){advancedOpen=body.querySelector<HTMLDetailsElement>('#layout-advanced')?.open??advancedOpen;if(view){view.editItems=draft;view.editSelected=furnitureId;}refresh(true);}

  let lastSignature = '';
  let lastRefresh = -Infinity;

  function showPane(next: Pane) {
    if(next?.kind!=='layout'){draft=null;if(view)view.editItems=null;}
    if(next&&next.kind!==pane?.kind)audio.play('tap');
    pane = next;
    if(view) { view.shopping = next?.kind==='shop'; view.setActive(next?.kind!=='shop'&&next?.kind!=='layout'); }
    if (view && next?.kind === 'actor') view.selected = next.id;
    refresh(true);
  }

  function select(id: number | null) {
    if(view) view.selected=id;
    showPane(id === null ? null : { kind: 'actor', id });
  }

  function inspect(target: 'stove' | 'counter' | 'door', counterId?: string) {
    if(target==='stove' && counterId) cafe.selectedStoveId=counterId;
    if(target==='counter') selectedCounter=counterId;
    if (target === 'door') {
      cafe.toggleOpen();
      showPane(null);
      return;
    }
    if (target === 'stove' && cafe.collectCooking()) {
      showPane(null);
      return;
    }
    if (target === 'stove' && view?.selected !== null && view?.selected !== undefined && !cafe.order) {
      const actorId = view!.selected!;
      if (cafe.employees.some(worker => worker.id === actorId)) cookId = actorId;
    }
    showPane({ kind: target });
  }

  function kitchenContent() {
    const recipes=cafe.recipes;
    const order = cafe.order;
    if (order?.status === 'ready') {
      return [order.recipe.name,
        '<p>できあがり！ カウンターに出すと配膳が始まります。</p>' +
        `<label>移す配膳台 <select id="counter-select">${cafe.counters.map(c=>`<option value="${c.id}" ${selectedCounter===c.id?'selected':''}>${c.name} · ${cafe.counterStock(c.id)}食</option>`).join('')}</select></label>` + '<p id="kitchen-time" class="muted"></p><button type="button" class="primary" data-action="collect">カウンターに出す</button>'];
    }
    if (order) {
      return [order.recipe.name, '<p id="kitchen-time"></p><progress id="cook-progress" max="100" value="0" aria-label="調理の進捗"></progress>'];
    }
    const cooks = cafe.employees.map(worker =>
      `<option value="${worker.id}" ${cookId === worker.id ? 'selected' : ''}>${worker.name} · ${stateLabels[worker.state]}</option>`).join('');
    const tabs = recipes.map((recipe, index) =>
      `<button type="button" class="recipe-tab" aria-pressed="${index === recipeIndex}" data-action="recipe" data-id="${index}">
        <img class="recipe-art" src="${foodImage(recipe.animation)}" alt="${recipe.name}の料理イラスト">
        <span>${recipe.name}</span></button>`).join('');
    const recipe = recipes[recipeIndex];
    const issue = cafe.cookingIssue(recipe, cookId);
    return ['コンロ · レシピ帳',
      `<p class="muted">${cafe.mode==='playtest'?'試遊時間 · 調理を短縮しています':'通常時間 · 料理時間と食数は調整中です'}</p>` +
      `<div class="recipe-tabs" aria-label="料理">${tabs}</div>
      <div class="recipe-entry">
        <img class="recipe-art" src="${foodImage(recipe.animation)}" alt="${recipe.name}の料理イラスト">
        <div><strong>${recipe.name}</strong>
          <p>${recipe.cost}コイン　${recipe.cookMs / 1000}秒　${recipe.portions}食</p>
          <p class="muted">1食 ${recipe.price}コイン · 体力 −${recipe.energy} · ${recipe.xp} XP</p>
        </div>
      </div>
      <label>調理担当 <select id="cook-select"><option value="">おまかせ</option>${cooks}</select></label>
      <button type="button" class="primary" data-action="cook" data-id="${recipe.id}" ${issue ? 'disabled' : ''}>${issue || '調理する'}</button>`];
  }

  function actorContent(id: number): string[] {
    const worker = cafe.employees.find(item => item.id === id);
    if (worker) {
      const label = worker.state === 'resting' ? '仕事に戻す' :
        worker.restRequested ? '休憩予約を解除' :
        worker.state === 'cooking' || worker.state === 'toStove' ? '調理後に休ませる' : '休憩させる';
      const disabled = worker.state === 'outburst' || (worker.state === 'resting' && worker.energy <= worker.temper);
      return [worker.name, `<p><strong>${stateLabels[worker.state]}</strong> · ${worker.lastAction}</p>
        <div class="energy" id="energy-meter"><span id="energy-label"></span>
        <progress id="energy" max="${worker.maxEnergy}" value="0" aria-label="体力"></progress></div>
        <label>担当 <select id="role-select" aria-label="担当" data-worker="${worker.id}">${[['all','おまかせ'],['cook','調理担当'],['service','配膳・片付け担当']].map(([v,l])=>`<option value="${v}" ${(worker.role??'all')===v?'selected':''}>${l}</option>`).join('')}</select></label><p class="muted">変更は次の仕事から反映します。</p>
        <p class="muted">移動 ${worker.speed} · チップ +${worker.tip} · 暴走の目安 ${worker.temper} 以下</p>
        <button type="button" class="primary" data-action="rest" data-id="${worker.id}" ${disabled ? 'disabled' : ''}>${label}</button>
        ${debugPath(worker)}`];
    }
    const guest = cafe.guests.find(item => item.id === id);
    if (!guest) return ['来客', '<p>このお客様は退店しました。</p>'];
    const type = archetypes[guest.style];
    const issue = cafe.infectionIssue(guest);
    return [type.name, `<p><strong>${stateLabels[guest.state]}</strong> · ${guest.lastAction}</p>
      <p>雇用時の体力 <strong>${type.energy}</strong>　移動 <strong>${type.speed}</strong>　チップ <strong>+${type.tip}</strong></p>
      <button type="button" class="primary" data-action="infect" data-id="${guest.id}" ${issue ? 'disabled' : ''}>感染させて雇う · 毒素 ${type.toxin}</button>
      <p class="muted">${issue || 'この客は食事と会計を切り上げて従業員になります。'}</p>${debugPath(guest)}`];
  }

  function debugPath(actor: { state: string; path: { x: number; y: number }[] }) {
    if (!view?.debug) return '';
    const path = actor.path.map(tile => `(${tile.x}, ${tile.y})`).join(' → ');
    const worker=cafe.employees.find(w=>w===actor);
    const task=worker ? cafe.taskFor(worker) : null;
    return `<p class="debug-info">${actor.state} · ${path || '移動なし'}<br>${task ? `仕事 #${task.taskId} / ${task.status} / 客 #${task.guestId} / 台 ${task.counterId} / 料理 #${task.reservedBatchId}` : '配膳予約なし'}${worker ? `<br>体力 ${Math.floor(worker.energy)} / 通路待機 ${worker.blockedSince===null ? 0 : cafe.time-worker.blockedSince}ms` : ''}</p>`;
  }

  function paneContent(): string[] {
    switch (pane?.kind) {
      case 'sound': return ['音楽と効果音', `<section class="music-settings"><strong>Midnight Reserve</strong><p class="muted">76 BPM · ピアノ、ウッドベース、ブラシドラム</p><label class="sound-enabled"><input id="music-enabled" type="checkbox" ${audio.music.enabled?'checked':''}> BGMを流す</label><label for="music-volume">BGM音量 <output id="music-volume-label">${Math.round(audio.music.volume*100)}%</output></label><input id="music-volume" type="range" min="0" max="100" value="${Math.round(audio.music.volume*100)}" aria-label="BGMの音量"></section><label class="sound-enabled"><input id="sound-enabled" type="checkbox" ${audio.enabled?'checked':''}> 効果音を鳴らす</label>
       <label for="sound-volume">音量 <output id="sound-volume-label">${Math.round(audio.volume*100)}%</output></label><input id="sound-volume" type="range" min="0" max="100" value="${Math.round(audio.volume*100)}" aria-label="効果音の音量">
       <p class="muted">最初のタップから音が鳴ります。設定はこのブラウザに保存します。</p><div class="sound-samples">${Object.entries(soundLabels).map(([id,label])=>`<button type="button" data-action="audition" data-id="${id}" ${!audio.enabled||audio.volume===0?'disabled':''}>${label}</button>`).join('')}</div><p class="muted">ボタンで効果音を試聴できます。BGMと効果音は別々に調整できます。</p>`];
      case 'layout': {
        const f=draft?.find(f=>f.id===furnitureId);if(!f)return ['模様替え','家具を選択してください'];
        const issue=cafe.layoutIssue(draft!);
        return ['模様替え', `<p class="gesture-help">タップで選択 → 再タップで時計回り。長押しでつかみ、そのままドラッグして離します。</p>
          <div class="layout-actions"><strong>${view?.editSelected?names[f.kind]:'家具をタップしてください'}</strong><button type="button" class="primary" data-action="apply-layout" ${issue?'disabled':''}>配置を確定</button><button type="button" data-action="cancel-layout">取り消す</button></div>
          <p class="layout-issue" role="status">${issue||'配置できます。空白をすばやくドラッグすると画面を移動できます。'}</p>
          <details id="layout-advanced" ${advancedOpen?'open':''}><summary>詳細な位置調整</summary>
          <label>家具 <select id="furniture-select" aria-label="家具">${draft!.map((v,i)=>`<option value="${v.id}" ${v.id===f.id?'selected':''}>${names[v.kind]} ${i+1}</option>`).join('')}</select></label>
          <div class="layout-controls"><label>横のマス <select id="layout-x">${Array.from({length:9},(_,i)=>`<option value="${i}" ${i===f.x?'selected':''}>${i+1}</option>`).join('')}</select></label><label>奥行のマス <select id="layout-y">${Array.from({length:7},(_,i)=>`<option value="${i}" ${i===f.y?'selected':''}>${i+1}</option>`).join('')}</select></label></div>
          <button type="button" data-action="rotate">90°回転 · ${['↘','↙','↖','↗'][f.rotation]}</button>
          <p class="muted">椅子の矢印はテーブルへ。コンロ・配膳台の矢印側を空けてください。確定時は客を退店させ、未提供の料理を在庫に戻します。</p></details>`];
      }
      case 'shop': return ['家具ショップ', `<p>所持金 <strong>${cafe.coins} コイン</strong> · 接客席 ${cafe.seats.length}</p>
        <p class="muted">購入すると店内の空きスペースへ自動設置します。営業は選んでいる間、一時停止します。</p>
        <div class="shop-cards">${cafe.shopItems.map(item=>{
          const issue=cafe.purchaseIssue(item.kind);
          return `<article class="shop-card"><div class="shop-icon ${item.kind}" aria-hidden="true"></div><div><strong>${item.name} · ${item.price} コイン</strong><p>${item.description}</p><small>追加購入 ${cafe.shopCount(item.kind)} / ${item.slots.length}</small></div><button type="button" class="primary" data-action="buy" data-id="${item.kind}" ${issue?'disabled':''}>${issue || item.name+'を購入'}</button></article>`;
        }).join('')}</div><p class="muted">購入後は「模様替え」で自由に配置を変更できます。購入と配置は自動保存されます。</p>`];
      case 'stove': {
        const [title,content]=kitchenContent();
        return [title, `<label>調理するコンロ <select id="stove-select">${cafe.stoves.map((s,i)=>`<option value="${s.id}" ${s.id===cafe.selectedStoveId?'selected':''}>コンロ ${i+1}${cafe.orders.has(s.id)?' · 使用中':''}</option>`).join('')}</select></label>`+content];
      }
      case 'counter': {
        return ['配膳台の在庫', cafe.counters.filter(c=>!selectedCounter || c.id===selectedCounter).map(counter=>{
          const batches=cafe.batches.filter(b=>b.counterId===counter.id && b.portions+b.reserved>0);
          return `<p><strong>${counter.name}</strong> · ${cafe.counterStock(counter.id)}食</p>`+
            (batches.map(b=>`<p>${b.recipe.name} · ${b.portions}食 / 予約 ${b.reserved}食</p>`).join('') || '<p class="muted">在庫はありません</p>');
        }).join('') + `<label>配膳順 <select id="policy-select"><option value="fifo" ${cafe.policy==='fifo'?'selected':''}>待ち時間順</option><option value="nearest" ${cafe.policy==='nearest'?'selected':''}>移動距離を優先</option></select></label>`];
      }
      case 'crew': return [`従業員 ${cafe.employees.length}/${STAFF_LIMIT}`, `<label><input type="checkbox" id="auto-stock" ${cafe.autoStock?'checked':''}> 完成料理を自動で配膳台に移す</label><p class="muted">営業中は不在中も在庫販売と疲労が進みます。閉店すると新規売上と待機疲労が止まります。調理と休憩は継続します。不在2分超は集計方式です。</p>`+cafe.employees.map(worker =>
        `<button type="button" class="list-button" data-action="actor" data-id="${worker.id}">${worker.name}<span>${stateLabels[worker.state]}</span></button>`).join('')];
      case 'characters': return ['人物一覧 · 肉体労働者まで', `<p class="muted">22項目・33人。掲載画像がない人物は補完デザインです。同じ画像で紹介されている職業は外見も共通にしています。</p><button type="button" data-action="character-form" aria-pressed="${galleryZombie}">${galleryZombie?'人間の姿を見る':'ゾンビの姿を見る'}</button><div class="character-grid">${characterLooks.slice(3).map((v,i)=>`<figure><img src="${personPortrait(i+3,galleryZombie)}" alt="${v.name}${galleryZombie?'のゾンビ姿':''}"><figcaption>${v.name}<small>${v.reference?'画像を参考に作画':'画像なし・補完デザイン'}</small></figcaption></figure>`).join('')}</div>`];
      case 'visitors': return ['来客', '<button type="button" data-action="characters">人物一覧 · 肉体労働者まで</button>' + (cafe.guests.map(guest =>
        `<button type="button" class="list-button" data-action="actor" data-id="${guest.id}">${archetypes[guest.style].name} #${guest.id}<span>${stateLabels[guest.state]}</span></button>`).join('') ||
        '<p>お客様はまだいません。</p>')];
      case 'actor': return actorContent(pane.id);
      default: return ['', ''];
    }
  }

  function refresh(force = false) {
    if (!force && pane?.kind==='sound') return;
    if (!force && cafe.time - lastRefresh < 150) return;
    lastRefresh = cafe.time;
    show(coins, cafe.coins);
    show(sales, cafe.sales);
    show(served, cafe.served);
    show(toxin, cafe.toxin);
    show(notice, cafe.notice);
    show(rating, '★'.repeat(Math.round(cafe.rating)) + '☆'.repeat(5 - Math.round(cafe.rating)));
    rating.title = `${cafe.rating.toFixed(2)} / 5`;
    rating.setAttribute('aria-label', `店舗評価 ${cafe.rating.toFixed(2)} / 5`);
    show(level, `Lv. ${cafe.level}`);
    xp.value = cafe.xp % LEVEL_XP;
    show(xpLabel, `${xp.value} / ${LEVEL_XP} XP`);
    show(stock, `在庫 ${cafe.stock}`);
    show(crewLabel, `従業員 ${cafe.employees.length}/${STAFF_LIMIT}`);
    show(visitorsLabel, `来客 ${cafe.guests.length}`);
    show(store, cafe.open ? '営業中' : '受付終了');
    store.setAttribute('aria-pressed', String(cafe.open));
    store.title = cafe.open ? '右奥の入口を閉める' : '右奥の入口を開ける';
    const order = cafe.order;
    show(cookLabel, order?.status === 'ready' ? '完成！' : order ? '調理中' : 'コンロ');

    for (const [kind, button] of Object.entries(tools)) button.setAttribute('aria-expanded', String(pane?.kind === kind));

    details.hidden = !pane;
    if (!pane) return;
    details.dataset.pane = pane.kind;
    const [title, content] = paneContent();
    const signature = title + content;
    if (signature !== lastSignature) {
      lastSignature = signature;
      show(heading, title);
      const focused = document.activeElement?.id === 'cook-select';
      body.innerHTML = content;
      if (focused) document.getElementById('cook-select')?.focus();
    }
    const time = document.getElementById('kitchen-time');
    if (time && order) {
      const remaining = Math.max(0, order.until - cafe.time);
      const seconds = Math.ceil(remaining / 1000);
      show(time, order.status === 'ready' ? `焦げるまで ${seconds} 秒` :
        order.status === 'cooking' ? `完成まで ${seconds} 秒` :
        order.status === 'queued' ? '従業員が手の空き次第、調理します' : '従業員がコンロに向かっています');
      const progress = document.getElementById('cook-progress') as HTMLProgressElement | null;
      if (progress) progress.value = order.status === 'cooking' ? (1 - remaining / order.recipe.cookMs) * 100 : 0;
    }
    const actorId = pane.kind === 'actor' ? pane.id : null;
    const worker = cafe.employees.find(item => item.id === actorId);
    if (worker) {
      get<HTMLProgressElement>('energy').value = worker.energy;
      show(get('energy-label'), `体力 ${Math.floor(worker.energy)} / ${worker.maxEnergy}`);
      get('energy-meter').classList.toggle('low', worker.energy <= worker.temper + 10);
    }
  }

  function bind(scene: CafeScene) {
    view = scene;
    get('sound-settings').textContent=audio.enabled||audio.music.enabled?'音':'消音';
    tools.layout.addEventListener('click',beginLayout);
    scene.editorAction=(action,id,tile)=>{
      const f=draft?.find(f=>f.id===id);if(!f)return;
      if(action==='tap'&&scene.editSelected===id){f.rotation=(f.rotation+1)%4;audio.play('rotate');}else if(action==='tap')audio.play('tap');
      if(action==='move'&&tile){f.x=tile.x;f.y=tile.y;}
      furnitureId=id;syncDraft();
    };
    body.addEventListener('toggle',event=>{if(event.target instanceof HTMLDetailsElement&&event.target.id==='layout-advanced')advancedOpen=event.target.open;},true);
    get('sound-settings').addEventListener('click',()=>showPane({kind:'sound'}));
    body.addEventListener('input',event=>{if(event.target instanceof HTMLInputElement&&event.target.id==='music-volume'){audio.setMusicVolume(Number(event.target.value)/100);get('music-volume-label').textContent=event.target.value+'%';return;}if(event.target instanceof HTMLInputElement&&event.target.id==='sound-volume'){audio.setVolume(Number(event.target.value)/100);get('sound-volume-label').textContent=event.target.value+'%';body.querySelectorAll<HTMLButtonElement>('[data-action=audition]').forEach(b=>b.disabled=!audio.enabled||audio.volume===0);}});
    tools.crew.addEventListener('click', () => showPane({ kind: 'crew' }));
    tools.shop.addEventListener('click',()=>showPane({kind:'shop'}));
    tools.visitors.addEventListener('click', () => showPane({ kind: 'visitors' }));
    get('close-details').addEventListener('click', () => {audio.play('tap');showPane(null);});
    document.addEventListener('keydown', event => { if (event.key === 'Escape') showPane(null); });
    body.addEventListener('click', event => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest<HTMLButtonElement>('button[data-action]');
      if (!button || button.disabled) return;
      const id = button.dataset.id;
      switch (button.dataset.action) {
        case 'audition': if(id&&id in soundLabels)audio.play(id as SoundId);break;
        case 'characters': showPane({kind:'characters'});break;
        case 'character-form': galleryZombie=!galleryZombie;break;
        case 'rotate': {const f=draft?.find(f=>f.id===furnitureId);if(f){f.rotation=(f.rotation+1)%4;audio.play('rotate');}syncDraft();break;}
        case 'apply-layout': if(draft&&cafe.applyLayout(draft)){audio.play('place');showPane(null);}break;
        case 'cancel-layout': showPane(null);break;
        case 'buy': if(id) cafe.buyFurniture(id); break;
        case 'recipe': audio.play('tap');recipeIndex = Number(id); break;
        case 'cook': if (id) cafe.startCooking(id, cookId); break;
        case 'collect': if (cafe.collectCooking((document.getElementById('counter-select') as HTMLSelectElement | null)?.value)) showPane(null); break;
        case 'actor': select(Number(id)); break;
        case 'infect': cafe.infect(Number(id)); break;
        case 'rest': cafe.toggleRest(Number(id)); break;
      }
      view?.onTick?.();
      refresh(true);
    });
    body.addEventListener('change', event => {
      if(event.target instanceof HTMLInputElement&&event.target.id==='music-enabled'){audio.setMusicEnabled(event.target.checked);get('sound-settings').textContent=audio.enabled||audio.music.enabled?'音':'消音';refresh(true);return;}
      if(event.target instanceof HTMLInputElement&&event.target.id==='sound-enabled'){audio.setEnabled(event.target.checked);get('sound-settings').textContent=audio.enabled||audio.music.enabled?'音':'消音';refresh(true);return;}
      if(event.target instanceof HTMLInputElement && event.target.id==='auto-stock'){cafe.autoStock=event.target.checked;return;}
      if (!(event.target instanceof HTMLSelectElement)) return;
      if(event.target.id==='role-select'){const w=cafe.employees.find(w=>w.id===Number((event.target as HTMLSelectElement).dataset.worker));if(w)w.role=event.target.value as 'all'|'cook'|'service';refresh(true);return;}
      if(event.target.id==='furniture-select'){furnitureId=event.target.value;syncDraft();return;}
      if(event.target.id==='layout-x'||event.target.id==='layout-y'){const f=draft?.find(f=>f.id===furnitureId);if(f)f[event.target.id==='layout-x'?'x':'y']=Number(event.target.value);syncDraft();return;}
      if(event.target.id==='stove-select') {cafe.selectedStoveId=event.target.value;refresh(true);return;}
      if(event.target.id==='counter-select') { selectedCounter=event.target.value; return; }
      if(event.target.id==='policy-select') { cafe.policy=event.target.value==='nearest'?'nearest':'fifo'; return; }
      if(event.target.id !== 'cook-select') return;
      cookId = event.target.value === '' ? undefined : Number(event.target.value);
      refresh(true);
    });
    store.addEventListener('click', () => inspect('door'));
    const mode = get('time-mode');
    const refreshMode=()=> { mode.textContent=cafe.mode==='normal'?'通常時間':'試遊時間'; mode.setAttribute('aria-pressed',String(cafe.mode==='playtest')); };
    mode.addEventListener('click',()=> { cafe.setMode(cafe.mode==='normal'?'playtest':'normal');refreshMode();refresh(true); });
    refreshMode();
    const debug = get('debug');
    debug.addEventListener('click', () => {
      scene.debug = !scene.debug;
      debug.setAttribute('aria-pressed', String(scene.debug));
      refresh(true);
    });
    get('zoom-in').addEventListener('click', () => scene.zoom(1.25));
    get('zoom-out').addEventListener('click', () => scene.zoom(0.8));
    get('zoom-reset').addEventListener('click', () => scene.resetView());
    refresh(true);
  }

  return { bind, refresh, select, inspect };
}
