/**
 * dataProcessor.js
 * Elabora i dati telemetrici e implementa vari algoritmi di fusione dei sensori
 */

const DataProcessor = (function() {
    // Variabili private
    let orientation = { x: 0, y: 0, z: 0 }; // roll, pitch, yaw in gradi
    let velocity = { x: 0, y: 0, z: 0 };
    let position = { x: 0, y: 0, z: 0 };
    let lastTimestamp = 0;
    let filterType = 'complementary'; // 'complementary', 'kalman', 'madgwick'
    let filterEnabled = true;
    let useQuaternion = false; // Se true, usa i quaternioni dal razzo invece di calcolare l'orientamento
    
    // Configurazione dei filtri
    const filterConfig = {
        complementary: {
            alpha: 0.98
        },
        kalman: {
            processNoise: 0.01,
            measurementNoiseAccel: 0.1,
            measurementNoiseGyro: 0.01
        },
        madgwick: {
            beta: 0.1
        }
    };
    
    // Imposta il tipo di filtro
    function setFilterType(type) {
        if (['complementary', 'kalman', 'madgwick'].includes(type)) {
            filterType = type;
        } else {
            console.error('Tipo di filtro non valido:', type);
        }
        return this;
    }
    
    // Abilita o disabilita il filtro
    function enableFilter(enabled) {
        filterEnabled = enabled;
        return this;
    }
    
    // Configura i parametri del filtro
    function configureFilter(type, config) {
        if (filterConfig[type]) {
            Object.assign(filterConfig[type], config);
        }
        return this;
    }
    
    // Resetta l'orientamento e altre variabili di stato
    function reset() {
        orientation = { x: 0, y: 0, z: 0 };
        velocity = { x: 0, y: 0, z: 0 };
        position = { x: 0, y: 0, z: 0 };
        lastTimestamp = 0;
        return this;
    }
    
    // Imposta l'uso dei quaternioni
    function setUseQuaternion(enabled) {
        useQuaternion = enabled;
        return this;
    }
    
    // Processa i dati telemetrici
    function processData(data) {
        const timestamp = data.system.millis;
        const accel = data.sensors.accel;
        const gyro = data.sensors.gyro;
        
        // Calcola il delta tempo in secondi
        let deltaTime = 0;
        if (lastTimestamp !== 0) {
            deltaTime = (timestamp - lastTimestamp) / 1000; // In secondi
        }
        lastTimestamp = timestamp;
        
        // Se sono disponibili i quaternioni e l'opzione è abilitata, usali direttamente
        if (useQuaternion && data.quaternion) {
            // Converti quaternioni in angoli di Eulero (roll, pitch, yaw)
            const angles = quaternionToEuler(data.quaternion);
            orientation.x = angles.roll;
            orientation.y = angles.pitch;
            orientation.z = angles.yaw;
        }
        // Altrimenti, usa i filtri standard
        else if (!filterEnabled) {
            // In questo caso, possiamo fare una stima grossolana dell'orientamento dall'accelerometro
            orientation.x = Math.atan2(accel.y, accel.z) * (180 / Math.PI); // Roll
            orientation.y = Math.atan2(-accel.x, Math.sqrt(accel.y * accel.y + accel.z * accel.z)) * (180 / Math.PI); // Pitch
            // Yaw non può essere stimato solo dall'accelerometro
            orientation.z += gyro.z * deltaTime; // Integriamo il giroscopio per lo yaw
        } else {
            // Altrimenti, applica il filtro selezionato
            switch (filterType) {
                case 'complementary':
                    applyComplementaryFilter(accel, gyro, deltaTime);
                    break;
                case 'kalman':
                    applyKalmanFilter(accel, gyro, deltaTime);
                    break;
                case 'madgwick':
                    applyMadgwickFilter(accel, gyro, deltaTime);
                    break;
            }
        }
        
        // Normalizza gli angoli
        orientation.x = normalizeAngle(orientation.x);
        orientation.y = normalizeAngle(orientation.y);
        orientation.z = normalizeAngle(orientation.z);
        
        // Restituisci i dati elaborati
        return {
            orientation,
            acceleration: accel,
            gyro,
            timestamp
        };
    }
    
    // Applica il filtro complementare
    function applyComplementaryFilter(accel, gyro, deltaTime) {
        if (deltaTime <= 0) return;
        
        // Limita deltaTime per evitare salti enormi
        const limitedDt = Math.min(deltaTime, 0.1);
        
        // Calcola angoli dall'accelerometro
        const accelRoll = Math.atan2(accel.y, accel.z) * (180 / Math.PI);
        const accelPitch = Math.atan2(-accel.x, Math.sqrt(accel.y * accel.y + accel.z * accel.z)) * (180 / Math.PI);
        
        // Applica il filtro complementare
        const alpha = filterConfig.complementary.alpha;
        orientation.x = alpha * (orientation.x + gyro.x * limitedDt) + (1 - alpha) * accelRoll;
        orientation.y = alpha * (orientation.y + gyro.y * limitedDt) + (1 - alpha) * accelPitch;
        orientation.z += gyro.z * limitedDt; // Integriamo solo il giroscopio per lo yaw
    }
    
    // Implementazione semplificata del filtro di Kalman
    function applyKalmanFilter(accel, gyro, deltaTime) {
        if (deltaTime <= 0) return;
        
        // Limita deltaTime per evitare salti enormi
        const limitedDt = Math.min(deltaTime, 0.1);
        
        // Per semplicità, utilizziamo un'implementazione molto semplificata del filtro di Kalman
        // In una implementazione reale, utilizzeremmo matrici e calcoli più complessi
        
        // Calcola angoli dall'accelerometro
        const accelRoll = Math.atan2(accel.y, accel.z) * (180 / Math.PI);
        const accelPitch = Math.atan2(-accel.x, Math.sqrt(accel.y * accel.y + accel.z * accel.z)) * (180 / Math.PI);
        
        // Predizione: integrazione del giroscopio
        const predictedRoll = orientation.x + gyro.x * limitedDt;
        const predictedPitch = orientation.y + gyro.y * limitedDt;
        const predictedYaw = orientation.z + gyro.z * limitedDt;
        
        // Guadagno di Kalman (semplificato)
        const K = filterConfig.kalman.processNoise / (filterConfig.kalman.processNoise + filterConfig.kalman.measurementNoiseAccel);
        
        // Correzione
        orientation.x = predictedRoll + K * (accelRoll - predictedRoll);
        orientation.y = predictedPitch + K * (accelPitch - predictedPitch);
        orientation.z = predictedYaw; // Per yaw, utilizziamo solo la predizione
    }
    
    // Implementazione semplificata del filtro di Madgwick
    function applyMadgwickFilter(accel, gyro, deltaTime) {
        if (deltaTime <= 0) return;
        
        // Limita deltaTime per evitare salti enormi
        const limitedDt = Math.min(deltaTime, 0.1);
        
        // Per semplicità, qui implementiamo una versione molto semplificata del filtro di Madgwick
        // In una implementazione reale, utilizzeremmo quaternioni e calcoli più complessi
        
        // Calcola angoli dall'accelerometro
        const accelRoll = Math.atan2(accel.y, accel.z) * (180 / Math.PI);
        const accelPitch = Math.atan2(-accel.x, Math.sqrt(accel.y * accel.y + accel.z * accel.z)) * (180 / Math.PI);
        
        // Integrazione del giroscopio
        const gyroRoll = orientation.x + gyro.x * limitedDt;
        const gyroPitch = orientation.y + gyro.y * limitedDt;
        const gyroYaw = orientation.z + gyro.z * limitedDt;
        
        // Peso di fusione (più complesso nel vero filtro di Madgwick)
        const beta = filterConfig.madgwick.beta;
        
        // Fusione delle stime
        orientation.x = gyroRoll - beta * (gyroRoll - accelRoll);
        orientation.y = gyroPitch - beta * (gyroPitch - accelPitch);
        orientation.z = gyroYaw; // Per yaw, utilizziamo solo il giroscopio
    }
    
    // Normalizza un angolo nell'intervallo [-180, 180]
    function normalizeAngle(angle) {
        while (angle > 180) angle -= 360;
        while (angle < -180) angle += 360;
        return angle;
    }
    
    // Converte radianti in gradi
    function radToDeg(rad) {
        return rad * (180 / Math.PI);
    }
    
    // Converte gradi in radianti
    function degToRad(deg) {
        return deg * (Math.PI / 180);
    }
    
    // Converte quaternioni in angoli di Eulero (roll, pitch, yaw)
    function quaternionToEuler(quat) {
        // Estrai i componenti del quaternione
        const qW = quat.qW;
        const qX = quat.qX;
        const qY = quat.qY;
        const qZ = quat.qZ;
        
        // Calcola gli angoli di Eulero
        // Roll (x-axis rotation)
        const sinr_cosp = 2 * (qW * qX + qY * qZ);
        const cosr_cosp = 1 - 2 * (qX * qX + qY * qY);
        const roll = Math.atan2(sinr_cosp, cosr_cosp) * (180 / Math.PI);
        
        // Pitch (y-axis rotation)
        const sinp = 2 * (qW * qY - qZ * qX);
        let pitch;
        if (Math.abs(sinp) >= 1) {
            // Usa 90 gradi se fuori range (gimbal lock)
            pitch = Math.sign(sinp) * 90;
        } else {
            pitch = Math.asin(sinp) * (180 / Math.PI);
        }
        
        // Yaw (z-axis rotation)
        const siny_cosp = 2 * (qW * qZ + qX * qY);
        const cosy_cosp = 1 - 2 * (qY * qY + qZ * qZ);
        const yaw = Math.atan2(siny_cosp, cosy_cosp) * (180 / Math.PI);
        
        return { roll, pitch, yaw };
    }
    
    // Restituisci l'interfaccia pubblica
    return {
        setFilterType,
        enableFilter,
        configureFilter,
        setUseQuaternion,
        reset,
        processData,
        
        // Getter di sola lettura
        get orientation() { return { ...orientation }; },
        get velocity() { return { ...velocity }; },
        get position() { return { ...position }; },
        get filterType() { return filterType; },
        get filterEnabled() { return filterEnabled; },
        get useQuaternion() { return useQuaternion; }
    };
})();