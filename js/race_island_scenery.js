/* Fixed course landmarks shared by broadcast and chase. */
const RC_ISLAND_FESTIVALS={
  "白兎神域地域":{vista:"shinto",silk:"#efe7cf",ink:"#a02630",trim:"#b8893c",pole:0x913d36,sign:"hare"},
  "煉獄頂地域":{vista:"entei",silk:"#962e25",ink:"#ffe6a6",trim:"#d39943",pole:0x543f36,sign:"sun"},
  "竜王圏地域":{vista:"ryuo",silk:"#284578",ink:"#ffdc81",trim:"#c7a454",pole:0x664943,sign:"scale"},
  "灼熱回廊地域":{vista:"hansho",silk:"#ce7030",ink:"#fff0c3",trim:"#b4482c",pole:0x573d38,sign:"flame"},
  "ラパン祭典地域":{silk:"#b73c54",ink:"#ffe5ad",trim:"#d39a46",pole:0x975139,sign:"hare"}
};
// Broken quartz has long prism faces and a separate, light-catching crown.
function rcShoreQuartz(T){
  const pos=[],colors=[],indices=[];
  const point=(i,ring)=>{
    const angle=(i%6)*Math.PI/3+.20,facet=Math.sin(angle*2+.41);
    const r=[.65,1,.89,.035][ring]*(1+.12*facet);
    return [r*Math.cos(angle)+(ring===3?.14:0),[-1,-.64,.43+.13*facet,1][ring],r*Math.sin(angle)];
  };
  for(let i=0;i<6;i++)for(let ring=0;ring<3;ring++){
    const start=pos.length/3,light=.70+.17*Math.cos(i*Math.PI/3-.55);
    for(const [j,k] of [[i,ring],[i+1,ring],[i+1,ring+1],[i,ring+1]]){
      pos.push(...point(j,k));
      const value=light*[.49,.70,1,1.29][k]*(ring===2?1.12:1);
      colors.push(value*.88,value*.96,value);
    }
    indices.push(start,start+1,start+2,start,start+2,start+3);
  }
  const geo=new T.BufferGeometry();geo.setAttribute("position",new T.Float32BufferAttribute(pos,3));
  geo.setAttribute("color",new T.Float32BufferAttribute(colors,3));geo.setIndex(indices);return geo;
}
// Survey streamers mark the wind on the same chainages in both broadcasts.
const RC_WIND_STATIONS=[.10,.265,.42,.575,.755,.905];
function rcWindStreamer(u,t,station){
  return .25*Math.sin(9*u-3.8*t+station)*u+.13*Math.sin(16*u-5.1*t+station)*u*u-.18*u;
}
function rcWindSurvey2D(ctx,slug,xAt,h,t){
  const blue=slug==="lumina";
  for(const [i,p] of RC_WIND_STATIONS.entries()){
    const x=xAt(p),y=h*(.707+.009*Math.sin(i*3)),unit=h*.022;
    if(x< -unit*5 || x>ctx.canvas.width+unit*5)continue;
    ctx.save();ctx.translate(x,y);ctx.scale(unit,unit);
    ctx.fillStyle=blue?"#535666":"#534638";ctx.fillRect(-.085,-3.8,.17,3.8);
    ctx.fillStyle="#c1a779";ctx.fillRect(-.17,-3.93,.34,.24);
    for(let j=0;j<12;j++){
      const a=j/12,b=(j+1)/12;
      ctx.fillStyle=j>=3&&j<5||j>=8&&j<10?"#e7d9ad":blue?"#387785":"#ac5537";
      ctx.beginPath();ctx.moveTo(a*3.7,-3.55-rcWindStreamer(a,t,i));
      ctx.lineTo(b*3.7,-3.55-rcWindStreamer(b,t,i));ctx.lineTo(b*3.7,-3.55-rcWindStreamer(b,t,i)+.48*(1-b*.77));
      ctx.lineTo(a*3.7,-3.55-rcWindStreamer(a,t,i)+.48*(1-a*.77));ctx.fill();
    }
    ctx.restore();
  }
}
function rcWindSurvey3D(T,scene,course,width,slug,clock){
  const loc=[],colors=[],uv=[],index=[],matrices=[],dummy=new T.Object3D();
  const white=new T.Color(0xe7d9ad),color=new T.Color(slug==="lumina"?0x387785:0xac5537);
  for(const [i,progress] of RC_WIND_STATIONS.entries()){
    const p=course.point(course.distance(progress),-(width+2.8));
    dummy.position.set(p.x,p.y+1.65,p.z);dummy.scale.set(.16,4.25,.16);dummy.updateMatrix();matrices.push(dummy.matrix.clone());
    for(let j=0;j<12;j++){
      const start=loc.length/3,c=j>=3&&j<5||j>=8&&j<10?white:color;
      for(const [u,v] of [[j/12,0],[(j+1)/12,0],[j/12,1],[(j+1)/12,1]]){
        const along=3.9*u;
        loc.push(p.x+Math.cos(p.yaw)*along,p.y+3.52-v*.51*(1-.77*u),p.z-Math.sin(p.yaw)*along-.67*u);
        uv.push(u,i);colors.push(c.r,c.g,c.b);
      }
      index.push(start,start+1,start+2,start+1,start+3,start+2);
    }
  }
  const poles=new T.InstancedMesh(new T.CylinderGeometry(.76,1,1,7),new T.MeshStandardMaterial({color:0x685944}),matrices.length);
  matrices.forEach((m,i)=>poles.setMatrixAt(i,m));scene.add(poles);
  const geo=new T.BufferGeometry();geo.setAttribute("position",new T.Float32BufferAttribute(loc,3));
  geo.setAttribute("uv",new T.Float32BufferAttribute(uv,2));geo.setAttribute("color",new T.Float32BufferAttribute(colors,3));geo.setIndex(index);
  const cloth=new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide});
  cloth.onBeforeCompile=s=>{
    s.uniforms.windTime=clock;
    s.vertexShader="uniform float windTime;\n"+s.vertexShader.replace("#include <begin_vertex>",
      "#include <begin_vertex>\nfloat u=uv.x, i=uv.y; transformed.y+=u*.25*sin(9.*u-3.8*windTime+i)+u*u*.13*sin(16.*u-5.1*windTime+i)-.18*u;");
  };
  scene.add(new T.Mesh(geo,cloth));
}

