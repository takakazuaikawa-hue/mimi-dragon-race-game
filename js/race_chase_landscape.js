/* Continuous verges, cliff shelves and shores share course coordinates with
   the track. Details are sampled on those surfaces so their roots stay planted. */
function rcChaseLandscape(T, course, width, slug, venue){
  const cliff=slug==="vento" || slug==="caldera";
  const lake=slug==="mistlake" || slug==="lumina";
  const sections=course.grand?260:480;
  const levels=cliff?[0,.12,.24,.34,.45,.49,.55,.62,.68,.72,.82,.89,.94,1,1.15,1.35]:
    [0,.12,.24,.38,.5,.64,.78,.90,1,1.12,1.28];
  const length=course.end-course.start;
  function terrain(u,v,side){
    const s=course.start+u*length;
    const swell=Math.sin(s*.023+side*2)+.46*Math.sin(s*.057-side)+.19*Math.sin(s*.127+side);
    const cove=lake?16*Math.sin(s*.019+side):0;
    const toe=lake?width+78+cove:width+17;
    const ripple=Math.sin(s*.073+v*3.5)*.7+Math.sin(s*.153-side)*.3;
    const reach=toe+v*(cliff?104:82)+v*(1-v)*(8*swell+5*ripple);
    const a=course.point(s-1,0).yaw,b=course.point(s+1,0).yaw;
    const bend=Math.atan2(Math.sin(b-a),Math.cos(b-a))*.5;
    // Inner banks narrow through tight turns. Keep rows ordered inside the bend.
    const room=bend*side<-.001?Math.max(4,.94/Math.abs(bend)-width):Infinity;
    const extra=reach-width;
    const offset=Number.isFinite(room)?width+room*-Math.expm1(-extra/room):reach;
    const p=course.point(s,side*offset);
    let relief;
    if(cliff){
      const terrace=T.MathUtils.smoothstep(v,.13,.45)*.32+
        T.MathUtils.smoothstep(v,.49,.68)*.35+T.MathUtils.smoothstep(v,.73,.95)*.33;
      const massif=T.MathUtils.smoothstep(Math.sin(s*.028+side)+.57*Math.cos(s*.037),-.14,.88);
      const progress=s/course.distance(1);
      const opening=venue==="entei"||venue==="hansho"?T.MathUtils.smoothstep(progress,.20,.43)*(1-T.MathUtils.smoothstep(progress,.65,.88)):0;
      const peak=-7+((slug==="vento"?15:18)+(venue==="entei"?6:0)+swell*3.5+ripple)*massif*(1-.63*opening);
      relief=-9+terrace*(peak+9)+v*(1-v)*2*ripple;
      relief-=T.MathUtils.smoothstep(v,.94,1.35)*(peak+28);
    }else{
      relief=-8.9+T.MathUtils.smoothstep(v,.05,.9)*((lake?6.2:slug==="ringrosso"?10:7.5)+swell*(lake?1.7:2.2));
    }
    if(venue==="shinto")relief-=8+10*T.MathUtils.smoothstep(v,.07,.62);
    if(!cliff)relief-=14*T.MathUtils.smoothstep(v,.93,1.28);
    p.y+=relief;
    return p;
  }
  function geometry(side){
    const positions=[],uv=[],flow=[],colors=[],indices=[];
    for(let i=0;i<=sections;i++){
      const u=i/sections;
      for(let j=0;j<levels.length;j++){
        const v=levels[j],p=terrain(u,v,side);positions.push(p.x,p.y,p.z);
        if(venue==="shinto")uv.push(u*length/9,v*9);
        else uv.push((p.x+p.z*.16)/11,(p.z+p.y*.55)/9);
        flow.push(u*length/17+.11*Math.sin(19*v+u*9),v*5.8+p.y*.026);
        const light=.69+.20*v+.055*Math.sin(u*47+side)+.035*Math.sin(v*28+u*11);
        colors.push(light,light*.985,light*.965);
        if(i && j){const k=i*levels.length+j;indices.push(k-levels.length-1,k-1,k,k-levels.length-1,k,k-levels.length);}
      }
    }
    const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(positions,3));
    g.setAttribute("color",new T.Float32BufferAttribute(colors,3));g.setAttribute("uv",new T.Float32BufferAttribute(uv,2));
    g.setAttribute("flowCoord",new T.Float32BufferAttribute(flow,2));
    g.setIndex(indices);g.computeVertexNormals();
    const normals=g.attributes.normal,shades=g.attributes.color;
    for(let i=0;i<normals.count;i++){
      const up=normals.getY(i)<0?-1:1;
      const light=.88+.23*Math.max(0,up*(-.40*normals.getX(i)+.69*normals.getY(i)+.53*normals.getZ(i)));
      shades.setXYZ(i,shades.getX(i)*light,shades.getY(i)*light,shades.getZ(i)*light);
    }
    return g;
  }
  function vergeGeometry(side){
    const distances=[0,.045,.13,.27,.43,.65,.82,1],positions=[],uv=[],flow=[],shades=[],indices=[];
    for(let i=0;i<=sections;i++){
      const u=i/sections,s=course.start+u*length,edge=course.point(s,side*width);
      const variation=Math.sin(s*.12+side)+.48*Math.sin(s*.31-side);
      const toe=!lake?terrain(u,0,side):course.point(s,side*(width+18+variation*3.8));
      const drop=!lake?toe.y-edge.y:-8.6;
      for(let j=0;j<distances.length;j++){
        const v=distances[j],weight=v+.05*Math.sin(v*Math.PI)*variation;
        const x=T.MathUtils.lerp(edge.x,toe.x,weight),z=T.MathUtils.lerp(edge.z,toe.z,weight);
        const ledge=T.MathUtils.smoothstep(v,.05,.86);
        const y=edge.y+drop*ledge+Math.sin(v*Math.PI)*variation*.51-.06;
        positions.push(x,y,z);
        if(venue==="shinto")uv.push(s/9,v*2.4);
        else uv.push((x+z*.16)/11,(z+y*.55)/9);
        flow.push(u*length/17+.11*Math.sin(u*9),(v-1)*1.1+y*.026);
        const light=.78+.15*v+.045*variation;shades.push(light,light,light);
        if(i && j){const k=i*distances.length+j;indices.push(k-distances.length-1,k-1,k,k-distances.length-1,k,k-distances.length);}
      }
    }
    const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(positions,3));
    g.setAttribute("uv",new T.Float32BufferAttribute(uv,2));g.setAttribute("color",new T.Float32BufferAttribute(shades,3));
    g.setAttribute("flowCoord",new T.Float32BufferAttribute(flow,2));g.setIndex(indices);return g;
  }
  return {terrain,geometry,vergeGeometry,cliff,lake};
}

