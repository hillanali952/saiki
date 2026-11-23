// Peta 478 landmark MediaPipe (x,y ternormalisasi) -> 15 titik kontrol (piksel foto)
import {TP} from './morph.js';
// jaw2 di template: (620-510)/(645-510) dari jarak mulut ke dagu. HARUS sama di foto.
export const JAW2_FRAC=0.815;
export const NAMES=['eyeL','eyeR','browL','browR','alaL','alaR','nose','mouthL','mouthR','mouth','chin','jawL','jawR','jaw2L','jaw2R'];
const OVAL_L=[234,93,132,58,172,136,150,149,176,148,152];   // sisi kiri gambar, dari telinga ke dagu
const OVAL_R=[454,323,361,288,397,365,379,378,400,377,152];
export function mapLandmarks(lm,w,h){
  const P=i=>[lm[i].x*w,lm[i].y*h], avg=(...ix)=>{const s=[0,0];ix.forEach(i=>{const p=P(i);s[0]+=p[0]/ix.length;s[1]+=p[1]/ix.length;});return s;};
  const o={eyeL:avg(33,133),eyeR:avg(263,362),browL:P(105),browR:P(334),alaL:P(129),alaR:P(358),nose:P(2),
    mouthL:P(61),mouthR:P(291),mouth:avg(13,14),chin:P(152)};
  const atY=(list,y)=>{ // titik pada garis rahang di ketinggian y
    const pts=list.map(P);
    for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1];
      if((a[1]-y)*(b[1]-y)<=0&&a[1]!==b[1]){const t=(y-a[1])/(b[1]-a[1]);return [a[0]+t*(b[0]-a[0]),y];}}
    return pts[y<pts[0][1]?0:pts.length-1];
  };
  const y1=o.mouth[1], y2=o.mouth[1]+JAW2_FRAC*(o.chin[1]-o.mouth[1]);
  o.jawL=atY(OVAL_L,y1);o.jawR=atY(OVAL_R,y1);o.jaw2L=atY(OVAL_L,y2);o.jaw2R=atY(OVAL_R,y2);
  return o;
}
// titik awal dari dua mata (proporsi rata-rata template, ikut skala dan kemiringan mata)
export function pointsFromEyes(eL,eR){
  const mid=[(eL[0]+eR[0])/2,(eL[1]+eR[1])/2], tl=TP.eyeL, tr=TP.eyeR, tm=[(tl[0]+tr[0])/2,(tl[1]+tr[1])/2];
  const k=Math.hypot(eR[0]-eL[0],eR[1]-eL[1])/Math.hypot(tr[0]-tl[0],tr[1]-tl[1]);
  const ang=Math.atan2(eR[1]-eL[1],eR[0]-eL[0]), c=Math.cos(ang), s=Math.sin(ang), o={};
  for(const n of NAMES){const dx=(TP[n][0]-tm[0])*k, dy=(TP[n][1]-tm[1])*k; o[n]=[mid[0]+dx*c-dy*s, mid[1]+dx*s+dy*c];}
  return o;
}
export function defaultPoints(w,h){const e=h*0.0+Math.min(w,h)*0.15;return pointsFromEyes([w/2-e,h*0.38],[w/2+e,h*0.38]);}