// Stone voussoirs follow an actual arc. Openings reveal the ravine and the
// far-bank painting from different bearings rather than turning with the lens.
function rcRussetArcade(T,scene,course,width){
  const pos=[],col=[],indices=[];
  function block(p,side,sill,outline,tint){
    const base=pos.length/3,c=new T.Color(tint);
    for(const z of [-1.3,1.3])for(const [x,y] of outline){
      const point=course.point(p+x,side*(width+47)+z);
      pos.push(point.x,sill+y,point.z);col.push(c.r,c.g,c.b);
    }
    for(const q of [[0,1,2,3],[7,6,5,4],[4,5,1,0],[1,5,6,2],[2,6,7,3],[3,7,4,0]]){
      indices.push(base+q[0],base+q[1],base+q[2],base+q[0],base+q[2],base+q[3]);
    }
  }
  for(const [p,side,n] of [[.46,-1,9],[.73,1,6]]){
    const start=course.distance(p)-n*5,base=course.point(start,0).y+2.7;
    for(let j=0;j<n;j++){
      const s=start+10*j,shade=j%2?0x874b3e:0x815044;
      block(s,side,base,[[-5,-15],[-3.7,-15],[-3.7,0],[-5,0]],shade);
      block(s,side,base,[[3.7,-15],[5,-15],[5,0],[3.7,0]],shade);
      for(let k=0;k<9;k++){
        const a=Math.PI*k/9,b=Math.PI*(k+1)/9;
        const at=(r,t)=>[r*Math.cos(t),r*Math.sin(t)];
        block(s,side,base,[at(3.7,a),at(3.7,b),at(5,b),at(5,a)],[0x985e4c,0x8a5143,0x9c6652][(k+j)%3]);
        block(s,side,base,[at(5,a),at(5,b),[5*Math.cos(b),5.3],[5*Math.cos(a),5.3]],shade);
      }
      block(s,side,base,[[-5,5.3],[5,5.3],[5,5.82],[-5,5.82]],0xb67d59);
    }
  }
  const geo=new T.BufferGeometry();geo.setAttribute("position",new T.Float32BufferAttribute(pos,3));geo.setAttribute("color",new T.Float32BufferAttribute(col,3));
  geo.setIndex(indices);geo.computeVertexNormals();scene.add(new T.Mesh(geo,new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide})));
}
const RC_FESTIVAL_STATIONS=[.035,.12,.245,.33,.47,.56,.69,.81,.905,.972];
const rcFestivalCloths=new Map();
function rcFestivalStandard(festival){
  if(rcFestivalCloths.has(festival))return rcFestivalCloths.get(festival);
  const canvas=document.createElement("canvas");canvas.width=144;canvas.height=240;
  const g=canvas.getContext("2d");
  g.beginPath();g.moveTo(6,4);g.lineTo(138,4);g.lineTo(136,231);
  g.lineTo(72,205);g.lineTo(8,231);g.closePath();g.clip();
  g.fillStyle=festival.silk;g.fillRect(0,0,144,240);
  g.strokeStyle=festival.trim;g.lineWidth=4;g.strokeRect(13,12,118,224);
  g.lineWidth=1;g.strokeRect(19,18,106,218);
  g.strokeStyle=festival.ink;g.lineWidth=3;
  g.beginPath();g.arc(72,94,40,0,Math.PI*2);g.stroke();
  g.fillStyle=festival.ink;
  function ellipse(x,y,a,b,r=0){g.beginPath();g.ellipse(x,y,a,b,r,0,Math.PI*2);g.fill();}
  if(festival.sign==="hare"){
    ellipse(69,101,18,13,-.25);ellipse(85,90,9,9);ellipse(83,77,3.7,13,-.33);
    ellipse(90,78,3.4,12,.20);ellipse(53,96,5,5);ellipse(77,111,14,3,-.08);
  }else if(festival.sign==="sun"){
    ellipse(72,94,14,14);
    for(let j=0;j<12;j++){g.save();g.translate(72,94);g.rotate(j*Math.PI/6);
      g.beginPath();g.moveTo(-3,-19);g.lineTo(1,-33);g.lineTo(4,-19);g.fill();g.restore();}
  }else if(festival.sign==="scale"){
    for(const [x,y] of [[61,88],[83,88],[72,108]]){
      g.beginPath();g.moveTo(x,y-11);g.quadraticCurveTo(x+16,y,x,y+12);g.quadraticCurveTo(x-16,y,x,y-11);g.fill();}
  }else{
    g.beginPath();g.moveTo(68,118);g.bezierCurveTo(42,102,75,88,66,65);
    g.bezierCurveTo(94,82,74,92,88,86);g.bezierCurveTo(97,105,80,121,68,118);g.fill();
  }
  g.globalAlpha=.45;g.lineWidth=1.6;
  for(let row=0;row<3;row++)for(let x=1;x<160;x+=24){g.beginPath();g.arc(x+(row%2)*12,173+row*12,12,Math.PI,2*Math.PI);g.stroke();}
  g.globalAlpha=1;const folds=g.createLinearGradient(0,0,144,0);
  for(const [p,c] of [[0,"#2f223b56"],[.22,"#fff4c71a"],[.46,"#321e321e"],[.73,"#fff2d330"],[1,"#231f332a"]])folds.addColorStop(p,c);
  g.fillStyle=folds;g.fillRect(0,0,144,240);rcFestivalCloths.set(festival,canvas);return canvas;
}
function rcBroadcastFestival(ctx,cloth,left,span,w,h,tau){
  const height=h*.122,base=h*.705;
  for(const [i,p] of RC_FESTIVAL_STATIONS.entries()){
    const x=w*(.08+.86*(p-left)/span);
    if(x< -height||x>w+height)continue;
    const breeze=Math.sin(tau*55*1.8+i),arm=height*(.36+.032*breeze);
    ctx.save();ctx.translate(x,base);ctx.fillStyle="#654e40";ctx.fillRect(-1.6,-height*1.32,3.2,height*1.32);
    ctx.fillStyle="#d6ad62";ctx.fillRect(-3,-height*1.26,arm+7,2);
    ctx.drawImage(cloth,2,-height*1.23,arm,height*.82);ctx.restore();
  }
}
// One painted skyline faces the broadcast bank. Across the valley, the
// original transparent middle-distance plate supplies the opposite shore.
function rcRegionalHorizon(T,scene,sky,town,course,slug,texture){
  const atlas=document.createElement("canvas");atlas.width=4096;atlas.height=768;
  const ink=atlas.getContext("2d"),cap=126,stripH=atlas.height-cap;
  const span=1472,overlap=128;
  const skyStrip=document.createElement("canvas");skyStrip.width=1;skyStrip.height=48;
  const strip=skyStrip.getContext("2d");
  strip.drawImage(sky,0,0,sky.width,sky.height*.49,0,0,1,48);
  const skyColor=y=>{
    const c=strip.getImageData(0,y,1,1).data;
    return "rgb("+c[0]+","+c[1]+","+c[2]+")";
  };
  const air=ink.createLinearGradient(0,0,0,atlas.height);
  air.addColorStop(0,skyColor(0));air.addColorStop(.28,skyColor(5));air.addColorStop(.60,skyColor(32));air.addColorStop(1,skyColor(47));
  ink.fillStyle=air;ink.fillRect(0,0,atlas.width,atlas.height);
  // Both ends of the reverse plate terminate underneath the main painting.
  const reverse=atlas.width-span+overlap*2;
  for(const x of [span-overlap,span-overlap-atlas.width]){
    ink.drawImage(town,0,0,town.width,town.height*.74,x,cap+stripH*.065,reverse,stripH);
  }
  const hero=document.createElement("canvas");hero.width=span+overlap*2;hero.height=atlas.height;
  const g=hero.getContext("2d");
  const bottom=slug==="lumina"||slug==="mistlake"?.73:slug==="vento"?.76:.79;
  g.drawImage(sky,0,0,sky.width,sky.height*bottom,0,cap,hero.width,stripH);
  g.save();g.translate(0,cap);g.scale(1,-1);g.filter="blur(7px)";
  g.drawImage(sky,0,0,sky.width,sky.height*.15,-4,-3,hero.width+8,cap+8);g.restore();
  g.globalCompositeOperation="destination-in";
  const fade=g.createLinearGradient(0,0,hero.width,0);
  fade.addColorStop(0,"transparent");fade.addColorStop(overlap/hero.width,"black");
  fade.addColorStop(1-overlap/hero.width,"black");fade.addColorStop(1,"transparent");
  g.fillStyle=fade;g.fillRect(0,0,hero.width,hero.height);
  const zenith=g.createLinearGradient(0,0,0,cap);zenith.addColorStop(0,"transparent");zenith.addColorStop(1,"black");
  g.fillStyle=zenith;g.fillRect(0,0,hero.width,hero.height);
  ink.drawImage(hero,-overlap,0);ink.drawImage(hero,atlas.width-overlap,0);
  const map=texture(atlas);map.name="venue-panorama";map.wrapS=T.RepeatWrapping;map.repeat.x=-1;
  const focal=({caldera:.21,ringrosso:.43,notte:.36,vento:.28,lumina:.27,mistlake:.40,lapan:.37})[slug]??.45;
  const courseYaw=course.point(course.distance(.53),0).yaw;
  map.offset.x=(courseYaw+Math.PI+.52)/(2*Math.PI)+(focal*hero.width-overlap)/atlas.width;
  const geo=new T.CylinderGeometry(720,720,1100,160,1,true),pos=geo.attributes.position,uv=geo.attributes.uv;
  const low=slug==="caldera"?-195:slug==="vento"?-109:-94,top=slug==="caldera"?165:186;
  for(let i=0;i<pos.count;i++)uv.setY(i,(pos.getY(i)-low)/((top-low)*atlas.height/stripH));
  const dome=new T.Mesh(geo,new T.MeshBasicMaterial({map,side:T.BackSide,fog:false}));
  scene.add(dome);return dome;
}
function rcFestivalHorizon(T,scene,art,course,texture){
  // The main arc faces the championship site. From the opposite bank the
  // spectator sees the home region. Feather both joins around the ring.
  const [main,,,reverse]=art.imgs,atlas=document.createElement("canvas");
  atlas.width=4096;atlas.height=768;
  const ink=atlas.getContext("2d"),layer=document.createElement("canvas");
  const overlap=116,panel=1365;atlas.width=panel*3;layer.width=panel+overlap;layer.height=atlas.height;
  const g=layer.getContext("2d"),fade=g.createLinearGradient(0,0,overlap,0);
  fade.addColorStop(0,"transparent");fade.addColorStop(1,"black");
  for(let i=-1;i<=3;i++){
    const section=(i+3)%3,front=section===0,img=front?main:reverse;
    const left=section===2?.40:0,span=front?1:section===1?.77:.60;
    g.clearRect(0,0,layer.width,layer.height);
    g.drawImage(img,img.width*left,0,img.width*span,img.height*(front?1:.80),0,0,layer.width,layer.height);
    g.globalCompositeOperation="destination-in";g.fillStyle=fade;g.fillRect(0,0,layer.width,layer.height);
    g.globalCompositeOperation="source-over";ink.drawImage(layer,i*panel-overlap,0);
  }
  // Tilt can reveal sky above the painted strip. Extend the clouds into a
  // zenith of one colour; clamping a detailed top scanline produces streaks.
  const domeArt=document.createElement("canvas"),cap=256;
  domeArt.width=atlas.width;domeArt.height=atlas.height+cap;
  const sky=domeArt.getContext("2d"),swatch=document.createElement("canvas");
  swatch.width=swatch.height=1;
  const pick=swatch.getContext("2d");pick.drawImage(atlas,0,0,atlas.width,48,0,0,1,1);
  const [r,gc,b]=pick.getImageData(0,0,1,1).data,color=r+","+gc+","+b;
  sky.fillStyle="rgb("+color+")";sky.fillRect(0,0,domeArt.width,domeArt.height);
  sky.save();sky.translate(0,cap);sky.scale(1,-1);sky.filter="blur(12px)";
  sky.drawImage(atlas,0,0,atlas.width,190,-5,-6,atlas.width+10,cap+18);sky.restore();
  sky.drawImage(atlas,0,cap);
  const zenith=sky.createLinearGradient(0,0,0,cap+18);
  zenith.addColorStop(0,"rgb("+color+")");zenith.addColorStop(.22,"rgb("+color+")");
  zenith.addColorStop(.83,"rgba("+color+",.12)");zenith.addColorStop(1,"rgba("+color+",0)");
  sky.fillStyle=zenith;sky.fillRect(0,0,atlas.width,cap+18);
  const map=texture(domeArt);map.name="venue-panorama";map.wrapS=T.RepeatWrapping;map.repeat.x=-1;
  const bend=course.point(course.distance(.55),0).yaw;
  map.offset.x=(bend+Math.PI)/(2*Math.PI)+.29;
  const geo=new T.CylinderGeometry(720,720,1100,160,1,true),uv=geo.attributes.uv,pos=geo.attributes.position;
  for(let i=0;i<pos.count;i++)uv.setY(i,(pos.getY(i)+292)/(410*domeArt.height/atlas.height));
  const dome=new T.Mesh(geo,new T.MeshBasicMaterial({map,side:T.BackSide,fog:false}));
  scene.add(dome);return dome;
}
function rcChaseFestival(T,scene,course,width,festival,clock,texture,night){
  const cloth=rcFestivalStandard(festival),matrix=new T.Object3D(),posts=[],arms=[],feet=[],crowns=[],flags=[],bowls=[],lights=[];
  function put(batch,p,y,w,h,d){
    matrix.position.set(p.x,p.y+y,p.z);matrix.rotation.set(0,p.yaw,0);matrix.scale.set(w,h,d);matrix.updateMatrix();batch.push(matrix.matrix.clone());
  }
  for(let j=0;j<RC_FESTIVAL_STATIONS.length;j++)for(const side of [-1,1]){
    // Leave the last stretch of the camera-side verge open for a photo finish.
    const stagger=side<0?0:j===RC_FESTIVAL_STATIONS.length-1?-.025:.018;
    const p=RC_FESTIVAL_STATIONS[j]+stagger,s=course.distance(p);
    const at=course.point(s,side*(width+5.8)),high=j>7?5.8:4.8;
    put(feet,at,-1.7,1.3,4.6,1.3);put(posts,at,high*.43,.20,high*1.15,.20);
    const arm=course.point(s+1.10,side*(width+5.8));
    put(arms,arm,high,2.7,.12,.12);put(crowns,at,high+.2,.38,.55,.38);
    put(flags,arm,high-1.58,2.15,3.0,1);
    const lamp=course.point(s-2.6,side*(width+4.65));
    put(feet,lamp,-1.65,1.08,4.1,1.08);put(bowls,lamp,.58,1.12,.32,1.12);
    put(lights,lamp,1.02,.67,festival.sign==="hare"?.85:1.05,.67);
    if(festival.sign==="hare")put(bowls,lamp,1.50,.86,.18,.86);
  }
  function batch(geometry,material,items){
    const m=new T.InstancedMesh(geometry,material,items.length);
    items.forEach((a,i)=>m.setMatrixAt(i,a));scene.add(m);
  }
  const metal=new T.MeshStandardMaterial({color:0xc69b52,metalness:.37,roughness:.48});
  batch(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({color:festival.pole}),posts);
  batch(new T.BoxGeometry(1,1,1),metal,arms);
  batch(new T.CylinderGeometry(.46,.62,1,8),new T.MeshStandardMaterial({color:festival.sign==="hare"?0x968b82:0x534445}),feet);
  batch(new T.OctahedronGeometry(.6),metal,crowns);
  batch(new T.CylinderGeometry(.62,.34,1,12),metal,bowls);
  const paper=festival.sign==="hare",bulbs=new T.MeshBasicMaterial({color:paper?0xffda98:0xffaf4b});
  batch(paper?new T.SphereGeometry(.58,12,10):new T.OctahedronGeometry(.69,1),bulbs,lights);
  const silk=new T.MeshBasicMaterial({map:texture(cloth),side:T.DoubleSide,alphaTest:.4,color:night?0xb4afbd:0xffffff});
  silk.onBeforeCompile=s=>{
    s.uniforms.windTime=clock;
    s.vertexShader="uniform float windTime;\n"+s.vertexShader.replace("#include <begin_vertex>",[
      "#include <begin_vertex>","float t=1.0-uv.y;",
      "float phase=windTime*2.0+instanceMatrix[3].x*.11+instanceMatrix[3].z*.09;",
      "transformed.z+=t*(.19+.24*sin(phase+4.*t+uv.x*1.6));",
      "transformed.x+=.08*t*sin(phase*.9+5.*t);"].join("\n"));
  };
  batch(new T.PlaneGeometry(1,1,6,12),silk,flags);
}