// Broken reflections of the lamps on either edge of the wet road.
function rcWetShoulder(material,width,length){
  material.onBeforeCompile=shader=>{
    shader.uniforms.roadSize={value:[width,length]};
    shader.vertexShader="attribute vec2 roadCoord; varying vec2 wetPoint;\n"+shader.vertexShader.replace(
      "#include <begin_vertex>","#include <begin_vertex>\nwetPoint=roadCoord;");
    shader.fragmentShader="uniform vec2 roadSize; varying vec2 wetPoint;\n"+shader.fragmentShader.replace("#include <color_fragment>",`
      #include <color_fragment>
      float period=roadSize.y/12.;
      float x=mod(wetPoint.x+period*.5,period)-period*.5;
      float d=roadSize.x-abs(wetPoint.y);
      float grain=sin(wetPoint.y*9.8+2.2*sin(wetPoint.x*2.3)+sin(wetPoint.y*1.7));
      float streak=exp(-x*x/(.32+.22*d)-d*.48)*(.44+.56*smoothstep(-.65,.82,grain));
      diffuseColor.rgb+=vec3(.59,.28,.072)*streak*step(0.,wetPoint.x)*step(wetPoint.x,roadSize.y);
    `);
  };
}
// Lava forks follow the course and the fall line.
function rcLavaStrata(material,clock){
  material.onBeforeCompile=shader=>{
    shader.uniforms.lavaTime=clock;
    shader.vertexShader="attribute vec2 flowCoord; varying vec2 slopeUV;\n"+shader.vertexShader.replace("#include <uv_vertex>",
      "#include <uv_vertex>\nslopeUV=flowCoord;");
    shader.fragmentShader="uniform float lavaTime; varying vec2 slopeUV;\n"+shader.fragmentShader.replace("#include <color_fragment>",`
      #include <color_fragment>
      vec2 p=slopeUV;
      float grain=sin(p.x*7.1+p.y*4.4+sin(p.y*12.))+ .44*sin(p.x*16.9-p.y*9.);
      float path=p.x*.16+.012*grain+.13*sin(p.y*1.6+p.x*.32)+.062*sin(p.y*4.7+p.x*1.2)+.020*sin(p.y*13.);
      float split=.08*sin(p.y*1.5+.4);
      float core=min(abs(fract(path+.5)-.5),abs(fract(path+split+.5)-.5)+.005);
      float coverage=smoothstep(-.7,.45,sin(p.x*.13+1.7))*(1.-smoothstep(4.4,6.0,p.y));
      float crust=smoothstep(-.77,.45,grain+.42*sin(p.y*5.-p.x*1.4));
      float glow=1.-smoothstep(.003,.024,core);
      diffuseColor.rgb*=vec3(.77,.70,.74);
      float pulse=.84+.16*sin(p.y*5.2+p.x*.5+lavaTime*1.7);
      diffuseColor.rgb+=coverage*pulse*(.22+.78*crust)*(glow*vec3(.58,.060,.005)+(1.-smoothstep(.001,.008,core))*vec3(.47,.22,.036));
    `);
  };
}
// Project the actual reflected shore, lamps and sky onto the lake. The road,
 // banks and trees share world positions with the main view.
