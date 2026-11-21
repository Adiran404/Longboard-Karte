// ===================== Fahrt prüfen (Abschnitte durchgehen) =====================
const REV_VER=3;
const ACT_LBL={board:'Board',fuss:'zu Fuß'};
function actOf(sport,fitSport){const s=String(sport||'');if(/run|walk|hike|wander|lauf|gehen|trek/i.test(s)||fitSport===1||fitSport===11||fitSport===17)return 'fuss';return 'board'}
function needsReview(r){return !!(r&&r.p&&(r.act||'board')!=='ignore'&&!(r.rv&&r.rv.fin))}
const ROPT=Object.assign({},null,{
 typ:[['radweg','Radweg'],['feldweg','Feldweg'],['strasse','Straße'],['schotter','Schotter/Wald'],['pfad','Pfad']],
 zugang:[['offen','öffentlich'],['erlaubnis','mit Erlaubnis'],['privat','privat']],
 board:[['ja','ja'],['nein','nein']],
 wo:[['fahrbahn','Fahrbahn'],['begleit','Radweg daneben'],['gehweg','Gehweg']],
 art:[['radweg','Radweg'],['gehweg','Gehweg'],['strasse','Straße'],['feldweg','Feldweg'],['schotter','Schotter'],['pfad','Pfad']]});
const WOSET={fahrbahn:1,begleit:1,gehweg:1};
const RQN={wo:'Wo?',belag:'Belag',autos:'Autos',wind:'Wind',leute:'Leute',typ:'Wegart',art:'Wegart',zugang:'Zugang',board:'Boardbar?'};
const UCOL={fahrbahn:'#d23c3c',begleit:'#1f6fd1',gehweg:'#5b8fd6',radweg:'#1f6fd1',feldweg:'#1a9e4a',strasse:'#8a8a8a',schotter:'#9b6b3d',pfad:'#9b6b3d'};
let WMAP=null,SIDX=null;
LIS.uways.push(()=>{SIDX=null;redrawSoon()});LIS.spots.push(()=>redrawSoon());
function wmap(){if(!WMAP){WMAP={};for(const w of W)WMAP[w[0]]=w}return WMAP}

// ---- räumlicher Index über Wege, Straßen und eigene Wege ----
function buildIdx(){if(SIDX)return SIDX;const cell=0.002,G=new Map();
 const put=(a,b,it)=>{const x0=Math.floor(Math.min(a[0],b[0])/cell),x1=Math.floor(Math.max(a[0],b[0])/cell),y0=Math.floor(Math.min(a[1],b[1])/cell),y1=Math.floor(Math.max(a[1],b[1])/cell);
  for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){const k=x+','+y;let arr=G.get(k);if(!arr)G.set(k,arr=[]);arr.push(it)}};
 P.forEach((p,pi)=>{for(let i=0;i<p.k.length;i++)put(p.pts[i],p.pts[i+1],[0,pi,i])});
 const RDS=[];for(const r of D.ctx.conn||[])RDS.push(dec(r[1]));for(const r of D.ctx.roads||[])RDS.push(dec(r[1]));
 RDS.forEach((pts,ri)=>{for(let i=0;i<pts.length-1;i++)put(pts[i],pts[i+1],[1,ri,i])});
 const U={};for(const [id,e] of Object.entries(STORE.uways))if(e&&e.data&&e.data.p){const pts=dec(e.data.p);U[id]=pts;for(let i=0;i<pts.length-1;i++)put(pts[i],pts[i+1],[2,id,i])}
 return SIDX={G,cell,RDS,U}}
function segDist(p,a,b){const k=Math.cos(p[0]*Math.PI/180)*111320,m=111320;const ax=(a[1]-p[1])*k,ay=(a[0]-p[0])*m,dx=(b[1]-a[1])*k,dy=(b[0]-a[0])*m;const L=dx*dx+dy*dy;let t=L?-(ax*dx+ay*dy)/L:0;t=Math.max(0,Math.min(1,t));return Math.hypot(ax+t*dx,ay+t*dy)}
function matchCands(q){const S=buildIdx();const x=Math.floor(q[0]/S.cell),y=Math.floor(q[1]/S.cell);const C=new Map();
 for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(const it of S.G.get((x+a)+','+(y+b))||[]){let A,B,key;
  if(it[0]===0){const p=P[it[1]];A=p.pts[it[2]];B=p.pts[it[2]+1];key='p'+it[1]}else if(it[0]===1){const pts=S.RDS[it[1]];A=pts[it[2]];B=pts[it[2]+1];key='r'+it[1]}else{const pts=S.U[it[1]];A=pts[it[2]];B=pts[it[2]+1];key='u'+it[1]}
  const raw=segDist(q,A,B);if(it[0]===1&&raw>16)continue;const d=raw+(it[0]===1?6:0);if(d>24)continue;const o=C.get(key);if(!o||d<o.d)C.set(key,{d,it})}
 return C}
function candTo(c){const it=c.it;if(it[0]===0)return {t:'w',id:W[P[it[1]].w][0],pi:it[1],si:it[2],k:'p'+it[1]};if(it[0]===1)return {t:'r',ri:it[1],k:'r'+it[1]};return {t:'u',id:it[1],k:'u'+it[1]}}
function matchPt(q,prevKey){const C=matchCands(q);if(!C.size)return {t:'x',k:'x'};let best=null;for(const [k,c] of C)if(!best||c.d<best.d)best=c;
 // Hysterese: beim bisherigen Weg bleiben, solange er nicht deutlich schlechter passt
 if(prevKey&&C.has(prevKey)&&C.get(prevKey).d<=best.d+8)best=C.get(prevKey);return candTo(best)}

// ---- Fahrt zerlegen ----
function rideArrays(r){const pts=dec(r.p),n=pts.length,v=[];for(let i=0;i<n;i++){const c=r.v&&r.v[i];v.push(!c||c==='~'?null:c.charCodeAt(0)-48)}
 let T=null;if(r.tt&&r.start){T=[];let acc=Date.parse(r.start)/1000;for(let i=0;i<n;i++){acc+=i?(dec2(r.tt,i)||0):0;T.push(acc)}}
 const d=[0];for(let i=1;i<n;i++)d.push(d[i-1]+dist(pts[i-1],pts[i]));return {pts,v,T,d,n}}
function bboxDiag(pts,i0,i1){let a=90,b=-90,c=180,e=-180;for(let i=i0;i<=i1;i++){const p=pts[i];a=Math.min(a,p[0]);b=Math.max(b,p[0]);c=Math.min(c,p[1]);e=Math.max(e,p[1])}return dist([a,c],[b,e])}
function segmentRide(r,A){const {pts,v,d,n}=A;const m=new Array(n);let pk=null;
 for(let i=0;i<n;i++){if(v[i]!=null&&v[i]<2){m[i]={t:'s'};continue}const mm=matchPt(pts[i],pk);m[i]=mm;pk=mm.t==='x'?pk:mm.k}
 for(let i=0;i<n;i++)if(m[i].t==='s')m[i]=i>0?m[i-1]:{t:'x',k:'x'};for(let i=n-2;i>=0;i--)if(m[i].t==='s')m[i]=m[i+1];
 // Straßen: verschiedene Straßenstücke gelten als eins
 const key=x=>x.t==='r'?'r':x.k;
 let runs=[];let s=0;for(let i=1;i<=n;i++)if(i===n||key(m[i])!==key(m[s])){runs.push({c:key(m[s]),t:m[s].t,id:m[s].id,i0:s,i1:i-1});s=i}
 const len=ru=>d[Math.min(ru.i1+1,n-1)]-d[ru.i0];
 const mergeSame=arr=>{const out=[];for(const ru of arr){const l=out[out.length-1];if(l&&l.c===ru.c){l.i1=ru.i1}else out.push(Object.assign({},ru))}return out};
 runs=mergeSame(runs);
 // 1) GPS-Zittern: sehr kurze Stücke (< 25 m, unbekannt < 100 m) dem vorigen Stück zuschlagen
 for(let pass=0;pass<4;pass++){let ch=false;const out=[];
  for(let q=0;q<runs.length;q++){const ru=runs[q];const L=len(ru),lim=ru.t==='x'?100:25;
   if(L<lim&&runs.length>1){if(out.length){out[out.length-1].i1=ru.i1}else if(q+1<runs.length){runs[q+1].i0=ru.i0}ch=true;continue}
   out.push(ru)}
  runs=mergeSame(out);if(!ch)break}
 // 2) Stücke desselben OSM-Wegs nur dann verbinden, wenn eins davon kurz ist (Abzweig eines kleinen Wegs)
 const wid=ru=>ru.t==='w'?ru.id:null;
 for(let q=1;q<runs.length;q++){const a=runs[q-1],b=runs[q];if(wid(a)!=null&&wid(a)===wid(b)&&(len(a)<150||len(b)<150)){a.i1=b.i1;runs.splice(q,1);q--}}
 const secs=[];for(const ru of runs){let kind=ru.t==='w'?'way':ru.t==='u'?'uway':ru.t==='r'?'road':'new';
  if(kind==='new'){const L=len(ru),dg=bboxDiag(pts,ru.i0,ru.i1);if(L>500&&dg<400&&L/Math.max(dg,1)>3)kind='spot'}
  secs.push([kind,ru.i0,ru.i1,ru.t==='u'?ru.id:null])}
 return secs}

// ---- Infos zu einem Abschnitt ----
function placeNear(q){let b=null,bd=1e9;for(const p of D.ctx.places){const dd=dist(q,[p[1],p[2]]);if(dd<bd){bd=dd;b=p}}return b&&bd<6000?b[0]:null}
const KIND_LBL={1:'Radweg',2:'Feldweg mit Kfz-Verbot',3:'Feldweg',4:'Weg mit Kfz-Freigabe'};
function secInfo(r,A,sec){let secCnt=null;const [kind,i0,i1,uid]=sec;const {pts,v,T,d}=A;const ids=new Set(),cods=[];
 if(kind==='way'){const cnt=new Map();let pk=null,tot=0;const ms=[];for(let i=i0;i<=i1;i++){const mm=matchPt(pts[i],pk);if(mm.t!=='x')pk=mm.k;if(mm.t==='w'){cnt.set(mm.id,(cnt.get(mm.id)||0)+1);ms.push(mm);tot++}}
  for(const [id,c] of cnt)if(c>=Math.max(3,tot*.25))ids.add(id);secCnt=cnt;for(const mm of ms)if(ids.has(mm.id))cods.push(P[mm.pi].k[mm.si])}
 let rname=null;if(kind==='road'){const nc=(D.ctx.conn||[]).length;for(let i=i0;i<=i1&&!rname;i+=2){const mm=matchPt(pts[i]);if(mm.t==='r'&&mm.ri<nc)rname=D.ctx.conn[mm.ri][2]||null}}
 const L=d[i1]-d[i0];let vs=0,vn=0;for(let i=i0;i<=i1;i++)if(v[i]!=null&&v[i]>=2){vs+=v[i];vn++}
 const tm=T?(T[i0]+T[i1])/2:null;let w=null;if(r.wx&&r.wx.h&&tm){let b=null,bd=1e12;for(const x of r.wx.h){const dd=Math.abs(Date.parse(x[0])/1000-tm);if(dd<bd&&x[1]!=null){bd=dd;b=x}}if(b)w={ws:b[1],dir:b[3]}}
 let twa=null;if(w){let s=0,c=0;for(let i=i0;i<i1;i+=3){const hd=bearing(pts[i],pts[Math.min(i1,i+3)]);let off=Math.abs(hd-w.dir)%360;if(off>180)off=360-off;s+=off;c++}if(c)twa=s/c}
 let windSec=w?Math.round(w.dir/45)%8:null,shel=null;if(windSec!=null&&cods.length){let sh=0;for(const k of cods)if((k>>windSec)&1)sh++;shel=sh/cods.length}
 const wm=wmap();const w0=ids.size?wm[[...ids][0]]:null;const nm=[...ids].map(id=>wm[id]&&wm[id][4]).find(x=>x);
 const a=placeNear(pts[i0]),b=placeNear(pts[i1]);const where=a&&b&&a!==b?'zwischen '+a+' und '+b:a?'bei '+a:'';
 let title=kind==='way'?(nm||KIND_LBL[w0&&w0[1]]||'Weg'):kind==='uway'?((STORE.uways[uid]&&STORE.uways[uid].data&&lbl2('typ',STORE.uways[uid].data.typ))||'Eigener Weg'):kind==='road'?(rname?rname+' (Straße)':'Straße mit Autoverkehr'):kind==='spot'?'Spot?':'Neuer Weg?';
 return {kind,i0,i1,uid,ids,cnt:secCnt,L,vavg:vn?vs/vn:null,w,twa,windSec,shel,title,where,t0:T&&T[i0],t1:T&&T[i1],km0:d[i0]/1000,km1:d[i1]/1000,w0}}
