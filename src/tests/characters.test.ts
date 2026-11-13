import {it,expect} from 'vitest';
import {characterLooks,characterLook,ZOMBIE_STYLE_OFFSET} from '../data/characters';
import {archetypes,GUEST_SPEED} from '../data/cafe';
import {Cafe} from '../core/simulation/cafe';
import {encodeSave,decodeSave} from '../platform/persistence';
it('旧IDを保ち22項目・33人の新規外見が保存後も対応する',()=>{
 expect(characterLooks.slice(0,3).map(v=>v.name)).toEqual(['配達員','常連客','整備士']);
 expect(new Set(characterLooks.slice(3).map(v=>v.category)).size).toBe(22);
 expect(characterLooks.at(-1)?.name).toBe('肉体労働者');
 for(let style=0;style<characterLooks.length;style++){
  expect(archetypes[style].name).toBe(characterLooks[style].name);
  expect(characterLook(style+ZOMBIE_STYLE_OFFSET)).toBe(characterLook(style));
  const c=new Cafe();c.staff.style=style;c.staff.name=archetypes[style].name;
  expect(decodeSave(encodeSave(c,1000)).cafe.staff.style).toBe(style);
 }
});
it('新規全種類が有限のゆっくりした速度で来店できる',()=>{
 const seen=new Set<number>();
 for(let seed=0;seed<250;seed++){
  const c=new Cafe(undefined,seed,'playtest');for(let i=0;i<21;i++)c.tick();
  const g=c.guests[0];expect(g).toBeDefined();seen.add(g.style);
  expect(g.speed).toBeGreaterThan(0);expect(g.speed).toBeLessThanOrEqual(GUEST_SPEED*1.15);
  for(let i=0;i<400;i++)c.tick();expect(Number.isFinite(g.fraction)).toBe(true);
 }
 expect(seen.size).toBe(characterLooks.length);
});
