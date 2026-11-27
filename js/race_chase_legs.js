/* Build four closed limbs from the near foreleg and hind leg in each racing
   painting. Coordinates below use the body cutout, including toes which
   extend left into the adjacent tail cutout. */
const RC_LEG_LANDMARKS = {
  // underside, hind toe X/Y, fore toe X/Y, leg shape
  akane:[.72,-.045,.94,.367,.99], arashi:[.72,-.047,.95,.363,.99],
  banju:[.79,-.052,.97,.394,.99], baran:[.78,.014,.94,.385,.99],
  benio:[.73,-.04,.95,.371,.99], chiri:[.78,-.047,.96,.407,.91,"fold"],
  enma:[.72,-.04,.96,.342,.99], fugaku:[.78,-.049,.96,.375,.99],
  gando:[.79,-.051,.90,.397,.94], gekka:[.81,-.048,.99,.414,.93,"fold"],
  glaze:[.76,-.034,.96,.39,.99], goka:[.72,-.037,.96,.386,.99],
  goro:[.79,-.038,.96,.385,.99], gozan:[.79,-.043,.96,.40,.99],
  guren:[.74,-.014,.95,.402,.99], hayao:[.73,-.043,.95,.367,.99],
  hayate:[.72,-.03,.93,.38,.99], hibana:[.72,-.028,.96,.386,.99],
  kabe:[.72,-.083,.99,.348,.98], kazemaru:[.72,-.035,.96,.375,.99],
  kirari:[.62,-.052,.90,.412,.94,"talon"], kogane:[.73,-.028,.97,.38,.99],
  konron:[.78,-.056,.96,.396,.99], miruka:[.75,-.064,.94,.299,.98],
  momu:[.78,-.035,.97,.368,.99], murasame:[.78,-.027,.96,.442,.99,"fold"],
  nagi:[.73,-.042,.96,.382,.99], phenix:[.87,.049,.97,.307,.99,"fold"],
  poro:[.81,-.142,.94,.302,.99], raijin:[.74,-.036,.98,.379,.99],
  raika:[.75,-.041,.96,.391,.99], raiou:[.77,-.022,.96,.399,.99],
  reppu:[.65,-.05,.93,.466,.99,"talon"], rosso:[.64,-.096,.96,.46,.99,"talon"],
  rubel:[.71,.045,.84,.349,.99], sazare:[.64,-.062,.96,.44,.99,"talon"],
  senpu:[.59,-.062,.91,.459,.96,"talon"], seram:[.70,-.049,.89,.366,.99],
  shakunetsu:[.76,-.024,.97,.4,.99], shio:[.73,-.039,.94,.398,.99],
  shirahae:[.80,-.004,.98,.373,.93,"fold"], sora:[.73,-.047,.96,.38,.99],
  souten:[.79,-.048,.96,.376,.99], stella:[.74,-.039,.98,.386,.99],
  susu:[.75,-.018,.95,.401,.99], taiga:[.76,-.059,.96,.309,.99],
  tenku:[.73,-.036,.96,.385,.99], tsumuji:[.64,-.041,.99,.452,.90,"talon"],
  yoi:[.79,-.003,.98,.436,.97,"fold"], yomi:[.77,-.048,.95,.458,.95,"fold"],
  yugiri:[.76,-.066,.99,.473,.91,"fold"], yumeji:[.75,-.041,.94,.433,.98,"fold"]
};

