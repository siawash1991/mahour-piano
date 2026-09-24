import test from 'node:test';import assert from 'node:assert/strict';
import {units,allLessons} from '../src/lessons/journey.ts';
import {songs} from '../src/curriculum.ts';
import {stages} from '../src/game/engine.ts';
import {parseRhythm,judgeTaps} from '../src/lessons/rhythm.ts';
import {harmonize} from '../src/lessons/harmony.ts';
test('twelve units; every lesson is short, unique, and ends in a real song',()=>{
  assert.equal(units.length,12);
  assert.equal(new Set(allLessons.map(l=>l.id)).size,allLessons.length);
  for(const l of allLessons){
    assert.ok(l.activities.length>=2&&l.activities.length<=6,l.id);
    assert.equal(l.activities.at(-1)!.kind,'song',`${l.id} does not end in a song`);
  }
});
test('every song a lesson asks for exists and can be played as a whole-song stage',()=>{
  for(const l of allLessons)for(const a of l.activities)if(a.kind==='song')for(const id of a.songs){
    assert.ok(songs.some(s=>s.id===id),`${l.id}: unknown song ${id}`);
    assert.ok(stages.some(s=>s.song===id&&s.id.endsWith('-all')),`${l.id}: no stage for ${id}`);
  }
});
test('sound before symbol: no reading before unit seven, no staff before unit nine',()=>{
  units.forEach((u,i)=>u.lessons.forEach(l=>l.activities.forEach(a=>{
    if(a.kind==='read')assert.ok(i>=6,l.id);
    if(a.kind==='read'&&a.staff)assert.ok(i>=8,l.id);
  })));
});
test('rhythm words become beats: راه, دو-دو, وایسا, هیس',()=>{
  const r=parseRhythm('qeehr');
  assert.deepEqual(r.onsets,[0,1,1.5,2]);
  assert.equal(r.beats,5);
  assert.deepEqual(r.cards.map(c=>c.kind),['q','e','h','r']);
});
test('taps count when each lands near its beat; one stray tap is forgiven, two are not',()=>{
  const on=[0,1,2,3];
  assert.equal(judgeTaps(on,[0.1,0.95,2.2,3],0.3).ok,true);
  assert.equal(judgeTaps(on,[0.1,0.95,2.6,3],0.3).ok,false);
  assert.equal(judgeTaps(on,[0,1,2,3,3.5],0.3).ok,true);
  assert.equal(judgeTaps(on,[0,0.5,1,2,2.5,3],0.3).ok,false);
});
test('the band picks home chords: Twinkle opens on C, moves to F, and ends on C',()=>{
  const c=harmonize(songs.find(s=>s.id==='twinkle')!.steps);
  assert.equal(c[0].root,0);
  assert.ok(c.some(x=>x.root===5));
  assert.equal(c.at(-1)!.root,0);
  // black-key songs are in F♯, not forced into C
  assert.equal(harmonize(songs.find(s=>s.id==='bk-crows')!.steps).at(-1)!.root,6);
});
