// Seil-Zeichner: Punktliste + z-Ebene je Segment -> SVG mit Über/Unter an Kreuzungen
function ropeSVG(K,step,opt){opt=opt||{};const P=K.pts,Z=K.z,ST=opt.steps||K.steps,S=ST[step];const upto=S.upto,from=step>0?ST[step-1].upto:0;
 const W=opt.w||13,F=opt.f||9;let el=[];
 const cr=(i)=>P[Math.max(0,Math.min(upto,i))];
 function seg(i){const p0=cr(i-1),p1=P[i],p2=P[i+1],p3=cr(i+2);const t=0.5/3;
  const c1=[p1[0]+(p2[0]-p0[0])*t,p1[1]+(p2[1]-p0[1])*t],c2=[p2[0]-(p3[0]-p1[0])*t,p2[1]-(p3[1]-p1[1])*t];return [p1,c1,c2,p2]}
 const levels=[...new Set(Z.slice(0,upto).concat((K.props||[]).map(p=>p.z)))].sort((a,b)=>a-b);
 const props=(K.props||[]).map(p=>Object.assign({},p));
 for(const lv of levels.concat([99])){
  for(const pr of props)if(pr.z===lv)el.push(pr.svg);
  if(lv===99)break;
  const ids=[];for(let i=0;i<upto;i++)if(Z[i]===lv)ids.push(i);
  // zusammenhängende Läufe
  const runs=[];let cur=null;for(const i of ids){if(cur&&i===cur[1]+1)cur[1]=i;else{cur=[i,i];runs.push(cur)}}
  for(const [a,b] of runs){let d='';for(let i=a;i<=b;i++){const s=seg(i);if(i===a)d+='M'+s[0].join(',');d+=' C'+s[1].map(v=>v.toFixed(1)).join(',')+' '+s[2].map(v=>v.toFixed(1)).join(',')+' '+s[3].join(',')}
   const capA=a===0,capB=b===upto-1;
   el.push('<path d="'+d+'" fill="none" stroke="#2a2522" stroke-width="'+W+'" stroke-linecap="butt"/>');
   if(capA||capB){for(const [c,yes] of [[P[a],capA],[P[b+1],capB]])if(yes)el.push('<circle cx="'+c[0]+'" cy="'+c[1]+'" r="'+W/2+'" fill="#2a2522"/>')}
   // Füllung: neu dazugekommen = orange
   for(let i=a;i<=b;i++){const s=seg(i);const mk=S.mark&&S.mark.includes(i);const nw=!S.nonew&&(i>=from&&step>0);
    el.push('<path d="M'+s[0].join(',')+' C'+s[1].map(v=>v.toFixed(1)).join(',')+' '+s[2].map(v=>v.toFixed(1)).join(',')+' '+s[3].join(',')+'" fill="none" stroke="'+(mk?'#5aa0ff':nw?'#ff9a3c':'#e6c88a')+'" stroke-width="'+F+'" stroke-linecap="round"/>')}
   for(const [c,yes] of [[P[a],capA],[P[b+1],capB]])if(yes){const nw=!S.nonew&&(c===P[b+1])&&b>=from&&step>0;el.push('<circle cx="'+c[0]+'" cy="'+c[1]+'" r="'+F/2+'" fill="'+(nw?'#ff9a3c':'#e6c88a')+'"/>')}
  }
  for(const pr of props)if(pr.z===lv+0.5)el.push(pr.svg);
 }
 // Seilende markieren
 const e=P[upto];el.push('<circle cx="'+e[0]+'" cy="'+e[1]+'" r="3" fill="#2a2522"/>');
 for(const ar of (S.arrows||(S.arrow?[S.arrow]:[]))){const [a,b]=ar;el.push('<path d="M'+a.join(',')+' L'+b.join(',')+'" stroke="#3a86ff" stroke-width="3" marker-end="url(#ah)" fill="none"/>')}
 return '<svg viewBox="'+(K.vb||'0 0 300 300')+'" xmlns="http://www.w3.org/2000/svg"><defs><marker id="ah" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#3a86ff"/></marker></defs>'+(K.bg||'')+el.join('')+'</svg>'}
