import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

interface Props {
  className?: string;
}

/**
 * Real glass torus background.
 *
 * Uses Three.js MeshPhysicalMaterial with genuine transmission,
 * refraction, and iridescence to create a holographic rainbow sheen.
 */
export default function HolographicBackground({ className = '' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let W = window.innerWidth;
    let H = window.innerHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#F5F0E8'); // Keeping site's natural cream background

    // ── Environment map: gives the glass real surroundings to reflect/refract ──
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    const camera = new THREE.PerspectiveCamera(36, W / H, 0.1, 100);
    camera.position.set(0, 0.2, 6);
    camera.lookAt(0, 0, 0);

    // ── Real holographic glass material ────────────────────────────────────────
    function makeGlass(hue: number) {
      const color = new THREE.Color().setHSL(hue, 0.45, 0.7);
      return new THREE.MeshPhysicalMaterial({
        color,
        metalness: 0,
        roughness: 0.04,
        transmission: 1,
        thickness: 1.2,
        ior: 1.5,
        iridescence: 1,
        iridescenceIOR: 1.9,
        iridescenceThicknessRange: [120, 560],
        clearcoat: 1,
        clearcoatRoughness: 0.06,
        specularIntensity: 1,
        envMapIntensity: 1.6,
        transparent: true,
        side: THREE.DoubleSide,
      });
    }

    const group = new THREE.Group();
    scene.add(group);
    const mats: THREE.MeshPhysicalMaterial[] = [];
    const geos: THREE.BufferGeometry[] = [];

    // Outer toroidal core
    const outerMat = makeGlass(0.58);
    mats.push(outerMat);
    const outerGeo = new THREE.TorusKnotGeometry(1.05, 0.3, 280, 40, 2, 3);
    geos.push(outerGeo);
    const outerMesh = new THREE.Mesh(outerGeo, outerMat);
    group.add(outerMesh);

    // Inner toroidal core
    const innerMat = makeGlass(0.84);
    mats.push(innerMat);
    const innerGeo = new THREE.TorusKnotGeometry(0.55, 0.17, 240, 36, 3, 4);
    geos.push(innerGeo);
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    innerMesh.rotation.set(Math.PI * 0.3, Math.PI * 0.4, Math.PI * 0.1);
    group.add(innerMesh);

    // ── Lighting ──
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(2, 3, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xeeeeff, 0.8);
    fill.position.set(-3, 0, 2);
    scene.add(fill);
    const back = new THREE.DirectionalLight(0xffeeff, 0.6);
    back.position.set(0, -2, -3);
    scene.add(back);

    // ── Scroll ──────────────────────────────────────────────────────────────────
    let scrollP = 0;
    let targetP = 0;
    const onScroll = () => {
      const docHeight = Math.max(
        document.body.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.clientHeight,
        document.documentElement.scrollHeight,
        document.documentElement.offsetHeight
      );
      const travel = docHeight - window.innerHeight;
      targetP = travel > 0 ? Math.max(0, Math.min(1, window.scrollY / travel)) : 0;
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    const ro = new ResizeObserver(() => {
      W = window.innerWidth;
      H = window.innerHeight;
      renderer.setSize(W, H);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    });
    ro.observe(document.body);

    // ── Render loop ──────────────────────────────────────────────────────────────
    let rafId: number;
    let last = performance.now();
    let t = 0;

    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      t += dt;

      scrollP += (targetP - scrollP) * 0.06;

      group.rotation.x = -Math.PI * 0.1 + scrollP * Math.PI * 0.85;
      group.rotation.y = scrollP * Math.PI * 0.65;
      group.rotation.z = Math.PI * 0.04 + scrollP * Math.PI * 0.12;

      group.position.y = Math.sin(t * 0.35) * 0.06;

      outerMesh.rotation.y = t * 0.05;
      innerMesh.rotation.x = Math.PI * 0.3 + t * 0.07;
      innerMesh.rotation.y = Math.PI * 0.4 + t * 0.1;

      group.scale.setScalar(1 + scrollP * 0.14);
      renderer.render(scene, camera);
    };
    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScroll);
      ro.disconnect();
      mats.forEach((m) => m.dispose());
      geos.forEach((g) => g.dispose());
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement))
        container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 w-full h-full z-[-1] pointer-events-none ${className}`}
    />
  );
}
