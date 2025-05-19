import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJExporter } from 'three/exporters/OBJExporter.js';


let scene, camera, renderer, world;
let blocks = [],
    bodies = [];
let cubeSize = 3,
    currentY = 1.5,
    score = 0;

let dropSound = new Audio('sounds/drop.wav');
let soundUnlocked = false;

function unlockAudio() {
    if (soundUnlocked) return;

    dropSound.play()
        .then(() => {
            dropSound.pause();
            dropSound.currentTime = 0;
            soundUnlocked = true;
            console.log("Sound unlocked.");
        })
        .catch((err) => {
            console.warn("Sound unlock failed:", err);
        });

    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
}

// Unlock sound on first click or keypress
window.addEventListener('click', unlockAudio);
window.addEventListener('keydown', unlockAudio);

window.addEventListener('click', () => {
    if (!soundReady) {
        dropSound.play().then(() => {
            dropSound.pause();
            dropSound.currentTime = 0;
            soundReady = true;
        }).catch(() => {});
    }
});

let mouse = new THREE.Vector2();
let raycaster = new THREE.Raycaster();
let targetDropPosition = new THREE.Vector3(0, currentY, 0);
let previewCube;

init();
animate();

function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(10, 15, 25);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Light
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(10, 20, 10);
    scene.add(light);

    // Cannon world
    world = new CANNON.World();
    world.gravity.set(0, -9.82, 0);

    // Ground (physics + visual)
    const groundShape = new CANNON.Box(new CANNON.Vec3(5, 0.5, 5));
    const groundBody = new CANNON.Body({ mass: 0 });
    groundBody.addShape(groundShape);
    groundBody.position.set(0, -0.5, 0);
    world.addBody(groundBody);

    const groundMesh = new THREE.Mesh(
        new THREE.BoxGeometry(10, 1, 10),
        new THREE.MeshStandardMaterial({ color: 0x4444aa })
    );
    groundMesh.position.y = -0.5;
    scene.add(groundMesh);

    // Create preview cube
    const previewMat = new THREE.MeshStandardMaterial({ color: 0xffffff, opacity: 0.5, transparent: true });
    const previewGeo = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
    previewCube = new THREE.Mesh(previewGeo, previewMat);
    previewCube.position.copy(targetDropPosition);
    scene.add(previewCube);

    // Score UI
    const scoreDiv = document.createElement('div');
    scoreDiv.id = 'score';
    scoreDiv.style.position = 'absolute';
    scoreDiv.style.top = '10px';
    scoreDiv.style.left = '10px';
    scoreDiv.style.color = 'white';
    scoreDiv.style.fontSize = '1.5rem';
    scoreDiv.innerText = `Score: 0`;
    document.body.appendChild(scoreDiv);

    // Events
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('click', dropBlock);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersection);

    targetDropPosition.set(intersection.x, currentY, intersection.z);
    if (previewCube) {
        previewCube.position.copy(targetDropPosition);
    }
}

function dropBlock() {
    const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
    const material = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff });
    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.copy(targetDropPosition);
    scene.add(mesh);
    blocks.push(mesh);

    const shape = new CANNON.Box(new CANNON.Vec3(cubeSize / 2, cubeSize / 2, cubeSize / 2));
    const body = new CANNON.Body({ mass: 1 });
    body.addShape(shape);
    body.position.set(targetDropPosition.x, currentY, targetDropPosition.z);
    world.addBody(body);
    bodies.push(body);

    if (soundUnlocked) {
        dropSound.currentTime = 0;
        dropSound.play().catch((e) => {
            console.warn("Failed to play sound:", e);
        });
    }

    currentY += cubeSize;
    score++;
    document.getElementById("score").innerText = `Score: ${score}`;
}

function animate() {
    requestAnimationFrame(animate);
    world.step(1 / 60);

    for (let i = 0; i < blocks.length; i++) {
        blocks[i].position.copy(bodies[i].position);
        blocks[i].quaternion.copy(bodies[i].quaternion);
    }

    renderer.render(scene, camera);
}

function exportTowerOBJ() {
    const exporter = new OBJExporter();
    const towerGroup = new THREE.Group();
    const mtlLines = [];
    const materialMap = new Map();

    // Assign unique material names to each color
    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const color = block.material.color;
        const hex = color.getHexString();

        let matName = materialMap.get(hex);
        if (!matName) {
            matName = `mat_${materialMap.size}`;
            materialMap.set(hex, matName);
            mtlLines.push(`newmtl ${matName}`);
            mtlLines.push(`Kd ${color.r.toFixed(4)} ${color.g.toFixed(4)} ${color.b.toFixed(4)}\n`);
        }

        // Clone and assign material name
        const clone = block.clone();
        clone.material = block.material.clone();
        clone.material.name = matName;
        towerGroup.add(clone);
    }

    // Generate OBJ text
    let objText = exporter.parse(towerGroup);

    // Inject mtllib reference and ensure usemtl is correct
    objText = `mtllib tower.mtl\n` + objText.replace(/usemtl\s+MeshStandardMaterial/g, (match, offset) => {
        const matchMat = objText.slice(offset).match(/usemtl\s+(mat_\d+)/);
        return matchMat ? `usemtl ${matchMat[1]}` : match;
    });

    // Download .obj
    const objBlob = new Blob([objText], { type: 'text/plain' });
    const objURL = URL.createObjectURL(objBlob);
    const objLink = document.createElement('a');
    objLink.download = 'tower.obj';
    objLink.href = objURL;
    objLink.click();

    // Download .mtl
    const mtlText = mtlLines.join('\n');
    const mtlBlob = new Blob([mtlText], { type: 'text/plain' });
    const mtlURL = URL.createObjectURL(mtlBlob);
    const mtlLink = document.createElement('a');
    mtlLink.download = 'tower.mtl';
    mtlLink.href = mtlURL;
    mtlLink.click();
}

// Button event listener
document.getElementById('exportButton').addEventListener('click', exportTowerOBJ);