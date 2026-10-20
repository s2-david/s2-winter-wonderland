import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color('#101b3a');
scene.fog = new THREE.FogExp2('#101b3a', 0.035);
const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, .1, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight('#b7ddff', '#293756', 2.3));
const sun = new THREE.DirectionalLight('#ffe1a5', 2.6); sun.position.set(-8, 10, 8); sun.castShadow = true; sun.shadow.mapSize.set(1024,1024); scene.add(sun);
const moon = new THREE.DirectionalLight('#94bcff', 1.1); moon.position.set(8, 3, -5); scene.add(moon);

const world = new THREE.Group(); scene.add(world);
const R = 5;
const snowMat = new THREE.MeshStandardMaterial({ color: '#eaf6ff', roughness: .9, flatShading: true });
const ground = new THREE.Mesh(new THREE.IcosahedronGeometry(R, 5), snowMat); ground.receiveShadow = true; world.add(ground);
const ice = new THREE.Mesh(new THREE.IcosahedronGeometry(R * 1.002, 3), new THREE.MeshStandardMaterial({ color:'#ccecff', roughness:.65, transparent:true, opacity:.18, flatShading:true })); world.add(ice);

function point(lat, lon, extra=0) { const a=THREE.MathUtils.degToRad(lat), b=THREE.MathUtils.degToRad(lon); const r=R+extra; return new THREE.Vector3(r*Math.cos(a)*Math.sin(b), r*Math.sin(a), r*Math.cos(a)*Math.cos(b)); }
function place(obj, lat, lon, lift=0) { const p=point(lat,lon,lift); obj.position.copy(p); obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),p.clone().normalize()); world.add(obj); return obj; }
const blockers=[];
function placeBlocked(obj,lat,lon,lift,radius){ place(obj,lat,lon,lift); blockers.push({obj,radius}); return obj; }
function makeTree(scale=1) { const g=new THREE.Group(); const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.10*scale,.15*scale,.7*scale,6),new THREE.MeshStandardMaterial({color:'#77503a',flatShading:true})); trunk.position.y=.35*scale; g.add(trunk); for(let i=0;i<3;i++){const r=(.55-i*.11)*scale, y=(.72+i*.33)*scale; const crown=new THREE.Mesh(new THREE.ConeGeometry(r,.8*scale,7),new THREE.MeshStandardMaterial({color:i===0?'#286a60':'#377d6d',flatShading:true})); crown.position.y=y; crown.castShadow=true; g.add(crown); if(i>0){ const cap=new THREE.Mesh(new THREE.ConeGeometry(r*.72,.18*scale,7),new THREE.MeshStandardMaterial({color:'#f5fbff',roughness:1,flatShading:true})); cap.position.y=y+.34*scale; g.add(cap); } } return g; }
function makeHouse(color) { const g=new THREE.Group(); const walls=new THREE.Mesh(new THREE.BoxGeometry(1.1,.85,.95),new THREE.MeshStandardMaterial({color,flatShading:true})); walls.position.y=.45; walls.castShadow=true; g.add(walls); const roof=new THREE.Mesh(new THREE.ConeGeometry(.93,.72,4),new THREE.MeshStandardMaterial({color:'#3c4666',flatShading:true})); roof.position.y=1.16; roof.rotation.y=Math.PI/4; roof.castShadow=true; g.add(roof); const snowRoof=new THREE.Mesh(new THREE.ConeGeometry(.96,.18,4),new THREE.MeshStandardMaterial({color:'#f8fcff',roughness:1,flatShading:true})); snowRoof.position.y=1.38; snowRoof.rotation.y=Math.PI/4; g.add(snowRoof); const door=new THREE.Mesh(new THREE.BoxGeometry(.22,.38,.025),new THREE.MeshStandardMaterial({color:'#623b32'})); door.position.set(0,.22,.488); g.add(door); const glow=new THREE.PointLight('#ffc464',1.8,3.5); glow.position.set(0,.68,.65); g.add(glow); const win=new THREE.Mesh(new THREE.PlaneGeometry(.2,.2),new THREE.MeshBasicMaterial({color:'#ffd56a'})); win.position.set(.33,.58,.49); g.add(win); return g; }
function makePathDot(){return new THREE.Mesh(new THREE.CylinderGeometry(.2,.25,.035,8),new THREE.MeshStandardMaterial({color:'#b7d3dd',roughness:1,flatShading:true}));}

