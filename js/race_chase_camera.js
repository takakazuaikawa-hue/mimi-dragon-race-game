/* Orbit camera for the race broadcast. Coordinates are metres within a scaled
   model of the course. The broadcast timeline remains the position authority. */
// Attachment coordinates in each individual body cutout. X and Y locate the
// head centre; height spans chin to horn tip. Nose Y is measured in the front art.
const RC_FRONT_HEADS = {
  akane:[.84,.30,.59,.75], arashi:[.84,.30,.61,.75], banju:[.84,.46,.66,.79],
  baran:[.88,.51,.60,.71], benio:[.84,.30,.60,.76], chiri:[.84,.36,.70,.75],
  enma:[.74,.40,.80,.71], fugaku:[.85,.48,.45,.71], gando:[.85,.64,.55,.73],
  gekka:[.85,.36,.72,.82], glaze:[.85,.48,.96,.81], goka:[.84,.36,.60,.75],
  goro:[.86,.55,.48,.74], gozan:[.86,.56,.47,.74], guren:[.84,.36,.72,.75],
  hayao:[.84,.30,.61,.75], hayate:[.84,.33,.66,.72], hibana:[.84,.30,.59,.75],
  kabe:[.85,.49,.72,.69], kazemaru:[.84,.29,.61,.74], kirari:[.84,.32,.60,.75],
  kogane:[.84,.30,.59,.75], konron:[.85,.58,.41,.70], miruka:[.85,.46,.80,.75],
  momu:[.86,.35,.69,.74], murasame:[.83,.35,.71,.79], nagi:[.84,.29,.59,.75],
  phenix:[.84,.50,1.00,.84], poro:[.78,.35,.70,.78], raijin:[.84,.31,.59,.79],
  raika:[.82,.32,.65,.78], raiou:[.83,.32,.65,.80], reppu:[.84,.29,.56,.73],
  rosso:[.86,.34,.59,.75], rubel:[.87,.52,.52,.74], sazare:[.84,.31,.62,.74],
  senpu:[.84,.32,.60,.73], seram:[.89,.34,.52,.76], shakunetsu:[.83,.35,.70,.76],
  shio:[.85,.29,.58,.74], shirahae:[.85,.34,.67,.80], sora:[.84,.29,.60,.75],
  souten:[.85,.34,.68,.79], stella:[.84,.31,.62,.80], susu:[.84,.33,.65,.74],
  taiga:[.85,.63,.69,.76], tenku:[.84,.30,.60,.75], tsumuji:[.84,.32,.62,.75],
  yoi:[.85,.34,.68,.81], yomi:[.85,.34,.68,.80], yugiri:[.84,.34,.64,.79],
  yumeji:[.82,.35,.69,.77]
};

function rcLoadRaceFronts(dragons){
  const images=new Map();
  for(const {id} of dragons){
    if(!RC_FRONT_HEADS[id])continue;
    const img=new Image();
    img.src="images/dragons_front/"+id+".webp"+(id==="poro"?"?v=3":"");
    images.set(id,img);
  }
  return images;
}

