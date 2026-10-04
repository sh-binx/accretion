// Exercise the shipped adapter with a deterministic clock; no real ads requested.
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8')
const source=html.slice(html.indexOf('const PORTAL={'),html.indexOf('\nPORTAL.init()'))
for(const kind of ['midgame','rewarded']){
 let time=200000,seq=0,cb,done=0,rewards=0;const timers=new Map(),classes=new Set()
 const AU={muted:false,master:{gain:{value:.85}}}
 const ctx=vm.createContext({AU,AD_COOLDOWN:120000,Date:{now:()=>time},document:{body:{classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}}},setTimeout:(f,ms)=>{timers.set(++seq,{at:time+ms,f});return seq},clearTimeout:id=>timers.delete(id)})
 vm.runInContext(source+';globalThis.portal=PORTAL',ctx)
 const p=ctx.portal;p.kind='cg';p.lastAd=0;p.sdk={ad:{requestAd:(type,callbacks)=>cb=callbacks}}
 const advance=ms=>{const end=time+ms;for(;;){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;time=next[1].at;timers.delete(next[0]);next[1].f()}time=end}
 const request=()=>kind==='midgame'?p.midgameAd(()=>done++):p.rewardedAd(()=>rewards++,()=>done++)
 request();cb.adStarted();advance(30000)
 assert.equal(done,0,`${kind}: game must not resume during a 30 second ad`)
 assert.equal(AU.master.gain.value,0,`${kind}: audio must stay muted`)
 cb.adFinished();cb.adFinished();assert.equal(done,1);assert.equal(rewards,kind==='rewarded'?1:0);assert.equal(AU.master.gain.value,.85)
 advance(130000);request();cb.adStarted();cb.adError();assert.equal(done,2);assert.equal(rewards,kind==='rewarded'?1:0)
 advance(130000);request();advance(21000);assert.equal(done,3,'missing start callback must recover')
 console.log(`PASS ${kind}: long ad, completion once, error without reward, missing callback recovery`)
}