function rcChaseLake(T,material,haze,clock){
  const target=new T.WebGLRenderTarget(1,1,{depthBuffer:true});
  const lens=new T.PerspectiveCamera(),matrix=new T.Matrix4(),advance=new T.Vector3();
  const previousEye=new T.Vector3(Infinity,Infinity,Infinity),previousLook=new T.Quaternion();
  let lastFov=-1;
  const planeY=-5.4;
  const clip=[new T.Plane(new T.Vector3(0,1,0),-planeY+.03)];
  material.transparent=true;
  material.depthWrite=false;
  material.color.copy(haze).lerp(new T.Color(0x304748),.80);
  material.onBeforeCompile=shader=>{
    shader.uniforms.shore={value:target.texture};shader.uniforms.reflectionVP={value:matrix};
    shader.uniforms.lakeTime=clock;
    shader.vertexShader="uniform mat4 reflectionVP; varying vec4 reflectionClip; varying vec3 lakePoint;\n"+shader.vertexShader.replace("#include <begin_vertex>",
      "#include <begin_vertex>\nlakePoint=(modelMatrix*vec4(transformed,1.)).xyz; reflectionClip=reflectionVP*vec4(lakePoint,1.);");
    shader.fragmentShader="varying vec4 reflectionClip; varying vec3 lakePoint; uniform sampler2D shore; uniform float lakeTime;\n"+shader.fragmentShader.replace("#include <color_fragment>",`
      #include <color_fragment>
      vec3 ray=cameraPosition-lakePoint;
      vec2 uv=reflectionClip.xy/reflectionClip.w*.5+.5;
      float d=length(ray), fresnel=pow(1.-abs(normalize(ray).y),3.);
      float a=dot(lakePoint.xz,vec2(.47,1.9)), b=dot(lakePoint.xz,vec2(-1.48,.59));
      float wave=sin(a+.74*sin(b*.23)+lakeTime)+.44*sin(b*2.4-lakeTime*.63);
      float falloff=1.-smoothstep(.14,1.15,fwidth(a));
      uv+=vec2(sin(b+lakeTime),wave)*vec2(.0018,.0042)*falloff;
      // Let the painted, fog-bound waterline take over beyond the shore.
      diffuseColor.a*=1.-smoothstep(105.,295.,d);
      vec3 shoreLight=texture2D(shore,clamp(uv,.002,.998)).rgb;
      diffuseColor.rgb=mix(diffuseColor.rgb,shoreLight,.46+.34*fresnel);
      diffuseColor.rgb+=vec3(.014,.019,.022)*smoothstep(.71,1.36,wave)*falloff;
    `);
  };
  material.needsUpdate=true;
  return {
    render(renderer,scene,camera,water,models,w,h,lowSpec){
      const width=Math.min(lowSpec?272:512,Math.max(160,Math.round(w*.52))),height=Math.max(80,Math.round(width*h/w));
      // Only scenery is reflected. Tiny lens moves can reproject the same image.
      if(target.width===width && target.height===height && Math.abs(lastFov-camera.fov)<.12 &&
        previousEye.distanceToSquared(camera.position)<(lowSpec?1:.12) && previousLook.angleTo(camera.quaternion)<.012)return;
      previousEye.copy(camera.position);previousLook.copy(camera.quaternion);lastFov=camera.fov;
      if(target.width!==width || target.height!==height)target.setSize(width,height);
      lens.copy(camera,false);lens.position.y=2*planeY-camera.position.y;
      camera.getWorldDirection(advance);advance.y*=-1;advance.add(lens.position);
      lens.up.set(0,-1,0);lens.lookAt(advance);lens.updateMatrixWorld();
      matrix.multiplyMatrices(lens.projectionMatrix,lens.matrixWorldInverse);
      const previous=renderer.getRenderTarget(),planes=renderer.clippingPlanes;
      try{
        water.visible=false;for(const m of models.values())m.group.visible=false;
        renderer.clippingPlanes=clip;renderer.setRenderTarget(target);renderer.render(scene,lens);
      }finally{
        renderer.setRenderTarget(previous);renderer.clippingPlanes=planes;water.visible=true;
        for(const m of models.values())m.group.visible=true;
      }
    },
    dispose(){target.dispose();}
  };
}

