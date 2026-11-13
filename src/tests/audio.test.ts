import {it,expect} from 'vitest';
import {renderEffect,soundLabels,type SoundId} from '../audio/effects';
import {SoundTracker} from '../audio/tracker';
import {Cafe} from '../core/simulation/cafe';
it('全14音が有限、非無音、ピーク上限内で両端にクリックがない',()=>{
 for(const id of Object.keys(soundLabels) as SoundId[])for(const rate of [22050,44100,48000]){
  const samples=renderEffect(id,rate);let peak=0,energy=0;
  for(const value of samples){expect(Number.isFinite(value)).toBe(true);peak=Math.max(peak,Math.abs(value));energy+=value*value;}
  expect(peak).toBeLessThanOrEqual(.65001);expect(energy/samples.length).toBeGreaterThan(.00001);
  expect(samples[0]).toBe(0);expect(samples.at(-1)).toBe(0);expect(samples.length/rate).toBeLessThanOrEqual(1.26);
 }
});
it('営業の実イベントを一度だけ通知し、復元・不在進行を鳴らさない',()=>{
 const c=new Cafe(undefined,2035,'playtest'),events:SoundId[]=[];const tracker=new SoundTracker(c,id=>events.push(id));
 tracker.update(c);expect(events).toEqual([]);
 c.autoStock=true;c.startCooking('moon-stew');
 for(let i=0;i<1200;i++){c.tick();tracker.update(c);}
 for(const id of ['cook','ready','plate','arrival','cash'])expect(events).toContain(id);
 expect(events.filter(x=>x==='cook')).toHaveLength(1);expect(events.filter(x=>x==='ready')).toHaveLength(1);
 const before=events.length;c.advanceOffline(180000);tracker.update(c);expect(events).toHaveLength(before);
 tracker.reset(c);tracker.update(c);expect(events).toHaveLength(before);
 c.toggleOpen();tracker.update(c);tracker.update(c);expect(events.at(-1)).toBe('door');expect(events).toHaveLength(before+1);
});
