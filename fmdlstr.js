// Ganti sebagian teks di tabel string FMDL (mis. nama folder tekstur), menyesuaikan offset & ukuran
export function replaceInStrings(u8,oldText,newText){
  const enc=new TextEncoder(), dec=new TextDecoder('latin1');
  const dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength);
  const S0=dv.getUint32(0x28,true), S1=dv.getUint32(0x30,true);
  const n0=dv.getUint32(0x20,true), n1=dv.getUint32(0x24,true);
  let strTab=null; for(let i=0;i<n0;i++){const v=dv.getUint32(0x40+8*i,true);if((v&0xffff)===0xc)strTab={count:v>>>16,off:S0+dv.getUint32(0x44+8*i,true)};}
  const base=0x40+8*n0; let e3=-1,sOff=0,sLen=0;
  for(let i=0;i<n1;i++)if(dv.getUint32(base+12*i,true)===3){e3=base+12*i;sOff=dv.getUint32(e3+4,true);sLen=dv.getUint32(e3+8,true);}
  const start=S1+sOff, end=start+sLen;
  if(end!==u8.length) throw new Error('tabel string bukan di akhir file');
  const ents=[];
  for(let i=0;i<strTab.count;i++){const o=strTab.off+8*i;
    ents.push({i,o,len:dv.getUint16(o+2,true),off:dv.getUint32(o+4,true)});}
  const oldB=enc.encode(oldText), newB=enc.encode(newText);
  const order=[...ents].sort((a,b)=>a.off-b.off);
  const out=[]; let delta=0, cursor=0; const table=u8.subarray(start,end);
  const newOff=new Map(), newLen=new Map();
  for(const e of order){
    if(e.off<cursor) { newOff.set(e.i,e.off+delta); newLen.set(e.i,e.len); continue; }
    out.push(table.subarray(cursor,e.off));           // sela (pemisah)
    let s=table.subarray(e.off,e.off+e.len);
    const str=dec.decode(s), k=str.indexOf(oldText);
    let rep=s;
    if(k>=0){rep=enc.encode(str.slice(0,k)+newText+str.slice(k+oldText.length));}
    newOff.set(e.i,e.off+delta); newLen.set(e.i,rep.length);
    out.push(rep); delta+=rep.length-s.length; cursor=e.off+e.len;
  }
  out.push(table.subarray(cursor));
  let tl=0;out.forEach(p=>tl+=p.length);
  const res=new Uint8Array(start+tl); res.set(u8.subarray(0,start),0);
  let p=start;for(const q of out){res.set(q,p);p+=q.length;}
  const rv=new DataView(res.buffer);
  for(const e of ents){rv.setUint16(e.o+2,newLen.get(e.i),true);rv.setUint32(e.o+4,newOff.get(e.i),true);}
  rv.setUint32(e3+8,sLen+delta,true);
  rv.setUint32(0x34,dv.getUint32(0x34,true)+delta,true);
  return res;
}
export function readStrings(u8){
  const dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength), dec=new TextDecoder('latin1');
  const S0=dv.getUint32(0x28,true), S1=dv.getUint32(0x30,true), n0=dv.getUint32(0x20,true), n1=dv.getUint32(0x24,true);
  let strTab=null; for(let i=0;i<n0;i++){const v=dv.getUint32(0x40+8*i,true);if((v&0xffff)===0xc)strTab={count:v>>>16,off:S0+dv.getUint32(0x44+8*i,true)};}
  const base=0x40+8*n0; let start=0;
  for(let i=0;i<n1;i++)if(dv.getUint32(base+12*i,true)===3)start=S1+dv.getUint32(base+12*i+4,true);
  const out=[];for(let i=0;i<strTab.count;i++){const o=strTab.off+8*i,l=dv.getUint16(o+2,true),f=dv.getUint32(o+4,true);out.push(dec.decode(u8.subarray(start+f,start+f+l)));}
  return out;
}