// Each species shares one draw call. Upright sprites turn about their fixed
// roots; the ridge, shore, buildings and course retain their world geometry.
// Fine sprays grow from a central stem; one transparent texture serves a stand
// of varied heights. Keep gaps between the upper branches against the mist.
function rcLakesideFir(){
  const image=document.createElement("canvas");image.width=152;image.height=228;
  const p=image.getContext("2d");
  let state=73;const rand=()=>((state=Math.imul(state,1664525)+1013904223>>>0)/4294967296);
  p.fillStyle="#373e39";p.beginPath();p.moveTo(77,2);p.lineTo(79,226);p.lineTo(74,226);p.fill();
  for(let tier=36;tier>=0;tier--){
    const y=9+tier*5.0,spread=1.48*tier+3;
    for(const side of [-1,1]){
      const reach=spread*(.69+.44*rand()),sag=4+reach*.28,base=76+Math.sin(tier*.6)*1.1;
      for(let k=0;k<30;k++){
        const u=k/29, x=base+side*reach*u;
        const by=y+sag*Math.sin(u*2.1),tips=(4+spread*.28)*(1-u*.66)*(.5+rand());
        const light=Math.round(27+23*rand()+9*u+(side<0?6:0));
        p.strokeStyle="rgb("+light+","+(light+15)+","+(light+13)+")";p.lineWidth=1.5+2*(1-u);
        p.beginPath();p.moveTo(x,by);p.lineTo(x+side*(2+tips*.30),by+tips);p.stroke();
      }
    }
  }
  return image;
}

