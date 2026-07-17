import * as THREE from "three";

const NOISE_GLSL = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec2 mod289(vec2 x){return x-floor(x*(1.0/289.0))*289.0;}
vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}
float snoise(vec2 v){
  const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i=floor(v+dot(v,C.yy));
  vec2 x0=v-i+dot(i,C.xx);
  vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);
  vec4 x12=x0.xyxy+C.xxzz;
  x12.xy-=i1;
  i=mod289(i);
  vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));
  vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);
  m=m*m; m=m*m;
  vec3 x=2.0*fract(p*C.www)-1.0;
  vec3 h=abs(x)-0.5;
  vec3 ox=floor(x+0.5);
  vec3 a0=x-ox;
  m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
  vec3 g;
  g.x=a0.x*x0.x+h.x*x0.y;
  g.yz=a0.yz*x12.xz+h.yz*x12.yw;
  return 130.0*dot(m,g);
}
`;

export function createLivingInkMaterial(tickCount: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uEngaged: { value: 0 },
      uTicks: { value: new Array(64).fill(0) },
      uTickCount: { value: tickCount },
      uVoid: { value: new THREE.Color("#0a0710") },
      uEmber: { value: new THREE.Color("#d9853f") },
      uEmerald: { value: new THREE.Color("#3ddc84") },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalV;
      varying vec3 vViewPos;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mv.xyz;
        vNormalV = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      ${NOISE_GLSL}
      varying vec2 vUv;
      varying vec3 vNormalV;
      varying vec3 vViewPos;
      uniform float uTime;
      uniform float uEngaged;
      uniform float uTicks[64];
      uniform float uTickCount;
      uniform vec3 uVoid;
      uniform vec3 uEmber;
      uniform vec3 uEmerald;

      vec2 warp(vec2 p, float t) {
        vec2 q = vec2(snoise(p + t * 0.05), snoise(p + vec2(5.2, 1.3) + t * 0.05));
        vec2 r = vec2(
          snoise(p + 4.0 * q + vec2(1.7, 9.2) + t * 0.08),
          snoise(p + 4.0 * q + vec2(8.3, 2.8) + t * 0.08)
        );
        return r;
      }

      void main() {
        vec2 p = vUv * 6.0;
        vec2 w = warp(p, uTime);
        float mixFactor = clamp(0.5 + 0.5 * snoise(p + w), 0.0, 1.0);
        vec3 activeColor = mix(uEmber, uEmerald, uEngaged);
        vec3 base = mix(uVoid, activeColor, mixFactor * 0.85);

        float angle = fract(vUv.x);
        float tickGlow = 0.0;
        for (int i = 0; i < 64; i++) {
          if (float(i) >= uTickCount) break;
          float pos = float(i) / uTickCount;
          float d = abs(angle - pos);
          d = min(d, 1.0 - d);
          float width = uTicks[i] > 0.5 ? 0.006 : 0.002;
          float strength = uTicks[i] > 0.5 ? 0.9 : 0.35;
          tickGlow += smoothstep(width, 0.0, d) * strength;
        }
        base += activeColor * tickGlow;

        vec3 viewDir = normalize(vViewPos);
        float fresnel = pow(1.0 - clamp(dot(vNormalV, viewDir), 0.0, 1.0), 2.5);
        base += activeColor * fresnel * 0.6;

        float edgeFade = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.92, vUv.y);
        gl_FragColor = vec4(base, 0.85 * edgeFade + fresnel * 0.3);
      }
    `,
  });
}