// Keep mist and vent plumes in their valleys. As the lens turns, the bank
// and the racing dragons naturally pass in front of them.
function rcIslandAir(T,scene,course,land,slug,festival,clock,texture,time){
  const steam=slug==="caldera",spray=festival?.vista==="ryuo",cloud=festival?.vista==="shinto";
  if(!steam && !spray && !cloud && !land.lake && slug!=="vento")return;
  const stamp=document.createElement("canvas");stamp.width=128;stamp.height=96;
  const g=stamp.getContext("2d");
  for(let i=0;i<14;i++){
    const x=26+i*5.4,y=46+10*Math.sin(i*1.94),r=17+9*Math.sin(i*1.47)**2;
    const fade=g.createRadialGradient(x,y,0,x,y,r);
    fade.addColorStop(0,"rgba(255,255,255,.27)");fade.addColorStop(.55,"rgba(255,255,255,.11)");fade.addColorStop(1,"transparent");
    g.fillStyle=fade;g.fillRect(x-r,y-r,2*r,2*r);
  }
  const geometry=new T.InstancedBufferGeometry(),quad=new T.PlaneGeometry(1,1);
  geometry.copy(quad);quad.dispose();
  const positions=[],shapes=[];
  for(let j=0;j<14;j++)for(const side of [-1,1]){
    const s=course.distance((j+.3+.18*Math.sin(j*13+side))/14);
    const u=(s-course.start)/(course.end-course.start);
    const p=land.terrain(u,(land.lake?.15:.30)+.14*Math.sin(j*3.21)**2,side);
    const y=cloud?p.y-4:land.lake?-5.15:p.y-.6;
    const breadth=(steam?9:spray?12:cloud?42:27)*(1+.22*Math.sin(j*7+side));
    for(let puff=0;puff<(steam||spray?3:2);puff++){
      positions.push(p.x,y,p.z);shapes.push(breadth,steam?12:spray?6:cloud?12:5,j*1.618+puff*.337+side*.11,steam?11:spray?6:2.0);
    }
  }
  geometry.setAttribute("airRoot",new T.InstancedBufferAttribute(new Float32Array(positions),3));
  geometry.setAttribute("airShape",new T.InstancedBufferAttribute(new Float32Array(shapes),4));
  geometry.instanceCount=positions.length/3;
  const material=new T.MeshBasicMaterial({map:texture(stamp),transparent:true,depthWrite:false,
    color:time==="night"?0x8595b6:steam?0xe0c1b1:slug==="vento"?0xdfc9af:0xd9eef3,opacity:cloud?.63:steam?.58:.39});
  material.onBeforeCompile=s=>{
    s.uniforms.airClock=clock;
    s.vertexShader="uniform float airClock; attribute vec3 airRoot; attribute vec4 airShape; varying float density;\n"+s.vertexShader.replace("#include <begin_vertex>",[
      "float age=fract(airClock*.105+airShape.z); density=sin(age*3.14159);",
      "vec3 right=normalize(vec3(viewMatrix[0][0],0.,viewMatrix[2][0]));",
      "vec3 transformed=airRoot+vec3(age*(3.+.32*airShape.x),age*airShape.w,age*1.5);",
      "transformed+=right*position.x*airShape.x*(.75+.48*age);",
      "transformed.y+=(position.y+.28)*airShape.y*(.64+.64*age);"].join("\n"));
    s.fragmentShader="varying float density;\n"+s.fragmentShader.replace("#include <alphamap_fragment>","#include <alphamap_fragment>\ndiffuseColor.a*=density;");
  };
  const haze=new T.Mesh(geometry,material);haze.frustumCulled=false;scene.add(haze);
}

