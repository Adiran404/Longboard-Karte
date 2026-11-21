// ===================== Longboard-Karte: App-Schicht =====================
// Einstellungen (nur auf diesem Gerät)
const CFG_KEY='lbk_cfg';
function cfg(){try{return JSON.parse(localStorage.getItem(CFG_KEY)||'{}')}catch(e){return {}}}
function setCfg(o){const c=Object.assign(cfg(),o);try{localStorage.setItem(CFG_KEY,JSON.stringify(c))}catch(e){}return c}
const DIR16=d=>['N','NNO','NO','ONO','O','OSO','SO','SSO','S','SSW','SW','WSW','W','WNW','NW','NNW'][Math.round(((d%360)+360)%360/22.5)%16];
function b64enc(s){const b=new TextEncoder().encode(s);let bin='';for(let i=0;i<b.length;i+=0x8000)bin+=String.fromCharCode.apply(null,b.subarray(i,i+0x8000));return btoa(bin)}
function b64dec(s){const bin=atob(String(s).replace(/\s/g,''));const b=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)b[i]=bin.charCodeAt(i);return new TextDecoder().decode(b)}
function setStat(t){const e=document.getElementById('dbstat');if(e)e.textContent=t}
function ghStat(t){const e=document.getElementById('ghstat');if(e)e.textContent=t}

