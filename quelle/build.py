import re, shutil, os
SRC = '/home/claude/map/index.html'
OUT = '/home/claude/longboard-karte'
h = open(SRC, encoding='utf-8').read()

def rep(old, new, count=1):
    global h
    assert old in h, 'missing: ' + old[:80]
    h = h.replace(old, new, count)

# --- Kopf: Titel, PWA, lokales Leaflet ---
rep('<title>Parawing-Wege Ostalb &amp; Ries</title>',
    '<title>Longboard-Karte</title>\n<link rel="manifest" href="manifest.webmanifest">\n'
    '<meta name="theme-color" content="#1f6fd1">\n<link rel="icon" href="icon-192.png">\n'
    '<link rel="apple-touch-icon" href="icon-192.png">\n<meta name="apple-mobile-web-app-capable" content="yes">')
rep('<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js">', '<script src="leaflet.js">')
rep('<h1>Parawing-Wege Ostalb &amp; Ries</h1>',
    '<h1>Longboard-Karte · Ostalb &amp; Ries</h1>\n<div id="wnow" class="wnow"></div>')

# --- zusätzliches CSS ---
rep('</style></head>', '''
.wnow{background:#eef5ff;border-radius:8px;padding:6px 8px;margin:6px 0;font-size:13px}
.wnow .fc span{white-space:nowrap;margin-right:6px}
.locbtn{width:34px;height:34px;background:#fff;font-size:20px;line-height:30px;cursor:pointer;border:2px solid rgba(0,0,0,.2);border-radius:4px;padding:0;color:#333}
.locbtn.on{color:#fff;background:#2a7de1}
.dlg{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:3000;display:none;align-items:center;justify-content:center}
.dlgin{background:#fff;border-radius:10px;padding:14px;width:min(420px,92vw);max-height:90vh;overflow:auto;font-size:14px}
.dlgin label{display:block;margin-top:10px}.dlgin input{width:100%;box-sizing:border-box;padding:6px;font-size:14px;margin-top:3px}
.leaflet-top.leaflet-right{top:52px}
.lctl{position:relative;z-index:850!important}.lbtn{width:38px;height:38px;display:flex;align-items:center;justify-content:center;background:#fff;color:#333;cursor:pointer;border:2px solid rgba(0,0,0,.2);border-radius:6px;padding:0}
.lbtn.on{background:#1f6fd1!important;color:#fff!important}
.lpop{position:absolute;right:46px;top:0;background:rgba(255,255,255,.98);border-radius:14px;box-shadow:0 4px 18px rgba(0,0,0,.25);padding:8px;display:grid;grid-template-columns:repeat(2,72px);gap:8px}
.lopt{border:0;background:none;padding:4px;border-radius:10px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;font:600 12px system-ui,sans-serif;color:#1d1f1a}
.lopt svg{width:56px;height:56px;border-radius:9px;box-shadow:0 0 0 1px rgba(0,0,0,.12)}.lopt.on svg{box-shadow:0 0 0 3px #1f6fd1}.lopt.on{color:#1f6fd1}
.dlgin .hint{font-size:12px;color:#666;margin-top:2px}
</style></head>''')

# --- Import-Zeile: Drive raus, intervals.icu + Einstellungen rein ---
rep('<button id="drivebtn" class="pbtn" style="display:none" onclick="pullDrive()">Neue Fahrten aus Drive holen</button>',
    '<button id="icubtn" class="pbtn">Neue Fahrten holen</button><button id="setbtn" class="pbtn">⚙ Einstellungen</button>')
rep('<div class="row small" id="dbstat">Bewertungen: verbinde …</div>',
    '<div class="row small" id="dbstat">Lade gespeicherte Daten …</div>\n<div class="row small"><span id="ghstat" style="color:#666"></span> <button id="syncbtn" class="pbtn" style="padding:1px 6px">↻</button></div>')

# --- Einstellungsdialog ---
rep('</script></body></html>', '''</script>
<div id="setdlg" class="dlg"><div class="dlgin">
<b>Einstellungen</b>
<div class="hint">Alles hier bleibt nur auf diesem Gerät im Browser gespeichert. Auf jedem Gerät einmal eintragen.</div>
<label>intervals.icu Athleten-ID<input id="s_icuId" placeholder="i123456" autocomplete="off"></label>
<div class="hint">intervals.icu → Settings → Developer Settings (steht oben, beginnt mit „i“).</div>
<label>intervals.icu API-Schlüssel<input id="s_icuKey" type="password" autocomplete="off"></label>
<div class="hint">Gleiche Seite, „API Key“. Damit holt die Karte deine Fahrten automatisch.</div>
<label>GitHub-Token für Longboard-Daten<input id="s_gh" type="password" autocomplete="off"></label>
<div class="hint">Fine-grained Token, nur Repo „Longboard-Daten“, Recht „Contents: Read and write“. Damit sind Handy und Rechner synchron. Ohne Token bleibt alles nur auf diesem Gerät.</div>
<div class="row" style="margin-top:12px"><button class="pbtn" id="s_save">Speichern</button><button class="pbtn" id="s_close">Schließen</button></div>
<div id="s_msg" class="small" style="color:#b3261e"></div>
</div></div>
</body></html>''')

# --- Füllflächen in eigene Ebene (für Satellit ausblendbar) ---
rep("const R=L.canvas({padding:.5,tolerance:8}), ctx=L.layerGroup().addTo(map);",
    "const R=L.canvas({padding:.5,tolerance:8}), ctx=L.layerGroup().addTo(map);map.createPane('fillPane').style.zIndex=250;const RF=L.canvas({pane:'fillPane',padding:.5});ctxFill=L.layerGroup().addTo(map);window.CTXL=ctx;")
for key in ['D.ctx.forest', 'D.ctx.built', 'D.ctx.water||[]', 'D.ctx.streams||[]', 'D.ctx.rivers||[]']:
    m = re.search(r' for\(const [pr] of ' + re.escape(key) + r'\)[^\n]*', h)
    assert m, key
    line = m.group(0)
    new = line.replace('{renderer:R,', '{renderer:RF,').replace('.addTo(ctx)', '.addTo(ctxFill)')
    h = h.replace(line, new, 1)

# --- Datenbank-Anbindung ersetzen ---
m = re.search(r"\(async\(\)=>\{try\{const db=await window\.claude\.use\('db'\);.*?\n.*?\n.*?\n.*?\n catch\(e\)\{document\.getElementById\('dbstat'\)\.textContent='Bewertungen nicht verfügbar\.'\}\}\)\(\);", h, re.S)
assert m, 'db block'
app = open('/home/claude/build/app.js', encoding='utf-8').read() + '\n' + open('/home/claude/build/review.js', encoding='utf-8').read()
h = h.replace(m.group(0), "let ctxFill=null;\n" + app +
  "\nDB.collection('ratings').onSnapshot(snap=>{const o={};for(const d of snap.docs)o[d.id]=d.data();RAT=o;updDbStat();redrawSoon()});", 1)

rep("(async()=>{try{const m=await window.claude.use('mcp');if(m){MCP=m;document.getElementById('drivebtn').style.display='inline-block'}}catch(e){}})();", '')
rep("fetch('data.json').then(r=>r.json()).then(j=>{D=j;setTimeout(init,10)})",
    "fetch('data.json').then(r=>r.json()).then(j=>{D=j;setTimeout(()=>{init();appStart()},10)})")

# --- Wetteranzeige: Uhrzeit lokal, ohne Station-km falls Modell, Böen optional ---
rep("'<b>Wind</b> ('+r.wx.station+', '+r.wx.km+' km entfernt): '",
    "'<b>Wind</b> ('+r.wx.station+(r.wx.km!=null?', '+r.wx.km+' km entfernt':'')+(r.wx.src?' · '+r.wx.src:'')+'): '")
rep("map(x=>x[0].slice(11,16)+' <b>'+Math.round(x[1])+' kt</b> (Böen '+Math.round(x[2])+') aus '",
    "map(x=>new Date(Date.parse(x[0])).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})+' <b>'+Math.round(x[1])+' kt</b>'+(x[2]!=null?' (Böen '+Math.round(x[2])+')':'')+' aus '")
rep("Noch keine Wetterdaten zu dieser Fahrt – frag Claude im Chat danach.</span>';",
    "Wetterdaten werden geladen …</span>';if(!r.wx)WX.forRide(r.id).then(ok=>{if(ok&&curRide===r.id)showRide(r.id)});")