function lbl2(k,v){let o=(OPT[k]||ROPT[k]||[]).find(x=>x[0]===v);if(!o&&k==='typ')o=ROPT.wo.find(x=>x[0]===v);return o?o[1]:v}
function twaTxt(t){return t==null?'':t<45?'Gegenwind':t<90?'am Wind':t<135?'Halbwind':'Rückenwind'}
function prefill(r,I,k){const o={},src={};const sv=r.rv&&r.rv.vals&&k!=null?r.rv.vals[k]:null;
 if(sv){for(const q in sv)if(q!=='note'&&sv[q]!=null){o[q]=sv[q];src[q]='du'}
  if(I.kind==='way'&&o.art==null){const rt=[...(I.ids||[])].map(id=>RAT['w'+id]).find(x=>x&&x.typ);if(rt){o.art=rt.typ;src.art='du'}}
  return {o,src,note:sv.note||''}}
 if(I.kind==='way'){const rt=[...I.ids].map(id=>RAT['w'+id]).find(x=>x)||{};for(const k of ['belag','autos','wind','leute'])if(rt[k]!=null){o[k]=rt[k];src[k]='du'}
  if(rt.typ){o.art=rt.typ;src.art='du'}
  const w=I.w0;if(o.belag==null&&w&&w[3]>=1&&w[3]<=4){o.belag=w[3];src.belag='OSM'}
  if(o.autos==null&&w&&(w[1]===1||w[1]===2)){o.autos='schild';src.autos='OSM'}
  if(o.wind==null&&I.shel!=null){o.wind=I.shel>.7?'windschatten':I.shel<.25?'frei':'teilweise';src.wind='berechnet'}}
 else if(I.kind==='uway'){const u=STORE.uways[I.uid]&&STORE.uways[I.uid].data||{};for(const k of ['typ','belag','autos','wind','leute'])if(u[k]!=null){o[k]=u[k];src[k]='du'}if(WOSET[o.typ]){o.wo=o.typ;src.wo='du';delete o.typ}}
 return {o,src}}

// ---- Prüf-Ansicht ----
let REV=null,REVIEWING=false,revLayer=null;
function exitReview(){SPLIT=null;document.body.classList.remove('reviewing');if(!REVIEWING)return;REVIEWING=false;REV=null;if(revLayer)revLayer.clearLayers();redrawSoon()}
async function startReview(id){await storeReady;for(let i=0;i<80&&!P.length;i++)await new Promise(s=>setTimeout(s,250));
 const r=RIDES.find(x=>x.id===id);const body=document.getElementById('rvbody');if(!r){body.innerHTML='<div class="card">Fahrt nicht gefunden.</div>';return}
 const A=rideArrays(r);let rv=r.rv&&r.rv.sec&&(r.rv.v===REV_VER||r.rv.fin)?r.rv:null;
 if(!rv){const sec=segmentRide(r,A);const res={};sec.forEach((s,i)=>{if(s[0]==='road')res[i]='ok'});rv={v:REV_VER,sec,res,fin:!sec.some(s=>s[0]!=='road')};await DB.collection('rides').doc(r.id).set(Object.assign({},r,{rv}))}
 REV={id,r,A,rv,infos:rv.sec.map(s=>secInfo(r,A,s)),cur:0,sel:null};if(rv.fin&&!r.rv)rv.fin=false;REVIEWING=true;document.body.classList.add('reviewing');
 const started=rv.sec.some((s,i)=>s[0]!=='road'&&rv.res[i]);const first=rv.sec.findIndex((s,i)=>!rv.res[i]);REV.cur=!started||first<0?0:first;
 if(!revLayer)revLayer=L.layerGroup().addTo(map);draw();
 if(!started&&!rv.fin){const kn=knownSecs(REV);if(kn.length){showChoice(kn);return}}
 showSec(REV.cur)}
// Abschnitte, die schon vollständig bewertet sind (Heimstrecke): Wege mit eigenen Werten oder eigene Wege
function secKnown(R_,k){const I=R_.infos[k];if(!I||R_.rv.res[k])return false;const has=o=>o&&['belag','autos','wind','leute'].some(q=>o[q]!=null);
 if(I.kind==='way')return I.ids&&I.ids.size>0&&[...I.ids].every(id=>has(RAT['w'+id]));if(I.kind==='uway')return has(STORE.uways[I.uid]&&STORE.uways[I.uid].data);return false}
function knownSecs(R_){return R_.rv.sec.map((s,k)=>k).filter(k=>secKnown(R_,k))}
function showChoice(kn){const R_=REV;const open=R_.rv.sec.filter((s,k)=>!R_.rv.res[k]&&!kn.includes(k)).length;const L_=kn.reduce((a,k)=>a+R_.infos[k].L,0);
 document.getElementById('rvprog').textContent=R_.rv.sec.length+' Abschnitte';revDraw();map.fitBounds(L.latLngBounds(R_.A.pts),{padding:[30,30]});
 document.getElementById('rvbody').innerHTML='<div class="card"><div class="rvt">Wie willst du prüfen?</div><div class="muted">'+kn.length+' Abschnitte ('+(L_/1000).toFixed(1)+' km) kennst du schon und hast sie bewertet. '+(open?open+' sind neu oder unbewertet.':'Nichts Neues dabei.')+'</div>'
  +'<div class="btnrow" style="flex-direction:column;align-items:stretch;gap:8px;margin-top:10px"><button class="btn" id="rvnew">'+(open?'Nur Neues bewerten ('+open+')':'Alles übernehmen')+'</button><button class="btn sec" id="rvall">Alles durchgehen</button></div>'
  +'<div class="muted" style="margin-top:8px">Bei „Nur Neues“ bleiben deine bisherigen Bewertungen unverändert, die Fahrt wird nur als gefahren vermerkt. Einzelne Abschnitte kannst du danach jederzeit über die Zeitleiste oder „Bewertung ändern“ im Infofeld anpassen.</div></div>';
 document.getElementById('rvall').onclick=()=>showSec(0);
 document.getElementById('rvnew').onclick=async()=>{const b=document.getElementById('rvnew');b.disabled=true;b.textContent='Übernehme …';
  R_.rv.vals=R_.rv.vals||{};for(const k of kn){if(REV!==R_)return;const pf=prefill(R_.r,R_.infos[k],k);const sel=Object.assign({},pf.o);R_.rv.res[k]=await applySec(R_,k,sel,'')||'ok';R_.rv.vals[k]=sel}
  await saveRv(R_);if(REV!==R_)return;const f=R_.rv.sec.findIndex((s,i)=>!R_.rv.res[i]);if(f<0){revDraw();showDone()}else showSec(f)}}
function revDraw(){if(!REV)return;revLayer.clearLayers();const R=L.canvas({padding:.5,tolerance:8,pane:ridePane()});const {pts}=REV.A;
 L.polyline(pts,{renderer:R,color:THEME.dark?'#cfd3cc':'#7d8178',weight:3,opacity:.5,interactive:false}).addTo(revLayer);
 REV.infos.forEach((I,k)=>{const seg=pts.slice(I.i0,I.i1+1);if(seg.length<2)return;const st=REV.rv.res[k];const isCur=k===REV.cur;
  const col=isCur?'#1f6fd1':st==='ok'||st==='new'||st==='spot'?'#2e9e44':st==='del'?'#b0b0b0':I.kind==='road'?'#9a9a9a':'#f0a030';
  if(isCur)L.polyline(seg,{renderer:R,color:'#fff',weight:12,opacity:1,interactive:false}).addTo(revLayer);
  L.polyline(seg,{renderer:R,color:col,weight:isCur?7:5,opacity:isCur?1:.85}).on('click',ev=>{if(SPLIT){L.DomEvent.stop(ev);SPLIT(ev.latlng);return}goSec(k)}).addTo(revLayer)});
 const I=REV.infos[REV.cur];if(!I)return;const seg=pts.slice(I.i0,I.i1+1);
 let acc=0;for(let i=1;i<seg.length;i++){acc+=dist(seg[i-1],seg[i]);if(acc>Math.max(120,I.L/5)){acc=0;const b=bearing(seg[i-1],seg[Math.min(seg.length-1,i+2)]);
   L.marker(seg[i],{interactive:false,icon:L.divIcon({className:'rvarr',iconSize:[18,18],html:'<div style="transform:rotate('+(b-90)+'deg)">➤</div>'})}).addTo(revLayer)}}
 L.circleMarker(seg[0],{renderer:R,radius:7,color:'#1f6fd1',weight:3,fillColor:'#fff',fillOpacity:1,interactive:false}).addTo(revLayer);
 L.circleMarker(seg[seg.length-1],{renderer:R,radius:7,color:'#fff',weight:2,fillColor:'#1f6fd1',fillOpacity:1,interactive:false}).addTo(revLayer)}
function tlSvg(){const {v,d,n}=REV.A;const D_=d[n-1]||1;let p='';const step=Math.max(1,Math.floor(n/160));let mx=10;for(let i=0;i<n;i++)if(v[i]!=null)mx=Math.max(mx,v[i]);
 for(let i=0;i<n;i+=step){const x=300*d[i]/D_,y=32-28*((v[i]||0)/mx);p+=(p?'L':'M')+x.toFixed(1)+' '+y.toFixed(1)}
 const I=REV.infos[REV.cur];const x0=300*d[I.i0]/D_,x1=300*d[I.i1]/D_;
 let marks='';REV.infos.forEach((J,k)=>{const st=REV.rv.res[k];if(st&&k!==REV.cur)marks+='<rect x="'+(300*d[J.i0]/D_).toFixed(1)+'" y="33" width="'+Math.max(1,300*(d[J.i1]-d[J.i0])/D_).toFixed(1)+'" height="3" fill="#2e9e44"/>'});
 return '<svg viewBox="0 0 300 36" preserveAspectRatio="none" class="tl" id="rvtl"><rect x="'+x0.toFixed(1)+'" y="0" width="'+Math.max(2,x1-x0).toFixed(1)+'" height="36" fill="#1f6fd1" opacity=".18"/><path d="'+p+'" stroke="#1f6fd1" stroke-width="1.3" fill="none" vector-effect="non-scaling-stroke"/>'+marks+'</svg>'}
