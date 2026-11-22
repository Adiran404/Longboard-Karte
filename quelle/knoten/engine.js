// Seil-Zeichner: ein oder mehrere Seile (Punktliste + z-Ebene je Segment), Über/Unter an Kreuzungen
function ropeSVG(K,step,opt){opt=opt||{};const ST=opt.steps||K.steps,S=ST[step];
 if(S.fig)return ropeSVG(S.fig,S.fig.steps.length-1,{});
 const ropes=K.ropes||[{pts:K.pts,z:K.z}];const W0=K.w||13,F0=K.f||9;
 const up=(st,ri)=>st?(Array.isArray(st.upto)?st.upto[ri]:st.upto):0;
 let el=[];const props=K.props||[];
 const lv=new Set(props.map(p=>p.z));ropes.forEach((r,ri)=>r.z.slice(0,up(S,ri)).forEach(v=>lv.add(v)));
 const levels=[...lv].sort((a,b)=>a-b);
 const segOf=(P,upto,i)=>{const cr=j=>P[Math.max(0,Math.min(upto,j))];const p0=cr(i-1),p1=P[i],p2=P[i+1],p3=cr(i+2),t=0.5/3;
  return [p1,[p1[0]+(p2[0]-p0[0])*t,p1[1]+(p2[1]-p0[1])*t],[p2[0]-(p3[0]-p1[0])*t,p2[1]-(p3[1]-p1[1])*t],p2]};
 const dS=s=>' C'+s[1].map(v=>v.toFixed(1)).join(',')+' '+s[2].map(v=>v.toFixed(1)).join(',')+' '+s[3].join(',');
 for(const L of levels){
  for(const pr of props)if(pr.z===L)el.push(pr.svg);
  ropes.forEach((R,ri)=>{const P=R.pts,Z=R.z,upto=up(S,ri),from=step>0?up(ST[step-1],ri):0;const W=R.w||W0,F=R.f||F0;const base=R.col||'#e6c88a',hi=R.hi||'#ff9a3c';
   const ids=[];for(let i=0;i<upto;i++)if(Z[i]===L)ids.push(i);const runs=[];let cur=null;for(const i of ids){if(cur&&i===cur[1]+1)cur[1]=i;else{cur=[i,i];runs.push(cur)}}
   for(const [a,b] of runs){let d='M'+P[a].join(',');for(let i=a;i<=b;i++)d+=dS(segOf(P,upto,i));
    el.push('<path d="'+d+'" fill="none" stroke="#2a2522" stroke-width="'+W+'" stroke-linecap="butt"/>');
    if(a===0&&!R.noStartCap)el.push('<circle cx="'+P[0][0]+'" cy="'+P[0][1]+'" r="'+W/2+'" fill="#2a2522"/>');
    if(b===upto-1)el.push('<circle cx="'+P[upto][0]+'" cy="'+P[upto][1]+'" r="'+W/2+'" fill="#2a2522"/>');
    for(let i=a;i<=b;i++){const s=segOf(P,upto,i);const mk=S.mark&&(Array.isArray(S.mark[0])?(S.mark[ri]||[]).includes(i):ri===0&&S.mark.includes(i));const nw=!S.nonew&&step>0&&i>=from;
     el.push('<path d="M'+s[0].join(',')+dS(s)+'" fill="none" stroke="'+(mk?'#5aa0ff':nw?hi:base)+'" stroke-width="'+F+'" stroke-linecap="round"/>')}
    if(a===0&&!R.noStartCap)el.push('<circle cx="'+P[0][0]+'" cy="'+P[0][1]+'" r="'+F/2+'" fill="'+base+'"/>');
    if(b===upto-1){const nw=!S.nonew&&step>0&&b>=from;el.push('<circle cx="'+P[upto][0]+'" cy="'+P[upto][1]+'" r="'+F/2+'" fill="'+(nw?hi:base)+'"/>')}}
  });
 }
 ropes.forEach((R,ri)=>{if(R.noEndDot)return;const e=R.pts[up(S,ri)];if(up(S,ri)>0)el.push('<circle cx="'+e[0]+'" cy="'+e[1]+'" r="'+Math.max(2,(R.f||F0)/3)+'" fill="#2a2522"/>')});
 for(const ar of (S.arrows||(S.arrow?[S.arrow]:[]))){const [a,b]=ar;el.push('<path d="M'+a.join(',')+' L'+b.join(',')+'" stroke="#3a86ff" stroke-width="3" marker-end="url(#ah)" fill="none"/>')}
 if(S.label)for(const t of S.label)el.push('<text x="'+t[0]+'" y="'+t[1]+'" font-size="'+(t[3]||13)+'" font-family="system-ui,sans-serif" fill="#3a3530" text-anchor="middle">'+t[2]+'</text>');
 return '<svg viewBox="'+(K.vb||'0 0 300 300')+'" xmlns="http://www.w3.org/2000/svg"><defs><marker id="ah" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#3a86ff"/></marker></defs>'+(K.bg||'')+el.join('')+'</svg>'}