os.makedirs(OUT, exist_ok=True)
open(OUT + '/index.html', 'w', encoding='utf-8').write(h)
shutil.copy('/home/claude/map/data.json', OUT + '/data.json')
shutil.copy('/home/claude/map/package/dist/leaflet.js', OUT + '/leaflet.js')
if os.path.exists(OUT + '/images'): shutil.rmtree(OUT + '/images')
shutil.copytree('/home/claude/map/package/dist/images', OUT + '/images')
print('ok', len(h))

# ===== Kalender für Fahrten =====
h = open(OUT + '/index.html', encoding='utf-8').read()
m = re.search(r"function renderRides\(\)\{.*?el\.querySelectorAll\('\.ride'\)\.forEach\(d=>d\.onclick=\(\)=>showRide\(d\.dataset\.id\)\)\}", h, re.S)
assert m, 'renderRides'
CAL_JS = r'''let CAL=null,CALDAY=null;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const rDay=r=>r.start?new Date(r.start).toLocaleDateString('sv-SE'):r.date;
function rWind(r){if(!r.wx||!r.wx.h||!r.start)return '';const t=Date.parse(r.start)/1000+(r.elapsed||r.dur||0)/2;let b=null,bd=1e12;
 for(const x of r.wx.h){const d=Math.abs(Date.parse(x[0])/1000-t);if(d<bd&&x[1]!=null){bd=d;b=x}}return b?Math.round(b[1])+' kt '+DIR16(b[3]):''}
function renderRides(){const el=document.getElementById('rides');if(!el)return;
 const list=RIDES.filter(r=>r.p&&r.date);
 if(!list.length){el.innerHTML='<span style="color:#777">Noch keine Fahrten. Neue Fahrten kommen automatisch aus intervals.icu.</span>';return}
 if(!CAL){const d=rDay(list[0]);CAL={y:+d.slice(0,4),m:+d.slice(5,7)-1}}
 const y=CAL.y,mo=CAL.m,mk=y+'-'+String(mo+1).padStart(2,'0');
 const byDay={};for(const r of list){const d=rDay(r);(byDay[d]||(byDay[d]=[])).push(r)}
 const inM=list.filter(r=>rDay(r).startsWith(mk)).sort((a,b)=>(a.start||a.date)<(b.start||b.date)?1:-1);
 const km=inM.reduce((a,r)=>a+(r.km||0),0),dur=inM.reduce((a,r)=>a+(r.dur||0),0);
 const first=new Date(y,mo,1),off=(first.getDay()+6)%7,nd=new Date(y,mo+1,0).getDate(),today=new Date().toLocaleDateString('sv-SE');
 let g='<div class="cal"><div class="calh"><button class="calnav" data-d="-1" aria-label="Vormonat">‹</button><b>'+first.toLocaleDateString('de-DE',{month:'long',year:'numeric'})+'</b><button class="calnav" data-d="1" aria-label="Nächster Monat">›</button></div>'
  +'<div class="calg">'+['Mo','Di','Mi','Do','Fr','Sa','So'].map(x=>'<div class="cwd">'+x+'</div>').join('');
 for(let i=0;i<off;i++)g+='<div></div>';
 for(let d=1;d<=nd;d++){const ds=mk+'-'+String(d).padStart(2,'0');const rs=byDay[ds]||[];const k=rs.reduce((a,r)=>a+(r.km||0),0);
  const sz=rs.length?Math.round(Math.min(32,18+k*0.7)):0;
  g+='<div class="cd'+(rs.length?' has':'')+(ds===today?' today':'')+(CALDAY===ds?' sel':'')+(rs.some(r=>r.id===curRide)?' on':'')+'" data-day="'+ds+'"'+(rs.length?' title="'+rs.length+' Fahrt(en), '+k.toFixed(1)+' km"':'')+'>'
   +(rs.length?'<span class="dot" style="width:'+sz+'px;height:'+sz+'px"></span>':'')+'<span class="dn">'+d+'</span>'+(rs.length>1?'<span class="dc">'+rs.length+'</span>':'')+(rs.some(needsReview)?'<span class="todo"></span>':'')+'</div>'}
 g+='</div><div class="small calsum">'+(inM.length?'<b>'+inM.length+' Fahrt'+(inM.length>1?'en':'')+'</b> · '+km.toFixed(1)+' km · '+fmtDur(dur):'Keine Fahrten in diesem Monat')+'</div></div>';
 const shown=CALDAY?(byDay[CALDAY]||[]):inM;
 g+=shown.map(r=>{const w=rWind(r);const st=r.start?new Date(r.start):new Date(r.date);
  return '<div class="ride'+(curRide===r.id?' on':'')+'" data-id="'+r.id+'"><b>'+st.toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'})+(r.start?', '+st.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}):'')+'</b>'+(needsReview(r)?' <span class="tbadge">prüfen</span>':'')+(r.act==='fuss'?' <span class="abadge">zu Fuß</span>':'')+' · '+r.km.toFixed(1)+' km · '+fmtDur(r.dur)+(r.avg?' · Ø '+r.avg+' km/h':'')
   +'<div class="rn">'+(r.name?esc(r.name):'')+(w?(r.name?' · ':'')+'Wind '+w:'')+'</div></div>'}).join('')
  +(CALDAY?'<div class="ride lnk" data-all="1">Alle Fahrten im Monat zeigen</div>':'')+(curRide?'<div class="ride lnk" data-id="">✕ Fahrt ausblenden</div>':'');
 el.innerHTML=g;
 const open=id=>{showRide(id);if(id&&window.innerWidth<600)document.getElementById('panel').classList.add('hide')};
 el.querySelectorAll('.calnav').forEach(b=>b.onclick=()=>{let mm=CAL.m+(+b.dataset.d),yy=CAL.y;if(mm<0){mm=11;yy--}if(mm>11){mm=0;yy++}CAL={y:yy,m:mm};CALDAY=null;renderRides()});
 el.querySelectorAll('.cd.has').forEach(c=>c.onclick=()=>{const rs=byDay[c.dataset.day];if(rs.length===1){CALDAY=null;open(rs[0].id)}else{CALDAY=CALDAY===c.dataset.day?null:c.dataset.day;renderRides()}});
 el.querySelectorAll('.ride').forEach(d=>d.onclick=()=>{if(d.dataset.all){CALDAY=null;renderRides()}else open(d.dataset.id)})}'''
h = h.replace(m.group(0), CAL_JS, 1)

# Fahrten-Block nach oben (direkt unter "Wind jetzt")
m2 = re.search(r'<div class="row"><button id="icubtn".*?<div id="rides" class="small"></div>', h, re.S)
assert m2, 'rides block'
blk = m2.group(0)
h = h.replace(blk, '', 1)
blk = blk.replace('<div class="q" style="margin-top:8px"><b>Deine Fahrten</b></div>', '')
h = h.replace('<div id="wnow" class="wnow"></div>',
  '<div id="wnow" class="wnow"></div>\n<div class="q" style="margin-top:6px"><b>Deine Fahrten</b></div><div id="rides" class="small"></div>\n'
  + blk.replace('<div id="rides" class="small"></div>', '') + '\n<hr style="border:none;border-top:1px solid #e3e3e3;margin:8px 0">', 1)

h = h.replace('</style></head>', '''
.cal{margin:4px 0 6px}.calh{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;font-size:14px}
.calnav{border:none;background:#f0f1ec;border-radius:6px;width:36px;height:30px;font-size:18px;cursor:pointer}
.calg{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}.cwd{text-align:center;font-size:11px;color:#888;padding-bottom:2px}
.cd{position:relative;height:38px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:12px;color:#666}
.cd.has{cursor:pointer;color:#fff;font-weight:700}.cd .dot{position:absolute;border-radius:50%;background:#1f6fd1}
.cd .dn{position:relative}.cd .dc{position:absolute;top:1px;right:2px;font-size:9px;background:#ff3fd2;color:#fff;border-radius:6px;padding:0 3px}
.cd.today{box-shadow:inset 0 0 0 1.5px #1d1f1a}.cd.sel{background:#e7eefb}.cd.on .dot{background:#1d1f1a}
.calsum{margin-top:4px;color:#555}.ride .rn{font-size:11px;color:#777}.ride.on .rn{color:#ccc}
.ride.lnk{background:none;color:#1f6fd1;text-decoration:underline}
</style></head>''', 1)
open(OUT + '/index.html', 'w', encoding='utf-8').write(h)
print('calendar ok')

