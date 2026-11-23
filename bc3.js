// BC3 (DXT5): decode dan encode sederhana (bounding-box), RGBA 8-bit
const c565=(r,g,b)=>((r>>3)<<11)|((g>>2)<<5)|(b>>3);
function from565(c){const r=(c>>11)&31,g=(c>>5)&63,b=c&31;return [(r<<3)|(r>>2),(g<<2)|(g>>4),(b<<3)|(b>>2)];}

export function decodeBC3(data,w,h){
  const out=new Uint8ClampedArray(w*h*4), bw=Math.ceil(w/4), bh=Math.ceil(h/4);
  const dv=new DataView(data.buffer,data.byteOffset,data.byteLength);
  const al=new Uint8Array(8), pal=[[0,0,0],[0,0,0],[0,0,0],[0,0,0]];
  for(let by=0;by<bh;by++)for(let bx=0;bx<bw;bx++){
    const o=(by*bw+bx)*16;
    const a0=data[o],a1=data[o+1]; al[0]=a0;al[1]=a1;
    if(a0>a1)for(let i=1;i<7;i++)al[i+1]=((7-i)*a0+i*a1)/7|0;
    else{for(let i=1;i<5;i++)al[i+1]=((5-i)*a0+i*a1)/5|0;al[6]=0;al[7]=255;}
    let abits=0n;for(let i=0;i<6;i++)abits|=BigInt(data[o+2+i])<<BigInt(8*i);
    const c0=dv.getUint16(o+8,true),c1=dv.getUint16(o+10,true);
    pal[0]=from565(c0);pal[1]=from565(c1);
    if(c0>c1){for(let k=0;k<3;k++){pal[2][k]=(2*pal[0][k]+pal[1][k])/3|0;pal[3][k]=(pal[0][k]+2*pal[1][k])/3|0;}}
    else{for(let k=0;k<3;k++){pal[2][k]=(pal[0][k]+pal[1][k])>>1;pal[3][k]=0;}}
    const cbits=dv.getUint32(o+12,true);
    for(let py=0;py<4;py++)for(let px=0;px<4;px++){
      const x=bx*4+px,y=by*4+py; if(x>=w||y>=h)continue;
      const i=py*4+px, ci=(cbits>>>(2*i))&3, ai=Number((abits>>BigInt(3*i))&7n), q=(y*w+x)*4;
      out[q]=pal[ci][0];out[q+1]=pal[ci][1];out[q+2]=pal[ci][2];out[q+3]=al[ai];
    }
  }
  return out;
}

export function encodeBC3(rgba,w,h){
  const bw=Math.ceil(w/4), bh=Math.ceil(h/4), out=new Uint8Array(bw*bh*16);
  const px=new Array(16);
  for(let by=0;by<bh;by++)for(let bx=0;bx<bw;bx++){
    const o=(by*bw+bx)*16;
    let amin=255,amax=0,mn=[255,255,255],mx=[0,0,0];
    for(let i=0;i<16;i++){
      const x=Math.min(bx*4+(i&3),w-1), y=Math.min(by*4+(i>>2),h-1), q=(y*w+x)*4;
      px[i]=[rgba[q],rgba[q+1],rgba[q+2],rgba[q+3]];
      if(px[i][3]<amin)amin=px[i][3]; if(px[i][3]>amax)amax=px[i][3];
      for(let k=0;k<3;k++){if(px[i][k]<mn[k])mn[k]=px[i][k];if(px[i][k]>mx[k])mx[k]=px[i][k];}
    }
    // alpha
    out[o]=amax;out[o+1]=amin;
    const alv=[amax,amin];for(let i=1;i<7;i++)alv.push(((7-i)*amax+i*amin)/7|0);
    let abits=0n;
    for(let i=0;i<16;i++){
      let best=0,bd=1e9;
      if(amax!==amin)for(let k=0;k<8;k++){const dd=Math.abs(px[i][3]-alv[k]);if(dd<bd){bd=dd;best=k;}}
      abits|=BigInt(best)<<BigInt(3*i);
    }
    for(let i=0;i<6;i++)out[o+2+i]=Number((abits>>BigInt(8*i))&0xffn);
    // warna: inset bbox
    const ins=k=>Math.round((mx[k]-mn[k])/16);
    const lo=[0,1,2].map(k=>mn[k]+ins(k)), hi=[0,1,2].map(k=>mx[k]-ins(k));
    let e0=c565(hi[0],hi[1],hi[2]), e1=c565(lo[0],lo[1],lo[2]);
    if(e0<e1){const t=e0;e0=e1;e1=t;}
    let cbits=0;
    if(e0===e1){cbits=0;}
    else{
      const p0=from565(e0),p1=from565(e1);
      const pal=[p0,p1,[0,1,2].map(k=>(2*p0[k]+p1[k])/3|0),[0,1,2].map(k=>(p0[k]+2*p1[k])/3|0)];
      for(let i=0;i<16;i++){
        let best=0,bd=1e12;
        for(let c=0;c<4;c++){const dr=px[i][0]-pal[c][0],dg=px[i][1]-pal[c][1],db=px[i][2]-pal[c][2],dd=dr*dr+dg*dg+db*db;if(dd<bd){bd=dd;best=c;}}
        cbits|=best<<(2*i);
      }
    }
    out[o+8]=e0&255;out[o+9]=e0>>8;out[o+10]=e1&255;out[o+11]=e1>>8;
    out[o+12]=cbits&255;out[o+13]=(cbits>>>8)&255;out[o+14]=(cbits>>>16)&255;out[o+15]=(cbits>>>24)&255;
  }
  return out;
}

// kecilkan RGBA (box filter) ke w2 x h2
export function downscale(rgba,w,h,w2,h2){
  const out=new Uint8ClampedArray(w2*h2*4);
  for(let y=0;y<h2;y++)for(let x=0;x<w2;x++){
    const x0=Math.floor(x*w/w2),x1=Math.max(x0+1,Math.floor((x+1)*w/w2)),y0=Math.floor(y*h/h2),y1=Math.max(y0+1,Math.floor((y+1)*h/h2));
    let r=0,g=0,b=0,a=0,n=0;
    for(let yy=y0;yy<y1;yy++)for(let xx=x0;xx<x1;xx++){const q=(yy*w+xx)*4;r+=rgba[q];g+=rgba[q+1];b+=rgba[q+2];a+=rgba[q+3];n++;}
    const o=(y*w2+x)*4;out[o]=r/n;out[o+1]=g/n;out[o+2]=b/n;out[o+3]=a/n;
  }
  return out;
}
