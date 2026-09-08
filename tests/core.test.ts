import test from 'node:test';
import assert from 'node:assert/strict';
import {detectPitch,frequency} from '../src/pitch.ts';
import {allLessons,lessons,songs} from '../src/curriculum.ts';
for(const rate of [44100,48000])for(const midi of [48,55,60,62,64,69,72,75,79])test(`YIN identifies MIDI ${midi} at ${rate}Hz with piano harmonics`,()=>{const f=frequency(midi);const a=Float32Array.from({length:4096},(_,i)=>.12*Math.sin(2*Math.PI*f*i/rate)+.045*Math.sin(4*Math.PI*f*i/rate)+.02*Math.sin(6*Math.PI*f*i/rate));const p=detectPitch(a,rate);assert.ok(p);assert.equal(p.midi,midi);assert.ok(Math.abs(1200*Math.log2(p.frequency/f))<10)});
test('silence and low-level input are not notes',()=>{assert.equal(detectPitch(new Float32Array(4096),48000),null);assert.equal(detectPitch(Float32Array.from({length:4096},(_,i)=>.001*Math.sin(i)),48000),null)});
test('curriculum has unique, valid exercises across six levels',()=>{assert.equal(new Set(allLessons.map(l=>l.id)).size,allLessons.length);assert.equal(new Set(lessons.map(l=>l.level)).size,6);assert.equal(songs.length,8);for(const l of allLessons){assert.ok(l.instructions.length>=3,l.id);assert.ok(l.steps.length>=4,l.id);for(const s of l.steps){assert.ok(s.midi>=36&&s.midi<=84);assert.ok(s.beats>0&&s.beats<=4)}}});
test('all songs credit their source and excerpts identify themselves',()=>{for(const l of songs)assert.ok(l.credit);assert.match(songs.find(l=>l.id==='fur-elise')!.credit!,/گزیده/)});