// The processional road disappears into the cloud sea before its modelled end.
function rcShrineCloudVeil(material){
  const prepare=material.onBeforeCompile, key=material.customProgramCacheKey();
  material.customProgramCacheKey=()=>key+"-shrine-clouds";
  material.onBeforeCompile=function(shader,renderer){
    prepare.call(this,shader,renderer);
    shader.fragmentShader=shader.fragmentShader.replace("#include <fog_fragment>",[
      "#include <fog_fragment>",
      "#ifdef USE_FOG",
      "float cloudCover=smoothstep(175.,410.,vFogDepth);",
      "vec2 cell=mod(floor(gl_FragCoord.xy),4.);",
      "vec2 low=mod(cell,2.), high=floor(cell*.5);",
      "float rank=(2.*low.x+3.*low.y-4.*low.x*low.y)*4.+2.*high.x+3.*high.y-4.*high.x*high.y;",
      "if(cloudCover>(rank+.5)/16.)discard;",
      "#endif"
    ].join("\n"));
  };
}
function rcShrinePaving(material,width){
  material.onBeforeCompile=s=>{
    s.uniforms.shrineWidth={value:width};
    s.vertexShader="attribute vec2 roadCoord; varying vec2 stonePoint;\n"+s.vertexShader.replace("#include <uv_vertex>","#include <uv_vertex>\nstonePoint=roadCoord;");
    s.fragmentShader="uniform float shrineWidth; varying vec2 stonePoint;\n"+s.fragmentShader.replace("#include <color_fragment>",[
      "#include <color_fragment>",
      "float row=floor(stonePoint.y/2.7);",
      "vec2 tile=vec2(stonePoint.x/4.9+.5*mod(row,2.),stonePoint.y/2.7);",
      "vec2 edge=min(fract(tile),1.-fract(tile))*vec2(4.9,2.7);",
      "float joint=1.-smoothstep(.013,.042,min(edge.x,edge.y));",
      "float grain=fract(sin(dot(floor(tile),vec2(23.51,68.17)))*1357.4);",
      "diffuseColor.rgb*=.96+.065*grain-.16*joint;",
      "float rim=shrineWidth-abs(stonePoint.y);",
      "float brass=1.-smoothstep(.014,.055,min(abs(rim-.72),abs(rim-1.13)));",
      "diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.55,.37,.15),.74*brass);"
    ].join("\n"));
  };
}

