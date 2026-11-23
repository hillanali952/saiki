// Pembaca/penimpa FMDL (wajah PES 2021): posisi, atribut mentah, indeks
import {readStrings} from './fmdlstr.js';
export class Fmdl{
  constructor(u8){
    this.d=u8.slice(); const d=this.d;
    this.dv=new DataView(d.buffer);
    if(String.fromCharCode(...d.subarray(0,4))!=='FMDL') throw new Error('Bukan FMDL');
    const dv=this.dv;
    const S0=dv.getUint32(0x28,true), S1=dv.getUint32(0x30,true);
    const n0=dv.getUint32(0x20,true), n1=dv.getUint32(0x24,true);
    const tab={};
    for(let i=0;i<n0;i++){const v=dv.getUint32(0x40+8*i,true),off=dv.getUint32(0x44+8*i,true);tab[v&0xffff]=[v>>>16,S0+off];}
    const sec1={}, base=0x40+8*n0;
    for(let i=0;i<n1;i++) sec1[dv.getUint32(base+12*i,true)]=[dv.getUint32(base+12*i+4,true),dv.getUint32(base+12*i+8,true)];
    this.boneTab=tab[0]||[0,0];
    const BUF=S1+sec1[2][0];
    const [mc,mo]=tab[3]; this.meshes=[];
    for(let i=0;i<mc;i++){const o=mo+48*i;
      this.meshes.push({vc:dv.getUint16(o+10,true),fi:dv.getUint32(o+16,true),fc:dv.getUint32(o+20,true)});}
    const [ec,eo]=tab[0xa], ents=[];
    for(let i=0;i<ec;i++){const o=eo+8*i;ents.push({buf:d[o],cnt:d[o+1],stride:d[o+2],off:dv.getUint32(o+4,true)});}
    const pos=ents.filter(e=>e.buf===0), att=ents.filter(e=>e.buf===1&&e.cnt===2);
    let posSize=0, attSize=0;
    this.meshes.forEach((m,i)=>{
      m.posOff=pos[i].off; m.stride=att[i].stride; m.attOff=att[i].off;
      posSize=Math.max(posSize,m.posOff+((m.vc*12+15)&~15));
      attSize=Math.max(attSize,m.attOff+((m.vc*m.stride+15)&~15));
    });
    this.posBase=BUF; this.attBase=BUF+posSize; this.idxBase=this.attBase+attSize;
  }
  positions(i){const m=this.meshes[i], out=new Float32Array(m.vc*3);
    for(let k=0;k<out.length;k++) out[k]=this.dv.getFloat32(this.posBase+m.posOff+4*k,true); return out;}
  setPositions(i,arr){const m=this.meshes[i];
    for(let k=0;k<m.vc*3;k++) this.dv.setFloat32(this.posBase+m.posOff+4*k,arr[k],true);}
  attrRaw(i){const m=this.meshes[i]; return this.d.subarray(this.attBase+m.attOff,this.attBase+m.attOff+m.vc*m.stride);}
  uv(i){ // half2 di offset 0x18
    const m=this.meshes[i], raw=this.attrRaw(i), out=new Float32Array(m.vc*2), dv=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
    for(let v=0;v<m.vc;v++){out[2*v]=half(dv.getUint16(v*m.stride+0x18,true));out[2*v+1]=half(dv.getUint16(v*m.stride+0x1a,true));}
    return out;}
  indices(i){const m=this.meshes[i], out=new Uint32Array(m.fc);
    for(let k=0;k<m.fc;k++) out[k]=this.dv.getUint16(this.idxBase+m.fi*2+2*k,true); return out;}
  // tulang: 48 byte per tulang; id nama di +0 (u16), posisi dunia (x,y,z,1) di +32
  boneNames(){const st=readStrings(this.d);return Array.from({length:this.boneTab[0]},(_,i)=>st[this.dv.getUint16(this.boneTab[1]+48*i,true)]);}
  bonePos(i){const o=this.boneTab[1]+48*i+32;return [this.dv.getFloat32(o,true),this.dv.getFloat32(o+4,true),this.dv.getFloat32(o+8,true)];}
  setBonePos(i,p){const o=this.boneTab[1]+48*i+32;this.dv.setFloat32(o,p[0],true);this.dv.setFloat32(o+4,p[1],true);this.dv.setFloat32(o+8,p[2],true);}
  bytes(){return this.d;}
}
export function half(h){const s=(h&0x8000)?-1:1,e=(h>>10)&31,f=h&1023;
  if(e===0)return s*Math.pow(2,-14)*(f/1024); if(e===31)return f?NaN:s*Infinity; return s*Math.pow(2,e-15)*(1+f/1024);}
