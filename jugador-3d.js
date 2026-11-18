/* Redecora El Mundo — personaje 3D animado del mapa.
 * Conserva jugador.js como respaldo para cohete, paracaídas y escenas antiguas.
 * Three.js r128 se carga desde CDN; si falla, permanece el muñeco SVG original.
 */
(function () {
  'use strict';
  if (!window.THREE || !window.playerWalker || !window.playerWalker.show) return;
  const THREE = window.THREE;
  const originalShow = window.playerWalker.show;
  const originalHide = window.playerWalker.hide;
  let active = null;

  const mat = (color, roughness=.78) => new THREE.MeshStandardMaterial({color, roughness, metalness:0});
  const sphere = (parent, name, pos, scale, material) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14), material);
    mesh.name=name; mesh.position.set(...pos); mesh.scale.set(...scale); mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh); return mesh;
  };
  const limb = (parent, name, length, radius, material) => {
    const pivot = new THREE.Group(); pivot.name=name; parent.add(pivot);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius*.78, radius, length, 14), material);
    mesh.position.y=-length/2; mesh.castShadow=true; pivot.add(mesh);
    sphere(pivot, name+'-joint', [0,0,0], [radius*1.03,radius*1.03,radius*1.03], material);
    return pivot;
  };
  function build(flag) {
    const root = new THREE.Group();
    const skin=mat('#d99a70'), hair=mat('#c88b16'), shirt=mat('#d9650b'), yellow=mat('#e0a900'), jeans=mat('#17477f'), shoe=mat('#171a20'), white=mat('#f4f4f4');
    // piernas y zapatillas
    const legs=[];
    for (const x of [-.22,.22]) {
      const p=limb(root,'leg',.62,.115,jeans); p.position.set(x,.83,0); legs.push(p);
      const foot=new THREE.Mesh(new THREE.BoxGeometry(.27,.16,.42),shoe); foot.position.set(x,.12,.10); foot.castShadow=true; root.add(foot);
      const toe=new THREE.Mesh(new THREE.BoxGeometry(.22,.055,.08),white); toe.position.set(x,.105,.29); root.add(toe);
    }
    // torso y camiseta con panel amarillo
    const torso=new THREE.Mesh(new THREE.SphereGeometry(1,20,16),shirt); torso.position.y=1.38; torso.scale.set(.34,.48,.27); torso.castShadow=true; root.add(torso);
    const bib=new THREE.Mesh(new THREE.BoxGeometry(.36,.42,.035),yellow); bib.position.set(0,1.43,.322); root.add(bib);
    const collar=new THREE.Mesh(new THREE.TorusGeometry(.12,.035,8,18),yellow); collar.position.set(0,1.68,.27); root.add(collar);
    // bandera del jugador, en una plaquita en el pecho
    const flagCanvas=document.createElement('canvas'); flagCanvas.width=256; flagCanvas.height=160;
    const ctx=flagCanvas.getContext('2d'); ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,256,160); ctx.font='124px "Apple Color Emoji","Noto Color Emoji",sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(flag||'🌐',128,83);
    const tex=new THREE.CanvasTexture(flagCanvas); tex.needsUpdate=true;
    const patch=new THREE.Mesh(new THREE.PlaneGeometry(.29,.19),new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide})); patch.position.set(.12,1.48,.347); root.add(patch);
    // brazos articulados
    const arms=[];
    for (const x of [-.43,.43]) { const a=limb(root,'arm',.52,.105,shirt); a.position.set(x,1.60,0); arms.push(a); sphere(a,'hand',[0,-.56,0],[.12,.13,.12],skin); }
    // cuello y cabeza
    const neck=new THREE.Mesh(new THREE.CylinderGeometry(.10,.12,.16,14),skin); neck.position.y=1.78; root.add(neck);
    const head=new THREE.Group(); head.position.set(0,2.08,0); root.add(head);
    sphere(head,'face',[0,0,.015],[.39,.43,.34],skin);
    // orejas
    sphere(head,'earL',[-.39,-.02,0],[.09,.13,.09],skin); sphere(head,'earR',[.39,-.02,0],[.09,.13,.09],skin);
    // pelo rubio y mechones
    sphere(head,'haircap',[0,.29,-.015],[.405,.24,.36],hair);
    for(let i=0;i<5;i++){ const x=-.27+i*.135; sphere(head,'tuft',[x,.40+(i%2)*.055,.04],[.13,.15,.13],hair); }
    // ojos grandes con pupilas y brillos
    for(const x of [-.145,.145]) { sphere(head,'eye',[x,.045,.318],[.095,.125,.045],white); sphere(head,'pupil',[x+.012,.035,.359],[.047,.073,.022],mat('#4a3325')); sphere(head,'glint',[x-.006,.072,.379],[.021,.025,.012],white); }
    // sonrisa
    const smile=new THREE.Mesh(new THREE.TorusGeometry(.105,.018,6,18,Math.PI),mat('#9e3c38')); smile.position.set(0,-.13,.325); smile.rotation.z=Math.PI; head.add(smile);
    // sombra
    const shadow=new THREE.Mesh(new THREE.CircleGeometry(.42,24),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.20})); shadow.rotation.x=-Math.PI/2; shadow.position.y=.025; root.add(shadow);
    root.userData={legs,arms,head,torso,shadow}; return root;
  }
  function mount(el) {
    if (!el || !window.THREE) return;
    const old=el.querySelector('.pw3d'); if(old) old.remove();
    const holder=document.createElement('div'); holder.className='pw3d'; holder.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    const svg=el.querySelector('svg'); if(svg) svg.style.display='none';
    el.appendChild(holder);
    let renderer, raf=0, model, disposed=false;
    try {
      renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2)); renderer.setSize(132,224,false); renderer.setClearColor(0x000000,0);
      renderer.outputEncoding=THREE.sRGBEncoding; holder.appendChild(renderer.domElement);
      renderer.domElement.style.cssText='width:100%;height:100%;display:block;';
      const scene=new THREE.Scene(); scene.add(new THREE.HemisphereLight(0xffffff,0x596273,0.9));
      const key=new THREE.DirectionalLight(0xffffff,1.15); key.position.set(-3,5,5); scene.add(key);
      const camera=new THREE.OrthographicCamera(-.95,.95,2.78,.02,.1,20); camera.position.set(0,1.55,7); camera.lookAt(0,1.55,0);
      model=build(window.playerFlag?window.playerFlag():''); scene.add(model);
      const resize=()=>{ if(!renderer || disposed)return; const w=Math.max(1,holder.clientWidth),h=Math.max(1,holder.clientHeight); renderer.setSize(w,h,false); const aspect=w/h; camera.left=-.95*aspect; camera.right=.95*aspect; camera.top=2.78; camera.bottom=.02; camera.updateProjectionMatrix(); };
      resize(); const ro=window.ResizeObserver?new ResizeObserver(resize):null; if(ro)ro.observe(holder);
      const clock=new THREE.Clock();
      const tick=()=>{ if(disposed)return; raf=requestAnimationFrame(tick); const t=clock.getElapsedTime(), walking=el.classList.contains('walking'); const speed=walking?9:1.7, amp=walking?.58:.035;
        model.userData.legs[0].rotation.x=Math.sin(t*speed)*amp; model.userData.legs[1].rotation.x=-Math.sin(t*speed)*amp;
        model.userData.arms[0].rotation.x=-Math.sin(t*speed)*amp*.8; model.userData.arms[1].rotation.x=Math.sin(t*speed)*amp*.8;
        model.position.y=walking?Math.abs(Math.sin(t*speed*2))*.055:Math.sin(t*1.8)*.012;
        model.userData.head.rotation.z=Math.sin(t*1.3)*.025;
        model.userData.head.scale.y=1-(Math.sin(t*2.1)>0.985?.10:0); renderer.render(scene,camera);
      }; tick();
      active={dispose(){disposed=true;cancelAnimationFrame(raf);if(ro)ro.disconnect();renderer.dispose();holder.remove();if(svg)svg.style.display='';}};
    } catch(err) { holder.remove(); if(svg)svg.style.display=''; console.warn('No se pudo iniciar el personaje 3D; se mantiene el SVG.',err); }
  }
  window.playerWalker.show=function(id,opts){ originalShow.call(window.playerWalker,id,opts); const el=window.playerWalker.el&&window.playerWalker.el(); if(active){active.dispose();active=null;} if(el) mount(el); };
  window.playerWalker.hide=function(){ if(active){active.dispose();active=null;} return originalHide.call(window.playerWalker); };
})();
