import {readFpk,writeFpk} from './fpk.js';
import {Fmdl} from './fmdl.js';
import {replaceInStrings,readStrings} from './fmdlstr.js';
import {controls,applyMorph} from './morph.js';
import {Ftex} from './ftex.js';
import {makeTexture} from './texture.js';
import {renderFront} from './render.js';

const norm=p=>p.replace(/\\/g,'/');
/** files: Map path->Uint8Array (isi zip template). Mengembalikan info template. */
export function analyzeTemplate(files){
  const paths=[...files.keys()].map(norm);
  const fpks=paths.filter(p=>/(^|\/)#Win\/face\.fpk$/i.test(p));
  if(!fpks.length) throw new Error('face.fpk tidak ditemukan di zip template');
  const fpk=fpks.find(p=>/2021/.test(p))||fpks[0];           // utamakan folder PES 2021
  const idDir=fpk.replace(/\/#Win\/face\.fpk$/i,'');
  const root=idDir.split('/').slice(0,-1).join('/');
  const texRe=/\/sourceimages\/#windx11\/face_bsm_alp\.ftex$/i;
  const tex=paths.find(p=>texRe.test(p)&&(!root||p.startsWith(root+'/')));
  if(!tex) throw new Error('face_bsm_alp.ftex tidak ditemukan di zip template');
  const nameDir=tex.replace(texRe,'');
  return {fpk,tex,idDir,nameDir,oldName:nameDir.split('/').pop(),oldId:idDir.split('/').pop()};
}

export async function buildFace({files,info,photo,pts,id,name,strength=0.6,keepLips=false}){
  if(!/^\d{3,8}$/.test(id)) throw new Error('ID wajah harus angka (3-8 digit)');
  if(!/^[A-Za-z0-9_ ]{1,40}$/.test(name)) throw new Error('Nama folder: huruf, angka, spasi, garis bawah (maks 40)');
  const get=p=>files.get(p)||[...files].find(([k])=>norm(k)===p)?.[1];
  const entries=readFpk(get(info.fpk));
  const fm=entries.find(e=>e.name==='face_high.fmdl'); if(!fm) throw new Error('face_high.fmdl tidak ada di face.fpk');
  const ctl=controls(pts,strength);
  const morphed={};   // semua model kepala digeser dengan pergeseran yang sama: kulit, rambut, gigi, tulang
  for(const e of entries)if(/\.fmdl$/.test(e.name)){const m=new Fmdl(e.data);applyMorph(m,ctl);morphed[e.name]=m.bytes();}
  const f=new Fmdl(morphed['face_high.fmdl']);
  const rename=d=>replaceInStrings(d,info.oldName,name);
  const out=entries.map(e=>{
    if(!morphed[e.name])return e;
    const d=morphed[e.name];
    return {name:e.name,data:readStrings(d).some(s=>s.includes(info.oldName))?rename(d):d};});
  const newFpk=writeFpk(out);
  const t=await Ftex.read(get(info.tex));
  const tplRGBA=t.decodeRGBA(0);
  const {rgba}=makeTexture(photo,tplRGBA,pts,{keepLips});
  t.replaceRGBA(rgba);
  const texBytes=await t.bytes();
  // susun file keluaran
  const result=[];
  const strip=info.idDir.split('/').slice(0,-2).join('/');           // buang folder pembungkus zip template
  const rel=p=>strip&&p.startsWith(strip+'/')?p.slice(strip.length+1):p;
  for(const [k0,data] of files){
    const k=norm(k0);
    if(k.startsWith(info.idDir+'/')){
      let rest=k.slice(info.idDir.length+1);
      if(rest.startsWith('#Win/face_fpk/'))continue;               // folder ekstrak GzsTool tidak dipakai game
      const np=info.idDir.slice(0,info.idDir.length-info.oldId.length)+id+'/'+rest;
      result.push({path:rel(np),data:rest==='#Win/face.fpk'?newFpk:data});
    }else if(k.startsWith(info.nameDir+'/')){
      const rest=k.slice(info.nameDir.length+1);
      const np=info.nameDir.slice(0,info.nameDir.length-info.oldName.length)+name+'/'+rest;
      result.push({path:rel(np),data:rest.endsWith('face_bsm_alp.ftex')?texBytes:data});
    }
  }
  const preview=renderFront(new Fmdl(newFpk&&out.find(e=>e.name==='face_high.fmdl').data),rgba);
  return {files:result,preview,rgba};
}