# ===== Legende als Overlay =====
h = open(OUT + '/index.html', encoding='utf-8').read()
def cut(pat):
    global h
    m = re.search(pat, h, re.S); assert m, pat[:40]
    h = h.replace(m.group(0), '', 1); return m.group(0)
desc = cut(r'<div class="small">Alle befestigten Feld-.*?</div>\n')
gleg = cut(r'<div class="leg" id="gleg".*?\n</div>\n')
leg = cut(r'<div class="leg">\n<div class="sw carleg".*?Bahnhalt · ○ ohne Regelverkehr</div>\n</div>\n')
def it(col, txt, cls='', st='solid', w=4, op=1):
    return '<span class="%s"><i class="sw2" style="border-top:%dpx %s %s;opacity:%s"></i>%s</span>' % (cls, w, st, col, op, txt)
box = ('<div id="legbox" class="legbox" style="display:none"><div class="legh"><b>Legende</b><button id="legclose" aria-label="Legende schließen">✕</button></div>\n<div class="lg2">'
  + it('#1f6fd1','Radweg, autofrei','carleg') + it('#1a9e4a','Feldweg, Kfz-Verbot','carleg')
  + it('#d89614','Sperrung unklar','carleg') + it('#d23c3c','Kfz frei (Anlieger)','carleg') + it('#5b8fd6','Gehweg (eigener Eintrag)','carleg') + it('#8d9188','gefahren, noch ohne Bewertung','carleg')
  + it('#555','dick = glatt','',w=7) + it('#555','Belag unklar','',st='dashed')
  + it('#555','keine Angabe','',st='dotted') + it('#ff3fd2','rosa = wingbar','',w=10,op=.45)
  + it('#1d1f1a','aufgedeckt','',w=8,op=.85) + it('#5f5f5f','Bundesstraße','',w=3)
  + it('#cfcfcf','Ortsstraße','',w=2) + '<span><b style="color:#7a1f8a;width:22px;text-align:center;flex:none">●</b>Bahnhalt</span>'
  + '</div>\n<div class="lg2" id="gleg" style="display:none">'
  + it('#2e9e44','flach ≤2 %') + it('#9ccc3c','2–4 %') + it('#f0c419','4–6 %') + it('#f08c19','6–9 %') + it('#d6301f','über 9 %')
  + '</div>\n<details class="small" style="margin-top:6px"><summary>Was heißt das genau?</summary>' + desc
  + '<div>Steigung aus dem Copernicus-Höhenmodell (30 m, mit Bäumen/Dächern) – an Waldrändern und in Orten ungenau, nördlich von 49,0° keine Daten.</div></details></div>\n')
h = h.replace('<div id="map"></div>', '<div id="map"></div>\n' + box, 1)
h = h.replace('</style></head>', """
.legbox{position:fixed;left:8px;right:8px;bottom:8px;max-height:42vh;overflow:auto;background:rgba(255,255,255,.96);border-radius:12px;box-shadow:0 4px 18px rgba(0,0,0,.25);z-index:2500;padding:6px 10px 8px;font-size:12px}
.lg2{display:grid;grid-template-columns:1fr 1fr;gap:3px 10px}.lg2 span{display:flex;align-items:center;gap:6px;line-height:1.25}.sw2{display:inline-block;width:22px;flex:none}
.legbox .legh{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}
.legbox .legh button{border:none;background:#f0f1ec;border-radius:6px;width:30px;height:26px;font-size:14px;cursor:pointer}
.legbox .leg{margin-top:6px}
@media(min-width:700px){.legbox{left:auto;right:12px;width:340px;bottom:12px}}
.legbtn{height:34px;padding:0 10px;background:#fff;font-size:13px;font-weight:600;cursor:pointer;border:2px solid rgba(0,0,0,.2);border-radius:4px;color:#333}
.legbtn.on{color:#fff;background:#1d1f1a}
</style></head>""", 1)
open(OUT + '/index.html', 'w', encoding='utf-8').write(h)
print('legend ok')

# ===== Filter merken + eigene Belag-Bewertung in der Anzeige =====
h = open(OUT + '/index.html', encoding='utf-8').read()
def rp(old, new):
    global h
    assert old in h, 'missing: ' + old[:70]; h = h.replace(old, new, 1)
rp("function init(){\n", """function restoreUI(){const u=cfg().ui;if(!u)return;if(u.wind!=null)wind=u.wind;
 const s=(id,p,v)=>{const e=document.getElementById(id);if(e&&v!=null)e[p]=v};s('minRun','value',u.minRun);s('hideSh','checked',u.hideSh);s('unk','checked',u.unk);s('fog','checked',u.fog);
 if(u.cm){const r=document.querySelector('input[name=cm][value='+u.cm+']');if(r){r.checked=true;const g=u.cm==='grade';document.getElementById('gleg').style.display=g?'grid':'none';document.querySelectorAll('.carleg').forEach(e=>e.style.display=g?'none':'')}}}
function saveUI(){setCfg({ui:{wind,minRun:document.getElementById('minRun').value,hideSh:document.getElementById('hideSh').checked,unk:document.getElementById('unk').checked,fog:document.getElementById('fog').checked,cm:cmode()}})}
const BELAG_SM={1:1,2:2,3:3,4:4,5:4};
function myBelag(id){const r=RAT['w'+id];return r&&r.belag?+r.belag:0}
function init(){restoreUI();
""")
rp(" computeComps();\n layer.clearLayers();", " saveUI();computeComps();\n layer.clearLayers();")
rp("function rideable(p){const s=W[p.w][2];return s!==6||document.getElementById('unk').checked}",
   "function rideable(p){const s=W[p.w][2];return s!==6||document.getElementById('unk').checked||myBelag(W[p.w][0])>0}")
rp("  if(rt&&rt.wind&&wind>=0&&rt.windDir===wind){",
   "  const rb=rt&&rt.belag?+rt.belag:0;if(rb===5)st.fill(0);\n  if(rt&&rt.wind&&wind>=0&&rt.windDir===wind){")
rp("  const fogOp=((fog&&!known)?.25:1)*(RD?.2:1);\n  const dash=w[2]===4?\"7 5\":w[2]===6?\"2 5\":null;",
   "  const fogOp=((fog&&!known)?.25:1)*(RD?.2:1)*(rb===5?.35:1);\n  const dash=rb?null:w[2]===4?\"7 5\":w[2]===6?\"2 5\":null;const sm=rb?BELAG_SM[rb]:w[3];")
rp("const wt=(w[3]==1||w[3]==2)?5:3.4,", "const wt=(sm==1||sm==2)?5:rb===5?2:3.4,")
rp("'<br>Belag: '+SNAME[w[2]]+'<br>Glätte: '+MNAME[w[3]]+",
   "(myBelag(w[0])?'<br>Belag laut dir: <b>'+(OPT.belag.find(o=>o[0]===myBelag(w[0]))||[0,'?'])[1]+'</b><br><span style=\"color:#777\">OSM: '+SNAME[w[2]]+', Glätte '+MNAME[w[3]]+'</span>':'<br>Belag: '+SNAME[w[2]]+'<br>Glätte: '+MNAME[w[3]])+")
open(OUT + '/index.html', 'w', encoding='utf-8').write(h)
print('ui+belag ok')

# ===== Unterseiten (Karte / Fahrten / Wind / Mehr) =====
h = open(OUT + '/index.html', encoding='utf-8').read()
m = re.search(r'<div id="wnow" class="wnow"></div>.*?<hr style="border:none;border-top:1px solid #e3e3e3;margin:8px 0">', h, re.S); assert m
gpx = re.search(r'<label id="gpxlbl">.*?</label>', m.group(0), re.S).group(0)
h = h.replace(m.group(0), '', 1)
m = re.search(r'<div id="setdlg" class="dlg">.*?</div></div>\n', h, re.S); assert m
h = h.replace(m.group(0), '', 1)
h = h.replace('<h1>Longboard-Karte · Ostalb &amp; Ries</h1>', '<h1>Filter &amp; Darstellung</h1>', 1)
h = h.replace("const open=id=>{showRide(id);if(id&&window.innerWidth<600)document.getElementById('panel').classList.add('hide')};",
              "const open=id=>{if(id)location.hash='#fahrt/'+encodeURIComponent(id);else showRide('')};", 1)
