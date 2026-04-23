import { useState, useEffect, useRef } from "react";

// ─── Helpers ─────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);
const todayStr = () => new Date().toISOString().split("T")[0];
const nowStr = () => { const d=new Date(); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; };
const fmtDate = d => new Date(d+"T12:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});
const fmtDateShort = d => new Date(d+"T12:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short"});
const minsToLabel = m => { if(!m||m<=0)return""; if(m<60)return`${m}m`; const h=Math.floor(m/60),r=m%60; return r?`${h}h ${r}m`:`${h}h`; };
const getDaysInMonth = (y,m) => new Date(y,m+1,0).getDate();
const getFirstDayOfMonth = (y,m) => new Date(y,m,1).getDay();
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS_SHORT = ["Su","Mo","Tu","We","Th","Fr","Sa"];

// ─── Password helpers ─────────────────────────────────────────
const hashPassword = async (pw) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pw));
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
};

// ─── Constants ───────────────────────────────────────────────
const LIST_COLORS=["#8B6F47","#2980b9","#27ae60","#8e44ad","#c0392b","#e67e22","#16a085","#d35400"];
const LIST_ICONS=["📋","🏥","💊","🛒","💼","🏠","🎯","📚","🍽️","✈️","💪","🧘"];
const LEAD_OPTIONS=[
  {label:"At the time",mins:0},{label:"5 min before",mins:5},{label:"15 min before",mins:15},
  {label:"30 min before",mins:30},{label:"1 hr before",mins:60},{label:"2 hrs before",mins:120},{label:"1 day before",mins:1440},
];
const defaultLists=[
  {id:"l1",name:"Daily Routines",icon:"🏠",color:"#8B6F47",items:[
    {id:"i1",text:"Take morning medication",done:false,time:"08:00",reminderSet:false},
    {id:"i2",text:"Drink 2L water",done:false,time:"",reminderSet:false},
    {id:"i3",text:"Evening walk",done:false,time:"18:00",reminderSet:false},
  ]},
  {id:"l2",name:"GP Appointments",icon:"🏥",color:"#c0392b",items:[
    {id:"i4",text:"Blood test results follow-up",done:false,date:"2026-04-25",apptTime:"10:30",notes:"Fasting required",reminderSet:false},
    {id:"i5",text:"Migraine review",done:false,date:"2026-05-03",apptTime:"14:00",notes:"Bring symptom log",reminderSet:false},
  ]},
  {id:"l3",name:"Dietitian",icon:"🍽️",color:"#27ae60",items:[
    {id:"i6",text:"Dairy elimination check-in",done:false,date:"2026-05-10",apptTime:"11:00",notes:"Food diary ready",reminderSet:false},
  ]},
  {id:"l4",name:"Groceries",icon:"🛒",color:"#2980b9",items:[
    {id:"i7",text:"Lactose-free milk",done:false,reminderSet:false},
    {id:"i8",text:"Magnesium supplements",done:false,reminderSet:false},
    {id:"i9",text:"Ginger tea",done:false,reminderSet:false},
  ]},
  {id:"l5",name:"Work",icon:"💼",color:"#8e44ad",items:[
    {id:"i10",text:"Submit monthly report",done:false,time:"17:00",reminderSet:false},
    {id:"i11",text:"Team meeting prep",done:false,time:"09:00",reminderSet:false},
  ]},
];
const defaultSymTypes=[
  {id:"migraine",label:"Migraine",icon:"⚡",color:"#c0392b"},
  {id:"dairy",label:"Dairy Reaction",icon:"🥛",color:"#e67e22"},
  {id:"fatigue",label:"Fatigue",icon:"😴",color:"#8e44ad"},
  {id:"nausea",label:"Nausea",icon:"🤢",color:"#27ae60"},
  {id:"anxiety",label:"Anxiety",icon:"💭",color:"#2980b9"},
  {id:"headache",label:"Headache",icon:"🤕",color:"#d35400"},
  {id:"jointpain",label:"Joint Pain",icon:"🦴",color:"#7f8c8d"},
  {id:"rash",label:"Skin Reaction",icon:"🔴",color:"#e74c3c"},
  {id:"breathing",label:"Breathing",icon:"🫁",color:"#1abc9c"},
  {id:"other",label:"Other",icon:"📝",color:"#95a5a6"},
];
const TRIGGER_OPTIONS=["Stress","Poor sleep","Dairy","Alcohol","Bright light","Loud noise","Skipped meal","Hormonal","Weather change","Exercise","Caffeine","Screen time","Dehydration","Strong smell","Travel","Medications"];
const SEVERITY=[1,2,3,4,5,6,7,8,9,10];
const MED_PURPOSES=["Pain relief","Preventative","Anti-nausea","Antihistamine","Blood pressure","Mental health","Digestive","Sleep","Vitamin/supplement","Other"];

