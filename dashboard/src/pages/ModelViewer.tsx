import React, { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Grid } from '@react-three/drei';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';
import * as THREE from 'three';
import type { ModelInfo, Manifest, ManifestFile, FileDetail } from '../types';
import { AudioPlaybackProvider } from '../components/useAudioPlayback';
import RecordingCard from '../components/RecordingCard';
import DetailOverlayContent from '../components/DetailOverlay';
import WalkthroughControls, { MobileJoystick } from '../components/WalkthroughControls';

const MODELS: ModelInfo[] = [
  {
    id: 'north_star',
    name: 'North Star Dome (Khiva)',
    description: 'LiDAR scan of the North Star rectangular dome, Khiva, Uzbekistan. Scanned May 2, 2026.',
    objPath: '/models_north_star/obj/5_2_2026.obj',
    mtlPath: '/models_north_star/obj/5_2_2026.mtl',
    dimensions: { width: '3.08m (10.1 ft)', height: '4.03m (13.2 ft)', depth: '4.67m (15.3 ft)' },
    resonance: '93 Hz (Gb2)',
    sites: ['North Star Complex'],
  },
  {
    id: 'north_star_backdome',
    name: 'North Star Back Dome',
    description: 'LiDAR scan of the North Star back dome, Khiva, Uzbekistan. Scanned May 2, 2026.',
    objPath: '/models_north_star_backdome/obj/5_2_2026.obj',
    mtlPath: '/models_north_star_backdome/obj/5_2_2026.mtl',
    dimensions: { width: 'TBD', height: 'TBD', depth: 'TBD' },
    resonance: 'TBD',
    sites: ['North Star Complex'],
  },
  {
    id: 'pahlavan_mahmoud',
    name: 'Pahlavan Mahmoud Mausoleum',
    description: 'LiDAR scan of the Pahlavan Mahmoud Mausoleum dome, Khiva, Uzbekistan. Scanned April 30, 2026.',
    objPath: '/models_pahlavan_mahmoud/obj/4_30_2026.obj',
    mtlPath: '/models_pahlavan_mahmoud/obj/4_30_2026.mtl',
    dimensions: { width: 'TBD', height: 'TBD', depth: 'TBD' },
    resonance: 'TBD',
    sites: [],
  },
  {
    id: 'kalan_mosque',
    name: 'Kalan Mosque Carpet Dome',
    description: 'LiDAR scan of the Kalan Mosque carpet dome, Bukhara, Uzbekistan. Scanned April 30, 2026.',
    objPath: '/models_kalan_mosque/obj/4_30_2026.obj',
    mtlPath: '/models_kalan_mosque/obj/4_30_2026.mtl',
    dimensions: { width: 'TBD', height: 'TBD', depth: 'TBD' },
    resonance: 'TBD',
    sites: ['Bukhara Dome'],
  },
  {
    id: 'museum_box',
    name: 'Museum Box',
    description: 'LiDAR scan of resonant museum box artifact. Scanned April 30, 2026.',
    objPath: '/models_museum_box/obj/4_30_2026.obj',
    mtlPath: '/models_museum_box/obj/4_30_2026.mtl',
    dimensions: { width: '0.64m (2.1 ft)', height: '0.75m (2.5 ft)', depth: '0.59m (1.9 ft)' },
    resonance: '~269 Hz (predicted)',
    sites: ['Khiva Dome'],
  },
];

function ObjModel({ model, autoRotate }: { model: ModelInfo; autoRotate: boolean }) {
  const meshRef = useRef<THREE.Group>(null);
  const [loadedObj, setLoadedObj] = useState<THREE.Group | null>(null);

  // Load MTL then OBJ with materials applied
  useEffect(() => {
    const mtlDir = model.mtlPath.substring(0, model.mtlPath.lastIndexOf('/') + 1);
    const mtlFile = model.mtlPath.substring(model.mtlPath.lastIndexOf('/') + 1);

    const mtlLoader = new MTLLoader();
    mtlLoader.setPath(mtlDir);
    mtlLoader.load(mtlFile, (materials) => {
      materials.preload();

      // Upgrade all MTL materials to MeshStandardMaterial for proper lighting
      Object.values(materials.materials).forEach((mat: any) => {
        if (mat.map) {
          const stdMat = new THREE.MeshStandardMaterial({
            map: mat.map,
            side: THREE.DoubleSide,
            roughness: 0.7,
            metalness: 0.1,
          });
          // Replace in-place so OBJLoader picks it up by name
          const name = mat.name;
          materials.materials[name] = stdMat as any;
          stdMat.name = name;
        }
      });

      const objLoader = new OBJLoader();
      (objLoader as any).setMaterials(materials);
      objLoader.load(model.objPath, (obj) => {
        // Ensure double-sided rendering on any remaining meshes
        obj.traverse((child: THREE.Object3D) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach(m => { m.side = THREE.DoubleSide; });
          }
        });

        // Center the model
        const box = new THREE.Box3().setFromObject(obj);
        const center = box.getCenter(new THREE.Vector3());
        obj.position.sub(center);

        setLoadedObj(obj);
      });
    });

    // Dispose GPU resources on unmount
    return () => {
      setLoadedObj((prev) => {
        if (prev) {
          prev.traverse((child: THREE.Object3D) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.geometry?.dispose();
              const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              mats.forEach(m => {
                if ((m as any).map) (m as any).map.dispose();
                m.dispose();
              });
            }
          });
        }
        return null;
      });
    };
  }, [model.objPath, model.mtlPath]);

  // Slow rotation (gated on autoRotate)
  useFrame((_, delta) => {
    if (meshRef.current && autoRotate) {
      meshRef.current.rotation.y += delta * 0.15;
    }
  });

  if (!loadedObj) return null;

  return (
    <group ref={meshRef}>
      <primitive object={loadedObj} />
    </group>
  );
}