gpx = gpx.replace('<label id="gpxlbl">', '<label id="gpxlbl" class="btn sec">').replace('Datei importieren (GPX/FIT/TCX)', 'Datei importieren')
ICON = {
 'karte': '<svg viewBox="0 0 24 24"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg>',
 'fahrten': '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
 'wind': '<svg viewBox="0 0 24 24"><path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"/></svg>',
 'mehr': '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/></svg>'}
tabs = '<nav id="tabs">' + ''.join('<a href="#%s" data-p="%s">%s<span>%s</span></a>' % (k, k, ICON[k], t) for k, t in [('karte','Karte'),('fahrten','Fahrten'),('wind','Wind'),('mehr','Mehr')]) + '</nav>'
pages = '''<a id="wchip" class="wchip" href="#wind" style="display:none"></a>
<section class="page" id="pg-fahrten"><div class="pin"><h1>Fahrten</h1><div class="small muted" id="dbstat">Lade gespeicherte Daten …</div><div id="rides"></div></div></section>
<section class="page" id="pg-fahrt"><div class="pin" id="detail"></div></section>
<section class="page" id="pg-wind"><div class="pin"><h1>Wind</h1><div id="wnow"></div></div></section>
<section class="page" id="pg-mehr"><div class="pin"><h1>Mehr</h1>
<div class="card"><div class="ch">Fahrten</div><div class="muted small">Neue Fahrten kommen beim Öffnen automatisch aus intervals.icu. Hier kannst du es erzwingen oder eine Datei von Hand laden.</div>
<div class="btnrow"><button class="btn" id="icubtn">Neue Fahrten holen</button>GPX</div></div>
<div class="card"><div class="ch">Konten &amp; Abgleich</div><div class="muted small">Bleibt nur auf diesem Gerät gespeichert. Auf jedem Gerät einmal eintragen.</div>
<label>intervals.icu Athleten-ID<input id="s_icuId" placeholder="i123456" autocomplete="off"></label>
<label>intervals.icu API-Schlüssel<input id="s_icuKey" type="password" autocomplete="off"></label>
<div class="hint">intervals.icu → Settings → Developer Settings</div>
<label>GitHub-Token für Longboard-Daten<input id="s_gh" type="password" autocomplete="off"></label>
<div class="hint">Fine-grained Token, nur Repo „Longboard-Daten“, Contents: Read and write</div>
<div class="btnrow"><button class="btn" id="s_save">Speichern</button></div><div id="s_msg" class="small" style="color:#1a7f37;margin-top:6px"></div>
<div class="sync"><span id="ghstat" class="small muted"></span><button class="btn sec sm" id="syncbtn">Jetzt abgleichen</button></div></div>
<div class="card"><div class="ch">Über</div><div class="small muted">Wegdaten © OpenStreetMap-Mitwirkende (ODbL) · Höhen: Copernicus DEM GLO-30 · Wetter: DWD über Bright Sky, Open-Meteo · Luftbild: Esri · Topo: OpenTopoMap</div></div>
</div></section>
'''.replace('GPX', gpx) + tabs + '\n'
h = h.replace('</body></html>', pages + '</body></html>', 1)
h = h.replace('</style></head>', '''
:root{--c:#1f6fd1;--ink:#1d1f1a;--bg:#f3f4ef;--mut:#6b6f66;--tab:60px;--sb:env(safe-area-inset-bottom,0px)}
#map{bottom:calc(var(--tab) + var(--sb))}
#chartbox,#sheet{bottom:calc(var(--tab) + var(--sb))!important}
.legbox{bottom:calc(var(--tab) + var(--sb) + 8px)!important}
#tabs{position:fixed;left:0;right:0;bottom:0;height:var(--tab);padding-bottom:var(--sb);background:#fff;border-top:1px solid #e3e4de;display:flex;z-index:4000}
#tabs a{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-size:11px;color:#8a8e85;text-decoration:none;font-weight:600;-webkit-tap-highlight-color:transparent}
#tabs a svg{width:24px;height:24px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
#tabs a.on{color:var(--c)}
.page{position:fixed;left:0;right:0;top:0;bottom:calc(var(--tab) + var(--sb));overflow:auto;background:var(--bg);z-index:3500;display:none;-webkit-overflow-scrolling:touch}
.page.show{display:block}
.pin{max-width:640px;margin:0 auto;padding:18px 14px 28px;font-size:14px}
.pin h1{font-size:26px;margin:2px 0 8px;letter-spacing:-.3px}
.card{background:#fff;border-radius:16px;padding:14px;margin:12px 0;box-shadow:0 1px 2px rgba(0,0,0,.05),0 2px 10px rgba(0,0,0,.04)}
.ch{font-weight:700;margin-bottom:6px;font-size:15px}
.muted{color:var(--mut)}.hint{font-size:12px;color:var(--mut);margin-top:3px}
.btn{border:0;border-radius:11px;padding:10px 14px;background:var(--ink);color:#fff;font-weight:600;font-size:14px;cursor:pointer;display:inline-block;font-family:inherit;line-height:1.2}
.btn.sec{background:#e8eae3;color:var(--ink)}.btn.wide{width:100%;margin:12px 0 4px;padding:12px}.btn.sm{padding:6px 10px;font-size:12px}
.btnrow{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.pin label{display:block;margin-top:12px;font-size:13px;font-weight:600}.pin input[type=password],.pin input:not([type]){width:100%;box-sizing:border-box;padding:10px;font-size:15px;margin-top:4px;border:1px solid #d8dad2;border-radius:10px;background:#fafbf8}
#gpxlbl{margin:0}
.sync{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid #efefea}
.back{color:var(--c);text-decoration:none;font-weight:600;font-size:15px}
.tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}
.tile{background:#fff;border-radius:14px;padding:10px 12px;box-shadow:0 1px 2px rgba(0,0,0,.05)}.tv{font-size:18px;font-weight:700;white-space:nowrap}.tl{font-size:11px;color:var(--mut);margin-top:2px}
.wrow{display:flex;gap:16px;align-items:center;margin-top:6px}.wkt{font-size:48px;font-weight:800;line-height:1;letter-spacing:-1px}.wkt small{font-size:18px;font-weight:600;letter-spacing:0}
.arr{display:inline-block;width:20px;text-align:center;font-weight:800;color:var(--c);line-height:1}.arr.big{font-size:52px;width:56px}
.fr{display:grid;grid-template-columns:44px 18px 36px 1fr 58px 50px;align-items:center;gap:6px;font-size:13px;padding:5px 0;border-top:1px solid #f1f1ec}
.fb{position:relative;height:10px;background:#f0f1ec;border-radius:5px;overflow:hidden}.fb i{position:absolute;left:0;top:0;bottom:0;border-radius:5px}.fb i.g{background:none;border-right:2px solid rgba(0,0,0,.55);border-radius:0}
.fv{text-align:right;white-space:nowrap}.fp{font-size:11px;color:var(--mut);text-align:right}
.wchip{position:absolute;z-index:1001;top:10px;left:50%;transform:translateX(-50%);background:#fff;border-radius:22px;padding:7px 14px;box-shadow:0 2px 10px rgba(0,0,0,.2);display:flex;gap:7px;align-items:center;color:var(--ink);text-decoration:none;font-size:14px;white-space:nowrap}
.wchip .muted{font-size:12px}
#pg-fahrten .cal{background:#fff;border-radius:16px;padding:12px;margin:12px 0;box-shadow:0 1px 2px rgba(0,0,0,.05),0 2px 10px rgba(0,0,0,.04)}
#pg-fahrten .cd{height:44px;font-size:14px}#pg-fahrten .calh{font-size:16px}
#pg-fahrten .ride{background:#fff;border-radius:14px;padding:12px 14px;margin:8px 0;box-shadow:0 1px 2px rgba(0,0,0,.05);font-size:14px}
#pg-fahrten .ride .rn{font-size:12px;margin-top:3px}#pg-fahrten .ride.lnk{background:none;box-shadow:none;padding:4px 2px}
@media (max-width:600px){.wchip{top:auto;bottom:calc(var(--tab) + var(--sb) + 14px)}}
</style></head>''', 1)
open(OUT + '/index.html', 'w', encoding='utf-8').write(h)
print('pages ok')

# ===== Detail mit Karte, Dark Mode =====
h = open(OUT + '/index.html', encoding='utf-8').read()
def rp(old, new, n=1):
    global h
    assert old in h, 'missing: ' + old[:70]; h = h.replace(old, new, n)