// A curved breadcrumb path and a warm village near the starting location.
for(let i=0;i<24;i++){ const lat=-8+Math.sin(i*.42)*5, lon=-36+i*3.2; place(makePathDot(),lat,lon,.045); }
[[5,-7,1.0],[12,10,.83],[-8,15,.85],[17,-18,.72],[-16,-18,.9],[3,29,.75],[-20,28,.85],[-3,-37,.76]].forEach(([a,b,s])=>placeBlocked(makeTree(s),a,b,.04,.36+s*.25));
[['#df6d61',4,5],['#e8a85e',8,17],['#7b9bd0',-5,13],['#bf789a',14,-10],['#77aab2',-13,23],['#d68c58',19,22],['#9c6bb0',-19,-25]].forEach(([c,a,b])=>placeBlocked(makeHouse(c),a,b,.05,.72));
// Denser forest pockets sit outside the broad, winding central path so they become landmarks, not dead ends.
for(let i=0;i<40;i++){ const a=(i*37)%84-42, b=(i*71)%150-75; if(Math.abs(a)<25&&Math.abs(b)<42) continue; const s=.42+(i%4)*.13; placeBlocked(makeTree(s),a,b,.03,.30+s*.23); }

// Bell landmark.
const bell = new THREE.Group();
const archMat=new THREE.MeshStandardMaterial({color:'#805a43',flatShading:true});
const postGeo=new THREE.CylinderGeometry(.075,.1,1.25,6);
const p1=new THREE.Mesh(postGeo,archMat),p2=p1.clone(); p1.position.x=-.42;p2.position.x=.42;p1.position.y=p2.position.y=.62; bell.add(p1,p2);
const beam=new THREE.Mesh(new THREE.BoxGeometry(.95,.12,.13),archMat); beam.position.y=1.2; bell.add(beam);
const bellBody=new THREE.Mesh(new THREE.SphereGeometry(.25,10,7,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:'#e7b63f',metalness:.45,roughness:.28,flatShading:true}));bellBody.position.y=1.12;bell.add(bellBody);
const clapper=new THREE.Mesh(new THREE.SphereGeometry(.06,8,6),new THREE.MeshStandardMaterial({color:'#5f3b25'}));clapper.position.y=.88;bell.add(clapper);
place(bell, -2, -6, .05); const bellGlow=new THREE.PointLight('#ffd373',1.3,4); bellGlow.position.set(0,1.1,.2); bell.add(bellGlow);

// Explorer stays planted while the planet moves underneath. The inner group independently turns in place.
const hero=new THREE.Group(); scene.add(hero); hero.position.set(0,0,R+.12); hero.rotation.x=Math.PI/2;
const avatar=new THREE.Group(); hero.add(avatar);
const body=new THREE.Mesh(new THREE.CapsuleGeometry(.18,.42,4,8),new THREE.MeshStandardMaterial({color:'#e9575b',flatShading:true})); body.rotation.x=Math.PI/2; body.position.y=.35; avatar.add(body);
const head=new THREE.Mesh(new THREE.SphereGeometry(.18,12,8),new THREE.MeshStandardMaterial({color:'#f5c7a9',flatShading:true}));head.position.y=.73;avatar.add(head);
const hat=new THREE.Mesh(new THREE.ConeGeometry(.22,.38,8),new THREE.MeshStandardMaterial({color:'#d83c47',flatShading:true}));hat.position.y=.99;avatar.add(hat);
const brim=new THREE.Mesh(new THREE.CylinderGeometry(.24,.24,.05,12),new THREE.MeshStandardMaterial({color:'#f4f8ff'}));brim.position.y=.82;avatar.add(brim);
const leg1=new THREE.Mesh(new THREE.BoxGeometry(.11,.36,.12),new THREE.MeshStandardMaterial({color:'#3b557c'})),leg2=leg1.clone();leg1.position.set(-.1,.1,0);leg2.position.set(.1,.1,0);avatar.add(leg1,leg2);

// Snow particles, gently falling around the camera.
const flakes=420, pos=new Float32Array(flakes*3); for(let i=0;i<flakes;i++){pos[i*3]=(Math.random()-.5)*20;pos[i*3+1]=(Math.random()-.5)*15;pos[i*3+2]=(Math.random()-.5)*18;}
const snowGeo=new THREE.BufferGeometry();snowGeo.setAttribute('position',new THREE.BufferAttribute(pos,3));const snowMaterial=new THREE.PointsMaterial({color:'#fff',size:.07,transparent:true,opacity:.8,sizeAttenuation:true});const snow=new THREE.Points(snowGeo,snowMaterial);scene.add(snow);

