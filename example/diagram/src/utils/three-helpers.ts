import * as THREE from 'three';
import { Node, Connection, NodeObjects } from '../types';

export const createTextTexture = (text: string): THREE.Texture => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 256;
  canvas.height = 64;

  if (context) {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.font = '24px Arial';
    context.fillStyle = '#000000';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);
  }

  const texture = new THREE.Texture(canvas);
  texture.needsUpdate = true;
  return texture;
};

export const createNode = (
  nodeId: string,
  nodeData: Node,
  scene: THREE.Scene,
  nodeObjectsMap: NodeObjects
): void => {
  let geometry: THREE.BufferGeometry;
  let material: THREE.Material;
  let mesh: THREE.Mesh;

  const { type, position, color, scale } = nodeData;

  switch (type) {
    case 'orchestrator':
      geometry = new THREE.OctahedronGeometry(1, 2);
      break;
    case 'client':
      geometry = new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
      break;
    case 'service':
      geometry = new THREE.SphereGeometry(0.8, 32, 32);
      break;
    case 'agent':
      geometry = new THREE.ConeGeometry(0.8, 1.5, 32);
      break;
    case 'mcp':
      geometry = new THREE.TorusGeometry(0.6, 0.3, 16, 32);
      break;
    default:
      geometry = new THREE.BoxGeometry(1, 1, 1);
  }

  material = new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.3,
    roughness: 0.4,
    reflectivity: 0.5,
    clearcoat: 0.3,
    clearcoatRoughness: 0.25,
    side: THREE.DoubleSide
  });

  mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.scale.set(scale, scale, scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { nodeId };

  scene.add(mesh);
  nodeObjectsMap[nodeId] = mesh;
};

export const createConnection = (
  connection: Connection,
  nodes: { [key: string]: Node },
  scene: THREE.Scene
): void => {
  const { from, to, color, width = 1 } = connection;
  const fromNode = nodes[from];
  const toNode = nodes[to];

  if (!fromNode || !toNode) return;

  const points: THREE.Vector3[] = [];
  const fromPos = new THREE.Vector3(...fromNode.position);
  const toPos = new THREE.Vector3(...toNode.position);
  
  const midPoint = new THREE.Vector3().addVectors(fromPos, toPos).multiplyScalar(0.5);
  midPoint.y += 1;

  const curve = new THREE.QuadraticBezierCurve3(
    fromPos,
    midPoint,
    toPos
  );

  for (let i = 0; i <= 20; i++) {
    points.push(curve.getPoint(i / 20));
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ 
    color,
    linewidth: width,
    transparent: true,
    opacity: 0.8
  });
  
  const line = new THREE.Line(geometry, material);
  scene.add(line);
};

export const highlightNode = (nodeId: string, nodeObjects: NodeObjects): void => {
  Object.entries(nodeObjects).forEach(([id, object]) => {
    const material = object.material as THREE.MeshPhysicalMaterial;
    if (id === nodeId) {
      material.emissive.setHex(0x555555);
      material.emissiveIntensity = 0.5;
    } else {
      material.emissive.setHex(0x000000);
      material.emissiveIntensity = 0;
    }
  });
}; 