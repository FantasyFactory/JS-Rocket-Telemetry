/**
 * dataProcessor.js (Modificato)
 * Elabora i dati telemetrici e implementa vari algoritmi di fusione dei sensori
 * con supporto per timestamp variabili
 */

const DataProcessor = (function() {
    // Variabili private
    let filterType = 'complementary'; // 'complementary', 'kalman', 'madgwick', 'fullmadgwick'
    let filterEnabled = true;
    let useQuaternion = false; // Se true, usa i quaternioni dal razzo invece di calcolare l'orientamento
    
    // Istanza dell'algoritmo di Madgwick
    let madgwickFilter = new MadgwickAHRS(100, 0.1); // sampleFreq, beta
    
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
        if (['complementary', 'kalman', 'madgwick', 'fullmadgwick'].includes(type)) {
            filterType = type;
            
            // Aggiorna i parametri specifici del filtro selezionato
            if (type === 'madgwick' || type === 'fullmadgwick') {
                // Assicura che madgwickFilter abbia beta configurato correttamente
                madgwickFilter.setBeta(filterConfig.madgwick.beta);
            }
            
            // Reset del filtro
            madgwickFilter.reset();
            
            // Emetti un evento di cambio filtro
            const event = new CustomEvent('filterTypeChanged', {
                detail: { type: filterType }
            });
            window.dispatchEvent(event);
            
            // Se abbiamo un dataset completo, ricalcola l'orientamento
            if (DataReader && DataReader.telemetryDataset) {
                DataReader.recalculateOrientation(filterType, useQuaternion);
            }
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

            // Aggiorna il parametro beta del filtro Madgwick se necessario
            if ((type === 'madgwick' || type === 'fullmadgwick') && 'beta' in config) {
                madgwickFilter.setBeta(config.beta);
            }
        }
        return this;
    }
    
    // Resetta l'orientamento e altre variabili di stato
    function reset() {
        // Reset del filtro Madgwick
        madgwickFilter.reset();
        
        return this;
    }
    
    // Ottieni quaternioni calcolati dal filtro di Madgwick
    function getCalculatedQuaternion() {
        return madgwickFilter.getQuaternion();
    }
    
    // Imposta l'uso dei quaternioni
    function setUseQuaternion(enabled) {
        useQuaternion = enabled;
        
        // Se abbiamo un dataset completo, ricalcola l'orientamento
        if (DataReader && DataReader.telemetryDataset) {
            DataReader.recalculateOrientation(filterType, useQuaternion);
        }
        
        return this;
    }
    
    /**
     * Processa i dati telemetrici per calcolare l'orientamento
     * @param {Object} data - Dati telemetrici in formato standard
     * @returns {Object} - Dati con orientamento calcolato
     */
    function processData(data) {
        if (!data) {
            console.error('processData: dati mancanti');
            return { 
                sensors: { accel: {x: 0, y: 0, z: 0}, gyro: {x: 0, y: 0, z: 0} },
                orientation: { x: 0, y: 0, z: 0 } 
            };
        }
        
        console.log('DataProcessor.processData ricevuto:', JSON.stringify(data));
        
        // Verifica che i sensori siano presenti
        if (!data.sensors) {
            console.error('processData: dati sensori mancanti');
            data.sensors = { accel: { x: 0, y: 0, z: 0 }, gyro: { x: 0, y: 0, z: 0 } };
        }
        
        // Verifica che accel e gyro siano presenti
        if (!data.sensors.accel) {
            console.error('processData: dati accelerometro mancanti');
            data.sensors.accel = { x: 0, y: 0, z: 0 };
        }
        
        if (!data.sensors.gyro) {
            console.error('processData: dati giroscopio mancanti');
            data.sensors.gyro = { x: 0, y: 0, z: 0 };
        }
        
        const accel = data.sensors.accel;
        const gyro = data.sensors.gyro;
        
        // Verifica che i valori non siano tutti zero
        if (accel.x === 0 && accel.y === 0 && accel.z === 0) {
            console.warn('processData: tutti i valori accelerometro sono zero');
        }
        
        if (gyro.x === 0 && gyro.y === 0 && gyro.z === 0) {
            console.warn('processData: tutti i valori giroscopio sono zero');
        }
        
        // Ottieni il deltaTime in secondi
        const deltaTime = data.deltaTime || 0.01; // Default a 10ms se non disponibile
        
        // Crea l'oggetto risultato mantenendo i dati originali
        const result = {
            ...data,
            orientation: { x: 0, y: 0, z: 0 }
        };
        
        // Se sono disponibili i quaternioni e l'opzione è abilitata, usali direttamente
        if (useQuaternion && data.quaternion && data.quaternion.qW !== undefined) {
            // Converti quaternioni in angoli di Eulero (roll, pitch, yaw)
            const angles = quaternionToEuler(data.quaternion);
            result.orientation = {
                x: angles.roll,
                y: angles.pitch,
                z: angles.yaw
            };
            
            console.log('Orientamento calcolato da quaternioni:', result.orientation);
        } 
        // Altrimenti, se il filtro è disabilitato, esegui una stima semplice
        else if (!filterEnabled) {
            // Stima grossolana dell'orientamento dall'accelerometro
            result.orientation = {
                x: Math.atan2(accel.y, accel.z) * (180 / Math.PI), // Roll
                y: Math.atan2(-accel.x, Math.sqrt(accel.y * accel.y + accel.z * accel.z)) * (180 / Math.PI), // Pitch
                z: 0 // Yaw non può essere stimato solo dall'accelerometro
            };
            
            console.log('Orientamento calcolato con stima semplice:', result.orientation);
        } 
        // Altrimenti, applica il filtro selezionato
        else {
            switch (filterType) {
                case 'complementary':
                    applyComplementaryFilter(result, deltaTime);
                    console.log('Orientamento calcolato con filtro complementare:', result.orientation);
                    break;
                case 'kalman':
                    applyKalmanFilter(result, deltaTime);
                    console.log('Orientamento calcolato con filtro Kalman:', result.orientation);
                    break;
                case 'madgwick':
                case 'fullmadgwick':
                    // Resetta madgwick se è il primo punto
                    if (data.firstPoint) {
                        madgwickFilter.reset();
                    }
                    
                    // Aggiorna il filtro Madgwick con i dati dell'IMU
                    madgwickFilter.updateIMU(
                        gyro.x, gyro.y, gyro.z,   // Velocità angolari in gradi/s
                        accel.x, accel.y, accel.z, // Accelerazioni in g
                        deltaTime                  // deltaTime in secondi
                    );
                    
                    // Ottieni gli angoli di Eulero dal filtro
                    const angles = madgwickFilter.getEulerAngles();
                    
                    // Aggiorna l'orientamento
                    result.orientation = {
                        x: angles.roll,   // Roll
                        y: angles.pitch,  // Pitch
                        z: angles.yaw     // Yaw
                    };
                    
                    // Salva i quaternioni calcolati
                    result.calculatedQuaternion = madgwickFilter.getQuaternion();
                    
                    console.log('Orientamento calcolato con filtro Madgwick:', result.orientation);
                    break;
                default:
                    console.warn('Tipo di filtro non supportato:', filterType);
                    // Fallback su stima semplice
                    result.orientation = {
                        x: Math.atan2(accel.y, accel.z) * (180 / Math.PI),
                        y: Math.atan2(-accel.x, Math.sqrt(accel.y * accel.y + accel.z * accel.z)) * (180 / Math.PI),
                        z: 0
                    };
                    
                    console.log('Orientamento calcolato con stima semplice (fallback):', result.orientation);
            }
        }
        
        // Normalizza gli angoli
        result.orientation.x = normalizeAngle(result.orientation.x);
        result.orientation.y = normalizeAngle(result.orientation.y);
        result.orientation.z = normalizeAngle(result.orientation.z);
        
        return result;
    }
    
    // Applica il filtro complementare
    function applyComplementaryFilter(data, deltaTime) {
        if (deltaTime <= 0) return;
        
        const accel = data.sensors.accel;
        const gyro = data.sensors.gyro;
        
        // Calcola angoli dall'accelerometro
        const accelRoll = Math.atan2(accel.y, accel.z) * (180 / Math.PI);
        const accelPitch = Math.atan2(-accel.x, Math.sqrt(accel.y * accel.y + accel.z * accel.z)) * (180 / Math.PI);
        
        // Se è il primo punto o non ci sono dati precedenti, inizializza con i valori dell'accelerometro
        if (!data.previousOrientation) {
            data.orientation = {
                x: accelRoll,
                y: accelPitch,
                z: 0  // Yaw non può essere determinato solo dall'accelerometro
            };
            return;
        }
        
        // Recupera l'orientamento precedente
        const prevRoll = data.previousOrientation.x || 0;
        const prevPitch = data.previousOrientation.y || 0;
        const prevYaw = data.previousOrientation.z || 0;
        
        // Applica il filtro complementare
        const alpha = filterConfig.complementary.alpha;
        data.orientation = {
            x: alpha * (prevRoll + gyro.x * deltaTime) + (1 - alpha) * accelRoll,
            y: alpha * (prevPitch + gyro.y * deltaTime) + (1 - alpha) * accelPitch,
            z: prevYaw + gyro.z * deltaTime  // Integriamo solo il giroscopio per lo yaw
        };
    }
    
    // Implementazione semplificata del filtro di Kalman
    function applyKalmanFilter(data, deltaTime) {
        if (deltaTime <= 0) return;
        
        const accel = data.sensors.accel;
        const gyro = data.sensors.gyro;
        
        // Calcola angoli dall'accelerometro
        const accelRoll = Math.atan2(accel.y, accel.z) * (180 / Math.PI);
        const accelPitch = Math.atan2(-accel.x, Math.sqrt(accel.y * accel.y + accel.z * accel.z)) * (180 / Math.PI);
        
        // Se è il primo punto o non ci sono dati precedenti, inizializza con i valori dell'accelerometro
        if (!data.previousOrientation) {
            data.orientation = {
                x: accelRoll,
                y: accelPitch,
                z: 0  // Yaw non può essere determinato solo dall'accelerometro
            };
            return;
        }
        
        // Recupera l'orientamento precedente
        const prevRoll = data.previousOrientation.x || 0;
        const prevPitch = data.previousOrientation.y || 0;
        const prevYaw = data.previousOrientation.z || 0;
        
        // Predizione: integrazione del giroscopio
        const predictedRoll = prevRoll + gyro.x * deltaTime;
        const predictedPitch = prevPitch + gyro.y * deltaTime;
        const predictedYaw = prevYaw + gyro.z * deltaTime;
        
        // Parametri del filtro di Kalman
        const processNoise = filterConfig.kalman.processNoise;
        const measurementNoise = filterConfig.kalman.measurementNoiseAccel;
        
        // Guadagno di Kalman (semplificato)
        const K = processNoise / (processNoise + measurementNoise);
        
        // Correzione
        data.orientation = {
            x: predictedRoll + K * (accelRoll - predictedRoll),
            y: predictedPitch + K * (accelPitch - predictedPitch),
            z: predictedYaw  // Per yaw, utilizziamo solo la predizione
        };
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
    
    // Converte angoli di Eulero in quaternioni
    function eulerToQuaternion(roll, pitch, yaw) {
        const cr = Math.cos(roll * 0.5);
        const sr = Math.sin(roll * 0.5);
        const cp = Math.cos(pitch * 0.5);
        const sp = Math.sin(pitch * 0.5);
        const cy = Math.cos(yaw * 0.5);
        const sy = Math.sin(yaw * 0.5);
        
        const qW = cr * cp * cy + sr * sp * sy;
        const qX = sr * cp * cy - cr * sp * sy;
        const qY = cr * sp * cy + sr * cp * sy;
        const qZ = cr * cp * sy - sr * sp * cy;
        
        return { qW, qX, qY, qZ };
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
        get filterType() { return filterType; },
        get filterEnabled() { return filterEnabled; },
        get useQuaternion() { return useQuaternion; }
    };
})();