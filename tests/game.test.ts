import test from 'node:test';import assert from 'node:assert/strict';
import {judge,schedule,stars,stages,worldList,cut,tolerance,board,keyLabel,isWhite,match,windowFor,WINDOW,PERFECT} from '../src/game/engine.ts';
test('falling-note timestamps track beat duration and count-in',()=>{assert.deepEqual(schedule([1,2,1],60),[3200,4200,6200])});
test('slow practice stretches the schedule and widens the timing window',()=>{assert.deepEqual(schedule([1],30),[3200]);assert.equal(schedule([1,1],30)[1]-3200,2000);assert.equal(tolerance(.5),2);assert.equal(tolerance(1),1);assert.equal(tolerance(.25),2);assert.equal(judge(60,60,300,2),'perfect');assert.equal(judge(60,60,300,1),'good')});
test('pitch and timing must both match; early and late taps cannot score',()=>{
  assert.equal(judge(60,60,0),'perfect');
  assert.equal(judge(60,60,PERFECT),'perfect');
  assert.equal(judge(60,60,PERFECT+1),'good');
  assert.equal(judge(60,62,0),'wrong');
  assert.equal(judge(60,60,-(WINDOW+1)),'early');
  assert.equal(judge(60,60,WINDOW+1),'late');
});
test('star gate does not unlock next stage below 60 percent',()=>{assert.equal(stars(2,4),0);assert.equal(stars(3,4),1);assert.equal(stars(4,4),3)});
test('a lonely tail chunk folds back instead of becoming a one-note stage',()=>{const s=[1,2,3,4,5].map(()=>({midi:60,beats:1}));assert.deepEqual(cut(s,4).map(c=>c.length),[5]);assert.deepEqual(cut(s,2).map(c=>c.length),[2,3])});
test('the keyboard strip always starts at middle C, covers the stage, and reads like a piano',()=>{
  assert.deepEqual([60,61,62,67,68,72,74,75,79].map(keyLabel),['۱','۱♯','۲','۵','۵♯','۸','۹','۹♯','۱۲']);
  for(const s of stages){
    const keys=board(s.steps);
    assert.equal(keys[0].midi,60,s.id);
    for(const step of s.steps)assert.ok(keys.some(k=>k.midi===step.midi),`${s.id} plays ${step.midi} off the strip`);
    assert.ok(keys.filter(k=>k.white).length>=8,s.id);
    // White keys tile the full width edge to edge; black keys sit on the seams between them.
    const white=keys.filter(k=>k.white);
    assert.equal(Math.round(white[0].left),0);
    assert.equal(Math.round(white.at(-1)!.left+white.at(-1)!.width),100);
    for(let i=1;i<white.length;i++)assert.ok(Math.abs(white[i].left-(white[i-1].left+white[i-1].width))<1e-9,s.id);
    for(const k of keys.filter(k=>!k.white))assert.ok(k.width<white[0].width&&!isWhite(k.midi));
  }
});
test('the two hardest songs are reachable: high keys and black keys both appear',()=>{
  assert.ok(stages.some(s=>s.steps.some(x=>x.midi>72)),'no stage ever leaves the first octave');
  assert.ok(stages.some(s=>s.steps.some(x=>!isWhite(x.midi))),'no stage ever uses a black key');
  assert.ok(stages.some(s=>s.id==='concert-birthday')&&stages.some(s=>s.id==='concert-fur-elise'));
});
test('one hundred stages ramp up and difficulty never jumps',()=>{
  assert.equal(stages.length,100);
  assert.equal(worldList.length,14);
  for(const s of stages){
    assert.ok(s.steps.length>0,s.id);
  }
  // The opening stages stay tiny and slow, and no stage more than doubles its predecessor's note count.
  assert.ok(stages[0].steps.length<=4&&stages[0].bpm<=50);
  for(let i=1;i<10;i++)assert.ok(stages[i].steps.length<=8,`early stage ${i+1} too long`);
  // No stage may throw more notes at the child than four times the longest phrase already unlocked.
  let longest=0;
  for(const s of stages){
    assert.ok(s.steps.length<=Math.max(6,longest*4),`${s.id} jumps from ${longest} to ${s.steps.length} notes`);
    longest=Math.max(longest,s.steps.length);
  }
});

const pending=(...n:[number,number][])=>n.map(([at,midi],index)=>({index,at,midi}));
test('a correct note is scored against the note it matches, not the one nearest in time',()=>{
  // The child let the first note go by and plays the second one correctly, still inside its window.
  const notes=pending([1000,60],[1400,64]);
  const m=match(64,notes,1400,WINDOW);
  assert.equal(m.matched,true);
  assert.equal(m.pick!.index,1,'a correct note must not be blamed on the note already missed');
});
test('the exact pitch wins over the same note an octave away',()=>{
  const notes=pending([1000,72],[1050,60]);
  const m=match(72,notes,1000,WINDOW);
  assert.equal(m.pick!.index,0);
  assert.equal(m.octave,0);
});
test('the right note an octave out still counts, and reports the shift',()=>{
  const m=match(72,pending([1000,60]),1000,WINDOW);
  assert.equal(m.matched,true);
  assert.equal(m.octave,12);
  const down=match(48,pending([1000,60]),1000,WINDOW);
  assert.equal(down.matched,true);
  assert.equal(down.octave,-12);
});
test('a genuinely wrong note is blamed on the nearest note still waiting',()=>{
  const m=match(65,pending([1000,60],[1600,64]),1050,WINDOW);
  assert.equal(m.matched,false);
  assert.equal(m.pick!.index,0);
});
test('a correct pitch outside every window is not a free hit',()=>{
  const m=match(60,pending([1000,60]),1000+WINDOW+1,WINDOW);
  assert.equal(m.matched,false);
});
test('nothing left to play matches nothing',()=>{
  assert.equal(match(60,[],1000,WINDOW).pick,undefined);
});
test('slow practice widens the window that both the judge and the matcher use',()=>{
  assert.equal(windowFor(2),WINDOW*2);
  assert.equal(match(60,pending([1000,60]),1000+WINDOW+200,windowFor(2)).matched,true);
  assert.equal(judge(60,60,WINDOW+200,2),'good');assert.equal(judge(60,60,PERFECT*2,2),'perfect');
});

import {resolve,readTuning,saveTuning,TUNING_KEYS,LIMIT} from '../src/game/tuning.ts';
test('tuning takes the middle reading, so one misheard note cannot drag the result',()=>{
  assert.equal(resolve(TUNING_KEYS,TUNING_KEYS),0);
  assert.equal(resolve(TUNING_KEYS,TUNING_KEYS.map(n=>n-12)),-12);
  assert.equal(resolve(TUNING_KEYS,TUNING_KEYS.map(n=>n+12)),12);
  // middle reading wins over a single neighbour-key slip
  assert.equal(resolve(TUNING_KEYS,[60,65,67]),0);
  assert.equal(resolve(TUNING_KEYS,[72,77,79]),12);
  // a reading a whole fourth out is disagreement, not a slip, and must not be smoothed over
  assert.equal(resolve(TUNING_KEYS,[72,73,72]),null);
});
test('readings that disagree are refused rather than averaged into a number fitting none',()=>{
  assert.equal(resolve(TUNING_KEYS,[60,71,67]),null);
  assert.equal(resolve(TUNING_KEYS,[48,64,79]),null);
  assert.equal(resolve(TUNING_KEYS,[60,64]),null);
  assert.equal(resolve(TUNING_KEYS,[]),null);
  assert.equal(resolve(TUNING_KEYS,TUNING_KEYS.map(n=>n+LIMIT+12)),null);
});
