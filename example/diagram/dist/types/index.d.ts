import { Mesh, Sprite } from 'three';
export type NodeType = 'orchestrator' | 'client' | 'service' | 'agent' | 'mcp';
export interface Node {
    type: NodeType;
    position: [number, number, number];
    color: number;
}
export interface Connection {
    from: string;
    to: string;
    label: string;
    color: number;
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
//# sourceMappingURL=index.d.ts.map