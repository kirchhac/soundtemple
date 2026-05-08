import { useEffect, useRef, MutableRefObject } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface WalkthroughControlsProps {
  enabled: boolean;
  movementSpeed?: number;
  joystickRef: MutableRefObject<{ x: number; y: number }>;
}

const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _vec = new THREE.Vector3();

export default function WalkthroughControls({
  enabled,
  movementSpeed = 2,
  joystickRef,
}: WalkthroughControlsProps) {
  const { camera, gl } = useThree();
  const isDragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const keys = useRef(new Set<string>());

  // Pointer events for look-around
  useEffect(() => {
    if (!enabled) return;

    const el = gl.domElement;

    const onPointerDown = (e: PointerEvent) => {
      isDragging.current = true;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return;

      const dx = e.clientX - lastPointer.current.x;
      const dy = e.clientY - lastPointer.current.y;
      lastPointer.current = { x: e.clientX, y: e.clientY };

      // Invert look direction on touch (mobile) vs mouse (desktop)
      const sign = e.pointerType === 'touch' ? -1 : 1;
      _euler.setFromQuaternion(camera.quaternion, 'YXZ');
      _euler.y += sign * dx * 0.003;
      _euler.x += sign * dy * 0.003;
      _euler.x = Math.max(-Math.PI * 85 / 180, Math.min(Math.PI * 85 / 180, _euler.x));
      camera.quaternion.setFromEuler(_euler);
    };

    const onPointerUp = (e: PointerEvent) => {
      isDragging.current = false;
      el.releasePointerCapture(e.pointerId);
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      isDragging.current = false;
    };
  }, [enabled, camera, gl]);

  // Keyboard events for WASD movement
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => keys.current.add(e.code);
    const onKeyUp = (e: KeyboardEvent) => keys.current.delete(e.code);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      keys.current.clear();
    };
  }, [enabled]);

  // Per-frame movement
  useFrame((_, delta) => {
    if (!enabled) return;

    const speed = movementSpeed * delta;
    let moveX = 0;
    let moveZ = 0;
    let moveY = 0;

    // Keyboard input
    const k = keys.current;
    if (k.has('KeyW') || k.has('ArrowUp')) moveZ -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) moveZ += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) moveX -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) moveX += 1;
    if (k.has('Space')) moveY += 1;
    if (k.has('ShiftLeft') || k.has('ShiftRight')) moveY -= 1;

    // Joystick input (mobile)
    const joy = joystickRef.current;
    if (Math.abs(joy.x) > 0.05 || Math.abs(joy.y) > 0.05) {
      moveX += joy.x;
      moveZ += -joy.y; // joystick y-up = forward = -z
    }

    // Apply movement relative to camera facing direction
    if (moveX !== 0 || moveZ !== 0) {
      _vec.set(moveX, 0, moveZ).normalize().multiplyScalar(speed);

      // Get camera forward/right projected onto XZ plane
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      forward.y = 0;
      forward.normalize();
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      right.y = 0;
      right.normalize();

      camera.position.addScaledVector(right, _vec.x);
      camera.position.addScaledVector(forward, -_vec.z);
    }

    if (moveY !== 0) {
      camera.position.y += moveY * speed;
    }
  });

  return null;
}

// ── Mobile Joystick Overlay ──

interface MobileJoystickProps {
  joystickRef: MutableRefObject<{ x: number; y: number }>;
}

export function MobileJoystick({ joystickRef }: MobileJoystickProps) {
  const padRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const activePointer = useRef<number | null>(null);
  const padCenter = useRef({ x: 0, y: 0 });

  const PAD_RADIUS = 60; // half of 120px pad
  const KNOB_RADIUS = 20; // half of 40px knob
  const MAX_OFFSET = PAD_RADIUS - KNOB_RADIUS;

  useEffect(() => {
    const pad = padRef.current;
    if (!pad) return;

    const onPointerDown = (e: PointerEvent) => {
      if (activePointer.current !== null) return;
      activePointer.current = e.pointerId;
      pad.setPointerCapture(e.pointerId);

      const rect = pad.getBoundingClientRect();
      padCenter.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      updateKnob(e.clientX, e.clientY);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId !== activePointer.current) return;
      updateKnob(e.clientX, e.clientY);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId !== activePointer.current) return;
      activePointer.current = null;
      joystickRef.current = { x: 0, y: 0 };
      if (knobRef.current) {
        knobRef.current.style.transform = 'translate(-50%, -50%)';
      }
    };

    const updateKnob = (clientX: number, clientY: number) => {
      let dx = clientX - padCenter.current.x;
      let dy = clientY - padCenter.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > MAX_OFFSET) {
        dx = (dx / dist) * MAX_OFFSET;
        dy = (dy / dist) * MAX_OFFSET;
      }

      joystickRef.current = {
        x: dx / MAX_OFFSET,
        y: -dy / MAX_OFFSET, // invert y so up = positive
      };

      if (knobRef.current) {
        knobRef.current.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      }
    };

    pad.addEventListener('pointerdown', onPointerDown);
    pad.addEventListener('pointermove', onPointerMove);
    pad.addEventListener('pointerup', onPointerUp);
    pad.addEventListener('pointercancel', onPointerUp);

    return () => {
      pad.removeEventListener('pointerdown', onPointerDown);
      pad.removeEventListener('pointermove', onPointerMove);
      pad.removeEventListener('pointerup', onPointerUp);
      pad.removeEventListener('pointercancel', onPointerUp);
    };
  }, [joystickRef]);

  return (
    <div className="walkthrough-joystick">
      <div className="joystick-pad" ref={padRef}>
        <div className="joystick-knob" ref={knobRef} />
      </div>
    </div>
  );
}
