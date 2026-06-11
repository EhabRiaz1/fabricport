import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { cn } from '@/lib/utils'

/**
 * Living cloth — a vertex-displaced plane with layered noise waves that
 * ripples continuously, bends toward the cursor like wind, and lifts/parts
 * with scroll progress. Pure three.js, no react-three-fiber.
 */

const VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform vec2 uMouse;        // in plane local space
  uniform float uMouseForce;
  uniform float uScroll;      // 0..1 hero scroll progress

  varying vec2 vUv;
  varying float vElevation;
  varying float vFold;

  // --- simplex noise (Ashima) ---
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  float elevationAt(vec2 pos) {
    float t = uTime * 0.32;
    // broad drape
    float e = snoise(pos * 0.35 + vec2(t * 0.45, t * 0.3)) * 0.55;
    // mid folds
    e += snoise(pos * 0.85 + vec2(-t * 0.35, t * 0.5)) * 0.28;
    // fine ripple
    e += snoise(pos * 2.2 + vec2(t * 0.8, -t * 0.6)) * 0.075;

    // cursor wind — gaussian push around the mouse
    float d = distance(pos, uMouse);
    e += exp(-d * d * 1.4) * uMouseForce * 0.9;

    // scroll lift — cloth rises and flattens as you scroll away
    e *= (1.0 - uScroll * 0.65);
    return e;
  }

  void main() {
    vUv = uv;
    vec3 pos = position;

    float e = elevationAt(pos.xy);
    pos.z += e;
    // gentle scroll part — edges sweep upward
    pos.y += uScroll * (0.6 + abs(uv.x - 0.5) * 2.2);

    // estimate fold intensity for shading via neighbour sampling
    float eps = 0.12;
    float ex = elevationAt(pos.xy + vec2(eps, 0.0));
    float ey = elevationAt(pos.xy + vec2(0.0, eps));
    vFold = clamp((abs(e - ex) + abs(e - ey)) * 4.0, 0.0, 1.0);
    vElevation = e;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying float vElevation;
  varying float vFold;

  void main() {
    // warm fabric palette
    vec3 base = vec3(0.918, 0.875, 0.796);      // cream linen
    vec3 shadow = vec3(0.62, 0.475, 0.345);     // warm bronze shadow
    vec3 accent = vec3(0.91, 0.349, 0.235);     // terracotta

    // weave texture — fine procedural threads
    float warp = sin(vUv.x * 480.0) * 0.5 + 0.5;
    float weft = sin(vUv.y * 480.0) * 0.5 + 0.5;
    float weave = mix(0.96, 1.0, warp * weft);

    // elevation shading: valleys darken toward bronze
    float shade = smoothstep(-0.7, 0.85, vElevation);
    vec3 color = mix(shadow, base, shade);

    // fold crease accent — the terracotta thread catches in the folds
    color = mix(color, accent, vFold * 0.16);

    // vignette toward edges so the cloth melts into the page
    float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x)
               * smoothstep(0.0, 0.14, vUv.y) * smoothstep(1.0, 0.86, vUv.y);

    color *= weave;
    gl_FragColor = vec4(color, edge * 0.96);
  }
`

export interface FabricClothSceneProps {
  className?: string
  /** External scroll progress 0..1 (hero leaving viewport). */
  scrollProgressRef?: React.MutableRefObject<number>
}

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') || canvas.getContext('webgl')),
    )
  } catch {
    return false
  }
}

export function FabricClothScene({ className, scrollProgressRef }: FabricClothSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!supportsWebGL()) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60)
    camera.position.set(0, 0.4, 7.4)

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8))
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)
    renderer.domElement.style.position = 'absolute'
    renderer.domElement.style.inset = '0'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'

    const uniforms = {
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(99, 99) },
      uMouseForce: { value: 0 },
      uScroll: { value: 0 },
    }

    const geometry = new THREE.PlaneGeometry(10.4, 7.4, 150, 110)
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms,
      transparent: true,
      side: THREE.DoubleSide,
    })
    const cloth = new THREE.Mesh(geometry, material)
    cloth.rotation.x = -0.42
    cloth.rotation.z = 0.06
    scene.add(cloth)

    function resize() {
      if (!container) return
      const { clientWidth: w, clientHeight: h } = container
      if (w === 0 || h === 0) return
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h, false)
    }
    resize()

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)

    // Mouse → plane-local coordinates (approximate projection onto the plane)
    const targetMouse = new THREE.Vector2(99, 99)
    let targetForce = 0
    function onPointerMove(event: PointerEvent) {
      const rect = container!.getBoundingClientRect()
      const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1
      const ny = -(((event.clientY - rect.top) / rect.height) * 2 - 1)
      targetMouse.set(nx * 5.2, ny * 3.7)
      targetForce = 1
    }
    function onPointerLeave() {
      targetForce = 0
    }
    container.addEventListener('pointermove', onPointerMove)
    container.addEventListener('pointerleave', onPointerLeave)

    let visible = true
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting
      },
      { threshold: 0 },
    )
    io.observe(container)

    const clock = new THREE.Clock()
    let frameId = 0

    function renderFrame() {
      uniforms.uTime.value = clock.getElapsedTime()
      uniforms.uMouse.value.lerp(targetMouse, 0.06)
      uniforms.uMouseForce.value += (targetForce - uniforms.uMouseForce.value) * 0.05
      if (scrollProgressRef) {
        uniforms.uScroll.value += (scrollProgressRef.current - uniforms.uScroll.value) * 0.1
      }
      renderer.render(scene, camera)
    }

    function loop() {
      if (visible) renderFrame()
      frameId = requestAnimationFrame(loop)
    }

    if (reducedMotion) {
      // single still render — no animation loop
      uniforms.uTime.value = 2.4
      renderFrame()
    } else {
      frameId = requestAnimationFrame(loop)
    }

    return () => {
      cancelAnimationFrame(frameId)
      io.disconnect()
      resizeObserver.disconnect()
      container.removeEventListener('pointermove', onPointerMove)
      container.removeEventListener('pointerleave', onPointerLeave)
      geometry.dispose()
      material.dispose()
      renderer.dispose()
      container.removeChild(renderer.domElement)
    }
  }, [scrollProgressRef])

  return (
    <div
      ref={containerRef}
      aria-hidden
      className={cn('pointer-events-auto absolute inset-0 overflow-hidden', className)}
    />
  )
}

export default FabricClothScene