function rcChaseLegs(T,id,body,canvas,rect,b,k,texture,winged){
  const fit=RC_LEG_LANDMARKS[id];
  if(!fit)return null;
  const [belly,hindX,hindY,foreX,foreY,shape]=fit;
  const pen=canvas.getContext("2d"),w=canvas.width,h=canvas.height;
  const px=x=>rect.x-b.x+x*rect.w,py=y=>rect.y-b.y+y*rect.h;
  // Only the painted legs need a second texture. Preserve original pixel density.
  const ax=Math.max(0,Math.floor(px(Math.min(hindX,foreX)-.18)));
  const ay=Math.max(0,Math.floor(py(belly-.36)));
  const aw=Math.min(w,Math.ceil(px(Math.max(hindX,foreX)+.29)))-ax;
  const ah=Math.min(h,Math.ceil(py(Math.max(hindY,foreY)+.015)))-ay;
  const original=document.createElement("canvas");original.width=aw;original.height=ah;
  const atlas=original.getContext("2d",{willReadFrequently:true});
  atlas.drawImage(canvas,ax,ay,aw,ah,0,0,aw,ah);
  const pixels=atlas.getImageData(0,0,aw,ah).data;
  const modelX=x=>(px(x)-b.w/2)*k,modelY=y=>(b.h-py(y))*k;
  const positions=[],uv=[],colors=[],indices=[],joints=[],weights=[],bones=[],legs=[];
  const sections=20,rows=29;
  function limb(fore,toe,sole,side){
    const curled=fore && shape==="talon",folded=fore && shape==="fold";
    const hip=toe+(fore?(curled?-.025:.078):.188);
    const knee=toe+(fore?(curled?-.082:folded?-.015:-.009):.09);
    const wrist=toe+(fore?.025:.052);
    const top=belly-(fore?.31:.34), kneeAt=.52;
    const flank=fore?.48:.51;
    // A heavy ground runner places its pads outside its chest. Keep the
    // upper joint in the shoulder and widen the stance below the elbow.
    const spread=!winged?Math.max(.23,Math.min(.52,rect.h*k*(fore?.19:.16))):.105;
    const root=new T.Bone(),hinge=new T.Bone(),ankle=new T.Bone();
    root.position.set(modelX(hip),modelY(top),side*flank);
    hinge.position.set(modelX(knee)-root.position.x,modelY(top+(sole-top)*kneeAt)-root.position.y,0);
    ankle.position.set(modelX(wrist)-modelX(knee),modelY(top+(sole-top)*.79)-root.position.y-hinge.position.y,0);
    hinge.add(ankle);root.add(hinge);body.add(root);
    const joint=bones.length;bones.push(root,hinge,ankle);
    const first=positions.length/3;
    const contacts=[];
    const samples=[];
    let tip;
    for(let j=0;j<=rows;j++){
      const t=j/rows,y=top+(sole-top)*t;
      let center;
      if(t<=kneeAt)center=T.MathUtils.lerp(hip,knee,t/kneeAt);
      else if(t<.79)center=T.MathUtils.lerp(knee,wrist,(t-kneeAt)/(.79-kneeAt));
      else center=T.MathUtils.lerp(wrist,toe,(t-.79)/.21);
      const half=t<.50 ? .070-.016*t : t<.77 ? .055-.066*(t-.50) : (curled?.075:.051);
      const row=Math.min(h-1,Math.max(0,Math.round(py(y))));
      const min=Math.max(ax,Math.floor(px(center-half))),max=Math.min(ax+aw-1,Math.ceil(px(center+half)));
      let best=null,score=-Infinity;
      // Track a contiguous patch of scales. Empty space between painted claws
      // must not get stretched across the front of a cylindrical ankle.
      for(let x=min;x<=max;){
        if(!(pixels[((row-ay)*aw+x-ax)*4+3]>=64)){x++;continue;}
        const left=x;
        while(x<=max && pixels[((row-ay)*aw+x-ax)*4+3]>=64)x++;
        const right=x-1,mid=(left+right)/2;
        const quality=right-left-Math.abs(mid-px(center))*.65;
        if(quality>score && right-left>=2){score=quality;best={mid,radius:(right-left)/2,row};}
      }
      samples.push(best);
    }
    if(!samples.some(Boolean))return;
    const lastSolid=samples.findLastIndex(Boolean);
    for(let j=0;j<=lastSolid;j++){
      let lo=j,hi=j;
      while(lo>0 && !samples[lo])lo--;
      while(hi<lastSolid && !samples[hi])hi++;
      const low=samples[lo]||samples[hi],high=samples[hi],u=(j-lo)/Math.max(1,hi-lo);
      const mid=T.MathUtils.lerp(low.mid,high.mid,u),radius=T.MathUtils.lerp(low.radius,high.radius,u);
      const paint=samples[j]||(u<.5?low:high),t=j/rows,y=top+(sole-top)*t;
      const pad=T.MathUtils.smoothstep(t,.66,.86);
      const depth=Math.min(fore?.245:.27,radius*k*(.86+.39*pad));
      for(let i=0;i<=sections;i++){
        const a=i*Math.PI*2/sections,cos=Math.cos(a),sin=Math.sin(a);
        const sampleX=mid+cos*radius;
        const x=(sampleX-b.w/2)*k,my=modelY(y);
        const z=side*(flank+spread*T.MathUtils.smoothstep(t,.24,.88))+sin*depth;
        positions.push(x,my,z);
        uv.push((paint.mid+cos*paint.radius-ax+.5)/aw,1-(paint.row-ay+.5)/ah);
        const light=.89+.08*side*sin+.035*cos;
        colors.push(light,light,light);
        const lower=T.MathUtils.smoothstep(t,.38,.65);
        const foot=T.MathUtils.smoothstep(t,.69,.83);
        joints.push(joint,joint+1,joint+2,0);weights.push(1-lower,lower-foot,foot,0);
        if(j && i){const v=positions.length/3-1;indices.push(v-sections-2,v-1,v,v-sections-2,v,v-sections-1);}
      }
      if(samples[j] && t>=.82){
        tip={x:(mid-b.w/2)*k,y:modelY(y)};
        contacts.push([tip.x-radius*k-root.position.x-hinge.position.x-ankle.position.x,tip.y-root.position.y-hinge.position.y-ankle.position.y],
                      [tip.x+radius*k-root.position.x-hinge.position.x-ankle.position.x,tip.y-root.position.y-hinge.position.y-ankle.position.y]);
      }
    }
    // Close the ring at each end; the upper cap stays inside the shoulder.
    for(const offset of [first,first+lastSolid*(sections+1)]){
      for(let i=1;i<sections-1;i++)indices.push(offset,offset+i,offset+i+1);
    }
    if(!tip)tip={x:modelX(toe),y:modelY(sole)};
    const tipX=tip.x-root.position.x-hinge.position.x-ankle.position.x,tipY=tip.y-root.position.y-hinge.position.y-ankle.position.y;
    if(!contacts.length)contacts.push([tipX,tipY]);
    const upper=hinge.position,lower=ankle.position;
    const a1=Math.atan2(upper.y,upper.x),a2=Math.atan2(lower.y,lower.x);
    legs.push({root,hinge,ankle,fore,side,tipX,tipY,tipZ:side*spread,contacts,a1,a2,
      l1:Math.hypot(upper.x,upper.y),l2:Math.hypot(lower.x,lower.y),
      bend:Math.sign(Math.sin(a2-a1)) || (fore?-1:1)});

  }
  for(const side of [-1,1]){limb(false,hindX,hindY,side);limb(true,foreX,foreY,side);}
  const geo=new T.BufferGeometry();
  geo.setAttribute("position",new T.Float32BufferAttribute(positions,3));
  geo.setAttribute("uv",new T.Float32BufferAttribute(uv,2));
  geo.setAttribute("color",new T.Float32BufferAttribute(colors,3));
  geo.setAttribute("skinIndex",new T.Uint16BufferAttribute(joints,4));
  geo.setAttribute("skinWeight",new T.Float32BufferAttribute(weights,4));
  geo.setIndex(indices);
  const material=new T.MeshBasicMaterial({map:texture(original),vertexColors:true,side:T.DoubleSide,alphaTest:.22});
  const skin=new T.SkinnedMesh(geo,material);
  body.add(skin);body.updateWorldMatrix(true,true);
  const skeleton=new T.Skeleton(bones);skin.bind(skeleton);
  skin.frustumCulled=false;

  // Remove the four painted shins below the belly before shaping the torso.
  // The UVs of the moving limbs still point into the uncut, full-resolution art.
  pen.save();pen.globalCompositeOperation="destination-out";pen.beginPath();
  pen.moveTo(px(hindX-.105),py(belly-.15));
  pen.bezierCurveTo(px(hindX+.04),py(belly-.08),px(.12),py(belly+.01),px(.25),py(belly+.015));
  pen.quadraticCurveTo(px(foreX+.07),py(belly+.06),px(foreX+.23),py(belly-.12));
  pen.lineTo(px(foreX+.23),h);pen.lineTo(px(hindX-.105),h);pen.closePath();pen.fill();pen.restore();
  return legs.length?{legs,hatchling:id==="poro",stride:3.50*Math.min(...legs.map(l=>l.l1+l.l2))}:null;
}

