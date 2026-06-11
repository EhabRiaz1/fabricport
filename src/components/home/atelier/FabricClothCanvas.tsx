import { memo, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { cn } from '@/lib/utils'
import { prefersReducedMotion } from '@/lib/gsap'

/**
 * Full-viewport WebGL "living cloth": a vertex-displaced plane with layered
 * simplex waves, warm woven texturing, analytic lighting, mouse wind and a
 * scroll-driven lift. Renders a single static frame under reduced motion and
 * degrades to a plain gradient when WebGL is unavailable.
 */

const VERTEX = /* glsl */ `
  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uMouseStrength;
  uniform float uScroll;

  varying vec2 vUv;
  varying float vHeight;
  varying vec3 vNormal2;

  // ----- simplex noise (Ashima) -----
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 10.0) * x); }
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
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

  float displace(vec2 p) {
    float t = uTime * 0.2;
    // Long silk-like undulations
    float h = sin(p.x * 0.7 + t * 1.4) * cos(p.y * 0.55 - t * 0.9) * 0.28;
    // Large rolling drape
    h += snoise(p * 0.42 + vec2(t * 0.5, t * 0.2)) * 0.34;
    // Soft secondary folds
    h += snoise(p * 1.1 - vec2(t * 0.35, t * 0.22)) * 0.1;

    // Mouse wind — gaussian ripple around the pointer
    float d = distance(p, uMouse);
    h += exp(-d * d * 2.4) * uMouseStrength * 0.55;

    // Scroll lifts and flattens the cloth as the page begins to move
    h *= (1.0 - uScroll * 0.55);
    return h;
  }

  void main() {
    vUv = uv;
    vec2 p = position.xy;
    float h = displace(p);

    // Analytic-ish normal via finite differences
    float e = 0.1;
    float hx = displace(p + vec2(e, 0.0));
    float hy = displace(p + vec2(0.0, e));
    vNormal2 = normalize(vec3(-(hx - h) / e, -(hy - h) / e, 1.0));
    vHeight = h;

    vec3 pos = vec3(position.xy, h);
    pos.y += uScroll * 1.4; // cloth drifts upward as you scroll away
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const FRAGMENT = /* glsl */ `
  precision highp float;

  uniform float uTime;
  varying vec2 vUv;
  varying float vHeight;
  varying vec3 vNormal2;

  void main() {
    // Warm cloth palette — deep umber valleys to lit camel ridges
    vec3 deep = vec3(0.137, 0.075, 0.035);   // #23130. 9
    vec3 base = vec3(0.475, 0.333, 0.212);   // warm umber
    vec3 lit  = vec3(0.847, 0.706, 0.541);   // camel highlight

    // Key light from upper-left, soft fill
    vec3 lightDir = normalize(vec3(-0.45, 0.55, 0.75));
    float diff = max(dot(vNormal2, lightDir), 0.0);
    float fill = max(dot(vNormal2, normalize(vec3(0.6, -0.2, 0.5))), 0.0) * 0.25;

    float shade = clamp(pow(diff, 1.3) * 1.05 + fill + vHeight * 0.55 + 0.1, 0.0, 1.0);
    vec3 color = mix(deep, base, smoothstep(0.0, 0.5, shade));
    color = mix(color, lit, smoothstep(0.5, 1.0, shade));

    // Woven texture — two perpendicular thread frequencies
    float warp = sin(vUv.x * 720.0) * 0.5 + 0.5;
    float weft = sin(vUv.y * 480.0) * 0.5 + 0.5;
    float weave = (warp * 0.6 + weft * 0.4);
    color *= 0.96 + weave * 0.05;

    // Soft sheen along ridges
    float sheen = pow(max(dot(vNormal2, normalize(vec3(0.0, 0.35, 1.0))), 0.0), 6.0);
    color += sheen * vec3(0.20, 0.13, 0.07);

    // Gentle vignette
    float vig = smoothstep(1.25, 0.45, distance(vUv, vec2(0.5)));
    color *= 0.72 + vig * 0.32;

    gl_FragColor = vec4(color, 1.0);
  }
`

export interface FabricClothCanvasProps {
  className?: string
  /** 0..1 scroll progress of the hero leaving the viewport. */
  scrollProgressRef?: React.RefObject<number>
}

function FabricClothCanvasComponent({ className, scrollProgressRef }: FabricClothCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const failedRef = useRef(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    } catch {
      failedRef.current = true
      container.classList.add('cloth-fallback')
      return
    }

    const reduced = prefersReducedMotion()
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#1A0E06')
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50)
    camera.position.set(0, -0.4, 4.6)
    camera.lookAt(0, 0, 0)

    const uniforms = {
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(99, 99) },
      uMouseStrength: { value: 0 },
      uScroll: { value: 0 },
    }

    const geometry = new THREE.PlaneGeometry(11, 7.2, 180, 120)
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms,
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.rotation.x = -0.32
    scene.add(mesh)

    const mouseTarget = new THREE.Vector2(99, 99)
    let mouseStrengthTarget = 0

    function resize() {
      const { clientWidth, clientHeight } = container!
      renderer.setSize(clientWidth, clientHeight)
      camera.aspect = clientWidth / clientHeight
      camera.updateProjectionMatrix()
    }
    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)

    function onPointerMove(event: PointerEvent) {
      const rect = container!.getBoundingClientRect()
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1)
      // Map NDC roughly into plane space
      mouseTarget.set(x * 5.5, y * 3.6)
      mouseStrengthTarget = 1
    }
    function onPointerLeave() {
      mouseStrengthTarget = 0
    }
    container.addEventListener('pointermove', onPointerMove)
    container.addEventListener('pointerleave', onPointerLeave)

    let visible = true
    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true
      },
      { threshold: 0 },
    )
    io.observe(container)

    const clock = new THREE.Clock()
    let frameId = 0

    function frame() {
      frameId = requestAnimationFrame(frame)
      if (!visible) return

      uniforms.uTime.value = clock.getElapsedTime()
      uniforms.uMouse.value.lerp(mouseTarget, 0.06)
      uniforms.uMouseStrength.value +=
        (mouseStrengthTarget - uniforms.uMouseStrength.value) * 0.05
      uniforms.uScroll.value = scrollProgressRef?.current ?? 0

      renderer.render(scene, camera)
    }

    if (reduced) {
      // Single still frame — no animation loop
      uniforms.uTime.value = 7.3
      renderer.render(scene, camera)
    } else {
      frame()
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
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [scrollProgressRef])

  return (
    <div
      ref={containerRef}
      aria-hidden
      className={cn(
        'absolute inset-0 overflow-hidden bg-gradient-to-b from-[#2B1A0C] via-[#1A0E06] to-[#140A04] [&>canvas]:block [&>canvas]:h-full [&>canvas]:w-full',
        className,
      )}
    />
  )
}

export const FabricClothCanvas = memo(FabricClothCanvasComponent)
export default FabricClothCanvas