function FallbackModel() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#2a2a3e" wireframe />
    </mesh>
  );
}

// Imperatively set camera position/rotation from outside R3F render loop
function CameraController({ viewMode, savedCameraState }: {
  viewMode: 'orbit' | 'walkthrough';
  savedCameraState: React.MutableRefObject<{ position: THREE.Vector3; quaternion: THREE.Quaternion } | null>;
}) {
  const { camera } = useThree();
  const prevMode = useRef(viewMode);

  useEffect(() => {
    if (prevMode.current === viewMode) return;
    prevMode.current = viewMode;

    if (viewMode === 'walkthrough') {
      // Save current orbit camera state
      savedCameraState.current = {
        position: camera.position.clone(),
        quaternion: camera.quaternion.clone(),
      };
      // Move camera inside the model
      camera.position.set(0, 0, 0);
      camera.quaternion.setFromEuler(new THREE.Euler(0, 0, 0, 'YXZ'));
    } else {
      // Restore saved orbit camera state
      if (savedCameraState.current) {
        camera.position.copy(savedCameraState.current.position);
        camera.quaternion.copy(savedCameraState.current.quaternion);
        savedCameraState.current = null;
      } else {
        camera.position.set(3, 2, 3);
        camera.lookAt(0, 0, 0);
      }
    }
  }, [viewMode, camera, savedCameraState]);

  return null;
}

