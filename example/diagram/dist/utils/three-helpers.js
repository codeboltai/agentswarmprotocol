import * as THREE from 'three';
export const createTextTexture = (text) => {
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
export const createNode = (nodeId, nodeData, scene, nodeObjectsMap) => {
    let geometry;
    let material;
    let mesh;
    const { type, position, color } = nodeData;
    switch (type) {
        case 'orchestrator':
            geometry = new THREE.OctahedronGeometry(1.2);
            break;
        case 'client':
            geometry = new THREE.BoxGeometry(1, 1, 1);
            break;
        case 'service':
            geometry = new THREE.SphereGeometry(0.8);
            break;
        case 'agent':
            geometry = new THREE.ConeGeometry(0.8, 1.5);
            break;
        case 'mcp':
            geometry = new THREE.TorusGeometry(0.6, 0.3);
            break;
        default:
            geometry = new THREE.BoxGeometry(1, 1, 1);
    }
    material = new THREE.MeshPhongMaterial({
        color,
        specular: 0x444444,
        shininess: 30,
    });
    mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { nodeId };
    scene.add(mesh);
    nodeObjectsMap[nodeId] = mesh;
};
export const createConnection = (connection, nodes, scene) => {
    const { from, to, color } = connection;
    const fromNode = nodes[from];
    const toNode = nodes[to];
    if (!fromNode || !toNode)
        return;
    const points = [
        new THREE.Vector3(...fromNode.position),
        new THREE.Vector3(...toNode.position),
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color });
    const line = new THREE.Line(geometry, material);
    scene.add(line);
};
export const highlightNode = (nodeId, nodeObjects) => {
    Object.entries(nodeObjects).forEach(([id, object]) => {
        const material = object.material;
        if (id === nodeId) {
            material.emissive.setHex(0x555555);
        }
        else {
            material.emissive.setHex(0x000000);
        }
    });
};
//# sourceMappingURL=three-helpers.js.map