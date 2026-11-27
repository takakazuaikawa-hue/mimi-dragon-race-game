/* Pupil centres measured in the racing body and frontal portrait (left eye).
   Both orthographic projections address the same opaque skull surface. */
const RC_CHASE_EYES={
  akane:[.845,.36,.325,.58],
  arashi:[.845,.36,.315,.60],
  banju:[.846,.54,.335,.59],
  baran:[.865,.52,.27,.59],
  benio:[.845,.36,.30,.59],
  chiri:[.854,.49,.344,.65],
  enma:[.694,.395,.30,.48],
  fugaku:[.846,.52,.34,.645],
  gando:[.856,.65,.28,.62],
  gekka:[.858,.57,.34,.73],
  glaze:[.846,.66,.318,.66],
  goka:[.845,.43,.313,.65],
  goro:[.846,.52,.315,.53],
  gozan:[.845,.57,.34,.56],
  guren:[.85,.43,.35,.60],
  hayao:[.845,.36,.33,.63],
  hayate:[.845,.36,.32,.56],
  hibana:[.845,.39,.33,.60],
  kabe:[.83,.48,.335,.53],
  kazemaru:[.845,.36,.305,.55],
  kirari:[.871,.40,.34,.67],
  kogane:[.845,.37,.35,.62],
  konron:[.845,.56,.31,.61],
  miruka:[.86,.66,.31,.66],
  momu:[.855,.38,.31,.64],
  murasame:[.864,.54,.33,.71],
  nagi:[.845,.365,.31,.58],
  phenix:[.89,.79,.368,.75],
  poro:[.793,.466,.295,.64],
  raijin:[.845,.38,.365,.62],
  raika:[.845,.46,.33,.695],
  raiou:[.85,.43,.35,.645],
  reppu:[.865,.37,.335,.62],
  rosso:[.859,.36,.315,.63],
  rubel:[.88,.56,.29,.595],
  sazare:[.86,.43,.33,.645],
  senpu:[.88,.415,.35,.67],
  seram:[.865,.29,.28,.58],
  shakunetsu:[.85,.41,.345,.64],
  shio:[.845,.365,.32,.61],
  shirahae:[.896,.535,.365,.755],
  sora:[.845,.37,.33,.625],
  souten:[.845,.50,.365,.69],
  stella:[.845,.385,.315,.63],
  susu:[.845,.355,.33,.62],
  taiga:[.80,.635,.30,.565],
  tenku:[.845,.365,.32,.665],
  tsumuji:[.858,.43,.325,.655],
  yoi:[.877,.515,.358,.765],
  yomi:[.889,.455,.377,.73],
  yugiri:[.86,.38,.34,.67],
  yumeji:[.858,.55,.36,.705]
};


// Poro's bow hangs below the chin and its two curved horns rise from separate
// temples. Keep those pieces outside the cheek's side-to-front projection.
function rcPoroProfileTrim(T, body, canvas, rect, b, k){
  const ox=rect.x-b.x,oy=rect.y-b.y,ctx=canvas.getContext("2d");
  const layer=ctx.getImageData(ox,oy,rect.w,rect.h),d=layer.data;
  for(let y=0;y<rect.h;y++)for(let x=0;x<rect.w;x++){
    const i=4*(y*rect.w+x),u=x/rect.w,v=y/rect.h;
    const horn=v<.39 && u>.39 && u<.80 && d[i]>d[i+2]*1.04;
    const silk=u>.48 && u<.88 && v>.58 && v<.90 && d[i]>1.32*d[i+2] && d[i]>1.25*d[i+1];
    if(horn || silk)d[i+3]=0;
  }
  ctx.putImageData(layer,ox,oy);
  // Two gathered silk loops, a pinched knot and two short notched ends.
  const ribbon=new T.Group();body.add(ribbon);
  ribbon.rotation.y=.44;
  ribbon.position.set((ox+.665*rect.w-b.w/2)*k,(b.h-oy-.716*rect.h)*k,0);
  const material=new T.MeshStandardMaterial({color:0xab2826,roughness:.56,side:T.DoubleSide});
  const points=[],indices=[];
  function strip(rows,cols,sample){
    const start=points.length/3;
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
      points.push(...sample(i/cols,j/rows));
      if(i && j){const p=start+j*(cols+1)+i;indices.push(p-cols-2,p-1,p,p-cols-2,p,p-cols-1);}
    }
  }
  for(const sign of [-1,1]){
    strip(5,20,(u,v)=>{
      const lobe=Math.sin(Math.PI*u),fold=Math.sin(2*Math.PI*u);
      return [.20*fold-.14*lobe,(v-.5)*(.11+.32*lobe)+.13*lobe,sign*(.055+.49*lobe)];
    });
    strip(8,4,(u,v)=>[.028+.13*v-.11*v*v+.04*Math.sin(Math.PI*u),
      -.04-.34*v+.075*v*Math.max(0,1-2*Math.abs(u-.5)),sign*(.025+.16*v+.12*u)]);
  }
  const geo=new T.BufferGeometry();geo.setAttribute("position",new T.Float32BufferAttribute(points,3));
  geo.setIndex(indices);geo.computeVertexNormals();ribbon.add(new T.Mesh(geo,material));
  const knot=new T.Mesh(new T.SphereGeometry(.125,12,8),material);
  knot.position.x=.035;knot.scale.set(.85,1,.83);ribbon.add(knot);
}