function rcTracksidePlants(T,scene,course,width,slug,land,time,textures,ready,isDisposed,shrineTrees=[]){
  const high=land.cliff,lake=land.lake,grand=slug==="grandclock";
  const species=slug==="caldera" || slug==="ringrosso"?["volcano_rock","volcano_bush"]:
    slug==="vento"?["cliff_rock","cliff_bush"]:lake?["grass_rock","sea_bush"]:["grass_rock","grass_bush"];
  if(slug==="mistlake")species.push("fir");
  if(shrineTrees.length)species.push("shrine_cherry");
  const batches=species.map(()=>[]);
  if(shrineTrees.length)batches[batches.length-1]=shrineTrees;
  for(const side of [-1,1])for(let i=0;i<(grand?35:51);i++){
    const hash=k=>{const n=Math.sin(i*97.31+k*23.73+side*31.47)*4579.92;return n-Math.floor(n)};
    const u=(i+.14+.68*hash(1))/(grand?35:51),s=course.start+u*(course.end-course.start);
    if(slug==="mistlake" && hash(11)>.22){
      for(let j=0;j<7;j++){
        const v=.48+.44*hash(20+j);
        const pos=land.terrain(u+(hash(42+j)-.5)*.022,v,side);
        if(pos.y>-5.34)batches[2].push({pos,height:4.3+hash(60+j)*7,flip:hash(78+j)>.5?1:-1});
      }
    }
    for(let n=0;n<1+Math.floor(hash(2)*3);n++){
      const v=.18+.49*hash(7+n);
      const pos=grand?course.point(s+n*1.7,side*(width+3+hash(3+n)*9)):
        land.terrain(u+.0018*n,v,side);
      if(lake && pos.y< -5.55)continue;
      const kind=!grand && n===0 && hash(8)<.53?0:1;
      const height=(grand?.75:high?kind===0?3.6:2.5:lake?1.4:1.9)*(.52+hash(4+n)*.9);
      batches[kind].push({pos,height,flip:hash(5+n)>.5?1:-1});
    }
  }
  species.forEach((name,kind)=>{
    const batch=batches[kind];if(!batch.length)return;
    function place(img){
      if(isDisposed())return;
      const geo=new T.InstancedBufferGeometry(),quad=new T.PlaneGeometry(1,1);
      geo.copy(quad);quad.dispose();
      const anchors=[],sizes=[];
      for(const {pos,height,flip} of batch){
        anchors.push(pos.x,pos.y-(name==="shrine_cherry"?.015:kind===0?.24:.10)*height,pos.z);
        sizes.push(height*img.width/img.height*flip,height);
      }
      geo.setAttribute("rootPoint",new T.InstancedBufferAttribute(new Float32Array(anchors),3));
      geo.setAttribute("plantSize",new T.InstancedBufferAttribute(new Float32Array(sizes),2));geo.instanceCount=batch.length;
      const map=new T.Texture(img);map.colorSpace=T.SRGBColorSpace;map.needsUpdate=true;textures.push(map);
      const material=new T.MeshBasicMaterial({map,side:T.DoubleSide,alphaTest:.42,
        color:time==="night"?0x798397:time==="dusk"?0xa397a9:time==="sunset"?0xcfab96:high?0xb8ac9e:0xd6d8c8});
      material.onBeforeCompile=shader=>{
        shader.vertexShader="attribute vec3 rootPoint;\nattribute vec2 plantSize;\n"+shader.vertexShader.replace("#include <begin_vertex>",
          "vec3 across=normalize(vec3(viewMatrix[0][0],0.,viewMatrix[2][0])); vec3 transformed=rootPoint+across*position.x*plantSize.x+vec3(0.,(position.y+.5)*plantSize.y,0.);");
      };
      const plants=new T.Mesh(geo,material);plants.frustumCulled=false;scene.add(plants);ready();
    };
    if(name==="fir")queueMicrotask(()=>{if(!isDisposed())place(rcLakesideFir());});
    else {
      const img=new Image();img.onload=()=>place(img);img.src="images/scout/props/"+name+".webp";
    }
  });
}
