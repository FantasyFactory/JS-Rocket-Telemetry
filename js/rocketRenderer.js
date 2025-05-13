/**
 * rocketRenderer.js
 * Gestisce la visualizzazione 3D del razzo usando Three.js
 */

// Namespace del modulo
const RocketRenderer = (function() {
    // Variabili private
    let scene, camera, renderer, controls;
    let rocketModel, indicatorsGroup;
    let accelArrows = [];
    let gyroArcs = [];
    let container;
    let isInitialized = false;

    // Configurazione
    const config = {
        rocketLength: 5,      // Lunghezza del razzo
        rocketRadius: 0.3,    // Raggio del razzo
        arrowLength: 1,       // Lunghezza base delle frecce
        arcRadius: 3.5,       // Raggio degli archi per il giroscopio
        accelScale: 0.2,      // Scala per le frecce dell'accelerazione
        gyroScale: 0.01,      // Scala per gli archi del giroscopio
        minArcScale: 0.01     // Valore minimo per mantenere gli archi visibili
    };

    // Funzione di inizializzazione
    function init(containerId) {
        if (isInitialized) return;
        
        container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container #${containerId} non trovato`);
            return;
        }

        // Crea scena
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000);

        // Crea camera
        const width = container.clientWidth;
        const height = container.clientHeight;
        camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.set(0, 5, 10);
        camera.lookAt(0, 0, 0);

        // Crea renderer
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        container.innerHTML = '';
        container.appendChild(renderer.domElement);

        // Aggiungi controlli orbitali
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.25;

        // Crea il modello del razzo
        createRocketModel();
        
        // Crea indicatori (frecce e archi)
        createIndicators();
        
        // Aggiungi luci
        addLights();
        
        // Aggiungi elementi di riferimento
        addReferenceElements();

        // Gestisci ridimensionamento
        window.addEventListener('resize', onWindowResize);
        
        // Flag di inizializzazione
        isInitialized = true;
        
        // Avvia il loop di animazione
        animate();
        
        return {
            scene,
            camera,
            renderer
        };
    }

    // Crea il modello 3D del razzo
    function createRocketModel() {
        const LZ = config.rocketLength;
        const radius = config.rocketRadius;
        
        // Gruppo principale del razzo
        rocketModel = new THREE.Group();
        
        // Corpo principale del razzo (cilindro)
        const bodyGeometry = new THREE.CylinderGeometry(radius, radius, LZ, 32);
        const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
        const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
        rocketModel.add(bodyMesh);
        
        // Punta del razzo (cono)
        const noseGeometry = new THREE.ConeGeometry(radius, 1, 32);
        const noseMaterial = new THREE.MeshPhongMaterial({ color: 0xdddddd });
        const noseMesh = new THREE.Mesh(noseGeometry, noseMaterial);
        noseMesh.position.y = LZ / 2 + 0.5;
        rocketModel.add(noseMesh);
        
        // Ali del razzo
        createRocketFins();
        
        // Aggiungi testo "Golden Slumbers"
        addRocketText();
        
        // Aggiungi il modello alla scena
        scene.add(rocketModel);
    }
    
    // Crea le alette del razzo
    function createRocketFins() {
        const LZ = config.rocketLength;
        const radius = config.rocketRadius;
        
        // Forma delle ali
        const wingShape = new THREE.Shape();
        wingShape.moveTo(0, 0);
        wingShape.lineTo(0.3, -1.5);
        wingShape.lineTo(0, -1);
        wingShape.lineTo(0, 0);
        
        const wingExtrudeSettings = {
            steps: 1,
            depth: 0.1,
            bevelEnabled: false
        };
        
        const wingGeometry = new THREE.ExtrudeGeometry(wingShape, wingExtrudeSettings);
        const wingMaterial = new THREE.MeshPhongMaterial({ color: 0xcccccc });
        
        // Crea 3 ali equidistanti
        for (let i = 0; i < 3; i++) {
            const wing = new THREE.Mesh(wingGeometry, wingMaterial);
            wing.position.y = -(LZ / 2) + 1;
            wing.position.x = radius * Math.cos((i * Math.PI * 2) / 3);
            wing.position.z = radius * Math.sin((i * Math.PI * 2) / 3);
            wing.rotation.y = -((i * Math.PI * 2) / 3);
            rocketModel.add(wing);
        }
    }
    
    // Aggiunge testo al razzo
    function addRocketText() {
        // Carica il font e crea il testo
        const loader = new THREE.FontLoader();
        
        // Utilizza un callback per gestire il caricamento asincrono del font
        loader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', function(font) {
            const textGeometry = new THREE.TextGeometry('Golden Slumbers', {
                font: font,
                size: 0.2,
                height: 0.05,
            });
            
            const textMaterial = new THREE.MeshPhongMaterial({ color: 0xffa500 });
            const textMesh = new THREE.Mesh(textGeometry, textMaterial);
            
            // Centra il testo
            textGeometry.computeBoundingBox();
            const textWidth = textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x;
            const textHeight = textGeometry.boundingBox.max.y - textGeometry.boundingBox.min.y;
            textMesh.position.set(textHeight/2, -textWidth/2, config.rocketRadius - 0.05);
            textMesh.rotation.z = Math.PI / 2;
            rocketModel.add(textMesh);
        });
    }
    
    // Crea gli indicatori (frecce per accelerazione e archi per rotazione)
    function createIndicators() {
        // Gruppo per contenere tutti gli indicatori
        indicatorsGroup = new THREE.Group();
        rocketModel.add(indicatorsGroup);
        
        // Frecce per l'accelerometro
        const arrowColors = [0xff0000, 0x00ff00, 0x0000ff]; // RGB per XYZ
        for (let i = 0; i < 3; i++) {
            const direction = new THREE.Vector3(0, 0, 0);
            if (i === 0) direction.x = 1;
            if (i === 1) direction.y = 1;
            if (i === 2) direction.z = 1;
            
            const arrow = new THREE.ArrowHelper(
                direction,
                new THREE.Vector3(0, 0, 0),
                config.arrowLength,
                arrowColors[i],
                0.2,
                0.1
            );
            
            indicatorsGroup.add(arrow);
            accelArrows.push(arrow);
        }
        
        // Archi per il giroscopio
        const arcColors = [0xff00ff, 0xffff00, 0x00ffff]; // Magenta, Giallo, Ciano per XYZ
        for (let i = 0; i < 3; i++) {
            // Crea una curva ad arco
            const curve = new THREE.EllipseCurve(
                0, 0,                   // Centro x, y
                config.arcRadius, config.arcRadius, // Radio x, y
                0, Math.PI / 2,         // Angolo iniziale, angolo finale
                false,                  // Senso antiorario
                0                       // Rotazione
            );
            
            const points = curve.getPoints(50);
            const arcGeometry = new THREE.BufferGeometry().setFromPoints(points);
            const arcMaterial = new THREE.LineBasicMaterial({ 
                color: arcColors[i], 
                linewidth: 10
            });
            
            const arc = new THREE.Line(arcGeometry, arcMaterial);
            
            indicatorsGroup.add(arc);
            gyroArcs.push(arc);
        }
        
        // Orienta gli archi per i tre assi
        gyroArcs[0].rotation.y = Math.PI / 2; // Arco X
        // Arco Y è già nell'orientamento corretto
        gyroArcs[2].rotation.x = Math.PI / 2; // Arco Z
    }
    
    // Aggiunge luci alla scena
    function addLights() {
        // Luce principale
        const mainLight = new THREE.PointLight(0xffffff, 1, 100);
        mainLight.position.set(10, 10, 10);
        scene.add(mainLight);
        
        // Luce ambientale
        const ambientLight = new THREE.AmbientLight(0x404040);
        scene.add(ambientLight);
    }
    
    // Aggiunge elementi di riferimento (assi, griglia)
    function addReferenceElements() {
        // Assi di riferimento
        const axesHelper = new THREE.AxesHelper(5);
        scene.add(axesHelper);
        
        // Griglia di riferimento
        const gridHelper = new THREE.GridHelper(10, 10);
        scene.add(gridHelper);
    }
    
    // Gestisce il ridimensionamento della finestra
    function onWindowResize() {
        if (!container || !camera || !renderer) return;
        
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        
        renderer.setSize(width, height);
    }
    
    // Loop di animazione
    function animate() {
        requestAnimationFrame(animate);
        
        if (controls) controls.update();
        if (renderer && scene && camera) renderer.render(scene, camera);
    }
    
    // Aggiorna la visualizzazione del razzo con nuovi dati
    function update(orientation, acceleration, gyro) {
        if (!rocketModel || !indicatorsGroup) return;
        
        // Usa direttamente il quaternione se disponibile
        if (orientation.quaternion) {
            const q = orientation.quaternion;
            //rocketModel.quaternion.set(q.qX, q.qY, q.qZ, q.qW);
            rocketModel.quaternion.set(q.qX, q.qZ, q.qY, q.qW);
        } else {
            // Fallback agli angoli di Eulero con ordine corretto
            //rocketModel.rotation.order = 'YXZ'; // Ordine di rotazione
            rocketModel.rotation.order = 'ZYX'; // Prova questo ordine
            rocketModel.rotation.y = THREE.MathUtils.degToRad(-orientation.z); // Yaw
            rocketModel.rotation.x = THREE.MathUtils.degToRad(orientation.x);  // Roll
            rocketModel.rotation.z = THREE.MathUtils.degToRad(orientation.y);  // Pitch

            //rocketModel.rotation.z = THREE.MathUtils.degToRad(orientation.x); // Roll (attorno all'asse longitudinale)
            //rocketModel.rotation.y = THREE.MathUtils.degToRad(orientation.y); // Pitch
            //rocketModel.rotation.x = THREE.MathUtils.degToRad(orientation.z); // Yaw
        }
        
        // Resetta la rotazione del gruppo indicatori
        indicatorsGroup.rotation.set(0, 0, 0);
        
        // Aggiorna le frecce dell'accelerometro
        updateAccelerationArrows(acceleration);
        
        // Aggiorna gli archi del giroscopio
        updateGyroArcs(gyro);
    }
    
    // Aggiorna le frecce di accelerazione
    function updateAccelerationArrows(acceleration) {
        // Converti accelerazione in coordinate del razzo
        const accelVector = new THREE.Vector3(
            acceleration.x,
            acceleration.z,
            -acceleration.y
        );
        
        // Aggiorna direzione e lunghezza delle frecce
        accelArrows[0].setDirection(new THREE.Vector3(1, 0, 0));
        accelArrows[1].setDirection(new THREE.Vector3(0, 1, 0));
        accelArrows[2].setDirection(new THREE.Vector3(0, 0, 1));
        
        // Imposta la lunghezza proporzionale all'accelerazione
        accelArrows[0].setLength(Math.abs(accelVector.x) * config.accelScale);
        accelArrows[1].setLength(Math.abs(accelVector.y) * config.accelScale);
        accelArrows[2].setLength(Math.abs(accelVector.z) * config.accelScale);
    }
    
    // Aggiorna gli archi del giroscopio
    function updateGyroArcs(gyro) {
        // Scala i valori del giroscopio
        const gyroX = Math.abs(gyro.x) * config.gyroScale + config.minArcScale;
        const gyroY = Math.abs(gyro.y) * config.gyroScale + config.minArcScale;
        const gyroZ = Math.abs(gyro.z) * config.gyroScale + config.minArcScale;
        
        // Aggiorna le geometrie degli archi
        updateArcGeometry(gyroArcs[0], gyroX);
        updateArcGeometry(gyroArcs[1], gyroY);
        updateArcGeometry(gyroArcs[2], gyroZ);
    }
    
    // Aggiorna la geometria di un arco con un nuovo angolo
    function updateArcGeometry(arc, angle) {
        // Crea una nuova curva ellittica con l'angolo finale specificato
        const curve = new THREE.EllipseCurve(
            0, 0,                       // Centro x, y
            config.arcRadius, config.arcRadius, // Raggio x, y
            0, Math.min(angle * Math.PI, Math.PI * 2), // Angoli (limita a un giro completo)
            false,                      // Senso antiorario
            0                           // Rotazione
        );
        
        // Aggiorna i punti della geometria
        const points = curve.getPoints(50);
        arc.geometry.setFromPoints(points);
    }
    
    // Metodi pubblici
    return {
        init,
        update,
        
        // Metodo per esporre alcuni controlli esterni
        getControls: function() {
            return controls;
        },
        
        // Metodo per resettare la vista
        resetView: function() {
            if (camera) {
                camera.position.set(0, 5, 10);
                camera.lookAt(0, 0, 0);
                if (controls) controls.reset();
            }
        }
    };
})();