rp('<section class="page" id="pg-fahrt"><div class="pin" id="detail"></div></section>',
   '<section class="page" id="pg-fahrt"><div class="pin"><div id="dhead"></div><div id="dmapslot" class="mapslot"></div><div id="dchartslot"></div><div id="detail"></div></div></section>')
rp('<div class="card"><div class="ch">Über</div>',
   '<div class="card"><div class="ch">Darstellung</div><div class="seg" id="themeSel"><button data-t="auto">Automatisch</button><button data-t="light">Hell</button><button data-t="dark">Dunkel</button></div><div class="hint">„Automatisch“ folgt der Einstellung deines Handys.</div><div class="ch" style="margin-top:14px">Karte dunkel</div><div class="seg" id="mapThemeSel"><button data-m="sun">Nur nachts</button><button data-m="app">Wie die App</button><button data-m="light">Nie</button></div><div class="hint">„Nur nachts“: dunkle Karte erst, wenn die Sonne am Kartenort untergegangen ist.</div></div>\n<div class="card"><div class="ch">Über</div>')
rp("c.fillStyle='#f4f5f0';c.fillRect(L0,y0,W0-L0-R0,rh);", "c.fillStyle=THEME.chartBg;c.fillRect(L0,y0,W0-L0-R0,rh);")
rp("c.fillStyle='#555';c.font='10px system-ui'", "c.fillStyle=THEME.chartTx;c.font='10px system-ui'")
rp("c.fillStyle='#555';c.textAlign='center';const step=", "c.fillStyle=THEME.chartTx;c.textAlign='center';const step=")
rp("c.strokeStyle='#1d1f1a';c.lineWidth=1;c.beginPath();c.moveTo(x,0)", "c.strokeStyle=THEME.cur;c.lineWidth=1;c.beginPath();c.moveTo(x,0)")
rp("c.fillStyle='#1d1f1a';c.beginPath();c.arc(x,r.Y(v),3,0,7)", "c.fillStyle=THEME.cur;c.beginPath();c.arc(x,r.Y(v),3,0,7)")
rp('</style></head>', """
.mapslot{position:relative;height:46vh;min-height:260px;border-radius:16px;overflow:hidden;margin:12px 0 0;box-shadow:0 1px 2px rgba(0,0,0,.05),0 2px 10px rgba(0,0,0,.06)}
.mapslot #map{position:absolute!important;inset:0!important;bottom:0!important}
#chartbox.inline{position:static!important;display:block;box-shadow:none;border-radius:16px;margin:10px 0;padding:10px 12px;background:var(--card)}
#chartbox.inline #chclose,#chartbox.inline #chtitle,#chartbox.inline #chwx{display:none}
#chartbox.inline .chhead{display:none}
.seg{display:flex;background:var(--seg);border-radius:11px;padding:3px;gap:3px;margin-top:6px}.seg button{flex:1;border:0;background:none;padding:8px;border-radius:9px;font:inherit;font-weight:600;color:var(--mut);cursor:pointer}.seg button.on{background:var(--card);color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.12)}
:root{--card:#fff;--seg:#e8eae3;--line:#f1f1ec}
html.dark{--bg:#121416;--card:#1d2023;--ink:#eceee8;--mut:#9da198;--seg:#2a2e31;--line:#2a2d30;color-scheme:dark}
html.dark body{background:#121416;color:#eceee8}
html.dark .card,html.dark .tile,html.dark #pg-fahrten .cal,html.dark #pg-fahrten .ride{background:var(--card);box-shadow:none}
html.dark .fr{border-top-color:var(--line)}html.dark .fb{background:#2c3033}html.dark .fb i.g{border-right-color:rgba(255,255,255,.7)}
html.dark .btn{background:#eceee8;color:#121416}html.dark .btn.sec{background:#2c3033;color:#eceee8}
html.dark .pin input{background:#16191b!important;border-color:#33373a!important;color:#eceee8}
html.dark #tabs{background:#1a1d20;border-top-color:#2a2d30}html.dark #tabs a{color:#7f847b}html.dark #tabs a.on{color:#6aa5ff}
html.dark .arr{color:#6aa5ff}html.dark .back{color:#6aa5ff}
html.dark .panel,html.dark #chartbox,html.dark #sheet,html.dark .legbox{background:rgba(29,32,35,.97);color:#eceee8}
html.dark .small{color:#a9ada4}html.dark .ride{background:#2a2e31}html.dark .ride.on{background:#eceee8;color:#121416}
html.dark .calnav,html.dark #chclose,html.dark .legbox .legh button,html.dark .btns{background:#2c3033;color:#eceee8}
html.dark .cd{color:#a9ada4}html.dark .cd.sel{background:#22314a}html.dark .cd.today{box-shadow:inset 0 0 0 1.5px #eceee8}html.dark .cd.on .dot{background:#eceee8}
html.dark .mb{background:#25282a;border-color:#3a3e41;color:#eceee8}html.dark .mb.on{background:#eceee8;color:#121416}
html.dark #toggle,html.dark .pbtn,html.dark .btnp{background:#eceee8;color:#121416}
html.dark .wchip,html.dark .locbtn,html.dark .legbtn,html.dark .leaflet-bar a,html.dark .leaflet-control-layers{background:#1d2023;color:#eceee8;border-color:#3a3e41}
html.dark .legbtn.on,html.dark .locbtn.on{background:#6aa5ff;color:#121416}
html.dark .lbtn{background:#1d2023;color:#eceee8;border-color:#3a3e41}html.dark .lpop{background:rgba(29,32,35,.97);color:#eceee8}html.dark .lopt{color:#eceee8}
html.dark .leaflet-popup-content-wrapper,html.dark .leaflet-popup-tip{background:#1d2023;color:#eceee8}
html.dark .leaflet-popup-content a{color:#6aa5ff}
html.darkmap .leaflet-container,html.darkmap #map{background:#1a1c1e}
html.dark #gpxlbl{background:#2c3033;color:#eceee8}

html.darkmap .leaflet-container:not(.sat) .leaflet-tile-pane{filter:invert(1) hue-rotate(180deg) brightness(.85) contrast(.9)}
html.darkmap .lbl{color:#d6d8d2;text-shadow:0 0 3px #000,0 0 3px #000,0 0 3px #000}html.darkmap .lbl.st{color:#d9a6e4}
html.dark .leaflet-control-attribution{background:rgba(29,32,35,.8)!important;color:#9da198}html.dark .leaflet-control-attribution a{color:#6aa5ff}
html.dark textarea{background:#16191b;color:#eceee8;border-color:#33373a}html.dark .chips button{background:#25282a;color:#eceee8;border-color:#3a3e41}html.dark .chips button.on{background:#4f9cf0;color:#0e1113;border-color:#4f9cf0;font-weight:600}
html.dark #busy{background:#1d2023;color:#eceee8}html.dark .wnow{background:#1f2a38}
</style></head>""")
open(OUT + '/index.html', 'w', encoding='utf-8').write(h)
print('detail+dark ok')

# ===== Cursor-Anzeige ohne Springen =====
h = open(OUT + '/index.html', encoding='utf-8').read()
old = "(W_.twa<45?'gegen den Wind':W_.twa<90?'am Wind':W_.twa<135?'halber Wind/raum':'Rückenwind')"
assert old in h
h = h.replace(old, "(W_.twa<45?'Gegenwind':W_.twa<90?'am Wind':W_.twa<135?'Halbwind':'Rückenwind')")
h = h.replace('</style></head>', """
#chval{min-height:2.8em;font-variant-numeric:tabular-nums;line-height:1.4}
</style></head>""", 1)
open(OUT + '/index.html', 'w', encoding='utf-8').write(h)
print('chval ok')

# ===== Cursor-Anzeige als feste Felder =====
h = open(OUT + '/index.html', encoding='utf-8').read()
m = re.search(r"document\.getElementById\('chval'\)\.textContent=\(RD\.T\?.*?\):''\)\}", h); assert m, 'chval stmt'
h = h.replace(m.group(0), """const cell=(v,l)=>'<span><b>'+(v==null||v===''?'–':v)+'</b>'+(l?' '+l:'')+'</span>';
 document.getElementById('chval').innerHTML=cell(RD.T?new Date(RD.T[i]*1000).toLocaleTimeString('de-DE'):null,'')+cell((RD.d[i]/1000).toFixed(2),'km')+cell(RD.e[i]!=null?Math.round(RD.e[i]):null,'m')
  +cell(RD.v[i],'km/h')+cell(RD.h[i],'♥')+cell(W_?Math.round(W_.ws)+' kt':null,twaTxt||'Wind')}""", 1)