function rcShrineCliffs(T,scene,course,land,limestone,clock,texture,time,treeSites){
  const pillars=[],falls=[],matrix=new T.Object3D();
  for(const side of [-1,1])for(let j=0;j<11;j++){
    const s=course.distance((j+.28+.13*Math.sin(j*4.1+side))/11);
    for(let k=0;k<4;k++){
      const u=(s+k*3.3-course.start)/(course.end-course.start);
      const p=land.terrain(u,.26+.13*Math.sin(j*2.73+side)**2+.035*k,side);
      const radius=2.7+1.4*Math.sin(j*6.8+k*1.6)**2;
      const height=12+6*Math.sin(j*3+side)+4*Math.cos(k*1.81);
      matrix.position.set(p.x,p.y+height*.46-1.4,p.z);matrix.rotation.set(0,p.yaw+.25*k,.035*Math.sin(j));
      matrix.scale.set(radius,height,radius*.85);matrix.updateMatrix();pillars.push(matrix.matrix.clone());
      if(k===0 && j%3!==2){
        treeSites.push({pos:{x:p.x,y:p.y+height*.96-1.7,z:p.z},height:8.4+2.8*Math.cos(j*1.7+side),flip:j%2?1:-1});
      }
      if(k!==0 || j%3!==1)continue;
      matrix.position.set(p.x-side*radius*.74*Math.sin(p.yaw),p.y+height*.46-2,p.z-side*radius*.74*Math.cos(p.yaw));
      matrix.rotation.set(0,p.yaw,0);matrix.scale.set(radius*.79,height*1.05,1);matrix.updateMatrix();falls.push(matrix.matrix.clone());
    }
  }
  const tint=time==="night"?0x868ea2:time==="dusk"?0xb2a5bd:0xe2e5df;
  const rock=new T.InstancedMesh(new T.CylinderGeometry(.74,1,1,7,1),
    new T.MeshLambertMaterial({map:limestone,color:tint,flatShading:true}),pillars.length);
  pillars.forEach((m,i)=>rock.setMatrixAt(i,m));scene.add(rock);
  const sheet=document.createElement("canvas");sheet.width=96;sheet.height=128;
  const g=sheet.getContext("2d");
  for(let x=0;x<96;x++){
    const strength=Math.sin(Math.PI*x/96)**.55;
    for(let y=0;y<128;y+=2){
      const ripples=.46+.25*Math.cos(y*Math.PI/64+x*.25)+.14*Math.cos(x*1.723+Math.sin(y*Math.PI/32));
      g.fillStyle="rgba(220,247,255,"+(strength*ripples).toFixed(3)+")";g.fillRect(x,y,1,2);
    }
  }
  const waterMap=texture(sheet);waterMap.wrapT=T.RepeatWrapping;
  const water=new T.MeshBasicMaterial({map:waterMap,transparent:true,depthWrite:false,side:T.DoubleSide,color:tint});
  water.onBeforeCompile=s=>{
    s.uniforms.flowTime=clock;
    s.vertexShader="uniform float flowTime;\n"+s.vertexShader.replace("#include <uv_vertex>","#include <uv_vertex>\nvMapUv.y+=flowTime*.60;");
  };
  const spouts=new T.InstancedMesh(new T.PlaneGeometry(1,1),water,falls.length);
  falls.forEach((m,i)=>spouts.setMatrixAt(i,m));scene.add(spouts);
}