function rcPoseChaseLegs(rig,phase,lift,winged,pitch){
  let lowest=Infinity,clearance=Infinity;
  for(const leg of rig.legs){
    const {root,hinge,ankle,fore,side,l1,l2,a1,a2,bend}=leg;
    // Hind feet take the load in succession; the forefeet catch the
    // body half a beat later. The brief gathered phase clears all four.
    const footfall=(fore?.44:0)+(side>0?.095:0);
    const cycle=phase-footfall*2*Math.PI;
    if(winged){
      const beat=Math.sin(cycle);
      if(rig.hatchling){
        root.scale.y=.78;
        root.rotation.z=(fore?.11:-.22)+.12*Math.sin(cycle-.48);
        hinge.rotation.z=bend*(.46+.12*Math.cos(cycle-.84));
        ankle.rotation.z=-.34*hinge.rotation.z+.09*Math.sin(cycle-1.1);
        continue;
      }
      root.rotation.z=(fore?-.13:-.25)-.10*lift+.10*beat;
      hinge.rotation.z=bend*(.24+.12*lift+.085*Math.cos(cycle-.35));
      ankle.rotation.z=.10*Math.sin(cycle-.8)-hinge.rotation.z*.35;
      continue;
    }
    // Translate the planted foot back by the distance the body travels.
    // During recovery a Hermite arc matches stance velocity at both ends.
    const duty=.25,u=((cycle/(2*Math.PI))%1+1)%1;
    const v=Math.max(0,(u-duty)/(1-duty)),arc=Math.sin(Math.PI*v)**2;
    const step=u<duty?duty*.5-u:-duty*.5+duty*v*v*(3-2*v)-(1-duty)*v*(1-v)*(1-2*v);
    const reach=l1+l2;
    clearance=Math.min(clearance,arc*reach*.65);
    const x=(hinge.position.x+ankle.position.x)*.6+step*rig.stride;
    const y=-reach*.82+arc*reach*(fore?.29:.36);
    const radius=Math.max(Math.abs(l1-l2)+.0001,Math.min(reach-.0001,Math.hypot(x,y)));
    const acos=n=>Math.acos(Math.max(-1,Math.min(1,n)));
    const upper=Math.atan2(y,x)-bend*acos((l1*l1+radius*radius-l2*l2)/(2*l1*radius));
    const elbow=bend*acos((radius*radius-l1*l1-l2*l2)/(2*l1*l2));
    root.rotation.z=upper-a1;hinge.rotation.z=elbow-(a2-a1);
    const roll=-.10*Math.sin(2*Math.PI*u)*Math.max(0,(u-.35)/.65)-arc*.36;
    ankle.rotation.z=roll-root.rotation.z-hinge.rotation.z;
    const hip=pitch+root.rotation.z,shin=hip+hinge.rotation.z,foot=shin+ankle.rotation.z;
    const x0=root.position.x*Math.cos(pitch)-root.position.y*Math.sin(pitch)+
      hinge.position.x*Math.cos(hip)-hinge.position.y*Math.sin(hip)+
      ankle.position.x*Math.cos(shin)-ankle.position.y*Math.sin(shin);
    const y0=root.position.y*Math.cos(pitch)+root.position.x*Math.sin(pitch)+
      hinge.position.x*Math.sin(hip)+hinge.position.y*Math.cos(hip)+
      ankle.position.x*Math.sin(shin)+ankle.position.y*Math.cos(shin);
    leg.groundY=Infinity;
    for(const [cx,cy] of leg.contacts){
      const height=y0+cx*Math.sin(foot)+cy*Math.cos(foot);
      if(height<leg.groundY){leg.groundY=height;leg.groundX=x0+cx*Math.cos(foot)-cy*Math.sin(foot);}
    }
    lowest=Math.min(lowest,leg.groundY);
  }
  return winged?0:lowest-clearance;
}
