"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createRandom } from "@/lib/random";

const vertex = `varying vec3 p; void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const skyFragment = `
varying vec3 p; uniform float time; uniform float aspect;
float hash(vec2 q){return fract(sin(dot(q,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 q){vec2 i=floor(q),f=fract(q);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
void main(){
 vec3 d=normalize(p); float h=d.y;
 vec3 c=mix(vec3(.055,.085,.125),vec3(.006,.014,.035),smoothstep(-.04,.48,h));
 c=mix(vec3(.008,.015,.023),c,smoothstep(-.22,0.,h));
 vec2 uv=vec2(atan(d.x,-d.z),asin(d.y));
 vec2 cell=floor(uv*340.); vec2 local=fract(uv*340.)-.5;
 c*=.28;
 float cloud=noise(uv*vec2(6.,20.)+vec2(time*.001,0.))*.6+noise(uv*vec2(15.,40.))*.4;
 c+=vec3(.006,.008,.012)*smoothstep(.5,.85,cloud)*(1.-smoothstep(.05,.35,abs(h-.09)));
 float star=(1.-smoothstep(0.,.13,length(local)))*step(.987,hash(cell));
 c+=vec3(.55,.65,.8)*star*smoothstep(.01,.15,h)*mix(.35,1.,hash(cell+17.));
 vec3 moon=normalize(vec3(-min(.26,aspect*.23),mix(.13,.20,smoothstep(.6,1.,aspect)),-1.)); float dist=length(d-moon);
 c+=vec3(.055,.075,.12)*exp(-dist*38.);
 float disc=1.-smoothstep(.0165,.0175,dist);
 vec2 surface=(d.xy-moon.xy)/.017;
 vec3 normal=vec3(surface,sqrt(max(0.,1.-dot(surface,surface))));
 float lighting=.24+.76*max(0.,dot(normal,normalize(vec3(-.5,.3,1.))));
 float crater=.60+.25*noise(d.xy*380.)+.15*noise(d.xy*950.);
 c+=vec3(.65,.72,.80)*disc*crater*lighting;
 float t=mod(time,23.); vec2 head=vec2(.30-t*.19,.30-t*.065);
 vec2 v=uv-head; float along=dot(v,normalize(vec2(.19,.065)));
 float across=abs(dot(v,normalize(vec2(-.065,.19))));
 float meteor=exp(-across*1700.)*smoothstep(0.,.012,along)*(1.-smoothstep(.01,.13,along));
 c+=vec3(.5,.65,.85)*meteor*step(t,1.8)*smoothstep(0.,.2,t)*(1.-smoothstep(1.4,1.8,t));
 gl_FragColor=vec4(c,1.);
}`;
const groundFragment = `
varying vec3 p;
float hash(vec2 q){return fract(sin(dot(q,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 q){vec2 i=floor(q),f=fract(q);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
void main(){
 vec2 q=p.xy;
 // Suppress gravel frequencies smaller than a pixel to avoid crawling on mobile.
 float grain=mix(hash(floor(q*48.)),.5,clamp(length(fwidth(q))*35.,0.,1.));
 float mottling=noise(q*.24)*.6+noise(q*.85)*.3+noise(q*3.)*.1;
 vec3 c=mix(vec3(.018,.023,.025),vec3(.040,.044,.045),mottling)+grain*.008;
 float road=1.-smoothstep(3.8,4.1,abs(q.x-14.));
 c=mix(c,vec3(.021,.028,.038)+grain*.009,road);
 float stripe=(1.-smoothstep(.055,.09,abs(q.x-14.)))*step(.5,fract(q.y/5.));
 c+=stripe*vec3(.16,.14,.09);
 float edge=(1.-smoothstep(.045,.095,abs(abs(q.x-14.)-3.6)));
 c+=edge*vec3(.055,.063,.065);
 float pavement=1.-smoothstep(.7,.78,abs(q.x-8.8));
 float joint=1.-smoothstep(.015,.035,abs(fract(q.y*.5)-.5));
 c=mix(c,vec3(.046,.05,.052)-joint*.013+grain*.006,pavement);
 float tracks=exp(-pow(abs(q.x+8.)-1.1,2.)*14.)*(.5+.5*sin(q.y*18.));
 c-=tracks*.008;
 c+=vec3(.04,.027,.012)*exp(-length(q)*.11);
 // A broad contact shadow grounds the foundation without another shadow map.
 vec2 footing=max(abs(q)-vec2(4.3),0.);
 c*=1.-.42*exp(-dot(footing,footing)*.45);
 for(int i=0;i<5;i++){
   vec2 lamp=vec2(9.,float(i)*12.-24.);
   c+=vec3(.075,.045,.018)*exp(-dot(q-lamp,q-lamp)*.17);
 }
 float fade=1.-smoothstep(65.,130.,length(q));
 gl_FragColor=vec4(c,fade);
}`;

type CityPart = { x: number; y: number; z: number; w: number; h: number; d: number; color: string };

/** Static architecture uses two draw calls, including the small lit windows. */
function CityBatch({ parts }: { parts: CityPart[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const transform = new THREE.Object3D();
    const color = new THREE.Color();
    parts.forEach((part, index) => {
      transform.position.set(part.x, part.y, part.z);
      transform.scale.set(part.w, part.h, part.d);
      transform.updateMatrix();
      mesh.current!.setMatrixAt(index, transform.matrix);
      mesh.current!.setColorAt(index, color.set(part.color));
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [parts]);
  return <instancedMesh ref={mesh} args={[undefined, undefined, parts.length]}>
    <boxGeometry />
    <meshBasicMaterial />
  </instancedMesh>;
}

/** A camera-centred sky never runs out; terrain stays anchored as the tower climbs. */
export function GameEnvironment({ seed, animate }: { seed: number; animate: boolean }) {
  const sky = useRef<THREE.Mesh>(null);
  const skyMaterial = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ time: { value: 5 }, aspect: { value: 1 } }), []);
  const city = useMemo(() => {
    const random = createRandom(seed ^ 8123);
    const solid: CityPart[] = [];
    const windows: CityPart[] = [];
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 24; i++) {
        const x = (i - 11.5) * 8 + random.range(-2.2,2.2);
        const z = row ? random.range(-132,-110) : random.range(-84,-62);
        const h = random.range(2.8, row ? 17 : 10);
        const w = random.range(3.2,6.8);
        const color = row ? "#172331" : "#101b25";
        solid.push({ x, y: h/2-.58, z, w, h, d: 6, color });
        // Setbacks, parapets and rooftop plant break up the silhouette.
        solid.push({ x: x+ w*.1, y: h+.15, z, w: w*.55, h: 1.5, d: 3.4, color });
        if (i % 4 === 0) solid.push({ x, y: h+1.9, z, w: .08, h: 2, d: .08, color });
        for (let floor=1; floor<h-1; floor+=1.3) {
          for (let bay=-1; bay<=1; bay++) {
            if (random.chance(row ? .22 : .38)) windows.push({
              x: x+bay*w*.25, y: floor, z: z+3.01, w: .22, h: .38, d: .02,
              color: row ? "#414a51" : random.chance(.7) ? "#6a5940" : "#425463",
            });
          }
        }
      }
    }
    return { solid, windows };
  }, [seed]);
  useFrame(({ camera, size }, delta) => {
    sky.current?.position.copy(camera.position);
    if (skyMaterial.current) {
      skyMaterial.current.uniforms.aspect.value = size.width / size.height;
      if (animate) skyMaterial.current.uniforms.time.value += Math.min(delta,.05);
    }
  });
  return <group>
    <mesh ref={sky} renderOrder={-5} frustumCulled={false}>
      <sphereGeometry args={[220,32,20]} />
      <shaderMaterial ref={skyMaterial} vertexShader={vertex} fragmentShader={skyFragment} uniforms={uniforms} side={THREE.BackSide} depthWrite={false} />
    </mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.58,0]} renderOrder={-1}>
      <planeGeometry args={[280,280]} />
      <shaderMaterial vertexShader={vertex} fragmentShader={groundFragment} transparent depthWrite={false} />
    </mesh>
    <CityBatch parts={city.solid} />
    <CityBatch parts={city.windows} />
    {[-24,-12,0,12,24].map(z=><group key={z} position={[9,-.58,z]}>
      <mesh position={[0,2.3,0]}><cylinderGeometry args={[.045,.07,4.6,6]} /><meshBasicMaterial color="#343c43" /></mesh>
      <mesh position={[0,4.6,0]}><boxGeometry args={[.6,.12,.3]} /><meshBasicMaterial color="#efc88c" /></mesh>
    </group>)}
  </group>;
}
