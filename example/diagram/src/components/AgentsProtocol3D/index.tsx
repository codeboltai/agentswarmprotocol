import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Node, Connection, NodeObjects, LabelObjects, NodeType } from '../../types';
import { createNode, createConnection, highlightNode } from '../../utils/three-helpers';

const initialNodes: { [key: string]: Node } = {
  orchestrator: { type: 'orchestrator', position: [0, 0, 0], color: 0x6366f1, scale: 1.5 },
  client1: { type: 'client', position: [-8, 0, -5], color: 0x10b981, scale: 1.2 },
  client2: { type: 'client', position: [-8, 0, 5], color: 0x10b981, scale: 1.2 },
  service1: { type: 'service', position: [8, 0, -5], color: 0xf59e0b, scale: 1.3 },
  service2: { type: 'service', position: [8, 0, 5], color: 0xf59e0b, scale: 1.3 },
  agent1: { type: 'agent', position: [-4, 0, 0], color: 0xec4899, scale: 1.2 },
  agent2: { type: 'agent', position: [4, 0, 0], color: 0xec4899, scale: 1.2 },
  mcp1: { type: 'mcp', position: [0, 0, 6], color: 0x8b5cf6, scale: 1.4 },
};

const initialConnections: Connection[] = [
  { from: 'orchestrator', to: 'client1', label: 'connects', color: 0x6366f1, width: 2 },
  { from: 'orchestrator', to: 'client2', label: 'connects', color: 0x6366f1, width: 2 },
  { from: 'orchestrator', to: 'service1', label: 'manages', color: 0xf59e0b, width: 2 },
  { from: 'orchestrator', to: 'service2', label: 'manages', color: 0xf59e0b, width: 2 },
  { from: 'orchestrator', to: 'agent1', label: 'connects', color: 0xec4899, width: 2 },
  { from: 'orchestrator', to: 'agent2', label: 'connects', color: 0xec4899, width: 2 },
  { from: 'orchestrator', to: 'mcp1', label: 'manages', color: 0x8b5cf6, width: 2 },
  { from: 'agent1', to: 'orchestrator', label: 'requests MCP', color: 0xff5555, width: 1.5 },
  { from: 'agent2', to: 'orchestrator', label: 'requests Service', color: 0xff5555, width: 1.5 },
  { from: 'service1', to: 'client1', label: 'sends updates', color: 0x55ff55, width: 1.5 },
];