h = h.replace('#chval{min-height:2.8em;font-variant-numeric:tabular-nums;line-height:1.4}',
 '#chval{display:grid;grid-template-columns:repeat(3,1fr);gap:2px 8px;font-variant-numeric:tabular-nums;line-height:1.45;margin:4px 0}#chval span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}', 1)
open(OUT + '/index.html', 'w', encoding='utf-8').write(h)
print('chval grid ok')

# ===== Fahrt prüfen: Einbau =====
h = open(OUT + '/index.html', encoding='utf-8').read()
def rp(old, new):
    global h
    assert old in h, 'missing: ' + old[:80]; h = h.replace(old, new, 1)
rp("const fogOp=((fog&&!known)?.25:1)*(RD?.2:1)", "const fogOp=((fog&&!known)?.25:1)*(RD?.2:REVIEWING?.5:1)")
rp("const rt=RAT['w'+w[0]];const known=!!rt;", "const rt=RAT['w'+w[0]];const known=pieceKnown(pi,rt);")
rp(" document.getElementById('stat').textContent=", " drawExtras(R,fog);document.getElementById('stat').textContent=")
rp("(r.ridden?' · '+((r.rides&&r.rides.length)||1)+'× befahren'+(r.rides&&r.rides.length?' (zuletzt '+r.rides[r.rides.length-1].split('-').reverse().join('.')+')':''):'')",
   "(actLine(r)?'<br><span style=\"color:#777\">'+actLine(r)+'</span>':'')")
rp("const ride={date:day,", "const act=actOf(tr.sport,S.sport);const ride={act,sport:tr.sport||null,date:day,")
rp("let n=0;for(const id of hit){const r=Object.assign({},RAT['w'+id]||{way:id});r.ridden=true;r.way=id;const rides=(r.rides||[]).slice();if(!rides.includes(day))rides.push(day);r.rides=rides.slice(-50);r.updated=day;",
   "let n=0;for(const id of hit){const r=Object.assign({},RAT['w'+id]||{way:id});r.way=id;if(act==='board'){r.ridden=true;const rides=(r.rides||[]).slice();if(!rides.includes(day))rides.push(day);r.rides=rides.slice(-50)}const AA=Object.assign({},r.act||{});AA[act]=(AA[act]||[]).filter(x=>x!==day).concat(day).slice(-50);r.act=AA;r.updated=day;")
rp("if(pts.length>1)tr={pts,fmt:'intervals.icu'}}}", "if(pts.length>1)tr={pts,fmt:'intervals.icu'}}}")
rp("if(!tr)return null;const S0=tr.session||{}", "if(!tr)return null;tr.sport=a.type||null;const S0=tr.session||{}")
rp('<div class="row"><label><input type="checkbox" id="fog"> Fog of War (Unentdecktes abdunkeln)</label></div>',
   '<div class="row"><label><input type="checkbox" id="fog"> Fog of War (Unentdecktes abdunkeln)</label></div>\n<div class="row">Aufgedeckt durch <select id="seenBy"><option value="alle">alle</option><option value="board">Board</option><option value="fuss">zu Fuß</option></select></div>')
rp("s('fog','checked',u.fog);", "s('fog','checked',u.fog);s('seenBy','value',u.seenBy);")
rp("fog:document.getElementById('fog').checked,", "fog:document.getElementById('fog').checked,seenBy:document.getElementById('seenBy').value,")
rp("for(const id of ['hideSh','minRun','unk','fog'])document.getElementById(id).onchange=draw;", "for(const id of ['hideSh','minRun','unk','fog','seenBy'])document.getElementById(id).onchange=draw;")
rp('<section class="page" id="pg-wind">', '<section class="page" id="pg-pruefen"><div class="rvtop"><a class="back" id="rvback" href="javascript:history.back()">‹ Zurück</a><span id="rvprog" class="small muted"></span></div><div id="rvmapslot" class="rvmap"></div><div id="rvbody"></div><div id="rvbar" class="rvbar"></div></section>\n<section class="page" id="pg-wind">')
rp('</style></head>', """
.rvtop{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;flex:none}
#pg-pruefen{bottom:0}#pg-pruefen.show{display:flex;flex-direction:column;overflow:hidden}body.reviewing #tabs{display:none}
#rvbody{flex:1 1 auto;overflow-y:auto;padding:6px 12px 4px;position:relative;font-size:14px;max-width:640px;width:100%;box-sizing:border-box;margin:0 auto}
.rvbar{flex:none;display:grid;grid-template-columns:56px 1fr 56px;gap:8px;padding:8px 12px calc(8px + var(--sb));border-top:1px solid var(--line);background:var(--bg);max-width:640px;width:100%;box-sizing:border-box;margin:0 auto}.rvbar .btn{font-size:16px;padding:12px 6px}
.rvtools{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin:0 -12px 6px;padding:0 12px}.rvtools::-webkit-scrollbar{display:none}
.tbtn{flex:none;border:1px solid #d3d5cc;background:var(--card);color:var(--ink);border-radius:14px;padding:5px 10px;font:inherit;font-size:12px;font-weight:600;white-space:nowrap;cursor:pointer}.tbtn.on{background:#e6f1fb;color:#0c447c;border-color:#85b7eb}
.rvi{font-size:12px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rvh{font-size:12px;color:var(--mut);margin-top:2px}
.rvin{flex:1;min-width:0;padding:6px 9px;border-radius:9px;border:1px solid #d8dad2;font:inherit;font-size:14px;background:var(--card);color:var(--ink)}
.rvnotebox{position:absolute;inset:0;background:var(--bg);padding:10px 12px;z-index:5}.rvnotebox textarea{width:100%;box-sizing:border-box;min-height:120px;font:inherit;border-radius:10px;border:1px solid #d8dad2;padding:8px;background:var(--card);color:var(--ink)}
html.dark .tbtn{background:#25282a;border-color:#3a3e41;color:#eceee8}html.dark .tbtn.on{background:#0c447c;color:#e6f1fb}html.dark .rvin{border-color:#3a3e41}
.rvmap{position:relative;flex:0 0 38vh;min-height:200px}.rvmap #map{position:absolute!important;inset:0!important}
.tl{width:100%;height:26px;display:block;cursor:pointer;background:var(--card);border-radius:7px}
.tlx{display:flex;justify-content:space-between;font-size:11px;color:var(--mut);margin-top:2px}.tlx .acc{color:var(--c);font-weight:600}
.rvt{font-size:16px;font-weight:700;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.stb{font-size:11px;background:#e5f3e8;color:#1a7f37;border-radius:8px;padding:2px 7px;vertical-align:middle;font-weight:600}
.qrow{display:flex;gap:8px;align-items:center;margin-top:7px}.ql{flex:0 0 58px;font-size:12px;color:var(--mut);font-weight:600;line-height:1.1}.ql i{display:block;font-style:normal;font-weight:400;font-size:10px;opacity:.8}
.chips2{display:flex;flex-wrap:nowrap;gap:6px;overflow-x:auto;scrollbar-width:none;flex:1;min-width:0}.chips2::-webkit-scrollbar{display:none}.chip{flex:none;border:1px solid #c9ccc2;background:var(--card);border-radius:15px;padding:7px 11px;font:inherit;font-size:13px;color:var(--ink);cursor:pointer;white-space:nowrap}
.chip.on{background:#e6f1fb;color:#0c447c;border-color:#85b7eb;font-weight:600}
.rvbtns{display:grid;grid-template-columns:52px 1fr 52px;gap:8px;margin-top:16px}.rvbtns .btn{font-size:16px;padding:12px}
.lnkbtn{border:0;background:none;color:var(--c);font:inherit;font-weight:600;cursor:pointer;padding:6px}
.rvarr div{color:#fff;font-size:13px;text-shadow:0 0 2px #1f6fd1,0 0 3px #1f6fd1;line-height:18px;text-align:center}
.cd .todo{position:absolute;bottom:4px;left:50%;margin-left:-3px;width:6px;height:6px;border-radius:50%;background:#f08c19}
.tbadge{font-size:11px;background:#fdf0dc;color:#854f0b;border-radius:8px;padding:1px 7px;font-weight:600}.abadge{font-size:11px;background:#e1f5ee;color:#085041;border-radius:8px;padding:1px 7px;font-weight:600}
.rvgo{text-align:center;text-decoration:none;box-sizing:border-box;background:#f08c19!important;color:#fff!important}
html.dark .chip{background:#25282a;border-color:#3a3e41;color:#eceee8}html.dark .chip.on{background:#0c447c;color:#e6f1fb;border-color:#378add}
html.dark .tbadge{background:#633806;color:#fac775}html.dark .abadge{background:#085041;color:#9fe1cb}html.dark .stb{background:#173404;color:#c0dd97}
</style></head>""")
open(OUT + '/index.html', 'w', encoding='utf-8').write(h)
print('review ok')