const keys={}; let zoom=16.5, targetZoom=16.5, walking=false, elapsed=0, bellCooldown=0, heading=0;
const prompt=document.querySelector('#prompt'),toast=document.querySelector('#toast'), view=document.querySelector('#view'), mute=document.querySelector('#mute'), snowfall=document.querySelector('#snowfall');
let muted=false, snowIntensity=Number(snowfall.value)/100;
snowGeo.setDrawRange(0,Math.round(flakes*snowIntensity)); snowMaterial.opacity=.15+.65*snowIntensity;
addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true;if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key))e.preventDefault(); if(e.key.toLowerCase()==='z')toggleView(); if(e.key.toLowerCase()==='e')ringBell();});
addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
renderer.domElement.addEventListener('wheel',e=>{targetZoom=THREE.MathUtils.clamp(targetZoom+e.deltaY*.008,8.5,19);},{passive:true});
view.addEventListener('click',toggleView); function toggleView(){targetZoom=targetZoom>13?11:18;}
mute.addEventListener('click',()=>{muted=!muted;mute.setAttribute('aria-pressed',String(muted));mute.textContent=muted?'◌ Sound off':'♪ Sound on';});
snowfall.addEventListener('input',()=>{snowIntensity=Number(snowfall.value)/100;snowGeo.setDrawRange(0,Math.round(flakes*snowIntensity));snowMaterial.opacity=.15+.65*snowIntensity;});
function ringBell(){const bellWorld=bell.getWorldPosition(new THREE.Vector3()); if(bellWorld.distanceTo(hero.position)<2.05){bell.rotation.z=.38; bellCooldown=1.1; jingle(); toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),1900);} }
function jingle(){ if(muted)return; const ctx=new (window.AudioContext||window.webkitAudioContext)(); const t=ctx.currentTime; [880,1175,1568].forEach((f,i)=>{let o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=f;o.connect(g);g.connect(ctx.destination);g.gain.setValueAtTime(.0001,t+i*.12);g.gain.exponentialRampToValueAtTime(.16,t+i*.12+.015);g.gain.exponentialRampToValueAtTime(.0001,t+i*.12+.55);o.start(t+i*.12);o.stop(t+i*.12+.58);}); }
function wouldHitBlocker(){ world.updateMatrixWorld(true); return blockers.some(({obj,radius})=>obj.getWorldPosition(new THREE.Vector3()).distanceTo(hero.position)<radius+.23); }
function tryMove(amount){ const old=world.quaternion.clone(); const direction=new THREE.Vector3(Math.sin(heading),Math.cos(heading),0); const axis=new THREE.Vector3(0,0,1).cross(direction).normalize(); world.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis,-amount)); if(wouldHitBlocker()) world.quaternion.copy(old); }
function loop(t){requestAnimationFrame(loop); const dt=Math.min(.05,(t-elapsed)/1000||.016);elapsed=t; const forward=keys.w||keys.arrowup,back=keys.s||keys.arrowdown,left=keys.a||keys.arrowleft,right=keys.d||keys.arrowright;
  if(left)heading+=1.85*dt; if(right)heading-=1.85*dt; avatar.rotation.y=heading;
  walking=forward||back; const speed=walking?1.05:0; if(forward)tryMove(speed*dt); if(back)tryMove(-speed*.65*dt);
  if(walking){const swing=Math.sin(t*.014)*.55;leg1.rotation.x=swing;leg2.rotation.x=-swing;}else{leg1.rotation.x=leg2.rotation.x=0;}
  zoom=THREE.MathUtils.lerp(zoom,targetZoom,.08);camera.position.set(0,2.35,zoom);camera.lookAt(0,0,0);
  const a=snowGeo.attributes.position.array;for(let i=1;i<a.length;i+=3){a[i]-=dt*(.7+(i%5)*.08);if(a[i]<-7)a[i]=8;}snowGeo.attributes.position.needsUpdate=true;
  if(bellCooldown>0){bellCooldown-=dt;bell.rotation.z*=.86;} else bell.rotation.z=0;
  const near=bell.getWorldPosition(new THREE.Vector3()).distanceTo(hero.position)<2.05;prompt.classList.toggle('show',near);
  renderer.render(scene,camera);
} requestAnimationFrame(loop);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
