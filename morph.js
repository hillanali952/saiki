// Morph mesh wajah: thin-plate spline dari pasangan titik (foto -> template)
export const XR0=-0.11, YR1=1.80, SC=880/0.30;
export const px2m=([x,y])=>[XR0+x/SC, YR1-y/SC];
// titik template pada render depan (piksel) - hasil penandaan manual
export const TP={eyeL:[243,300],eyeR:[413,300],browL:[240,250],browR:[415,250],
  alaL:[270,415],alaR:[378,415],nose:[325,425],mouthL:[252,510],mouthR:[395,510],mouth:[325,510],
  chin:[325,645],jawL:[150,510],jawR:[500,510],jaw2L:[190,620],jaw2R:[465,620]};
export const ANCH=[[60,300],[590,300],[75,360],[575,360],[325,90],[200,110],[450,110],[120,200],[530,200],
  [330,800],[150,700],[510,700],[60,780],[590,780],[325,700],[200,760],[450,760]];

// cincin penjepit di sekitar tiap mata (perpindahan nol): bola mata tidak ikut bergeser, jadi kelopak harus tetap
const RING=[[0,0],[-50,0],[50,0],[0,-28],[0,28],[-36,-20],[36,-20],[-36,20],[36,20]];
export function controls(ph,strength=0.6){
  const names=Object.keys(TP).filter(n=>n!=='eyeL'&&n!=='eyeR');   // mata dikunci, bukan dipindah
  const e0=[(ph.eyeL[0]+ph.eyeR[0])/2,(ph.eyeL[1]+ph.eyeR[1])/2];
  const s=Math.hypot(TP.eyeR[0]-TP.eyeL[0],TP.eyeR[1]-TP.eyeL[1])/Math.hypot(ph.eyeR[0]-ph.eyeL[0],ph.eyeR[1]-ph.eyeL[1]);
  const src=[],dst=[];
  for(const n of names){
    const t=TP[n],p=ph[n], tgt=[(p[0]-e0[0])*s+328,(p[1]-e0[1])*s+300];
    src.push(px2m(t)); dst.push(px2m([t[0]+(tgt[0]-t[0])*strength,t[1]+(tgt[1]-t[1])*strength]));
  }
  for(const a of ANCH){src.push(px2m(a));dst.push(px2m(a));}
  for(const e of [TP.eyeL,TP.eyeR])for(const r of RING){const q=px2m([e[0]+r[0],e[1]+r[1]]);src.push(q);dst.push(q);}
  return {src,dst};
}

function solve(A,b){ // eliminasi Gauss, pivot parsial; b: array vektor kolom (n x m)
  const n=A.length,m=b[0].length;
  const M=A.map((r,i)=>[...r,...b[i]]);
  for(let c=0;c<n;c++){
    let p=c;for(let r=c+1;r<n;r++)if(Math.abs(M[r][c])>Math.abs(M[p][c]))p=r;
    [M[c],M[p]]=[M[p],M[c]];
    const d=M[c][c]; for(let k=c;k<n+m;k++)M[c][k]/=d;
    for(let r=0;r<n;r++)if(r!==c){const f=M[r][c];if(f)for(let k=c;k<n+m;k++)M[r][k]-=f*M[c][k];}
  }
  return M.map(r=>r.slice(n));
}
const phi=r2=>r2>0?0.5*r2*Math.log(r2):0;   // r^2 ln r
export function makeTPS(src,dst,smoothing=1e-9){
  const N=src.length, A=[], B=[];
  for(let i=0;i<N;i++){
    const row=new Array(N+3).fill(0);
    for(let j=0;j<N;j++)row[j]=phi((src[i][0]-src[j][0])**2+(src[i][1]-src[j][1])**2)+(i===j?smoothing:0);
    row[N]=1;row[N+1]=src[i][0];row[N+2]=src[i][1];
    A.push(row);B.push([dst[i][0]-src[i][0],dst[i][1]-src[i][1]]);
  }
  for(let k=0;k<3;k++){const row=new Array(N+3).fill(0);
    for(let j=0;j<N;j++)row[j]=k===0?1:src[j][k-1];
    A.push(row);B.push([0,0]);}
  const W=solve(A,B);
  return (x,y)=>{
    let dx=W[N][0]+W[N+1][0]*x+W[N+2][0]*y, dy=W[N][1]+W[N+1][1]*x+W[N+2][1]*y;
    for(let j=0;j<N;j++){const k=phi((x-src[j][0])**2+(y-src[j][1])**2);dx+=W[j][0]*k;dy+=W[j][1]*k;}
    return [dx,dy];
  };
}
export function applyMorph(f,ctl){
  const fn=makeTPS(ctl.src,ctl.dst);
  for(let mi=0;mi<f.meshes.length;mi++){
    const P=f.positions(mi);
    for(let v=0;v<f.meshes[mi].vc;v++){const [dx,dy]=fn(P[3*v],P[3*v+1]);P[3*v]+=dx;P[3*v+1]+=dy;}
    f.setPositions(mi,P);
  }
  // tulang wajah (skf_*) ikut bergeser supaya animasi (kedip, buka mulut) berputar di tempat yang benar
  const bn=f.boneNames();
  for(let i=0;i<bn.length;i++){ if(!/^skf_/.test(bn[i]))continue;
    const p=f.bonePos(i),[dx,dy]=fn(p[0],p[1]); f.setBonePos(i,[p[0]+dx,p[1]+dy,p[2]]);}
}
