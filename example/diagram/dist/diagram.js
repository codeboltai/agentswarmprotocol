import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
const AgentsOneProtocol3D = () => {
    const mountRef = useRef(null);
    const [loaded, setLoaded] = useState(false);
    const [nodes, setNodes] = useState({
        orchestrator: { type: 'orchestrator', position: [0, 0, 0], color: 0x6366f1 },
        client1: { type: 'client', position: [-8, 4, -5], color: 0x10b981 },
        client2: { type: 'client', position: [-10, 0, 0], color: 0x10b981 },
        service1: { type: 'service', position: [8, 4, -4], color: 0xf59e0b },
        service2: { type: 'service', position: [10, 0, 2], color: 0xf59e0b },
        agent1: { type: 'agent', position: [-5, -6, 2], color: 0xec4899 },
        agent2: { type: 'agent', position: [0, -8, -3], color: 0xec4899 },
        mcp1: { type: 'mcp', position: [6, -5, 0], color: 0x8b5cf6 },
    });
    const [connections, setConnections] = useState([
        { from: 'orchestrator', to: 'client1', label: 'connects', color: 0xaaaaaa },
        { from: 'orchestrator', to: 'client2', label: 'connects', color: 0xaaaaaa },
        { from: 'orchestrator', to: 'service1', label: 'manages', color: 0xaaaaaa },
        { from: 'orchestrator', to: 'service2', label: 'manages', color: 0xaaaaaa },
        { from: 'orchestrator', to: 'agent1', label: 'connects', color: 0xaaaaaa },
        { from: 'orchestrator', to: 'agent2', label: 'connects', color: 0xaaaaaa },
        { from: 'orchestrator', to: 'mcp1', label: 'manages', color: 0xaaaaaa },
        { from: 'agent1', to: 'orchestrator', label: 'requests MCP', color: 0xff5555 },
        { from: 'agent2', to: 'orchestrator', label: 'requests Service', color: 0xff5555 },
        { from: 'service1', to: 'client1', label: 'sends updates', color: 0x55ff55 },
    ]);
    const [controls, setControls] = useState(null);
    const [selectedNode, setSelectedNode] = useState(null);
    const [raycaster] = useState(new THREE.Raycaster());
    const [mouse] = useState(new THREE.Vector2());
    const [scene, setScene] = useState(null);
    const [nodeObjects, setNodeObjects] = useState({});
    const [labelObjects, setLabelObjects] = useState({});
    useEffect(() => {
        // Initialize scene
        const width = mountRef.current.clientWidth;
        const height = mountRef.current.clientHeight;
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf0f0f0);
        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.set(0, 0, 20);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.shadowMap.enabled = true;
        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);
        // Add directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 10);
        directionalLight.castShadow = true;
        scene.add(directionalLight);
        // Add point lights for better 3D effect
        const pointLight1 = new THREE.PointLight(0xffffff, 0.5);
        pointLight1.position.set(-10, 10, 10);
        scene.add(pointLight1);
        const pointLight2 = new THREE.PointLight(0xffffff, 0.3);
        pointLight2.position.set(10, -10, -10);
        scene.add(pointLight2);
        // Custom orbit controls implementation
        const rotateSpeed = 0.3;
        const zoomSpeed = 0.1;
        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };
        let cameraDistance = 20;
        let cameraTheta = Math.PI / 2; // horizontal angle
        let cameraPhi = Math.PI / 2; // vertical angle
        // Function to update camera position
        const updateCameraPosition = () => {
            // Convert spherical coordinates to cartesian
            camera.position.x = cameraDistance * Math.sin(cameraPhi) * Math.cos(cameraTheta);
            camera.position.y = cameraDistance * Math.cos(cameraPhi);
            camera.position.z = cameraDistance * Math.sin(cameraPhi) * Math.sin(cameraTheta);
            camera.lookAt(0, 0, 0);
        };
        // Initial camera position
        updateCameraPosition();
        // Mouse down event
        const handleMouseDown = (event) => {
            isDragging = true;
            previousMousePosition = {
                x: event.clientX,
                y: event.clientY
            };
        };
        // Mouse move event
        const handleMouseMove = (event) => {
            if (!isDragging)
                return;
            const deltaMove = {
                x: event.clientX - previousMousePosition.x,
                y: event.clientY - previousMousePosition.y
            };
            // Update angles
            cameraTheta += deltaMove.x * rotateSpeed * 0.01;
            cameraPhi += deltaMove.y * rotateSpeed * 0.01;
            // Clamp vertical rotation
            cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraPhi));
            updateCameraPosition();
            previousMousePosition = {
                x: event.clientX,
                y: event.clientY
            };
        };
        // Mouse up event
        const handleMouseUp = () => {
            isDragging = false;
        };
        // Mouse wheel event for zoom
        const handleMouseWheel = (event) => {
            const delta = Math.sign(event.deltaY);
            cameraDistance += delta * zoomSpeed * cameraDistance * 0.2;
            // Clamp distance
            cameraDistance = Math.max(5, Math.min(50, cameraDistance));
            updateCameraPosition();
            event.preventDefault();
        };
        // Add event listeners
        renderer.domElement.addEventListener('mousedown', handleMouseDown);
        renderer.domElement.addEventListener('mousemove', handleMouseMove);
        renderer.domElement.addEventListener('mouseup', handleMouseUp);
        renderer.domElement.addEventListener('wheel', handleMouseWheel);
        // Clear previous content
        if (mountRef.current.firstChild) {
            mountRef.current.removeChild(mountRef.current.firstChild);
        }
        mountRef.current.appendChild(renderer.domElement);
        // Save scene reference
        setScene(scene);
        // Create node and label objects
        const nodeObjectsMap = {};
        const labelObjectsMap = {};
        // Create 3D text loader
        const fontLoader = new THREE.FontLoader();
        // Simple cube for testing, will be replaced with actual nodes
        Object.entries(nodes).forEach(([nodeId, nodeData]) => {
            createNode(nodeId, nodeData, scene, nodeObjectsMap);
        });
        setNodeObjects(nodeObjectsMap);
        // Create connections
        connections.forEach(connection => {
            createConnection(connection, nodes, scene);
        });
        // Animation loop
        const animate = () => {
            requestAnimationFrame(animate);
            // No need for controls update in the animation loop
            // Our custom controls update only on user interaction
            renderer.render(scene, camera);
        };
        animate();
        // Handle window resize
        const handleResize = () => {
            const width = mountRef.current.clientWidth;
            const height = mountRef.current.clientHeight;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        };
        window.addEventListener('resize', handleResize);
        // Handle mouse click for node selection
        const handleMouseClick = (event) => {
            // Calculate mouse position in normalized device coordinates
            const rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            // Update the picking ray with the camera and mouse position
            raycaster.setFromCamera(mouse, camera);
            // Calculate objects intersecting the picking ray
            const intersects = raycaster.intersectObjects(scene.children, true);
            if (intersects.length > 0) {
                // Check if the intersected object is a node
                const nodeId = intersects[0].object.userData.nodeId;
                if (nodeId) {
                    setSelectedNode(nodeId);
                    // Highlight the selected node
                    highlightNode(nodeId, nodeObjectsMap);
                }
            }
        };
        renderer.domElement.addEventListener('click', handleMouseClick);
        // Set loaded state
        setLoaded(true);
        return () => {
            window.removeEventListener('resize', handleResize);
            renderer.domElement.removeEventListener('click', handleMouseClick);
            renderer.domElement.removeEventListener('mousedown', handleMouseDown);
            renderer.domElement.removeEventListener('mousemove', handleMouseMove);
            renderer.domElement.removeEventListener('mouseup', handleMouseUp);
            renderer.domElement.removeEventListener('wheel', handleMouseWheel);
        };
    }, []);
    // Create node function
    const createNode = (nodeId, nodeData, scene, nodeObjectsMap) => {
        let geometry;
        let material;
        let mesh;
        const { type, position, color } = nodeData;
        // Create different shapes based on node type
        switch (type) {
            case 'orchestrator':
                geometry = new THREE.BoxGeometry(2, 2, 2);
                material = new THREE.MeshPhongMaterial({
                    color: color,
                    transparent: true,
                    opacity: 0.8,
                    shininess: 100
                });
                break;
            case 'client':
                geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
                material = new THREE.MeshPhongMaterial({
                    color: color,
                    transparent: true,
                    opacity: 0.8,
                    shininess: 100
                });
                break;
            case 'service':
                geometry = new THREE.CylinderGeometry(1, 1, 1.5, 16);
                material = new THREE.MeshPhongMaterial({
                    color: color,
                    transparent: true,
                    opacity: 0.8,
                    shininess: 100
                });
                break;
            case 'agent':
                geometry = new THREE.SphereGeometry(1, 32, 32);
                material = new THREE.MeshPhongMaterial({
                    color: color,
                    transparent: true,
                    opacity: 0.8,
                    shininess: 100
                });
                break;
            case 'mcp':
                geometry = new THREE.OctahedronGeometry(1.2);
                material = new THREE.MeshPhongMaterial({
                    color: color,
                    transparent: true,
                    opacity: 0.8,
                    shininess: 100
                });
                break;
            default:
                geometry = new THREE.BoxGeometry(1, 1, 1);
                material = new THREE.MeshPhongMaterial({ color: color });
        }
        mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(...position);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        // Store the node ID in the mesh
        mesh.userData.nodeId = nodeId;
        // Add glow effect
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.2,
            side: THREE.BackSide
        });
        const glowMesh = new THREE.Mesh(geometry.clone().scale(1.2, 1.2, 1.2), glowMaterial);
        mesh.add(glowMesh);
        // Create text label
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: createTextTexture(nodeId.charAt(0).toUpperCase() + nodeId.slice(1)),
            transparent: true,
            opacity: 0.8
        }));
        sprite.scale.set(4, 2, 1);
        sprite.position.set(position[0], position[1] - 2, position[2]);
        scene.add(mesh);
        scene.add(sprite);
        nodeObjectsMap[nodeId] = mesh;
        return mesh;
    };
    // Create text texture function
    const createTextTexture = (text) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 128;
        // Background (transparent)
        ctx.fillStyle = 'rgba(255, 255, 255, 0)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Text
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        // Draw text with black outline for better visibility
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    };
    // Create connection function
    const createConnection = (connection, nodes, scene) => {
        const { from, to, label, color } = connection;
        const fromPos = new THREE.Vector3(...nodes[from].position);
        const toPos = new THREE.Vector3(...nodes[to].position);
        // Create curve for the connection
        const midPoint = new THREE.Vector3().addVectors(fromPos, toPos).multiplyScalar(0.5);
        // Add some curve height based on distance
        const distance = fromPos.distanceTo(toPos);
        const curveHeight = distance * 0.3;
        // Find perpendicular direction for the curve peak
        const direction = new THREE.Vector3().subVectors(toPos, fromPos).normalize();
        const perpendicular = new THREE.Vector3(direction.y, -direction.x, 0).normalize();
        perpendicular.multiplyScalar(curveHeight);
        // Lift curve up slightly for better visibility
        const upVector = new THREE.Vector3(0, 1, 0);
        upVector.multiplyScalar(curveHeight * 0.5);
        midPoint.add(upVector);
        // Create quadratic bezier curve
        const curve = new THREE.QuadraticBezierCurve3(fromPos, midPoint, toPos);
        // Create tube geometry along the curve
        const tubeGeometry = new THREE.TubeGeometry(curve, 20, 0.05, 8, false);
        const tubeMaterial = new THREE.MeshPhongMaterial({
            color: color,
            shininess: 30,
            transparent: true,
            opacity: 0.7
        });
        const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
        scene.add(tube);
        // Create arrow at the end of the tube
        const arrowPos = curve.getPoint(0.9);
        const arrowDir = new THREE.Vector3().subVectors(toPos, curve.getPoint(0.8)).normalize();
        const arrowLength = 0.5;
        const arrowGeometry = new THREE.ConeGeometry(0.2, arrowLength, 8);
        const arrowMaterial = new THREE.MeshPhongMaterial({ color: color });
        const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        // Position and orient the arrow
        arrow.position.copy(arrowPos);
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), arrowDir);
        arrow.setRotationFromQuaternion(quaternion);
        scene.add(arrow);
        // Create label at midpoint
        const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: createTextTexture(label),
            transparent: true,
            opacity: 0.9
        }));
        labelSprite.scale.set(3, 1.5, 1);
        labelSprite.position.copy(midPoint);
        scene.add(labelSprite);
        return {
            tube,
            arrow,
            labelSprite
        };
    };
    // Highlight node function
    const highlightNode = (nodeId, nodeObjectsMap) => {
        // Reset all nodes
        Object.values(nodeObjectsMap).forEach(node => {
            node.scale.set(1, 1, 1);
            node.material.emissive = new THREE.Color(0x000000);
        });
        // Highlight selected node
        const selectedNode = nodeObjectsMap[nodeId];
        if (selectedNode) {
            selectedNode.scale.set(1.2, 1.2, 1.2);
            selectedNode.material.emissive = new THREE.Color(0xffff00);
        }
    };
    // Add a new node to the scene
    const addNode = (type) => {
        if (!scene)
            return;
        // Generate a random position
        const position = [
            Math.random() * 10 - 5,
            Math.random() * 10 - 5,
            Math.random() * 10 - 5
        ];
        // Generate a unique ID
        const existingNodesOfType = Object.keys(nodes).filter(key => nodes[key].type === type).length;
        const nodeId = `${type}${existingNodesOfType + 1}`;
        // Define color based on type
        const colors = {
            client: 0x10b981,
            service: 0xf59e0b,
            agent: 0xec4899,
            mcp: 0x8b5cf6
        };
        // Create new node data
        const newNodeData = {
            type,
            position,
            color: colors[type] || 0xaaaaaa
        };
        // Update nodes state
        setNodes(prevNodes => ({
            ...prevNodes,
            [nodeId]: newNodeData
        }));
        // Create 3D node
        const nodeObjectsCopy = { ...nodeObjects };
        const newNodeObject = createNode(nodeId, newNodeData, scene, nodeObjectsCopy);
        // Update nodeObjects state
        setNodeObjects(nodeObjectsCopy);
        // Add connection to orchestrator
        const newConnection = {
            from: nodeId,
            to: 'orchestrator',
            label: 'connects to',
            color: 0xaaaaaa
        };
        createConnection(newConnection, { ...nodes, [nodeId]: newNodeData }, scene);
        setConnections(prevConnections => [...prevConnections, newConnection]);
    };
    return (_jsxs("div", { className: "flex flex-col w-full h-full", children: [_jsxs("div", { className: "bg-gray-100 p-4 flex justify-center space-x-2 mb-4", children: [_jsx("button", { className: "bg-green-500 text-white px-4 py-2 rounded", onClick: () => addNode('client'), children: "Add Client" }), _jsx("button", { className: "bg-yellow-500 text-white px-4 py-2 rounded", onClick: () => addNode('service'), children: "Add Service" }), _jsx("button", { className: "bg-pink-500 text-white px-4 py-2 rounded", onClick: () => addNode('agent'), children: "Add Agent" }), _jsx("button", { className: "bg-purple-500 text-white px-4 py-2 rounded", onClick: () => addNode('mcp'), children: "Add MCP" })] }), _jsxs("div", { className: "relative border border-gray-300 rounded bg-black flex-grow", style: { height: '500px' }, children: [_jsx("div", { ref: mountRef, className: "absolute inset-0" }), selectedNode && (_jsxs("div", { className: "absolute bottom-4 left-4 bg-white bg-opacity-80 p-2 rounded", children: [_jsx("p", { className: "font-bold", children: selectedNode }), _jsxs("p", { className: "text-sm", children: ["Type: ", nodes[selectedNode]?.type] })] }))] }), _jsx("div", { className: "mt-4 p-4 bg-gray-100 rounded", children: _jsxs("p", { className: "text-sm", children: [_jsx("strong", { children: "Instructions:" }), " Use mouse to orbit around the scene. Click on nodes to select them. Use the buttons to add new components."] }) })] }));
};
export default AgentsOneProtocol3D;
//# sourceMappingURL=diagram.js.map