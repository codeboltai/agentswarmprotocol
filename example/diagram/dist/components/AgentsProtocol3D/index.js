import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createNode, createConnection, highlightNode } from '../../utils/three-helpers';
const initialNodes = {
    orchestrator: { type: 'orchestrator', position: [0, 0, 0], color: 0x6366f1 },
    client1: { type: 'client', position: [-8, 4, -5], color: 0x10b981 },
    client2: { type: 'client', position: [-10, 0, 0], color: 0x10b981 },
    service1: { type: 'service', position: [8, 4, -4], color: 0xf59e0b },
    service2: { type: 'service', position: [10, 0, 2], color: 0xf59e0b },
    agent1: { type: 'agent', position: [-5, -6, 2], color: 0xec4899 },
    agent2: { type: 'agent', position: [0, -8, -3], color: 0xec4899 },
    mcp1: { type: 'mcp', position: [6, -5, 0], color: 0x8b5cf6 },
};
const initialConnections = [
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
];
const AgentsProtocol3D = () => {
    const mountRef = useRef(null);
    const [loaded, setLoaded] = useState(false);
    const [nodes, setNodes] = useState(initialNodes);
    const [connections] = useState(initialConnections);
    const [selectedNode, setSelectedNode] = useState(null);
    const [raycaster] = useState(new THREE.Raycaster());
    const [mouse] = useState(new THREE.Vector2());
    const [scene, setScene] = useState(null);
    const [nodeObjects, setNodeObjects] = useState({});
    const [labelObjects] = useState({});
    useEffect(() => {
        if (!mountRef.current)
            return;
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
        // Add lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 10);
        directionalLight.castShadow = true;
        scene.add(directionalLight);
        const pointLight1 = new THREE.PointLight(0xffffff, 0.5);
        pointLight1.position.set(-10, 10, 10);
        scene.add(pointLight1);
        const pointLight2 = new THREE.PointLight(0xffffff, 0.3);
        pointLight2.position.set(10, -10, -10);
        scene.add(pointLight2);
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
        const handleMouseDown = (event) => {
            isDragging = true;
            previousMousePosition = {
                x: event.clientX,
                y: event.clientY
            };
        };
        const handleMouseMove = (event) => {
            if (!isDragging)
                return;
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
        const handleMouseWheel = (event) => {
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
        const nodeObjectsMap = {};
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
            if (!mountRef.current)
                return;
            const width = mountRef.current.clientWidth;
            const height = mountRef.current.clientHeight;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        };
        window.addEventListener('resize', handleResize);
        // Handle node selection
        const handleClick = (event) => {
            const rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(scene.children, true);
            if (intersects.length > 0) {
                const nodeId = intersects[0].object.userData.nodeId;
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
    return (_jsx("div", { ref: mountRef, style: {
            width: '100%',
            height: '100vh',
            position: 'relative',
        }, children: selectedNode && nodes[selectedNode] && (_jsxs("div", { style: {
                position: 'absolute',
                top: 20,
                left: 20,
                background: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                padding: '10px',
                borderRadius: '5px',
            }, children: [_jsxs("div", { children: ["Selected: ", selectedNode] }), _jsxs("div", { children: ["Type: ", nodes[selectedNode].type] })] })) }));
};
export default AgentsProtocol3D;
//# sourceMappingURL=index.js.map