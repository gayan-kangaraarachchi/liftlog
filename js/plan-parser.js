// Liftlog: reads a pasted workout plan (WhatsApp/Slack style) into routines.
// parsePlan(text) -> { title, routines: [{ name, note, warmup[], exercises[], cardio[] }] }
"use strict";
function parsePlan(text){
  const URL_RE=/https?:\/\/[^\s<>*]+/gi;
  const clean=l=>l.replace(/:[a-z0-9_+\-]+:/gi," ").replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu," ").replace(/[*_~`]/g,"").replace(/\s+/g," ").trim();
  const days=[]; let title="", day=null, sec="workout", last=null;
  const newDay=(name)=>{day={name,warmup:[],exercises:[],cardio:[]};days.push(day);sec="workout";last=null};
  const src=text.replace(/\r/g,"").split("\n"), lines=[];
  for(let i=0;i<src.length;i++){
    let l=src[i];
    // a numbered line with no link whose bold (*...*) is left open continues on the next line
    while(/^\s*\d+\s*[.)]/.test(l) && !URL_RE.test(l) && ((l.match(/\*/g)||[]).length%2===1) && i+1<src.length && src[i+1].trim() && !/^\s*\d+\s*[.)]/.test(src[i+1])){ URL_RE.lastIndex=0; l=l.replace(/\s+$/,"")+" "+src[++i].trim() }
    URL_RE.lastIndex=0; lines.push(l);
  }
  for(const raw of lines){
    const urls=(raw.match(URL_RE)||[]).map(u=>u.replace(/[).,]+$/,""));
    let l=clean(raw.replace(URL_RE," "));
    const bare=l.replace(/^[\/|,\-–—\s]+|[\/|,\-–—\s]+$/g,"");
    if(!bare && urls.length){ if(last){ last._urls.push(...urls) } continue }
    if(!bare) continue;
    const dm=bare.match(/^(?:day|päivä|session|workout)\s*0*(\d+)\b\s*[:\-–—·]?\s*(.*)$/i) || bare.match(/^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b\s*[:\-–—·]?\s*(.*)$/i);
    if(dm && !urls.length && bare.length<60){ const n=/^\d+$/.test(dm[1])?"Day "+String(dm[1]).padStart(2,"0"):dm[1][0].toUpperCase()+dm[1].slice(1).toLowerCase(); newDay(dm[2]?n+" · "+dm[2]:n); continue }
    if(!urls.length && bare.length<40){
      if(/^warm[\s\-]*ups?\b/i.test(bare)){ if(!day) newDay("Day 01"); sec="warmup"; last=null; continue }
      if(/^(workout|main( workout)?|exercises?|training|strength)\b:?$/i.test(bare)){ if(!day) newDay("Day 01"); sec="workout"; last=null; continue }
      if(/^(cool[\s\-]*down|after( the)? workout|cardio|finisher|conditioning)\b/i.test(bare)){ if(!day) newDay("Day 01"); sec="cardio"; last=null; continue }
    }
    const isItem=/^(\d+\s*[.)]|[-•–·])\s*/.test(l) || urls.length;
    if(!isItem){ if(!day && !title) title=bare; continue }
    if(!day) newDay("Day 01");
    let name=l.replace(/^(\d+\s*[.)]|[-•–·])\s*/,"");
    const item={_urls:urls};
    const sr=name.match(/(\d+)\s*[x×]\s*(\d+(?:\s*[-–]\s*\d+)?(?:\s*\/\s*(?:side|leg|arm))?)/i);
    if(sr){ item.sets=+sr[1]; item.reps=sr[2].replace(/\s+/g,"").replace("–","-"); name=name.replace(sr[0]," ") }
    const mn=name.match(/(\d+)\s*(?:mins?|minutes?)\b/i);
    if(mn){ item.min=+mn[1]; name=name.replace(mn[0]," ") }
    name=name.replace(/\s+/g," ").replace(/^[\s\-–—:|,]+|[\s\-–—:|,\/]+$/g,"").trim();
    if(!name) continue;
    item.name=name; (sec==="warmup"?day.warmup:sec==="cardio"?day.cardio:day.exercises).push(item); last=item;
  }
  const fin=(it,i,isEx)=>{
    const out={name:it.name, video:it._urls[0]||""};
    if(it._urls.length>1){ const parts=it.name.split(/\s*\/\s*|\s+or\s+/i); out.videos=it._urls.map((u,k)=>({label:parts.length===it._urls.length?(p=>{p=parts[k].trim();p=p.length>16?p.split(" ")[0]:p;return p[0].toUpperCase()+p.slice(1)})():"Video "+(k+1),url:u})) }
    if(it.min) out.min=it.min;
    if(!isEx) return out;
    const n=it.name.toLowerCase();
    let d= i===0?[4,"6-8",150] : /crunch|plank|dead bug|bird dog|pallof|knee raise|leg raise|ab\b|core|twist/.test(n)?[3,"12-15",45]
      : /curl|raise|extension|fly|pushdown|push-down|calf|kickback|face pull|shrug/.test(n)?[3,"10-12",60] : [3,"8-10",90];
    if(/walk|run|bike|cycle|row(ing)? machine|elliptical|stair/.test(n)&&it.min) return out;
    return {...out,sets:it.sets||d[0],reps:it.reps||d[1],rest:d[2]};
  };
  const wk=(title.match(/week\s*(\d+)\s*[-–]\s*(\d+)/i)||title.match(/week\s*(\d+)/i));
  const tag=wk?" · Wk "+wk[1]+(wk[2]?"–"+wk[2]:""):"";
  return {title, routines:days.filter(d=>d.exercises.length||d.warmup.length).map((d,k)=>({
    name:d.name+tag, note:title,
    warmup:d.warmup.map(x=>fin(x,0,false)), cardio:d.cardio.map(x=>fin(x,0,false)),
    exercises:d.exercises.map((x,i)=>fin(x,i,true))
  }))};
}