const SHORT={belag:{1:'glatt',2:'gut',3:'rau',4:'grob',5:'unfahrbar'},autos:{schild:'Verbot',keine:'keine',vereinzelt:'vereinzelt',oft:'oft'},wind:{frei:'frei',teilweise:'teils',windschatten:'Schatten'},leute:{leer:'leer',wenig:'wenig',viel:'viel'},typ:{radweg:'Radweg',feldweg:'Feldweg',strasse:'Straße',schotter:'Schotter',pfad:'Pfad'},wo:{fahrbahn:'Fahrbahn',begleit:'Radweg',gehweg:'Gehweg'},zugang:{offen:'offen',erlaubnis:'Erlaubnis',privat:'privat'}};
function chips(k,cur){const opts=OPT[k]||ROPT[k];return '<div class="chips2" data-k="'+k+'">'+opts.map(([v,t])=>'<button class="chip'+(cur==v?' on':'')+'" data-v="'+v+'">'+((SHORT[k]||{})[v]||t)+'</button>').join('')+'</div>'}
function hm2(t){return t?new Date(t*1000).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}):''}
function navIdx(from,dir){return Math.max(0,Math.min(REV.rv.sec.length-1,from+dir))}
let LASTSEL=null;
function showSec(k){if(!REV)return;REV.cur=Math.max(0,Math.min(REV.infos.length-1,k));const I=REV.infos[REV.cur],r=REV.r,rv=REV.rv;
 const real=rv.sec.map((s,i)=>i).filter(i=>rv.sec[i][0]!=='road');const done=real.filter(i=>rv.res[i]).length;
 document.getElementById('rvprog').textContent=(I.kind==='road'?'Straßenstück':'Abschnitt '+(real.indexOf(REV.cur)+1)+'/'+real.length)+' · '+done+' erledigt';
 const pf=prefill(r,I,REV.cur);REV.sel=Object.assign({},pf.o);REV.src=pf.src;REV.dirty=false;REV.note=pf.note||'';const st=rv.res[REV.cur];
 let qs=[];if(I.kind==='new')qs=['typ','belag','autos','wind','leute'];else if(I.kind==='spot')qs=['belag','wind','zugang'];else if(I.kind==='uway')qs=WOSET[REV.sel.wo]?['wo','belag','autos','wind','leute']:['typ','belag','autos','wind','leute'];else if(I.kind==='way')qs=['art','belag','autos','wind','leute'];else if(I.kind==='road')qs=['wo','belag','autos','wind','leute'];
 if((r.act||'board')==='fuss'&&I.kind!=='road'&&I.kind!=='spot')qs.push('board');
 const tool=(id,txt,on)=>'<button class="tbtn'+(on?' on':'')+'" id="'+id+'">'+txt+'</button>';
 let h='<div class="rvtools">'+(REV.cur>0&&I.kind!=='spot'?tool('rvsame','⟲ Wie vorher'):'')+tool('rvsplit','✂ Teilen')+(REV.cur+1<REV.infos.length?tool('rvmerge','⊕ Verbinden'):'')+tool('rvnotebtn','✎ Notiz',!!REV.note)
  +(I.kind==='way'||I.kind==='road'||I.kind==='uway'?tool('rvtonew2','＋ Eigener Weg'):'')+(I.kind==='new'?tool('rvtospot','◎ War ein Spot')+tool('rvdel','✕ Kein Weg'):'')+(I.kind==='spot'?tool('rvtonew','↺ Doch ein Weg')+tool('rvdel','✕ Verwerfen'):'')+tool('rvrest','⏭ Rest passt')+'</div>';
 h+=tlSvg()+'<div class="tlx"><span>'+hm2(REV.A.T&&REV.A.T[0])+'</span><span class="acc">'+(I.t0?hm2(I.t0)+'–'+hm2(I.t1)+' · ':'')+'km '+I.km0.toFixed(1)+'–'+I.km1.toFixed(1)+'</span><span>'+hm2(REV.A.T&&REV.A.T[REV.A.n-1])+'</span></div>';
 h+='<div class="rvt">'+esc(I.title)+(st&&!(I.kind==='road'&&st==='ok')?' <span class="stb">'+(st==='del'?'verworfen':st==='skip'?'übersprungen':'erledigt')+'</span>':'')+'</div><div class="rvi">'+(I.where?esc(I.where)+' · ':'')+(I.L/1000).toFixed(1)+' km'+(I.vavg?' · Ø '+Math.round(I.vavg)+' km/h':'')+(I.w?' · '+Math.round(I.w.ws)+' kt '+DIR16(I.w.dir)+(I.twa!=null?', '+twaTxt(I.twa):''):'')+'</div>';
 if(I.kind==='road')h+='<div class="rvh">Straße mit Autoverkehr – nur ausfüllen, wenn du hier auf Gehweg, Radweg oder Fahrbahn unterwegs warst.</div>';
 if(I.kind==='new')h+='<div class="rvh">Liegt auf keinem bekannten Weg.</div>';
 if(I.kind==='spot')h+='<div class="qrow"><span class="ql">Name</span><input id="rvname" class="rvin" placeholder="z. B. Parkplatz Sportplatz"></div>';
 for(const q of qs)h+='<div class="qrow"><span class="ql">'+(q==='autos'?'Autos gesehen':RQN[q])+(REV.src[q]&&REV.src[q]!=='du'?'<i>'+REV.src[q]+'</i>':(q==='art'&&REV.sel.art==null&&I.w0&&KIND_LBL[I.w0[1]]?'<i>OSM: '+esc(KIND_LBL[I.w0[1]])+'</i>':''))+'</span>'+chips(q,REV.sel[q])+'</div>';
 h+='<div class="rvnotebox" id="rvnotebox" style="display:none"><div class="ch">Notiz</div><textarea id="rvnote" maxlength="500">'+esc(REV.note)+'</textarea><div class="btnrow"><button class="btn" id="rvnoteok">Fertig</button></div></div>';
 const body=document.getElementById('rvbody');body.innerHTML=h;body.scrollTop=0;
 const okTxt=()=>I.kind==='road'?(Object.keys(REV.sel).length?'Übernehmen':'Weiter'):I.kind==='new'?'Als Weg übernehmen':I.kind==='spot'?'Als Spot übernehmen':'Passt, weiter';
 document.getElementById('rvbar').innerHTML='<button class="btn sec" id="rvprev" aria-label="Voriger Abschnitt">‹</button><button class="btn" id="rvok">'+okTxt()+'</button><button class="btn sec" id="rvskip" aria-label="Nächster Abschnitt">›</button>';
 body.querySelectorAll('.chips2').forEach(c=>c.querySelectorAll('.chip').forEach(b=>b.onclick=()=>{const q=c.dataset.k;let v=b.dataset.v;if(q==='belag')v=+v;
   REV.dirty=true;if(q==='autos'){REV.tAut=REV.tAut||{};REV.tAut[REV.cur]=true}if(REV.sel[q]==v){delete REV.sel[q];b.classList.remove('on')}else{REV.sel[q]=v;c.querySelectorAll('.chip').forEach(x=>x.classList.toggle('on',x===b))}document.getElementById('rvok').textContent=okTxt()}));
 const $=id=>document.getElementById(id);
 $('rvprev').onclick=()=>goSec(REV.cur-1);$('rvskip').onclick=()=>goSec(REV.cur+1);$('rvok').onclick=()=>acceptSec();
 const nmI=$('rvname');if(nmI){if(pf.o.name)nmI.value=pf.o.name;nmI.oninput=()=>{REV.dirty=true}}
 $('rvnotebtn').onclick=()=>{$('rvnotebox').style.display='block';$('rvnote').focus()};
 $('rvnoteok').onclick=()=>{REV.note=$('rvnote').value.trim();REV.dirty=true;$('rvnotebox').style.display='none';$('rvnotebtn').classList.toggle('on',!!REV.note)};
 $('rvnote').oninput=()=>{REV.dirty=true};
 if($('rvdel'))$('rvdel').onclick=()=>markSec('del');
 if($('rvtonew2'))$('rvtonew2').onclick=()=>{REV.rv.sec[REV.cur][0]='new';REV.rv.sec[REV.cur][3]=null;delete REV.rv.res[REV.cur];if(REV.rv.vals)delete REV.rv.vals[REV.cur];REV.infos[REV.cur]=secInfo(REV.r,REV.A,REV.rv.sec[REV.cur]);showSec(REV.cur)};
 if($('rvtospot'))$('rvtospot').onclick=()=>{REV.rv.sec[REV.cur][0]='spot';REV.infos[REV.cur]=secInfo(REV.r,REV.A,REV.rv.sec[REV.cur]);showSec(REV.cur)};
 if($('rvtonew'))$('rvtonew').onclick=()=>{REV.rv.sec[REV.cur][0]='new';REV.infos[REV.cur]=secInfo(REV.r,REV.A,REV.rv.sec[REV.cur]);showSec(REV.cur)};
 $('rvrest').onclick=acceptRest;$('rvsplit').onclick=startSplit;if($('rvmerge'))$('rvmerge').onclick=mergeNext;
 if($('rvsame'))$('rvsame').onclick=()=>{const pk=REV.cur-1;const PV=prefill(REV.r,REV.infos[pk],pk).o;REV.dirty=true;for(const q of ['art','belag','autos','wind','leute','wo'])if(qs.includes(q)){if(PV[q]!=null)REV.sel[q]=PV[q];else delete REV.sel[q]}
  document.querySelectorAll('#rvbody .chips2').forEach(c=>{const q=c.dataset.k;c.querySelectorAll('.chip').forEach(b=>b.classList.toggle('on',REV.sel[q]!=null&&b.dataset.v==String(REV.sel[q])))});$('rvok').textContent=okTxt()};
 $('rvtl').onclick=ev=>{const rc=ev.currentTarget.getBoundingClientRect();const f=(ev.clientX-rc.left)/rc.width;const dd=f*REV.A.d[REV.A.n-1];const k=REV.infos.findIndex(J=>REV.A.d[J.i0]<=dd&&REV.A.d[J.i1]>=dd);if(k>=0)goSec(k)};
 revDraw();const seg=REV.A.pts.slice(I.i0,I.i1+1);map.invalidateSize();if(seg.length>1){const b=L.latLngBounds(seg);const tz=Math.min(16,map.getBoundsZoom(b,false,L.point(60,60)));
  if(!REV.moved||!map.getBounds().pad(-.08).contains(b)||map.getZoom()<tz-1||map.getZoom()>tz+1){map.flyToBounds(b,{padding:[30,30],maxZoom:16,duration:REV.moved?.45:0});REV.moved=true}}}

let SPLIT=null,SPLITHOOK=false;
function shiftKeys(o,from,delta){const n={};for(const k in o||{}){const i=+k;if(i>=from){if(delta<0&&i===from)continue;n[i+delta]=o[k]}else n[i]=o[k]}return n}
async function mergeNext(){const R_=REV;if(!R_)return;if(R_.dirty){R_.dirty=false;await saveCur(R_)}const k=R_.cur,s=R_.rv.sec;if(k+1>=s.length)return;
 const a=s[k],b=s[k+1];a[2]=b[2];if(a[0]==='road'&&b[0]!=='road'){a[0]=b[0];a[3]=b[3]}s.splice(k+1,1);
 R_.rv.res=shiftKeys(R_.rv.res,k+1,-1);delete R_.rv.res[k];R_.rv.vals=shiftKeys(R_.rv.vals,k+1,-1);R_.rv.man=true;
 R_.infos.splice(k+1,1);R_.infos[k]=secInfo(R_.r,R_.A,a);await saveRv(R_);showSec(k)}
