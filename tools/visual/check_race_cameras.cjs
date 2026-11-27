// Run against the game server. Optional arguments limit the run to named race IDs.
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");

async function verify() {
  const browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || undefined,
    args: ["--mute-audio", "--enable-unsafe-swiftshader"]
  });
  try {
    const page = await browser.newPage({ viewport: { width: 640, height: 520 } });
    const base = new URL("index.html", process.env.BASE_URL || "http://localhost:8767");
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      if (message.type() === "error") errors.push(message.location().url+" "+message.text());
    });
    const requested = process.argv.slice(2);
    base.searchParams.set("racePreview", requested[0] || "");
    await page.goto(base.href,{waitUntil:"domcontentloaded",timeout:90000});
    const choices = page.getByLabel("観戦するレース");
    const ids = await choices.locator("option").evaluateAll(options => options.map(o => o.value));
    // A head that is absent or undecodable silently falls back to the side relief.
    const frontIds = await page.evaluate(async () => {
      await rcLoadChaseRuntime();
      const available=[];
      for(let i=0;i<DRAGONS.length;i+=8){
        const images=rcLoadRaceFronts(DRAGONS.slice(i,i+8));
        await Promise.all([...images.values()].map(image=>image.decode()));
        available.push(...images.keys());
      }
      return {expected:DRAGONS.map(dr=>dr.id).sort(),eyes:Object.keys(RC_CHASE_EYES).sort(),available:available.sort(),legs:Object.keys(RC_LEG_LANDMARKS).sort()};
    });
    assert.deepEqual(frontIds.available,frontIds.expected,"front portraits for the full roster");
    assert.deepEqual(frontIds.eyes,frontIds.expected,"paired eye registration for the full roster");
    assert.deepEqual(frontIds.legs,frontIds.expected,"limb landmarks for the full roster");
    for (const id of requested.length ? requested : ids) {
      assert(ids.includes(id), id);
      if (await choices.inputValue() !== id) await choices.selectOption(id);
      await page.waitForFunction(id => state.current?.race?.id === id && state.current.racePlayer, id);
      await page.waitForFunction(() => {
        const race = state.current.race;
        return getRaceDragonIds(race).every(_rcRigV2Ok) &&
          rcParaFor(race, null, RC_TIME_DIR[rcRaceTime(race)]).ok;
      }, null, {timeout:90000,polling:200}).catch(async error => {
        const missing = await page.evaluate(() => {
          const race=state.current.race, art=rcParaFor(race,null,RC_TIME_DIR[rcRaceTime(race)]);
          return {rigs:getRaceDragonIds(race).filter(id=>!_rcRigV2Ok(id)), scenery:art.ok, failed:art.fail};
        });
        throw Error(id+" assets "+JSON.stringify(missing)+" "+errors.join(", "),{cause:error});
      });
      // Observe calls through the real renderer, including whether the GPU
      // actually drew the chase views. Just checking the buttons misses a
      // silent return to the normal broadcast when art or WebGL is missing.
      await page.waitForFunction(()=>state.current.racePlayer?.cameraReady,null,{timeout:90000});
      const frames = await page.evaluate(() => {
        const race = state.current.race, course = rcChaseCourse(race);
        for (const progress of [0, 1/3, 2/3, 1]) {
          for (const lane of [-34.3, 0, 34.3]) {
            const a = course.point(course.distance(progress), lane);
            const b = course.point(course.distance(progress+.00001), lane);
            if (!(Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z)<.04)) throw Error(race.id+" discontinuous course");
          }
        }
        // Count rendered panorama/dragon frames through the native WebGL surface.
        const original = CanvasRenderingContext2D.prototype.drawImage;
        let rendered = 0, lastFrame=-1, vistas=0, checkedPanorama=false;
        const surface=document.querySelector(".rc-chase-surface");
        const before=THREE.Mesh.prototype.onBeforeRender;
        THREE.Mesh.prototype.onBeforeRender=function(...args){
          const renderer=args[0];
          if(surface.classList.contains("is-live") && renderer.domElement.parentElement===surface && lastFrame!==renderer.info.render.frame){
            lastFrame=renderer.info.render.frame;rendered++;
          }
          if(!checkedPanorama && this.material?.map?.name==="venue-panorama"){
            const image=this.material.map.image;
            const row=image.getContext("2d").getImageData(0,Math.floor(image.height*.48),image.width,1).data;
            for(let x=0;x<image.width;x++)if(row[4*x+3]<250)throw Error(race.id+" open panorama at "+x);
            // An opaque sky gradient can hide an accidentally erased hero plate.
            // Sample horizontal detail in the mountain/shore band of the main arc.
            if(!RC_ISLAND_FESTIVALS[race.region]?.vista){
              const sample=document.createElement("canvas");sample.width=40;sample.height=20;
              const pen=sample.getContext("2d");
              pen.drawImage(image,image.width*.035,image.height*.45,image.width*.27,image.height*.43,0,0,40,20);
              const pixels=pen.getImageData(0,0,40,20).data;
              let edges=0;
              for(let y=0;y<20;y++)for(let x=1;x<40;x++){
                const i=4*(y*40+x);
                if(Math.max(...[0,1,2].map(c=>Math.abs(pixels[i+c]-pixels[i+c-4])))>4)edges++;
              }
              if(edges<15)throw Error(race.id+" missing landscape detail");
            }
            checkedPanorama=true;
          }
          return before.apply(this,args);
        };
        CanvasRenderingContext2D.prototype.drawImage = function(source,...rest) {
          if(this.canvas.id==="rc-canvas" && source?.src?.includes("_L1.webp")){
            const venue=RC_ISLAND_FESTIVALS[race.region]?.vista;
            if(venue && !source.src.endsWith("/"+venue+"_L1.webp"))throw Error(race.id+" wrong championship painting");
            const width=parseFloat(this.canvas.style.width),height=parseFloat(this.canvas.style.height);
            const [x,y,w,h]=rest.slice(-4);
            if(x>.01 || y>.01 || x+w<width-.01 || y+h<height-.01)throw Error(race.id+" exposed scenic edge");
            vistas++;
          }
          return original.call(this,source,...rest);
        };
        try {
          const button=name=>[...document.querySelectorAll(".rc-camera-choices button")].find(b=>b.textContent===name);
          const angle=()=>document.querySelector('input[aria-label="観戦角度"]');
          button("実況").click();
          for(const t of [.03,.39,.88]){
            const old=vistas;
            state.current.racePlayer.seek(t);
            if(vistas!==old+1)throw Error(race.id+" interrupted or tiled broadcast painting");
          }
          button("先頭追走").click();
          angle().value="-160";
          angle().dispatchEvent(new Event("input"));
          button("自動演出").click();
          const previousFrames=rendered;
          // The opening chase shot starts after 7% of the course. A fixed
          // clock time can instead land on three consecutive broadcast cuts.
          let opening=0;
          while(opening<1 && state.current.timeline.leaderProgressAt(opening)<.11)opening+=.002;
          state.current.racePlayer.seek(opening);
          const autoAngle=angle().value;
          if(rendered===previousFrames || autoAngle==="-160")throw Error(race.id+" director did not set the live bearing");
          button("先頭追走").click();
          if(angle().value!==autoAngle)throw Error(race.id+" manual camera lost the director bearing");
          state.current.racePlayer.seek(.52);
          for (const degrees of [-68, 42, 90, 120]) {
            const dial=angle();
            dial.value = degrees;
            dial.dispatchEvent(new Event("input"));
            state.current.racePlayer.seek(.53);
          }
          const region=RC_PARA_SLUG[race.region];
          if(region!=="grandclock" && !checkedPanorama)throw Error(race.id+" missing venue panorama");
          return rendered;
        } finally {
          CanvasRenderingContext2D.prototype.drawImage=original;
          THREE.Mesh.prototype.onBeforeRender=before;
        }
      });
      assert(frames >= 3, id+" chase did not render");
      await page.getByRole("button",{name:"着順を見る"}).click();
      const joinError=await page.evaluate(()=>{
        // Observe the two main-scene passes, ignoring the lake reflection.
        const before=THREE.Mesh.prototype.onBeforeRender;
        let near,far;
        THREE.Mesh.prototype.onBeforeRender=function(renderer,scene,camera,...args){
          if(!renderer.getRenderTarget()){
            if(camera.isOrthographicCamera)near=camera;
            if(camera.isPerspectiveCamera)far=camera;
          }
          return before.call(this,renderer,scene,camera,...args);
        };
        try{
          [...document.querySelectorAll(".rc-camera-choices button")].find(b=>b.textContent==="決勝写真").click();
          state.current.racePlayer.seek(1);
          if(!near || !far)return Infinity;
          const join=new THREE.Vector3(.8,-.7,1).unproject(near).project(far);
          return Math.max(Math.abs(join.x-.8),Math.abs(join.y+.7),Math.abs(join.z+1));
        }finally{THREE.Mesh.prototype.onBeforeRender=before;}
      });
      assert(joinError<.0001,id+" finish photo scenery disconnected from the track");
      const result = await page.evaluate(() => ({
        photo: document.querySelector(".rc-wrap").classList.contains("rc-photo"),
        clearLine: document.querySelector("#rc-finishstrip .rc-fs-winner").getBoundingClientRect().top >=
          document.querySelector("#rc-canvas").getBoundingClientRect().bottom-1 &&
          !document.querySelector("#rc-finishstrip details").open,
        photoInView: document.querySelector("#rc-canvas").getBoundingClientRect().top>=-1 &&
          document.querySelector("#rc-canvas").getBoundingClientRect().bottom<=innerHeight+1,
        callVisible: Number(getComputedStyle(document.querySelector("#rc-yt")).opacity)>.8 &&
          document.querySelector("#rc-yt").getBoundingClientRect().top >=
            document.querySelector("#rc-canvas").getBoundingClientRect().bottom-1 &&
          !!document.querySelector("#rc-yt-bub-l").textContent.trim(),
        expected: state.current.timeline.crossings.map(c=>c.place+" "+commentaryName(c.id)),
        rows: [...document.querySelectorAll("#rc-finishstrip .rc-fs-row")].map(row=>row.textContent.trim())
      }));
      assert(result.photo && result.clearLine && result.photoInView && result.callVisible, id+" finish and commentary "+JSON.stringify(result));
      assert.deepEqual(result.rows,result.expected,id+" finish order");
      assert.deepEqual(errors, [], id);
      console.log(id);
    }
  } finally { await browser.close(); }
}
verify().catch(error => { console.error(error); process.exitCode = 1; });