# ===== Leistung (sicher): Zeichenflächen wiederverwenden statt bei jedem Neuzeichnen neu anlegen =====
h = open(OUT + '/index.html', encoding='utf-8').read()
def rp(old, new):
    global h
    assert old in h, 'missing: ' + old[:80]; h = h.replace(old, new, 1)
rp("layer.clearLayers();halo.clearLayers();reveal.clearLayers();const R=L.canvas({padding:.5,tolerance:8});",
   "layer.clearLayers();halo.clearLayers();reveal.clearLayers();if(!window.NETR)window.NETR=L.canvas({padding:.5,tolerance:8});const R=NETR;")
rp("function drawRideTrack(){if(!RD)return;rideLayer.clearLayers();const R=L.canvas({padding:.5,tolerance:6,pane:ridePane()});",
   "let RIDER=null;function drawRideTrack(){if(!RD)return;rideLayer.clearLayers();if(!RIDER)RIDER=L.canvas({padding:.5,tolerance:6,pane:ridePane()});const R=RIDER;")
rp("function revDraw(){if(!REV)return;revLayer.clearLayers();const R=L.canvas({padding:.5,tolerance:8,pane:ridePane()});",
   "let REVR=null;function revDraw(){if(!REV)return;revLayer.clearLayers();if(!REVR)REVR=L.canvas({padding:.5,tolerance:8,pane:ridePane()});const R=REVR;")
open(OUT + '/index.html', 'w', encoding='utf-8').write(h)
print('leakfix ok')

# ===== kleinere Zeichenflächen + Fehleranzeige =====
h = open(OUT + '/index.html', encoding='utf-8').read()
h = h.replace("L.canvas({padding:.5,tolerance:8})", "L.canvas({padding:.1,tolerance:8})").replace("L.canvas({pane:'fillPane',padding:.5})", "L.canvas({pane:'fillPane',padding:.1})").replace("tolerance:8,pane:ridePane()", "tolerance:8,padding:.1,pane:ridePane()").replace("L.canvas({padding:.5,tolerance:6,pane:ridePane()})", "L.canvas({padding:.1,tolerance:6,pane:ridePane()})")
pass
h = h.replace("const R=L.canvas({padding:.1,tolerance:8,padding:.1,pane:ridePane()", "const R=L.canvas({padding:.1,tolerance:8,pane:ridePane()")

h = h.replace('<script src="leaflet.js"></script>', '''<script>window.addEventListener('error',e=>{try{let b=document.getElementById('errbox');if(!b){b=document.createElement('div');b.id='errbox';b.style.cssText='position:fixed;left:8px;right:8px;top:8px;z-index:9999;background:#b3261e;color:#fff;font:12px system-ui;padding:8px 10px;border-radius:8px;white-space:pre-wrap';b.onclick=()=>b.remove();document.body.appendChild(b)}b.textContent='Fehler (bitte Screenshot an Claude): '+(e.message||e)+' @'+(e.lineno||'')}catch(x){}});</script>
<script src="leaflet.js"></script>''', 1)
open(OUT + '/index.html', 'w', encoding='utf-8').write(h)
print('pad ok', h.count('padding:.1'), h.count('window.NETR=R'))

# ===== flüssiger: Details erst ab Zoom 12, vereinfachte Linien, rosa Schimmer je nach Zoom =====
h = open(OUT + '/index.html', encoding='utf-8').read()
def rp(old, new):
    global h
    assert old in h, 'missing: ' + old[:80]; h = h.replace(old, new, 1)
rp(' for(const r of D.ctx.streams||[]) L.polyline(dec(r),{renderer:RF,color:"#9fc9e8",weight:1,interactive:false}).addTo(ctxFill);',
   ' window.DETF=L.layerGroup();for(const r of D.ctx.streams||[]) L.polyline(dec(r),{renderer:RF,color:"#9fc9e8",weight:1,interactive:false,smoothFactor:2}).addTo(DETF);')
rp(' for(const r of D.ctx.conn) L.polyline(dec(r[1]),{renderer:R,color:"#c4c4c4",weight:1.6})',
   ' window.DETR=L.layerGroup();for(const r of D.ctx.conn) L.polyline(dec(r[1]),{renderer:R,color:"#c4c4c4",weight:1.6,smoothFactor:2})')
rp(""".openOn(map)).addTo(ctx);""", """.openOn(map)).addTo(DETR);""")
for k in ['fillColor:"#cfe0c4",fillOpacity:.8,interactive:false', 'fillColor:"#e2dbd0",fillOpacity:.9,interactive:false', 'fillColor:"#a9d1ee",fillOpacity:1,interactive:false']:
    rp(k, k+',smoothFactor:2')
rp(' map.on(\'zoomend\',()=>{if(map.getZoom()>=12)villageLayer.addTo(map);else villageLayer.remove()});',
   """ const lod=()=>{const z=map.getZoom();if(z>=12){villageLayer.addTo(map);DETR.addTo(ctx);if(map.hasLayer(ctxFill))DETF.addTo(ctxFill)}else{villageLayer.remove();ctx.removeLayer(DETR);ctxFill.removeLayer(DETF)}
  const hw=z>=14?11:z>=12?8:5;halo.eachLayer(l=>{if(l.options.weight!==hw)l.setStyle({weight:hw})})};map.on('zoomend',lod);window.LOD=lod;setTimeout(lod,0);""")
rp('L.polyline(pts,{renderer:R,color:"#ff3fd2",weight:11,opacity:.33*fogOp,interactive:false}).addTo(halo)',
   'L.polyline(pts,{renderer:R,color:"#ff3fd2",weight:map.getZoom()>=14?11:map.getZoom()>=12?8:5,opacity:.33*fogOp,interactive:false,smoothFactor:1.5}).addTo(halo)')
rp('.on(\'click\',ev=>pop(p,ev.latlng)).addTo(layer);a=z}}', '.on(\'click\',ev=>pop(p,ev.latlng)).addTo(layer);a=z}}')
open(OUT + '/index.html', 'w', encoding='utf-8').write(h)
print('lod ok')

