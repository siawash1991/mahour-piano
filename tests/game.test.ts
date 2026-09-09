import test from 'node:test';import assert from 'node:assert/strict';
import {judge,schedule,stars,stages} from '../src/game/engine.ts';
test('falling-note timestamps track beat duration and count-in',()=>{assert.deepEqual(schedule([1,2,1],60),[3200,4200,6200])});
test('pitch and timing must both match; early and late taps cannot score',()=>{assert.equal(judge(60,60,0),'perfect');assert.equal(judge(60,60,250),'good');assert.equal(judge(60,62,0),'wrong');assert.equal(judge(60,60,-500),'early');assert.equal(judge(60,60,500),'late')});
test('star gate does not unlock next stage below 60 percent',()=>{assert.equal(stars(2,4),0);assert.equal(stars(3,4),1);assert.equal(stars(4,4),3);assert.ok(stages.length>10)});
