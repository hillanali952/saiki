// Pratinjau depan ortografis (mesh leher + kulit wajah) dengan tekstur lewat UV
export function renderFront(f,rgba,{meshes=[0,2],S=640}={}){
  const XR=[-0.11,0.11],YR=[1.50,1.80], sc=S/(YR[1]-YR[0]), W=Math.round((XR[1]-XR[0])*sc);
  const img=new Uint8ClampedArray(W*S*4), zb=new Float32Array(W*S).fill(-1e9);
  for(let i=0;i<W*S;i++){img[4*i]=24;img[4*i+1]=24;img[4*i+2]=24;img[4*i+3]=255;}
  for(const mi of meshes){
    const P=f.positions(mi), UV=f.uv(mi), I=f.indices(mi);
    for(let t=0;t<I.length;t+=3){
      const a=I[t],b=I[t+1],c=I[t+2];
      const X=[a,b,c].map(v=>(P[3*v]-XR[0])*sc), Y=[a,b,c].map(v=>(YR[1]-P[3*v+1])*sc);
      const x0=Math.max(0,Math.floor(Math.min(...X))),x1=Math.min(W-1,Math.ceil(Math.max(...X)));
      const y0=Math.max(0,Math.floor(Math.min(...Y))),y1=Math.min(S-1,Math.ceil(Math.max(...Y)));
      const d=(Y[1]-Y[2])*(X[0]-X[2])+(X[2]-X[1])*(Y[0]-Y[2]); if(Math.abs(d)<1e-9)continue;
      for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
        const l1=((Y[1]-Y[2])*(x-X[2])+(X[2]-X[1])*(y-Y[2]))/d, l2=((Y[2]-Y[0])*(x-X[2])+(X[0]-X[2])*(y-Y[2]))/d, l3=1-l1-l2;
        if(l1<0||l2<0||l3<0)continue;
        const z=l1*P[3*a+2]+l2*P[3*b+2]+l3*P[3*c+2], q=y*W+x; if(z<=zb[q])continue; zb[q]=z;
        const u=l1*UV[2*a]+l2*UV[2*b]+l3*UV[2*c], v=l1*UV[2*a+1]+l2*UV[2*b+1]+l3*UV[2*c+1];
        const tx=Math.min(1023,Math.max(0,(u*1024)|0)), ty=Math.min(1023,Math.max(0,(v*1024)|0)), o=(ty*1024+tx)*4;
        img[4*q]=rgba[o];img[4*q+1]=rgba[o+1];img[4*q+2]=rgba[o+2];
      }
    }
  }
  return {data:img,w:W,h:S};
}
