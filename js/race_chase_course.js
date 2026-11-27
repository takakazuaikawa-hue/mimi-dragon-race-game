/* Geometry shared by the road, runners, scenery and the finish camera.
   Positive lateral offsets go to the right of the local forward vector. */
function rcChaseCourse(race) {
  const grand = race.region === "グランドクロック地域";
  const straight = 200, radius = 78, bend = Math.PI * radius;
  const length = ({short:420, mid:500, long:590, marathon:680})[race.distance] || 500;
  const smooth = x => x*x*(3-2*x);
  const clamp = x => Math.min(1, Math.max(0, x));
  function heading(p) {
    const mid = clamp(3*p-1), end = clamp(3*p-2);
    const sweep = race.mid === "grand_turn" ? 1.62 :
      race.mid === "aerial_wind_lane" ? -.62 : .32;
    const esses = race.mid === "repeated_small_turns" ? .48*Math.sin(2*Math.PI*mid) : 0;
    return sweep*smooth(mid) + esses + (race.late === "final_grand_turn" ? 1.18*smooth(end) : 0);
  }
  function height(p) {
    const mid = clamp(3*p-1);
    const climb = race.early === "uphill_start" ? 5*smooth(clamp(3*p)) : 0;
    const crest = race.mid === "rolling_terrain" ? 3.8*Math.sin(2*Math.PI*mid)**2 :
      race.mid === "aerial_wind_lane" ? 5*Math.sin(Math.PI*mid)**2 :
      race.mid === "crowded_bridge" ? 2.8*Math.sin(Math.PI*mid)**2 : 0;
    return climb+crest;
  }
  if (grand) {
    const lap = 2*(straight+bend);
    const distance = p => p < 1/3 ? 3*p*straight : p < 2/3 ?
      straight+(3*p-1)*bend : straight+bend+(3*p-2)*straight*.62;
    function point(s, offset) {
      let d = ((s%lap)+lap)%lap;
      let x, z, yaw;
      const r = radius+offset;
      if (d < straight) { x=d-straight/2; z=r; yaw=0; }
      else if ((d-=straight)<bend) { yaw=d/radius; x=straight/2+Math.sin(yaw)*r; z=Math.cos(yaw)*r; }
      else if ((d-=bend)<straight) { x=straight/2-d; z=-r; yaw=Math.PI; }
      else { yaw=Math.PI+(d-straight)/radius; x=-straight/2+Math.sin(yaw)*r; z=Math.cos(yaw)*r; }
      return {x,z,y:height(Math.min(1,Math.max(0,s/(3*straight)))),yaw};
    }
    return {grand, distance, point, start:0, end:lap};
  }
  // Integrate the course tangent once. Run-in and run-out extend the end
  // tangents so a finisher never wraps around to the starting line.
  const steps=360, step=length/steps, xs=[0], zs=[0];
  for(let i=0;i<steps;i++){
    const a=heading((i+.5)/steps);
    xs.push(xs[i]+step*Math.cos(a)); zs.push(zs[i]-step*Math.sin(a));
  }
  function point(s, offset) {
    const p=clamp(s/length), i=Math.min(steps-1,Math.floor(p*steps));
    const f=p*steps-i, tangent=heading(p), ext=s-p*length;
    // Carry the approach and exit around the shore/ridge beyond the timed straight.
    // A camera looking back down the course must never see the quad end in mid-air.
    const sign=Math.sign(ext), beyond=Math.max(0,Math.abs(ext)-35);
    const turn=Math.min(1.35,beyond/110), rest=beyond-turn*110;
    const along=sign*(Math.min(35,Math.abs(ext))+110*Math.sin(turn)+rest*Math.cos(turn));
    const lateralBend=110*(1-Math.cos(turn))+rest*Math.sin(turn);
    const yaw=tangent+sign*turn;
    const x=xs[i]+(xs[i+1]-xs[i])*f-xs[steps/2]+along*Math.cos(tangent)-lateralBend*Math.sin(tangent);
    const z=zs[i]+(zs[i+1]-zs[i])*f-zs[steps/2]-along*Math.sin(tangent)-lateralBend*Math.cos(tangent);
    const neck=race.early==="narrow_start" ? .23*(1-smooth(clamp(3*p))) : 0;
    const bridge=race.mid==="crowded_bridge" ? .20*Math.sin(Math.PI*clamp(3*p-1))**2 : 0;
    const lateral=offset*(1-neck-bridge);
    return {x:x+Math.sin(yaw)*lateral,z:z+Math.cos(yaw)*lateral,y:height(p),yaw};
  }
  return {grand, distance:p=>p*length, point, start:-430, end:length+430};
}

// Height above the track, shared by both cameras. Sample by distance so
// pausing, scrubbing and a change of leader never restart the manoeuvre.
function rcRaceFlight(race, dragons, rigs, reducedMotion) {
  const wind = race.mid === "aerial_wind_lane";
  const confined = race.mid === "crowded_bridge" || race.mid === "repeated_small_turns";
  const start = wind ? .30 : confined ? .61 : .46;
  const plans = new Map(dragons.map((dr,i) => {
    const wing = Math.max(0, Math.min(100, dr.dragon.stats?.wing ?? 55));
    const surge = dr.events.find(ev => ev.type === "surge");
    const offset = surge ? Math.max(-.036,Math.min(.036,(surge.u-.55)*.12)) : 0;
    const takeoff = start+offset+(60-wing)*.0006;
    return [dr.id,{rig:rigs[i],takeoff,crest:takeoff+(wind ? .17 : .105),
      metres:(wind ? 9 : confined ? 3.2 : 5.8)*(.68+wing*.005)}];
  }));
  const level = {height:0, pitch:0, stroke:0};
  return {
    start,
    lastCrest:Math.max(...Array.from(plans.values(),plan=>plan.crest)),
    sample(id,p) {
      const plan=plans.get(id);
      if(reducedMotion || !plan || p<=plan.takeoff || p>=.90 ||
          !plan.rig?.rig?.parts.some(part=>part.role==="wing"))return level;
      const rising=p<plan.crest;
      const span=rising ? plan.crest-plan.takeoff : .90-plan.crest;
      const t=rising ? (p-plan.takeoff)/span : (.90-p)/span;
      const slope=(rising?1:-1)*6*t*(1-t);
      return {height:plan.metres*t*t*(3-2*t),
        pitch:Math.atan(slope*plan.metres/(span*480)),stroke:slope/1.5};
    }
  };
}

// Coordinates are sampled from each original L3 painting. The road is above
// the foreground curb at Ringrosso and below the far curb at Mistlake.
const RC_CHASE_PAINT = {
  grandclock:{road:[.27,.548,.115,.07], verge:[.04,.79,.09,.17]},
  lumina:    {road:[.42,.59,.12,.08], verge:[.68,.78,.10,.12]},
  ringrosso: {road:[.34,.48,.12,.09], verge:[.24,.84,.11,.10]},
  caldera:   {road:[.39,.61,.10,.08], verge:[.44,.83,.11,.10]},
  mistlake:  {road:[.46,.62,.10,.10], verge:[.66,.81,.09,.11]},
  vento:     {road:[.44,.57,.11,.09], verge:[.22,.80,.12,.12]},
  notte:     {road:[.38,.56,.11,.08], verge:[.48,.82,.12,.10]},
  lapan:     {road:[.37,.56,.11,.09], verge:[.64,.82,.11,.10]}
};