# ===== Wegenetz gebündelt nach Gebiet zeichnen (weniger Objekte, flüssiger) =====
h = open(OUT + '/index.html', encoding='utf-8').read()
h = h.replace("function init(){restoreUI();", "const CELL=(ll)=>Math.floor(ll[0]/0.03)+','+Math.floor(ll[1]/0.045);\nfunction byCell(lines,first){const M={};for(const l of lines){if(!l||!l.length)continue;const f=first?first(l):l[0];const k=CELL(f);(M[k]||(M[k]=[])).push(l)}return Object.values(M)}\nfunction init(){restoreUI();", 1)
# draw with grouped layers
i = h.index('function draw(){'); j = h.index('function reasonAt')
h = h[:i] + r'''function draw(){
 document.querySelectorAll('#wind button').forEach(b=>b.classList.toggle('on',+b.dataset.d===wind));
 document.getElementById('wlabel').textContent=wind<0?'– (kein Windfilter, nur Straßennähe)':DIRS[wind];
 saveUI();computeComps();
 layer.clearLayers();halo.clearLayers();reveal.clearLayers();if(!window.NETR)window.NETR=L.canvas({padding:.1,tolerance:8});const R=NETR;
 const hide=document.getElementById('hideSh').checked,minRun=+document.getElementById('minRun').value,fog=document.getElementById('fog').checked,grade=cmode()==='grade';
 const dim=(RD?.2:REVIEWING?.5:1);const G={},H={},REV_=[];const add=(M,key,st,pts)=>{key=key+'@'+CELL(pts[0]);let g=M[key];if(!g)M[key]=g={st,ls:[]};g.ls.push(pts)};
 let shown=0;
 for(let pi=0;pi<P.length;pi++){const p=P[pi];if(!rideable(p))continue;const w=W[p.w];const n=p.k.length;
  const st=new Uint8Array(n);for(let i=0;i<n;i++){const g=p.base+i;st[i]=comp[g]<0?0:(compLen[g]>=minRun?2:1)}
  const rt0=RAT['w'+w[0]];const kv=knownIv(pi,rt0),known=kv===true;const rt=kv?dispRat(pi,w):rt0;
  const rb=rt&&rt.belag?+rt.belag:0;if(rb===5)st.fill(0);
  if(rt&&rt.wind&&wind>=0&&rt.windDir===wind){if(rt.wind==='windschatten')st.fill(0);else if(rt.wind==='frei')st.fill(2)}
  if(kv===true)REV_.push(p.pts);else if(kv)for(const [a,b] of kv)REV_.push(clipPts(p,a,b));
  const part=(fog&&Array.isArray(kv))?kv:null,fullOp=dim*(rb===5?.35:1);
  const ov=(mk,a,z)=>{if(!part)return;const c=cumOf(p);for(const [x,y] of part){const lo=Math.max(x,c[a]),hi=Math.min(y,c[z]);if(hi-lo>1)mk(clipPts(p,lo,hi))}};
  const fogOp=((fog&&!known)?.25:1)*dim*(rb===5?.35:1);
  const dash=rb?null:w[2]===4?"7 5":w[2]===6?"2 5":null;const sm=rb?BELAG_SM[rb]:w[3];
  let s=0;while(s<n){const v=st[s];let e=s;while(e<n&&st[e]===v)e++;
   if(v===2){let L0=0;for(let q=s;q<e;q++)L0+=p.segs[q];shown+=L0;const op=+(.33*fogOp).toFixed(3);add(H,op,{op},p.pts.slice(s,e+1));const o2=+(.33*fullOp).toFixed(3);ov(q=>add(H,o2,{op:o2},q),s,e)}
   if(v===2||!hide){const wt=(sm==1||sm==2)?5:rb===5?2:3.4,op=+((v===2?1:.85)*fogOp).toFixed(3);
    if(grade){let a=s;while(a<e){const g0=p.gr[a],c=gcls(g0);let z=a;while(z<e&&gcls(p.gr[z])===c)z++;const col=gcol(g0);add(G,col+'|'+wt+'|'+op+'|'+dash,{col,wt,op,dash},p.pts.slice(a,z+1));const o2=+((v===2?1:.85)*fullOp).toFixed(3);ov(q=>add(G,col+'|'+wt+'|'+o2+'|'+dash,{col,wt,op:o2,dash},q),a,z);a=z}}
    else{const col=wcolOf(w,rt);add(G,col+'|'+wt+'|'+op+'|'+dash,{col,wt,op,dash},p.pts.slice(s,e+1));const o2=+((v===2?1:.85)*fullOp).toFixed(3);ov(q=>add(G,col+'|'+wt+'|'+o2+'|'+dash,{col,wt,op:o2,dash},q),s,e)}}
   s=e}}
 for(const g of byCell(REV_))L.polyline(g,{renderer:R,color:"#1d1f1a",weight:9,opacity:.85*dim,interactive:false}).addTo(reveal);
 const hw=map.getZoom()>=14?11:map.getZoom()>=12?8:5;for(const k in H)L.polyline(H[k].ls,{renderer:R,color:"#ff3fd2",weight:hw,opacity:H[k].st.op,interactive:false,smoothFactor:1.5}).addTo(halo);
 const keys=Object.keys(G).sort((a,b)=>(G[a].st.dash?0:1)-(G[b].st.dash?0:1));
 for(const k of keys){const st=G[k].st;L.polyline(G[k].ls,{renderer:R,color:st.col,weight:st.wt,opacity:st.op,dashArray:st.dash,lineCap:st.dash?"butt":"round",interactive:false}).addTo(layer)}
 drawExtras(R,fog);document.getElementById('stat').textContent=(shown/1000).toFixed(0)+' km rosa (wing-taugliche) Wegstücke';
}
function netClick(ll){const S=buildIdx();const q=[ll.lat,ll.lng];const x=Math.floor(q[0]/S.cell),y=Math.floor(q[1]/S.cell);let best=null,bd=40;
 for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(const it of S.G.get((x+a)+','+(y+b))||[]){if(it[0]!==0)continue;const p=P[it[1]];if(!rideable(p))continue;const d=segDist(q,p.pts[it[2]],p.pts[it[2]+1]);if(d<bd){bd=d;best=p}}
 if(best)pop(best,ll)}
function connPop(ll){const q=[ll.lat,ll.lng];let bi=-1,bd=40;for(let i=0;i<CONN.length;i++){const pts=CONN[i];for(let j=0;j<pts.length-1;j++){const a=pts[j],b=pts[j+1];
   if(Math.abs(a[0]-q[0])>.003&&Math.abs(b[0]-q[0])>.003)continue;const d=segDist(q,a,b);if(d<bd){bd=d;bi=i}}}
 if(bi<0)return;const r=D.ctx.conn[bi];L.popup().setLatLng(ll).setContent('<b>Straße'+(r[2]?' – '+r[2]:'')+'</b><br>Laut OSM für Autos freigegeben. Wird deshalb nicht als Wingstrecke gezählt.<br>Falls dort in echt ein Verbotsschild steht: bitte melden bzw. in OSM eintragen.<br><a href="https://www.openstreetmap.org/way/'+r[0]+'" target="_blank" rel="noopener">OSM</a>').openOn(map)}
''' + h[j:]

h = h.replace('{renderer:R,color:"#c4c4c4",weight:1.6,smoothFactor:2})','{renderer:R,color:"#c4c4c4",weight:1.6,smoothFactor:2,interactive:false})',1)
h = h.replace("L.popup().setLatLng(ll).setContent('<b>'+CNAME[w[1]]+'</b>'","L.popup().setLatLng(ll).setContent('<b>'+wName(w)+'</b>'",1)
assert 'wName(w)' in h
h = h.replace(" const parts=[];for(const k of ['belag','autos','wind','leute'])if(r[k]!=null)parts.push(QN[k]+': '+lbl(k,r[k])+(k==='wind'&&r.windDir!=null?' (bei Wind aus '+DIRS[r.windDir]+')':''));"," const parts=[];if(r.typ)parts.push('Wegart: '+lbl2('art',r.typ));for(const k of ['belag','autos','wind','leute'])if(r[k]!=null)parts.push(QN[k]+': '+lbl(k,r[k])+(k==='wind'&&r.windDir!=null?' (bei Wind aus '+DIRS[r.windDir]+')':''));if(r.board)parts.push('Boardbar: '+lbl2('board',r.board));",1)
assert "Wegart: '+lbl2('art',r.typ)" in h
h = h.replace(r'''onclick="openSheet('+w[0]+')"''', r'''onclick="openEdit(\'w\','+w[0]+')"''',1)
h = h.replace("autos:[['schild','Kfz-Verbot (Schild)'],['keine','keine gesehen'],['vereinzelt','vereinzelt'],['oft','oft']]","autos:[['schild','Kfz-Verbot (Schild)'],['keine','keine gesehen'],['vereinzelt','vereinzelt'],['oft','oft'],['uhrzeit','je nach Uhrzeit']]",1)
assert "['uhrzeit','je nach Uhrzeit']" in h
h = h.replace("function rtHtml(id){","function rtHtml0(id){",1)
h = h.replace("if(r.typ)parts.push('Wegart: '+lbl2('art',r.typ));for(const k of ['belag','autos','wind','leute'])","if(r.typ)parts.push('Wegart: '+lbl2('art',r.typ));for(const k of ['belag','wind','leute'])",1)
assert "for(const k of ['belag','wind','leute'])if(r[k]!=null)parts.push" in h
h = h.replace("autos:[['schild','Kfz-Verbot (Schild)'],['keine','keine gesehen'],['vereinzelt','vereinzelt'],['oft','oft'],['uhrzeit','je nach Uhrzeit']]","autos:[['schild','Kfz-Verbot (Schild)'],['keine','keine'],['vereinzelt','wenige'],['oft','viele']]",1)
assert "['oft','viele']]" in h and 'function rtHtml0' in h
h = h.replace(" for(const arr of nodeSegs.values())for(let i=1;i<arr.length;i++)uni(arr[0],arr[i]);", " for(const arr of nodeSegs.values())for(let i=1;i<arr.length;i++)uni(arr[0],arr[i]);\n try{for(const [a,b] of coverage().links)if(op[a]&&op[b])uni(a,b)}catch(e){}", 1)
assert 'coverage().links' in h
open(OUT + '/index.html', 'w', encoding='utf-8').write(h)
print('netgroup ok')