const AgentsProtocol3D: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [nodes, setNodes] = useState(initialNodes);
  const [connections] = useState(initialConnections);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [raycaster] = useState(new THREE.Raycaster());
  const [mouse] = useState(new THREE.Vector2());
  const [scene, setScene] = useState<THREE.Scene | null>(null);
  const [nodeObjects, setNodeObjects] = useState<NodeObjects>({});
  const [labelObjects] = useState<LabelObjects>({});

  useEffect(() => {
    if (!mountRef.current) return;

    // Initialize scene
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a); // Darker background
    
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 15, 20); // Position camera higher and further back
    
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
      logarithmicDepthBuffer: true
    });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    
    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    directionalLight.shadow.bias = -0.0001;
    scene.add(directionalLight);
    
    // Add ground plane with grid
    const gridHelper = new THREE.GridHelper(30, 30, 0x444444, 0x222222);
    scene.add(gridHelper);
    
    const groundGeometry = new THREE.PlaneGeometry(30, 30);
    const groundMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x222222,
      metalness: 0.2,
      roughness: 0.8,
      clearcoat: 0.1,
      clearcoatRoughness: 0.4,
      side: THREE.DoubleSide
    });
    const groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.position.y = -0.01; // Slightly below the objects
    groundPlane.receiveShadow = true;
    scene.add(groundPlane);
    
    // Camera controls setup
    const rotateSpeed = 0.3;
    const zoomSpeed = 0.1;
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let cameraDistance = 20;
    let cameraTheta = Math.PI / 2;
    let cameraPhi = Math.PI / 2;
    
    const updateCameraPosition = () => {
      camera.position.x = cameraDistance * Math.sin(cameraPhi) * Math.cos(cameraTheta);
      camera.position.y = cameraDistance * Math.cos(cameraPhi);
      camera.position.z = cameraDistance * Math.sin(cameraPhi) * Math.sin(cameraTheta);
      camera.lookAt(0, 0, 0);
    };
    
    updateCameraPosition();
    
    // Event handlers
    const handleMouseDown = (event: MouseEvent) => {
      isDragging = true;
      previousMousePosition = {
        x: event.clientX,
        y: event.clientY
      };
    };
    
    const handleMouseMove = (event: MouseEvent) => {
      if (!isDragging) return;
      
      const deltaMove = {
        x: event.clientX - previousMousePosition.x,
        y: event.clientY - previousMousePosition.y
      };
      
      cameraTheta += deltaMove.x * rotateSpeed * 0.01;
      cameraPhi += deltaMove.y * rotateSpeed * 0.01;
      cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraPhi));
      
      updateCameraPosition();
      
      previousMousePosition = {
        x: event.clientX,
        y: event.clientY
      };
    };
    
    const handleMouseUp = () => {
      isDragging = false;
    };
    
    const handleMouseWheel = (event: WheelEvent) => {
      const delta = Math.sign(event.deltaY);
      cameraDistance += delta * zoomSpeed * cameraDistance * 0.2;
      cameraDistance = Math.max(5, Math.min(50, cameraDistance));
      
      updateCameraPosition();
      event.preventDefault();
    };
    
    // Add event listeners
    renderer.domElement.addEventListener('mousedown', handleMouseDown);
    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('mouseup', handleMouseUp);
    renderer.domElement.addEventListener('wheel', handleMouseWheel);
    
    // Clear previous content and append renderer
    while (mountRef.current.firstChild) {
      mountRef.current.removeChild(mountRef.current.firstChild);
    }
    mountRef.current.appendChild(renderer.domElement);
    
    setScene(scene);
    
    // Create nodes and connections
    const nodeObjectsMap: NodeObjects = {};
    Object.entries(nodes).forEach(([nodeId, nodeData]) => {
      createNode(nodeId, nodeData, scene, nodeObjectsMap);
    });
    setNodeObjects(nodeObjectsMap);
    
    connections.forEach(connection => {
      createConnection(connection, nodes, scene);
    });
    
    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();
    
    // Handle window resize
    const handleResize = () => {
      if (!mountRef.current) return;
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    
    window.addEventListener('resize', handleResize);
    
    // Handle node selection
    const handleClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);
      
      if (intersects.length > 0) {
        const nodeId = intersects[0].object.userData.nodeId as string;
        if (nodeId) {
          setSelectedNode(nodeId);
          highlightNode(nodeId, nodeObjectsMap);
        }
      }
    };
    
    renderer.domElement.addEventListener('click', handleClick);
    setLoaded(true);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('click', handleClick);
      renderer.domElement.removeEventListener('mousedown', handleMouseDown);
      renderer.domElement.removeEventListener('mousemove', handleMouseMove);
      renderer.domElement.removeEventListener('mouseup', handleMouseUp);
      renderer.domElement.removeEventListener('wheel', handleMouseWheel);
      // Clean up Three.js resources
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (object.material instanceof THREE.Material) {
            object.material.dispose();
          }
        }
      });
      renderer.dispose();
    };
  }, [nodes, connections, mouse, raycaster]);

  return (
    <div
      ref={mountRef}
      style={{
        width: '100%',
        height: '100vh',
        position: 'relative',
      }}
    >
      {selectedNode && nodes[selectedNode] && (
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            background: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '10px',
            borderRadius: '5px',
          }}
        >
          <div>Selected: {selectedNode}</div>
          <div>Type: {nodes[selectedNode].type}</div>
        </div>
      )}
    </div>
  );
};

export default AgentsProtocol3D; 