import { Vector3, Mesh, Sprite } from 'three';

export type NodeType = 'orchestrator' | 'client' | 'service' | 'agent' | 'mcp';

export interface Node {
  type: NodeType;
  position: [number, number, number];
  color: number;
  scale: number;
}

export interface Connection {
  from: string;
  to: string;
  label: string;
  color: number;
  width: number;
}

export interface Nodes {
  [key: string]: Node;
}

export interface NodeObjects {
  [key: string]: Mesh;
}

export interface LabelObjects {
  [key: string]: Sprite;
}

export interface CameraControls {
  rotateSpeed: number;
  zoomSpeed: number;
  cameraDistance: number;
  cameraTheta: number;
  cameraPhi: number;
}