function rcChaseCamera(race, dragons, lanes, flight, portraits=rcLoadRaceFronts(dragons)) {
  const T = window.THREE;
  const renderer = new T.WebGLRenderer({antialias:true,alpha:false});
  renderer.setPixelRatio(1);
  renderer.outputColorSpace=T.SRGBColorSpace;
  const scene=new T.Scene(), camera=new T.PerspectiveCamera(36,2,.12,1500);
  scene.background=new T.Color(0xbed8dc);
  scene.fog=new T.FogExp2(0xd1cbc0,.0027);
  scene.add(new T.HemisphereLight(0xfff0d6,0xaaa69a,2.1));
  const sun=new T.DirectionalLight(0xffe4be,2.3);sun.position.set(-50,95,50);scene.add(sun);
  const textures=[], materials=new Map();
  function matte(color){
    if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.86}));
    return materials.get(color);
  }
  function mesh(parent,geo,mat,x=0,y=0,z=0){
    const m=new T.Mesh(geo,mat);m.position.set(x,y,z);parent.add(m);return m;
  }
  function box(parent,x,y,z,w,h,d,color){
    return mesh(parent,new T.BoxGeometry(w,h,d),matte(color),x,y,z);
  }
  function cylinder(parent,x,y,z,top,bottom,h,color,n=12){
    return mesh(parent,new T.CylinderGeometry(top,bottom,h,n),matte(color),x,y,z);
  }
  function texture(canvas){
    const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;textures.push(tex);return tex;
  }
  // The broad clock stadium has an apron outside its eight racing lanes.
  const laneSpacing=4.8, width=(race.region==="グランドクロック地域"?9.8:laneSpacing)*4.15;
  const course=rcChaseCourse(race), coursePoint=course.point, distanceAt=course.distance;
  const slug=RC_PARA_SLUG[race.region] || "stadium", grandclock=slug==="grandclock";
  const paint=RC_CHASE_PAINT[slug] || RC_CHASE_PAINT.grandclock;
  const festival=RC_ISLAND_FESTIVALS[race.region];
  const accent=REGION_THEME[race.region]?.accent || "#d4a850";
  const time=rcRaceTime(race), twilight=time==="night" || time==="dusk";
  const haze=twilight ? 0x47405e : time==="sunset" ? 0xaf8484 : race.weather==="fog" ? 0xa4b5b9 : 0xb9bcc2;
  scene.background.setHex(haze);
  scene.fog=new T.FogExp2(haze,race.weather==="fog"?.0021:.00145);
  sun.intensity=twilight?1.1:1.8;
  const shrine=festival?.vista==="shinto",shrineTrees=[];
  function ribbon(inner,outer,bottom,top,material,repeats=1){
    const verts=[],uv=[],coords=[],indices=[];
    for(let i=0;i<=360;i++){
      for(const [side,y,v] of [[inner,bottom,0],[outer,top,1]]){
        const p=coursePoint(course.start+(course.end-course.start)*i/360,side);
        verts.push(p.x,y+p.y,p.z);
        if(material===dirt && (slug==="mistlake" || shrine))coords.push(course.start+(course.end-course.start)*i/360,side);
        if(repeats===1)uv.push(p.x/340+.5,p.z/340+.5);
        else uv.push(i/360*repeats,v);
      }
      if(i){const j=i*2;indices.push(j-2,j-1,j,j-1,j+1,j);}
    }
    const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(verts,3));
    g.setAttribute("uv",new T.Float32BufferAttribute(uv,2));
    if(coords.length)g.setAttribute("roadCoord",new T.Float32BufferAttribute(coords,2));
    g.setIndex(indices);g.computeVertexNormals();
    material.side=T.DoubleSide;return mesh(scene,g,material);
  }
  function crop(img,x,y,w,h) {
    const cv=document.createElement("canvas");
    cv.width=Math.max(2,Math.round(img.width*w));cv.height=Math.max(2,Math.round(img.height*h));
    cv.getContext("2d").drawImage(img,x*img.width,y*img.height,w*img.width,h*img.height,0,0,cv.width,cv.height);
    return texture(cv);
  }
  function mapped(map,repeatX=1,repeatY=1){
    map.wrapS=map.wrapT=T.MirroredRepeatWrapping;
    map.repeat.set(repeatX,repeatY);
    map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    return new T.MeshBasicMaterial({map,side:T.DoubleSide});
  }
  function ring(inner,outer,height,mat){
    const geo=new T.RingGeometry(inner,outer,192);geo.rotateX(-Math.PI/2);
    // Match the verge density across the infield, including the far side of the track.
    const {position,uv}=geo.attributes;
    for(let i=0;i<position.count;i++)uv.setXY(i,position.getX(i)/340+.5,position.getZ(i)/340+.5);
    return mesh(scene,geo,mat,0,height,0);
  }
  const grass=new T.MeshBasicMaterial({color:0x41442c}),dirt=new T.MeshBasicMaterial({color:0xb67a51});
  const valleyFloor=-.08;
  const land=rcChaseLandscape(T,course,width,slug,festival?.vista);
  let cliffMaterial, waterMaterial, waterSurface, reflection;
  const lakeClock={value:0};
  // In the canyon the distant valley floor is already in the landscape painting.
  // A level infield extending to the horizon cuts straight across the escarpments.
  if(grandclock)ring(.01,880,valleyFloor,grass);
  if(shrine){rcShrinePaving(dirt,width);rcShrineCloudVeil(dirt);}
  if(slug==="mistlake")rcWetShoulder(dirt,width,course.distance(1));
  ribbon(-width,width,0,0,dirt);

  const finishPoint=coursePoint(distanceAt(1),0);
  const forward=new T.Vector3(Math.cos(finishPoint.yaw),0,-Math.sin(finishPoint.yaw));
  const normal=new T.Vector3(Math.sin(finishPoint.yaw),0,Math.cos(finishPoint.yaw));
  const finishOrigin=new T.Vector3(finishPoint.x,finishPoint.y,finishPoint.z);
  const nearVerge=new T.Plane().setFromNormalAndCoplanarPoint(normal.clone().negate(),
    finishOrigin.clone().addScaledVector(normal,width+1));
  const checkers=document.createElement("canvas");checkers.width=48;checkers.height=2;
  const checkerPen=checkers.getContext("2d");
  for(let x=0;x<48;x++)for(let y=0;y<2;y++){
    checkerPen.fillStyle=(x+y)%2?"#43382c":"#e1c8a2";checkerPen.fillRect(x,y,1,1);
  }
  const stripe=new T.PlaneGeometry(2*width,.9);
  stripe.rotateX(-Math.PI/2);stripe.rotateY(Math.PI/2+finishPoint.yaw);
  const tile=texture(checkers);tile.magFilter=T.NearestFilter;
  mesh(scene,stripe,new T.MeshBasicMaterial({map:tile}),finishPoint.x,finishPoint.y+.04,finishPoint.z);
  const gate=new T.Group();scene.add(gate);gate.position.set(finishPoint.x,finishPoint.y,finishPoint.z);
  gate.rotation.y=finishPoint.yaw;
  const gold=0xc39548, enamel=0x294348;
  for(const side of [-1,1]){
    const z=side*(width+.7);
    cylinder(gate,0,2.85,z,.21,.36,5.7,enamel);
    for(const y of [.45,3.9,5.35])cylinder(gate,0,y,z,.35,.36,.18,gold);
    mesh(gate,new T.SphereGeometry(.42,16,10),matte(gold),0,5.83,z);
  }
  // Twin standards leave the waterline of a close finish clear in profile.
  const sign=document.createElement("canvas");sign.width=512;sign.height=192;
  const ink=sign.getContext("2d");
  ink.fillStyle="#20383b";ink.fillRect(0,0,512,192);ink.strokeStyle="#ddbd76";ink.lineWidth=9;
  ink.strokeRect(8,8,496,176);ink.fillStyle="#fff1bf";ink.textAlign="center";
  ink.font="bold 88px Georgia";ink.fillText("FINISH",256,106);
  ink.font="bold 32px system-ui";ink.fillText(race.region.replace(/地域$/,""),256,158,470);
  const signMat=new T.MeshBasicMaterial({map:texture(sign),side:T.DoubleSide});
  for(const side of [-1,1]){
    const flag=mesh(gate,new T.PlaneGeometry(5.8,2.18),signMat,0,4.3,side*(width+3.6));
    flag.rotation.y=Math.PI/2;
  }
  let disposed=false, sceneryReady=false;
  const festivalClock={value:0},quietScenery=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  rcIslandAir(T,scene,course,land,slug,festival,festivalClock,texture,time);
  if(slug==="vento" || slug==="lumina")rcWindSurvey3D(T,scene,course,width,slug,festivalClock);
  if(slug==="ringrosso" && !festival)rcRussetArcade(T,scene,course,width);
  if(festival)rcChaseFestival(T,scene,course,width,festival,festivalClock,texture,twilight);
  if(!grandclock){
    // Batch repeated course furniture by geometry. Each object is anchored
    // outside the racing lanes and keeps its position when the camera orbits.
    const batches=new Map(), transform=new T.Object3D(), lamps=[],wires=[];
    const shapes={quartz:rcShoreQuartz(T),lamp:new T.SphereGeometry(.5,8,6),post:new T.BoxGeometry(1,1,1), rock:new T.IcosahedronGeometry(1,1),
      beacon:new T.OctahedronGeometry(1,0), column:new T.CylinderGeometry(.78,1,1,7)};
    function prop(shape,p,lateral,height,w,h,d,color,turn=0,lean=0){
      const pt=coursePoint(distanceAt(p),lateral);
      transform.position.set(pt.x,pt.y+height,pt.z);
      transform.rotation.set(0,pt.yaw+turn,lean);transform.scale.set(w,h,d);transform.updateMatrix();
      if(!batches.has(shape))batches.set(shape,[]);
      batches.get(shape).push([transform.matrix.clone(),new T.Color(color)]);
    }
    for(let i=0;i<=24;i++){
      const p=i/24;
      for(const side of [-1,1]){
        const rim=side*(width+1);
        if(slug!=="mistlake" && slug!=="caldera"){
          prop("post",p,rim,.49,.28,.98,.28,0x635950);
          prop("post",p,rim,1.03,.38,.17,.38,accent);
        }
        // Bridge parapets and piers follow the actual narrowed deck.
        if(race.mid==="crowded_bridge" && p>=1/3 && p<=2/3){
          prop("column",p,rim,-3.9,.9,8,.9,0x514947);
          prop("post",p,rim,1.16,distanceAt(1)/24+.1,.22,.32,0x897866);
        }
        if(i%2)continue;
        const n=i/2, stagger=Math.sin(n*8+side*5);
        const bank=side*(width+29+(1+stagger)*11);
        if(slug==="lumina" || slug==="notte"){
          const u=(distanceAt(p)-course.start)/(course.end-course.start);
          const foot=land.terrain(u,.36+.17*stagger,side);
          const site=coursePoint(distanceAt(p),0);
          const lateral=(foot.x-site.x)*Math.sin(site.yaw)+(foot.z-site.z)*Math.cos(site.yaw);
          for(let k=0;k<3;k++){
            const size=(k===1?5.4:3.3)+(1+stagger);
            const y=Math.max(slug==="lumina"?-5.55:-Infinity,foot.y)-site.y;
            prop("quartz",p+.004*k,lateral+side*k*1.35,y+size*.44,1.15,size*.9,1.3,
              slug==="notte"?[0x9893d0,0xc1a4dc,0x949bd4][k]:[0x78c8d1,0xb7e3dc,0x7db5d5][k],n+k,.16*(k-1));
          }
        }
        if(slug==="mistlake"){
          // Shore lamps follow the warm lights in the broadcast painting.
          const sill=side*(width+1.55);
          prop("column",p,sill,.32,.55,.64,.55,0x393f3e);
          prop("lamp",p,sill,.82,.49,.50,.49,0xffda8c);
          const bulb=coursePoint(distanceAt(p),sill);lamps.push(bulb.x,bulb.y+.82,bulb.z);
          prop("column",p,sill,1.04,.46,.13,.46,0x4b453a);
        }
        if((slug==="ringrosso" || slug==="lapan") && (!festival || festival.sign==="hare")){
          const temple=race.region==="白兎神域地域", royal=race.region==="竜王圏地域";
          const sill=side*(width+(temple?11:8)), top=temple?3.6:royal?6:4.3;
          prop("column",p,sill,(top-17)/2,.40,top+17,.40,slug==="lapan"?0x785341:0x654641);
          prop("post",p,sill,top,temple?4:2.2,.28,.42,temple?0xbea168:0x99714f);
          if(slug==="lapan")prop("beacon",p+.001,sill,top-.8,.72,1,.72,temple?0xffdb94:0xff9c50);
          else prop("post",p+.001,sill,top-1,1.5,1.8,.10,accent);
          if(slug==="lapan" && i<24){
            let previous=null;
            for(let j=0;j<=8;j++){
              const u=j/8,here=p+u/12,pt=coursePoint(distanceAt(here),sill);
              const y=top-.18-1.15*Math.sin(Math.PI*u);
              if(previous)wires.push(...previous,pt.x,pt.y+y,pt.z);
              previous=[pt.x,pt.y+y,pt.z];
              if(j%2)prop("lamp",here,sill,y-.40,.55,.80,.55,
                [0xffbb69,0xe77b49,0xffd89a,0xe78c71][(n+(j-1)/2)%4]);
            }
          }
        }
        if(slug!=="vento" && slug!=="lumina" && (race.mid==="aerial_wind_lane" || race.late==="tailwind_straight") && side===1 && i%4===0){
          prop("post",p,rim+2,2.15,.17,4.3,.17,0x74675d);
          prop("post",p+.002,rim+2,4.05,2.1,.38,.075,accent,0,.12);
        }
        if(race.early==="fire_gate_start" && i<=4 || race.region==="灼熱回廊地域" && i%4===0){
          prop("column",p,rim+side*3,1.4,.7,2.8,.7,0x443431);
          prop("beacon",p,rim+side*3,3.25,.53,1.05,.53,0xff923f,0,.11);
        }
      }
    }
    for(const [shape,items] of batches){
      const material=shape==="quartz"?new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide}):shape==="lamp"?new T.MeshBasicMaterial({color:0xffffff}):shape==="rock" ? (cliffMaterial=new T.MeshLambertMaterial({flatShading:true})) : matte(0xffffff);
      const instances=new T.InstancedMesh(shapes[shape],material,items.length);
      items.forEach(([matrix,color],i)=>{instances.setMatrixAt(i,matrix);instances.setColorAt(i,color);});
      scene.add(instances);
    }
    for(const shape of Object.keys(shapes))if(!batches.has(shape))shapes[shape].dispose();
    if(wires.length){
      const geo=new T.BufferGeometry();geo.setAttribute("position",new T.Float32BufferAttribute(wires,3));
      scene.add(new T.LineSegments(geo,new T.LineBasicMaterial({color:0x554538})));
    }
    if(lamps.length){
      const glow=document.createElement("canvas");glow.width=glow.height=64;
      const p=glow.getContext("2d"),fade=p.createRadialGradient(32,32,0,32,32,32);
      fade.addColorStop(0,"rgba(255,226,156,.96)");fade.addColorStop(.23,"rgba(255,171,79,.48)");
      fade.addColorStop(1,"rgba(238,142,64,0)");p.fillStyle=fade;p.fillRect(0,0,64,64);
      const geo=new T.BufferGeometry();geo.setAttribute("position",new T.Float32BufferAttribute(lamps,3));
      scene.add(new T.Points(geo,new T.PointsMaterial({size:5,map:texture(glow),transparent:true,
        depthWrite:false,blending:T.AdditiveBlending})));
    }
    if(slug==="mistlake" || slug==="lumina"){
      waterMaterial=new T.MeshBasicMaterial();
      const surface=new T.PlaneGeometry(1450,1450,48,48);surface.rotateX(-Math.PI/2);
      waterSurface=mesh(scene,surface,waterMaterial,0,-5.4,0);
    }
  }
  function scenery(){
    const art=rcParaFor(race,null,RC_TIME_DIR[rcRaceTime(race)]);
    if(disposed||!art?.ok||sceneryReady)return;
    sceneryReady=true;
    const [sky,town,near]=art.imgs;
    const sample=document.createElement("canvas");sample.width=sample.height=1;
    const sampler=sample.getContext("2d");
    sampler.drawImage(sky,sky.width*.12,sky.height*.18,sky.width*.62,sky.height*.14,0,0,1,1);
    const [hr,hg,hb]=sampler.getImageData(0,0,1,1).data;
    scene.fog.color.setRGB(hr/255,hg/255,hb/255,T.SRGBColorSpace);
    scene.fog.color.lerp(new T.Color(RC_SKY_CONF[time].haze),.16);
    scene.background.copy(scene.fog.color);
    function groundMap(mat,img,region,repeat){
      mat.color.set(0xffffff);mat.map=crop(img,...region);
      mat.map.wrapS=mat.map.wrapT=T.MirroredRepeatWrapping;
      mat.map.repeat.set(repeat,repeat);mat.map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());mat.needsUpdate=true;
    }
    groundMap(dirt,near,paint.road,112);
    const soil=dirt.map.image.getContext("2d");
    if(grandclock){soil.fillStyle="rgba(149,100,66,.53)";soil.fillRect(0,0,soil.canvas.width,soil.canvas.height);}
    // Restore fine grit lost when the thin strip of painted earth is enlarged.
    const gravel=document.createElement("canvas");gravel.width=gravel.height=256;
    const gc=gravel.getContext("2d");gc.drawImage(soil.canvas,0,0,256,256);
    sampler.drawImage(soil.canvas,0,0,1,1);
    const average=sampler.getImageData(0,0,1,1).data;
    const grains=gc.getImageData(0,0,256,256);let seed=17;
    // The Grand Clock painting shades the dirt from near to far. Baking
    // that lighting into every tile creates broad stripes right across the track.
    const rowLight=new Float32Array(256*3);
    const evenSoil=grandclock || slug==="notte";
    if(evenSoil){
      for(let y=0;y<256;y++)for(let x=0;x<256;x++)for(let k=0;k<3;k++){
        rowLight[y*3+k]+=grains.data[(y*256+x)*4+k]/256;
      }
    }
    for(let i=0;i<grains.data.length;i+=4){
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const shade=(seed/4294967296-.5)*24;
      for(let k=0;k<3;k++){
        const ix=i+k;
        grains.data[ix]=evenSoil ? average[k]+(grandclock?.66:.32)*(grains.data[ix]-rowLight[3*Math.floor(i/1024)+k])+shade*.70 :
          average[k]*.64+grains.data[ix]*.36+shade*.55;
      }
    }
    gc.putImageData(grains,0,0);dirt.map.image=gravel;
    dirt.map.repeat.setScalar(grandclock?130:slug==="notte"?76:36);dirt.map.needsUpdate=true;
    groundMap(grass,near,paint.verge,grandclock?82:105);
    // A verge crop can contain a dark stump or a slash of sunlight. Keep
    // the local grain but remove those baked shadows before tiling it uphill.
    function surfaceAlbedo(map,dayColor){
      const image=map.image,context=image.getContext("2d");
      const frame=context.getImageData(0,0,image.width,image.height),pixels=frame.data;
      let sum=0,squares=0,count=0;
      for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>96){
        const lum=.28*pixels[i]+.54*pixels[i+1]+.18*pixels[i+2];
        sum+=lum;squares+=lum*lum;count++;
      }
      const mean=sum/Math.max(1,count),sd=Math.sqrt(Math.max(1,squares/Math.max(1,count)-mean*mean));
      const tint=new T.Color(dayColor).lerp(scene.fog.color,.20);
      tint.multiplyScalar(time==="night"?.49:time==="dusk"?.64:time==="sunset"?.79:.95).convertLinearToSRGB();
      for(let i=0;i<pixels.length;i+=4){
        const lum=.28*pixels[i]+.54*pixels[i+1]+.18*pixels[i+2];
        const detail=pixels[i+3]>96?T.MathUtils.clamp((lum-mean)/sd,-2,2)*8:0;
        pixels[i]=255*tint.r+detail;pixels[i+1]=255*tint.g+detail;pixels[i+2]=255*tint.b+detail;pixels[i+3]=255;
      }
      context.putImageData(frame,0,0);map.needsUpdate=true;
    }
    surfaceAlbedo(grass.map,slug==="caldera"?0x473531:slug==="mistlake"?0x36444a:land.cliff?0x817260:land.lake?0x667563:0x606b45);
    if(cliffMaterial)groundMap(cliffMaterial,town,slug==="vento"?[.065,.33,.095,.18]:[.18,.45,.24,.26],1);

    if(!grandclock){
      const rock=slug!=="vento" && slug!=="lumina";
      const bank=mapped(rock?crop(near,.12,.71,.26,.23):land.cliff?crop(town,.10,.26,.11,.24):crop(near,...paint.road));
      bank.vertexColors=true;
      if(rock){
        // Keep the painted grains but suppress highlights baked for one view.
        const cv=bank.map.image,pen=cv.getContext("2d");pen.globalAlpha=.43;
        pen.fillStyle=({caldera:"#473239",ringrosso:"#6c3833",lapan:"#584339",notte:"#554466",mistlake:"#47565a"})[slug] || "#525257";pen.fillRect(0,0,cv.width,cv.height);
      }else surfaceAlbedo(bank.map,slug==="vento"?0x736962:land.lake?0x677d72:0x687750);
      if(festival?.vista==="shinto"){
        bank.map=crop(sky,.145,.58,.085,.16);bank.map.wrapS=bank.map.wrapT=T.MirroredRepeatWrapping;
        surfaceAlbedo(bank.map,0x9aa9a6);
        rcShrineCloudVeil(bank);
        surfaceAlbedo(dirt.map,0x899496);
        rcShrineCliffs(T,scene,course,land,bank.map,festivalClock,texture,time,shrineTrees);
      }
      if(slug==="caldera")rcLavaStrata(bank,festivalClock);
      for(const side of [-1,1]){
        mesh(scene,land.vergeGeometry(side),bank);
        mesh(scene,land.geometry(side),bank);
      }
      // Follow both verges with the painted curb colour. It stays legible
      // in rain and indicates the racing corridor through an oblique turn.
      if(slug!=="mistlake" && slug!=="caldera")for(const side of [-1,1]){
        const trim=new T.MeshBasicMaterial({color:new T.Color(accent).multiplyScalar(.68)});
        if(shrine)rcShrineCloudVeil(trim);
        ribbon(side*(width-.28),side*width,.025,.025,trim);
      }
    }
    if(slug==="mistlake" || slug==="caldera"){
      // Unwrap the actual sloping curb into a straight masonry strip. The
      // lake painting has a much steeper vanishing line than the volcanic road.
      const wet=slug==="mistlake", stone=document.createElement("canvas");
      stone.width=512;stone.height=48;
      const paintStone=stone.getContext("2d");
      for(let x=0;x<stone.width;x++){
        const u=wet?.038+.257*x/stone.width:.128+.408*x/stone.width;
        const y=wet?.528-.40*u:.371-.028*Math.sin(u*Math.PI);
        paintStone.drawImage(near,u*near.width,y*near.height,near.width*(wet?.257:.408)/stone.width,
          near.height*(wet?.082:.063),x,0,1,48);
      }
      const edging=mapped(texture(stone));
      const blocks=(course.end-course.start)/(wet?8.5:13);
      for(const side of [-1,1]){
        const lip=side*(width-.10),back=side*(width+.45);
        ribbon(lip,lip,.005,.32,edging,blocks);
        ribbon(lip,back,.32,.29,edging,blocks);
      }
    }
    rcTracksidePlants(T,scene,course,width,slug,land,time,textures,()=>{frozenFrame=null;},()=>disposed,shrineTrees);
    function band(r,bottom,top,map,repeats){
      // Close the panorama with an overlap. Mirroring the entire painting
      // makes identical mountain peaks meet face to face when panning.
      const source=map.image,overlap=Math.max(2,Math.round(source.width*.09));
      const joined=document.createElement("canvas");
      joined.width=source.width-overlap;joined.height=source.height;
      const painter=joined.getContext("2d");
      painter.drawImage(source,-overlap,0);
      const seam=document.createElement("canvas");seam.width=overlap;seam.height=source.height;
      const blend=seam.getContext("2d");blend.drawImage(source,0,0);
      const fade=blend.createLinearGradient(0,0,overlap,0);
      fade.addColorStop(0,"transparent");fade.addColorStop(1,"black");
      blend.globalCompositeOperation="destination-in";blend.fillStyle=fade;blend.fillRect(0,0,overlap,seam.height);
      painter.drawImage(seam,joined.width-overlap,0);
      map.image=joined;map.needsUpdate=true;
      const mat=mapped(map,repeats);
      map.wrapS=T.RepeatWrapping;
      return mesh(scene,new T.CylinderGeometry(r,r,top-bottom,160,1,true),mat,0,(bottom+top)/2,0);
    }
    // Each venue has one main view of its painting. Extend the surrounding
    // ridges around the rest of the circuit without duplicating the active crater.
    if(festival?.vista){
      rcFestivalHorizon(T,scene,art,course,texture);
    }else if(!grandclock){
      rcRegionalHorizon(T,scene,sky,town,course,slug,texture);
      if(waterMaterial)reflection=rcChaseLake(T,waterMaterial,scene.fog.color,lakeClock);
    }else{
      const horizon=band(540,-42,212,crop(sky,0,0,.64,.69),6);
      horizon.material.fog=false;
    }
    // Surround the course with the original village and wooded slopes.
    // Different radii give the village, verge and mountains distinct parallax.
    // Outdoor L1 already includes its distant ridge. Grand Clock has a separate village.
    if(grandclock){
      const ridge=crop(sky,.025,.469,.56,.22);
      const ridgeCanvas=ridge.image, rc=ridgeCanvas.getContext("2d");
      const fade=rc.createLinearGradient(0,0,0,ridgeCanvas.height*.28);
      fade.addColorStop(0,"transparent");fade.addColorStop(1,"black");
      rc.globalCompositeOperation="destination-in";rc.fillStyle=fade;rc.fillRect(0,0,ridgeCanvas.width,ridgeCanvas.height);
      const village=band(250,-20,16,ridge,9);
      // The painting includes its own aerial perspective. Applying course
      // fog over it again at this radius flattens the entire shore to one hue.
      village.material.fog=false;
      village.material.transparent=true;village.material.depthWrite=false;
    }
    // The town in the broadcast lies on wooded hills below the clock.
    // Continue that same painted slope into the infield at a separate depth.
    if(grandclock){
      const hillGeo=new T.PlaneGeometry(148,148,52,52);
      hillGeo.rotateX(-Math.PI/2);
      const pos=hillGeo.attributes.position, uv=hillGeo.attributes.uv;
      for(let i=0;i<pos.count;i++){
        const x=pos.getX(i),z=pos.getZ(i);
        const d=Math.hypot(x/71,z/32);
        pos.setY(i,Math.max(-.2,5.6*Math.exp(-4*d*d)-.35));
        uv.setXY(i,x/210,z/210);
      }
      mesh(scene,hillGeo,grass,16,0,-181);
    }
    if(grandclock)for(const offset of [-width,width]){
      const wall=ribbon(offset,offset,0,.70,mapped(crop(near,0,.427,1,.073)),76);
      wall.material.color.set(0xf7e4ca);
      ribbon(offset-.24,offset+.24,.70,.70,wall.material,76);
    }
    if(grandclock){
      // Sample masonry and the lit dial from the actual race painting.
      const base=new T.Group();base.position.set(16,5,-181);base.scale.setScalar(1.18);scene.add(base);
      const wall=mapped(crop(sky,.675,.351,.016,.077));
      const dial=mapped(crop(sky,.692,.297,.016,.049));
      mesh(base,new T.BoxGeometry(4.9,12,4.9),wall,0,6,0);
      mesh(base,new T.BoxGeometry(5,5,5),[dial,dial,wall,wall,dial,dial],0,14.2,0);
      for(const y of [1,9.5,11.9,16.7])box(base,0,y,0,5.5,.35,5.5,0x635444);
      const roof=cylinder(base,0,19,0,.05,3.9,5.3,0x3f4140,4);roof.rotation.y=Math.PI/4;
      for(const x of [-2.45,2.45])for(const z of [-2.45,2.45])
        cylinder(base,x,17.3,z,0,.36,2.4,0x41403b,6);
    }
  }
  if(rcParaFor(race,scenery,RC_TIME_DIR[rcRaceTime(race)])?.ok)scenery();
  const shadowStamp=document.createElement("canvas");shadowStamp.width=shadowStamp.height=64;
  const pen=shadowStamp.getContext("2d"),blur=pen.createRadialGradient(32,32,2,32,32,32);
  blur.addColorStop(0,"rgba(43,26,18,.42)");blur.addColorStop(.58,"rgba(43,26,18,.24)");
  blur.addColorStop(1,"rgba(43,26,18,0)");pen.fillStyle=blur;pen.fillRect(0,0,64,64);
  const photoLens=new T.OrthographicCamera(-12,12,8,-8,.1,900);
  const shadows=new T.MeshBasicMaterial({map:texture(shadowStamp),transparent:true,depthWrite:false});
  const models=new Map();
  function imageMaterial(map){
    return new T.MeshBasicMaterial({map,side:T.DoubleSide,alphaTest:.22});
  }
  function createDragon(dr,rig){
    const group=new T.Group();scene.add(group);
    const shadow=mesh(group,new T.CircleGeometry(1,32),shadows,0,.04,0);
    shadow.rotation.x=-Math.PI/2;shadow.scale.set(2.6,.85,1);
    const body=new T.Group();group.add(body);
    const parts=rig._zsorted, wing=parts.find(p=>p.role==='wing'&&p._img);
    const b=rig._bbox, k=(dr.id==="poro"?5.15:6.8)/b.w;
    const canvas=document.createElement('canvas');canvas.width=Math.ceil(b.w);canvas.height=Math.ceil(b.h);
    const c=canvas.getContext('2d');
    for(const p of parts)if(p!==wing&&p._img)c.drawImage(p._img,p.rect.x-b.x,p.rect.y-b.y,p.rect.w,p.rect.h);
    const rect=parts.find(p=>p.role==="body")?.rect||b;
    if(dr.id==="poro")rcPoroProfileTrim(T,body,canvas,rect,b,k);
    const legRig=rcChaseLegs(T,dr.id,body,canvas,rect,b,k,texture,!!wing);
    const mat=imageMaterial(texture(canvas));
    // Sample the side art into two joined relief surfaces. Alpha retains the
    // full-resolution scales, eyes and silhouette even for a close camera.
    const nx=100, ny=64, mask=document.createElement('canvas');mask.width=nx+1;mask.height=ny+1;
    const mc=mask.getContext('2d');mc.drawImage(canvas,0,0,nx+1,ny+1);
    const alpha=mc.getImageData(0,0,nx+1,ny+1).data;
    // Fit a rounded cross-section to each opaque run. Separate runs keep air
    // between horns and below the jaw. The muzzle narrows over several
    // columns instead of pinching two flat cheeks together at the last pixel.
    const depth=new Float32Array(alpha.length/4);
    const tail=parts.find(p=>p.role==="tail");
    const tailWeight=new Float32Array(depth.length),tailY=new Float32Array(depth.length);
    const tailPhase={value:0};
    // The tail cutout sometimes contains a hind foot below the tail. Track
    // only the upper opaque run, up to the actual attachment in the painting.
    if(tail){
      const root=tail.pivot.x,tip=tail.rect.x,length=Math.max(1,root-tip);
      for(let x=0;x<=nx;x++){
        const u=(root-b.x-b.w*x/nx)/length;
        if(u<=0 || u>1.04)continue;
        let top=0;
        while(top<=ny && alpha[4*(top*(nx+1)+x)+3]<48)top++;
        let end=top;
        while(end<=ny && alpha[4*(end*(nx+1)+x)+3]>=48)end++;
        const center=(top+end-1)/2;
        const weight=T.MathUtils.smoothstep(u,0,.96);
        const height=(end-top)*b.h*k/ny;
        // Feather fans and the upright sickle on Konron keep their painted height.
        const narrow=dr.id==="phenix" || dr.id==="konron"?0:
          Math.min(.25,Math.max(0,(height-(.25+.85*(1-u)))*.48))*weight;
        for(let y=Math.max(0,top-2);y<=Math.min(ny,end+1);y++){
          const i=y*(nx+1)+x;tailWeight[i]=weight;
          tailY[i]=(y-center)*b.h*k/ny*narrow;
        }
      }
      mat.onBeforeCompile=shader=>{
        shader.uniforms.tailPhase=tailPhase;
        shader.vertexShader="uniform float tailPhase; attribute float tailWeight;\n"+shader.vertexShader.replace("#include <begin_vertex>",
          "#include <begin_vertex>\ntransformed.z+=.39*tailWeight*sin(tailPhase-1.35*tailWeight); transformed.y+=.105*tailWeight*cos(tailPhase-1.5*tailWeight);");
      };
    }
    for(let x=0;x<=nx;x++){
      const bodyX=(b.x+b.w*x/nx-rect.x)/rect.w;
      const head=bodyX>.69;
      const nose=Math.sqrt(Math.max(.015,1-Math.pow(Math.max(0,(bodyX-.80)/.20),2)));
      let y=0;
      while(y<=ny){
        if(alpha[(y*(nx+1)+x)*4+3]<50){y++;continue;}
        const start=y;
        while(y<=ny && alpha[(y*(nx+1)+x)*4+3]>=50)y++;
        const height=(y-start)*b.h*k/ny;
        const bodyRadius=dr.id==="poro" && !head ? .64 : .75;
        const breadth=Math.min(head?.82:bodyRadius,height*(head?.70:.59))*(head?nose:1);
        for(let row=start;row<y;row++){
          const v=2*(row-start+.5)/(y-start)-1;
          const i=row*(nx+1)+x;
          const tailCap=.065+.62*(1-tailWeight[i]);
          depth[i]=(tailWeight[i]?Math.min(breadth,tailCap):breadth)*Math.sqrt(Math.max(0,1-v*v));
        }
      }
    }
    // Drop empty cells before sending the two reliefs to the GPU. Keep a
    // one-cell fringe around every sampled alpha value, including thin whiskers.
    const outline=[];
    for(let x=0;x<=nx;x+=4){
      let top=-1,bottom=-1,widest=-1;
      for(let y=0;y<=ny;y++){
        const index=y*(nx+1)+x;
        if(alpha[index*4+3]<96)continue;
        if(top<0)top=y;
        bottom=y;
        if(widest<0 || depth[index]>depth[widest*(nx+1)+x])widest=y;
      }
      if(top<0)continue;
      for(const y of [top,widest,bottom])for(const side of [-1,1]){
        outline.push(new T.Vector3((x/nx-.5)*b.w*k,(1-y/ny)*b.h*k,side*depth[y*(nx+1)+x]));
      }
    }
    const indices=[];
    for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
      let occupied=false;
      for(let row=Math.max(0,y-1);row<=Math.min(ny,y+2) && !occupied;row++){
        for(let col=Math.max(0,x-1);col<=Math.min(nx,x+2);col++){
          if(alpha[4*(row*(nx+1)+col)+3]){occupied=true;break;}
        }
      }
      if(!occupied)continue;
      const a=y*(nx+1)+x,b=a+nx+1;
      indices.push(a,b,a+1,b,b+1,a+1);
    }
    for(const side of [-1,1]){
      const geo=new T.PlaneGeometry(b.w*k,b.h*k,nx,ny),pos=geo.attributes.position;
      geo.setIndex(indices);
      if(tail)geo.setAttribute("tailWeight",new T.BufferAttribute(tailWeight,1));
      for(let i=0;i<pos.count;i++){
        pos.setY(i,pos.getY(i)+b.h*k/2+tailY[i]);pos.setZ(i,side*depth[i]);
      }
      mesh(body,geo,mat);
    }
    let face=null;
    const img=portraits.get(dr.id);
    if(img && RC_CHASE_EYES[dr.id]){
      const attachFace=()=>{
        if(disposed)return;
        frozenFrame=null;
        face=rcChaseHead(T,dr.id,body,img,canvas,rect,b,k,depth,nx,ny,mat,texture);
      };
      if(img.complete && img.naturalWidth)attachFace();
      else img.addEventListener("load",attachFace,{once:true});
    }
    const wings=[];
    if(wing){
      const r=wing.rect,p=wing.pivot,dir=p.x>r.x+r.w/2?-1:1;
      const wmat=imageMaterial(texture(wing._img));
      // The shoulder marker lies inside a side-view cutout. Find the actual
      // root edge in its alpha mask before unrolling the span into depth.
      const wm=document.createElement("canvas");wm.width=64;wm.height=40;
      const wc=wm.getContext("2d");wc.drawImage(wing._img,0,0,64,40);
      const wa=wc.getImageData(0,0,64,40).data;
      let weight=0,rootV=0;
      for(let x=0;x<64;x++)for(let y=0;y<40;y++){
        const inward=dir<0?63-x:x;
        if(inward>8)continue;
        const w=wa[4*(y*64+x)+3]*(9-inward);
        weight+=w;rootV+=w*(y+.5)/40;
      }
      rootV=weight?rootV/weight:(p.y-r.y)/r.h;
      for(const side of [-1,1]){
        const geo=new T.PlaneGeometry(1,1,22,9),m=mesh(body,geo,wmat);
        m.frustumCulled=false;
        const coords=[];
        for(let i=0;i<geo.attributes.uv.count;i++){
          const u=geo.attributes.uv.getX(i),v=1-geo.attributes.uv.getY(i);
          const chord=(v-rootV)*r.h*k;
          const span=(dir<0 ? 1-u : u)*r.w*k;
          coords.push([dir*span,chord,span,span/(r.w*k)]);
        }
        const shoulderX=Math.max(0,Math.min(nx,Math.round((p.x-b.x)/b.w*nx)));
        let shoulderY=Math.max(0,Math.min(ny,Math.round((p.y-b.y)/b.h*ny)));
        while(shoulderY<ny && depth[shoulderY*(nx+1)+shoulderX]<.16)shoulderY++;
        const anchor=Math.max(.22,depth[shoulderY*(nx+1)+shoulderX]-.045);
        m.position.set((p.x-b.x-b.w/2)*k,b.h*k*(1-shoulderY/ny),side*anchor);
        // Keep a compact contour from the painted alpha silhouette, so transparent
        // wing corners never push the tracking lens away from a close duel.
        const rim=[];
        for(let col=0;col<=22;col+=2){
          let top=-1,bottom=-1;
          for(let row=0;row<=9;row++){
            const x=Math.min(63,Math.round(col*63/22)),y=Math.min(39,Math.round(row*39/9));
            if(wa[(y*64+x)*4+3]<42)continue;
            if(top<0)top=row;bottom=row;
          }
          if(top>=0)rim.push(top*23+col,bottom*23+col);
        }
        wings.push({geo,coords,side,mesh:m,rim});
      }
    }
    let footShadows=null;
    if(!wing && legRig){
      const pad=new T.PlaneGeometry(1,1);pad.rotateX(-Math.PI/2);
      footShadows=new T.InstancedMesh(pad,shadows,4);
      footShadows.frustumCulled=false;group.add(footShadows);
    }
    return {group,body,wings,shadow,footShadows,tailPhase,outline,legRig,get face(){return face;}};
  }
  const footStamp=new T.Object3D();
  const focus=new T.Vector3(),look=new T.Vector3(),offset=new T.Vector3();
  function modelFor(dr){
    if(models.has(dr.id))return models.get(dr.id);
    const rig=_rcDragonRigV2(dr.id)?.rig;
    if(!rig)return null;
    const model=createDragon(dr,rig);models.set(dr.id,model);return model;
  }
  let frozenFrame=null;
  const nameplates=new Map();
  let labelWidth=0, labelHeight=0, labelPhoto=false;
  let lastTau=-1, lastWidth=0,lastHeight=0, lastHeadDistance=0;
  let shotSide=1, directorYaw=0, liftAngle=0, lastRange=0, lastFit=0, wasDirecting=false;
  // Course progress keeps the shot reproducible at every playback speed and on seek.
  const middlePullStart=Math.max(.36,flight.start-.05);
  function pullAt(progress,start){
    return T.MathUtils.smoothstep(progress,start,start+.065)*
      (1-T.MathUtils.smoothstep(progress,start+.115,start+.18));
  }
  function draw(ctx,w,h,degrees,tau,progressAt,standings,directing,photo=false,lowSpec=false,gapLabel=""){
    lakeClock.value=tau*55;
    festivalClock.value=quietScenery?0:tau*55;
    const stationary=tau===lastTau;
    const key=[tau,w,h,directing?0:degrees,directing,photo,lowSpec,progressAt(standings[0]),progressAt(standings[1]),gapLabel,ctx.canvas.width,ctx.canvas.height].join("|");
    if(frozenFrame===key)return false;
    let a=degrees*Math.PI/180;
    const points=new Map(), head=progressAt(standings[0]);
    let leadersLift=0;
    const headDistance=distanceAt(head);
    const finishBlend=T.MathUtils.smoothstep(head,.90,.985);
    const finishCamera=directing ? finishBlend : 0;
    const pull=directing && !photo && !quietScenery ?
      Math.max(pullAt(head,middlePullStart),pullAt(head,.735)) : 0;
    const headPoint=coursePoint(headDistance,0);
    for(const dr of dragons){
      const gap=headDistance-distanceAt(progressAt(dr.id));
      const secondGap=headDistance-distanceAt(progressAt(standings[1]));
      const leadGap=6*Math.asinh(Math.min(gap,secondGap)/25);
      const trailingGap=Math.max(0,gap-secondGap);
      const distance=T.MathUtils.lerp(headDistance-leadGap-14*Math.asinh(trailingGap/10),
        distanceAt(progressAt(dr.id)),finishBlend);
      const rigBox=_rcDragonRigV2(dr.id)?.rig?._bbox;
      const noseOffset=rigBox ? (dr.id==="poro"?2.575:3.4) : 0;
      const pt=coursePoint(distance,(lanes[dr.id]-(dragons.length-1)/2)*laneSpacing);
      const theta=pt.yaw, nose=noseOffset*finishBlend;
      const pos=new T.Vector3(pt.x-nose*Math.cos(theta),pt.y,pt.z+nose*Math.sin(theta));
      points.set(dr.id,pos);
      const m=modelFor(dr);
      if(!m)continue;
      m.group.position.copy(pos);m.group.rotation.y=theta;
      const pose=flight.sample(dr.id,progressAt(dr.id));
      pos.y+=pose.height; // The focus and nameplate follow the body; the shadow stays on the course.
      if(dr.id===standings[0] || dr.id===standings[1])leadersLift+=pose.height*.5;
      const phase=tau*(dr.id==="poro"?354:316)+lanes[dr.id]*.9;
      const neck=m.face?.userData.neck;
      if(neck)neck.rotation.z=.032*Math.sin(phase-.95);
      m.tailPhase.value=phase*.64;
      const winged=m.wings.length>0;
      const grade=Math.atan2(coursePoint(distance+1,0).y-coursePoint(distance-1,0).y,2);
      const gait=m.legRig && !winged?distance*2*Math.PI/m.legRig.stride+lanes[dr.id]:phase;
      const pitch=pose.pitch+(winged?.026:.012)*Math.cos(gait);
      m.body.rotation.z=pitch+(winged?0:grade);
      const sole=m.legRig?rcPoseChaseLegs(m.legRig,gait,Math.min(1,pose.height/5),winged,pitch):0;
      m.body.position.y=winged?1.65+pose.height+.24*Math.sin(phase-.75):(.032-sole)/Math.cos(grade);
      if(!winged)pos.y+=m.body.position.y-1.65;
      m.shadow.rotation.order="ZXY";m.shadow.rotation.z=grade;
      if(m.footShadows){
        m.legRig.legs.forEach((leg,i)=>{
          const x=leg.groundX*Math.cos(grade)-leg.groundY*Math.sin(grade);
          const contact=1/(1+6*Math.max(0,leg.groundY-sole));
          footStamp.position.set(x,x*Math.tan(grade)+.035,leg.root.position.z+leg.tipZ);
          footStamp.rotation.z=grade;footStamp.scale.set(.76*contact,1,.50*contact);
          footStamp.updateMatrix();m.footShadows.setMatrixAt(i,footStamp.matrix);
        });
        m.footShadows.instanceMatrix.needsUpdate=true;
      }
      const turnAhead=coursePoint(distance+5,0).yaw-theta;
      m.body.rotation.x=pose.height*Math.sin(turnAhead)*.13;
      const contact=1/(1+.09*pose.height);
      m.shadow.scale.set(2.6*contact,.85*contact,1);
      // Solve the delayed wing stroke once per column for the two shoulders.
      // Rotate both span and chord through the same angle to retain membrane depth.
      if(!m.wings.length)continue;
      const columns=m.wings[0].geo.parameters.widthSegments+1;
      for(let col=0;col<columns;col++){
        const t=m.wings[0].coords[col][3];
        const wave=phase-.72*t,stroke=Math.sin(wave);
        const wrist=t*t*(3-2*t),recovery=(1+Math.cos(wave))*.5;
        const flap=.20+(.49+.16*pose.stroke)*stroke+.16*wrist*Math.sin(wave-.85);
        const sin=Math.sin(flap),cos=Math.cos(flap);
        for(const {geo,coords,side} of m.wings){
          const attr=geo.attributes.position;
          for(let i=col;i<coords.length;i+=columns){
            const [u,v,span,t]=coords[i];
            const reach=span*.86*(.88+.12*t)*(1-.12*wrist*recovery),chord=-v*.72;
            const camber=.105*reach*(1-t)*Math.cos(wave);
            attr.setXYZ(i,u*.53-v*.44-.13*span*wrist*recovery,reach*sin+chord*cos+camber,side*(reach*cos-chord*sin));
          }
        }
      }
      for(const {geo} of m.wings)geo.attributes.position.needsUpdate=true;
    }
    const first=points.get(standings[0]),second=points.get(standings[1]);
    look.addVectors(first,second).multiplyScalar(.5);
    if(pull && standings.length>2){
      const third=points.get(standings[2]),fourth=points.get(standings[3])||third;
      offset.addVectors(third,fourth).multiplyScalar(.5).sub(look).clampLength(0,12);
      look.addScaledVector(offset,.60*pull);
    }
    look.y+=2.95-leadersLift*.22;
    const reset=lastTau<0 || tau<lastTau || tau-lastTau>.025;
    const dt=reset?1:Math.min(1,(tau-lastTau)*55);
    if(reset)focus.copy(look);
    else {
      // Carry the previous target along the course first. Damping only the
      // change of leader avoids trailing the pack by a whole dragon length.
      const old=coursePoint(lastHeadDistance,0);
      focus.x+=headPoint.x-old.x;
      focus.z+=headPoint.z-old.z;
      focus.lerp(look,1-Math.exp(-dt*8));
    }
    lastHeadDistance=headDistance;
    lastTau=tau;
    // Hold the side of the course for the whole shot, even when ranks reverse.
    // Look more steeply down the lanes if one body crosses in front of another.
    const newShot=reset || directing!==wasDirecting;
    wasDirecting=directing;
    if(directing){
      if(newShot)shotSide=lanes[standings[0]]>=lanes[standings[1]]?-1:1;
      // Open the three-quarter shot toward both faces as the second nose
      // closes. Keep the chosen bank even if the order reverses.
      const gap=Math.max(0,headDistance-distanceAt(progressAt(standings[1])));
      const duel=1-T.MathUtils.smoothstep(gap,3,30);
      const laneRoom=T.MathUtils.smoothstep(Math.abs(lanes[standings[0]]-lanes[standings[1]])*laneSpacing,2,10);
      const closeBearing=.46+duel*(.28+.48*laneRoom)+.07*Math.sin(tau*18);
      // From the high shot, see the field advance across the frame as well as into it.
      const bearing=T.MathUtils.lerp(closeBearing,.48,.52*pull);
      const desired=shotSide>0?bearing:Math.PI-bearing;
      directorYaw=newShot?desired:directorYaw+(desired-directorYaw)*(1-Math.exp(-dt*2.4));
      a=directorYaw;
    }
    const yaw=headPoint.yaw+a;
    camera.aspect=w/h;
    const dx=first.x-second.x,dz=first.z-second.z;
    const across=Math.abs(dx*Math.cos(yaw)-dz*Math.sin(yaw));
    const depth=Math.abs(dx*Math.sin(yaw)+dz*Math.cos(yaw));
    const baseLift=grandclock?.047:.062;
    const desiredLift=baseLift+.26*pull+(directing?.165:.085)*(1-T.MathUtils.smoothstep(across,2,8));
    liftAngle=newShot?desiredLift:T.MathUtils.lerp(liftAngle,desiredLift,1-Math.exp(-dt*3));
    const verticalRange=(Math.abs(first.y-second.y)+7.2)/(2*Math.tan(Math.PI/10));
    const needed=Math.max(14,(across+11)/(2*Math.tan(Math.PI/10)*camera.aspect)*1.14+depth*.55,depth*.8+8,verticalRange+depth*.5);
    // Keep room immediately when a new rival enters; ease back into the close-up.
    const range=directing && !newShot?Math.max(needed,T.MathUtils.lerp(lastRange,needed,1-Math.exp(-dt*2))):needed;
    lastRange=range;
    // When the pair is several lanes deep, stand farther back and tighten
    // the lens together. Both noses then have comparable apparent size.
    const lensRange=range*(1+.24*pull)+Math.min(range,depth*.85)*(1-finishCamera);
    camera.fov=2*Math.atan(Math.tan(Math.PI/10)*range/lensRange)*180/Math.PI;
    camera.updateProjectionMatrix();
    offset.set(Math.sin(yaw)*lensRange,lensRange*liftAngle+.55,Math.cos(yaw)*lensRange);
    camera.position.copy(focus).add(offset);
    const target=look.copy(focus);
    const lateralFocus=focus.clone().sub(finishOrigin).dot(normal);
    const finishTarget=finishOrigin.clone().addScaledVector(normal,lateralFocus);
    finishTarget.y+=2.8;
    if(finishCamera){
      const photoPosition=finishOrigin.clone().addScaledVector(normal,width+24);
      photoPosition.y+=10.5;
      target.lerp(finishTarget,finishCamera);camera.position.lerp(photoPosition,finishCamera);
    }
    camera.lookAt(target);
    if(directing && !photo){
      const bearing=Math.atan2(camera.position.x-target.x,camera.position.z-target.z)-headPoint.yaw;
      draw.angle=Math.round(Math.atan2(Math.sin(bearing),Math.cos(bearing))*180/Math.PI);
    }
    // Test both silhouettes in lens space. When the nearer dragon changes
    // lanes in the frame, its apparent width can exceed the centre-line fit.
    if(!photo){
      camera.updateMatrixWorld();
      const tanV=Math.tan(camera.fov*Math.PI/360);
      // Fit the actual cheek, claws and wing membranes. A fixed box around
      // each lane pulls far away from a pair flying at different heights.
      let fit=.25;
      const eye=new T.Vector3();
      function framePoint(){
        eye.applyMatrix4(camera.matrixWorldInverse);
        const depth=Math.max(.1,-eye.z);
        const hudLeft=eye.y/depth/tanV>.25 && eye.x<0;
        const horizontal=hudLeft?.77:.93,vertical=eye.y<0?.66:.81;
        fit=Math.max(fit,Math.abs(eye.x)/(depth*tanV*camera.aspect*horizontal),
          Math.abs(eye.y)/(depth*tanV*vertical));
      }
      for(const id of standings.slice(0,2)){
        const model=models.get(id);if(!model)continue;
        model.group.updateWorldMatrix(true,true);
        for(const point of model.outline){eye.copy(point).applyMatrix4(model.body.matrixWorld);framePoint();}
        for(const wing of model.wings)for(const i of wing.rim){
          eye.fromBufferAttribute(wing.geo.attributes.position,i).applyMatrix4(wing.mesh.matrixWorld);framePoint();
        }
        for(const leg of model.legRig?.legs || []){
          eye.set(leg.tipX,leg.tipY,leg.tipZ).applyMatrix4(leg.ankle.matrixWorld);framePoint();
        }
      }
      fit=Math.max(fit,5.1/(lensRange*tanV));
      if(pull){
        // Fit the chasing group only as far as the two leaders remain readable.
        const pairFit=fit, overviewLimit=camera.aspect<1 ? 1.40 : 1.58;
        for(let i=2;i<Math.min(4,standings.length);i++){
          const model=models.get(standings[i]);
          if(!model)continue;
          model.body.updateWorldMatrix(true,false);
          for(const x of [-3,3]){
            eye.set(x,2,0).applyMatrix4(model.body.matrixWorld);framePoint();
          }
        }
        fit=T.MathUtils.lerp(pairFit,T.MathUtils.clamp(fit,pairFit*1.16,pairFit*overviewLimit),pull);
      }
      if(!newShot && dt>0)fit=Math.max(fit,T.MathUtils.lerp(lastFit,fit,1-Math.exp(-dt*2.6)));
      lastFit=fit;
      camera.fov=2*Math.atan(tanV*fit)*180/Math.PI;
      camera.updateProjectionMatrix();
    }
    for(const model of models.values()){
      if(!model.face?.userData.mix)continue;
      // A climb changes elevation, not which cheek the camera sees. The
      // finish camera has parallel sight lines across all lanes.
      const toCamera=photo?normal:offset.subVectors(camera.position,model.group.position);
      const heading=model.group.rotation.y;
      const cosine=(toCamera.x*Math.cos(heading)-toCamera.z*Math.sin(heading))/
        Math.max(.001,Math.hypot(toCamera.x,toCamera.z));
      const blend=T.MathUtils.smoothstep(cosine,.44,.94);
      model.face.userData.mix.value=blend;
    }
    // Keep the 2D names and commentary at native resolution on slow devices.
    const nativeDensity=window.devicePixelRatio||1;
    const density=photo ? Math.min(2,nativeDensity) : lowSpec ? .72 : Math.min(1.5,nativeDensity);
    const rw=Math.round(w*density),rh=Math.round(h*density);
    if(rw!==lastWidth||rh!==lastHeight){renderer.setSize(rw,rh,false);lastWidth=rw;lastHeight=rh;}
    camera.updateMatrixWorld();
    let lens=camera;
    gate.visible=!photo;
    if(photo){
      // A line camera has no perspective advantage for the near lane.
      const leading=first.clone().sub(finishOrigin).dot(forward);
      const chasing=second.clone().sub(finishOrigin).dot(forward);
      const left=Math.min(-1.5,leading-4,chasing-4);
      const right=Math.max(1.5,leading+4,chasing+4);
      const cx=(left+right)/2,span=Math.max(12,(right-left)*1.15);
      const center=finishTarget.clone().addScaledVector(forward,cx);
      const halfH=Math.max(4,span/(2*camera.aspect));
      photoLens.left=-halfH*camera.aspect;photoLens.right=halfH*camera.aspect;
      photoLens.top=halfH;photoLens.bottom=-halfH;
      // Place the near clip just outside the near verge. Rocks between a
      // telephoto lens and the outside rail must never hide a crossing nose.
      photoLens.near=Math.max(.1,150+lateralFocus-width-2);
      photoLens.updateProjectionMatrix();
      photoLens.position.copy(center).addScaledVector(normal,150);
      photoLens.position.y+=9.3;photoLens.lookAt(center);
      photoLens.updateMatrixWorld();lens=photoLens;
    }
    renderer.clippingPlanes=finishCamera>.98?[nearVerge]:[];
    const outdoorFog=scene.fog;
    if(photo){
      // The parallel lens would magnify a distant cliff to the same size
      // as a nearby one. Let the far bank recede beyond the last lane.
      scene.fog=new T.Fog(outdoorFog.color,150+lateralFocus+width,150+lateralFocus+width+28);
    }
    if(reflection && !photo)reflection.render(renderer,scene,lens,waterSurface,models,rw,rh,lowSpec);
    renderer.render(scene,lens);scene.fog=outdoorFog;
    ctx.clearRect(0,0,w,h);
    ctx.save();
    if(race.weather==="rain" || race.weather==="thunder"){
      ctx.strokeStyle="rgba(203,224,242,.34)";ctx.lineWidth=1;ctx.beginPath();
      for(let i=0;i<34;i++){
        const x=((i*.61803+tau*5)%1)*w, y=((i*.41421+tau*38)%1)*h;
        ctx.moveTo(x,y);ctx.lineTo(x-2,y+Math.max(4,h*.016));
      }
      ctx.stroke();
    }
    const font=Math.max(11,Math.min(16,w*.023));
    ctx.font="600 "+font+"px system-ui";ctx.textBaseline="middle";ctx.textAlign="center";
    if(finishCamera>.995){
      const line=finishTarget.clone().project(lens);
      const sx=(line.x+1)*w/2;
      ctx.strokeStyle="rgba(255,225,151,.86)";ctx.lineWidth=1;
      ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(sx,h*.19);ctx.lineTo(sx,h*.82);
      ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle="#28343a";ctx.fillRect(sx-40,h*.18-10,80,20);
      ctx.fillStyle="#ffdf9c";ctx.fillText(photo?"決勝写真":"決勝線",sx,h*.18);
    }
    // Place the pair together, in screen pixels. At portrait aspect ratios
    // an offset based on canvas height can leave a name a whole body away.
    const bodyBounds=standings.slice(0,2).map(id=>{
      const m=models.get(id),p=points.get(id);
      const bounds={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity};
      const vector=new T.Vector3(),contour=[];
      const outline=m?.outline.length?m.outline:[new T.Vector3(0,1.65,0)];
      function includePoint(){
        vector.project(lens);
        const sx=(1+vector.x)*w/2,sy=(1-vector.y)*h/2;
        contour.push({x:sx,y:sy});
        bounds.left=Math.min(bounds.left,sx);bounds.right=Math.max(bounds.right,sx);
        bounds.top=Math.min(bounds.top,sy);bounds.bottom=Math.max(bounds.bottom,sy);
      }
      for(const point of outline){
        vector.copy(point);
        if(m)vector.applyMatrix4(m.body.matrixWorld);else vector.add(p);
        includePoint();
      }
      for(const leg of m?.legRig?.legs||[]){
        vector.set(leg.tipX,leg.tipY,leg.tipZ).applyMatrix4(leg.ankle.matrixWorld);
        includePoint();
      }
      bounds.contour=contour;
      return bounds;
    });
    const viewport=ctx.canvas.getBoundingClientRect();
    const obstacles=bodyBounds.slice();
    if(viewport.width && viewport.height){
      const scaleX=w/viewport.width,scaleY=h/viewport.height;
      for(const selector of [".rc-hud","#rc-board","#rc-yt","#rc-mine","#rc-play"]){
        const box=ctx.canvas.closest(".rc-stage").querySelector(selector)?.getBoundingClientRect();
        if(box?.height)obstacles.push({left:(box.left-viewport.left)*scaleX,right:(box.right-viewport.left)*scaleX,
          top:(box.top-viewport.top)*scaleY,bottom:(box.bottom-viewport.top)*scaleY});
      }
    }
    function overlap(a,b){
      return Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*
        Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
    }
    const now=performance.now();
    if(newShot || photo!==labelPhoto || w!==labelWidth || h!==labelHeight || stationary)nameplates.clear();
    labelWidth=w;labelHeight=h;labelPhoto=photo;
    const candidates=bodyBounds.map((body,i)=>{
      const previous=nameplates.get(standings[i]);
      const label=(i+1)+"位 "+commentaryName(standings[i])+(gapLabel && i===(gapLabel==="先頭交代"?0:1)?"  "+gapLabel:""),width=ctx.measureText(label).width+14;
      const height=font+7,cx=(body.left+body.right)/2;
      const options=[];
      for(const above of [false,true])for(const shift of [0,-.58,.58]){
        const x=T.MathUtils.clamp(cx+shift*width,width/2+3,w-width/2-3);
        const edge=above?body.top:body.bottom;
        const cost=p=>Math.abs(p.x-x)*.55+Math.abs(p.y-edge);
        const anchor=body.contour.reduce((best,p)=>cost(p)<cost(best)?p:best);
        const y=T.MathUtils.clamp(edge+(above?-1:1)*(height/2+5),height/2+4,h-height/2-4);
        const box={left:x-width/2,right:x+width/2,top:y-height/2,bottom:y+height/2};
        const score=obstacles.reduce((v,o)=>v+overlap(box,o),0)*4+Math.abs(x-anchor.x)+Math.abs(y-anchor.y)+(above?12:0);
        // A sliver of overlap or a moving foot is not enough to move a plate
        // to the other side. Keep the preference with the dragon at an overtake.
        const changeCost=previous ? (above!==previous.above?540:0)+(shift!==previous.shift?180:0) : 0;
        options.push({label,x,y,box,score:score+changeCost,anchor,above,shift});
      }
      return options;
    });
    let pair,lowest=Infinity;
    for(const firstLabel of candidates[0])for(const secondLabel of candidates[1]){
      const score=firstLabel.score+secondLabel.score+12*overlap(firstLabel.box,secondLabel.box);
      if(score<lowest){lowest=score;pair=[firstLabel,secondLabel];}
    }
    for(const id of nameplates.keys())if(id!==standings[0] && id!==standings[1])nameplates.delete(id);
    pair.forEach(({label,x,y,box,anchor,above,shift},i)=>{
      const id=standings[i],previous=nameplates.get(id);
      const width=box.right-box.left,height=box.bottom-box.top;
      if(previous){
        const elapsed=Math.max(0,now-previous.time);
        // Keep the name steady when the trailing gap text changes length.
        x=rcFollowRaceLabel(previous.left,x-width/2,elapsed,85,1)+width/2;
        y=rcFollowRaceLabel(previous.y,y,elapsed,135,2);
        anchor.x=rcFollowRaceLabel(previous.ax,anchor.x,elapsed,85,1);
        anchor.y=rcFollowRaceLabel(previous.ay,anchor.y,elapsed,85,1);
      }
      x=T.MathUtils.clamp(x,width/2+3,w-width/2-3);
      y=T.MathUtils.clamp(y,height/2+4,h-height/2-4);
      nameplates.set(id,{left:x-width/2,y,ax:anchor.x,ay:anchor.y,above,shift,time:now});
      x=Math.round(x);y=Math.round(y);
      box={left:x-width/2,right:x+width/2,top:y-height/2,bottom:y+height/2};
      const tint=i?"#e3eef3":"#ffda86";
      ctx.strokeStyle=tint;ctx.lineWidth=1.4;
      ctx.beginPath();ctx.moveTo(anchor.x,anchor.y);ctx.lineTo(T.MathUtils.clamp(anchor.x,box.left+5,box.right-5),above?box.bottom:box.top);ctx.stroke();
      ctx.fillStyle=i?"rgba(24,36,43,.94)":"rgba(70,46,16,.94)";
      ctx.fillRect(box.left,box.top,box.right-box.left,box.bottom-box.top);
      ctx.fillStyle=tint;ctx.fillText(label,x,y);
    });
    ctx.restore();
    frozenFrame=photo||tau>=1||stationary ? key : null;
    return true;
  }
  draw.resetLabels=()=>{nameplates.clear();frozenFrame=null;};
  draw.surface=renderer.domElement;
  draw.prepareRunner=runner=>{
    const model=modelFor(runner);
    model?.group.traverse(part=>{if(part.material?.map)renderer.initTexture(part.material.map);});
  };
  // Submitting a shader or texture does not mean the first live frame can use it yet.
  // Wait on the GPU during the grid preparation without blocking the browser.
  const gl=renderer.getContext();
  let warmFence=null;
  draw.warmupComplete=()=>{
    if(gl.isContextLost())throw Error("WebGL context lost");
    if(!gl.fenceSync){gl.finish();return true;}
    if(!warmFence){
      warmFence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);
      if(!warmFence)throw Error("WebGL fence unavailable");
      gl.flush();
    }
    const status=gl.clientWaitSync(warmFence,0,0);
    if(status===gl.TIMEOUT_EXPIRED)return false;
    gl.deleteSync(warmFence);warmFence=null;
    if(status===gl.WAIT_FAILED)throw Error("WebGL warmup failed");
    return true;
  };
  draw.dispose=()=>{disposed=true;if(warmFence)gl.deleteSync(warmFence);reflection?.dispose();const mats=new Set();scene.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();if(o.geometry)o.geometry.dispose();if(o.material)for(const m of [].concat(o.material))mats.add(m);});mats.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();renderer.forceContextLoss();};
  return draw;
}
