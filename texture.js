// Proyeksi foto ke tekstur wajah template (1024x1024 RGBA)
export const TT={eyeL:[395,380],eyeR:[628,381],nose:[512,525],mouth:[512,628]};

// similarity (skala+rotasi+geser) kuadrat terkecil: foto -> tekstur
export function similarity(P,T){
  const n=P.length, cp=[0,0], ct=[0,0];
  for(let i=0;i<n;i++){cp[0]+=P[i][0]/n;cp[1]+=P[i][1]/n;ct[0]+=T[i][0]/n;ct[1]+=T[i][1]/n;}
  let sa=0,sb=0,sp=0;
  for(let i=0;i<n;i++){const px=P[i][0]-cp[0],py=P[i][1]-cp[1],tx=T[i][0]-ct[0],ty=T[i][1]-ct[1];
    sa+=px*tx+py*ty; sb+=px*ty-py*tx; sp+=px*px+py*py;}
  const a=sa/sp,b=sb/sp;
  return {a,b,tx:ct[0]-(a*cp[0]-b*cp[1]),ty:ct[1]-(b*cp[0]+a*cp[1])};
}
function gaussBlur(src,w,h,sigma){
  const r=Math.ceil(sigma*3), k=new Float32Array(2*r+1); let s=0;
  for(let i=-r;i<=r;i++){k[i+r]=Math.exp(-i*i/(2*sigma*sigma));s+=k[i+r];} for(let i=0;i<k.length;i++)k[i]/=s;
  const tmp=new Float32Array(w*h), out=new Float32Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=0;for(let i=-r;i<=r;i++){const xx=Math.min(w-1,Math.max(0,x+i));v+=src[y*w+xx]*k[i+r];}tmp[y*w+x]=v;}
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=0;for(let i=-r;i<=r;i++){const yy=Math.min(h-1,Math.max(0,y+i));v+=tmp[yy*w+x]*k[i+r];}out[y*w+x]=v;}
  return out;
}
const clip=(v,a,b)=>v<a?a:v>b?b:v;

/** photo:{data,w,h} RGBA; tpl: Uint8ClampedArray 1024*1024*4; pts: titik foto {eyeL,eyeR,nose,mouth}
 *  opts.keepLips: jangan tempel bibir/mulut dari foto (ekspresi netral) */
export function makeTexture(photo,tpl,pts,opts={}){
  const W=1024,H=1024, keepLips=opts.keepLips===true, keepEyes=opts.keepEyes!==false;
  const names=['eyeL','eyeR','nose','mouth'];
  const M=similarity(names.map(n=>pts[n]),names.map(n=>TT[n]));
  const det=M.a*M.a+M.b*M.b;
  // warp: tekstur -> foto (peta balik), bilinear
  const warp=new Float32Array(W*H*3);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const dx=x-M.tx,dy=y-M.ty;
    let px=(M.a*dx+M.b*dy)/det, py=(-M.b*dx+M.a*dy)/det;
    px=clip(px,0,photo.w-1.001);py=clip(py,0,photo.h-1.001);
    const x0=px|0,y0=py|0,fx=px-x0,fy=py-y0,o=(y0*photo.w+x0)*4,o2=o+photo.w*4,q=(y*W+x)*3;
    for(let c=0;c<3;c++){
      warp[q+c]=(photo.data[o+c]*(1-fx)+photo.data[o+4+c]*fx)*(1-fy)+(photo.data[o2+c]*(1-fx)+photo.data[o2+4+c]*fx)*fy;
    }
  }
  // batas atas mask = sedikit di atas alis foto (alis ikut dari foto; rambut/dahi atas tetap template)
  const tyOf=n=>M.b*pts[n][0]+M.a*pts[n][1]+M.ty;
  const cutTop=Math.min(tyOf('browL'),tyOf('browR'))-34;
  // mask wajah
  let mask=new Float32Array(W*H), eyeK=new Float32Array(W*H);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const e=((x-512)/238)**2+((y-525)/290)**2;
    let m=clip((1-e)/0.35,0,1)*clip((y-cutTop)/30,0,1);
    {const a=((x-TT.eyeL[0])/54)**2+((y-TT.eyeL[1])/30)**2, b=((x-TT.eyeR[0])/54)**2+((y-TT.eyeR[1])/30)**2, k=clip((1-Math.min(a,b))/0.35,0,1);
      const ga=((x-TT.eyeL[0])/44)**2+((y-TT.eyeL[1])/24)**2, gb=((x-TT.eyeR[0])/44)**2+((y-TT.eyeR[1])/24)**2;
      eyeK[y*W+x]=keepEyes?clip((1-Math.min(ga,gb))/0.5,0,1):0; if(keepEyes)m*=1-k;}
    if(keepLips){const el=((x-512)/120)**2+((y-628)/58)**2;m*=1-clip((1-el)/0.5,0,1);}
    mask[y*W+x]=m;
  }
  // batasi di dalam kontur rahang foto (jawL, jaw2L, chin, jaw2R, jawR) supaya latar tidak ikut
  const tp=n=>[M.a*pts[n][0]-M.b*pts[n][1]+M.tx, M.b*pts[n][0]+M.a*pts[n][1]+M.ty];
  const Lc=['jawL','jaw2L','chin'].map(tp), Rc=['jawR','jaw2R','chin'].map(tp), MARG=16;
  const edge=(c,y)=>{ if(y<=c[0][1])return c[0][0]; for(let i=0;i<c.length-1;i++){const a=c[i],b=c[i+1];if(y<=b[1])return a[0]+(y-a[1])/(b[1]-a[1])*(b[0]-a[0]);} return c[c.length-1][0]; };
  for(let y=0;y<H;y++){
    if(y<Lc[0][1]-30)continue;
    const le=edge(Lc,y)+MARG, re=edge(Rc,y)-MARG, below=y>Lc[2][1]-MARG;
    for(let x=0;x<W;x++){
      const v=below?0:clip((x-le)/10,0,1)*clip((re-x)/10,0,1);
      mask[y*W+x]*=v;
    }
  }
  mask=gaussBlur(mask,W,H,7);
  // samakan warna kulit
  const patch=(get,pts)=>{const s=[0,0,0];for(const [x,y] of pts){for(let yy=y-8;yy<y+8;yy++)for(let xx=x-8;xx<x+8;xx++){const q=get(yy*W+xx);s[0]+=q[0];s[1]+=q[1];s[2]+=q[2];}}
    const n=pts.length*256;return s.map(v=>v/n);};
  const cheeks=[[335,520],[690,520],[420,680],[600,680]];
  const pw=patch(i=>[warp[3*i],warp[3*i+1],warp[3*i+2]],cheeks), pt=patch(i=>[tpl[4*i],tpl[4*i+1],tpl[4*i+2]],cheeks);
  const gain=pw.map((v,i)=>v-pt[i]);   // selisih (aditif): tidak merusak rona di dahi/leher
  const out=new Uint8ClampedArray(W*H*4);
  for(let y=0;y<H;y++){const skin=clip((y-240)/60,0,1);
    for(let x=0;x<W;x++){const i=y*W+x,m=mask[i];
      for(let c=0;c<3;c++){const t=tpl[4*i+c]+gain[c]*skin*(1-eyeK[i]);out[4*i+c]=t*(1-m)+warp[3*i+c]*m;}   // jendela mata template: warna asli dipertahankan
      out[4*i+3]=tpl[4*i+3];}}
  return {rgba:out,gain};
}
