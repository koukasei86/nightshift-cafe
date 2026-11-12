import type { Cafe, GuestState, StaffState } from '../core/simulation/cafe';
import { archetypes, LEVEL_XP, recipes, STAFF_LIMIT } from '../data/cafe';
import type { CafeScene } from '../game/scenes/CafeScene';

const stateLabels: Record<GuestState | StaffState, string> = {
  approach: '入店中', seating: '席へ移動中', waiting: '料理待ち', eating: '食事中',
  paying: '会計中', leaving: '退店中', idle: '待機中', toStove: 'コンロへ移動中',
  cooking: '調理中', toCounter: '料理を取りに移動中', toTable: '料理を運んでいます',
  serving: '配膳中', toClean: '食器を片付けに移動中', cleaning: '片付け中',
  resting: '休憩中', outburst: '暴走中',
};
const get = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
function show(el: HTMLElement, value: string | number) {
  if (el.textContent !== String(value)) el.textContent = String(value);
}

type Menu = 'stove' | 'counter' | 'crew' | 'visitors';
type Pane = { kind: Menu } | { kind: 'actor'; id: number } | null;

export function createDashboard(cafe: Cafe) {
  const tools = { stove: get('kitchen'), counter: get('counter'), crew: get('crew'), visitors: get('visitors') };
  const details = get('details'), heading = get('details-title'), body = get('detail-body');
  const coins = get('coins'), sales = get('sales'), served = get('served'), toxin = get('toxin');
  const notice = get('notice'), rating = get('rating'), level = get('level'), xp = get<HTMLProgressElement>('xp');
  const xpLabel = get('xp-label'), stock = get('stock'), cookLabel = get('stove-label');
  const crewLabel = get('crew-label'), visitorsLabel = get('visitors-label'), store = get('store-toggle');
  let view: CafeScene | undefined;
  let pane: Pane = null;
  let cookId: number | undefined;
  let recipeIndex = 0;
  let lastSignature = '';
  let lastRefresh = -Infinity;

  function showPane(next: Pane) {
    pane = next;
    if (view) view.selected = next?.kind === 'actor' ? next.id : null;
    refresh(true);
  }

  function select(id: number | null) {
    showPane(id === null ? null : { kind: 'actor', id });
  }

  function inspect(target: 'stove' | 'counter' | 'door') {
    if (target === 'door') {
      cafe.toggleOpen();
      showPane(null);
      return;
    }
    if (target === 'stove' && cafe.collectCooking()) {
      showPane(null);
      return;
    }
    if (target === 'stove' && pane?.kind === 'actor' && !cafe.order) {
      const actorId = pane.id;
      if (cafe.employees.some(worker => worker.id === actorId)) cookId = actorId;
    }
    showPane({ kind: target });
  }

  function kitchenContent() {
    const order = cafe.order;
    if (order?.status === 'ready') {
      return [order.recipe.name,
        '<p>できあがり！ カウンターに出すと配膳が始まります。</p>' +
        '<p id="kitchen-time" class="muted"></p><button type="button" class="primary" data-action="collect">カウンターに出す</button>'];
    }
    if (order) {
      return [order.recipe.name, '<p id="kitchen-time"></p><progress id="cook-progress" max="100" value="0" aria-label="調理の進捗"></progress>'];
    }
    const cooks = cafe.employees.map(worker =>
      `<option value="${worker.id}" ${cookId === worker.id ? 'selected' : ''}>${worker.name} · ${stateLabels[worker.state]}</option>`).join('');
    const tabs = recipes.map((recipe, index) =>
      `<button type="button" class="recipe-tab" aria-pressed="${index === recipeIndex}" data-action="recipe" data-id="${index}">
        <i class="recipe-icon ${recipe.animation}" aria-hidden="true">✦</i>
        <span>${recipe.name}</span></button>`).join('');
    const recipe = recipes[recipeIndex];
    const issue = cafe.cookingIssue(recipe, cookId);
    return ['コンロ · レシピ帳',
      `<div class="recipe-tabs" aria-label="料理">${tabs}</div>
      <div class="recipe-entry">
        <i class="recipe-icon ${recipe.animation}" aria-hidden="true">✦</i>
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
    return `<p class="debug-info">${actor.state} · ${path || '移動なし'}</p>`;
  }

  function paneContent(): string[] {
    switch (pane?.kind) {
      case 'stove': return kitchenContent();
      case 'counter': {
        const items = recipes.filter(recipe => cafe.stockOf(recipe.id) > 0);
        return ['料理カウンター',
          '<p>従業員が在庫を取りに来て、待っているお客様へ運びます。</p>' +
          (items.map(item => `<p><strong>${item.name}</strong> · ${cafe.stockOf(item.id)}食</p>`).join('') ||
            '<p class="muted">在庫はありません。コンロで料理を作りましょう。</p>')];
      }
      case 'crew': return [`従業員 ${cafe.employees.length}/${STAFF_LIMIT}`, cafe.employees.map(worker =>
        `<button type="button" class="list-button" data-action="actor" data-id="${worker.id}">${worker.name}<span>${stateLabels[worker.state]}</span></button>`).join('')];
      case 'visitors': return ['来客', cafe.guests.map(guest =>
        `<button type="button" class="list-button" data-action="actor" data-id="${guest.id}">${archetypes[guest.style].name} #${guest.id}<span>${stateLabels[guest.state]}</span></button>`).join('') ||
        '<p>お客様はまだいません。</p>'];
      case 'actor': return actorContent(pane.id);
      default: return ['', ''];
    }
  }

  function refresh(force = false) {
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
    tools.stove.dataset.ready = String(order?.status === 'ready');
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
    tools.stove.addEventListener('click', () => inspect('stove'));
    tools.counter.addEventListener('click', () => inspect('counter'));
    tools.crew.addEventListener('click', () => showPane({ kind: 'crew' }));
    tools.visitors.addEventListener('click', () => showPane({ kind: 'visitors' }));
    get('close-details').addEventListener('click', () => showPane(null));
    document.addEventListener('keydown', event => { if (event.key === 'Escape') showPane(null); });
    body.addEventListener('click', event => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest<HTMLButtonElement>('button[data-action]');
      if (!button || button.disabled) return;
      const id = button.dataset.id;
      switch (button.dataset.action) {
        case 'recipe': recipeIndex = Number(id); break;
        case 'cook': if (id) cafe.startCooking(id, cookId); break;
        case 'collect': if (cafe.collectCooking()) showPane(null); break;
        case 'actor': select(Number(id)); break;
        case 'infect': cafe.infect(Number(id)); break;
        case 'rest': cafe.toggleRest(Number(id)); break;
      }
      refresh(true);
    });
    body.addEventListener('change', event => {
      if (!(event.target instanceof HTMLSelectElement) || event.target.id !== 'cook-select') return;
      cookId = event.target.value === '' ? undefined : Number(event.target.value);
      refresh(true);
    });
    store.addEventListener('click', () => inspect('door'));
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
