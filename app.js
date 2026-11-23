import {analyzeTemplate,buildFace} from './pipeline.js';
import {mapLandmarks,pointsFromEyes,NAMES} from './landmarks.js';

const $=id=>document.getElementById(id);
const log=m=>{$('log').textContent+=m+'\n';$('log').scrollTop=1e9;};
const status=(m,c='')=>{$('status').textContent=m;$('status').className=c;};
let tpl=null, photo=null, pts=null, lastZip=null, lastName='';
const CDN='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const cap=window.Capacitor, isNative=!!(cap&&cap.isNativePlatform&&cap.isNativePlatform());
const MODEL_CLOUD='https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// ---------- penyimpanan (IndexedDB) ----------
const db=new Promise((res,rej)=>{const r=indexedDB.open('pesface',1);
  r.onupgradeneeded=()=>{r.result.createObjectStore('kv');r.result.createObjectStore('hist',{keyPath:'t'});};
  r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
const tx=async(s,m,f)=>{const d=await db;return new Promise((res,rej)=>{const t=d.transaction(s,m),q=f(t.objectStore(s));t.oncomplete=()=>res(q&&q.result);t.onerror=()=>rej(t.error);});};

// ---------- template ----------
async function loadTemplate(blob){
  const z=await JSZip.loadAsync(blob), files=new Map();
  for(const [p,e] of Object.entries(z.files)) if(!e.dir) files.set(p,await e.async('uint8array'));
  const info=analyzeTemplate(files); tpl={files,info};
  $('tplInfo').textContent='Template siap: '+info.oldName+' (ID '+info.oldId+')';
  refresh();
}
$('tplFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;
  try{await loadTemplate(f);await tx('kv','readwrite',s=>s.put(f,'template'));}catch(err){tpl=null;$('tplInfo').textContent='';status('Template gagal: '+err.message,'err');refresh();}};
(async()=>{try{const b=await tx('kv','readonly',s=>s.get('template'));if(b)await loadTemplate(b);}catch(e){}renderHist();})();

// ---------- foto & titik ----------
const cv=$('cv'),cx=cv.getContext('2d'); let drag=-1, view=null, mode='', taps=[], verified=false;
const gst=(m,c='')=>{$('gstatus').textContent=m;$('gstatus').className=c;};
$('photoFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;
  const bmp=await createImageBitmap(f); const k=Math.min(1,1600/Math.max(bmp.width,bmp.height));
  const w=Math.round(bmp.width*k),h=Math.round(bmp.height*k);
  const oc=document.createElement('canvas');oc.width=w;oc.height=h;const o=oc.getContext('2d');o.drawImage(bmp,0,0,w,h);
  photo={data:o.getImageData(0,0,w,h).data,w,h,src:oc};
  pts=null;verified=false;mode='';taps=[];view={x:0,y:0,w,h};setCanvas();draw();refresh();detect();};
function setCanvas(){cv.width=720;cv.height=Math.round(720*view.h/view.w);}
function zoomToFace(){ if(!pts)return;
  const xs=NAMES.map(n=>pts[n][0]),ys=NAMES.map(n=>pts[n][1]);
  const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  let w=(x1-x0)*1.55,h=(y1-y0)*1.4; const asp=3/4; if(w/h>asp)h=w/asp;else w=h*asp;
  w=Math.min(w,photo.w);h=Math.min(h,photo.h);
  let x=(x0+x1)/2-w/2,y=(y0+y1)/2-h/2; x=Math.max(0,Math.min(photo.w-w,x));y=Math.max(0,Math.min(photo.h-h,y));
  view={x,y,w,h};setCanvas();draw();}
const toCv=([x,y])=>[(x-view.x)*cv.width/view.w,(y-view.y)*cv.height/view.h];
function draw(){ if(!photo)return; cx.drawImage(photo.src,view.x,view.y,view.w,view.h,0,0,cv.width,cv.height);
  const dot=(p,col)=>{const [x,y]=toCv(p);cx.beginPath();cx.arc(x,y,13,0,7);cx.fillStyle=col;cx.fill();cx.strokeStyle='#04210f';cx.lineWidth=2;cx.stroke();};
  if(pts)NAMES.forEach(n=>dot(pts[n],'rgba(61,220,151,.85)'));
  taps.forEach(p=>dot(p,'rgba(255,200,60,.95)'));
  if(mode==='eyes'){cx.fillStyle='rgba(0,0,0,.65)';cx.fillRect(0,0,cv.width,38);cx.fillStyle='#ffd34d';cx.font='bold 22px sans-serif';
    cx.fillText(taps.length===0?'Ketuk MATA KIRI (sisi kiri layar)':'Ketuk MATA KANAN',12,26);}}
const evPos=e=>{const b=cv.getBoundingClientRect();return [view.x+(e.clientX-b.left)/b.width*view.w,view.y+(e.clientY-b.top)/b.height*view.h];};
cv.onpointerdown=e=>{if(!photo)return;const p=evPos(e);
  if(mode==='eyes'){taps.push(p);
    if(taps.length===2){taps.sort((a,b)=>a[0]-b[0]);pts=pointsFromEyes(taps[0],taps[1]);taps=[];mode='';verified=true;zoomToFace();
      status('Titik awal dibuat dari mata. Geser tiap titik hijau agar pas, lalu Buat wajah.','ok');}
    draw();return;}
  if(!pts)return;
  let best=-1,bd=(view.w/9)**2;
  NAMES.forEach((n,i)=>{const d=(pts[n][0]-p[0])**2+(pts[n][1]-p[1])**2;if(d<bd){bd=d;best=i;}});
  drag=best;if(best>=0)cv.setPointerCapture(e.pointerId);};
cv.onpointermove=e=>{if(drag<0)return;pts[NAMES[drag]]=evPos(e);verified=true;draw();};
cv.onpointerup=()=>{drag=-1;};
function startEyes(){pts=null;taps=[];mode='eyes';view={x:0,y:0,w:photo.w,h:photo.h};setCanvas();draw();status('Ketuk MATA KIRI lalu MATA KANAN pada foto.');}
$('btnReset').onclick=()=>{if(photo)startEyes();};
$('btnView').onclick=()=>{if(!photo)return; if(view.w<photo.w-1){view={x:0,y:0,w:photo.w,h:photo.h};setCanvas();draw();$('btnView').textContent='Perbesar wajah';}else{zoomToFace();$('btnView').textContent='Lihat semua';}};

let landmarker=null;
async function exists(u){try{const r=await fetch(u,{method:'HEAD'});return r.ok;}catch(e){return false;}}
async function getLandmarker(){ if(landmarker)return landmarker;
  const sources=[]; if(await exists('mp/vision_bundle.mjs'))sources.push({base:'mp',model:'face_landmarker.task',local:true});
  sources.push({base:CDN,model:(await exists('face_landmarker.task'))?'face_landmarker.task':MODEL_CLOUD});
  let last='';
  for(const s of sources){
    try{
      const {FaceLandmarker,FilesetResolver}=await import(s.local?'./mp/vision_bundle.mjs':s.base+'/vision_bundle.mjs');
      const fs=await FilesetResolver.forVisionTasks(s.base+'/wasm');
      for(const delegate of ['GPU','CPU']){
        try{landmarker=await FaceLandmarker.createFromOptions(fs,{baseOptions:{modelAssetPath:s.model,delegate},runningMode:'IMAGE',numFaces:1});return landmarker;}
        catch(e){last=(s.local?'lokal ':'CDN ')+delegate+': '+e.message;log('Model gagal ('+last+')');}
      }
    }catch(e){last=(s.local?'lokal: ':'CDN: ')+e.message;log('Muat MediaPipe gagal ('+last+')');}
  }
  throw new Error(last||'model landmark tidak bisa dimuat');
}
async function detect(){ if(!photo)return;
  status('Mendeteksi wajah…');$('btnDetect').disabled=true;mode='';taps=[];
  try{const lm=await getLandmarker();const res=lm.detect(photo.src);
    if(!res.faceLandmarks.length)throw new Error('wajah tidak ditemukan');
    pts=mapLandmarks(res.faceLandmarks[0],photo.w,photo.h);verified=true;zoomToFace();status('Wajah terdeteksi. Periksa titik hijau, geser jika perlu.','ok');}
  catch(e){pts=null;status('Deteksi otomatis GAGAL ('+String(e.message).slice(0,120)+').','err');log('Deteksi: '+e.message);startEyes();
    $('status').textContent='Deteksi otomatis gagal ('+String(e.message).slice(0,80)+'). Ketuk MATA KIRI lalu MATA KANAN pada foto.';$('status').className='err';}
  refresh();}
$('btnDetect').onclick=detect;

// ---------- opsi ----------
$('strength').oninput=e=>$('strVal').textContent=e.target.value;
$('faceId').oninput=e=>{$('faceName').value='FACE_'+e.target.value;};
function refresh(){ $('btnGo').disabled=!(tpl&&photo); $('btnDetect').disabled=!photo; $('btnReset').disabled=!photo; $('btnView').disabled=!photo; }

// ---------- buat wajah ----------
$('btnGo').onclick=async()=>{
  if(!pts||!verified){gst('Tandai titik wajah dulu (langkah 2): deteksi otomatis, atau ketuk kedua mata.','err');return;}
  $('btnGo').disabled=true;$('log').textContent='';gst('Memproses…');
  try{
    await new Promise(r=>setTimeout(r,30));
    const id=$('faceId').value.trim(), name=$('faceName').value.trim();
    const t0=performance.now();
    const r=await buildFace({files:tpl.files,info:tpl.info,photo,pts,id,name,strength:$('strength').value/100,keepLips:$('keepLips').checked});
    log('Selesai '+((performance.now()-t0)/1000).toFixed(1)+' dtk, '+r.files.length+' file');
    const pv=$('pv');pv.style.display='block';pv.width=r.preview.w;pv.height=r.preview.h;
    pv.getContext('2d').putImageData(new ImageData(r.preview.data,r.preview.w,r.preview.h),0,0);
    const z=new JSZip();for(const f of r.files)z.file(f.path,f.data);
    lastZip=await z.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});lastName='face_'+id+'.zip';
    $('btnZip').style.display='block';if(isNative)$('btnShare').style.display='block';gst('Wajah jadi. Unduh ZIP dan tempel ke game di PC.','ok');
    const th=document.createElement('canvas');th.width=96;th.height=128;th.getContext('2d').drawImage(pv,0,0,96,128);
    await tx('hist','readwrite',s=>s.put({t:Date.now(),id,name,thumb:th.toDataURL('image/jpeg',.7),blob:lastZip}));renderHist();
  }catch(e){gst('Gagal: '+e.message,'err');log(e.stack||String(e));}
  refresh();};