// ---------- lokaler Speicher (IndexedDB, Fallback: nur im Speicher) ----------
const IDB=(()=>{let dbp=null;
 const open=()=>dbp||(dbp=new Promise((res,rej)=>{try{const r=indexedDB.open('longboard',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}catch(e){rej(e)}}));
 const tx=(m,f)=>open().then(db=>new Promise((res,rej)=>{const t=db.transaction('kv',m);const q=f(t.objectStore('kv'));t.oncomplete=()=>res(q&&q.result);t.onerror=()=>rej(t.error)}));
 return {put:(k,v)=>tx('readwrite',s=>s.put(v,k)).catch(e=>console.warn('idb',e)),
  all:()=>open().then(db=>new Promise((res,rej)=>{const out={};const c=db.transaction('kv','readonly').objectStore('kv').openCursor();c.onsuccess=()=>{const cu=c.result;if(cu){out[cu.key]=cu.value;cu.continue()}else res(out)};c.onerror=()=>rej(c.error)})).catch(e=>{console.warn('idb',e);return {}})}})();
const STORE={ratings:{},rides:{},meta:{},uways:{},spots:{}},LIS={ratings:[],rides:[],meta:[],uways:[],spots:[]};
const storeReady=(async()=>{const all=await IDB.all();for(const k in all){const i=k.indexOf('/');const c=k.slice(0,i),id=k.slice(i+1);if(STORE[c])STORE[c][id]=all[k]}})();
function notify(c){for(const l of LIS[c]||[])try{l()}catch(e){console.error(e)}}
function snapOf(c,opt){let docs=Object.entries(STORE[c]).filter(([,v])=>v&&v.data).map(([id,v])=>({id,data:()=>v.data}));
 if(opt.order){const [f,dir]=opt.order;docs.sort((a,b)=>{const x=a.data()[f]||'',y=b.data()[f]||'';return (x<y?-1:x>y?1:0)*(dir==='desc'?-1:1)})}
 if(opt.limit)docs=docs.slice(0,opt.limit);return {docs}}
async function putDoc(c,id,data){const old=STORE[c][id];const e={data,t:Date.now(),dirty:true,sha:old&&old.sha};STORE[c][id]=e;await IDB.put(c+'/'+id,e);notify(c);GH.schedule()}
function coll(c){const opt={};const api={
 doc:id=>({get:async()=>{await storeReady;const e=STORE[c][id];return {exists:!!(e&&e.data),data:()=>e&&e.data}},
           set:async d=>{await storeReady;await putDoc(c,id,JSON.parse(JSON.stringify(d)))}}),
 orderBy:(f,dir)=>{opt.order=[f,dir||'asc'];return api},limit:n=>{opt.limit=n;return api},
 onSnapshot:(cb)=>{const run=()=>cb(snapOf(c,opt));LIS[c].push(run);storeReady.then(run);return ()=>{LIS[c]=LIS[c].filter(x=>x!==run)}}};return api}
DB={collection:coll,doc:p=>{const i=p.indexOf('/');return coll(p.slice(0,i)).doc(p.slice(i+1))}};

// ---------- GitHub-Sync (privates Repo Longboard-Daten) ----------
const GH={owner:'Adiran404',repo:'Longboard-Daten',timer:null,busy:false,fails:0,
 tok(){return cfg().ghToken},
 api(path,opt){opt=opt||{};return fetch('https://api.github.com/repos/'+this.owner+'/'+this.repo+'/contents/'+path,Object.assign({},opt,{cache:'no-store',
   headers:Object.assign({'Authorization':'Bearer '+this.tok(),'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},opt.headers||{})}))},
 async getJson(path){const r=await this.api(path);if(r.status===404)return null;if(!r.ok){const e=new Error('GitHub '+r.status);e.status=r.status;throw e}
  const j=await r.json();let txt;if(j.content&&j.encoding==='base64')txt=b64dec(j.content);else{const r2=await this.api(path,{headers:{Accept:'application/vnd.github.raw+json'}});txt=await r2.text()}
  return {sha:j.sha,json:JSON.parse(txt)}},
 async putJson(path,obj,sha,msg){const body={message:msg||('Update '+path),content:b64enc(JSON.stringify(obj))};if(sha)body.sha=sha;
  const r=await this.api(path,{method:'PUT',body:JSON.stringify(body),headers:{'Content-Type':'application/json'}});
  if(!r.ok){const e=new Error('GitHub '+r.status);e.status=r.status;throw e}return (await r.json()).content.sha},
 schedule(){if(!this.tok())return;clearTimeout(this.timer);this.timer=setTimeout(()=>this.sync(),Math.min(60000,2500*Math.pow(2,this.fails)))},
 async sync(){if(!this.tok()){ghStat('Nur auf diesem Gerät gespeichert (kein GitHub-Token).');return}
  if(this.busy){this.schedule();return}this.busy=true;ghStat('Synchronisiere …');await storeReady;let ok=false;
  try{
   // Bewertungen, eigene Wege, Spots: je eine Datei, pro Eintrag gewinnt der neuere Stand
   for(const [c,file,lab] of [['ratings','ratings.json','Bewertungen'],['uways','eigene-wege.json','Eigene Wege'],['spots','spots.json','Spots']]){
    const rem=await this.getJson(file);const remR=(rem&&rem.json)||{};let ch=false;
    for(const id in remR){const l=STORE[c][id],r=remR[id];if(!r)continue;if(!l||(r.t||0)>(l.t||0)){STORE[c][id]={data:r.data,t:r.t,dirty:false};await IDB.put(c+'/'+id,STORE[c][id]);ch=true}}
    const dirty=Object.keys(STORE[c]).filter(id=>STORE[c][id].dirty);
    if(dirty.length){const out=Object.assign({},remR);for(const id in STORE[c]){const e=STORE[c][id];if(!out[id]||e.t>=(out[id].t||0))out[id]={data:e.data,t:e.t}}
     await this.putJson(file,out,rem&&rem.sha,lab+' aktualisiert ('+dirty.length+')');
     for(const id of dirty){STORE[c][id].dirty=false;await IDB.put(c+'/'+id,STORE[c][id])}}
    if(ch)notify(c)}
   // Fahrten: eine Datei pro Fahrt
   const lr=await this.api('rides');let list=[];if(lr.ok)list=await lr.json();else if(lr.status!==404){const e=new Error('GitHub '+lr.status);e.status=lr.status;throw e}
   let rc=false;
   for(const f of Array.isArray(list)?list:[]){if(!/\.json$/.test(f.name))continue;const id=f.name.slice(0,-5);const l=STORE.rides[id];if(l&&l.sha===f.sha)continue;
    const g=await this.getJson('rides/'+f.name);if(!g||!g.json)continue;
    if(!l||(!l.dirty&&g.json.t>=(l.t||0))||(l.dirty&&g.json.t>l.t)){STORE.rides[id]={data:g.json.data,t:g.json.t,sha:g.sha,dirty:false};await IDB.put('rides/'+id,STORE.rides[id]);rc=true}
    else l.sha=g.sha}
   for(const id in STORE.rides){const e=STORE.rides[id];if(!e.dirty)continue;const pth='rides/'+id+'.json',msg='Fahrt '+((e.data&&e.data.date)||id);
    try{e.sha=await this.putJson(pth,{data:e.data,t:e.t},e.sha,msg)}
    catch(err){if(err.status===409||err.status===422){const g=await this.getJson(pth);e.sha=await this.putJson(pth,{data:e.data,t:e.t},g&&g.sha,msg)}else throw err}
    e.dirty=false;await IDB.put('rides/'+id,e)}
   if(rc)notify('rides');
   ok=true;this.fails=0;ghStat('Mit GitHub abgeglichen · '+new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}));
  }catch(e){this.fails=Math.min(this.fails+1,5);ghStat('GitHub-Abgleich fehlgeschlagen ('+(e.status===401||e.status===403?'Token ungültig oder ohne Schreibrecht':e.status===404?'Repo nicht gefunden – Token für Longboard-Daten?':e.message)+'). Daten bleiben lokal gespeichert.')}
  finally{this.busy=false;const left=['ratings','rides','uways','spots'].some(c=>Object.values(STORE[c]).some(e=>e.dirty));if(left&&(ok||this.fails<5))this.schedule()}}};

// ---------- intervals.icu: Fahrten automatisch holen ----------
const ICU={busy:false,
 ok(){const c=cfg();return !!(c.icuKey&&c.icuId)},
 async get(path,raw){const r=await fetch('https://intervals.icu/api/v1/'+path,{headers:{Authorization:'Basic '+btoa('API_KEY:'+cfg().icuKey)}});
  if(!r.ok){const e=new Error('intervals.icu '+r.status);e.status=r.status;throw e}return raw?r.arrayBuffer():r.json()},
 async pull(manual){if(this.busy)return;if(!this.ok()){if(manual)openSettings('Für den automatischen Import bitte die intervals.icu-Daten eintragen.');return}
  this.busy=true;try{
   await storeReady;for(let i=0;i<120&&!P.length;i++)await new Promise(s=>setTimeout(s,250));
   const c=cfg();const days=manual?180:45;const oldest=new Date(Date.now()-days*864e5).toISOString().slice(0,10),newest=new Date(Date.now()+864e5).toISOString().slice(0,10);
   setStat('Frage intervals.icu nach neuen Fahrten …');
   let acts;try{acts=await this.get('athlete/'+encodeURIComponent(c.icuId.trim())+'/activities?oldest='+oldest+'&newest='+newest)}
   catch(e){setStat('intervals.icu: '+(e.status===401||e.status===403?'API-Schlüssel oder Athleten-ID stimmt nicht (Einstellungen).':e.status===404?'Athleten-ID nicht gefunden.':'nicht erreichbar ('+e.message+').'));return}
   const skip=new Set(c.icuSkip||[]);let n=0,fail=0;
   for(const a of Array.isArray(acts)?acts:[]){const ts=Math.round(Date.parse(a.start_date||a.start_date_local)/1000);if(!ts)continue;const rid='r'+ts;
    if(STORE.rides[rid]||skip.has(String(a.id)))continue;if(a.distance!=null&&a.distance<200){skip.add(String(a.id));continue}
    setStat('Hole „'+(a.name||'Fahrt')+'“ …');
    try{const tr=await this.track(a,ts);if(!tr){skip.add(String(a.id));continue}await importTrack(tr,a.name||('intervals.icu '+a.id));n++}
    catch(e){console.warn(e);fail++;if(e.status===401||e.status===403){setStat('intervals.icu: Zugriff verweigert (Schlüssel prüfen).');break}}}
   setCfg({icuSkip:[...skip].slice(-500),icuLast:Date.now()});
   if(n)setStat(n+' neue Fahrt'+(n>1?'en':'')+' aus intervals.icu übernommen'+(fail?', '+fail+' fehlgeschlagen':'')+'.');
   else if(manual)setStat(fail?fail+' Fahrt(en) konnten nicht geladen werden.':'Keine neuen Fahrten in intervals.icu.');
   else updDbStat();
  }finally{this.busy=false;WX.fillMissing()}},
 async track(a,ts){let tr=null;
  try{const ss=await this.get('activity/'+encodeURIComponent(a.id)+'/streams.json?types=time,latlng,altitude,heartrate,velocity_smooth');
   const S={};for(const s of Array.isArray(ss)?ss:[])S[s.type]=s;const ll=S.latlng;
   if(ll&&ll.data&&ll.data.length){const lat=ll.data,lon=ll.data2||null,t=S.time&&S.time.data,pts=[];
    for(let i=0;i<lat.length;i++){let la=lat[i],lo=lon?lon[i]:null;if(Array.isArray(la)){lo=la[1];la=la[0]}if(la==null||lo==null)continue;
     pts.push({lat:la,lon:lo,t:t&&t[i]!=null?ts+t[i]:null,ele:S.altitude&&S.altitude.data[i]!=null?S.altitude.data[i]:null,hr:S.heartrate&&S.heartrate.data[i]?S.heartrate.data[i]:null,spd:S.velocity_smooth&&S.velocity_smooth.data[i]!=null?S.velocity_smooth.data[i]:null})}
    if(pts.length>1)tr={pts,fmt:'intervals.icu'}}}
  catch(e){if(e.status===401||e.status===403)throw e;console.warn('streams',e)}
  if(!tr){try{let buf=await this.get('activity/'+encodeURIComponent(a.id)+'/file',true);const u=new Uint8Array(buf);
    if(u[0]===0x1f&&u[1]===0x8b&&window.DecompressionStream)buf=await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    const t2=detectAndParse(buf,'x');if(t2&&t2.pts&&t2.pts.length>1)tr=t2}catch(e){console.warn('file',e)}}
  if(!tr)return null;const S0=tr.session||{},num=v=>v!=null&&isFinite(v)?+v:null;
  const ses={dist:num(a.distance),elapsed:num(a.elapsed_time),dur:num(a.moving_time),avg:num(a.average_speed),max:num(a.max_speed),hrAvg:num(a.average_heartrate)!=null?Math.round(a.average_heartrate):null,hrMax:num(a.max_heartrate),up:num(a.total_elevation_gain),down:num(a.total_elevation_loss),kcal:num(a.calories)};
  for(const k in ses)if(ses[k]==null&&S0[k]!=null)ses[k]=S0[k];for(const k in ses)if(ses[k]==null)delete ses[k];tr.session=ses;return tr}};

// ---------- Wetter: DWD-Stationsdaten (Bright Sky), sonst Open-Meteo ----------
const WX={busy:false,
 async fetchFor(lat,lon,t0,t1){const pad=3600,a=new Date((t0-pad)*1000).toISOString(),b=new Date((t1+pad)*1000).toISOString();
  try{const r=await fetch('https://api.brightsky.dev/weather?lat='+lat.toFixed(4)+'&lon='+lon.toFixed(4)+'&date='+encodeURIComponent(a)+'&last_date='+encodeURIComponent(b)+'&units=dwd&tz=Etc/UTC');
   if(r.ok){const j=await r.json();const W=(j.weather||[]).filter(x=>x.wind_speed!=null);
    if(W.length){const srcs=j.sources||[];const cnt={};for(const x of W)cnt[x.source_id]=(cnt[x.source_id]||0)+1;const sid=+Object.keys(cnt).sort((p,q)=>cnt[q]-cnt[p])[0];const s=srcs.find(z=>z.id===sid)||srcs[0]||{};
     const kt=v=>v==null?null:+(v/1.852).toFixed(1);
     return {station:s.station_name?s.station_name.toLowerCase().replace(/(^|[\s\-\/(])(\S)/g,(m,p,c)=>p+c.toUpperCase()):'DWD-Station',km:s.distance!=null?Math.round(s.distance/1000):null,src:'DWD (Bright Sky)',
      h:W.map(x=>[x.timestamp,kt(x.wind_speed),kt(x.wind_gust_speed),x.wind_direction,x.temperature,x.precipitation,x.condition||null])}}}}
  catch(e){console.warn('brightsky',e)}
  const q='?latitude='+lat.toFixed(4)+'&longitude='+lon.toFixed(4)+'&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,temperature_2m,precipitation&wind_speed_unit=kn&timezone=GMT&start_date='+a.slice(0,10)+'&end_date='+b.slice(0,10);
  for(const base of ['https://api.open-meteo.com/v1/forecast','https://historical-forecast-api.open-meteo.com/v1/forecast']){
   try{const r=await fetch(base+q);if(!r.ok)continue;const H=(await r.json()).hourly;if(!H||!H.time)continue;const h=[];
    for(let i=0;i<H.time.length;i++){const tt=Date.parse(H.time[i]+'Z')/1000;if(tt<t0-pad||tt>t1+pad||H.wind_speed_10m[i]==null)continue;
     h.push([H.time[i]+':00Z',H.wind_speed_10m[i],H.wind_gusts_10m[i],H.wind_direction_10m[i],H.temperature_2m[i],H.precipitation[i],null])}
    if(h.length)return {station:'Wettermodell am Startpunkt',km:null,src:'Open-Meteo',h}}catch(e){console.warn('openmeteo',e)}}
  return null},
 async forRide(id){const e=STORE.rides[id];if(!e||!e.data)return false;const r=e.data;if(r.wx||!r.start||!r.p)return false;
  const t0=Date.parse(r.start)/1000;if(!t0)return false;const t1=t0+(r.elapsed||r.dur||3600);if(Date.now()/1000-t1<1800&&!r.wxTry)return false;
  const p0=dec(r.p)[0];const wx=await this.fetchFor(p0[0],p0[1],t0,t1);if(!wx)return false;
  await putDoc('rides',id,Object.assign({},r,{wx}));return true},
 async fillMissing(){if(this.busy)return;this.busy=true;try{await storeReady;let k=0;
  for(const id of Object.keys(STORE.rides).sort().reverse()){const r=STORE.rides[id].data;if(!r||r.wx)continue;if(k++>=6)break;
   try{const ok=await this.forRide(id);if(ok&&curRide===id)setTimeout(()=>showRide(id),50)}catch(e){console.warn('wx',e)}}}finally{this.busy=false}}};

// ---------- Wind jetzt + Vorhersage ----------
let WINDNOW=null;
function arrow(dir,cls){return '<span class="arr '+(cls||'')+'" style="transform:rotate('+((dir+180)%360)+'deg)">↑</span>'}
function wcol(k){return k<8?'#b9c2cc':k<12?'#9ccc3c':k<20?'#2e9e44':k<28?'#f08c19':'#d6301f'}
function wrow(time,ws,gs,dir,extra){const mx=35;return '<div class="fr"><span class="ft">'+time+'</span>'+arrow(dir)+'<span class="fd">'+DIR16(dir)+'</span><span class="fb"><i style="width:'+Math.min(100,100*ws/mx)+'%;background:'+wcol(ws)+'"></i>'+(gs!=null?'<i class="g" style="width:'+Math.min(100,100*gs/mx)+'%"></i>':'')+'</span><span class="fv"><b>'+Math.round(ws)+'</b>'+(gs!=null?' / '+Math.round(gs):'')+'</span><span class="fp">'+(extra||'')+'</span></div>'}
async function windNow(lat,lon,label){const el=document.getElementById('wnow');
 if(lat==null){if(locMk){const ll=locMk.getLatLng();lat=ll.lat;lon=ll.lng;label='an deinem Standort'}else{const c=map.getCenter();lat=c.lat;lon=c.lng;label='in der Kartenmitte'}}
 if(el)el.innerHTML='<div class="card muted">Wind wird geladen …</div>';
 try{const r=await fetch('https://api.open-meteo.com/v1/forecast?latitude='+lat.toFixed(3)+'&longitude='+lon.toFixed(3)+'&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation_probability&wind_speed_unit=kn&timezone=auto&forecast_hours=25');
  if(!r.ok)throw new Error(r.status);const j=await r.json();const c=j.current;WINDNOW={c,lat,lon,label,t:Date.now()};const sec=Math.round(c.wind_direction_10m/45)%8;
  const chip=document.getElementById('wchip');if(chip){chip.innerHTML=arrow(c.wind_direction_10m)+'<b>'+Math.round(c.wind_speed_10m)+' kt</b><span class="muted">'+DIR16(c.wind_direction_10m)+' · Böen '+Math.round(c.wind_gusts_10m)+'</span>';chip.style.display='flex'}
  if(!el)return;const H=j.hourly||{time:[]};let rows='';
  for(let i=1;i<H.time.length;i++)rows+=wrow(H.time[i].slice(11,16),H.wind_speed_10m[i],H.wind_gusts_10m[i],H.wind_direction_10m[i],H.precipitation_probability&&H.precipitation_probability[i]>=30?'☂ '+H.precipitation_probability[i]+'%':'');
  el.innerHTML='<div class="card wbig"><div class="muted">Wind jetzt '+label+'</div><div class="wrow">'+arrow(c.wind_direction_10m,'big')+'<div><div class="wkt">'+Math.round(c.wind_speed_10m)+' <small>kt</small></div><div>Böen <b>'+Math.round(c.wind_gusts_10m)+' kt</b> · aus '+DIR16(c.wind_direction_10m)+' ('+Math.round(c.wind_direction_10m)+'°)</div>'+(c.temperature_2m!=null?'<div class="muted">'+Math.round(c.temperature_2m)+' °C</div>':'')+'</div></div>'
   +'<div class="btnrow"><button class="btn" id="wset">Karte auf '+DIRS[sec]+'-Wind stellen</button><button class="btn sec" id="wloc">Mein Standort</button><button class="btn sec" id="wmap">Kartenmitte</button></div></div>'
   +'<div class="card"><div class="ch">Nächste 24 Stunden <span class="muted" style="font-weight:400">· kt / Böen</span></div>'+rows+'<div class="small muted" style="margin-top:6px">Wettermodell Open-Meteo</div></div>';
  document.getElementById('wset').onclick=()=>{wind=sec;draw();location.hash='#karte'};
  document.getElementById('wmap').onclick=()=>{const m=map.getCenter();windNow(m.lat,m.lng,'in der Kartenmitte')};
  document.getElementById('wloc').onclick=()=>{if(!navigator.geolocation)return;navigator.geolocation.getCurrentPosition(p=>windNow(p.coords.latitude,p.coords.longitude,'an deinem Standort'),()=>{el.insertAdjacentHTML('afterbegin','<div class="card">Standort nicht verfügbar.</div>')},{maximumAge:60000,timeout:15000})}}
 catch(e){if(el)el.innerHTML='<div class="card">Windvorhersage gerade nicht erreichbar. <button class="btn sm" onclick="windNow()">Nochmal</button></div>'}}

// ---------- Kartenhintergründe ----------
const PICTO={
 'Eigene Karte':'<svg viewBox="0 0 56 56"><rect width="56" height="56" fill="#eef0e8"/><path d="M0 40h56v16H0z" fill="#cfe0c4"/><path d="M6 50 22 30l12 6 16-24" stroke="#1f6fd1" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M4 20 24 22 30 8" stroke="#1a9e4a" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M34 52 44 40 54 44" stroke="#d89614" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M22 30l12 6" stroke="#ff3fd2" stroke-width="9" opacity=".35" stroke-linecap="round"/></svg>',
 'Satellit':'<svg viewBox="0 0 56 56"><rect width="56" height="56" fill="#5d6b3f"/><path d="M0 0h30l-6 22H0z" fill="#7d8a52"/><path d="M30 0h26v20L34 26z" fill="#3f4f2c"/><path d="M0 34l26-6 4 28H0z" fill="#8f8a5c"/><path d="M34 30l22-6v32H32z" fill="#6f7d47"/><path d="M0 26 56 18" stroke="#c9c2ad" stroke-width="2.5"/><path d="M28 0v56" stroke="#b9b2a0" stroke-width="1.5"/></svg>',
 'Relief/Topo':'<svg viewBox="0 0 56 56"><rect width="56" height="56" fill="#f2efe4"/><g fill="none" stroke="#b58c5a" stroke-width="1.6"><path d="M8 46c6-14 30-20 40-8"/><path d="M14 40c6-10 22-14 28-6"/><path d="M20 34c4-6 12-8 16-3"/><path d="M4 18c10-6 22-4 30 2s16 4 20-2"/></g><path d="M0 52 56 44" stroke="#e07b39" stroke-width="2.5"/><path d="M26 31a2 2 0 1 0 0.1 0" fill="#555"/></svg>',
 'OpenStreetMap':'<svg viewBox="0 0 56 56"><rect width="56" height="56" fill="#f2efe9"/><path d="M0 36h22v20H0z" fill="#d7e8c9"/><path d="M34 0h22v22H34z" fill="#e0dcd4"/><path d="M0 22 56 30" stroke="#f6c97a" stroke-width="5"/><path d="M0 22 56 30" stroke="#e5a95b" stroke-width="1" fill="none"/><path d="M28 0v56" stroke="#fff" stroke-width="4"/><path d="M28 0v56" stroke="#ccc" stroke-width="1"/><path d="M40 56 56 40" stroke="#aac9ee" stroke-width="5"/></svg>'};
const LAYERS_ICO='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="M12 3 2 8l10 5 10-5-10-5z"/><path d="m2 12.5 10 5 10-5"/><path d="m2 17 10 5 10-5"/></svg>';
let BASES=null,CURBASE=null;
function setBase(name){if(!BASES[name])name='Eigene Karte';if(CURBASE)map.removeLayer(BASES[CURBASE]);BASES[name].addTo(map);if(BASES[name].bringToBack)BASES[name].bringToBack();CURBASE=name;
 if(name==='Eigene Karte')ctxFill.addTo(map);else ctxFill.remove();map.getContainer().classList.toggle('sat',name==='Satellit');setCfg({base:name});
 document.querySelectorAll('.lpop .lopt').forEach(o=>o.classList.toggle('on',o.dataset.n===name))}
function addBaseLayers(){
 const own=L.layerGroup();
 const osm=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap-Mitwirkende'});
 const sat=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,maxNativeZoom:18,attribution:'Luftbild © Esri, Maxar, Earthstar Geographics'});
 const topo=L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{maxZoom:18,maxNativeZoom:17,subdomains:'abc',attribution:'© OpenTopoMap (CC-BY-SA)'});
 BASES={'Eigene Karte':own,'Satellit':sat,'Relief/Topo':topo,'OpenStreetMap':osm};
 const LBL={'Eigene Karte':'Eigene','Satellit':'Satellit','Relief/Topo':'Relief','OpenStreetMap':'Straßen'};
 const C=L.Control.extend({onAdd(){const box=L.DomUtil.create('div','lctl');
   box.innerHTML='<button class="lbtn leaflet-bar" title="Kartenansicht">'+LAYERS_ICO+'</button><div class="lpop" style="display:none">'+Object.keys(BASES).map(n=>'<button class="lopt" data-n="'+n+'">'+PICTO[n]+'<span>'+LBL[n]+'</span></button>').join('')+'</div>';
   L.DomEvent.disableClickPropagation(box);L.DomEvent.disableScrollPropagation(box);
   const pop=box.querySelector('.lpop'),btn=box.querySelector('.lbtn');
   btn.onclick=()=>{const on=pop.style.display==='none';pop.style.display=on?'grid':'none';btn.classList.toggle('on',on)};
   box.querySelectorAll('.lopt').forEach(o=>o.onclick=()=>{setBase(o.dataset.n);pop.style.display='none';btn.classList.remove('on')});
   return box}});
 new C({position:'topright'}).addTo(map);
 map.on('click',()=>{const p=document.querySelector('.lpop');if(p&&p.style.display!=='none'){p.style.display='none';document.querySelector('.lbtn').classList.remove('on')}});
 setBase(cfg().base||'Eigene Karte')}

// ---------- Live-Standort ----------
let locWatch=null,locMk=null,locAcc=null,locFirst=true;
function addLocate(){const C=L.Control.extend({onAdd(){const b=L.DomUtil.create('button','locbtn leaflet-bar');b.title='Mein Standort';b.innerHTML='&#9678;';L.DomEvent.disableClickPropagation(b);b.onclick=toggleLoc;return b}});new C({position:'topright'}).addTo(map)}
function toggleLoc(){const b=document.querySelector('.locbtn');
 if(locWatch!=null){navigator.geolocation.clearWatch(locWatch);locWatch=null;b.classList.remove('on');if(locMk){locMk.remove();locAcc.remove();locMk=locAcc=null}return}
 if(!navigator.geolocation){setStat('Dieses Gerät liefert keinen Standort.');return}
 b.classList.add('on');locFirst=true;
 locWatch=navigator.geolocation.watchPosition(p=>{const ll=[p.coords.latitude,p.coords.longitude];
   if(!locMk){locAcc=L.circle(ll,{radius:p.coords.accuracy,color:'#2a7de1',weight:1,fillOpacity:.1,interactive:false}).addTo(map);locMk=L.circleMarker(ll,{radius:7,color:'#fff',weight:3,fillColor:'#2a7de1',fillOpacity:1,interactive:false}).addTo(map)}
   else{locMk.setLatLng(ll);locAcc.setLatLng(ll).setRadius(p.coords.accuracy)}
   if(locFirst){locFirst=false;map.setView(ll,Math.max(map.getZoom(),14));windNow(ll[0],ll[1])}},
  e=>{setStat('Standort nicht verfügbar ('+(e.code===1?'Zugriff verweigert':e.message)+').');if(locWatch!=null)toggleLoc()},{enableHighAccuracy:true,maximumAge:5000,timeout:20000})}

// ---------- Legende als Overlay ----------
function toggleLegend(show){const box=document.getElementById('legbox');const on=show!=null?show:box.style.display==='none';box.style.display=on?'block':'none';
 const b=document.querySelector('.legbtn');if(b)b.classList.toggle('on',on)}
function addLegendBtn(){const C=L.Control.extend({onAdd(){const b=L.DomUtil.create('button','legbtn leaflet-bar');b.title='Legende';b.textContent='Legende';L.DomEvent.disableClickPropagation(b);b.onclick=()=>toggleLegend();return b}});new C({position:'topright'}).addTo(map);
 document.getElementById('legclose').onclick=()=>toggleLegend(false)}

// ---------- Einstellungen (Seite „Mehr“) ----------
function fillSettings(){const c=cfg();document.getElementById('s_icuId').value=c.icuId||'';document.getElementById('s_icuKey').value=c.icuKey||'';document.getElementById('s_gh').value=c.ghToken||''}
function openSettings(msg){location.hash='#mehr';setTimeout(()=>{fillSettings();document.getElementById('s_msg').textContent=msg||''},30)}
function initSettings(){fillSettings();applyTheme();document.querySelectorAll('#themeSel button').forEach(b=>b.onclick=()=>{setCfg({theme:b.dataset.t});applyTheme()});document.querySelectorAll('#mapThemeSel button').forEach(b=>b.onclick=()=>{setCfg({mapTheme:b.dataset.m});applyTheme()});setInterval(applyTheme,5*60000);
 document.getElementById('s_save').onclick=()=>{const v=id=>document.getElementById(id).value.trim();
  setCfg({icuId:v('s_icuId'),icuKey:v('s_icuKey'),ghToken:v('s_gh')});document.getElementById('s_msg').textContent='Gespeichert.';
  GH.sync().then(()=>ICU.pull(true))};
 document.getElementById('icubtn').onclick=()=>{location.hash='#fahrten';ICU.pull(true)};
 document.getElementById('syncbtn').onclick=()=>GH.sync()}

// ---------- Unterseiten ----------
let DOCKED=false;const HOME={};
function dockMap(slot,cslot){const m=document.getElementById('map'),cb=document.getElementById('chartbox');
 if(!HOME.m){HOME.m=[m.parentNode,m.nextSibling];HOME.c=[cb.parentNode,cb.nextSibling]}
 const back=(el,h)=>{try{h[0].insertBefore(el,h[1])}catch(e){h[0].appendChild(el)}};
 if(slot){document.getElementById(slot).appendChild(m);DOCKED=true}else if(DOCKED){back(m,HOME.m);DOCKED=false}
 if(cslot){document.getElementById(cslot).appendChild(cb);cb.classList.add('inline')}else if(cb.classList.contains('inline')){back(cb,HOME.c);cb.classList.remove('inline')}
 document.body.classList.toggle('docked',DOCKED);setTimeout(()=>{map.invalidateSize();try{if(RD){drawCharts();setCursor(RD.ci||0)}}catch(e){}},60)}
function fitRide(){if(!RD)return;map.invalidateSize();map.fitBounds(L.latLngBounds(RD.pts),{padding:[24,24]});drawCharts();setCursor(RD.ci||0)}
function route(){const h=(location.hash||'#karte').slice(1);const [pg,arg]=h.split('/');const id=decodeURIComponent(arg||'');
 document.querySelectorAll('.page').forEach(p=>p.classList.toggle('show',p.id==='pg-'+pg));
 document.querySelectorAll('#tabs a').forEach(a=>a.classList.toggle('on',a.dataset.p===(pg==='fahrt'||pg==='pruefen'?'fahrten':pg)));
 if(pg!=='pruefen')exitReview();
 if(pg==='fahrt'){dockMap('dmapslot','dchartslot');if(renderDetail(id)&&curRide!==id)setTimeout(()=>{showRide(id);fitRide()},80);else setTimeout(fitRide,80)}
 else if(pg==='pruefen'){if(RD)showRide('');dockMap('rvmapslot',null);setTimeout(()=>startReview(id),80)}
 else if(DOCKED){dockMap(null,null);showRide('')}
 if(pg==='karte'||!document.getElementById('pg-'+pg))setTimeout(()=>map&&map.invalidateSize(),60);
 if(pg==='fahrten')renderRides();
 if(pg==='wind'&&(!WINDNOW||Date.now()-WINDNOW.t>15*60000||!document.querySelector('#wnow .wbig')))windNow();
 if(pg==='mehr')fillSettings();
 const pe=document.getElementById('pg-'+pg);if(pe&&pg!=='pruefen')pe.scrollTop=0}
window.addEventListener('hashchange',route);
function tile(v,l){return '<div class="tile"><div class="tv">'+v+'</div><div class="tl">'+l+'</div></div>'}
function renderDetail(id){const el=document.getElementById('detail'),hd=document.getElementById('dhead');const r=RIDES.find(x=>x.id===id);
 if(!r){hd.innerHTML='<a href="#fahrten" class="back">‹ Fahrten</a><h1>Fahrt nicht gefunden</h1>';el.innerHTML='';return false}
 const st=new Date(r.start||r.date),t1=r.start&&r.elapsed?new Date(Date.parse(r.start)+r.elapsed*1000):null,hm=d=>d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
 let h='<a href="#fahrten" class="back">‹ Fahrten</a><h1 style="margin-bottom:2px">'+st.toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long'})+'</h1><div class="muted">'+(r.start?hm(st)+(t1?'–'+hm(t1):'')+' Uhr':'')+(r.name?' · '+esc(r.name):'')+'</div>'
  +'<div class="seg actsel" style="margin-top:10px">'+[['board','Board'],['fuss','Zu Fuß'],['ignore','Ignorieren']].map(([k,l])=>'<button data-a="'+k+'" class="'+((r.act||'board')===k?'on':'')+'">'+l+'</button>').join('')+'</div>'
  +(needsReview(r)?'<a class="btn wide rvgo" href="#pruefen/'+encodeURIComponent(r.id)+'">Fahrt prüfen'+(r.rv&&r.rv.sec?' · noch '+r.rv.sec.filter((_,i)=>!(r.rv.res||{})[i]).length+' Abschnitte':'')+' →</a>':(r.act!=='ignore'?'<a class="small" style="display:inline-block;margin-top:8px;color:var(--c)" href="#pruefen/'+encodeURIComponent(r.id)+'">Abschnitte nochmal ansehen</a>':''));
 hd.innerHTML=h;hd.querySelectorAll('.actsel button').forEach(b=>b.onclick=async()=>{await DB.collection('rides').doc(r.id).set(Object.assign({},r,{act:b.dataset.a}));setTimeout(()=>renderDetail(id),50)});h='';
 h+='<div class="tiles">'+tile(r.km.toFixed(1)+' km','Distanz')+tile(fmtDur(r.dur),'Fahrzeit')+(r.elapsed?tile(fmtDur(r.elapsed),'Gesamtzeit'):'')+(r.avg?tile(r.avg+' km/h','Ø Tempo'):'')+(r.vmax?tile(r.vmax+' km/h','Max. Tempo'):'')
  +(r.up!=null?tile(r.up+' m','Anstieg'):'')+(r.hrAvg?tile(r.hrAvg+(r.hrMax?' / '+r.hrMax:''),'Puls Ø / max'):'')+(r.kcal?tile(r.kcal,'kcal'):'')+(r.ways!=null?tile(r.ways,'Wege aufgedeckt'):'')+'</div>';
 if(r.wx&&r.wx.h){const t0=Date.parse(r.start)/1000,t2=t0+(r.elapsed||r.dur||0);const hs=r.wx.h.filter(x=>{const t=Date.parse(x[0])/1000;return t>=t0-3600&&t<=t2+3600&&x[1]!=null});
  h+='<div class="card"><div class="ch">Wind während der Fahrt <span class="muted" style="font-weight:400">· kt / Böen</span></div>'+hs.map(x=>wrow(new Date(Date.parse(x[0])).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}),x[1],x[2],x[3],x[4]!=null?Math.round(x[4])+' °C':'')).join('')
   +'<div class="small muted" style="margin-top:6px">'+esc(r.wx.station)+(r.wx.km!=null?' · '+r.wx.km+' km entfernt':'')+(r.wx.src?' · '+esc(r.wx.src):'')+'</div></div>'}
 else{h+='<div class="card muted">Winddaten werden geladen …</div>';WX.forRide(id).then(ok=>{if(ok&&location.hash==='#fahrt/'+id)renderDetail(id)})}
 el.innerHTML=h;return true}

// ---------- Hell / Dunkel ----------
const THEME={chartBg:'#f4f5f0',chartTx:'#555',cur:'#1d1f1a',dark:false};const MQ=window.matchMedia?matchMedia('(prefers-color-scheme: dark)'):null;
function sunElev(lat,lon,ms){const r=Math.PI/180,n=ms/864e5+2440587.5-2451545,L=(280.46+0.9856474*n)%360,g=((357.528+0.9856003*n)%360)*r;
 const lam=(L+1.915*Math.sin(g)+0.02*Math.sin(2*g))*r,eps=(23.439-0.0000004*n)*r,ra=Math.atan2(Math.cos(eps)*Math.sin(lam),Math.cos(lam)),dec=Math.asin(Math.sin(eps)*Math.sin(lam));
 const ha=(((18.697374558+24.06570982441908*n)%24)*15+lon)*r-ra;return Math.asin(Math.sin(lat*r)*Math.sin(dec)+Math.cos(lat*r)*Math.cos(dec)*Math.cos(ha))/r}
function applyTheme(){const t=cfg().theme||'auto';const d=t==='dark'||(t==='auto'&&MQ&&MQ.matches);THEME.dark=d;
 const mt=cfg().mapTheme||'sun';let dm=false;if(mt==='app')dm=d;else if(mt==='sun'){let la=48.84,lo=10.09;try{if(map){const c=map.getCenter();la=c.lat;lo=c.lng}}catch(e){}dm=sunElev(la,lo,Date.now())<-4}
 document.documentElement.classList.toggle('darkmap',dm);document.querySelectorAll('#mapThemeSel button').forEach(b=>b.classList.toggle('on',b.dataset.m===mt));
 document.documentElement.classList.toggle('dark',d);Object.assign(THEME,d?{chartBg:'#25282a',chartTx:'#a9ada4',cur:'#f2f3ee'}:{chartBg:'#f4f5f0',chartTx:'#555',cur:'#1d1f1a'});
 const DK={'#a3a3a3':'#4b4f53','#c4c4c4':'#44484c','#808080':'#62666a','#5f5f5f':'#7d8186','#777':'#5a5d60'};
 const DKF={'#cfe0c4':'#1e2a1f','#e2dbd0':'#2b2926','#a9d1ee':'#1c3347','#9fc9e8':'#2b4c66','#7fb6df':'#355b7c'};
 if(ctxFill&&ctxFill.eachLayer&&THEME._dm!==dm){THEME._dm=dm;ctxFill.eachLayer(l=>{const o=l.options;if(!o)return;if(o._f==null){o._f=o.fillColor||'';o._c2=o.color||''}const st={};if(o._f)st.fillColor=dm?(DKF[o._f]||o._f):o._f;if(o._c2&&o.stroke!==false)st.color=dm?(DKF[o._c2]||o._c2):o._c2;l.setStyle(st)})}
 if(window.CTXL)CTXL.eachLayer(l=>{if(!l.options)return;if(l.options._c==null)l.options._c=l.options.color;const c=dm?(DK[l.options._c]||l.options._c):l.options._c;if(l.options.color!==c)l.setStyle({color:c})});
 const mc=document.querySelector('meta[name=theme-color]');if(mc)mc.content=d?'#16181a':'#1f6fd1';
 document.querySelectorAll('#themeSel button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));try{if(RD){drawCharts();setCursor(RD.ci||0)}}catch(e){}}
if(MQ&&MQ.addEventListener)MQ.addEventListener('change',applyTheme);
applyTheme();

// ---------- Start ----------
storeReady.then(()=>{notify('ratings');notify('rides');updDbStat()});
function appStart(){
 initSettings();applyTheme();addBaseLayers();addLocate();addLegendBtn();route();windNow();
 (async()=>{await GH.sync();await ICU.pull(false)})();
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&Date.now()-(cfg().icuLast||0)>10*60000){GH.sync().then(()=>ICU.pull(false))}})}
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(e=>console.warn('sw',e));
