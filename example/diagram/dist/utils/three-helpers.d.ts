import * as THREE from 'three';
import { Node, Connection, NodeObjects } from '../types';
export declare const createTextTexture: (text: string) => THREE.Texture;
export declare const createNode: (nodeId: string, nodeData: Node, scene: THREE.Scene, nodeObjectsMap: NodeObjects) => void;
export declare const createConnection: (connection: Connection, nodes: {
    [key: string]: Node;
}, scene: THREE.Scene) => void;
export declare const highlightNode: (nodeId: string, nodeObjects: NodeObjects) => void;
//# sourceMappingURL=three-helpers.d.ts.map