"""Build-time Persian prompts; requires edge-tts. No learner audio is sent."""
import asyncio,json
from pathlib import Path
import edge_tts
OUT=Path(__file__).resolve().parent.parent/'public'/'voice'
PROMPTS={
 'setup':'ماهور، با کمک یک بزرگ‌تر، کلید دو را پیدا کن. همان کلید را سه بار، جدا جدا بزن. بین ضربه‌ها، کلید را کامل رها کن.',
 'listen':'اول گوش کن. شماره‌ها را نگاه کن. بعد نوبت تو می‌شود.',
 'your-turn':'حالا نوبت توست! دکمهٔ حالا من می‌زنم را بزن.',
 'complete':'آفرین ماهور! با تلاش خودت این تکه را تمام کردی. حالا یک نفس راحت بکش.',
 **{f'key-{i}':f'کلید شمارهٔ {word} را بزن و رها کن.' for i,word in enumerate(['یک','دو','سه','چهار','پنج','شش','هفت','هشت'],1)}
}
async def main():
 OUT.mkdir(exist_ok=True,parents=True)
 semaphore=asyncio.Semaphore(3)
 async def render(name,text):
  async with semaphore:
   await edge_tts.Communicate(text,'fa-IR-DilaraNeural',rate='-12%').save(str(OUT/f'{name}.mp3'))
   print(name,flush=True)
 await asyncio.gather(*(render(n,t) for n,t in PROMPTS.items()))
 (OUT/'transcripts.json').write_text(json.dumps(PROMPTS,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':asyncio.run(main())