function rcPoroCrown(T,head,img,rect,b,k,texture){
  const clean=document.createElement("canvas");clean.width=img.width;clean.height=img.height;
  const ctx=clean.getContext("2d",{willReadFrequently:true});ctx.drawImage(img,0,0);
  const pixels=ctx.getImageData(0,0,img.width,img.height),rgba=pixels.data;
  const hornRows=[];
  for(let y=0;y<img.height*.37;y++)for(let x=0;x<img.width;x++){
    const i=4*(y*img.width+x);
    if(rgba[i+3]>60 && rgba[i]>1.08*rgba[i+2] && rgba[i]>1.04*rgba[i+1]){
      if(x<img.width*.43){
        const run=hornRows[y]||(hornRows[y]=[x,x]);run[1]=x;
      }
      rgba[i+3]=0;
    }
  }
  ctx.putImageData(pixels,0,0);
  // A horn bud tapers up and back from inside each temple. Round the end by
  // bringing the rings to a tiny cap; fine bands follow the curved surface.
  const pos=[],uv=[],indices=[],steps=16,rings=14;
  const width=rect.h*k*.68*img.width/img.height;
  for(const side of [-1,1]){
    const start=pos.length/3;
    for(let j=0;j<=rings;j++){
      const t=j/rings,r=.084*rect.h*k*Math.pow(1-t,.63)*(1+.028*Math.cos(t*22));
      const row=Math.round(img.height*(.30-.272*t));
      const [left,right]=hornRows[row] || [img.width*.10,img.width*.19];
      for(let i=0;i<=steps;i++){
        const a=i/steps*2*Math.PI;
        pos.push((rect.x-b.x+(.621-.122*t)*rect.w-b.w/2)*k+r*Math.cos(a),
          (b.h-rect.y+b.y-(.317-.295*t)*rect.h)*k,
          side*(width*(.215+.09*t-.029*t*t)+r*Math.sin(a)));
        const u=(left+(right-left)*(.5+.44*Math.cos(a)))/img.width;
        uv.push(side<0?1-u:u,1-row/img.height);
        if(i && j){const p=start+j*(steps+1)+i;indices.push(p-steps-2,p-1,p,p-steps-2,p,p-steps-1);}
      }
    }
  }
  const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(pos,3));
  g.setAttribute("uv",new T.Float32BufferAttribute(uv,2));g.setIndex(indices);
  head.add(new T.Mesh(g,new T.MeshBasicMaterial({map:texture(img),side:T.DoubleSide})));
  return clean;
}