function startSplit(){const R_=REV;if(!R_)return;if(!SPLITHOOK){SPLITHOOK=true;map.on('click',ev=>{if(SPLIT)SPLIT(ev.latlng)})}const I=R_.infos[R_.cur];if(I.i1-I.i0<4)return;
 document.getElementById('rvprog').textContent='Tippe auf die Stelle im blauen Abschnitt, an der geteilt werden soll';map.getContainer().style.cursor='crosshair';
 SPLIT=async ll=>{SPLIT=null;map.getContainer().style.cursor='';if(REV!==R_)return;const q=[ll.lat,ll.lng];let bi=-1,bd=80;
  for(let i=I.i0+2;i<=I.i1-2;i++){const dd=dist(q,R_.A.pts[i]);if(dd<bd){bd=dd;bi=i}}
  if(bi<0){showSec(R_.cur);document.getElementById('rvprog').textContent='Daneben getippt – nochmal „Hier teilen“';return}
  if(R_.dirty){R_.dirty=false;await saveCur(R_)}const k=R_.cur,s=R_.rv.sec;const a=s[k];const b=[a[0],bi,a[2],a[0]==='uway'?'u'+R_.id.slice(1)+'_'+bi:a[3]];a[2]=bi;s.splice(k+1,0,b);
  R_.rv.res=shiftKeys(R_.rv.res,k+1,1);R_.rv.vals=shiftKeys(R_.rv.vals,k+1,1);if(R_.rv.vals&&R_.rv.vals[k])R_.rv.vals[k+1]=Object.assign({},R_.rv.vals[k]);delete R_.rv.res[k];R_.rv.man=true;
  R_.infos.splice(k+1,0,secInfo(R_.r,R_.A,b));R_.infos[k]=secInfo(R_.r,R_.A,a);await saveRv(R_);showSec(k)}}
function curSel(){const sel=Object.assign({},REV.sel);const nm=document.getElementById('rvname');if(nm&&nm.value.trim())sel.name=nm.value.trim();const nt=document.getElementById('rvnote');const note=((nt&&nt.value)||REV.note||'').trim();return {sel,note}}
async function saveCur(R_){const {sel,note}=curSel();const res=await applySec(R_,R_.cur,sel,note);R_.rv.res[R_.cur]=res;R_.rv.vals=R_.rv.vals||{};R_.rv.vals[R_.cur]=Object.assign({},sel,note?{note}:{});
 const I=R_.infos[R_.cur];if(I.kind==='way'||I.kind==='uway')LASTSEL=sel;await saveRv(R_)}
async function goSec(k){const R_=REV;if(!R_)return;if(k<0||k>=R_.infos.length)return;if(R_.dirty){R_.dirty=false;await saveCur(R_);if(REV!==R_)return}showSec(k)}
function today(){return new Date().toLocaleDateString('sv-SE')}
function rdDay(){return REV.r.start?new Date(REV.r.start).toLocaleDateString('sv-SE'):REV.r.date}
function addAct(o){const a=REV.r.act||'board',day=rdDay();const A=Object.assign({},o.act||{});A[a]=(A[a]||[]).filter(x=>x!==day).concat(day).slice(-50);o.act=A;if(a==='board'){o.ridden=true;const rs=(o.rides||[]).filter(x=>x!==day);rs.push(day);o.rides=rs.slice(-50)}return o}
function rdp(pts,eps){if(pts.length<3)return pts;const k=Math.cos(pts[0][0]*Math.PI/180)*111320;const sq=(p,a,b)=>segDist(p,a,b);
 const keep=new Uint8Array(pts.length);keep[0]=keep[pts.length-1]=1;const st=[[0,pts.length-1]];
 while(st.length){const [a,b]=st.pop();let md=0,mi=-1;for(let i=a+1;i<b;i++){const dd=sq(pts[i],pts[a],pts[b]);if(dd>md){md=dd;mi=i}}if(md>eps){keep[mi]=1;st.push([a,mi],[mi,b])}}
 return pts.filter((_,i)=>keep[i])}
function hull(pts){const P_=pts.map(p=>[p[1],p[0]]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
 const lo=[],up=[];for(const p of P_){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p)}for(let i=P_.length-1;i>=0;i--){const p=P_[i];while(up.length>=2&&cr(up[up.length-2],up[up.length-1],p)<=0)up.pop();up.push(p)}
 return lo.slice(0,-1).concat(up.slice(0,-1)).map(p=>[p[1],p[0]])}
async function applySec(R_,k,sel,note){const I=R_.infos[k];const day=R_.r.start?new Date(R_.r.start).toLocaleDateString('sv-SE'):R_.r.date;const act=R_.r.act||'board';
 const addA=o=>{const A=Object.assign({},o.act||{});A[act]=(A[act]||[]).filter(x=>x!==day).concat(day).slice(-50);o.act=A;if(act==='board'){o.ridden=true;const rs=(o.rides||[]).filter(x=>x!==day);rs.push(day);o.rides=rs.slice(-50)}return o};
 const tsec=I.t0&&I.t1&&R_.tAut&&R_.tAut[k]?(I.t0+I.t1)/2:null;
 if(I.kind==='road'){if(!Object.keys(sel).filter(k=>k!=='name').length&&!note)return 'ok';const seg=rdp(R_.A.pts.slice(I.i0,I.i1+1),3);
   const o={p:encPl(seg),len:Math.round(I.L),typ:sel.wo||'fahrbahn',road:true,created:today(),from:R_.id};
   for(const kk of ['belag','autos','wind','leute','board'])if(sel[kk]!=null)o[kk]=sel[kk];if(sel.wind!=null&&I.windSec!=null)o.windDir=I.windSec;if(note)o.notiz=note;addA(o);obsPush(o,tsec,sel.autos,R_.id);
   await DB.collection('uways').doc('u'+R_.id.slice(1)+'_'+I.i0).set(o);return 'new'}
 if(I.kind==='way'){for(const id of I.ids){const my=I.cnt&&I.cnt.get(id)||0;if(R_.infos.some((J,k2)=>k2!==k&&J&&J.kind==='way'&&J.cnt&&(J.cnt.get(id)||0)>my&&R_.rv.vals&&R_.rv.vals[k2]&&Object.keys(R_.rv.vals[k2]).length))continue;const o=Object.assign({},RAT['w'+id]||{});o.way=id;
   for(const kk of ['belag','autos','wind','leute'])if(sel[kk]!=null)o[kk]=sel[kk];else delete o[kk];
   if(sel.art)o.typ=sel.art;
   if(sel.wind!=null&&I.windSec!=null)o.windDir=I.windSec;else delete o.windDir;if(sel.board)o.board=sel.board;if(note)o.notiz=note;
   o.confirmed=day;o.updated=today();addA(o);obsPush(o,tsec,sel.autos,R_.id);await DB.collection('ratings').doc('w'+id).set(o)}return 'ok'}
 if(I.kind==='uway'){const e=STORE.uways[I.uid]&&STORE.uways[I.uid].data?STORE.uways[I.uid]:null;let base=null;if(!e){const pv=R_.rv.sec[k-1];base=pv&&pv[0]==='uway'&&STORE.uways[pv[3]]&&STORE.uways[pv[3]].data}
   const o=Object.assign({},e?e.data:{road:base?!!base.road:true,typ:base&&base.typ||null,created:today(),from:R_.id});
   if(!e||(o.from===R_.id&&String(I.uid).endsWith('_'+I.i0))){const seg=rdp(R_.A.pts.slice(I.i0,I.i1+1),3);o.p=encPl(seg);o.len=Math.round(I.L)}
   if(!e)for(const kk of ['belag','autos','wind','leute','board','windDir','notiz','act','ridden','rides'])delete o[kk];for(const kk of ['typ','belag','autos','wind','leute','board'])if(sel[kk]!=null)o[kk]=sel[kk];if(sel.wo)o.typ=sel.wo;if(note)o.notiz=note;
   if(sel.wind!=null&&I.windSec!=null)o.windDir=I.windSec;addA(o);obsPush(o,tsec,sel.autos,R_.id);o.updated=today();await DB.collection('uways').doc(I.uid).set(o);return 'ok'}
 if(I.kind==='new'){const seg=rdp(R_.A.pts.slice(I.i0,I.i1+1),3);const o={p:encPl(seg),len:Math.round(I.L),typ:sel.typ||null,created:today(),from:R_.id};
   for(const kk of ['belag','autos','wind','leute','board'])if(sel[kk]!=null)o[kk]=sel[kk];if(sel.wind!=null&&I.windSec!=null)o.windDir=I.windSec;if(note)o.notiz=note;addA(o);
   await DB.collection('uways').doc('u'+R_.id.slice(1)+'_'+I.i0).set(o);return 'new'}
 if(I.kind==='spot'){const seg=R_.A.pts.slice(I.i0,I.i1+1);const hl=hull(seg);let la=0,lo=0;for(const p of seg){la+=p[0];lo+=p[1]}
   const o={poly:encPl(hl),c:[+(la/seg.length).toFixed(5),+(lo/seg.length).toFixed(5)],name:sel.name||'Spot',created:today(),from:R_.id};
   for(const kk of ['belag','wind','zugang'])if(sel[kk]!=null)o[kk]=sel[kk];if(note)o.notiz=note;addA(o);
   await DB.collection('spots').doc('s'+R_.id.slice(1)+'_'+I.i0).set(o);return 'spot'}}
async function saveRv(R_){R_.rv.fin=!R_.rv.sec.some((s,i)=>!R_.rv.res[i]);const nr=Object.assign({},R_.r,{rv:R_.rv});R_.r=nr;await DB.collection('rides').doc(R_.id).set(nr)}
async function acceptSec(){const R_=REV;if(!R_)return;R_.dirty=false;await saveCur(R_);if(REV!==R_)return;
 if(R_.cur+1<R_.infos.length)showSec(R_.cur+1);else if(R_.rv.fin){revDraw();showDone()}else{const k=R_.rv.sec.findIndex((s,i)=>!R_.rv.res[i]);showSec(k)}}
async function markSec(st,R_){R_=R_||REV;if(!R_)return;const rv=R_.rv;rv.res[R_.cur]=st;await saveRv(R_);if(REV!==R_)return;
 if(R_.cur+1<R_.infos.length)showSec(R_.cur+1);else if(rv.fin){revDraw();showDone()}else showSec(rv.sec.findIndex((s,i)=>!rv.res[i]))}
async function acceptRest(){const R_=REV;const rv=R_.rv;document.getElementById('rvprog').textContent='Speichere …';
 for(let k=0;k<rv.sec.length;k++){if(rv.res[k])continue;const I=R_.infos[k];if(I.kind==='new'||I.kind==='spot')continue;const pf=prefill(R_.r,I,k);rv.res[k]=await applySec(R_,k,pf.o,pf.note||'')}
 await saveRv(R_);if(REV!==R_)return;if(rv.fin)showDone();else showSec(rv.sec.findIndex((s,i)=>!rv.res[i]))}