const b64=blob=>new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(String(fr.result).split(',')[1]);fr.readAsDataURL(blob);});
async function shareNative(blob,name){const {Filesystem,Share}=cap.Plugins;
  const r=await Filesystem.writeFile({path:name,data:await b64(blob),directory:'CACHE'});
  await Share.share({title:name,files:[r.uri],dialogTitle:'Simpan / kirim '+name});}
async function saveNative(blob,name){const {Filesystem}=cap.Plugins;
  try{await Filesystem.writeFile({path:'PESFace/'+name,data:await b64(blob),directory:'DOCUMENTS',recursive:true});
    gst('Tersimpan: Dokumen/PESFace/'+name,'ok');}
  catch(e){log('Simpan ke Dokumen gagal: '+e.message);gst('Tidak bisa menyimpan langsung, membuka menu bagikan…');await shareNative(blob,name);}}
function download(blob,name){ if(isNative){saveNative(blob,name).catch(e=>gst('Gagal menyimpan: '+e.message,'err'));return;}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},4000);}
$('btnZip').onclick=()=>lastZip&&download(lastZip,lastName);
$('btnShare').onclick=()=>lastZip&&shareNative(lastZip,lastName).catch(e=>gst('Gagal membagikan: '+e.message,'err'));
if(isNative){$('btnZip').textContent='Simpan ZIP ke Dokumen';$('btnShare').dataset.native='1';}
async function renderHist(){
  const all=await tx('hist','readonly',s=>s.getAll())||[]; const h=$('hist');
  if(!all.length){h.innerHTML='<small>Belum ada.</small>';return;}
  h.innerHTML='';all.sort((a,b)=>b.t-a.t).forEach(it=>{
    const d=document.createElement('div');d.className='it';
    d.innerHTML='<img src="'+it.thumb+'"><div class="t"><b>'+it.id+'</b><br><small>'+it.name+' · '+new Date(it.t).toLocaleString('id-ID')+'</small></div>';
    const b1=document.createElement('button');b1.textContent='Unduh';b1.onclick=()=>download(it.blob,'face_'+it.id+'.zip');
    const b2=document.createElement('button');b2.className='s';b2.textContent='Hapus';b2.onclick=async()=>{await tx('hist','readwrite',s=>s.delete(it.t));renderHist();};
    d.append(b1,b2);h.appendChild(d);});
}
window.__app={setPoints:p=>{pts=p;verified=true;mode='';taps=[];zoomToFace();},get pts(){return pts;},get view(){return view;}};
if(!isNative&&'serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