export default function ModelViewer() {
  const [activeModel, setActiveModel] = useState<ModelInfo>(MODELS[0]);
  const [autoRotate, setAutoRotate] = useState(false);
  const [viewMode, setViewMode] = useState<'orbit' | 'walkthrough'>('orbit');
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileDetail | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const joystickRef = useRef({ x: 0, y: 0 });
  const savedCameraState = useRef<{ position: THREE.Vector3; quaternion: THREE.Quaternion } | null>(null);

  const isWalkthrough = viewMode === 'walkthrough';

  // Force auto-rotation off in walkthrough mode
  const effectiveAutoRotate = isWalkthrough ? false : autoRotate;

  // Fetch manifest on mount
  useEffect(() => {
    fetch('/data/manifest.json')
      .then(r => r.json())
      .then((data: Manifest) => setManifest(data))
      .catch(err => console.error('Failed to load manifest:', err));
  }, []);

  // Reset to orbit mode on model switch, close sidebar on mobile
  const handleModelSwitch = useCallback((model: ModelInfo) => {
    setActiveModel(model);
    setViewMode('orbit');
    savedCameraState.current = null;
    setSidebarOpen(false);
  }, []);

  // Filter recordings by active model's sites
  const siteRecordings = manifest
    ? manifest.files.filter(f => activeModel.sites.includes(f.site))
    : [];

  const loadFileDetail = useCallback(async (file: ManifestFile) => {
    try {
      const resp = await fetch(`/data/${file.id}.json`);
      const data: FileDetail = await resp.json();
      setSelectedFile(data);
    } catch (err) {
      console.error('Failed to load file detail:', err);
    }
  }, []);

  return (
    <div>
      {/* Full-screen 3D viewer with sidebar overlay */}
      <div className="model-viewer-page">
        <div className={`model-sidebar ${sidebarOpen ? 'open' : ''}`}>
          {/* Mobile: compact header that toggles the panel */}
          <div className="sidebar-mobile-header" onClick={() => setSidebarOpen(o => !o)}>
            <span className="sidebar-mobile-title">{activeModel.name}</span>
            <span className={`sidebar-chevron ${sidebarOpen ? 'expanded' : ''}`}>&#9662;</span>
          </div>

          {/* Full sidebar content — always visible on desktop, toggled on mobile */}
          <div className="sidebar-body">
            <h3>LiDAR Scans</h3>
            {MODELS.map(model => (
              <div
                key={model.id}
                className={`model-list-item ${activeModel.id === model.id ? 'active' : ''}`}
                onClick={() => handleModelSwitch(model)}
              >
                <h4>{model.name}</h4>
                <p>{model.description}</p>
                <p style={{ marginTop: 4, color: '#00d4ff' }}>
                  Resonance: {model.resonance}
                </p>
              </div>
            ))}

            <div style={{ marginTop: 24, padding: '16px 0', borderTop: '1px solid #2a2a3e' }}>
              <h4 style={{ fontSize: '0.8rem', margin: '0 0 8px 0', color: '#8888a0' }}>View Mode</h4>
              <div className="view-mode-toggle">
                <button
                  className={`view-mode-btn ${!isWalkthrough ? 'active' : ''}`}
                  onClick={() => setViewMode('orbit')}
                >
                  Orbit View
                </button>
                <button
                  className={`view-mode-btn ${isWalkthrough ? 'active' : ''}`}
                  onClick={() => setViewMode('walkthrough')}
                >
                  Walkthrough
                </button>
              </div>

              {!isWalkthrough && (
                <button
                  className="rotate-toggle-btn"
                  style={{ marginTop: 8 }}
                  onClick={() => setAutoRotate(r => !r)}
                >
                  {autoRotate ? 'Pause Rotation' : 'Resume Rotation'}
                </button>
              )}

              <ul style={{ fontSize: '0.7rem', color: '#8888a0', margin: '12px 0 0 0', paddingLeft: 16, lineHeight: 1.8 }}>
                {isWalkthrough ? (
                  <>
                    <li>Click + drag: look around</li>
                    <li>WASD / Arrows: move</li>
                    <li>Space: move up</li>
                    <li>Shift: move down</li>
                  </>
                ) : (
                  <>
                    <li>Left-click + drag: rotate</li>
                    <li>Right-click + drag: pan</li>
                    <li>Scroll: zoom in/out</li>
                    <li>Double-click: reset view</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>

        <div className="viewer-container">
          <Canvas
            camera={{ position: [3, 2, 3], fov: 50 }}
            style={{ background: '#0a0a0f' }}
            onCreated={({ gl }) => {
              const canvas = gl.domElement;
              canvas.addEventListener('webglcontextlost', (e) => {
                e.preventDefault();
                console.warn('WebGL context lost — reload to restore 3D view');
              });
            }}
          >
            <ambientLight intensity={isWalkthrough ? 0.6 : 0.4} />
            <directionalLight position={[5, 5, 5]} intensity={0.8} />
            <directionalLight position={[-5, 3, -5]} intensity={0.3} />
            <pointLight position={[0, 3, 0]} intensity={0.5} color="#00d4ff" />

            <CameraController viewMode={viewMode} savedCameraState={savedCameraState} />

            <Suspense fallback={<FallbackModel />}>
              <ObjModel key={activeModel.id} model={activeModel} autoRotate={effectiveAutoRotate} />
            </Suspense>

            {isWalkthrough ? (
              <WalkthroughControls enabled joystickRef={joystickRef} />
            ) : (
              <OrbitControls
                enableDamping
                dampingFactor={0.05}
                autoRotate={false}
                maxDistance={15}
                minDistance={0.5}
              />
            )}

            {!isWalkthrough && (
              <Grid
                args={[20, 20]}
                cellSize={0.5}
                cellColor="#1a1a2e"
                sectionSize={2}
                sectionColor="#2a2a3e"
                fadeDistance={15}
                position={[0, -2, 0]}
              />
            )}

            <Environment preset="night" />
          </Canvas>

          {isWalkthrough && <MobileJoystick joystickRef={joystickRef} />}

          <div className="viewer-info">
            <dl style={{ margin: 0 }}>
              <dt>{activeModel.name}</dt>
              <dd>{activeModel.dimensions.width} x {activeModel.dimensions.depth} x {activeModel.dimensions.height}</dd>
              <dt>Resonance</dt>
              <dd>{activeModel.resonance}</dd>
            </dl>
          </div>
        </div>
      </div>

      {/* Audio recordings for this site — full width below the viewer */}
      <AudioPlaybackProvider>
        <div className="model-audio-section">
          <h3>Recordings at this site ({siteRecordings.length})</h3>
          {siteRecordings.length > 0 ? (
            <div className="chart-grid">
              {siteRecordings.map(file => (
                <RecordingCard key={file.id} file={file} onShowDetail={loadFileDetail} />
              ))}
            </div>
          ) : (
            <p style={{ color: '#8888a0', fontSize: '0.85rem' }}>
              No audio recordings mapped to this model yet.
            </p>
          )}
        </div>

        {selectedFile && (
          <DetailOverlayContent file={selectedFile} onClose={() => setSelectedFile(null)} />
        )}
      </AudioPlaybackProvider>
    </div>
  );
}
