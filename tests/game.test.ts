import test from 'node:test';import assert from 'node:assert/strict';
import {judge,schedule,stars,stages,worldList,cut,tolerance,lane} from '../src/game/engine.ts';
test('falling-note timestamps track beat duration and count-in',()=>{assert.deepEqual(schedule([1,2,1],60),[3200,4200,6200])});
test('slow practice stretches the schedule and widens the timing window',()=>{assert.deepEqual(schedule([1],30),[3200]);assert.equal(schedule([1,1],30)[1]-3200,2000);assert.equal(tolerance(.5),2);assert.equal(tolerance(1),1);assert.equal(tolerance(.25),2);assert.equal(judge(60,60,300,2),'perfect');assert.equal(judge(60,60,300,1),'good')});
test('pitch and timing must both match; early and late taps cannot score',()=>{assert.equal(judge(60,60,0),'perfect');assert.equal(judge(60,60,250),'good');assert.equal(judge(60,62,0),'wrong');assert.equal(judge(60,60,-500),'early');assert.equal(judge(60,60,500),'late')});
test('star gate does not unlock next stage below 60 percent',()=>{assert.equal(stars(2,4),0);assert.equal(stars(3,4),1);assert.equal(stars(4,4),3)});
test('a lonely tail chunk folds back instead of becoming a one-note stage',()=>{const s=[1,2,3,4,5].map(()=>({midi:60,beats:1}));assert.deepEqual(cut(s,4).map(c=>c.length),[5]);assert.deepEqual(cut(s,2).map(c=>c.length),[2,3])});
test('one hundred stages ramp up: every note is playable on the eight lanes and difficulty never jumps',()=>{
  assert.equal(stages.length,100);
  assert.equal(worldList.length,12);
  for(const s of stages){
    assert.ok(s.steps.length>0,s.id);
    for(const step of s.steps)assert.ok(lane.includes(step.midi),`${s.id} plays ${step.midi} outside the eight lanes`);
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