function showDone(){if(!REV)return;const rv=REV.rv;const c=v=>Object.keys(rv.res).filter(i=>rv.res[i]===v&&rv.sec[i][0]!=='road').length;
 document.getElementById('rvprog').textContent='Fertig';
 document.getElementById('rvbody').innerHTML='<div class="card"><div class="rvt">Fahrt geprüft</div><div class="muted">'+c('ok')+' Abschnitte bestätigt · '+c('new')+' neue Wege · '+c('spot')+' Spots'+(c('skip')?' · '+c('skip')+' übersprungen':'')+'</div><div class="btnrow"><a class="btn" href="#fahrt/'+encodeURIComponent(REV.id)+'">Zur Fahrt</a><a class="btn sec" href="#karte">Zur Karte</a></div></div>';
 map.fitBounds(L.latLngBounds(REV.A.pts),{padding:[30,30]})}

// ---- eigene Wege und Spots auf der Karte ----
function drawExtras(R,fog){hookTap();hookTimeSel();try{drawFoot(R,fog)}catch(e){console.error(e)}
for(const [id,e] of Object.entries(STORE.uways)){const u=e&&e.data;if(!u||!u.p)continue;const pts=dec(u.p);
  const col=UCOL[u.typ]||'#1a9e4a';const dash=u.typ==='pfad'?'2 6':u.typ==='schotter'?'8 5':null;const sm=u.belag?BELAG_SM[u.belag]:0;
  if(seenOk(u))L.polyline(pts,{renderer:R,color:'#1d1f1a',weight:9,opacity:.85*(RD?.2:1),interactive:false}).addTo(reveal);
  L.polyline(pts,{renderer:R,color:col,weight:(sm==1||sm==2)?5:3.4,opacity:(RD?.2:1)*(u.belag===5?.35:1),dashArray:dash,interactive:false}).addTo(layer);
  if(rosaOk(u,pts[Math.floor(pts.length/2)]))L.polyline(pts,{renderer:R,color:'#ff3fd2',weight:11,opacity:.33*(RD?.2:1),interactive:false}).addTo(halo)}
 for(const [id,e] of Object.entries(STORE.spots)){const s=e&&e.data;if(!s||!s.poly)continue;
  L.polygon(dec(s.poly),{renderer:R,color:'#7a3fd1',weight:2,fillColor:'#7a3fd1',fillOpacity:.18*(RD?.3:1),opacity:RD?.3:1,interactive:false}).addTo(layer)}}
function seenOk(o){const f=(document.getElementById('seenBy')||{}).value||'alle';if(f==='alle')return true;return !!(o&&o.act&&o.act[f]&&o.act[f].length)||(f==='board'&&o&&o.ridden)}
function actLine(o){if(!o)return '';const p=[];const A=o.act||{};if(!A.board&&o.ridden&&o.rides)A.board=o.rides;for(const k in A)if(A[k]&&A[k].length)p.push((ACT_LBL[k]||k)+' '+A[k].length+'× (zuletzt '+A[k][A[k].length-1].split('-').reverse().join('.')+')');return p.join(', ')}
function vals(o,keys){return keys.filter(k=>o[k]!=null).map(k=>RQN[k]+': '+lbl2(k,o[k])).join('<br>')}
function popU(id,ll){const u=STORE.uways[id]&&STORE.uways[id].data;if(!u)return;L.popup().setLatLng(ll).setContent('<b>'+(u.road?'Straße':'Eigener Weg')+(u.typ?' · '+lbl2('typ',u.typ):'')+'</b><br>'+(u.len?(u.len/1000).toFixed(2)+' km · ':'')+'eingetragen '+String(u.created||'').split('-').reverse().join('.')+'<br>'+vals(u,['belag','wind','leute','board'])+autosHtml(u,u.road?estNear(dec(u.p)[Math.floor(dec(u.p).length/2)]):estWay([0,3],tNow()))+(u.notiz?'<br>„'+esc(u.notiz)+'“':'')+'<br><span style="color:#777">'+actLine(u)+'</span><br><button class="pbtn" onclick="openEdit(\'u\',\''+id+'\')">Bewertung ändern</button> <button class="pbtn" onclick="delExtra(\'uways\',\''+id+'\')">Weg löschen</button>').openOn(map)}
function popS(id,ll){const s=STORE.spots[id]&&STORE.spots[id].data;if(!s)return;L.popup().setLatLng(ll).setContent('<b>Spot · '+esc(s.name||'')+'</b><br>'+vals(s,['belag','wind','zugang'])+(s.notiz?'<br>„'+esc(s.notiz)+'“':'')+'<br><span style="color:#777">'+actLine(s)+'</span><br><button class="pbtn" onclick="delExtra(\'spots\',\''+id+'\')">Spot löschen</button>').openOn(map)}
async function delExtra(c,id){map.closePopup();const e=STORE[c][id];if(!e)return;e.data=null;e.t=Date.now();e.dirty=true;await IDB.put(c+'/'+id,e);notify(c);GH.schedule()}

// ---- Reparatur fertig geprüfter Fahrten: geteilte eigene Wege trennen, Wegbewertung vom Abschnitt mit den meisten Punkten ----
let REPBUSY=false;
async function repairRides(){if(REPBUSY||!P.length||REVIEWING)return;REPBUSY=true;try{for(const id of Object.keys(STORE.rides)){const e=STORE.rides[id];const r=e&&e.data;if(!r||!r.rv||!r.rv.fin||(r.rv.rep|0)>=1||!r.p)continue;await repairRide(id,r)}}catch(err){console.error(err)}REPBUSY=false}
async function repairRide(id,r){const rv=JSON.parse(JSON.stringify(r.rv));const A=rideArrays(r);const V=k=>rv.vals&&rv.vals[k]&&Object.keys(rv.vals[k]).length?rv.vals[k]:null;
 const day=r.start?new Date(r.start).toLocaleDateString('sv-SE'):r.date;const ws=s=>{try{return secInfo(r,A,s).windSec}catch(e){return null}};
 for(let k=1;k<rv.sec.length;k++){const s=rv.sec[k];if(s[0]!=='uway'||!s[3])continue;let f=k;while(f>0&&rv.sec[f-1][0]==='uway'&&rv.sec[f-1][3]===s[3]&&rv.sec[f-1][2]<=s[1]+1)f--;if(f===k)continue;
  const src=STORE.uways[s[3]]&&STORE.uways[s[3]].data;if(!src)continue;const nid='u'+id.slice(1)+'_'+s[1];const v=V(k)||{};
  const o={road:!!src.road,typ:v.wo||src.typ||null,created:src.created||today(),from:id,p:encPl(rdp(A.pts.slice(s[1],s[2]+1),3)),len:Math.round(A.d[s[2]]-A.d[s[1]])};
  for(const kk of ['belag','autos','wind','leute','board'])if(v[kk]!=null)o[kk]=v[kk];if(v.wind!=null){const w=ws(s);if(w!=null)o.windDir=w}if(v.note)o.notiz=v.note;
  o.act={[r.act||'board']:[day]};if((r.act||'board')==='board'){o.ridden=true;o.rides=[day]}o.updated=today();
  await DB.collection('uways').doc(nid).set(o);s[3]=nid;
  const fs=rv.sec[f];if(String(fs[3]).endsWith('_'+fs[1])&&src.from===id){const so=Object.assign({},src,{p:encPl(rdp(A.pts.slice(fs[1],fs[2]+1),3)),len:Math.round(A.d[fs[2]]-A.d[fs[1]])});await DB.collection('uways').doc(fs[3]).set(so)}}
 const best=new Map();
 rv.sec.forEach((s,k)=>{if(s[0]!=='way'||!V(k))return;let pk=null;const c=new Map();for(let i=s[1];i<=s[2];i++){const mm=matchPt(A.pts[i],pk);if(mm.t!=='x')pk=mm.k;if(mm.t==='w')c.set(W[P[mm.pi].w][0],(c.get(W[P[mm.pi].w][0])||0)+1)}
  for(const [w,n] of c){const b=best.get(w);if(!b||n>b[1])best.set(w,[k,n])}});
 for(const [w,[k,n]] of best){const rt=RAT['w'+w];if(!rt||!['belag','autos','wind','leute'].some(q=>rt[q]!=null))continue;const used=(rt.rides||[]).includes(day)||Object.values(rt.act||{}).some(a=>a.includes(day));if(!used)continue;
  const v=V(k);const o=Object.assign({},rt);let ch=false;if(v.art&&o.typ!==v.art){o.typ=v.art;ch=true}for(const kk of ['belag','autos','wind','leute']){if(v[kk]!=null&&o[kk]!==v[kk]){o[kk]=v[kk];ch=true}}
  if(v.wind!=null){const w2=ws(rv.sec[k]);if(w2!=null&&o.windDir!==w2){o.windDir=w2;ch=true}}if(ch){o.updated=today();await DB.collection('ratings').doc('w'+w).set(o)}}
 rv.rep=5;await DB.collection('rides').doc(id).set(Object.assign({},r,{rv}))}

// ---- Fog of War aus den echten GPS-Spuren: aufgedeckt wird genau der befahrene Teil ----
let COV=null,COVKEY='';const ABIT={board:1,fuss:2};
function cumOf(p){if(p._cum)return p._cum;const c=[0];for(let i=0;i<p.segs.length;i++)c.push(c[i]+p.segs[i]);return p._cum=c}
function clipPts(p,a,b){const c=cumOf(p),P_=p.pts,out=[];const at=s=>{let i=0;while(i<c.length-2&&c[i+1]<s)i++;const L=c[i+1]-c[i],t=L?Math.min(1,Math.max(0,(s-c[i])/L)):0;return [i,[P_[i][0]+(P_[i+1][0]-P_[i][0])*t,P_[i][1]+(P_[i+1][1]-P_[i][1])*t]]};
 const [ia,pa]=at(a),[ib,pb]=at(b);out.push(pa);for(let i=ia+1;i<=ib;i++)out.push(P_[i]);out.push(pb);return out}
