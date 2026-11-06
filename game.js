// Configuração Principal
let scene, camera, renderer;
let player, playerMesh;
let mapObjects = [];
let mushrooms = [];
let bullets = [];
let bots = [];

let hp = 200;
let ep = 0;
let currentWeapon = 'knife';
let moveVector = new THREE.Vector3();
let moveInput = { x: 0, y: 0 };

const weaponStats = {
    knife: { damage: 50, range: 3, speed: 0.15, ammo: Infinity, rate: 400 },
    pistol: { damage: 25, range: 40, speed: 0.12, ammo: 12, rate: 300 },
    mp40: { damage: 15, range: 30, speed: 0.11, ammo: 40, rate: 100 },
    ak47: { damage: 35, range: 50, speed: 0.10, ammo: 30, rate: 150 },
    awm: { damage: 150, range: 100, speed: 0.08, ammo: 5, rate: 1200 },
    bazooka: { damage: 100, range: 60, speed: 0.07, ammo: 3, rate: 1500, splash: true }
};

let lastShotTime = 0;

function init() {
    // Canvas & Renderizador 3D
    const container = document.getElementById('game-container');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdce6f2);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Iluminação PBR Leve
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(40, 60, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    // Jogador (Modelo Low-Poly)
    const playerGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.8, 8);
    const playerMat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    playerMesh = new THREE.Mesh(playerGeo, playerMat);
    playerMesh.position.set(0, 0.9, 0);
    playerMesh.castShadow = true;
    scene.add(playerMesh);

    player = playerMesh;

    // Inicialização do Mapa
    loadMap(0);
    spawnBots();
    setupTouchControls();

    window.addEventListener('resize', onWindowResize);
    animate();
}

// Criador de Mapas
function loadMap(mapIndex) {
    // Limpeza de mapa anterior
    mapObjects.forEach(obj => scene.remove(obj));
    mushrooms.forEach(m => scene.remove(m));
    mapObjects = [];
    mushrooms = [];

    let groundColor = 0x555555;
    if (mapIndex === 1) groundColor = 0xd2b48c; // Deserto
    if (mapIndex === 2) groundColor = 0x333333; // Industrial

    // Chão
    const groundGeo = new THREE.PlaneGeometry(100, 100);
    const groundMat = new THREE.MeshStandardMaterial({ color: groundColor, roughness: 0.8 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    mapObjects.push(ground);

    // Obstáculos e Torres (Level Design)
    const boxGeo = new THREE.BoxGeometry(2, 2, 2);
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x884422, roughness: 0.5 });
    
    for (let i = 0; i < 15; i++) {
        const box = new THREE.Mesh(boxGeo, boxMat);
        box.position.set((Math.random() - 0.5) * 60, 1, (Math.random() - 0.5) * 60);
        box.castShadow = true;
        box.receiveShadow = true;
        scene.add(box);
        mapObjects.push(box);
    }

    // Torres de sniper
    const towerGeo = new THREE.BoxGeometry(4, 8, 4);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x666666 });
    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.position.set(15, 4, 15);
    tower.castShadow = true;
    scene.add(tower);
    mapObjects.push(tower);

    // Cogumelos (EP)
    const shroomGeo = new THREE.ConeGeometry(0.4, 0.6, 6);
    const shroomMat = new THREE.MeshStandardMaterial({ color: 0xffff00 });
    for (let i = 0; i < 8; i++) {
        const shroom = new THREE.Mesh(shroomGeo, shroomMat);
        shroom.position.set((Math.random() - 0.5) * 70, 0.3, (Math.random() - 0.5) * 70);
        scene.add(shroom);
        mushrooms.push(shroom);
    }
}

function switchMap(index) {
    loadMap(index);
}

// Sistema de Bots
function spawnBots() {
    bots.forEach(b => scene.remove(b.mesh));
    bots = [];
    const botGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.8, 8);
    const botMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });

    for (let i = 0; i < 3; i++) {
        const mesh = new THREE.Mesh(botGeo, botMat);
        mesh.position.set((Math.random() - 0.5) * 40, 0.9, (Math.random() - 0.5) * 40);
        mesh.castShadow = true;
        scene.add(mesh);
        bots.push({ mesh: mesh, hp: 100 });
    }
}

// Sistema de Armas e Disparo
function selectWeapon(w) {
    currentWeapon = w;
    document.getElementById('ammo-count').innerText = weaponStats[w].ammo === Infinity ? '∞' : weaponStats[w].ammo;
}

