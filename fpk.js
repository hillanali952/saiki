import {md5} from './md5.js';
const enc=new TextEncoder(), dec=new TextDecoder();

export function readFpk(u8){
  const dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength);
  if(dec.decode(u8.subarray(0,6))!=='foxfpk') throw new Error('Bukan file FPK');
  const count=dv.getUint32(0x24,true), out=[];
  for(let i=0;i<count;i++){
    const o=0x30+i*0x30;
    const off=Number(dv.getBigUint64(o,true)), size=Number(dv.getBigUint64(o+8,true));
    const noff=Number(dv.getBigUint64(o+16,true)), nlen=Number(dv.getBigUint64(o+24,true));
    out.push({name:dec.decode(u8.subarray(noff,noff+nlen)), data:u8.slice(off,off+size)});
  }
  return out;
}

export function writeFpk(entries){
  const n=entries.length, table=0x30+n*0x30;
  const nameBytes=entries.map(e=>enc.encode(e.name));
  let namesLen=0; nameBytes.forEach(b=>namesLen+=b.length+1);
  const dataStart=(table+namesLen+15)&~15;
  let pos=dataStart; const offs=[];
  for(const e of entries){offs.push(pos); pos+=(e.data.length+15)&~15;}
  const out=new Uint8Array(pos), dv=new DataView(out.buffer);
  out.set(enc.encode('foxfpk'),0); out.set(enc.encode('win'),7);
  dv.setUint32(0x0a,pos,true);
  dv.setUint32(0x20,2,true);dv.setUint32(0x24,n,true);dv.setUint32(0x28,0,true);
  let np=table;
  entries.forEach((e,i)=>{
    const o=0x30+i*0x30;
    dv.setBigUint64(o,BigInt(offs[i]),true);dv.setBigUint64(o+8,BigInt(e.data.length),true);
    dv.setBigUint64(o+16,BigInt(np),true);dv.setBigUint64(o+24,BigInt(nameBytes[i].length),true);
    out.set(md5(nameBytes[i]),o+32);
    out.set(nameBytes[i],np); np+=nameBytes[i].length+1;
    out.set(e.data,offs[i]);
  });
  return out;
}