// Register Poro's short muzzle and broad forehead on a closed skull. The
// two camera projections share the eye line; neither silhouette cuts holes
// in the cheek when the camera crosses a temple.
function rcPoroHead(T,body,img,rect,b,k,flank,texture){
  const neck=new T.Group();body.add(neck);
  const front=rcPoroCrown(T,neck,img,rect,b,k,texture);
  // Side height, back, nose, frontal half-width and frontal V, in the original side and front artwork.
  const profile=[
    [0.08,0.745,0.753,0.025,0.083],
    [0.122,0.686,0.811,0.17,0.16],
    [0.175,0.619,0.85,0.27,0.23],
    [0.235,0.562,0.886,0.35,0.31],
    [0.32,0.521,0.925,0.42,0.41],
    [0.403,0.5,0.947,0.465,0.53],
    [0.466,0.492,0.955,0.475,0.64],
    [0.53,0.512,0.966,0.47,0.706],
    [0.584,0.537,0.985,0.452,0.777],
    [0.625,0.567,0.994,0.417,0.83],
    [0.665,0.624,0.968,0.356,0.9],
    [0.7,0.71,0.925,0.23,0.968],
    [0.715,0.79,0.874,0.078,0.992],
    [0.718,0.826,0.854,0.015,0.998]
  ];
  const positions=[],temple=[],sideUV=[],frontUV=[],indices=[];
  const steps=56,bands=40,width=rect.h*k*.68*img.width/img.height;
  for(let j=0;j<=bands;j++){
    const t=j/bands*(profile.length-1),lo=Math.min(profile.length-2,Math.floor(t));
    const [y,back,nose,span,v]=profile[lo].map((n,i)=>T.MathUtils.lerp(n,profile[lo+1][i],t-lo));
    for(let i=0;i<=steps;i++){
      const a=2*Math.PI*i/steps,forward=Math.cos(a),side=Math.sin(a);
      const templeX=back+.30*(nose-back);
      const u=forward>=0 ? nose-(nose-templeX)*Math.pow(Math.abs(side),.98) :
        back+(templeX-back)*(1+forward);
      const z=side*width*span;
      positions.push((rect.x-b.x+u*rect.w-b.w/2)*k,(b.h-rect.y+b.y-y*rect.h)*k,z);
      // Wrap one portrait around the muzzle. The side painting joins it
      // behind the eyes, so a turn can never expose a second pair of pupils.
      const bearing=Math.acos(T.MathUtils.clamp(forward,-1,1));
      temple.push(T.MathUtils.smoothstep(bearing,.79,1.46));
      sideUV.push((rect.x-b.x+u*rect.w)/b.w,1-(rect.y-b.y+y*rect.h)/b.h);
      frontUV.push(.5-side*span,1-v);
      if(i && j){const q=positions.length/3-1;indices.push(q-steps-2,q-1,q,q-steps-2,q,q-steps-1);}
    }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute("position",new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute("uv",new T.Float32BufferAttribute(frontUV,2));
  geometry.setAttribute("profileUv",new T.Float32BufferAttribute(sideUV,2));
  geometry.setAttribute("temple",new T.Float32BufferAttribute(temple,1));geometry.setIndex(indices);
  const mix={value:0},material=new T.MeshBasicMaterial({map:texture(front),side:T.DoubleSide});
  material.onBeforeCompile=s=>{
    s.uniforms.profileMap={value:flank.map};s.uniforms.frontTurn=mix;
    s.vertexShader="attribute vec2 profileUv; attribute float temple; varying float atTemple; varying vec2 sideUv;\n"+s.vertexShader.replace("#include <uv_vertex>","#include <uv_vertex>\nsideUv=profileUv;atTemple=temple;");
    s.fragmentShader="uniform sampler2D profileMap; uniform float frontTurn; varying float atTemple; varying vec2 sideUv;\n"+s.fragmentShader.replace("#include <map_fragment>",[
      "vec4 side=texture2D(profileMap,sideUv), front=texture2D(map,vMapUv);",
      "vec3 skin=vec3(.285,.120,.39);",
      "vec3 cheek=mix(skin,side.rgb,side.a);",
      "diffuseColor.rgb*=mix(cheek,mix(skin,front.rgb,front.a),smoothstep(.40,.77,frontTurn)*(1.-atTemple));"
    ].join("\n"));
  };
  // Hide the painted side head only after the portrait is ready.
  const configure=flank.onBeforeCompile;
  flank.onBeforeCompile=function(s,renderer){
    configure.call(this,s,renderer);
    s.uniforms.poroRect={value:new T.Vector4((rect.x-b.x)/b.w,(rect.y-b.y)/b.h,rect.w/b.w,rect.h/b.h)};
    s.fragmentShader="uniform vec4 poroRect;\n"+s.fragmentShader.replace("#include <alphatest_fragment>",
      "vec2 p=(vec2(vMapUv.x,1.-vMapUv.y)-poroRect.xy)/poroRect.zw; if(p.y<.722 && p.x>mix(.405,.59,smoothstep(.25,.70,p.y)))discard;\n#include <alphatest_fragment>");
  };
  flank.needsUpdate=true;
  const face=new T.Mesh(geometry,material);neck.add(face);
  neck.position.set((rect.x-b.x+.56*rect.w-b.w/2)*k,(b.h-rect.y+b.y-.55*rect.h)*k,0);
  for(const part of neck.children)part.position.sub(neck.position);
  face.userData.neck=neck;face.userData.mix=mix;
  return face;
}

function rcChaseHead(T,id,body,img,canvas,rect,b,k,depth,nx,ny,flank,texture){
  if(id==="poro")return rcPoroHead(T,body,img,rect,b,k,flank,texture);
  const [eyeX,eyeY,leftEye,eyeV]=RC_CHASE_EYES[id];
  const [,cy,relativeHeight,noseV]=RC_FRONT_HEADS[id];
  const cut=eyeX-.215;
  const resolution=192;
  function mask(source,x,y,w,h){
    const tile=document.createElement("canvas");tile.width=tile.height=resolution;
    const ctx=tile.getContext("2d",{willReadFrequently:true});
    ctx.drawImage(source,x,y,w,h,0,0,resolution,resolution);
    return ctx.getImageData(0,0,resolution,resolution).data;
  }
  const side=mask(canvas,rect.x-b.x,rect.y-b.y,rect.w,rect.h);
  const front=mask(img,0,0,img.width,img.height);
  const clamp=T.MathUtils.clamp,lerp=T.MathUtils.lerp;
  const row=y=>clamp(Math.round(y*(resolution-1)),0,resolution-1);
  const ends=[],widths=[];
  for(let j=0;j<resolution;j++){
    let end=cut,half=0;
    for(let x=0;x<resolution;x++){
      const index=4*(j*resolution+x)+3,u=x/(resolution-1);
      if(side[index]>75 && u>cut)end=u;
      if(front[index]>65)half=Math.max(half,Math.abs(u-.5));
    }
    ends.push(end);widths.push(Math.max(.004,half));
  }
  const top=Math.min(eyeY-.055,Math.max(0,cy-relativeHeight*.5));
  let bottom=eyeY;
  for(let j=row(eyeY);j<resolution;j++)if(ends[j]>eyeX-.045)bottom=j/(resolution-1);
  bottom=clamp(bottom,eyeY+.08,1);
  let noseY=eyeY+(bottom-eyeY)*.55,best=-Infinity;
  for(let j=row(eyeY+.01);j<=row(bottom-.01);j++){
    const v=j/(resolution-1),score=ends[j]-.07*Math.abs((v-eyeY)/(bottom-eyeY)-.55);
    if(score>best){best=score;noseY=v;}
  }
  noseY=clamp(noseY,eyeY+.006,bottom-.006);
  const bridge=cut+.034;
  const endEye=Math.max(eyeX+.004,ends[row(eyeY)]);
  const qEye=clamp((.5-leftEye)/widths[row(eyeV)],.10,.96);
  const exponent=clamp(Math.log(clamp((endEye-eyeX)/(endEye-bridge),.008,.98))/Math.log(qEye),.35,7);
  const width=rect.h*k*relativeHeight*img.width/img.height;
  const pos=[],turnPose=[],uv=[],sideUV=[],rim=[],cheek=[],idx=[],rings=48,steps=40,cols=steps+3;
  for(let j=0;j<=rings;j++){
    const v=j/rings;
    const y=v<eyeV?lerp(top,eyeY,v/eyeV):v<noseV?lerp(eyeY,noseY,(v-eyeV)/(noseV-eyeV)):lerp(noseY,bottom,(v-noseV)/(1-noseV));
    const end=ends[row(y)],extent=widths[row(v)],join=Math.min(bridge,end);
    for(let i=-1;i<=steps+1;i++){
      const skirt=i<0||i>steps;
      const q=Math.sin((clamp(i/steps,0,1)-.5)*Math.PI);
      const x=skirt?cut:end-(end-join)*Math.pow(Math.abs(q),exponent);
      const sx=(rect.x-b.x+x*rect.w)/b.w,sy=(rect.y-b.y+y*rect.h)/b.h;
      const base=depth[clamp(Math.round(sy*ny),0,ny)*(nx+1)+clamp(Math.round(sx*nx),0,nx)];
      // Rubel's long, low neck blends into a deeper cheek. Keep the seam and
      // tip of the nose registered to the side art and the finish line.
      const cheekLift = id === "rubel" ? .20 * T.MathUtils.smoothstep(x, cut, eyeX) * (eyeY-y) : 0;
      pos.push((sx-.5)*b.w*k,(1-sy)*b.h*k+cheekLift*rect.h*k,-q*(skirt?base:extent*width));
      // Correct the length foreshortening of the illustrated muzzle on a turn.
      // The neck seam stays fixed. Both views still share one depth surface.
      const muzzle=Math.max(0,1-Math.pow((v-noseV)/.58,2));
      // The short snout on Rubel's portrait sits close to the brow. Too much
      // forward relief hides the eyes when seen from above the leaders.
      const faceX=eyeX+.045+(id==="rubel"?.046:.078)*muzzle-.085*q*q;
      const faceY=eyeY+(v-eyeV)*relativeHeight-(id==="rubel"?.032:0);
      turnPose.push(skirt?0:(faceX-x)*rect.w*k,skirt?0:(y-cheekLift-faceY)*rect.h*k,0);
      uv.push(.5+q*extent,1-v);sideUV.push(sx,1-sy);rim.push(skirt?1:0);cheek.push(Math.abs(q));
      if(j && i>=0){const a=pos.length/3-1;idx.push(a-cols-1,a-1,a,a-cols-1,a,a-cols);}
    }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute("position",new T.Float32BufferAttribute(pos,3));
  geometry.setAttribute("turnPose",new T.Float32BufferAttribute(turnPose,3));
  geometry.setAttribute("uv",new T.Float32BufferAttribute(uv,2));
  geometry.setAttribute("flankUv",new T.Float32BufferAttribute(sideUV,2));
  geometry.setAttribute("cheek",new T.Float32BufferAttribute(cheek,1));
  geometry.setAttribute("neck",new T.Float32BufferAttribute(rim,1));geometry.setIndex(idx);
  const mix={value:0};
  const material=new T.MeshBasicMaterial({map:texture(img),side:T.DoubleSide});
  material.onBeforeCompile=s=>{
    s.uniforms.flankMap={value:flank.map};s.uniforms.frontMix=mix;
    s.vertexShader="uniform float frontMix; attribute vec3 turnPose; attribute vec2 flankUv; attribute float neck; attribute float cheek; varying float flankAmount; varying vec2 sideUv; varying float seam;\n"+s.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\ntransformed+=turnPose*frontMix;").replace("#include <uv_vertex>","#include <uv_vertex>\nsideUv=flankUv; seam=neck; flankAmount=cheek;");
    s.fragmentShader="uniform sampler2D flankMap; uniform float frontMix; varying float flankAmount; varying vec2 sideUv; varying float seam;\n"+s.fragmentShader.replace("#include <map_fragment>",[
      "vec4 profile=texture2D(flankMap,sideUv), portrait=texture2D(map,vMapUv);",
      // Reveal the nose first and the outside cheek last. The narrow
      // overlap keeps individual scales, pupils and nostrils legible.
      "float threshold=.20+.58*flankAmount;",
      "float blend=smoothstep(threshold-.11,threshold+.11,frontMix)*(1.0-seam);",
      "float a=mix(profile.a,portrait.a,blend); if(a<.36)discard;",
      "diffuseColor.rgb*=mix(profile.rgb*profile.a,portrait.rgb*portrait.a,blend)/max(.001,a);"
    ].join("\n"));
  };
  const margin=new T.Vector3((rect.x-b.x+cut*rect.w)/b.w,1-(rect.y-b.y+bottom*rect.h)/b.h,1-(rect.y-b.y+top*rect.h)/b.h);
  const configureBody=flank.onBeforeCompile;
  flank.onBeforeCompile=function(s,renderer){
    configureBody.call(this,s,renderer);
    s.uniforms.headCut={value:margin};
    s.fragmentShader="uniform vec3 headCut;\n"+s.fragmentShader.replace("#include <alphatest_fragment>","if(vMapUv.x>=headCut.x && vMapUv.y>=headCut.y && vMapUv.y<=headCut.z)discard;\n#include <alphatest_fragment>");
  };
  flank.needsUpdate=true;
  const head=new T.Mesh(geometry,material);head.userData.mix=mix;body.add(head);return head;
}
