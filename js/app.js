// Liftlog app: state, storage, views and events.
(() => {
"use strict";
/* ---------- exercise library ---------- */
const LIB = [
 ["Barbell Back Squat","Legs",1],["Front Squat","Legs",1],["Romanian Deadlift","Hamstrings",1],["Deadlift","Back",1],
 ["Barbell Bench Press","Chest",1],["Incline Barbell Bench Press","Chest",1],["Overhead Press","Shoulders",1],["Barbell Row","Back",1],
 ["Hip Thrust","Glutes",1],["Incline Dumbbell Press","Chest",0],["Dumbbell Shoulder Press","Shoulders",0],["Dumbbell Row","Back",0],
 ["Lat Pulldown","Back",0],["Pull-up","Back",0],["Seated Cable Row","Back",0],["Goblet Squat","Legs",0],["Leg Press","Legs",0],
 ["Walking Lunge","Legs",0],["Bulgarian Split Squat","Legs",0],["Leg Curl","Hamstrings",0],["Leg Extension","Quads",0],
 ["Standing Calf Raise","Calves",0],["Dumbbell Lateral Raise","Shoulders",0],["Face Pull","Shoulders",0],["Dumbbell Curl","Arms",0],
 ["Triceps Pushdown","Arms",0],["Dips","Chest",0],["Push-up","Chest",0],["Kettlebell Swing","Full body",0],
 ["Hanging Knee Raise","Core",0],["Cable Crunch","Core",0],["Farmer's Carry","Full body",0]
];
const LIBMAP = Object.fromEntries(LIB.map(([n,m,b])=>[n.toLowerCase(),{name:n,muscle:m,barbell:!!b}]));
const isBarbell = (ex) => ex.barbell ?? !!LIBMAP[(ex.name||"").toLowerCase()]?.barbell;
const ytSearch = (name) => "https://www.youtube.com/results?search_query=" + encodeURIComponent("how to " + name + " proper form");
const videosFor = (ex) => Array.isArray(ex.videos)&&ex.videos.length ? ex.videos.filter(v=>/^https?:\/\//i.test(v.url)) : [{label:"",url:videoFor(ex)}];
const vidLinks = (ex,word) => videosFor(ex).map(v=>`<a class="vid" href="${esc(v.url)}" target="_blank" rel="noopener">▶ ${esc(v.label||word)}</a>`).join("");
const videoFor = (ex) => (ex.video && /^https?:\/\//i.test(ex.video)) ? ex.video : ytSearch(ex.name);

const wu=(name,video,min)=>({name,video:video||"",...(min?{min}:{})});
const WALK=()=>wu("Walk","",10), INCLINE=()=>[wu("Incline Walk","",30)];
const xx=(name,sets,reps,rest,video,videos)=>({name,sets,reps,rest,video,...(videos?{videos}:{})});
const STARTER = [];

/* ---------- helpers ---------- */
const $ = (s,el=document)=>el.querySelector(s);
const esc = (s)=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid = (p)=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const clone = (o)=>JSON.parse(JSON.stringify(o));
const num = (v)=>{const n=parseFloat(String(v).replace(",","."));return isFinite(n)?n:0};
const fmtKg = (n)=> (Math.round(n*10)/10).toLocaleString("en-GB")+" kg";
const fmtBig = (n)=> n>=10000 ? (Math.round(n/100)/10)+"k" : Math.round(n).toLocaleString("en-GB");
const e1rm = (w,r)=> r<=0||w<=0 ? 0 : (r===1? w : w*(1+r/30));
const dfmt = (d,o={day:"numeric",month:"short"})=> new Date(d).toLocaleDateString("en-GB",o);
const mmss = (s)=>{s=Math.max(0,Math.round(s));return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")};
const weekStart = (d)=>{const x=new Date(d);x.setHours(0,0,0,0);const k=(x.getDay()+6)%7;x.setDate(x.getDate()-k);return x};
const ls = {
  get(k,f){try{const v=localStorage.getItem(k);return v?JSON.parse(v):f}catch{return f}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}},
  del(k){try{localStorage.removeItem(k)}catch{}}
};
function toast(msg){const t=document.createElement("div");t.className="toast";t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),2200)}
function armed(btn,fn){ // two-tap confirm
  if(btn.classList.contains("armed")){fn();return}
  const old=btn.textContent;btn.classList.add("armed");btn.textContent="Tap again to confirm";
  setTimeout(()=>{if(btn.isConnected){btn.classList.remove("armed");btn.textContent=old}},3000);
}

/* ---------- state + storage ---------- */
const S = {mode:"pending", routines:null, sessions:[], body:[], measures:[], measKey:"waist", active:ls.get("liftlog.active",null), tab:"train", progEx:null};
const Store = {
  db:null, uid:null,
  async init(){
    let db=null,user=null;
    try{ if(window.claude?.use){ [db,user]=await Promise.all([window.claude.use("db"),window.claude.use("user")]); } }catch{}
    let id=null; try{ id = user ? await user.id() : null }catch{}
    if(db && id){
      this.db=db; this.uid=id; try{ S.isOwner=!!(await user.isOwner()) }catch{ S.isOwner=false } S.mode="cloud";
      const base="data/users/"+id;
      db.doc(base+"/routines").onSnapshot(s=>{S.routines = s.exists ? (s.data().list||[]) : null; render()}, ()=>{});
      db.doc(base+"/measures").onSnapshot(s=>{S.measures = s.exists ? (s.data().entries||[]) : []; render()}, ()=>{});
      db.doc(base+"/body").onSnapshot(s=>{S.body = s.exists ? (s.data().entries||[]) : []; render()}, ()=>{});
      db.doc(base+"/profile").collection("sessions").orderBy("date","desc").limit(1000)
        .onSnapshot(q=>{S.sessions=q.docs.map(d=>d.data()); render()}, ()=>{});
    } else {
      S.mode="local"; S.routines=ls.get("liftlog.routines",null); S.sessions=ls.get("liftlog.sessions",[]); S.body=ls.get("liftlog.body",[]); S.measures=ls.get("liftlog.measures",[]);
    }
    render();
  },
  async err(e){ toast(e?.code==="invalid_argument" ? "You can only view this app, not save to it" : "Couldn't save. Check your connection and try again."); },
  async saveRoutines(list){
    S.routines=list; render();
    if(S.mode==="cloud"){ try{ await this.db.doc("data/users/"+this.uid+"/routines").set({list}) }catch(e){this.err(e)} }
    else ls.set("liftlog.routines",list);
  },
  async saveSession(s){
    S.sessions=[s,...S.sessions.filter(x=>x.id!==s.id)].sort((a,b)=>b.date.localeCompare(a.date)); render();
    if(S.mode==="cloud"){ try{ await this.db.doc("data/users/"+this.uid+"/profile").collection("sessions").doc(s.id).set(s) }catch(e){this.err(e)} }
    else ls.set("liftlog.sessions",S.sessions);
  },
  async deleteSession(id){
    S.sessions=S.sessions.filter(x=>x.id!==id); render();
    if(S.mode==="cloud"){ try{ await this.db.doc("data/users/"+this.uid+"/profile").collection("sessions").doc(id).delete() }catch(e){this.err(e)} }
    else ls.set("liftlog.sessions",S.sessions);
  },
  async saveBody(entries){
    S.body=entries; render();
    if(S.mode==="cloud"){ try{ await this.db.doc("data/users/"+this.uid+"/body").set({entries}) }catch(e){this.err(e)} }
    else ls.set("liftlog.body",entries);
  },
  async saveMeasures(entries){
    S.measures=entries; render();
    if(S.mode==="cloud"){ try{ await this.db.doc("data/users/"+this.uid+"/measures").set({entries}) }catch(e){this.err(e)} }
    else ls.set("liftlog.measures",entries);
  }
};
const MEAS=[["waist","Waist"],["chest","Chest"],["arm","Arm"],["hips","Hips"],["thigh","Thigh"]];
const routines = ()=> S.routines ?? [];
let draftTimer; const saveDraft = ()=>{clearTimeout(draftTimer);draftTimer=setTimeout(()=>ls.set("liftlog.active",S.active),300)};

/* last performance of an exercise */
function lastSets(name){
  const n=name.toLowerCase();
  for(const s of S.sessions){ const ex=s.exercises.find(e=>e.name.toLowerCase()===n); if(ex&&ex.sets.length) return ex.sets; }
  return null;
}

/* ---------- plates ---------- */
const PLATES=[[25,"--p25"],[20,"--p20"],[15,"--p15"],[10,"--p10"],[5,"--p5"],[2.5,"--p25s"],[1.25,"--p125"]];
const PH={25:16,20:16,15:14,10:12,5:10,2.5:8,1.25:7};
function platesHtml(w){
  w=num(w); if(w<=20) return "";
  let side=(w-20)/2, out="";
  for(const [p,c] of PLATES){ while(side>=p-1e-6){ out+=`<span class="plate" style="height:${PH[p]}px;background:var(${c})" title="${p} kg"></span>`; side-=p; } }
  return out;
}

/* ---------- workout ---------- */
function startWorkout(r){
  S.active={routineId:r?.id||null,name:r?.name||"Quick workout",startedAt:Date.now(),
    warmup:(r?.warmup||[]).map(w=>({...w,done:false})),cardio:(r?.cardio||[]).map(w=>({...w,done:false})),exercises:(r?.exercises||[]).map(buildEx)};
  saveDraft(); try{navigator.wakeLock?.request("screen").catch(()=>{})}catch{}
  location.hash="#train"; render(); window.scrollTo(0,0);
}
function buildEx(e){
  const prev=lastSets(e.name)||[]; const n=Math.max(1,parseInt(e.sets)||3);
  const defR=parseInt(String(e.reps||"").split("-").pop())||"";
  return {name:e.name,reps:e.reps||"",rest:+e.rest||90,video:e.video||"",videos:e.videos||null,barbell:e.barbell,
    sets:Array.from({length:n},(_,i)=>{const p=prev[i]||prev[prev.length-1];return {w:p?p.w:"",r:p?p.r:defR,done:false,prev:p?`${p.w}×${p.r}`:""}})};
}
function finishWorkout(){
  const a=S.active; if(!a) return;
  const exercises=a.exercises.map(e=>({name:e.name,sets:e.sets.filter(s=>s.done&&num(s.r)>0).map(s=>({w:num(s.w),r:num(s.r)}))})).filter(e=>e.sets.length);
  if(!exercises.length){toast("Tick at least one set before finishing");return}
  const vol=exercises.reduce((t,e)=>t+e.sets.reduce((u,s)=>u+s.w*s.r,0),0);
  const s={id:uid("s"),date:new Date(a.startedAt).toISOString(),name:a.name,routineId:a.routineId,
    minutes:Math.max(1,Math.round((Date.now()-a.startedAt)/60000)),volume:Math.round(vol),exercises};
  S.active=null; ls.del("liftlog.active"); stopRest();
  Store.saveSession(s); toast("Workout saved"); location.hash="#history";
}

/* ---------- rest timer ---------- */
const R={end:0,total:0,iv:null,label:"",beeped:false}; let actx=null;
function startRest(sec,label,activity){
  try{actx=actx||new (window.AudioContext||window.webkitAudioContext)()}catch{}
  R.total=sec;R.end=Date.now()+sec*1000;R.label=label;R.act=!!activity;R.beeped=false;$("#rest").hidden=false;
  clearInterval(R.iv);R.iv=setInterval(tickRest,250);tickRest();
}
function tickRest(){
  const left=(R.end-Date.now())/1000, over=left<=0;
  $("#restTime").textContent=over?"+"+mmss(-left):mmss(left);
  $("#restLbl").textContent=over?(R.act?R.label+" done":"Rest done · next set"):(R.act?R.label:"Rest · "+R.label);
  $("#restBar").style.width=Math.min(100,(1-Math.max(0,left)/R.total)*100)+"%";
  $("#rest").classList.toggle("over",over);
  if(over&&!R.beeped){R.beeped=true;beep();try{navigator.vibrate?.([200,100,200])}catch{}}
  if(left<-(R.act?120:60)) stopRest();
}
function stopRest(){clearInterval(R.iv);$("#rest").hidden=true}
function beep(){ if(!actx) return; try{ [0,.25,.5].forEach(t=>{const o=actx.createOscillator(),g=actx.createGain();o.frequency.value=880;o.connect(g);g.connect(actx.destination);g.gain.setValueAtTime(.0001,actx.currentTime+t);g.gain.exponentialRampToValueAtTime(.3,actx.currentTime+t+.02);g.gain.exponentialRampToValueAtTime(.0001,actx.currentTime+t+.18);o.start(actx.currentTime+t);o.stop(actx.currentTime+t+.2)}) }catch{} }
$("#restSkip").onclick=stopRest;
$("#restPlus").onclick=()=>{R.end+=15000;R.total+=15;R.beeped=false;tickRest()};
$("#restMinus").onclick=()=>{R.end-=15000;tickRest()};

/* ---------- views ---------- */
const PASTE_HELP=`Paste the plan exactly as your coach sent it. Start each day with “Day 1”, “Day 2”…, put warm-ups under “Warm-up”, exercises under “Workout” and cardio under “Cool down”. One exercise per line, with its YouTube link. Add “4x10” or “10 min” to set sets, reps or minutes.`;
function pasteCard(){ return `<div class="card stack">
    <div><h3>Load your workout plan</h3><p class="muted" style="margin:4px 0 0;font-size:14px">${PASTE_HELP}</p></div>
    <textarea id="planText" rows="9" class="field" style="width:100%;min-height:200px;flex-shrink:0;font-family:var(--body);font-size:14px;resize:vertical" placeholder="DAY 01&#10;WARM-UP&#10;1. Band Pull-Apart - https://youtu.be/…&#10;WORKOUT&#10;1. Smith Machine Bench Press 4x8 - https://youtu.be/…"></textarea>
    <div id="planPreview"></div>
    <label class="row" style="flex-wrap:nowrap;font-size:14px;cursor:pointer"><input type="checkbox" id="addWalks" ${routines().some(r=>(r.warmup||[]).some(w=>w.name==="Walk"))?"checked":""} style="width:20px;height:20px;accent-color:var(--accent)"><span>Also add a 10-min walk before and a 30-min incline walk after each day</span></label>
    <button class="btn primary" data-parse="replace">Read plan</button></div>`; }
function planPreview(res){
  if(!res.routines.length) return `<div class="empty" style="padding:12px">No exercises found. Check that each exercise is on its own line.</div>`;
  const ex=res.routines.reduce((t,r)=>t+r.exercises.length,0);
  return `<div class="card stack" style="gap:6px;background:var(--bg)"><div class="eyebrow">Found ${res.routines.length} day${res.routines.length>1?"s":""} · ${ex} exercises</div>
    ${res.routines.map(r=>`<div style="font-size:14px"><b>${esc(r.name)}</b> <span class="muted">· ${r.warmup.length?r.warmup.length+" warm-up · ":""}${r.exercises.length} exercises${r.cardio.length?" · "+r.cardio.length+" cardio":""}</span>
      <div class="muted" style="font-size:12px">${r.exercises.map(e=>esc(e.name)+" "+e.sets+"×"+esc(e.reps)).join(" · ")}</div></div>`).join("")}
    <p class="muted" style="margin:0;font-size:12px">Sets and reps not given in the text are filled with sensible defaults. Change them later with Edit.</p></div>`;
}
let parsedPlan=null;
function applyPlan(mode){
  if(!parsedPlan||!parsedPlan.routines.length) return;
  const walks=!!($("#addWalks2")||$("#addWalks"))?.checked;
  const fresh=parsedPlan.routines.map(r=>{ const x={...r,id:uid("r"),plan:planName(r.note)};
    if(walks){ if(!x.warmup.some(w=>/^walk/i.test(w.name))) x.warmup=[WALK(),...x.warmup]; if(!x.cardio.some(w=>/incline walk/i.test(w.name))) x.cardio=[...INCLINE(),...x.cardio]; }
    return x; });
  Store.saveRoutines(mode==="add"?[...routines(),...fresh]:fresh); parsedPlan=null;
  const h=$("#sheetHost"); h.innerHTML=""; h.onclick=null; toast(`Loaded ${fresh.length} workout day${fresh.length>1?"s":""}`); location.hash="#train";
}
function openPaste(){
  const host=$("#sheetHost"); parsedPlan=null;
  host.innerHTML=`<div class="sheet-bg" id="sheetBg"><div class="sheet stack" role="dialog" aria-label="Paste a plan">
    <div class="spread"><h2>Paste a plan</h2><button class="btn ghost" data-close>Close</button></div>
    <p class="muted" style="margin:0;font-size:14px">${PASTE_HELP}</p>
    <textarea id="planText2" rows="10" class="field" style="width:100%;min-height:200px;flex-shrink:0;font-family:var(--body);font-size:14px;resize:vertical"></textarea>
    <div id="planPreview2"></div>
    <label class="row" style="flex-wrap:nowrap;font-size:14px;cursor:pointer"><input type="checkbox" id="addWalks2" ${routines().some(r=>(r.warmup||[]).some(w=>w.name==="Walk"))?"checked":""} style="width:20px;height:20px;accent-color:var(--accent)"><span>Also add a 10-min walk before and a 30-min incline walk after each day</span></label>
    <button class="btn" data-parse2>Read plan</button>
    <div class="row" id="planApply" hidden><button class="btn primary" data-apply="replace" style="flex:1">Replace my routines</button><button class="btn" data-apply="add" style="flex:1">Add to my routines</button></div>
  </div></div>`;
  host.onclick=ev=>{ const t=ev.target.closest("button")||ev.target;
    if(t.id==="sheetBg"||t.dataset.close!==undefined){host.innerHTML="";host.onclick=null;return}
    if(t.dataset.parse2!==undefined){ parsedPlan=parsePlan($("#planText2").value); $("#planPreview2").innerHTML=planPreview(parsedPlan); $("#planApply").hidden=!parsedPlan.routines.length; return }
    if(t.dataset.apply){ const b=t; if(b.dataset.apply==="replace"&&routines().length){ armed(b,()=>applyPlan("replace")); return } applyPlan(b.dataset.apply) }
  };
}
function viewTrain(){
  const a=S.active;
  const act=routines().filter(r=>!r.expired);
  if(!a&&!act.length){
    if(S.mode==="pending") return `<div class="empty">Loading your plan…</div>`;
    if(routines().length) return `<div class="stack"><div><div class="eyebrow">No active plan</div><h1>All your plans are expired</h1>
      <p class="muted" style="margin:4px 0 0">Make one active again on the <a href="#routines">Routines</a> tab, or paste your new plan below.</p></div>${pasteCard()}
      <button class="btn ghost block" data-start="">Or start an empty workout</button></div>`;
    return `<div class="stack"><div><div class="eyebrow">Welcome</div><h1>Let's set up your plan</h1></div>${pasteCard()}
      <button class="btn ghost block" data-start="">Or start an empty workout</button></div>`;
  }
  if(!a){
    const last=S.sessions[0];
    const ws=weekStart(new Date()); const thisWeek=S.sessions.filter(s=>new Date(s.date)>=ws).length;
    const doneIds=new Set(S.sessions.filter(x=>new Date(x.date)>=ws&&x.routineId).map(x=>x.routineId));
    const doneR=act.filter(r=>doneIds.has(r.id)), todo=act.filter(r=>!doneIds.has(r.id));
    const pct=act.length?Math.round(doneR.length/act.length*100):0;
    const wkEnd=new Date(ws); wkEnd.setDate(wkEnd.getDate()+6);
    const shown=S.showDone?act:todo;
    return `<div class="stack">
      <div><div class="eyebrow">${dfmt(new Date(),{weekday:"long",day:"numeric",month:"long"})}</div>
      <h1>${todo.length?"Pick today's session":"Week complete"}</h1>
      <p class="muted" style="margin:4px 0 0">${thisWeek} workout${thisWeek===1?"":"s"} this week${last?` · last: ${esc(last.name)}, ${dfmt(last.date,{weekday:"short",day:"numeric",month:"short"})}`:""}</p></div>
      <section class="card stack wk" style="gap:10px" aria-label="This week's progress">
        <div class="spread"><div><div class="eyebrow">This week · ${dfmt(ws)}–${dfmt(wkEnd)}</div>
          <div style="font-size:15px;margin-top:2px"><b class="num">${doneR.length} of ${act.length}</b> workout days done</div></div>
          <div class="wk-pct num" style="color:${pct===100?"var(--good)":"var(--ink)"}">${pct}%</div></div>
        <div class="wk-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><b style="width:${pct}%;background:var(--good)"></b></div>
        <div class="chips">${act.map(r=>`<span class="chip" style="${doneIds.has(r.id)?"background:var(--good-soft);color:var(--good);font-weight:600":""}">${doneIds.has(r.id)?"✓ ":""}${esc(r.name.split(" · ")[0])}</span>`).join("")}</div>
        ${!todo.length?`<p class="muted" style="margin:0;font-size:14px">Every session is done for this week. Nice work! They’ll be back on Monday.</p>`:""}
      </section>
      ${shown.map((r,i,all)=>`${i===0||planOf(all[i-1])!==planOf(r)?`<div class="eyebrow" style="margin-top:${i?10:0}px">${esc(planOf(r))}</div>`:""}<div class="card routine">
        <div style="min-width:0"><h3>${esc(r.name)}${doneIds.has(r.id)?` <span class="chip" style="background:var(--good-soft);color:var(--good);font-family:var(--body);font-size:11px;vertical-align:middle">Done</span>`:""}</h3><div class="meta">${r.exercises.length} exercises${r.note&&r.note!==r.plan?` · ${esc(r.note)}`:""}</div>
        <div class="chips" style="margin-top:8px">${r.exercises.slice(0,4).map(e=>`<span class="chip">${esc(e.name)}</span>`).join("")}${r.exercises.length>4?`<span class="chip">+${r.exercises.length-4}</span>`:""}</div></div>
        <button class="btn ${doneIds.has(r.id)?"":"primary"}" data-start="${esc(r.id)}">${doneIds.has(r.id)?"Again":"Start"}</button></div>`).join("")}
      ${doneR.length?`<button class="btn ghost block" id="toggleDone">${S.showDone?"Hide":"Show"} ${doneR.length} done this week</button>`:""}
      <button class="btn block" data-start="">Start an empty workout</button>
    </div>`;
  }
  const done=a.exercises.reduce((t,e)=>t+e.sets.filter(s=>s.done).length,0), all=a.exercises.reduce((t,e)=>t+e.sets.length,0);
  return `<div class="stack">
    <div class="wo-head"><div style="min-width:0"><div class="eyebrow">In progress · ${done}/${all} sets</div><h1>${esc(a.name)}</h1></div>
      <div class="clock num" id="clock">0:00</div></div>
    ${listCard("warmup","Warm-up",a.warmup)}
    ${a.exercises.map((e,i)=>exCard(e,i)).join("")}
    ${listCard("cardio","After the workout",a.cardio)}
    ${!a.exercises.length&&!(a.warmup||[]).length?`<div class="card stack">
      <div class="spread"><div><h3>Add bulk workouts</h3><p class="muted" style="margin:2px 0 0;font-size:13px">Paste your whole plan to add every day to the Train tab.</p></div>
        <button class="btn" id="bulkToggle">${S.bulkOpen?"Hide":"Open"}</button></div>
      <div class="stack" id="bulkBox" ${S.bulkOpen?"":"hidden"}>
        <p class="muted" style="margin:0;font-size:13px">${PASTE_HELP}</p>
        <textarea id="bulkText" class="field" style="width:100%;min-height:220px;flex-shrink:0;font-family:var(--body);font-size:14px;resize:vertical" placeholder="DAY 01&#10;Warm-up&#10;1. Arm circles - https://youtu.be/…&#10;MAIN WORKOUT&#10;1. Machine chest press - https://youtu.be/…"></textarea>
        <label class="row" style="flex-wrap:nowrap;font-size:14px;cursor:pointer"><input type="checkbox" id="bulkWalks" ${routines().some(r=>(r.warmup||[]).some(w=>w.name==="Walk"))?"checked":""} style="width:20px;height:20px;accent-color:var(--accent)"><span>Also add a 10-min walk before and a 30-min incline walk after each day</span></label>
        <div id="bulkMsg"></div>
        <button class="btn primary block" id="bulkInclude" style="min-height:48px">Include</button>
      </div></div>`:""}
    <div class="card stack">
      <div class="eyebrow">Add exercise</div>
      <div class="row" style="flex-wrap:nowrap"><input class="field" id="addExName" list="libList" placeholder="e.g. Face Pull" style="flex:1;min-width:0"><button class="btn" id="addExBtn">Add</button></div>
    </div>
    <button class="btn primary block" id="finishBtn" style="min-height:48px;font-size:16px">Finish and save workout</button>
    <button class="btn ghost block danger" id="discardBtn">Discard workout</button>
  </div>`;
}
function listCard(key,title,items){
  if(!items||!items.length) return "";
  return `<section class="card stack" style="gap:6px"><div class="spread"><h3>${title}</h3><span class="eyebrow">${items.filter(w=>w.done).length}/${items.length} done</span></div>
    ${items.map((w,i)=>`<div class="spread" style="border-top:1px solid var(--line);padding-top:6px"><label class="row" style="flex-wrap:nowrap;cursor:pointer;min-width:0"><input type="checkbox" id="${key}-${i}" data-li="${key}:${i}" ${w.done?"checked":""} style="width:20px;height:20px;accent-color:var(--good)"><span style="${w.done?"text-decoration:line-through;color:var(--muted)":""}">${esc(w.name)}${w.min?` <span class="muted num">· ${w.min} min</span>`:""}</span></label>
      ${w.min?`<button class="btn sm" data-timer="${key}:${i}">Start ${w.min}:00</button>`:`<a class="vid" href="${esc(videoFor(w))}" target="_blank" rel="noopener">▶ Video</a>`}</div>`).join("")}</section>`;
}
function exCard(e,i){
  const bb=isBarbell(e);
  return `<section class="ex" data-ex="${i}">
    <div class="ex-top"><div class="t"><h3>${esc(e.name)}</h3><div class="ex-target">Target ${e.sets.length} × ${esc(e.reps||"—")} · rest ${mmss(e.rest)}</div></div>
    <div class="row" style="gap:4px;flex-wrap:nowrap">${vidLinks(e,"Form")}</div></div>
    <table class="sets"><thead><tr><th>Set</th><th>Last</th><th>kg</th><th>Reps</th><th></th></tr></thead><tbody>
    ${e.sets.map((s,j)=>`<tr class="${s.done?"done":""}" data-set="${j}">
      <td><span class="setno">${j+1}</span></td>
      <td><span class="prev num">${esc(s.prev||"—")}</span></td>
      <td><input class="in" inputmode="decimal" data-f="w" value="${esc(s.w)}" aria-label="Weight in kg, set ${j+1}">${bb?`<div class="plates">${platesHtml(s.w)}</div>`:""}</td>
      <td><input class="in" inputmode="numeric" data-f="r" value="${esc(s.r)}" aria-label="Reps, set ${j+1}"></td>
      <td><button class="tick" data-tick aria-label="Mark set ${j+1} done">✓</button></td></tr>`).join("")}
    </tbody></table>
    <div class="ex-foot"><button class="btn sm" data-addset>+ Set</button>${e.sets.length>1?`<button class="btn sm ghost" data-delset>− Set</button>`:""}<span style="flex:1"></span><button class="btn sm ghost" data-delex>Remove</button></div>
  </section>`;
}

function planName(t){ return (t||"").trim() || "Pasted plan · "+dfmt(new Date(),{day:"numeric",month:"short",year:"numeric"}) }
const planOf = r => r.plan || "My routines";
function routineCard(r){ return `<div class="card stack" style="gap:8px">
      <div class="spread"><div style="min-width:0"><h3>${esc(r.name)}</h3>${r.note&&r.note!==r.plan?`<div class="muted" style="font-size:13px">${esc(r.note)}</div>`:""}</div>
      <div class="row" style="flex-wrap:nowrap"><button class="btn sm" data-edit="${esc(r.id)}">Edit</button><button class="btn sm primary" data-start="${esc(r.id)}">Start</button></div></div>
      ${(r.warmup||[]).length?`<div class="muted" style="font-size:13px"><b style="color:var(--ink)">Warm-up:</b> ${r.warmup.map(w=>w.min?`${esc(w.name)} ${w.min} min`:`<a href="${esc(videoFor(w))}" target="_blank" rel="noopener">${esc(w.name)}</a>`).join(" · ")}</div>`:""}
      ${(r.cardio||[]).length?`<div class="muted" style="font-size:13px"><b style="color:var(--ink)">After:</b> ${r.cardio.map(w=>w.min?`${esc(w.name)} ${w.min} min`:`<a href="${esc(videoFor(w))}" target="_blank" rel="noopener">${esc(w.name)}</a>`).join(" · ")}</div>`:""}
      <div>${r.exercises.map(e=>`<div class="spread" style="padding:5px 0;border-top:1px solid var(--line);font-size:14px">
        <span style="min-width:0">${esc(e.name)} <span class="muted num">· ${e.sets}×${esc(e.reps)}</span></span>
        <span class="row" style="gap:4px;flex-wrap:nowrap">${vidLinks(e,"Video")}</span></div>`).join("")}</div>
    </div>`; }
function viewRoutines(){
  const groups=new Map(); routines().forEach(r=>{const k=planOf(r); if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(r)});
  return `<div class="stack">
    <div class="spread"><h1>Routines</h1><div class="row" style="flex-wrap:nowrap"><button class="btn" id="pasteBtn">Paste plan</button><button class="btn primary" data-edit="">+ New</button></div></div>
    ${[...groups].sort((x,y)=>(x[1][0].expired?1:0)-(y[1][0].expired?1:0)).map(([k,list])=>{ const ex=!!list[0].expired; return `<div class="section" style="margin-top:8px">
      <div class="spread" style="border-bottom:2px solid ${ex?"var(--line)":"var(--ink)"};padding-bottom:6px"><div style="min-width:0"><div class="eyebrow">${ex?`<span style="color:var(--accent)">Expired</span>`:`<span style="color:var(--good)">Active</span>`} · ${list.length} day${list.length>1?"s":""}</div><h2 style="${ex?"color:var(--muted)":""}">${esc(k)}</h2></div>
        <div class="row" style="flex-wrap:nowrap;gap:4px"><button class="btn sm" data-expire="${esc(k)}">${ex?"Make active":"Expire"}</button><button class="btn sm ghost danger" data-rmplan="${esc(k)}">Remove</button></div></div>
      ${ex?`<p class="muted" style="margin:0;font-size:13px">Hidden from the Train tab. ${list.map(r=>esc(r.name)).join(" · ")}</p>`:list.map(routineCard).join("")}</div>`}).join("")}
    ${routines().length===0?`<div class="empty">No routines yet. Tap “Paste plan” to load your coach's plan, or “+ New” to build one.</div>`:""}
  </div>`;
}
function editRoutine(id){
  const src=routines().find(r=>r.id===id);
  const r=src?clone(src):{id:uid("r"),plan:"My routines",name:"",note:"",warmup:[],cardio:[],exercises:[{name:"",sets:3,reps:"8-10",rest:90}]};
  const host=$("#sheetHost");
  r.warmup=r.warmup||[]; r.cardio=r.cardio||[];
  const edList=(key,word)=>r[key].map((w,i)=>`<div class="card ed-ex ed-li" data-l="${key}:${i}" style="grid-template-columns:1fr 90px">
      <label>Name<input data-k="name" id="${key}-n-${i}" value="${esc(w.name)}"></label>
      <label>Minutes<input data-k="min" id="${key}-m-${i}" inputmode="numeric" value="${esc(w.min||"")}" placeholder="—"></label>
      <label class="full">YouTube link<input data-k="video" id="${key}-v-${i}" inputmode="url" value="${esc(w.video||"")}"></label>
      <div class="ed-tools"><button class="btn sm ghost danger" data-rml="${key}:${i}">Remove</button></div></div>`).join("")+`<button class="btn block" data-addl="${key}">+ Add ${word}</button>`;
  const draw=()=>{host.innerHTML=`<div class="sheet-bg" id="sheetBg"><div class="sheet stack" role="dialog" aria-label="Edit routine">
    <div class="spread"><h2>${src?"Edit routine":"New routine"}</h2><button class="btn ghost" data-close>Close</button></div>
    <input class="field" id="rName" placeholder="Routine name, e.g. Push Day" value="${esc(r.name)}">
    <input class="field" id="rNote" placeholder="Note (optional), e.g. 45 min · Mondays" value="${esc(r.note||"")}">
    <label class="card row" style="flex-wrap:nowrap;cursor:pointer;gap:10px"><input type="checkbox" id="rExpired" ${r.expired?"checked":""} style="width:22px;height:22px;flex-shrink:0;accent-color:var(--accent)">
      <span><b>Plan expired</b><br><span class="muted" style="font-size:13px">Hides every day of “${esc(planOf(r))}” from the Train tab. Your logged workouts are kept.</span></span></label>
    <div class="eyebrow">Warm-up</div>
    ${edList("warmup","warm-up")}
    <div class="eyebrow">Workout</div>
    ${r.exercises.map((e,i)=>`<div class="card ed-ex" data-i="${i}">
      <label>Exercise<input data-k="name" id="ex-n-${i}" list="libList" value="${esc(e.name)}" placeholder="Search or type"></label>
      <label>Sets<input data-k="sets" id="ex-s-${i}" inputmode="numeric" value="${esc(e.sets)}"></label>
      <label>Reps<input data-k="reps" id="ex-r-${i}" value="${esc(e.reps)}"></label>
      <label class="full">Rest between sets<select data-k="rest" id="ex-t-${i}">${[30,45,60,75,90,120,150,180,240].map(s=>`<option value="${s}" ${+e.rest===s?"selected":""}>${mmss(s)}</option>`).join("")}</select></label>
      <label class="full">YouTube link (optional, otherwise we search YouTube for you)<input data-k="video" id="ex-v-${i}" inputmode="url" value="${esc(e.video||"")}" placeholder="https://www.youtube.com/watch?v=…"></label>
      <div class="ed-tools"><button class="btn sm ghost" data-up="${i}" ${i?"":"disabled"} aria-label="Move up">↑</button><button class="btn sm ghost" data-down="${i}" ${i<r.exercises.length-1?"":"disabled"} aria-label="Move down">↓</button><button class="btn sm ghost danger" data-rm="${i}">Remove</button></div>
    </div>`).join("")}
    <button class="btn block" data-addrow>+ Add exercise</button>
    <div class="eyebrow">After the workout</div>
    ${edList("cardio","cardio")}
    <button class="btn primary block" data-save style="min-height:48px">Save routine</button>
    ${src?`<button class="btn ghost danger block" data-delr>Delete routine</button>`:""}
  </div></div>`;};
  const sync=()=>{r.name=$("#rName").value.trim();r.note=$("#rNote").value.trim();r.expired=$("#rExpired").checked;
    host.querySelectorAll(".ed-li").forEach(c=>{const [k,i]=c.dataset.l.split(":");const w=r[k][+i];c.querySelectorAll("[data-k]").forEach(inp=>{w[inp.dataset.k]=inp.dataset.k==="min"?(parseInt(inp.value)||0):inp.value.trim()})});
    host.querySelectorAll(".ed-ex:not(.ed-li)").forEach(c=>{const e=r.exercises[+c.dataset.i];c.querySelectorAll("[data-k]").forEach(inp=>{e[inp.dataset.k]=inp.dataset.k==="sets"||inp.dataset.k==="rest"?(parseInt(inp.value)||0):inp.value.trim()})})};
  draw();
  host.onclick=(ev)=>{
    const t=ev.target.closest("button")||ev.target;
    if(t.id==="sheetBg"||t.dataset.close!==undefined){host.innerHTML="";host.onclick=null;return}
    if(t.tagName!=="BUTTON")return;
    sync();
    if(t.dataset.addl){r[t.dataset.addl].push({name:"",video:""});draw();return}
    if(t.dataset.rml){const [k,i]=t.dataset.rml.split(":");r[k].splice(+i,1);draw();return}
    if(t.dataset.addrow!==undefined){r.exercises.push({name:"",sets:3,reps:"10",rest:90});draw();return}
    if(t.dataset.rm!==undefined){r.exercises.splice(+t.dataset.rm,1);draw();return}
    if(t.dataset.up!==undefined){const i=+t.dataset.up;[r.exercises[i-1],r.exercises[i]]=[r.exercises[i],r.exercises[i-1]];draw();return}
    if(t.dataset.down!==undefined){const i=+t.dataset.down;[r.exercises[i+1],r.exercises[i]]=[r.exercises[i],r.exercises[i+1]];draw();return}
    if(t.dataset.delr!==undefined){armed(t,()=>{Store.saveRoutines(routines().filter(x=>x.id!==r.id));host.innerHTML="";toast("Routine deleted")});return}
    if(t.dataset.save!==undefined){
      const cl=w=>({name:w.name,video:/^https?:\/\//i.test(w.video||"")?w.video:"",...(w.min>0?{min:Math.min(180,w.min)}:{})});
      r.warmup=r.warmup.filter(w=>w.name).map(cl); r.cardio=r.cardio.filter(w=>w.name).map(cl);
      r.exercises=r.exercises.filter(e=>e.name).map(e=>{const lib=LIBMAP[e.name.toLowerCase()];return {...e,name:lib?lib.name:e.name,sets:Math.max(1,Math.min(10,e.sets||3)),video:/^https?:\/\//i.test(e.video||"")?e.video:"",videos:(e.videos&&e.videos[0]?.url===e.video)?e.videos:null}});
      if(!r.name){toast("Give the routine a name");$("#rName").focus();return}
      if(!r.exercises.length){toast("Add at least one exercise");return}
      let list=routines().slice(); const k=list.findIndex(x=>x.id===r.id); if(k>=0)list[k]=r; else list.push(r);
      list=list.map(x=>planOf(x)===planOf(r)?{...x,expired:r.expired}:x);
      Store.saveRoutines(clone(list)); host.innerHTML=""; toast("Routine saved");
    }
  };
}

/* ---------- charts ---------- */
function niceTicks(min,max,n=4){
  if(min===max){min-=1;max+=1}
  const span=max-min, step0=span/n, mag=Math.pow(10,Math.floor(Math.log10(step0))), f=step0/mag;
  const step=(f<1.5?1:f<3?2:f<7?5:10)*mag; const lo=Math.floor(min/step)*step, hi=Math.ceil(max/step)*step;
  const t=[]; for(let v=lo;v<=hi+step/2;v+=step) t.push(+v.toFixed(6)); return t;
}
function lineChart(pts,{unit="kg",trend=null}={}){
  const W=600,H=240,L=58,Rt=24,T=14,B=30;
  if(pts.length<2) return `<div class="empty">Log this ${unit==="kg"?"exercise":"measurement"} at least twice to see a trend.</div>`;
  const xs=pts.map(p=>+p.x), ys=pts.map(p=>p.y).concat(trend?trend.map(p=>p.y):[]);
  const x0=Math.min(...xs),x1=Math.max(...xs); const ticks=niceTicks(Math.min(...ys),Math.max(...ys));
  const y0=ticks[0],y1=ticks[ticks.length-1];
  const X=x=>L+(x1===x0?0.5:(x-x0)/(x1-x0))*(W-L-Rt), Y=y=>T+(1-(y-y0)/(y1-y0))*(H-T-B);
  const path=a=>a.map((p,i)=>(i?"L":"M")+X(+p.x).toFixed(1)+" "+Y(p.y).toFixed(1)).join("");
  const main=path(pts), area=main+`L${X(x1).toFixed(1)} ${H-B}L${X(x0).toFixed(1)} ${H-B}Z`;
  const lastP=pts[pts.length-1]; const mid=new Date((x0+x1)/2);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Trend chart">
    ${ticks.map(t=>`<line class="grid" x1="${L}" x2="${W-Rt}" y1="${Y(t)}" y2="${Y(t)}" stroke-width="1"/><text x="${L-6}" y="${Y(t)+4}" text-anchor="end">${t}</text>`).join("")}
    <path d="${area}" fill="var(--accent)" fill-opacity=".10"/>
    ${trend?`<path d="${path(pts)}" fill="none" stroke="var(--accent)" stroke-opacity=".35" stroke-width="1.5"/><path d="${path(trend)}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>`
           :`<path d="${main}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>`}
    ${trend?"":pts.map(p=>`<circle cx="${X(+p.x)}" cy="${Y(p.y)}" r="3" fill="var(--surface)" stroke="var(--accent)" stroke-width="2"/>`).join("")}
    <circle cx="${X(+lastP.x)}" cy="${Y(lastP.y)}" r="5.5" fill="var(--accent)"/>
    <text x="${L}" y="${H-6}">${dfmt(x0)}</text><text x="${(L+W-Rt)/2}" y="${H-6}" text-anchor="middle">${dfmt(mid)}</text><text x="${W-Rt}" y="${H-6}" text-anchor="end">${dfmt(x1)}</text>
  </svg>`;
}
function barChart(bars){
  const W=600,H=200,L=58,Rt=16,T=24,B=30; const max=Math.max(...bars.map(b=>b.v),1); const ticks=niceTicks(0,max,3); const top=ticks[ticks.length-1];
  const bw=(W-L-Rt)/bars.length; const Y=v=>T+(1-v/top)*(H-T-B);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weekly volume">
    ${ticks.map(t=>`<line class="grid" x1="${L}" x2="${W-Rt}" y1="${Y(t)}" y2="${Y(t)}"/><text x="${L-6}" y="${Y(t)+4}" text-anchor="end">${fmtBig(t)}</text>`).join("")}
    ${bars.map((b,i)=>{const x=L+i*bw+bw*.18,w=bw*.64,last=i===bars.length-1;return `<rect x="${x}" y="${Y(b.v)}" width="${w}" height="${Math.max(0,H-B-Y(b.v))}" rx="3" fill="var(--accent)" fill-opacity="${last?1:.45}"/>
      <text x="${x+w/2}" y="${H-6}" text-anchor="middle">${b.label}</text>${last&&b.v?`<text x="${x+w/2}" y="${Y(b.v)-5}" text-anchor="middle" style="fill:var(--ink);font-weight:600">${fmtBig(b.v)}</text>`:""}`}).join("")}
  </svg>`;
}

function viewProgress(){
  const ss=S.sessions.slice().sort((a,b)=>a.date.localeCompare(b.date));
  const ws=weekStart(new Date());
  const weekS=ss.filter(s=>new Date(s.date)>=ws);
  const body=S.body.slice().sort((a,b)=>a.date.localeCompare(b.date));
  const bwNow=body.at(-1); const cutoff=Date.now()-30*864e5; const bwOld=body.find(b=>+new Date(b.date)>=cutoff)||body[0];
  const bwDelta=bwNow&&bwOld&&bwNow!==bwOld? bwNow.kg-bwOld.kg : null;

  // exercises & PRs
  const best={}; ss.forEach(s=>s.exercises.forEach(e=>e.sets.forEach(st=>{const v=e1rm(st.w,st.r);if(!best[e.name]||v>best[e.name].v)best[e.name]={v,w:st.w,r:st.r,date:s.date}})));
  const exNames=Object.keys(best).sort((a,b)=>best[b].v-best[a].v);
  if(!S.progEx||!best[S.progEx]) S.progEx=exNames[0]||null;
  const exPts=S.progEx? ss.map(s=>{const e=s.exercises.find(x=>x.name===S.progEx);if(!e)return null;return {x:new Date(s.date),y:Math.round(Math.max(...e.sets.map(st=>e1rm(st.w,st.r)))*10)/10}}).filter(Boolean):[];

  // weekly volume last 8 weeks
  const bars=[]; for(let i=7;i>=0;i--){const a=new Date(ws);a.setDate(a.getDate()-7*i);const b=new Date(a);b.setDate(b.getDate()+7);
    bars.push({label:a.getDate()+"."+(a.getMonth()+1)+".",v:ss.filter(s=>{const d=new Date(s.date);return d>=a&&d<b}).reduce((t,s)=>t+(s.volume||0),0)})}

  // bodyweight trend (7-entry average)
  const bwPts=body.map(b=>({x:new Date(b.date),y:b.kg}));
  const bwTrend=bwPts.map((p,i)=>{const w=bwPts.slice(Math.max(0,i-6),i+1);return {x:p.x,y:Math.round(w.reduce((t,q)=>t+q.y,0)/w.length*10)/10}});
  const today=new Date().toISOString().slice(0,10);

  return `<div class="stack">
    <h1>Progress</h1>
    <div class="stats">
      <div class="stat"><div class="v">${weekS.length}</div><div class="k">Workouts this week</div></div>
      <div class="stat"><div class="v">${fmtBig(weekS.reduce((t,s)=>t+(s.volume||0),0))}</div><div class="k">kg lifted this week</div></div>
      <div class="stat"><div class="v">${bwDelta===null?"—":(bwDelta>0?"+":"")+(Math.round(bwDelta*10)/10)}</div><div class="k">Body weight, kg in 30 days</div></div>
    </div>

    <div class="section"><div class="spread"><h2>Strength</h2>
      ${exNames.length?`<select class="sel" id="progEx" aria-label="Exercise">${exNames.map(n=>`<option ${n===S.progEx?"selected":""}>${esc(n)}</option>`).join("")}</select>`:""}</div>
      ${exNames.length?`<div class="card"><div class="eyebrow">Estimated 1-rep max per session (kg)</div>${lineChart(exPts)}</div>`
        :`<div class="empty">Finish your first workout and your strength trend shows up here.</div>`}
    </div>

    <div class="section"><h2>Weekly volume</h2>
      <div class="card"><div class="eyebrow">kg × reps, Monday–Sunday</div>${barChart(bars)}</div></div>

    <div class="section"><h2>Body weight</h2>
      <div class="card stack">
        <div class="row" style="flex-wrap:nowrap"><input class="field num" id="bwKg" inputmode="decimal" placeholder="kg" style="width:90px"><input class="field" type="date" id="bwDate" value="${today}" style="flex:1;min-width:0"><button class="btn primary" id="bwAdd">Log</button></div>
        ${bwPts.length?`<div class="eyebrow">Daily weigh-ins (faint) and 7-entry average${bwNow?` · latest ${fmtKg(bwNow.kg)}`:""}</div>${lineChart(bwPts,{unit:"bw",trend:bwTrend})}`
          :`<p class="muted" style="margin:0;font-size:14px">Weigh in a few mornings a week, same conditions. The average line smooths out water-weight swings so you can see real fat loss.</p>`}
      </div></div>

    ${measuresSection(today)}

    <div class="section"><h2>Personal records</h2>
      ${exNames.length?`<div class="card">${exNames.map(n=>`<div class="pr"><div style="min-width:0">${esc(n)}<div class="muted num" style="font-size:12px">${best[n].w} kg × ${best[n].r} · ${dfmt(best[n].date)}</div></div><b class="num">${Math.round(best[n].v)} kg</b></div>`).join("")}</div>
        <p class="muted" style="font-size:12px;margin:0">Estimated 1-rep max uses the Epley formula: weight × (1 + reps ÷ 30).</p>`
        :`<div class="empty">Your best lifts will be listed here.</div>`}
    </div>
  </div>`;
}

function measuresSection(today){
  const m=S.measures.slice().sort((a,b)=>a.date.localeCompare(b.date));
  const first=k=>m.find(e=>e[k]>0), last=k=>[...m].reverse().find(e=>e[k]>0);
  const key=S.measKey, pts=m.filter(e=>e[key]>0).map(e=>({x:new Date(e.date),y:e[key]}));
  const rows=MEAS.filter(([k])=>last(k)).map(([k,l])=>{const a=first(k),b=last(k),d=Math.round((b[k]-a[k])*10)/10;
    return `<div class="pr"><div>${l}<div class="muted num" style="font-size:12px">${a===b?`since ${dfmt(b.date)}`:`${a[k]} → ${b[k]} cm since ${dfmt(a.date)}`}</div></div>
      <b class="num" style="color:${a===b||d===0?"var(--ink)":(k==="arm"||k==="chest")?(d>0?"var(--good)":"var(--ink)"):(d<0?"var(--good)":"var(--ink)")}">${b[k]} cm${a===b?"":` <span style="font-size:14px">(${d>0?"+":""}${d})</span>`}</b></div>`}).join("");
  return `<div class="section"><h2>Measurements</h2>
    <div class="card stack">
      <div class="ed-ex" style="grid-template-columns:repeat(auto-fit,minmax(88px,1fr))">
        ${MEAS.map(([k,l])=>`<label>${l} cm<input id="m-${k}" inputmode="decimal" placeholder="${last(k)?.[k]??"—"}" class="num"></label>`).join("")}
        <label style="grid-column:span 2">Date<input type="date" id="m-date" value="${today}"></label>
      </div>
      <button class="btn primary" id="measAdd">Log measurements</button>
      <p class="muted" style="margin:0;font-size:13px">Fill in only what you measured. Measure every 2–4 weeks, in the morning, tape level and snug. Waist at the belly button, arm at the biggest point, flexed.</p>
    </div>
    ${rows?`<div class="card">${rows}</div>
    <div class="card"><div class="spread" style="margin-bottom:6px"><div class="eyebrow">Trend (cm)</div>
      <select class="sel" id="measKey" aria-label="Measurement">${MEAS.map(([k,l])=>`<option value="${k}" ${k===key?"selected":""}>${l}</option>`).join("")}</select></div>
      ${lineChart(pts,{unit:"cm"})}</div>`:""}
  </div>`;
}
function viewHistory(){
  const backup=`<div class="card stack" style="gap:8px">
      <div><h3>Backup</h3><p class="muted" style="margin:2px 0 0;font-size:13px">${S.mode==="cloud"?"Your data is saved to your Claude account. Save a backup file now and then, or load one from another copy of the app.":"Your data lives only in this browser. Save a backup file regularly so you can restore it or move it to another device."}</p></div>
      <div class="row"><button class="btn" id="exportBtn">Save backup file</button><button class="btn" id="importBtn">Load backup file</button><input type="file" id="importFile" accept=".json,application/json" hidden></div>
    </div>`;
  if(!S.sessions.length) return `<div class="stack"><h1>History</h1>${backup}<div class="empty">No workouts logged yet. Start one from the Train tab.</div></div>`;
  return `<div class="stack"><h1>History</h1>${backup}
    ${S.sessions.map(s=>`<div class="card hist">
      <div class="spread"><div style="min-width:0"><div class="eyebrow">${dfmt(s.date,{weekday:"short",day:"numeric",month:"short",year:"numeric"})}</div><h3>${esc(s.name)}</h3></div>
      <div style="text-align:right" class="num"><div style="font-family:var(--display);font-size:20px;font-weight:600">${fmtBig(s.volume||0)} kg</div><div class="muted" style="font-size:12px">${s.minutes} min</div></div></div>
      <div class="lines">${s.exercises.map(e=>{const top=e.sets.reduce((a,b)=>e1rm(b.w,b.r)>e1rm(a.w,a.r)?b:a,e.sets[0]);return `<div><b>${esc(e.name)}</b> · ${e.sets.length} sets · top ${top.w} kg × ${top.r}</div>`}).join("")}</div>
      <div style="text-align:right;margin-top:6px"><button class="btn sm ghost danger" data-delsess="${esc(s.id)}">Delete</button></div>
    </div>`).join("")}</div>`;
}

/* ---------- render + events ---------- */
let clockIv=null;
function render(){
  const sync=$("#sync");
  sync.className="sync"+(S.mode==="cloud"?" cloud":"");
  sync.querySelector("span").textContent=S.mode==="cloud"?"Saved to your account":S.mode==="local"?"Saved on this device":"Loading…";
  const main=$("#main");
  main.innerHTML = S.tab==="routines"?viewRoutines():S.tab==="progress"?viewProgress():S.tab==="history"?viewHistory():viewTrain();
  document.querySelectorAll("nav.tabs a").forEach(a=>{ if(a.dataset.tab===S.tab) a.setAttribute("aria-current","page"); else a.removeAttribute("aria-current"); });
  clearInterval(clockIv);
  if(S.tab==="train"&&S.active){const c=()=>{const el=$("#clock");if(el)el.textContent=mmss((Date.now()-S.active.startedAt)/1000)};c();clockIv=setInterval(c,1000)}
}
function route(){const h=(location.hash||"").slice(1);S.tab=["train","routines","progress","history"].includes(h)?h:"train";render();window.scrollTo(0,0)}
window.addEventListener("hashchange",route);

const main=$("#main");
main.addEventListener("click",ev=>{
  const b=ev.target.closest("button"); if(!b) return;
  if(b.dataset.start!==undefined){ if(S.active&&!confirmReplace(b)) return; startWorkout(routines().find(r=>r.id===b.dataset.start)); return }
  if(b.dataset.edit!==undefined){ editRoutine(b.dataset.edit); return }
  if(b.dataset.delsess!==undefined){ armed(b,()=>{Store.deleteSession(b.dataset.delsess);toast("Workout deleted")}); return }
  if(b.dataset.timer&&S.active){ const [k,i]=b.dataset.timer.split(":"); const w=S.active[k][+i]; startRest(w.min*60,w.name,true); w.done=true; saveDraft(); render(); return }
  if(b.id==="measAdd"){ const d=$("#m-date").value||new Date().toISOString().slice(0,10); const e={date:d};
    for(const [k,l] of MEAS){ const raw=$("#m-"+k).value.trim(); if(!raw) continue; const v=num(raw); if(v<10||v>250){toast(l+" should be in cm, e.g. 92.5");return} e[k]=Math.round(v*10)/10 }
    if(Object.keys(e).length===1){toast("Enter at least one measurement");return}
    const old=S.measures.find(x=>x.date===d)||{};
    Store.saveMeasures([...S.measures.filter(x=>x.date!==d),{...old,...e}].sort((a,c)=>a.date.localeCompare(c.date)).slice(-500)); toast("Measurements logged"); return }
  if(b.dataset.expire!==undefined){ const k=b.dataset.expire; const now=!routines().find(r=>planOf(r)===k)?.expired;
    Store.saveRoutines(routines().map(r=>planOf(r)===k?{...r,expired:now}:r)); toast(now?`“${k}” expired. It's hidden from Train.`:`“${k}” is active again`); return }
  if(b.dataset.rmplan!==undefined){ const k=b.dataset.rmplan; const n=routines().filter(r=>planOf(r)===k).length;
    armed(b,()=>{ Store.saveRoutines(routines().filter(r=>planOf(r)!==k)); toast(`Removed “${k}” (${n} day${n>1?"s":""}). Your logged workouts are kept.`) }); return }
  if(b.id==="toggleDone"){ S.showDone=!S.showDone; render(); return }
  if(b.id==="pasteBtn"){ openPaste(); return }
  if(b.id==="bulkToggle"){ S.bulkOpen=!S.bulkOpen; $("#bulkBox").hidden=!S.bulkOpen; b.textContent=S.bulkOpen?"Hide":"Open"; if(S.bulkOpen) $("#bulkText").focus(); return }
  if(b.id==="bulkInclude"){ const res=parsePlan($("#bulkText").value);
    if(!res.routines.length){ $("#bulkMsg").innerHTML=`<div class="empty" style="padding:12px">No workouts found. Start each day with “Day 1”, “Day 2”… and put one exercise per line.</div>`; return }
    const walks=$("#bulkWalks").checked;
    const fresh=res.routines.map(r=>{ const x={...r,id:uid("r"),plan:planName(r.note)};
      if(walks){ if(!x.warmup.some(w=>/^walk/i.test(w.name))) x.warmup=[WALK(),...x.warmup]; if(!x.cardio.some(w=>/incline walk/i.test(w.name))) x.cardio=[...INCLINE(),...x.cardio]; }
      return x; });
    const names=new Set(fresh.map(r=>r.name));
    Store.saveRoutines([...routines().filter(r=>!names.has(r.name)),...fresh]);
    S.active=null; S.bulkOpen=false; ls.del("liftlog.active"); stopRest();
    toast(`Added ${fresh.length} workout${fresh.length>1?"s":""} to Train`); location.hash="#train"; render(); window.scrollTo(0,0); return }
  if(b.dataset.parse){ const res=parsePlan($("#planText").value); const pv=$("#planPreview");
    if(b.textContent==="Load this plan"&&parsedPlan){ applyPlan("replace"); return }
    parsedPlan=res; pv.innerHTML=planPreview(res); if(res.routines.length) b.textContent="Load this plan"; return }
  if(b.id==="exportBtn"){ exportData(); return }
  if(b.id==="importBtn"){ $("#importFile").click(); return }
  if(b.id==="finishBtn"){ finishWorkout(); return }
  if(b.id==="discardBtn"){ armed(b,()=>{S.active=null;ls.del("liftlog.active");stopRest();render();toast("Workout discarded")}); return }
  if(b.id==="addExBtn"){ const n=$("#addExName").value.trim(); if(!n) return; const lib=LIBMAP[n.toLowerCase()];
    S.active.exercises.push(buildEx({name:lib?lib.name:n,sets:3,reps:"10",rest:90})); saveDraft(); render(); return }
  if(b.id==="bwAdd"){ const kg=num($("#bwKg").value), d=$("#bwDate").value||new Date().toISOString().slice(0,10);
    if(kg<25||kg>350){toast("Enter your weight in kg, e.g. 82.4");return}
    Store.saveBody([...S.body.filter(x=>x.date!==d),{date:d,kg:Math.round(kg*10)/10}].sort((a,c)=>a.date.localeCompare(c.date)).slice(-730)); toast("Weight logged"); return }
  const card=b.closest("[data-ex]"); if(!card||!S.active) return;
  const ex=S.active.exercises[+card.dataset.ex];
  if(b.dataset.tick!==undefined){ const tr=b.closest("tr"), s=ex.sets[+tr.dataset.set];
    s.done=!s.done; tr.classList.toggle("done",s.done); if(s.done) startRest(ex.rest,ex.name);
    const done=S.active.exercises.reduce((t,e)=>t+e.sets.filter(x=>x.done).length,0),all=S.active.exercises.reduce((t,e)=>t+e.sets.length,0);
    const eb=main.querySelector(".wo-head .eyebrow"); if(eb) eb.textContent=`In progress · ${done}/${all} sets`; saveDraft(); return }
  if(b.dataset.addset!==undefined){ const l=ex.sets.at(-1)||{w:"",r:""}; ex.sets.push({w:l.w,r:l.r,done:false,prev:""}); saveDraft(); render(); return }
  if(b.dataset.delset!==undefined){ ex.sets.pop(); saveDraft(); render(); return }
  if(b.dataset.delex!==undefined){ armed(b,()=>{S.active.exercises.splice(+card.dataset.ex,1);saveDraft();render()}); return }
});
function confirmReplace(b){ if(b.classList.contains("armed")) return true; armed(b,()=>{}); b.textContent="Replace current?"; return false }
main.addEventListener("input",ev=>{
  const inp=ev.target;
  if(inp.id==="planText"){ const b=main.querySelector("[data-parse]"); if(b) b.textContent="Read plan"; return }
  if(inp.id==="progEx"){S.progEx=inp.value;render();return}
  if(!inp.matches(".in")||!S.active) return;
  const card=inp.closest("[data-ex]"), tr=inp.closest("tr"); const ex=S.active.exercises[+card.dataset.ex], s=ex.sets[+tr.dataset.set];
  s[inp.dataset.f]=inp.value.replace(",",".");
  if(inp.dataset.f==="w"){const p=tr.querySelector(".plates"); if(p) p.innerHTML=platesHtml(s.w);
    // carry weight forward to later empty / untouched sets
    ex.sets.forEach((o,k)=>{if(k>+tr.dataset.set&&!o.done&&(o.w===""||o.w===undefined)){o.w=s.w;const ri=card.querySelector(`tr[data-set="${k}"] .in[data-f="w"]`);if(ri){ri.value=s.w;const pp=ri.parentElement.querySelector(".plates");if(pp)pp.innerHTML=platesHtml(s.w)}}})}
  saveDraft();
});
main.addEventListener("change",ev=>{ if(ev.target.id==="measKey"){S.measKey=ev.target.value;render();return}
  if(ev.target.id==="importFile"){const f=ev.target.files[0]; ev.target.value=""; if(f) importData(f); return}
  if(ev.target.id==="progEx"){S.progEx=ev.target.value;render();return}
  if(ev.target.dataset.li&&S.active){const [k,i]=ev.target.dataset.li.split(":");S.active[k][+i].done=ev.target.checked;saveDraft();render()} });
main.addEventListener("focusout",()=>{ setTimeout(()=>{ if(!document.activeElement?.closest?.("#main .in") && pendingRender){pendingRender=false;render()} },0) });
let pendingRender=false;
const _render=render; render=function(){ if(document.activeElement?.closest?.("#main .in")){pendingRender=true;const s=$("#sync");s.className="sync"+(S.mode==="cloud"?" cloud":"");s.querySelector("span").textContent=S.mode==="cloud"?"Saved to your account":"Saved on this device";return} _render() };

/* ---------- backup ---------- */
async function exportData(){
  const data=JSON.stringify({app:"liftlog",version:1,exportedAt:new Date().toISOString(),
    routines:routines(),sessions:S.sessions,body:S.body,measures:S.measures},null,1);
  const filename="liftlog-backup-"+new Date().toISOString().slice(0,10)+".json";
  let dl=null; try{ dl=window.claude?.use ? await window.claude.use("downloads") : null }catch{}
  if(dl){
    try{ await dl.save({filename,data}); toast("Backup saved"); }
    catch(e){ if(e?.code!=="declined") toast("Couldn't save the backup file here. Try again in a moment."); }
    return;
  }
  try{ const f=new File([data],filename,{type:"application/json"});
    if(navigator.canShare&&navigator.canShare({files:[f]})){ await navigator.share({files:[f],title:"Liftlog backup"}); toast("Backup ready"); return } }
  catch(e){ if(e&&e.name==="AbortError") return }
  try{ const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([data],{type:"application/json"})); a.download=filename;
    document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000); toast("Backup saved"); }
  catch{ toast("This browser blocked the download."); }
}
async function importData(file){
  let d; try{ d=JSON.parse(await file.text()) }catch{ toast("That file isn't a Liftlog backup."); return }
  if(!d||d.app!=="liftlog"||!Array.isArray(d.sessions)){ toast("That file isn't a Liftlog backup."); return }
  const have=new Set(S.sessions.map(x=>x.id));
  const fresh=d.sessions.filter(x=>x&&x.id&&x.date&&Array.isArray(x.exercises)&&!have.has(x.id));
  const body=[...S.body]; (Array.isArray(d.body)?d.body:[]).forEach(b=>{ if(b&&b.date&&isFinite(b.kg)&&!body.some(x=>x.date===b.date)) body.push({date:b.date,kg:+b.kg}) });
  body.sort((a,b)=>a.date.localeCompare(b.date));
  toast("Loading backup…");
  if(Array.isArray(d.routines)&&d.routines.length) await Store.saveRoutines(d.routines);
  if(body.length!==S.body.length) await Store.saveBody(body.slice(-730));
  const ms=[...S.measures]; (Array.isArray(d.measures)?d.measures:[]).forEach(x=>{ if(x&&x.date&&!ms.some(y=>y.date===x.date)){const e={date:x.date};MEAS.forEach(([k])=>{if(isFinite(x[k])&&x[k]>0)e[k]=+x[k]});ms.push(e)} });
  if(ms.length!==S.measures.length) await Store.saveMeasures(ms.sort((a,c)=>a.date.localeCompare(c.date)).slice(-500));
  for(const x of fresh) await Store.saveSession(x);
  toast(`Loaded ${fresh.length} workout${fresh.length===1?"":"s"} from the backup`);
}

/* datalist of exercises */
const dl=document.createElement("datalist"); dl.id="libList"; dl.innerHTML=LIB.map(([n,m])=>`<option value="${esc(n)}">${esc(m)}</option>`).join(""); document.body.appendChild(dl);

route();
Store.init();
})();

// Offline support and install
if("serviceWorker" in navigator){ window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{})); }
try{ navigator.storage?.persist?.() }catch{}