// ─── Shared styles ────────────────────────────────────────────
const SL={fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:"#9e8e7e",marginBottom:8,display:"block"};
const LAB={fontSize:11,color:"#9e8e7e",fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",display:"block",marginBottom:5};
const INP={fontFamily:"inherit",background:"white",border:"1.5px solid #e0d8d0",borderRadius:9,padding:"10px 13px",fontSize:14,color:"#1a1714",outline:"none",width:"100%"};

// ─── localStorage ─────────────────────────────────────────────
function usePersisted(key, initial) {
  const [val,setVal]=useState(()=>{try{const s=localStorage.getItem(key);return s?JSON.parse(s):initial;}catch{return initial;}});
  useEffect(()=>{try{localStorage.setItem(key,JSON.stringify(val));}catch{}},[key,val]);
  return [val,setVal];
}

// ══════════════════════════════════════════════════════════════
// Password Gate
// ══════════════════════════════════════════════════════════════
function PasswordGate({children}) {
  const [unlocked,setUnlocked]=useState(()=>sessionStorage.getItem("vitae_auth")==="1");
  const [pw,setPw]=useState(""); const [confirm,setConfirm]=useState("");
  const [error,setError]=useState(""); const [loading,setLoading]=useState(false);
  const [isFirst,setIsFirst]=useState(()=>!localStorage.getItem("vitae_hash"));

  const attempt=async()=>{
    setLoading(true); setError("");
    const hash=await hashPassword(pw);
    if(isFirst){
      if(pw.length<6){setError("Please choose at least 6 characters.");setLoading(false);return;}
      if(pw!==confirm){setError("Passwords don't match.");setLoading(false);return;}
      localStorage.setItem("vitae_hash",hash);
      sessionStorage.setItem("vitae_auth","1"); setUnlocked(true);
    } else {
      if(hash===localStorage.getItem("vitae_hash")){sessionStorage.setItem("vitae_auth","1");setUnlocked(true);}
      else{setError("Incorrect password.");setPw("");}
    }
    setLoading(false);
  };

  if(unlocked) return children;
  return (
    <div style={{minHeight:"100vh",background:"#f7f4ef",display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif"}}>
      <div style={{background:"white",borderRadius:20,padding:"36px 28px",maxWidth:340,width:"100%",border:"1px solid #e8e0d4",boxShadow:"0 8px 32px rgba(0,0,0,0.08)"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{width:64,height:64,borderRadius:18,background:"#8B6F47",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 14px",color:"white"}}>✦</div>
          <div style={{fontSize:26,fontWeight:700,letterSpacing:"-0.03em"}}>Vitae</div>
          <div style={{fontSize:13,color:"#9e8e7e",marginTop:4}}>{isFirst?"Create your password to get started":"Enter your password to continue"}</div>
        </div>
        {isFirst&&<div style={{background:"#f0faf5",border:"1px solid #c0e8d0",borderRadius:10,padding:"10px 13px",marginBottom:16,fontSize:13,color:"#27ae60",lineHeight:1.5}}>🔒 Your data stays on this device. Choose a strong password.</div>}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <input type="password" value={pw} onChange={e=>{setPw(e.target.value);setError("");}} onKeyDown={e=>e.key==="Enter"&&attempt()} placeholder={isFirst?"Choose a password":"Password"} autoFocus style={{...INP,padding:"12px 14px",fontSize:15}}/>
          {isFirst&&<input type="password" value={confirm} onChange={e=>{setConfirm(e.target.value);setError("");}} onKeyDown={e=>e.key==="Enter"&&attempt()} placeholder="Confirm password" style={{...INP,padding:"12px 14px",fontSize:15}}/>}
          {error&&<div style={{fontSize:13,color:"#c0392b",textAlign:"center"}}>{error}</div>}
          <button onClick={attempt} disabled={loading} style={{background:loading?"#c8b89a":"#8B6F47",color:"white",border:"none",borderRadius:10,padding:"13px",fontSize:15,cursor:"pointer",fontFamily:"inherit",fontWeight:600,marginTop:4}}>{loading?"Checking…":isFirst?"Set password & open Vitae":"Unlock"}</button>
        </div>
        <div style={{fontSize:11,color:"#b0a898",textAlign:"center",marginTop:16,lineHeight:1.6}}>Your password is stored only on this device.</div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Reminder Modal
// ══════════════════════════════════════════════════════════════
function ReminderModal({item,listName,listColor,onClose,onSaved}) {
  const [rDate,setRDate]=useState(item.date||todayStr());
  const [rTime,setRTime]=useState(item.apptTime||item.time||nowStr());
  const [rLead,setRLead]=useState(item.date?60:0);
  const [rNote,setRNote]=useState(item.notes||"");
  const [status,setStatus]=useState("idle"); const [errMsg,setErrMsg]=useState("");

  const schedule=async()=>{
    if(!rDate||!rTime){setErrMsg("Please choose date and time.");setStatus("error");return;}
    setStatus("saving");
    try{
      let perm=Notification.permission;
      if(perm==="default") perm=await Notification.requestPermission();
      if(perm!=="granted") throw new Error("Notification permission denied. On iPhone go to Settings → Safari → Notifications.");
      const [y,mo,d]=rDate.split("-").map(Number),[h,mi]=rTime.split(":").map(Number);
      const fireAt=new Date(y,mo-1,d,h,mi,0).getTime()-rLead*60000;
      const msUntil=fireAt-Date.now();
      if(msUntil<0) throw new Error("That time is in the past.");
      const reminders=JSON.parse(localStorage.getItem("vitae_reminders")||"[]");
      const nr={id:uid(),fireAt,title:"Vitae: "+item.text,body:[rNote,listName,fmtDate(rDate)].filter(Boolean).join(" · "),itemId:item.id};
      reminders.push(nr); localStorage.setItem("vitae_reminders",JSON.stringify(reminders));
      if(msUntil<86400000) setTimeout(()=>new Notification(nr.title,{body:nr.body,icon:"/icon-192.png"}),msUntil);
      await onSaved({item}); setStatus("done");
    }catch(e){setErrMsg(e.message||"Could not schedule.");setStatus("error");}
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(26,23,20,0.65)",zIndex:200,display:"flex",alignItems:"flex-end"}} onClick={onClose}>
      <div style={{background:"white",width:"100%",maxHeight:"92vh",borderRadius:"22px 22px 0 0",overflowY:"auto",padding:"10px 18px 44px",fontFamily:"'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif"}} onClick={e=>e.stopPropagation()}>
        <div style={{width:40,height:4,background:"#e0d8d0",borderRadius:4,margin:"10px auto 18px"}}/>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
          <div style={{width:42,height:42,borderRadius:12,background:listColor+"20",border:`2px solid ${listColor}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>🔔</div>
          <div><div style={{fontWeight:700,fontSize:17}}>Set reminder</div><div style={{fontSize:13,color:"#9e8e7e"}}>{item.text}</div></div>
        </div>
        {status==="done"?(
          <div style={{textAlign:"center",padding:"24px 0"}}><div style={{fontSize:52,marginBottom:14}}>✅</div><div style={{fontWeight:700,fontSize:18,marginBottom:8}}>Reminder scheduled!</div><button onClick={onClose} style={{background:"#8B6F47",color:"white",border:"none",borderRadius:11,padding:"13px 36px",fontSize:15,cursor:"pointer",fontFamily:"inherit"}}>Done</button></div>
        ):status==="error"?(
          <div style={{textAlign:"center",padding:"20px 0"}}><div style={{fontSize:40,marginBottom:10}}>⚠️</div><div style={{color:"#c0392b",fontSize:14,marginBottom:20,lineHeight:1.6,padding:"0 10px"}}>{errMsg}</div><button onClick={()=>{setStatus("idle");setErrMsg("");}} style={{background:"#f0ebe1",border:"none",borderRadius:9,padding:"11px 28px",cursor:"pointer",fontFamily:"inherit",fontSize:14}}>Try again</button></div>
        ):(
          <>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              <div><span style={LAB}>Date</span><input type="date" value={rDate} onChange={e=>setRDate(e.target.value)} style={INP}/></div>
              <div><span style={LAB}>Time</span><input type="time" value={rTime} onChange={e=>setRTime(e.target.value)} style={INP}/></div>
            </div>
            <div style={{marginBottom:18}}><span style={LAB}>Alert me</span><div style={{display:"flex",flexWrap:"wrap",gap:7,marginTop:4}}>{LEAD_OPTIONS.map(o=><button key={o.mins} onClick={()=>setRLead(o.mins)} style={{padding:"7px 13px",borderRadius:20,border:`1.5px solid ${rLead===o.mins?"#8B6F47":"#e0d8d0"}`,background:rLead===o.mins?"#8B6F47":"white",color:rLead===o.mins?"white":"#5a5048",fontSize:13,cursor:"pointer",fontFamily:"inherit",fontWeight:rLead===o.mins?600:400}}>{o.label}</button>)}</div></div>
            <div style={{marginBottom:18}}><span style={LAB}>Note (optional)</span><textarea value={rNote} onChange={e=>setRNote(e.target.value)} rows={2} placeholder="Any context…" style={{...INP,resize:"vertical"}}/></div>
            {rDate&&rTime&&<div style={{background:"#f7f4ef",borderRadius:10,padding:"12px 14px",marginBottom:18,fontSize:13,color:"#5a5048",lineHeight:1.6}}><strong style={{color:"#1a1714"}}>📅 {fmtDate(rDate)} at {rTime}</strong>{rLead>0&&<div style={{marginTop:2,color:"#9e8e7e"}}>🔔 {LEAD_OPTIONS.find(l=>l.mins===rLead)?.label}</div>}</div>}
            <button onClick={schedule} style={{width:"100%",background:"#8B6F47",color:"white",border:"none",borderRadius:11,padding:"14px",fontSize:15,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>🔔 Set reminder</button>
            <p style={{fontSize:11,color:"#b0a898",textAlign:"center",marginTop:12,lineHeight:1.5}}>On iPhone: add Vitae to Home Screen and allow notifications when prompted.</p>
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Main App
// ══════════════════════════════════════════════════════════════
function VitaeApp() {
  const today = todayStr();
  const [tab,setTab]=useState("calendar");

  // Persisted data
  const [lists,setLists]=usePersisted("vitae_lists",defaultLists);
  const [symptoms,setSymptoms]=usePersisted("vitae_symptoms",[]);
  const [symTypes,setSymTypes]=usePersisted("vitae_symtypes",defaultSymTypes);
  const [medications,setMedications]=usePersisted("vitae_medications",[]);
  const [dayTasks,setDayTasks]=usePersisted("vitae_daytasks",{}); // {dateStr: [{id,text,done}]}

  // Calendar state
  const now = new Date();
  const [calYear,setCalYear]=useState(now.getFullYear());
  const [calMonth,setCalMonth]=useState(now.getMonth());
  const [selectedDay,setSelectedDay]=useState(null); // dateStr or null

  // UI state
  const [activeList,setActiveList]=useState(null);
  const [activeSymId,setActiveSymId]=useState(null);
  const [showNewList,setShowNewList]=useState(false);
  const [showLogSym,setShowLogSym]=useState(false);
  const [showNewSymType,setShowNewSymType]=useState(false);
  const [showLogMed,setShowLogMed]=useState(false);
  const [showReport,setShowReport]=useState(false);
  const [reminderTarget,setReminderTarget]=useState(null);
  const [reportCopied,setReportCopied]=useState(false);
  const [showChangePw,setShowChangePw]=useState(false);
  const [cpCurrent,setCpCurrent]=useState(""); const [cpNew,setCpNew]=useState(""); const [cpConfirm,setCpConfirm]=useState(""); const [cpError,setCpError]=useState(""); const [cpDone,setCpDone]=useState(false);

  // New list form
  const [nlName,setNlName]=useState(""); const [nlIcon,setNlIcon]=useState("📋"); const [nlColor,setNlColor]=useState(LIST_COLORS[0]);

  // Symptom logger
  const blankSym={type:"migraine",severity:5,triggers:[],date:selectedDay||today,startTime:nowStr(),endTime:"",durationMins:0,notes:"",meds:"",location:"",aura:false};
  const [sym,setSym]=useState(blankSym);
  const [symTimerRunning,setSymTimerRunning]=useState(false);
  const [symTimerStart,setSymTimerStart]=useState(null);
  const [symTimerElapsed,setSymTimerElapsed]=useState(0);
  const timerRef=useRef(null);

  // Medication logger
  const blankMed={name:"",dose:"",unit:"mg",time:nowStr(),date:selectedDay||today,purpose:"Pain relief",notes:"",taken:true};
  const [med,setMed]=useState(blankMed);

  // New sym type
  const [nstLabel,setNstLabel]=useState(""); const [nstIcon,setNstIcon]=useState("🔔"); const [nstColor,setNstColor]=useState(LIST_COLORS[3]);

  // List item form
  const [niText,setNiText]=useState(""); const [niTime,setNiTime]=useState(""); const [niDate,setNiDate]=useState(""); const [niApptTime,setNiApptTime]=useState(""); const [niNotes,setNiNotes]=useState(""); const [isAppt,setIsAppt]=useState(false);
  const [editingListId,setEditingListId]=useState(null); const [editingListName,setEditingListName]=useState("");

  // Day task form
  const [dtText,setDtText]=useState(""); const [dtTime,setDtTime]=useState("");

  // Timer
  useEffect(()=>{
    if(symTimerRunning){timerRef.current=setInterval(()=>setSymTimerElapsed(Math.floor((Date.now()-symTimerStart)/1000)),1000);}
    else clearInterval(timerRef.current);
    return()=>clearInterval(timerRef.current);
  },[symTimerRunning,symTimerStart]);
  const startTimer=()=>{setSymTimerStart(Date.now());setSymTimerRunning(true);setSymTimerElapsed(0);setSym(s=>({...s,startTime:nowStr(),date:selectedDay||today}));};
  const stopTimer=()=>{setSymTimerRunning(false);setSym(s=>({...s,endTime:nowStr(),durationMins:Math.floor(symTimerElapsed/60)}));};
  const timerLabel=()=>{const h=Math.floor(symTimerElapsed/3600),m=Math.floor((symTimerElapsed%3600)/60),s=symTimerElapsed%60;return[h?`${h}h`:"",m?`${m}m`:"",`${s}s`].filter(Boolean).join(" ");};

  // Lists
  const addList=()=>{if(!nlName.trim())return;setLists(l=>[...l,{id:uid(),name:nlName.trim(),icon:nlIcon,color:nlColor,items:[]}]);setNlName("");setNlIcon("📋");setNlColor(LIST_COLORS[0]);setShowNewList(false);};
  const deleteList=lid=>{setLists(l=>l.filter(x=>x.id!==lid));if(activeList?.id===lid)setActiveList(null);};
  const updateListName=lid=>{setLists(l=>l.map(x=>x.id===lid?{...x,name:editingListName}:x));if(activeList?.id===lid)setActiveList(al=>({...al,name:editingListName}));setEditingListId(null);};
  const currentList=activeList?lists.find(l=>l.id===activeList.id):null;
  const addItem=()=>{
    if(!niText.trim()||!currentList)return;
    const item={id:uid(),text:niText.trim(),done:false,time:niTime,reminderSet:false};
    if(isAppt){item.date=niDate;item.apptTime=niApptTime;item.notes=niNotes;}
    setLists(l=>l.map(x=>x.id===currentList.id?{...x,items:[...x.items,item]}:x));
    setNiText("");setNiTime("");setNiDate("");setNiApptTime("");setNiNotes("");setIsAppt(false);
  };
  const toggleItem=(lid,iid)=>setLists(l=>l.map(x=>x.id===lid?{...x,items:x.items.map(it=>it.id===iid?{...it,done:!it.done}:it)}:x));
  const deleteItem=(lid,iid)=>setLists(l=>l.map(x=>x.id===lid?{...x,items:x.items.filter(it=>it.id!==iid)}:x));
  const markReminderSet=(lid,iid)=>setLists(l=>l.map(x=>x.id===lid?{...x,items:x.items.map(it=>it.id===iid?{...it,reminderSet:true}:it)}:x));

  // Day tasks
  const getDayTasks=d=>dayTasks[d]||[];
  const addDayTask=(d)=>{
    if(!dtText.trim())return;
    const t={id:uid(),text:dtText.trim(),done:false,time:dtTime};
    setDayTasks(dt=>({...dt,[d]:[...(dt[d]||[]),t]}));
    setDtText("");setDtTime("");
  };
  const toggleDayTask=(d,tid)=>setDayTasks(dt=>({...dt,[d]:(dt[d]||[]).map(t=>t.id===tid?{...t,done:!t.done}:t)}));
  const deleteDayTask=(d,tid)=>setDayTasks(dt=>({...dt,[d]:(dt[d]||[]).filter(t=>t.id!==tid)}));

  // Symptoms
  const calcDur=s=>{if(s.durationMins)return s.durationMins;if(s.startTime&&s.endTime){const[sh,sm]=s.startTime.split(":").map(Number),[eh,em]=s.endTime.split(":").map(Number);return Math.max(0,(eh*60+em)-(sh*60+sm));}return 0;};
  const logSymptom=()=>{setSymptoms(ss=>[{...sym,id:uid(),durationMins:calcDur(sym)},...ss]);setSym(blankSym);setSymTimerElapsed(0);setShowLogSym(false);};
  const deleteSymptom=id=>setSymptoms(ss=>ss.filter(s=>s.id!==id));
  const addSymType=()=>{if(!nstLabel.trim())return;setSymTypes(st=>[...st,{id:uid(),label:nstLabel.trim(),icon:nstIcon,color:nstColor}]);setNstLabel("");setNstIcon("🔔");setNstColor(LIST_COLORS[3]);setShowNewSymType(false);};
  const symInfo=type=>symTypes.find(st=>st.id===type)||{icon:"📝",label:type,color:"#95a5a6"};

  // Medications
  const logMed=()=>{
    if(!med.name.trim())return;
    setMedications(ms=>[{...med,id:uid()},...ms]);
    setMed(blankMed); setShowLogMed(false);
  };
  const deleteMed=id=>setMedications(ms=>ms.filter(m=>m.id!==id));

  // Calendar helpers
  const daysInMonth=getDaysInMonth(calYear,calMonth);
  const firstDay=getFirstDayOfMonth(calYear,calMonth);
  const prevMonth=()=>{if(calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}else setCalMonth(m=>m-1);};
  const nextMonth=()=>{if(calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}else setCalMonth(m=>m+1);};
  const getDayStr=(dayNum)=>`${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(dayNum).padStart(2,"0")}`;

  // What's on a given day
  const daySymptoms=d=>symptoms.filter(s=>s.date===d);
  const dayMeds=d=>medications.filter(m=>m.date===d);
  const dayAppts=d=>lists.flatMap(l=>l.items.filter(i=>i.date===d).map(i=>({...i,listColor:l.color,listName:l.name,listIcon:l.icon,listId:l.id})));
  const dayHasData=d=>getDayTasks(d).length>0||daySymptoms(d).length>0||dayMeds(d).length>0||dayAppts(d).length>0;

  // Patterns
  const migraines=symptoms.filter(s=>s.type==="migraine");
  const byType=symTypes.map(st=>({...st,count:symptoms.filter(s=>s.type===st.id).length})).filter(x=>x.count>0).sort((a,b)=>b.count-a.count);
  const trigCounts=symptoms.flatMap(s=>s.triggers).reduce((a,t)=>{a[t]=(a[t]||0)+1;return a;},{});
  const topTrigs=Object.entries(trigCounts).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const avgSev=migraines.length?(migraines.reduce((a,s)=>a+s.severity,0)/migraines.length).toFixed(1):"—";
  const migWithDur=migraines.filter(m=>m.durationMins>0);
  const avgDur=migWithDur.length?Math.round(migWithDur.reduce((a,m)=>a+m.durationMins,0)/migWithDur.length):0;
  const medCounts=medications.reduce((a,m)=>{const k=m.name+(m.dose?` ${m.dose}${m.unit}`:"");a[k]=(a[k]||0)+1;return a;},{});
  const topMeds=Object.entries(medCounts).sort((a,b)=>b[1]-a[1]).slice(0,8);

  // Appointments (all lists)
  const allAppts=lists.flatMap(l=>l.items.filter(i=>i.date).map(i=>({...i,listName:l.name,listColor:l.color,listIcon:l.icon,listId:l.id}))).sort((a,b)=>a.date.localeCompare(b.date));

  // Change password
  const lockApp=()=>{sessionStorage.removeItem("vitae_auth");window.location.reload();};
  const changePassword=async()=>{
    setCpError("");
    const curHash=await hashPassword(cpCurrent);
    if(curHash!==localStorage.getItem("vitae_hash")){setCpError("Current password is incorrect.");return;}
    if(cpNew.length<6){setCpError("New password must be at least 6 characters.");return;}
    if(cpNew!==cpConfirm){setCpError("New passwords don't match.");return;}
    localStorage.setItem("vitae_hash",await hashPassword(cpNew));
    setCpDone(true);setCpCurrent("");setCpNew("");setCpConfirm("");
    setTimeout(()=>{setShowChangePw(false);setCpDone(false);},1800);
  };

  // Report
  const report=`╔══════════════════════════════════════════╗
  VITAE HEALTH SUMMARY REPORT
  Generated: ${new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}
  Patient: [Your Name]
╚══════════════════════════════════════════╝

SYMPTOM OVERVIEW
${byType.map(bt=>`  ${bt.icon} ${bt.label}: ${bt.count} episode${bt.count>1?"s":""}`).join("\n")||"  None logged"}

MIGRAINES IN DETAIL (${migraines.length} episodes)
  Average severity : ${avgSev}/10
  Average duration : ${avgDur?minsToLabel(avgDur):"not recorded"}

${migraines.map(m=>`  DATE: ${fmtDate(m.date)}
  Time: ${m.startTime}${m.endTime?" – "+m.endTime:""} | Duration: ${m.durationMins?minsToLabel(m.durationMins):"not recorded"}
  Severity: ${m.severity}/10 | Aura: ${m.aura?"Yes":"No"}
  Triggers: ${m.triggers.join(", ")||"none noted"}
  Medication: ${m.meds||"none taken"}
  Notes: ${m.notes||"—"}`).join("\n\n")||"  None recorded"}

ALL OTHER SYMPTOM EPISODES
${symptoms.filter(s=>s.type!=="migraine").map(s=>{const t=symTypes.find(st=>st.id===s.type);return`  ${t?.icon||"📝"} ${t?.label||s.type} | ${fmtDate(s.date)}
  Severity: ${s.severity}/10 | Duration: ${s.durationMins?minsToLabel(s.durationMins):"not recorded"}
  Triggers: ${s.triggers.join(", ")||"none"} | Notes: ${s.notes||"—"}`;}).join("\n\n")||"  None"}

TOP TRIGGERS
${topTrigs.map(([t,c])=>`  • ${t}: ${c}×`).join("\n")||"  None identified"}

MEDICATIONS LOG (${medications.length} entries)
${medications.slice(0,30).map(m=>`  • ${m.date} ${m.time} — ${m.name}${m.dose?` ${m.dose}${m.unit}`:""}
    Purpose: ${m.purpose}${m.notes?" | Notes: "+m.notes:""}`).join("\n")||"  None logged"}

MOST USED MEDICATIONS
${topMeds.map(([m,c])=>`  • ${m}: ${c}×`).join("\n")||"  None"}

UPCOMING APPOINTMENTS
${allAppts.filter(a=>!a.done&&a.date>=today).map(a=>`  • [${a.listName}] ${fmtDate(a.date)}${a.apptTime?" at "+a.apptTime:""}: ${a.text}${a.notes?"\n    Note: "+a.notes:""}`).join("\n")||"  None"}
`;
  const copyReport=()=>{navigator.clipboard.writeText(report);setReportCopied(true);setTimeout(()=>setReportCopied(false),2500);};

  const handleReminderSaved=({item})=>{
    if(reminderTarget?.listId) markReminderSet(reminderTarget.listId,item.id);
    setReminderTarget(null); return Promise.resolve();
  };

  const BellBtn=({item,listName,listColor,listId})=>(
    <button title={item.reminderSet?"Reminder set":"Set reminder"} onClick={e=>{e.stopPropagation();setReminderTarget({item,listName,listColor,listId});}} style={{background:item.reminderSet?"#edfaed":"#faf8f4",border:`1.5px solid ${item.reminderSet?"#9ed89e":"#e0d8d0"}`,borderRadius:9,padding:"5px 9px",fontSize:14,cursor:"pointer",color:item.reminderSet?"#27ae60":"#9e8e7e",flexShrink:0,display:"flex",alignItems:"center",gap:3}}>
      🔔{item.reminderSet&&<span style={{fontSize:10,fontWeight:700}}>✓</span>}
    </button>
  );

  // ── Day Detail View (renders inside calendar tab) ──────────
  const renderDayView=()=>{
    const d=selectedDay;
    const dt=getDayTasks(d);
    const ds=daySymptoms(d);
    const dm=dayMeds(d);
    const da=dayAppts(d);
    const dLabel=new Date(d+"T12:00:00").toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"});
    return(
      <div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
          <button onClick={()=>setSelectedDay(null)} style={{background:"none",border:"none",color:"#8B6F47",fontSize:20,padding:"0 3px",flexShrink:0}}>‹</button>
          <div>
            <div style={{fontWeight:700,fontSize:17}}>{dLabel}</div>
            {d===today&&<span style={{fontSize:11,background:"#8B6F47",color:"white",borderRadius:20,padding:"2px 8px",marginTop:3,display:"inline-block"}}>Today</span>}
          </div>
        </div>

        {/* Appointments for this day */}
        {da.length>0&&(
          <div style={{marginBottom:14}}>
            <span style={SL}>📅 Appointments</span>
            <div className="ct">
              {da.map(a=>(
                <div key={a.id} className="row" style={{borderLeft:`4px solid ${a.listColor}`}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:600}}>{a.text}</div>
                    <div style={{fontSize:12,color:"#9e8e7e"}}>{a.listIcon} {a.listName}{a.apptTime?" · "+a.apptTime:""}</div>
                    {a.notes&&<div style={{fontSize:12,fontStyle:"italic",color:"#9e8e7e"}}>{a.notes}</div>}
                  </div>
                  <BellBtn item={a} listName={a.listName} listColor={a.listColor} listId={a.listId}/>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Day to-do list */}
        <div style={{marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={SL}>✅ Day tasks</span>
            <span style={{fontSize:12,color:"#9e8e7e"}}>{dt.filter(t=>t.done).length}/{dt.length} done</span>
          </div>
          {dt.length>0&&(
            <div className="ct" style={{marginBottom:10}}>
              {dt.map(t=>(
                <div key={t.id} className="row">
                  <div onClick={()=>toggleDayTask(d,t.id)} style={{width:22,height:22,borderRadius:"50%",border:`2px solid ${t.done?"#8B6F47":"#ddd5c5"}`,background:t.done?"#8B6F47":"white",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer",transition:"all 0.15s"}}>
                    {t.done&&<span style={{color:"white",fontSize:11}}>✓</span>}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,textDecoration:t.done?"line-through":"none",color:t.done?"#9e8e7e":"#1a1714"}}>{t.text}</div>
                    {t.time&&<div style={{fontSize:12,color:"#9e8e7e"}}>🕐 {t.time}</div>}
                  </div>
                  <button onClick={()=>deleteDayTask(d,t.id)} style={{background:"none",border:"none",color:"#d0c8be",fontSize:18}}>×</button>
                </div>
              ))}
            </div>
          )}
          <div style={{display:"flex",gap:8"}}>
            <input value={dtText} onChange={e=>setDtText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addDayTask(d)} placeholder="Add a task for this day…" style={{flex:1}}/>
            <input type="time" value={dtTime} onChange={e=>setDtTime(e.target.value)} style={{width:100,flexShrink:0}}/>
            <button className="bp" onClick={()=>addDayTask(d)} style={{padding:"9px 14px",flexShrink:0}}>+</button>
          </div>
        </div>

        {/* Symptoms logged this day */}
        <div style={{marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={SL}>⚡ Symptoms</span>
            <button className="bg" style={{fontSize:11,padding:"4px 10px"}} onClick={()=>{setSym({...blankSym,date:d});setShowLogSym(true);}}>+ Log</button>
          </div>
          {ds.length===0&&<div style={{fontSize:13,color:"#9e8e7e",fontStyle:"italic",marginBottom:8}}>No symptoms logged</div>}
          {ds.map(s=>{
            const si=symInfo(s.type); const isOpen=activeSymId===s.id;
            return(
              <div key={s.id} style={{background:"white",border:`1.5px solid ${si.color}33`,borderLeft:`4px solid ${si.color}`,borderRadius:12,marginBottom:8,overflow:"hidden"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,padding:"11px 13px",cursor:"pointer"}} onClick={()=>setActiveSymId(isOpen?null:s.id)}>
                  <span style={{fontSize:17}}>{si.icon}</span>
                  <div style={{flex:1}}><div style={{fontWeight:600,fontSize:14}}>{si.label}</div><div style={{fontSize:12,color:"#9e8e7e"}}>{s.startTime}{s.endTime?" – "+s.endTime:""}{s.durationMins>0?" · "+minsToLabel(s.durationMins):""}</div></div>
                  <span className="chip" style={{background:si.color+"18",color:si.color,fontSize:11}}>{s.severity}/10</span>
                  <span style={{color:"#c8bfb4",fontSize:15,transform:isOpen?"rotate(90deg)":"none",transition:"transform 0.2s"}}>›</span>
                </div>
                {isOpen&&<div style={{padding:"0 13px 13px",borderTop:"1px solid #f0ebe1"}}>
                  {s.triggers.length>0&&<div style={{marginTop:8,fontSize:13,color:"#9e8e7e"}}>Triggers: {s.triggers.join(", ")}</div>}
                  {s.aura&&<div style={{marginTop:6,fontSize:13,color:"#c0392b"}}>⚠ Aura</div>}
                  {s.meds&&<div style={{marginTop:6,fontSize:13}}>💊 {s.meds}</div>}
                  {s.notes&&<div style={{marginTop:6,fontSize:13,fontStyle:"italic"}}>{s.notes}</div>}
                  <button className="bd" onClick={()=>deleteSymptom(s.id)} style={{marginTop:10,fontSize:11}}>Delete</button>
                </div>}
              </div>
            );
          })}
        </div>

        {/* Medications this day */}
        <div style={{marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={SL}>💊 Medications</span>
            <button className="bg" style={{fontSize:11,padding:"4px 10px"}} onClick={()=>{setMed({...blankMed,date:d});setShowLogMed(true);}}>+ Log</button>
          </div>
          {dm.length===0&&<div style={{fontSize:13,color:"#9e8e7e",fontStyle:"italic"}}>No medications logged</div>}
          {dm.length>0&&<div className="ct">{dm.map(m=>(
            <div key={m.id} className="row">
              <div style={{width:36,height:36,borderRadius:9,background:"#f0faf5",border:"1px solid #c0e8d0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>💊</div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:600}}>{m.name}{m.dose?` — ${m.dose}${m.unit}`:""}</div>
                <div style={{fontSize:12,color:"#9e8e7e"}}>{m.time} · {m.purpose}</div>
                {m.notes&&<div style={{fontSize:12,color:"#9e8e7e",fontStyle:"italic"}}>{m.notes}</div>}
              </div>
              <button onClick={()=>deleteMed(m.id)} style={{background:"none",border:"none",color:"#d0c8be",fontSize:18}}>×</button>
            </div>
          ))}</div>}
        </div>
      </div>
    );
  };

  // ── Calendar grid ──────────────────────────────────────────
  const renderCalendar=()=>(
    <div>
      {/* Month nav */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <button onClick={prevMonth} style={{background:"none",border:"none",fontSize:22,color:"#8B6F47",padding:"4px 8px"}}>‹</button>
        <div style={{fontWeight:700,fontSize:18}}>{MONTHS[calMonth]} {calYear}</div>
        <button onClick={nextMonth} style={{background:"none",border:"none",fontSize:22,color:"#8B6F47",padding:"4px 8px"}}>›</button>
      </div>

      {/* Day headers */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
        {DAYS_SHORT.map(d=><div key={d} style={{textAlign:"center",fontSize:11,fontWeight:700,color:"#9e8e7e",padding:"4px 0",letterSpacing:"0.05em"}}>{d}</div>)}
      </div>

      {/* Day cells */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
        {Array.from({length:firstDay}).map((_,i)=><div key={"e"+i}/>)}
        {Array.from({length:daysInMonth}).map((_,i)=>{
          const dayNum=i+1;
          const dStr=getDayStr(dayNum);
          const isToday=dStr===today;
          const isSel=dStr===selectedDay;
          const hasData=dayHasData(dStr);
          const ds=daySymptoms(dStr);
          const dm=dayMeds(dStr);
          const hasMig=ds.some(s=>s.type==="migraine");
          const hasSym=ds.length>0;
          const hasMed=dm.length>0;
          const hasAppt=dayAppts(dStr).length>0;
          return(
            <div key={dStr} onClick={()=>setSelectedDay(dStr)} style={{
              borderRadius:10,
              padding:"6px 4px",
              minHeight:52,
              background:isSel?"#8B6F47":isToday?"#f7f2eb":"white",
              border:`1.5px solid ${isSel?"#8B6F47":isToday?"#8B6F47":"#f0ebe1"}`,
              cursor:"pointer",
              transition:"all 0.12s",
              display:"flex",flexDirection:"column",alignItems:"center",gap:3,
            }}>
              <div style={{fontSize:14,fontWeight:isToday||isSel?700:400,color:isSel?"white":isToday?"#8B6F47":"#1a1714"}}>{dayNum}</div>
              {/* Dots */}
              <div style={{display:"flex",gap:2,flexWrap:"wrap",justifyContent:"center"}}>
                {hasMig&&<div style={{width:6,height:6,borderRadius:"50%",background:isSel?"rgba(255,255,255,0.8)":"#c0392b"}}/>}
                {hasSym&&!hasMig&&<div style={{width:6,height:6,borderRadius:"50%",background:isSel?"rgba(255,255,255,0.8)":"#e67e22"}}/>}
                {hasMed&&<div style={{width:6,height:6,borderRadius:"50%",background:isSel?"rgba(255,255,255,0.8)":"#27ae60"}}/>}
                {hasAppt&&<div style={{width:6,height:6,borderRadius:"50%",background:isSel?"rgba(255,255,255,0.8)":"#2980b9"}}/>}
                {getDayTasks(dStr).length>0&&<div style={{width:6,height:6,borderRadius:"50%",background:isSel?"rgba(255,255,255,0.8)":"#8B6F47"}}/>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{display:"flex",gap:14,flexWrap:"wrap",marginTop:14,padding:"10px 0",borderTop:"1px solid #f0ebe1"}}>
        {[["#c0392b","Migraine"],["#e67e22","Symptom"],["#27ae60","Medication"],["#2980b9","Appointment"],["#8B6F47","Task"]].map(([c,l])=>(
          <div key={l} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"#9e8e7e"}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:c,flexShrink:0}}/>
            {l}
          </div>
        ))}
      </div>

      {/* Today's summary quick card */}
      <div className="card" style={{marginTop:4,cursor:"pointer",border:"1.5px solid #8B6F47"+"33"}} onClick={()=>setSelectedDay(today)}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontWeight:700,fontSize:14}}>Today — {new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})}</div>
            <div style={{fontSize:12,color:"#9e8e7e",marginTop:3}}>
              {getDayTasks(today).length} task{getDayTasks(today).length!==1?"s":""} · {daySymptoms(today).length} symptom{daySymptoms(today).length!==1?"s":""} · {dayMeds(today).length} med{dayMeds(today).length!==1?"s":""}
            </div>
          </div>
          <span style={{color:"#8B6F47",fontSize:18}}>›</span>
        </div>
      </div>
    </div>
  );

  // ── Log Symptom (full screen) ──────────────────────────────
  const renderLogSym=()=>(
    <div>
      <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:16}}>
        <button onClick={()=>{setShowLogSym(false);setSymTimerRunning(false);setSym(blankSym);setSymTimerElapsed(0);}} style={{background:"none",border:"none",color:"#8B6F47",fontSize:20}}>‹</button>
        <h2 style={{fontSize:17,fontWeight:700}}>Log a symptom</h2>
        <span style={{marginLeft:"auto",fontSize:12,color:"#9e8e7e"}}>{fmtDateShort(sym.date)}</span>
      </div>
      <div className="card"><span style={SL}>Symptom type</span><div style={{display:"flex",flexWrap:"wrap",gap:7,marginTop:4}}>{symTypes.map(st=><button key={st.id} style={{flex:"1 0 80px",padding:"9px 5px",borderRadius:11,border:`2px solid ${sym.type===st.id?st.color:"#e8e0d4"}`,background:sym.type===st.id?st.color:"white",color:sym.type===st.id?"white":st.color,fontSize:12,textAlign:"center",cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s"}} onClick={()=>setSym(s=>({...s,type:st.id}))}><div style={{fontSize:18,marginBottom:2}}>{st.icon}</div><div style={{fontSize:11}}>{st.label}</div></button>)}</div></div>
      <div className="card" style={{textAlign:"center",background:symTimerRunning?"#fff5f5":"white",border:symTimerRunning?"1.5px solid #f5c6c6":"1.5px solid #e8e0d4"}}>
        <span style={SL}>Duration</span>
        {symTimerRunning?(<><div style={{fontSize:40,fontWeight:700,color:"#c0392b",letterSpacing:"-1px",fontVariantNumeric:"tabular-nums"}} className="pulse">{timerLabel()}</div><div style={{fontSize:12,color:"#9e8e7e",marginTop:4}}>Started {sym.startTime}</div><button className="bp" onClick={stopTimer} style={{marginTop:12,background:"#c0392b",width:"100%"}}>Stop timer</button></>):(
          <>{sym.durationMins>0?<div style={{fontSize:26,fontWeight:700,color:"#8B6F47",margin:"6px 0"}}>{minsToLabel(sym.durationMins)}</div>:<div style={{fontSize:13,color:"#9e8e7e",margin:"6px 0"}}>Use live timer or enter times</div>}<button className="bp" onClick={startTimer} style={{width:"100%",marginBottom:10}}>▶ Start live timer</button><div style={{display:"flex",gap:8}}><div style={{flex:1,textAlign:"left"}}><label style={{fontSize:11,color:"#9e8e7e"}}>Start</label><input type="time" value={sym.startTime} onChange={e=>setSym(s=>({...s,startTime:e.target.value}))} style={{marginTop:4}}/></div><div style={{flex:1,textAlign:"left"}}><label style={{fontSize:11,color:"#9e8e7e"}}>End</label><input type="time" value={sym.endTime} onChange={e=>setSym(s=>({...s,endTime:e.target.value,durationMins:0}))} style={{marginTop:4}}/></div></div></>
        )}
      </div>
      <div className="card"><span style={SL}>Severity</span><div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:4}}>{SEVERITY.map(n=><button key={n} onClick={()=>setSym(s=>({...s,severity:n}))} style={{width:30,height:30,borderRadius:7,border:`2px solid ${sym.severity===n?"#c0392b":"transparent"}`,fontSize:12,fontWeight:700,background:sym.severity===n?"#c0392b":"#f0ebe1",color:sym.severity===n?"white":"#9e8e7e",transition:"all 0.1s",fontFamily:"inherit"}}>{n}</button>)}</div><div style={{marginTop:7,fontSize:12,color:"#9e8e7e"}}>{sym.severity<=3?"Mild":sym.severity<=6?"Moderate":"Severe — significant impact"}</div></div>
      <div className="card"><span style={SL}>Triggers</span><div style={{marginTop:4}}>{TRIGGER_OPTIONS.map(t=><button key={t} onClick={()=>setSym(s=>({...s,triggers:s.triggers.includes(t)?s.triggers.filter(x=>x!==t):[...s.triggers,t]}))} style={{display:"inline-block",padding:"5px 12px",borderRadius:20,border:`1.5px solid ${sym.triggers.includes(t)?"#8B6F47":"#e8e0d4"}`,fontSize:13,cursor:"pointer",margin:3,background:sym.triggers.includes(t)?"#8B6F47":"white",color:sym.triggers.includes(t)?"white":"#1a1714",fontFamily:"inherit"}}>{t}</button>)}</div></div>
      <div className="card"><div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div><span style={LAB}>Date</span><input type="date" value={sym.date} onChange={e=>setSym(s=>({...s,date:e.target.value}))}/></div>
        {sym.type==="migraine"&&<label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer"}}><input type="checkbox" checked={sym.aura} onChange={e=>setSym(s=>({...s,aura:e.target.checked}))} style={{width:"auto",accentColor:"#c0392b"}}/>Aura present</label>}
        <div><span style={LAB}>Medication taken</span><input value={sym.meds} onChange={e=>setSym(s=>({...s,meds:e.target.value}))} placeholder="e.g. Sumatriptan 50mg"/></div>
        <div><span style={LAB}>Location / context</span><input value={sym.location} onChange={e=>setSym(s=>({...s,location:e.target.value}))} placeholder="e.g. At work, travelling"/></div>
        <div><span style={LAB}>Notes</span><textarea value={sym.notes} onChange={e=>setSym(s=>({...s,notes:e.target.value}))} rows={3} placeholder="Describe symptoms, what helped…"/></div>
      </div></div>
      <button className="bp" onClick={logSymptom} style={{width:"100%",padding:"13px",fontSize:15,borderRadius:11}}>Save to health record →</button>
    </div>
  );

  // ── Log Medication (full screen) ───────────────────────────
  const renderLogMed=()=>(
    <div>
      <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:16}}>
        <button onClick={()=>{setShowLogMed(false);setMed(blankMed);}} style={{background:"none",border:"none",color:"#8B6F47",fontSize:20}}>‹</button>
        <h2 style={{fontSize:17,fontWeight:700}}>Log medication</h2>
        <span style={{marginLeft:"auto",fontSize:12,color:"#9e8e7e"}}>{fmtDateShort(med.date)}</span>
      </div>
      <div className="card"><div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div><span style={LAB}>Medication name</span><input value={med.name} onChange={e=>setMed(m=>({...m,name:e.target.value}))} placeholder="e.g. Sumatriptan, Ibuprofen, Metoprolol"/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 80px",gap:8}}>
          <div><span style={LAB}>Dose</span><input value={med.dose} onChange={e=>setMed(m=>({...m,dose:e.target.value}))} placeholder="e.g. 50"/></div>
          <div><span style={LAB}>Unit</span>
            <select value={med.unit} onChange={e=>setMed(m=>({...m,unit:e.target.value}))} style={{fontFamily:"inherit",background:"white",border:"1.5px solid #e0d8d0",borderRadius:9,padding:"9px 8px",fontSize:14,color:"#1a1714",outline:"none",width:"100%"}}>
              {["mg","mcg","g","ml","tablet(s)","capsule(s)","puff(s)","drop(s)","IU","other"].map(u=><option key={u}>{u}</option>)}
            </select>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <div><span style={LAB}>Date</span><input type="date" value={med.date} onChange={e=>setMed(m=>({...m,date:e.target.value}))}/></div>
          <div><span style={LAB}>Time taken</span><input type="time" value={med.time} onChange={e=>setMed(m=>({...m,time:e.target.value}))}/></div>
        </div>
        <div><span style={LAB}>Purpose</span>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:4}}>
            {MED_PURPOSES.map(p=><button key={p} onClick={()=>setMed(m=>({...m,purpose:p}))} style={{padding:"6px 12px",borderRadius:20,border:`1.5px solid ${med.purpose===p?"#27ae60":"#e0d8d0"}`,background:med.purpose===p?"#27ae60":"white",color:med.purpose===p?"white":"#5a5048",fontSize:13,cursor:"pointer",fontFamily:"inherit",transition:"all 0.12s"}}>{p}</button>)}
          </div>
        </div>
        <div><span style={LAB}>Notes (side effects, reason for dose, etc.)</span><textarea value={med.notes} onChange={e=>setMed(m=>({...m,notes:e.target.value}))} rows={2} placeholder="e.g. Took for breakthrough migraine, mild drowsiness"/></div>
      </div></div>
      <button className="bp" onClick={logMed} style={{width:"100%",padding:"13px",fontSize:15,borderRadius:11}}>Save medication log →</button>
    </div>
  );

  // ── Lists tab ──────────────────────────────────────────────
  const renderLists=()=>(
    <div>
      {!activeList?(
        <>
          <span style={SL}>General lists</span>
          {showNewList&&(
            <div className="card" style={{background:"#faf8f4",border:"1.5px solid #ddd5c5",marginBottom:16}}>
              <span style={SL}>New list</span>
              <input value={nlName} onChange={e=>setNlName(e.target.value)} placeholder="List name…" style={{marginBottom:10}}/>
              <span style={SL}>Icon</span>
              <div style={{display:"flex",flexWrap:"wrap",gap:6,margin:"6px 0 14px"}}>{LIST_ICONS.map(ic=><button key={ic} onClick={()=>setNlIcon(ic)} style={{width:37,height:37,borderRadius:9,border:`2px solid ${nlIcon===ic?"#8B6F47":"#e8e0d4"}`,fontSize:17,background:nlIcon===ic?"#f7f2eb":"white",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>{ic}</button>)}</div>
              <span style={SL}>Colour</span>
              <div style={{display:"flex",gap:8,margin:"6px 0 14px",flexWrap:"wrap"}}>{LIST_COLORS.map(c=><button key={c} onClick={()=>setNlColor(c)} style={{width:27,height:27,borderRadius:"50%",border:`3px solid ${nlColor===c?"#1a1714":"transparent"}`,background:c}}/>)}</div>
              <div style={{display:"flex",gap:8}}><button className="bp" onClick={addList} style={{flex:1}}>Create list</button><button className="bg" onClick={()=>setShowNewList(false)}>Cancel</button></div>
            </div>
          )}
          {lists.map(l=>{
            const done=l.items.filter(i=>i.done).length;
            const bells=l.items.filter(i=>i.reminderSet).length;
            const upcoming=l.items.filter(i=>i.date&&!i.done);
            return(
              <div key={l.id} onClick={()=>setActiveList(l)} style={{padding:16,borderRadius:14,border:`1.5px solid ${l.color}44`,background:"white",marginBottom:10,cursor:"pointer"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:40,height:40,borderRadius:10,background:l.color+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,border:`1.5px solid ${l.color}33`}}>{l.icon}</div>
                    <div>
                      <div style={{fontWeight:700,fontSize:15}}>{l.name}</div>
                      <div style={{fontSize:12,color:"#9e8e7e"}}>{l.items.length} item{l.items.length!==1?"s":""}{l.items.length>0?` · ${done} done`:""}{bells>0?` · 🔔 ${bells}`:""}</div>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:7}}>
                    {upcoming.length>0&&<span style={{display:"inline-block",padding:"3px 10px",borderRadius:20,fontSize:12,fontWeight:600,background:l.color+"18",color:l.color}}>📅 {upcoming.length}</span>}
                    <span style={{color:"#c8bfb4",fontSize:18}}>›</span>
                  </div>
                </div>
                {l.items.length>0&&<div style={{marginTop:10,height:5,background:"#f0ebe1",borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:`${done/l.items.length*100}%`,background:l.color,borderRadius:4,transition:"width 0.4s"}}/></div>}
              </div>
            );
          })}
          {lists.length===0&&<div style={{textAlign:"center",color:"#9e8e7e",padding:40}}>No lists yet</div>}
        </>
      ):(
        <>
          <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:16}}>
            <button onClick={()=>setActiveList(null)} style={{background:"none",border:"none",color:"#8B6F47",fontSize:20,padding:"0 3px"}}>‹</button>
            <div style={{width:33,height:33,borderRadius:9,background:currentList.color+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,border:`1.5px solid ${currentList.color}33`,flexShrink:0}}>{currentList.icon}</div>
            {editingListId===currentList.id
              ?<input value={editingListName} onChange={e=>setEditingListName(e.target.value)} onBlur={()=>updateListName(currentList.id)} onKeyDown={e=>e.key==="Enter"&&updateListName(currentList.id)} autoFocus style={{flex:1,fontWeight:700,fontSize:15,border:"none",borderBottom:"2px solid #8B6F47",borderRadius:0,padding:"2px 0",background:"transparent"}}/>
              :<div style={{flex:1,fontWeight:700,fontSize:15,cursor:"text"}} onDoubleClick={()=>{setEditingListId(currentList.id);setEditingListName(currentList.name);}}>{currentList.name}</div>
            }
            <button style={{background:"#fef0f0",color:"#c0392b",border:"1.5px solid #f5c6c6",borderRadius:8,padding:"7px 12px",fontSize:12}} onClick={()=>deleteList(currentList.id)}>Delete</button>
          </div>
          {currentList.items.length>0&&(
            <div className="ct" style={{marginBottom:14}}>
              {currentList.items.map(it=>(
                <div key={it.id} className="row" style={{background:it.done?"#fafaf8":"white",flexWrap:"wrap"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0}}>
                    <div onClick={()=>toggleItem(currentList.id,it.id)} style={{width:22,height:22,borderRadius:"50%",border:`2px solid ${it.done?currentList.color:"#ddd5c5"}`,background:it.done?currentList.color:"white",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer",transition:"all 0.15s"}}>{it.done&&<span style={{color:"white",fontSize:11}}>✓</span>}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,textDecoration:it.done?"line-through":"none",color:it.done?"#9e8e7e":"#1a1714",wordBreak:"break-word"}}>{it.text}</div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:it.time||it.date?3:0}}>
                        {it.time&&<span style={{fontSize:11.5,color:"#9e8e7e"}}>🕐 {it.time}</span>}
                        {it.date&&<span style={{display:"inline-block",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,background:currentList.color+"18",color:currentList.color}}>📅 {fmtDateShort(it.date)}{it.apptTime?" "+it.apptTime:""}</span>}
                        {it.reminderSet&&<span style={{display:"inline-block",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,background:"#edfaed",color:"#27ae60"}}>🔔 Set</span>}
                      </div>
                      {it.notes&&<div style={{fontSize:12,color:"#9e8e7e",fontStyle:"italic",marginTop:2}}>{it.notes}</div>}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0}}>
                    <BellBtn item={it} listName={currentList.name} listColor={currentList.color} listId={currentList.id}/>
                    <button onClick={()=>deleteItem(currentList.id,it.id)} style={{background:"none",border:"none",color:"#d0c8be",fontSize:18}}>×</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="card" style={{background:"#faf8f4"}}>
            <span style={SL}>Add item</span>
            <input value={niText} onChange={e=>setNiText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addItem()} placeholder="Item text…" style={{marginBottom:8}}/>
            <div style={{display:"flex",gap:8,marginBottom:8}}>
              <div style={{flex:1}}><label style={{fontSize:11,color:"#9e8e7e"}}>Time reminder</label><input type="time" value={niTime} onChange={e=>setNiTime(e.target.value)} style={{marginTop:4}}/></div>
              <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}><label style={{display:"flex",alignItems:"center",gap:7,fontSize:13,cursor:"pointer",marginBottom:6}}><input type="checkbox" checked={isAppt} onChange={e=>setIsAppt(e.target.checked)} style={{width:"auto",accentColor:"#8B6F47"}}/>Appointment?</label></div>
            </div>
            {isAppt&&<div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:8}}>
              <div style={{display:"flex",gap:8}}>
                <div style={{flex:1}}><label style={{fontSize:11,color:"#9e8e7e"}}>Date</label><input type="date" value={niDate} onChange={e=>setNiDate(e.target.value)} style={{marginTop:4}}/></div>
                <div style={{flex:1}}><label style={{fontSize:11,color:"#9e8e7e"}}>Appt time</label><input type="time" value={niApptTime} onChange={e=>setNiApptTime(e.target.value)} style={{marginTop:4}}/></div>
              </div>
              <input value={niNotes} onChange={e=>setNiNotes(e.target.value)} placeholder="Prep notes…"/>
            </div>}
            <button className="bp" onClick={addItem} style={{width:"100%",marginTop:4}}>Add to list</button>
          </div>
        </>
      )}
    </div>
  );

  // ── Health tab (symptoms + meds log) ──────────────────────
  const renderHealth=()=>(
    <div>
      {/* Medications section */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
        <span style={SL}>💊 Medications</span>
        <button className="bg" style={{fontSize:11,padding:"5px 10px"}} onClick={()=>{setMed(blankMed);setShowLogMed(true);}}>+ Log medication</button>
      </div>
      {medications.length>0&&(
        <div className="ct" style={{marginBottom:16}}>
          {medications.slice(0,10).map(m=>(
            <div key={m.id} className="row">
              <div style={{width:34,height:34,borderRadius:9,background:"#f0faf5",border:"1px solid #c0e8d0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>💊</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:600}}>{m.name}{m.dose?` — ${m.dose}${m.unit}`:""}</div>
                <div style={{fontSize:12,color:"#9e8e7e"}}>{fmtDateShort(m.date)} {m.time} · {m.purpose}</div>
                {m.notes&&<div style={{fontSize:12,color:"#9e8e7e",fontStyle:"italic"}}>{m.notes}</div>}
              </div>
              <button onClick={()=>deleteMed(m.id)} style={{background:"none",border:"none",color:"#d0c8be",fontSize:18}}>×</button>
            </div>
          ))}
          {medications.length>10&&<div style={{padding:"10px 14px",fontSize:12,color:"#9e8e7e",textAlign:"center"}}>{medications.length-10} more entries — see Patterns tab</div>}
        </div>
      )}
      {medications.length===0&&<div style={{fontSize:13,color:"#9e8e7e",fontStyle:"italic",marginBottom:16}}>No medications logged yet</div>}

      {/* Symptoms section */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
        <span style={SL}>⚡ Symptoms</span>
        <div style={{display:"flex",gap:7}}>
          <button className="bg" style={{fontSize:11,padding:"5px 10px"}} onClick={()=>setShowNewSymType(true)}>+ Type</button>
          <button className="bg" style={{fontSize:11,padding:"5px 10px"}} onClick={()=>{setSym(blankSym);setShowLogSym(true);}}>+ Log</button>
        </div>
      </div>
      <div className="card" style={{marginBottom:12}}>
        <span style={SL}>Tracked types</span>
        <div style={{display:"flex",flexWrap:"wrap",gap:7}}>{symTypes.map(st=><span key={st.id} style={{display:"inline-block",padding:"3px 10px",borderRadius:20,fontSize:13,fontWeight:600,background:st.color+"18",color:st.color,border:`1px solid ${st.color}33`}}>{st.icon} {st.label} <span style={{opacity:0.5,marginLeft:2}}>{symptoms.filter(s=>s.type===st.id).length}</span></span>)}</div>
      </div>
      {showNewSymType&&(
        <div className="card" style={{background:"#faf8f4",border:"1.5px solid #ddd5c5",marginBottom:12}}>
          <span style={SL}>New symptom type</span>
          <input value={nstLabel} onChange={e=>setNstLabel(e.target.value)} placeholder="Name…" style={{marginBottom:8}}/>
          <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:12}}>
            <div><span style={LAB}>Icon</span><input value={nstIcon} onChange={e=>setNstIcon(e.target.value)} style={{width:54,textAlign:"center",fontSize:22,padding:6}} maxLength={2}/></div>
            <div><span style={LAB}>Colour</span><div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:4}}>{LIST_COLORS.map(c=><button key={c} onClick={()=>setNstColor(c)} style={{width:27,height:27,borderRadius:"50%",border:`3px solid ${nstColor===c?"#1a1714":"transparent"}`,background:c}}/>)}</div></div>
          </div>
          <div style={{display:"flex",gap:8}}><button className="bp" onClick={addSymType} style={{flex:1}}>Add type</button><button className="bg" onClick={()=>setShowNewSymType(false)}>Cancel</button></div>
        </div>
      )}
      <span style={SL}>All episodes ({symptoms.length})</span>
      {symptoms.map(s=>{
        const si=symInfo(s.type); const isOpen=activeSymId===s.id;
        return(
          <div key={s.id} style={{background:"white",border:`1.5px solid ${si.color}33`,borderLeft:`4px solid ${si.color}`,borderRadius:12,marginBottom:10,overflow:"hidden"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 13px",cursor:"pointer"}} onClick={()=>setActiveSymId(isOpen?null:s.id)}>
              <span style={{fontSize:18}}>{si.icon}</span>
              <div style={{flex:1}}><div style={{fontWeight:600,fontSize:14}}>{si.label}</div><div style={{fontSize:12,color:"#9e8e7e"}}>{fmtDate(s.date)}{s.startTime?` · ${s.startTime}${s.endTime?" – "+s.endTime:""}`:""}</div></div>
              <span style={{display:"inline-block",padding:"3px 10px",borderRadius:20,fontSize:12,fontWeight:600,background:si.color+"18",color:si.color}}>{s.severity}/10</span>
              {s.durationMins>0&&<span style={{display:"inline-block",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,background:"#f0ebe1",color:"#8B6F47"}}>⏱ {minsToLabel(s.durationMins)}</span>}
              <span style={{color:"#c8bfb4",fontSize:16,transform:isOpen?"rotate(90deg)":"none",transition:"transform 0.2s"}}>›</span>
            </div>
            {isOpen&&<div style={{padding:"0 13px 13px",borderTop:"1px solid #f0ebe1"}}>
              {s.triggers.length>0&&<div style={{marginTop:9,fontSize:13,color:"#9e8e7e"}}>Triggers: {s.triggers.join(", ")}</div>}
              {s.aura&&<div style={{marginTop:8,fontSize:13,color:"#c0392b"}}>⚠ Aura present</div>}
              {s.meds&&<div style={{marginTop:8,fontSize:13}}>💊 {s.meds}</div>}
              {s.notes&&<div style={{marginTop:8,fontSize:13,fontStyle:"italic",color:"#5a5048"}}>{s.notes}</div>}
              {s.location&&<div style={{marginTop:6,fontSize:12,color:"#9e8e7e"}}>📍 {s.location}</div>}
              <button style={{background:"#fef0f0",color:"#c0392b",border:"1.5px solid #f5c6c6",borderRadius:8,padding:"7px 12px",fontSize:12,marginTop:12}} onClick={()=>deleteSymptom(s.id)}>Delete entry</button>
            </div>}
          </div>
        );
      })}
      {symptoms.length===0&&<div style={{textAlign:"center",color:"#9e8e7e",padding:40,fontSize:14}}>No symptoms logged yet</div>}
    </div>
  );

  // ── Patterns tab ───────────────────────────────────────────
  const renderPatterns=()=>(
    <div>
      <span style={SL}>Health patterns</span>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        <div className="card" style={{textAlign:"center",background:"#fff5f5",border:"1.5px solid #f5c6c6"}}><div style={{fontSize:28,fontWeight:700,color:"#c0392b"}}>{migraines.length}</div><div style={{fontSize:12,color:"#9e8e7e"}}>Migraines</div></div>
        <div className="card" style={{textAlign:"center"}}><div style={{fontSize:28,fontWeight:700,color:"#8B6F47"}}>{avgSev}</div><div style={{fontSize:12,color:"#9e8e7e"}}>Avg severity</div></div>
        <div className="card" style={{textAlign:"center",background:"#f7f4ff",border:"1.5px solid #d7c8f5"}}><div style={{fontSize:28,fontWeight:700,color:"#8e44ad"}}>{avgDur?minsToLabel(avgDur):"—"}</div><div style={{fontSize:12,color:"#9e8e7e"}}>Avg duration</div></div>
        <div className="card" style={{textAlign:"center",background:"#f0faf5",border:"1.5px solid #c0e8d0"}}><div style={{fontSize:28,fontWeight:700,color:"#27ae60"}}>{medications.length}</div><div style={{fontSize:12,color:"#9e8e7e"}}>Med doses logged</div></div>
      </div>
      {byType.length>0&&<div className="card" style={{marginBottom:12}}><span style={SL}>By symptom type</span>{byType.map(bt=><div key={bt.id} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:3}}><span>{bt.icon} {bt.label}</span><span style={{color:"#9e8e7e"}}>{bt.count}</span></div><div style={{height:6,background:"#f0ebe1",borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:`${(bt.count/(byType[0]?.count||1))*100}%`,background:bt.color,borderRadius:4,transition:"width 0.5s"}}/></div></div>)}</div>}
      {topMeds.length>0&&<div className="card" style={{marginBottom:12}}><span style={SL}>Most used medications</span>{topMeds.map(([m,c])=><div key={m} style={{marginBottom:9}}><div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:3}}><span>💊 {m}</span><span style={{color:"#9e8e7e"}}>{c}×</span></div><div style={{height:6,background:"#f0ebe1",borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:`${(c/(topMeds[0][1]||1))*100}%`,background:"#27ae60",borderRadius:4,transition:"width 0.5s"}}/></div></div>)}</div>}
      {topTrigs.length>0&&<div className="card" style={{marginBottom:12}}><span style={SL}>Top triggers</span>{topTrigs.map(([t,c])=><div key={t} style={{marginBottom:9}}><div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:3}}><span>{t}</span><span style={{color:"#9e8e7e"}}>{c}×</span></div><div style={{height:6,background:"#f0ebe1",borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:`${(c/topTrigs[0][1])*100}%`,background:"#8B6F47",borderRadius:4,transition:"width 0.5s"}}/></div></div>)}</div>}
      {migraines.length>0&&<div className="card"><span style={SL}>Migraine timeline</span>{migraines.map(m=><div key={m.id} style={{display:"flex",gap:10,marginBottom:12,paddingBottom:12,borderBottom:"1px solid #f0ebe1"}}><div style={{width:34,flexShrink:0,textAlign:"center"}}><div style={{fontSize:13,fontWeight:700,color:"#c0392b"}}>{new Date(m.date+"T12:00:00").getDate()}</div><div style={{fontSize:10,color:"#9e8e7e",textTransform:"uppercase"}}>{new Date(m.date+"T12:00:00").toLocaleString("en",{month:"short"})}</div></div><div style={{flex:1}}><div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:3}}><span style={{display:"inline-block",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,background:"#fff0f0",color:"#c0392b"}}>{m.severity}/10</span>{m.durationMins>0&&<span style={{display:"inline-block",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,background:"#f0ebe1",color:"#8B6F47"}}>⏱ {minsToLabel(m.durationMins)}</span>}{m.aura&&<span style={{display:"inline-block",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,background:"#fff8e0",color:"#d35400"}}>⚠ Aura</span>}</div>{m.triggers.length>0&&<div style={{fontSize:12,color:"#9e8e7e"}}>{m.triggers.join(" · ")}</div>}{m.notes&&<div style={{fontSize:12,fontStyle:"italic",color:"#7a6040",marginTop:2}}>{m.notes}</div>}</div></div>)}</div>}
    </div>
  );

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════
  const isFullScreen = showLogSym||showLogMed;
  const headerLabel = showLogSym?"Log symptom":showLogMed?"Log medication":selectedDay?"Day view":tab==="calendar"?"Calendar":tab==="lists"?"Lists":tab==="health"?"Health":"Patterns";

  return(
    <div style={{fontFamily:"'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif",minHeight:"100vh",background:"#f7f4ef",color:"#1a1714"}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        button{cursor:pointer;font-family:inherit;}
        input,textarea,select{font-family:inherit;background:white;border:1.5px solid #e0d8d0;border-radius:9px;padding:9px 12px;font-size:14px;color:#1a1714;outline:none;width:100%;}
        input:focus,textarea:focus,select:focus{border-color:#8B6F47;box-shadow:0 0 0 3px rgba(139,111,71,0.1);}
        textarea{resize:vertical;}
        .card{background:white;border:1px solid #e8e0d4;border-radius:14px;padding:18px;margin-bottom:12px;}
        .ct{background:white;border:1px solid #e8e0d4;border-radius:14px;overflow:hidden;margin-bottom:12px;}
        .row{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid #f0ebe1;}
        .row:last-child{border-bottom:none;}
        .bp{background:#8B6F47;color:white;border:none;border-radius:9px;padding:10px 20px;font-size:14px;transition:opacity 0.15s;} .bp:hover{opacity:0.87;}
        .bg{background:transparent;color:#8B6F47;border:1.5px solid #ddd5c5;border-radius:9px;padding:8px 15px;font-size:13px;transition:background 0.15s;} .bg:hover{background:#f0ebe1;}
        .bd{background:#fef0f0;color:#c0392b;border:1.5px solid #f5c6c6;border-radius:8px;padding:7px 12px;font-size:12px;}
        .nb{flex:1;padding:10px 2px;border:none;background:transparent;font-size:10px;color:#9e8e7e;border-top:3px solid transparent;transition:all 0.15s;display:flex;flex-direction:column;align-items:center;gap:2px;}
        .nb.on{color:#8B6F47;border-top-color:#8B6F47;}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}} .page{animation:fadeIn 0.2s ease;}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}} .pulse{animation:pulse 1.5s infinite;}
        ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-thumb{background:#ddd5c5;border-radius:4px;}
      `}</style>

      {/* Header */}
      <div style={{background:"white",borderBottom:"1px solid #e8e0d4",padding:"13px 18px",position:"sticky",top:0,zIndex:20}}>
        <div style={{maxWidth:520,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {(showLogSym||showLogMed||selectedDay)&&<button onClick={()=>{setShowLogSym(false);setShowLogMed(false);setSelectedDay(null);setSymTimerRunning(false);setSym(blankSym);setSymTimerElapsed(0);setMed(blankMed);}} style={{background:"none",border:"none",color:"#8B6F47",fontSize:20,padding:"0 3px"}}>‹</button>}
            <div>
              <div style={{fontSize:19,fontWeight:700,letterSpacing:"-0.03em"}}>Vitae <span style={{color:"#8B6F47"}}>✦</span></div>
              <div style={{fontSize:11,color:"#9e8e7e"}}>{new Date().toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}</div>
            </div>
          </div>
          <div style={{display:"flex",gap:6}}>
            {tab==="lists"&&!activeList&&!isFullScreen&&<button className="bg" style={{fontSize:12,padding:"7px 10px"}} onClick={()=>{setShowNewList(true);}}>+ New list</button>}
            {(tab==="health"||tab==="calendar")&&!isFullScreen&&<button className="bg" style={{fontSize:12,padding:"7px 10px"}} onClick={()=>{setMed({...blankMed,date:selectedDay||today});setShowLogMed(true);}}>💊</button>}
            {(tab==="health"||tab==="calendar")&&!isFullScreen&&<button className="bg" style={{fontSize:12,padding:"7px 10px"}} onClick={()=>{setSym({...blankSym,date:selectedDay||today});setShowLogSym(true);}}>⚡</button>}
            <button onClick={()=>setShowReport(true)} style={{background:"#f7f4ef",border:"1.5px solid #e8e0d4",borderRadius:9,padding:"7px 9px",fontSize:12,color:"#8B6F47",fontFamily:"inherit"}}>📋</button>
            <button onClick={()=>setShowChangePw(true)} style={{background:"#f7f4ef",border:"1.5px solid #e8e0d4",borderRadius:9,padding:"7px 9px",fontSize:13,color:"#9e8e7e",fontFamily:"inherit"}}>🔒</button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{maxWidth:520,margin:"0 auto",padding:"18px 15px 90px"}} className="page" key={tab+(selectedDay||"")+(showLogSym?"S":"")+(showLogMed?"M":"")+(activeList?.id||"")}>
        {showLogSym ? renderLogSym()
          : showLogMed ? renderLogMed()
          : tab==="calendar" && selectedDay ? renderDayView()
          : tab==="calendar" ? renderCalendar()
          : tab==="lists" ? renderLists()
          : tab==="health" ? renderHealth()
          : renderPatterns()
        }
      </div>

      {/* Change Password Modal */}
      {showChangePw&&(
        <div style={{position:"fixed",inset:0,background:"rgba(26,23,20,0.65)",zIndex:300,display:"flex",alignItems:"flex-end"}} onClick={()=>setShowChangePw(false)}>
          <div style={{background:"white",width:"100%",borderRadius:"22px 22px 0 0",padding:"20px 20px 44px",fontFamily:"inherit"}} onClick={e=>e.stopPropagation()}>
            <div style={{width:40,height:4,background:"#e0d8d0",borderRadius:4,margin:"0 auto 20px"}}/>
            <div style={{fontWeight:700,fontSize:17,marginBottom:16}}>🔒 Security</div>
            {cpDone?<div style={{textAlign:"center",padding:"20px 0",fontSize:15,color:"#27ae60"}}>✅ Password updated!</div>:(
              <>
                <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
                  <input type="password" value={cpCurrent} onChange={e=>setCpCurrent(e.target.value)} placeholder="Current password" style={{fontFamily:"inherit",border:"1.5px solid #e0d8d0",borderRadius:9,padding:"11px 13px",fontSize:14,outline:"none",width:"100%"}}/>
                  <input type="password" value={cpNew} onChange={e=>setCpNew(e.target.value)} placeholder="New password (min 6 chars)" style={{fontFamily:"inherit",border:"1.5px solid #e0d8d0",borderRadius:9,padding:"11px 13px",fontSize:14,outline:"none",width:"100%"}}/>
                  <input type="password" value={cpConfirm} onChange={e=>setCpConfirm(e.target.value)} placeholder="Confirm new password" style={{fontFamily:"inherit",border:"1.5px solid #e0d8d0",borderRadius:9,padding:"11px 13px",fontSize:14,outline:"none",width:"100%"}}/>
                  {cpError&&<div style={{fontSize:13,color:"#c0392b"}}>{cpError}</div>}
                </div>
                <button onClick={changePassword} style={{width:"100%",background:"#8B6F47",color:"white",border:"none",borderRadius:10,padding:"13px",fontSize:15,cursor:"pointer",fontFamily:"inherit",fontWeight:600,marginBottom:10}}>Update password</button>
                <button onClick={lockApp} style={{width:"100%",background:"#fef0f0",color:"#c0392b",border:"1.5px solid #f5c6c6",borderRadius:10,padding:"12px",fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>🔐 Lock app now</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Reminder Modal */}
      {reminderTarget&&<ReminderModal item={reminderTarget.item} listName={reminderTarget.listName} listColor={reminderTarget.listColor} onClose={()=>setReminderTarget(null)} onSaved={handleReminderSaved}/>}

      {/* Report Modal */}
      {showReport&&(
        <div style={{position:"fixed",inset:0,background:"rgba(26,23,20,0.55)",zIndex:100,display:"flex",alignItems:"flex-end"}} onClick={()=>setShowReport(false)}>
          <div style={{background:"white",width:"100%",maxHeight:"86vh",borderRadius:"20px 20px 0 0",overflowY:"auto",padding:"20px 16px 30px",fontFamily:"inherit"}} onClick={e=>e.stopPropagation()}>
            <div style={{width:40,height:4,background:"#e0d8d0",borderRadius:4,margin:"0 auto 16px"}}/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontWeight:700,fontSize:17}}>📋 Doctor Report</div>
              <button onClick={()=>setShowReport(false)} style={{background:"none",border:"none",fontSize:22,color:"#9e8e7e"}}>×</button>
            </div>
            <div style={{fontSize:12,color:"#9e8e7e",marginBottom:12}}>Copy and paste into your GP portal, email, or Notes app.</div>
            <pre style={{fontFamily:"'Courier New',monospace",fontSize:11,lineHeight:1.7,whiteSpace:"pre-wrap",background:"#faf8f4",border:"1px solid #e8e0d4",borderRadius:10,padding:14,color:"#1a1714",maxHeight:"52vh",overflow:"auto"}}>{report}</pre>
            <button className="bp" onClick={copyReport} style={{width:"100%",padding:"13px",fontSize:15,borderRadius:11,marginTop:14,background:reportCopied?"#27ae60":"#8B6F47"}}>{reportCopied?"✓ Copied!":"Copy report to clipboard"}</button>
          </div>
        </div>
      )}

      {/* Bottom nav */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"white",borderTop:"1px solid #e8e0d4",display:"flex",zIndex:10,paddingBottom:"env(safe-area-inset-bottom)"}}>
        {[{id:"calendar",icon:"📅",label:"Calendar"},{id:"lists",icon:"📋",label:"Lists"},{id:"health",icon:"⚡",label:"Health"},{id:"patterns",icon:"📊",label:"Patterns"}].map(n=>(
          <button key={n.id} className={`nb${tab===n.id?" on":""}`} onClick={()=>{setTab(n.id);setActiveList(null);setShowLogSym(false);setShowLogMed(false);setSelectedDay(null);}}>
            <span style={{fontSize:22}}>{n.icon}</span><span>{n.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  return <PasswordGate><VitaeApp/></PasswordGate>;
}
