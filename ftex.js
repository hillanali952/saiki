import {decodeBC3,encodeBC3,downscale} from './bc3.js';

async function pipe(u8,stream){
  const s=new Blob([u8]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(s).arrayBuffer());
}
export const inflate=u8=>pipe(u8,new DecompressionStream('deflate'));   // zlib
export const deflate=u8=>pipe(u8,new CompressionStream('deflate'));

const CH=16384;
export class Ftex{
  static async read(u8){
    const t=new Ftex(); t.header=u8.slice(0,0x40);
    const dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength);
    if(String.fromCharCode(...u8.subarray(0,4))!=='FTEX') throw new Error('Bukan FTEX');
    t.pf=dv.getUint16(8,true);t.w=dv.getUint16(10,true);t.h=dv.getUint16(12,true);t.nmips=u8[0x10];
    t.mips=[];
    for(let i=0;i<t.nmips;i++){
      const e=0x40+16*i, off=dv.getUint32(e,true), usz=dv.getUint32(e+4,true), cc=dv.getUint16(e+14,true);
      const parts=[];
      for(let k=0;k<cc;k++){
        const cs=dv.getUint16(off+8*k,true), us=dv.getUint16(off+8*k+2,true); let o=dv.getUint32(off+8*k+4,true);
        const raw=(o&0x80000000)!==0; o&=0x7fffffff;
        const blk=u8.subarray(off+o,off+o+(raw?us:cs));
        parts.push(raw?blk:await inflate(blk));
      }
      const out=new Uint8Array(usz);let p=0;for(const q of parts){out.set(q,p);p+=q.length;}
      if(p!==usz) throw new Error('ukuran mip tidak cocok');
      t.mips.push(out);
    }
    return t;
  }
  decodeRGBA(mip=0){ if(this.pf!==4) throw new Error('hanya BC3 (pf 4)');
    return decodeBC3(this.mips[mip],Math.max(1,this.w>>mip),Math.max(1,this.h>>mip)); }
  // ganti semua mip dari gambar RGBA ukuran penuh
  replaceRGBA(rgba){
    if(this.pf!==4) throw new Error('hanya BC3 (pf 4)');
    for(let i=0;i<this.nmips;i++){
      const w=Math.max(1,this.w>>i),h=Math.max(1,this.h>>i);
      let m=rgba,mw=this.w,mh=this.h;
      if(i>0){m=downscale(rgba,this.w,this.h,w,h);mw=w;mh=h;}
      const enc=encodeBC3(m,mw,mh);
      if(enc.length!==this.mips[i].length) throw new Error('ukuran BC3 mip '+i+' tidak cocok');
      this.mips[i]=enc;
    }
  }
  async bytes(){
    const n=this.mips.length, blobs=[];
    for(let i=0;i<n;i++){
      const raw=this.mips[i], chunks=[];
      for(let k=0;k<raw.length;k+=CH)chunks.push(raw.subarray(k,k+CH));
      const cc=chunks.length, tab=new DataView(new ArrayBuffer(8*cc)), parts=[]; let dp=8*cc;
      for(let k=0;k<cc;k++){
        const z=await deflate(chunks[k]), ch=chunks[k];
        if(z.length>=ch.length){tab.setUint16(8*k,ch.length,true);tab.setUint16(8*k+2,ch.length,true);tab.setUint32(8*k+4,(dp|0x80000000)>>>0,true);parts.push(ch);dp+=ch.length;}
        else{tab.setUint16(8*k,z.length,true);tab.setUint16(8*k+2,ch.length,true);tab.setUint32(8*k+4,dp,true);parts.push(z);dp+=z.length;}
      }
      const blob=new Uint8Array(dp);blob.set(new Uint8Array(tab.buffer),0);let p=8*cc;for(const q of parts){blob.set(q,p);p+=q.length;}
      blobs.push({blob,cc});
    }
    let pos=0x40+16*n;const offs=new Array(n);
    for(let i=n-1;i>=0;i--){offs[i]=pos;pos+=blobs[i].blob.length;}
    const out=new Uint8Array(pos), dv=new DataView(out.buffer);
    out.set(this.header,0);
    for(let i=0;i<n;i++){const e=0x40+16*i;
      dv.setUint32(e,offs[i],true);dv.setUint32(e+4,this.mips[i].length,true);dv.setUint32(e+8,blobs[i].blob.length,true);
      out[e+12]=i;out[e+13]=0;dv.setUint16(e+14,blobs[i].cc,true);}
    for(let i=n-1;i>=0;i--)out.set(blobs[i].blob,offs[i]);
    return out;
  }
}
