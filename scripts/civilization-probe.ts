import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { newCivilizationWorld, newJournal, tickWorld, applyRuling, fingerprint, replay, JournalSchema, type Journal } from "@abs/world";
import { localPolicy } from "../packages/world/src/local-policy.js";
import { atomicWrite } from "./world-storage.js";

const policyPath=resolve("packages/world/src/local-policy.ts");
const digest=`sha256:${createHash("sha256").update(readFileSync(policyPath,"utf8").replaceAll("\r\n","\n")).digest("hex")}`;
const rows: unknown[]=[];
let demonstration: Journal | undefined;
for (const seed of [42,7,12,21,33,56,77,99,123,256,512,1024]) {
  const origin=newCivilizationWorld(["amber","azure","crimson","verdant"],seed);
  let world=origin;
  const journal=newJournal(origin,1,{mode:"SCRIPTED_NO_REMOTE_MODEL",fixtureDigest:digest});
  const events=new Map<string,number>();
  for(let i=0;i<300;i++) {
    const result=tickWorld(world);world=result.world;
    for(const event of result.events) events.set(event.kind,(events.get(event.kind)??0)+1);
    if(world.tick%8===0) for(const civ of world.civs) if(civ.fellOnTick===null) {
      const ruling=localPolicy(world,civ);journal.rulings.push(ruling);world=applyRuling(world,ruling);
    }
    for(const civ of world.civs) {
      const army=world.simulation!.units.filter(u=>u.owner===civ.id&&u.role==="soldier").reduce((s,u)=>s+u.strength,0);
      if(army!==civ.soldiers||Object.values(civ.stock).some(n=>!Number.isFinite(n)||n<0)) throw new Error(`invariant failed seed ${seed} year ${world.tick}`);
    }
  }
  journal.livedTo=world.tick;journal.fingerprint=fingerprint(world);
  const parsed=JournalSchema.parse(JSON.parse(JSON.stringify(journal)));
  if(fingerprint(replay(parsed.origin,parsed.rulings,parsed.livedTo).world)!==journal.fingerprint) throw new Error(`replay mismatch seed ${seed}`);
  rows.push({seed,alive:world.civs.filter(c=>c.fellOnTick===null).length,population:world.civs.reduce((n,c)=>n+c.population,0),cities:world.simulation!.cities.length,units:world.simulation!.units.length,technologies:world.civs.reduce((n,c)=>n+c.advances.length,0),expansions:events.get("EXPANDED")??0,wars:events.get("WAR")??0,conquests:events.get("SEIZED")??0,famines:events.get("STARVED")??0,replay:"verified"});
  if(seed===42) demonstration=journal;
}
console.table(rows);
atomicWrite(resolve("docs/reports/civilization-w10-probe.json"),JSON.stringify(rows,null,2)+"\n");
if(process.argv.includes("--publish")) {
  const path="worlds/civilization-w10/era-0001.json";
  atomicWrite(resolve("apps/player/public",path),JSON.stringify(demonstration,null,2)+"\n");
  atomicWrite(resolve(path),JSON.stringify(demonstration,null,2)+"\n");
  const indexPath=resolve("apps/player/public/worlds/index.json");
  const index=existsSync(indexPath)?JSON.parse(readFileSync(indexPath,"utf8")):[];
  const final=replay(demonstration!.origin,demonstration!.rulings,demonstration!.livedTo).world;
  const survivors=final.civs.filter(c=>c.fellOnTick===null);
  const catalogue=JSON.stringify([{path,world:"civilization-w10",era:1,livedTo:300,rulings:demonstration!.rulings.length,alive:survivors.length,over:survivors.length<=1,survivor:survivors.length===1?survivors[0]!.id:null,worldVersion:"w10",seed:42},...index.filter((w:{path:string})=>w.path!==path)],null,2)+"\n";
  atomicWrite(indexPath,catalogue);
  atomicWrite(resolve("worlds/index.json"),catalogue);
  console.log(`Local policy demonstration published: ${path} (no remote AI calls).`);
}
