"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export interface Massing3DProps {
  erfSqm: number;
  maxFootprintSqm: number;
  maxBuildableSqm: number;
  storeys: number;
  unitCount: number;
}

const BOUNDARY_MAROON = "#A5132A";

export function Massing3D({
  erfSqm,
  maxFootprintSqm,
  maxBuildableSqm,
  storeys,
  unitCount,
}: Massing3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer | null = null;
    let controls: OrbitControls | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let animationFrame = 0;
    let active = true;
    let mounted = true;
    const scene = new THREE.Scene();

    const disposeScene = () => {
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
          child.geometry.dispose();
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((material) => material.dispose());
        }
      });
    };

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const canvas = renderer.domElement;
      canvas.className = "massing-canvas";
      canvas.setAttribute("aria-hidden", "true");
      host.appendChild(canvas);

      const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
      camera.position.set(7.5, 6.5, 8.5);
      camera.lookAt(0, 1, 0);

      const erfSide = Math.max(Math.sqrt(Math.max(erfSqm, 1)), 1);
      const footprintSide = Math.max(Math.sqrt(Math.max(maxFootprintSqm, 1)), 1);
      const scale = 6 / erfSide;
      const plotWidth = erfSide * scale;
      const buildingWidth = Math.min(footprintSide * scale, plotWidth * 0.82);
      const safeStoreys = Math.max(1, Math.round(storeys || 1));
      const buildingHeight = Math.min(5.2, Math.max(0.9, safeStoreys * 0.82));

      const groundGeometry = new THREE.PlaneGeometry(plotWidth, plotWidth);
      const groundMaterial = new THREE.MeshStandardMaterial({ color: 0xd8e3ff, transparent: true, opacity: 0.46, side: THREE.DoubleSide });
      const ground = new THREE.Mesh(groundGeometry, groundMaterial);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.03;
      scene.add(ground);

      const half = plotWidth / 2;
      const boundaryGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-half, 0, -half),
        new THREE.Vector3(half, 0, -half),
        new THREE.Vector3(half, 0, half),
        new THREE.Vector3(-half, 0, half),
        new THREE.Vector3(-half, 0, -half),
      ]);
      const boundaryMaterial = new THREE.LineDashedMaterial({ color: BOUNDARY_MAROON, dashSize: 0.2, gapSize: 0.12, linewidth: 1 });
      const boundary = new THREE.Line(boundaryGeometry, boundaryMaterial);
      boundary.computeLineDistances();
      scene.add(boundary);

      const buildingGeometry = new THREE.BoxGeometry(buildingWidth, buildingHeight, buildingWidth * 0.78);
      const buildingMaterial = new THREE.MeshStandardMaterial({ color: 0x2f70ef, roughness: 0.58, metalness: 0.06 });
      const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
      building.position.y = buildingHeight / 2;
      building.scale.setScalar(reducedMotion ? 1 : 0);
      scene.add(building);

      for (let floor = 1; floor < safeStoreys; floor += 1) {
        const floorGeometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-buildingWidth / 2 - 0.01, floor * (buildingHeight / safeStoreys), buildingWidth * 0.39 + 0.01),
          new THREE.Vector3(buildingWidth / 2 + 0.01, floor * (buildingHeight / safeStoreys), buildingWidth * 0.39 + 0.01),
        ]);
        const floorMaterial = new THREE.LineBasicMaterial({ color: 0xd8e3ff, transparent: true, opacity: 0.72 });
        scene.add(new THREE.Line(floorGeometry, floorMaterial));
      }

      scene.add(new THREE.HemisphereLight(0xffffff, 0x1c3056, 2.2));
      const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
      keyLight.position.set(5, 8, 6);
      scene.add(keyLight);

      controls = new OrbitControls(camera, canvas);
      controls.enablePan = false;
      controls.enableDamping = false;
      controls.minDistance = 7;
      controls.maxDistance = 18;
      controls.maxPolarAngle = Math.PI / 2.08;

      const render = () => renderer?.render(scene, camera);
      controls.addEventListener("change", render);

      const resize = () => {
        if (!renderer || !host.clientWidth || !host.clientHeight) return;
        camera.aspect = host.clientWidth / host.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(host.clientWidth, host.clientHeight, false);
        render();
      };
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
      resize();

      if (reducedMotion) {
        render();
      } else {
        const startedAt = performance.now();
        const animate = (now: number) => {
          if (!active) return;
          const progress = Math.min((now - startedAt) / 650, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          building.scale.set(eased, eased, eased);
          render();
          if (progress < 1) animationFrame = requestAnimationFrame(animate);
        };
        animationFrame = requestAnimationFrame(animate);
      }

      return () => {
        active = false;
        if (animationFrame) cancelAnimationFrame(animationFrame);
        resizeObserver?.disconnect();
        controls?.removeEventListener("change", render);
        if (controls) controls.dispose();
        disposeScene();
        if (renderer) renderer.dispose();
        if (canvas.parentNode === host) host.removeChild(canvas);
      };
    } catch {
      active = false;
      if (animationFrame) cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      if (controls) controls.dispose();
      disposeScene();
      if (renderer) renderer.dispose();
      if (renderer?.domElement.parentNode === host) host.removeChild(renderer.domElement);
      queueMicrotask(() => {
        if (mounted) setFallback(true);
      });
    }
    return () => { mounted = false; };
  }, [erfSqm, maxBuildableSqm, maxFootprintSqm, storeys, unitCount]);

  const description = `${Math.max(1, Math.round(storeys))} storey massing for up to ${unitCount} units, ${Math.round(maxFootprintSqm).toLocaleString("en-ZA")} square metre footprint`;

  return (
    <div className="massing-shell" role="img" aria-label={description}>
      <div ref={hostRef} className="massing-stage" />
      {fallback && (
        <div className="massing-fallback" role="status">
          <span className="material-symbols-rounded" aria-hidden="true">view_in_ar</span>
          <strong>3D preview unavailable</strong>
          <span>The zoning envelope facts remain available.</span>
        </div>
      )}
      <div className="massing-overlay" aria-hidden="true">
        <span><strong>{unitCount}</strong> units</span>
        <span><strong>{Math.round(maxBuildableSqm).toLocaleString("en-ZA")} m²</strong> buildable</span>
        <span>Drag to orbit</span>
      </div>
    </div>
  );
}