function mergeIv(L){L=L.slice().sort((x,y)=>x[0]-y[0]);const o=[];for(const v of L){const t=o[o.length-1];if(t&&v[0]<=t[1]+1)t[1]=Math.max(t[1],v[1]);else o.push(v.slice())}return o}
function coverage(){const key=Object.keys(STORE.rides).map(id=>{const e=STORE.rides[id];return id+':'+(e&&e.data?(e.data.act||'b')+(e.data.p?e.data.p.length:0):'x')}).join(',')+'|'+Object.keys(STORE.uways).length;if(COV&&COVKEY===key)return COV;COVKEY=key;
 COV={iv:new Map(),foot:[],links:[]};SIDX=null;setTimeout(repairRides,50);const TOL=28,cell=0.0005,KM=111320;const ck=(la,lo)=>Math.floor(la/cell)+','+Math.floor(lo/cell);
 const T=new Map(),RS=[];
 for(const e of Object.values(STORE.rides)){const r=e&&e.data;if(!r||!r.p||(r.act||'board')==='ignore')continue;const bit=ABIT[r.act||'board']||1;const pts=dec(r.p);
  let la0=90,la1=-90,lo0=180,lo1=-180;for(const q of pts){la0=Math.min(la0,q[0]);la1=Math.max(la1,q[0]);lo0=Math.min(lo0,q[1]);lo1=Math.max(lo1,q[1])}const sec=new Int16Array(pts.length).fill(-1);if(r.rv&&r.rv.sec)r.rv.sec.forEach((q,k)=>{for(let i=Math.max(0,q[1]);i<=Math.min(pts.length-1,q[2]);i++)sec[i]=k});
  let T_=null;try{T_=rideArrays(r).T}catch(e){}
  RS.push({pts,bit,date:r.date,id:r.id,rv:r.rv||null,sec,T:T_,wx:r.wx||null,bb:[la0-.01,la1+.01,lo0-.015,lo1+.015]});
  for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i];const k=Math.cos(a[0]*Math.PI/180)*KM;const dx=(b[1]-a[1])*k,dy=(b[0]-a[0])*KM,d=Math.hypot(dx,dy);if(d<0.5)continue;
   const n=Math.ceil(d/6);for(let j=0;j<=n;j++){const q=[a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n,dx/d,dy/d,bit];const kk=ck(q[0],q[1]);let arr=T.get(kk);if(!arr)T.set(kk,arr=[]);arr.push(q)}}}
 if(!RS.length)return COV;
 // Jeder Spurpunkt gehört genau EINEM Weg: dem nächsten, der in Spurrichtung läuft. Straßen und eigene Wege konkurrieren mit,
 // damit nicht der Gehweg auf der anderen Straßenseite oder ein Stich an der Kreuzung mit aufgedeckt wird.
 const SI=buildIdx(),SC=SI.cell,RDS=SI.RDS,UP=SI.U;const H=new Map();const E=new Map();const addE=(q,tag)=>{const kk=ck(q[0],q[1]);let arr=E.get(kk);if(!arr)E.set(kk,arr=[]);arr.push([q[0],q[1],tag])};
 const geo=it=>it[0]===0?P[it[1]].pts:it[0]===1?RDS[it[1]]:UP[it[1]];
 for(const R_ of RS){const pts=R_.pts;let prev=null;
  for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i];const k=Math.cos(a[0]*Math.PI/180)*KM;const dx=(b[1]-a[1])*k,dy=(b[0]-a[0])*KM,d=Math.hypot(dx,dy);if(d<0.5)continue;const ux=dx/d,uy=dy/d;
   const n=Math.max(1,Math.round(d/5));for(let j=0;j<n;j++){const q=[a[0]+(b[0]-a[0])*(j+.5)/n,a[1]+(b[1]-a[1])*(j+.5)/n];
    const best=new Map();const x0=Math.floor((q[0]-.0004)/SC),x1=Math.floor((q[0]+.0004)/SC),y0=Math.floor((q[1]-.0006)/SC),y1=Math.floor((q[1]+.0006)/SC);
    for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(const it of SI.G.get(x+','+y)||[]){const g=geo(it);if(!g)continue;const A=g[it[2]],B=g[it[2]+1];if(!B)continue;
     const sx=(B[1]-A[1])*k,sy=(B[0]-A[0])*KM,sl=Math.hypot(sx,sy);if(sl<0.3)continue;if(Math.abs(ux*sx+uy*sy)/sl<0.55)continue;
     const dd=segDist(q,A,B);if(dd>=TOL)continue;const key=(it[0]===0?'w':it[0]===1?'r':'u')+it[1];const o=best.get(key);if(!o||dd<o[0])best.set(key,[dd,it,A,B,sl])}
    if(!best.size){prev=null;continue}
    let bk=null,bv=null;for(const [key,v] of best)if(!bv||v[0]<bv[0]){bk=key;bv=v}
    if(prev&&best.has(prev)&&best.get(prev)[0]<=bv[0]+8){bk=prev;bv=best.get(prev)}prev=bk;
    if(bk[0]!=='w')continue;const it=bv[1],pi=it[1],A=bv[2],B=bv[3];const px=(q[1]-A[1])*k,py=(q[0]-A[0])*KM;const t=Math.max(0,Math.min(1,(px*(B[1]-A[1])*k+py*(B[0]-A[0])*KM)/(bv[4]*bv[4])));
    const sp=cumOf(P[pi])[it[2]]+t*P[pi].segs[it[2]];let h=H.get(pi);if(!h)H.set(pi,h=[]);h.push([sp,R_.bit])}}}
 for(const [pi,h] of H){const p=P[pi],c=cumOf(p),tot=c[c.length-1],res={L:tot};
  for(const bit of [1,2]){const hs=h.filter(x=>x[1]&bit).map(x=>x[0]).sort((u,v)=>u-v);if(!hs.length)continue;let runs=[],cur=null;
   for(const sp of hs){if(cur&&sp-cur[1]<=40)cur[1]=sp;else{cur=[sp,sp];runs.push(cur)}}
   // erst an der echten Spannweite der Treffer messen (sonst wird aus einem Treffer an der Kreuzung ein ganzer Stich)
   runs=runs.filter(r=>r[1]-r[0]>=20||(tot<45&&r[1]-r[0]>=tot*.6));
   runs=runs.map(r=>[Math.max(0,r[0]-4),Math.min(tot,r[1]+4)]);for(const r of runs){if(r[0]<15)r[0]=0;if(tot-r[1]<15)r[1]=tot}if(runs.length)res[bit]=runs}
  if(!res[1]&&!res[2])continue;COV.iv.set(pi,res);const all=mergeIv([...(res[1]||[]),...(res[2]||[])]);
  for(let i=0;i<p.segs.length;i++){const A=p.pts[i],B=p.pts[i+1],len=p.segs[i];const ns=Math.max(1,Math.ceil(len/6));for(let j=0;j<ns;j++){const t=(j+.5)/ns,sp=c[i]+len*t;if(all.some(r=>sp>=r[0]&&sp<=r[1]))addE([A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t],['w',pi,i])}}}
 for(const [uid,e] of Object.entries(STORE.uways)){const u=e&&e.data;if(!u||!u.p)continue;const pts=dec(u.p);const tag=[u.road?'r':'u',uid];
  for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i];const n=Math.max(1,Math.ceil(dist(a,b)/6));for(let j=0;j<=n;j++)addE([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n],tag)}}
 const tkey=t=>t[0]==='w'?'w'+t[1]:'u'+t[1];const nearSamp=(q,key)=>{const x=Math.floor(q[0]/cell),y=Math.floor(q[1]/cell);let b=null,bd=40;for(let a=-1;a<=1;a++)for(let c=-1;c<=1;c++){const arr=E.get((x+a)+','+(y+c));if(arr)for(const t of arr){if(tkey(t[2])!==key)continue;const d=dist(q,t);if(d<bd){bd=d;b=[t[0],t[1]]}}}return b};
 const hit=q=>{const x=Math.floor(q[0]/cell),y=Math.floor(q[1]/cell);let best=null,bd=22;for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const arr=E.get((x+a)+','+(y+b));if(arr)for(const t of arr){const d=dist(q,t);if(d<bd){bd=d;best=t[2]}}}return best};
 const snapEnds=seg=>{const g=seg.slice();for(const end of [0,1]){const q=end?g[g.length-1]:g[0];const x=Math.floor(q[0]/cell),y=Math.floor(q[1]/cell);let b=null,bd=26;for(let a=-1;a<=1;a++)for(let c=-1;c<=1;c++){const arr=E.get((x+a)+','+(y+c));if(arr)for(const t of arr){const d=dist(q,t);if(d<bd){bd=d;b=[t[0],t[1]]}}}if(b&&bd>1){if(end)g.push(b);else g.unshift(b)}}return g};
 const LK=new Set();
 for(const R_ of RS){const pts=R_.pts;let st=-1,Lun=0,last=null,gap=0,lastQ=null,lastI=0;
  const flush=i=>{if(st>=0&&(i-st>=2||Lun>8)){const a0=Math.max(0,st-1),b0=Math.min(pts.length-1,i);let a=a0;
    // nach Prüf-Abschnitten aufteilen, damit jedes Stück seine Bewertung aus der Prüfung trägt
    while(a<b0){const k=R_.sec[a+1<=b0?a+1:a];let b=a+1;while(b<b0&&R_.sec[b+1]===k)b++;
     let sv=null,inh=false;if(k>=0&&R_.rv){const res=R_.rv.res&&R_.rv.res[k];if(res!=='skip'&&res!=='del'){for(let k2=k;k2>=0;k2--){const v=R_.rv.vals&&R_.rv.vals[k2];if(v&&Object.keys(v).length){sv=v;inh=k2!==k;break}if(k2<k&&R_.rv.sec[k2][2]<R_.rv.sec[k][1]-1)break}}}
     let wd=null;if(R_.T&&R_.wx&&R_.wx.h){const tm=(R_.T[a]+R_.T[b])/2;let bb=null,bd=1e12;for(const x of R_.wx.h){const dd=Math.abs(Date.parse(x[0])/1000-tm);if(dd<bd&&x[3]!=null){bd=dd;bb=x}}if(bb)wd=Math.round(bb[3]/45)%8}
     if(sv)sv=Object.assign({windDir:wd},sv);
     const seg=pts.slice(a,b+1);if(seg.length>1)COV.foot.push({pts:snapEnds(seg),bit:R_.bit,date:R_.date,id:R_.id,sv,sk:k,inh,ts:R_.T?(R_.T[a]+R_.T[b])/2:null});a=b}}
   st=-1;Lun=0};
  for(let i=0;i<pts.length;i++){const h=hit(pts[i]);const step=i?dist(pts[i-1],pts[i]):0;
   if(!h){if(st<0)st=i;else Lun+=step}else flush(i);
   // Verbindungen, die die Spur beweist (Brücke, Lücke im OSM-Netz): Wegstücke gelten als verbunden
   if(h){const hk=tkey(h);if(last&&tkey(last)!==hk&&gap<=60){
     if(h[0]==='w'&&last[0]==='w'){const k1=P[last[1]].base+last[2],k2=P[h[1]].base+h[2];const kk=k1<k2?k1+','+k2:k2+','+k1;if(!LK.has(kk)){LK.add(kk);COV.links.push([k1,k2])}}
     // berühren sich die gezeichneten Teile nicht, Lücke entlang der Spur schließen
     const cb=nearSamp(pts[i],hk),ca=nearSamp(lastQ,tkey(last));if(ca&&cb){const ta=nearSamp(cb,tkey(last));if(!(ta&&dist(ta,cb)<5)&&dist(ca,cb)>3){const ck2=ca[0].toFixed(5)+cb[0].toFixed(5);if(!LK.has(ck2)){LK.add(ck2);COV.foot.push({pts:[ca,...pts.slice(lastI+1,i),cb],bit:R_.bit,date:R_.date,id:R_.id,sv:null,sk:-1,con:true,ka:tkey(last),kb:hk})}}}}
     last=h;lastQ=pts[i];lastI=i;gap=0}
   else gap+=step}
  flush(pts.length)}
 return COV}
const DISP=new Map();let DISPKEY='';
function dispRat(pi,w){const rt=RAT['w'+w[0]];if(rt&&['belag','autos','wind','leute'].some(q=>rt[q]!=null))return rt;
 const C=coverage();if(DISPKEY!==COVKEY){DISP.clear();DISPKEY=COVKEY}if(!C.iv.has(pi))return rt;if(DISP.has(pi))return DISP.get(pi)||rt;
 const p=P[pi],iv=C.iv.get(pi);const L_=mergeIv([...(iv[1]||[]),...(iv[2]||[])]);const g=clipPts(p,L_[0][0],L_[0][1]);const m=g[Math.floor(g.length/2)];let best=null,bd=30;
 for(const e of Object.values(STORE.rides)){const r=e&&e.data;if(!r||!r.p||!r.rv||!r.rv.sec)continue;const pts=dec(r.p);let bi=-1;for(let i=0;i<pts.length;i+=2){const d=dist(m,pts[i]);if(d<bd){bd=d;bi=i}}
  if(bi<0)continue;const k=r.rv.sec.findIndex(s=>bi>=s[1]&&bi<=s[2]);for(let k2=k;k2>=0;k2--){const v=r.rv.vals&&r.rv.vals[k2];if(v&&Object.keys(v).length){best=v;break}}}
 const o=best?Object.assign({},rt||{},{belag:best.belag,autos:best.autos,wind:best.wind,leute:best.leute,virt:true},best.art?{typ:best.art}:{}):null;DISP.set(pi,o);return o||rt}