function shoot() {
    const now = Date.now();
    const stats = weaponStats[currentWeapon];
    if (now - lastShotTime < stats.rate) return;
    lastShotTime = now;

    // Recuo da câmera (AK47/AWM)
    if (currentWeapon === 'ak47' || currentWeapon === 'awm') {
        camera.position.y += 0.2;
        setTimeout(() => camera.position.y -= 0.2, 50);
    }

    if (currentWeapon === 'knife') {
        // Ataque corpo a corpo
        bots.forEach(bot => {
            if (player.position.distanceTo(bot.mesh.position) < stats.range) {
                damageBot(bot, stats.damage);
            }
        });
        return;
    }

    // Projetil / Tracer
    const bulletGeo = stats.splash ? new THREE.SphereGeometry(0.3) : new THREE.SphereGeometry(0.1);
    const bulletMat = new THREE.MeshBasicMaterial({ color: stats.splash ? 0xff4400 : 0xffff00 });
    const bullet = new THREE.Mesh(bulletGeo, bulletMat);

    bullet.position.copy(player.position);
    bullet.position.y += 0.5;

    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);
    bullet.userData = { dir: dir, speed: 0.8, range: stats.range, dist: 0, splash: stats.splash, damage: stats.damage };
    
    bullets.push(bullet);
    scene.add(bullet);
}

function damageBot(bot, amount) {
    bot.hp -= amount;
    if (bot.hp <= 0) {
        scene.remove(bot.mesh);
        bots = bots.filter(b => b !== bot);
        showKillFeed("Você eliminou um Bot!");
        setTimeout(spawnBots, 5000);
    }
}

function showKillFeed(msg) {
    const feed = document.getElementById('kill-feed');
    feed.innerText = msg;
    setTimeout(() => feed.innerText = '', 3000);
}

// Controles Mobile
function setupTouchControls() {
    const touchLeft = document.getElementById('touch-left');
    const stick = document.querySelector('.stick');
    let touchId = null;
    let startX = 0, startY = 0;

    touchLeft.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        touchId = touch.identifier;
        startX = touch.clientX;
        startY = touch.clientY;
    });

    touchLeft.addEventListener('touchmove', (e) => {
        for (let t of e.changedTouches) {
            if (t.identifier === touchId) {
                const dx = t.clientX - startX;
                const dy = t.clientY - startY;
                const dist = Math.min(Math.hypot(dx, dy), 40);
                const angle = Math.atan2(dy, dx);

                stick.style.transform = `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px)`;
                moveInput.x = (Math.cos(angle) * dist) / 40;
                moveInput.y = (Math.sin(angle) * dist) / 40;
            }
        }
    });

    const resetJoystick = () => {
        stick.style.transform = 'translate(0px, 0px)';
        moveInput.x = 0;
        moveInput.y = 0;
    };

    touchLeft.addEventListener('touchend', resetJoystick);
    touchLeft.addEventListener('touchcancel', resetJoystick);

    document.getElementById('btn-shoot').addEventListener('touchstart', (e) => {
        e.preventDefault();
        shoot();
    });
}

// Loop Principal de Atualização
function animate() {
    requestAnimationFrame(animate);

    // Movimentação do Jogador
    const speed = weaponStats[currentWeapon].speed;
    if (moveInput.x !== 0 || moveInput.y !== 0) {
        player.position.x += moveInput.x * speed;
        player.position.z += moveInput.y * speed;
        player.rotation.y = Math.atan2(-moveInput.x, -moveInput.y);
    }

    // Câmera 3D em Terceira Pessoa
    camera.position.x = player.position.x;
    camera.position.z = player.position.z + 10;
    camera.position.y = player.position.y + 8;
    camera.lookAt(player.position);

    // Regeneração de EP/HP (Cogumelos)
    mushrooms.forEach((m, index) => {
        if (player.position.distanceTo(m.position) < 1.2) {
            scene.remove(m);
            mushrooms.splice(index, 1);
            ep = Math.min(100, ep + 50);
        }
    });

    if (ep > 0 && hp < 200) {
        ep -= 0.1;
        hp = Math.min(200, hp + 0.2);
    }

    document.getElementById('hp-fill').style.width = (hp / 2) + '%';
    document.getElementById('ep-fill').style.width = ep + '%';

    // Física de Projéteis
    bullets.forEach((b, index) => {
        b.position.addScaledVector(b.userData.dir, b.userData.speed);
        b.userData.dist += b.userData.speed;

        // Colisão com Bots
        bots.forEach(bot => {
            if (b.position.distanceTo(bot.mesh.position) < 1.0) {
                damageBot(bot, b.userData.damage);
                scene.remove(b);
                bullets.splice(index, 1);
            }
        });

        if (b.userData.dist >= b.userData.range) {
            scene.remove(b);
            bullets.splice(index, 1);
        }
    });

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.onload = init;