// true = ganz aufgedeckt, Array = nur diese Abschnitte (Meter entlang des Stücks), null = Nebel
function knownIv(pi,rt){const f=(document.getElementById('seenBy')||{}).value||'alle';
 if(f==='alle'&&rt&&!rt.ridden&&!(rt.act&&Object.keys(rt.act).length))return true;
 const e=coverage().iv.get(pi);if(!e)return null;const L_=f==='alle'?mergeIv([...(e[1]||[]),...(e[2]||[])]):(e[ABIT[f]]||[]);
 if(!L_.length)return null;if(L_.length===1&&L_[0][0]<=0&&L_[0][1]>=e.L-.5)return true;return L_}
function pieceKnown(pi,rt){return !!knownIv(pi,rt)}
function rosaOk(v,q){if(!v||v.wind!=='frei'||+v.belag===5)return false;if(v.autos&&v.autos!=='keine'&&v.autos!=='schild')return false;if(!v.autos&&q&&(v.road||v.wo==='fahrbahn')){const e=estNear(q);if(e&&e.v>0)return false}return wind<0||v.windDir==null||v.windDir===wind}
function artCol(a){return ({radweg:COL[1],gehweg:UCOL.gehweg,feldweg:COL[2],strasse:COL[4],schotter:UCOL.schotter,pfad:UCOL.pfad})[a]||null}
function wcolOf(w,rt){const t=rt&&rt.typ;return (t&&artCol(t))||COL[w[1]]}
function wName(w){const rt=RAT['w'+w[0]];return rt&&rt.typ?lbl2('art',rt.typ)+' <span style="font-weight:normal;color:#777">(von dir)</span>':CNAME[w[1]]}
function elStyle(key){if(!key)return null;if(key[0]==='w'){const p=P[+key.slice(1)];if(!p)return null;const w=W[p.w],rt=RAT['w'+w[0]];const rb=rt&&rt.belag?+rt.belag:0;const sm=rb?BELAG_SM[rb]:w[3];return {col:cmode()==='grade'?'#888':wcolOf(w,rt),wt:(sm==1||sm==2)?5:3.4}}
 const u=STORE.uways[key.slice(1)]&&STORE.uways[key.slice(1)].data;if(!u)return null;const sm=u.belag?BELAG_SM[u.belag]:0;return {col:UCOL[u.typ]||'#1a9e4a',wt:(sm==1||sm==2)?5:3.4}}
function footStyle(o){const v=o.sv;if(o.con){const a=elStyle(o.ka),b=elStyle(o.kb);const x=a&&b?(a.wt>=b.wt?a:b):(a||b);return x||{col:'#8d9188',wt:3.4}}
 if(v){const typ=v.wo||v.typ||'begleit';const sm=v.belag?BELAG_SM[v.belag]:0;return {col:(v.art&&artCol(v.art))||UCOL[typ]||'#1f6fd1',wt:(sm==1||sm==2)?5:3.4,op:(+v.belag===5?.35:1)}}return {col:'#8d9188',wt:3.4}}
function drawFoot(R,fog){const f=(document.getElementById('seenBy')||{}).value||'alle';const dim=(RD?.2:REVIEWING?.5:1);const C=coverage();
 for(const o of C.foot){if(f!=='alle'&&!(o.bit&ABIT[f]))continue;const st=footStyle(o);
  L.polyline(o.pts,{renderer:R,color:'#1d1f1a',weight:9,opacity:.85*dim,interactive:false}).addTo(reveal);
  L.polyline(o.pts,{renderer:R,color:st.col,weight:st.wt,opacity:dim*(st.op||1),interactive:false}).addTo(layer);
  if(!o.con&&rosaOk(o.sv,o.pts[Math.floor(o.pts.length/2)]))L.polyline(o.pts,{renderer:R,color:'#ff3fd2',weight:11,opacity:.33*dim,interactive:false}).addTo(halo)}}
function popFoot(o,ll){if(o.con){const k=o.ka&&o.ka[0]==='w'?o.ka:o.kb&&o.kb[0]==='w'?o.kb:null;if(k)return pop(P[+k.slice(1)],ll);const u=(o.ka||o.kb||'').slice(1);if(STORE.uways[u])return popU(u,ll);return}
 const v=o.sv,dt=String(o.date||'').split('-').reverse().join('.');
 if(v)L.popup().setLatLng(ll).setContent('<b>'+(v.art?lbl2('art',v.art):v.wo?lbl2('wo',v.wo):'Gefahren')+'</b> <span style="color:#777">· '+dt+'</span><br>'+vals(v,['belag','wind','leute','board'])+autosHtml({autos:v.autos==='schild'?'schild':undefined,obs:v.autos&&v.autos!=='schild'&&o.ts?[[o.ts,v.autos]]:[]},estNear(o.pts[Math.floor(o.pts.length/2)]))+(v.note||v.notiz?'<br>„'+esc(v.note||v.notiz)+'“':'')+'<br><span style="color:#777">'+(o.inh?'Ohne eigene Werte bestätigt, Werte vom Abschnitt davor. ':'Bewertet in der Prüfung der Fahrt. ')+'In OSM liegt hier kein eigener Weg.</span><br><button class="pbtn" onclick="openEdit(\'f\',\''+o.id+'\','+o.sk+')">Bewertung ändern</button> <button class="pbtn" onclick="location.hash=\'#pruefen/'+o.id+'\'">Fahrt prüfen</button>').openOn(map);
 else L.popup().setLatLng(ll).setContent('<b>Gefahren am '+dt+'</b><br>Hier liegt kein Weg aus der Karte unter deiner Spur und es gibt noch keine Bewertung.<br><br><button class="pbtn" onclick="openEdit(\'f\',\''+o.id+'\','+o.sk+')">Bewerten</button>').openOn(map)}
// ---- Antippen: eine zentrale Erkennung statt Klicks auf einzelnen Zeichenflächen ----
let LASTPOP=0,LASTCLOSE=0,TAPHOOK=false;const UPTS=new WeakMap();
function hookTap(){if(TAPHOOK)return;TAPHOOK=true;map.on('popupopen',()=>{LASTPOP=Date.now()});map.on('popupclose',()=>{LASTCLOSE=Date.now()});
 map.on('click',ev=>{const t0=Date.now();if(t0-LASTCLOSE<400)return;// Tippen zum Schließen eines Infofelds öffnet nichts Neues
  setTimeout(()=>{if(SPLIT||REVIEWING||LASTPOP>=t0)return;tapAt(ev.latlng)},0)})}
function tapAt(ll){const q=[ll.lat,ll.lng];const mpp=40075016*Math.cos(q[0]*Math.PI/180)/Math.pow(2,map.getZoom()+8);const tol=Math.max(5,18*mpp);let bd=tol,act=null;
 const segs=(pts,fn)=>{for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i];if(Math.abs(a[0]-q[0])>.02&&Math.abs(b[0]-q[0])>.02)continue;const d=segDist(q,a,b);if(d<bd){bd=d;act=fn}}};
 for(const [id,e] of Object.entries(STORE.uways)){const u=e&&e.data;if(!u||!u.p)continue;let pts=UPTS.get(u);if(!pts){pts=dec(u.p);UPTS.set(u,pts)}segs(pts,()=>popU(id,ll))}
 const f=(document.getElementById('seenBy')||{}).value||'alle';for(const o of coverage().foot){if(f!=='alle'&&!(o.bit&ABIT[f]))continue;segs(o.pts,()=>popFoot(o,ll))}
 const S=buildIdx();const x=Math.floor(q[0]/S.cell),y=Math.floor(q[1]/S.cell);const rr=Math.ceil(tol/200)+1;
 for(let a=-rr;a<=rr;a++)for(let b=-rr;b<=rr;b++)for(const it of S.G.get((x+a)+','+(y+b))||[]){if(it[0]!==0)continue;const p=P[it[1]];if(!rideable(p))continue;const d=segDist(q,p.pts[it[2]],p.pts[it[2]+1]);if(d<bd*0.9){bd=d;act=()=>pop(p,ll)}}
 if(!act)for(const [id,e] of Object.entries(STORE.spots)){const sp=e&&e.data;if(!sp||!sp.poly)continue;const g=dec(sp.poly);let ins=false;for(let i=0,j=g.length-1;i<g.length;j=i++){if(((g[i][0]>q[0])!==(g[j][0]>q[0]))&&(q[1]<(g[j][1]-g[i][1])*(q[0]-g[i][0])/(g[j][0]-g[i][0])+g[i][1]))ins=!ins}if(ins){act=()=>popS(id,ll);break}}
 if(act)return act();if(map.getZoom()<12)return;
 // Straßen mit Autoverkehr
 const CN=D.ctx.conn||[],RO=D.ctx.roads||[];let rb=-1,rd=tol;for(let a=-rr;a<=rr;a++)for(let b=-rr;b<=rr;b++)for(const it of S.G.get((x+a)+','+(y+b))||[]){if(it[0]!==1)continue;const g=S.RDS[it[1]];const d=segDist(q,g[it[2]],g[it[2]+1]);if(d<rd){rd=d;rb=it[1]}}
 if(rb>=CN.length){const k=(RO[rb-CN.length]||[3])[0];L.popup().setLatLng(ll).setContent('<b>'+RKIND[k][0]+'</b>'+autosHtml(null,estRoad(k,tNow()))).openOn(map);return}
 if(rb>=0){const r=CN[rb];L.popup().setLatLng(ll).setContent('<b>'+(RKIND[r[3]||'r']||RKIND.r)[0]+(r[2]?' – '+esc(r[2]):'')+'</b>'+autosHtml(null,estRoad(r[3]||'r',tNow()))+'<br>Laut OSM für Autos freigegeben. Wird deshalb nicht als Wingstrecke gezählt.<br><a href="https://www.openstreetmap.org/way/'+r[0]+'" target="_blank" rel="noopener">In OSM ansehen</a>').openOn(map)}}

// ---- Bewertung direkt im Infofeld ändern: OSM-Weg ('w'), eigener Weg ('u'), Spurstück einer Fahrt ('f') ----
let EDIT=null;
function openEdit(kind,id,k){map.closePopup();let o={},title='',keys=['art','belag','autos','wind','leute','board'];
 if(kind==='w'){const r=RAT['w'+id]||{};o=Object.assign({},r);if(r.typ)o.art=r.typ;title='Weg bewerten'}
 else if(kind==='u'){const u=STORE.uways[id]&&STORE.uways[id].data;if(!u)return;o=Object.assign({},u);keys=[u.road?'wo':'typ','belag','autos','wind','leute','board'];if(u.road)o.wo=u.typ;title=u.road?'Straße (eigener Eintrag)':'Eigener Weg'}
 else{const e=STORE.rides[id];const r=e&&e.data;if(!r||!r.rv)return;let v=r.rv.vals&&r.rv.vals[k];if(!v||!Object.keys(v).length){for(let k2=k-1;k2>=0;k2--){const w=r.rv.vals&&r.rv.vals[k2];if(w&&Object.keys(w).length){v=w;break}}}o=Object.assign({},v||{});if(o.note)o.notiz=o.note;title='Stück vom '+String(r.date||'').split('-').reverse().join('.')}
 EDIT={kind,id,k,o,keys};const sh=document.getElementById('sheet');
 let h='<h2>'+esc(title)+'</h2><div class="small">Alles optional. Nochmal tippen hebt eine Auswahl auf.</div>';
 for(const q of keys){const opts=(q==='belag'?OPT.belag:null)||ROPT[q]||OPT[q]||[];h+='<div class="q">'+(RQN[q]||q)+(q==='wind'&&wind>=0?' <span class="small">(bei Wind aus '+DIRS[wind]+')</span>':'')+'</div><div class="chips" data-k="'+q+'">';
  for(const [v,t] of opts)h+='<button data-v="'+v+'" class="'+(o[q]!=null&&String(o[q])===String(v)?'on':'')+'">'+t+'</button>';h+='</div>'}
 h+='<div class="q">Notiz</div><textarea id="enotiz" maxlength="500">'+esc(o.notiz||'')+'</textarea><div class="small" id="emsg"></div>';
 h+='<div class="acts"><button class="btns" id="ecancel">Abbrechen</button><button class="btnp" id="esave">Speichern</button></div>';
 sh.innerHTML=h;sh.style.display='block';
 sh.querySelectorAll('.chips').forEach(c=>c.querySelectorAll('button').forEach(b=>b.onclick=()=>{const q=c.dataset.k;const was=b.classList.contains('on');c.querySelectorAll('button').forEach(x=>x.classList.remove('on'));
  if(was)delete EDIT.o[q];else{b.classList.add('on');const raw=b.dataset.v;EDIT.o[q]=/^\d+$/.test(raw)?+raw:raw}}));
 document.getElementById('ecancel').onclick=()=>{sh.style.display='none'};document.getElementById('esave').onclick=saveEdit}
async function saveEdit(){const E_=EDIT;if(!E_)return;const o=E_.o;const nt=document.getElementById('enotiz').value.trim();const btn=document.getElementById('esave');btn.disabled=true;btn.textContent='Speichere …';
 try{const F=['belag','autos','wind','leute','board'];
  if(E_.kind==='w'){const r=Object.assign({},RAT['w'+E_.id]||{});for(const q of F){if(o[q]!=null)r[q]=o[q];else delete r[q]}if(o.art)r.typ=o.art;else delete r.typ;
   if(r.wind){if(wind>=0)r.windDir=wind}else delete r.windDir;if(nt)r.notiz=nt;else delete r.notiz;r.way=+E_.id;r.updated=today();await DB.collection('ratings').doc('w'+E_.id).set(r)}
  else if(E_.kind==='u'){const u=Object.assign({},STORE.uways[E_.id].data);for(const q of F){if(o[q]!=null)u[q]=o[q];else delete u[q]}const tk=E_.keys[0];if(o[tk]!=null)u.typ=o[tk];
   if(u.wind&&wind>=0)u.windDir=wind;if(nt)u.notiz=nt;else delete u.notiz;u.updated=today();await DB.collection('uways').doc(E_.id).set(u)}
  else{const r=JSON.parse(JSON.stringify(STORE.rides[E_.id].data));const v={};for(const q of ['art',...F])if(o[q]!=null)v[q]=o[q];if(nt)v.note=nt;r.rv.vals=r.rv.vals||{};r.rv.vals[E_.k]=v;r.rv.res=r.rv.res||{};if(!r.rv.res[E_.k])r.rv.res[E_.k]='ok';await DB.collection('rides').doc(E_.id).set(r)}
  document.getElementById('sheet').style.display='none';COV=null;COVKEY='';redrawSoon()}
 catch(e){btn.disabled=false;btn.textContent='Speichern';document.getElementById('emsg').textContent='Speichern fehlgeschlagen. Bitte nochmal versuchen.'}}

// ---- Autos: Schätzung aus Straßenart, Uhrzeit und Jahreszeit; deine Beobachtungen haben Vorrang ----
const AUTO_LV=['kaum','wenige','mittel','viele'];const ALV={keine:0,wenige:1,vereinzelt:1,mittel:2,viele:3,oft:3};
let TSEL=null;
function tNow(){if(TSEL)return Object.assign({m:new Date().getMonth()+1},TSEL);const d=new Date(),g=d.getDay();return {wd:g>=1&&g<=5,h:d.getHours()+d.getMinutes()/60,m:d.getMonth()+1}}
function tFac(t){const h=t.h;if(t.wd){if(h<5.5||h>=22)return .12;if(h<6.5)return .6;if(h<9)return 1.5;if(h<16)return 1;if(h<19)return 1.5;return .6}if(h<8||h>=22)return .15;if(h<10)return .5;if(h<19)return .8;return .5}
function tLabel(t){return (t.wd?'werktags ':'am Wochenende ')+Math.floor(t.h)+' Uhr'}
function lvlOf(x){return x<.4?0:x<1.1?1:x<2.4?2:3}
const RKIND={1:['Hauptstraße',4],2:['Landesstraße',3.5],3:['Kreisstraße',3],u:['Verbindungsstraße',2],r:['Wohnstraße',1.0],l:['verkehrsberuhigt',.6]};
function estRoad(kind,t){const k=RKIND[kind]||RKIND.r;return {v:lvlOf(k[1]*tFac(t)),why:k[0]}}
let WIDX=null,WPC=null;const THR=new Map();
function wayOf(id){if(!WIDX){WIDX=new Map();WPC=new Map();P.forEach((p,pi)=>{const w=W[p.w];WIDX.set(w[0],w);let a=WPC.get(w[0]);if(!a)WPC.set(w[0],a=[]);a.push(pi)})}return WIDX.get(+id)}
function nearRoadKind(q,tol){const S=buildIdx(),CN=D.ctx.conn||[],RO=D.ctx.roads||[];const x=Math.floor(q[0]/S.cell),y=Math.floor(q[1]/S.cell);let best=null,bd=tol||20;
 for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(const it of S.G.get((x+a)+','+(y+b))||[]){if(it[0]!==1)continue;const g=S.RDS[it[1]];const d=segDist(q,g[it[2]],g[it[2]+1]);if(d<bd){bd=d;best=it[1]<CN.length?(CN[it[1]][3]||'r'):(RO[it[1]-CN.length]||[3])[0]}}return best}
function wayThrough(id){if(THR.has(id))return THR.get(id);wayOf(id);const pcs=WPC.get(+id)||[];const cnt=new Map();const key=q=>q[0].toFixed(5)+','+q[1].toFixed(5);
 for(const pi of pcs){const g=P[pi].pts;for(const q of [g[0],g[g.length-1]]){const k=key(q);cnt.set(k,(cnt.get(k)||[0,q]));cnt.get(k)[0]++}}
 const ends=[...cnt.values()].filter(e=>e[0]===1).map(e=>e[1]);let r=false;if(ends.length>=2){const nr=ends.filter(q=>nearRoadKind(q,25));if(nr.length>=2&&dist(nr[0],nr[nr.length-1])>150)r=true}THR.set(id,r);return r}
function estWay(w,t){const c=w[1];if(c===1)return {v:0,why:'Rad-/Gehweg'};const thr=wayThrough(w[0]);let B={2:.12,3:.2,4:.45}[c]||.2;if(thr)B*=2.2;let x=B*tFac(t);
 if(t.wd&&t.h>=7&&t.h<19){const se=[0,.5,.5,1,1.2,1.2,1,1.2,1.5,1.5,1.3,.6,.5][t.m||1];x+=.25*se}
 return {v:lvlOf(x),why:(c===2?'Feldweg, nur Landwirtschaft':c===4?'Feldweg, für Autos frei':'Feldweg')+(thr?', Abkürzung zwischen Straßen':'')+(t.wd&&t.h>=7&&t.h<19&&[7,8,9,10].includes(t.m)?', Erntezeit':'')}}
function estNear(q){const k=nearRoadKind(q,25);if(k)return estRoad(k,tNow());return null}
function obsTxt(v){return v==='oft'?'viele':v==='vereinzelt'?'wenige':v}
function autosNow(o,est,t){if(o&&o.autos==='schild')return {lv:0,txt:'Kfz-Verbot (Schild)',src:'du'};const obs=(o&&o.obs)||[];let best=null,bd=99;
 for(const ob of obs){const d=new Date(ob[0]*1000),g=d.getDay();if((g>=1&&g<=5)!==t.wd)continue;const dh=Math.abs(d.getHours()+d.getMinutes()/60-t.h);if(dh<=2.5&&dh<bd){bd=dh;best=ob}}
 if(best&&ALV[best[1]]!=null)return {lv:ALV[best[1]],src:'beob'};
 if(o&&o.autos&&ALV[o.autos]!=null&&!obs.length)return {lv:ALV[o.autos],src:'du'};
 return est?{lv:est.v,src:'est',why:est.why}:null}
function fmtTs(ts){const d=new Date(ts*1000);return ['So','Mo','Di','Mi','Do','Fr','Sa'][d.getDay()]+' '+d.getHours()+':'+String(d.getMinutes()).padStart(2,'0')}
function autosHtml(o,est){const t=tNow();const a=autosNow(o,est,t);if(!a)return '';
 let h='<br>Autos '+(TSEL?tLabel(t):'jetzt')+': <b>'+(a.txt||AUTO_LV[a.lv])+'</b> <span style="color:#777">('+(a.src==='est'?'geschätzt: '+esc(a.why):a.src==='beob'?'deine Beobachtung zu dieser Zeit':'deine Angabe')+')</span>';
 const obs=(o&&o.obs)||[];if(obs.length)h+='<br><span style="color:#777">Gesehen: '+obs.slice(-5).map(ob=>fmtTs(ob[0])+' '+obsTxt(ob[1])).join(' · ')+'</span>';return h}
function autosWay(id){const w=wayOf(id);if(!w)return '';return autosHtml(RAT['w'+id]||{},estWay(w,tNow()))}
function rtHtml(id){return rtHtml0(id)+autosWay(id)}
function obsPush(o,ts,val,rid){if(!ts||!val||val==='schild')return o;o.obs=(o.obs||[]).filter(x=>x[2]!==rid).concat([[Math.round(ts),val,rid]]).slice(-20);return o}
// Zeit-Auswahl im Filter
function hookTimeSel(){const fg=document.getElementById('fog');if(!fg||document.getElementById('tsel'))return;const lab=fg.closest('label');const d=document.createElement('div');d.style.margin='6px 0';
 d.innerHTML='<label>Autos-Schätzung für <select id="tsel"><option value="">jetzt</option><option value="1,7.5">werktags 7–9 Uhr</option><option value="1,12">werktags mittags</option><option value="1,17.5">werktags 17–19 Uhr</option><option value="1,21">abends</option><option value="0,14">Wochenende tagsüber</option></select></label>';
 lab.parentNode.insertBefore(d,lab.nextSibling);document.getElementById('tsel').onchange=e=>{const v=e.target.value;TSEL=v?{wd:v[0]==='1',h:+v.split(',')[1]}:null;map.closePopup();redrawSoon()}}
