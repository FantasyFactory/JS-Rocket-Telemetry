/**
 * TelemetryDataset.js
 * Gestisce l'intero dataset di telemetria, mantenendo tutti i dati in memoria
 * e supportando sia dati in tempo reale che caricati da file.
 */

class TelemetryDataset {
    constructor() {
        this.data = [];        // Array contenente tutti i punti dati
        this.currentIndex = 0; // Indice attuale per visualizzazione
        this.isRealtime = false; // Flag per modalità realtime
        this.metadata = {      // Metadati del dataset
            startTime: null,
            endTime: null,
            samplingRates: { min: null, max: null, avg: null },
            totalPoints: 0,
            hasQuaternions: false
        };
    }
    
    /**
     * Aggiunge un nuovo punto dati al dataset
     * @param {Object} rawData - Dati grezzi da aggiungere
     * @returns {Object} - Punto dati standardizzato e aggiunto
     */
    addDataPoint(rawData) {
        // Converti al formato standard se necessario
        const standardData = this._isStandardFormat(rawData) ? 
            { ...rawData } : // copia profonda per evitare riferimenti
            this._convertToStandardFormat(rawData);
        
        // Controlla se è il primo punto dati
        if (this.data.length === 0) {
            this.metadata.startTime = standardData.timestamp;
            standardData.deltaTime = 0;
        } else {
            // Calcola deltaTime rispetto al punto precedente
            const prevTimestamp = this.data[this.data.length-1].timestamp;
            standardData.deltaTime = (standardData.timestamp - prevTimestamp) / 1000; // in secondi
        }
        
        // Controlla se ci sono quaternioni
        if (standardData.quaternion && !this.metadata.hasQuaternions) {
            this.metadata.hasQuaternions = true;
        }
        
        // Aggiorna i metadati
        this.metadata.endTime = standardData.timestamp;
        this.metadata.totalPoints++;
        
        // Aggiungi il dato all'array principale
        this.data.push(standardData);
        
        // Aggiorna statistiche sui tassi di campionamento
        this._updateSamplingRates();
        
        return standardData;
    }
    
    /**
     * Verifica se i dati sono già nel formato standard
     * @private
     * @param {Object} data - Dati da verificare
     * @returns {boolean} - True se i dati sono già nel formato standard
     */
    _isStandardFormat(data) {
        return data && 
               typeof data.timestamp === 'number' && 
               data.sensors && 
               data.system;
    }
    
    /**
     * Converte dati in formato grezzo nel formato standard
     * @private
     * @param {Object} dataPoint - Dati da convertire
     * @returns {Object} - Dati nel formato standard
     */
    _convertToStandardFormat(dataPoint) {
        // Funzione helper per convertire valori in numeri in modo sicuro
        function safeParseFloat(value, defaultValue = 0) {
            if (value === undefined || value === null) return defaultValue;
            if (typeof value === 'number') return value;
            if (typeof value === 'string') {
                // Se è una stringa, prova a convertirla in numero
                // Sostituisci la virgola con il punto per gestire formati europei
                const parsedValue = parseFloat(value.replace(',', '.'));
                return isNaN(parsedValue) ? defaultValue : parsedValue;
            }
            return defaultValue;
        }
        
        // Creazione dell'oggetto di ritorno con valori di default
        const standardData = {
            timestamp: Date.now(),
            sensors: {
                accel: { x: 0, y: 0, z: 0 },
                gyro: { x: 0, y: 0, z: 0 },
                altitude: 0,
                temperature: 20
            },
            system: {
                battery_voltage: 4.2,
                free_heap: 0,
                free_space: 0,
                total_space: 1,
                wifi_strength: 0,
                millis: Date.now(),
                rocketState: "Unknown"
            },
            simulation: {
                altitude: 0,
                velocity: 0
            },
            orientation: { x: 0, y: 0, z: 0 },
            quaternion: null,
            calculatedQuaternion: null
        };

        // Gestione timestamp/tempo
        if ('timestamp' in dataPoint) {
            standardData.timestamp = safeParseFloat(dataPoint.timestamp);
            standardData.system.millis = safeParseFloat(dataPoint.timestamp);
        } else if ('Tempo' in dataPoint) {
            standardData.timestamp = safeParseFloat(dataPoint.Tempo) * 1000;
            standardData.system.millis = safeParseFloat(dataPoint.Tempo) * 1000;
        }

        // Dati accelerometro
        if ('accelX' in dataPoint) {
            standardData.sensors.accel.x = safeParseFloat(dataPoint.accelX);
            standardData.sensors.accel.y = safeParseFloat(dataPoint.accelY);
            standardData.sensors.accel.z = safeParseFloat(dataPoint.accelZ);
        } else if ('AccelX_telemetria' in dataPoint) {
            standardData.sensors.accel.x = safeParseFloat(dataPoint.AccelX_telemetria);
            standardData.sensors.accel.y = safeParseFloat(dataPoint.AccelY_telemetria);
            standardData.sensors.accel.z = safeParseFloat(dataPoint.AccelZ_telemetria);
        } else if ('accel' in dataPoint) {
            standardData.sensors.accel.x = safeParseFloat(dataPoint.accel.x);
            standardData.sensors.accel.y = safeParseFloat(dataPoint.accel.y);
            standardData.sensors.accel.z = safeParseFloat(dataPoint.accel.z);
        }

        // Dati giroscopio
        if ('gyroX' in dataPoint) {
            standardData.sensors.gyro.x = safeParseFloat(dataPoint.gyroX);
            standardData.sensors.gyro.y = safeParseFloat(dataPoint.gyroY);
            standardData.sensors.gyro.z = safeParseFloat(dataPoint.gyroZ);
        } else if ('GyroX_telemetria' in dataPoint) {
            standardData.sensors.gyro.x = safeParseFloat(dataPoint.GyroX_telemetria);
            standardData.sensors.gyro.y = safeParseFloat(dataPoint.GyroY_telemetria);
            standardData.sensors.gyro.z = safeParseFloat(dataPoint.GyroZ_telemetria);
        } else if ('gyro' in dataPoint) {
            standardData.sensors.gyro.x = safeParseFloat(dataPoint.gyro.x);
            standardData.sensors.gyro.y = safeParseFloat(dataPoint.gyro.y);
            standardData.sensors.gyro.z = safeParseFloat(dataPoint.gyro.z);
        }

        // Altitudine
        if ('altitude' in dataPoint) {
            standardData.sensors.altitude = safeParseFloat(dataPoint.altitude);
        } else if ('Altezza_telemetria' in dataPoint) {
            standardData.sensors.altitude = safeParseFloat(dataPoint.Altezza_telemetria);
        } else if ('sensors' in dataPoint && 'altitude' in dataPoint.sensors) {
            standardData.sensors.altitude = safeParseFloat(dataPoint.sensors.altitude);
        }

        // Temperatura
        if ('temperature' in dataPoint) {
            standardData.sensors.temperature = safeParseFloat(dataPoint.temperature);
        } else if ('sensors' in dataPoint && 'temperature' in dataPoint.sensors) {
            standardData.sensors.temperature = safeParseFloat(dataPoint.sensors.temperature);
        }

        // Quaternioni - verifica che i valori siano numeri validi
        if ('quatW' in dataPoint && 'quatX' in dataPoint && 'quatY' in dataPoint && 'quatZ' in dataPoint) {
            const qW = safeParseFloat(dataPoint.quatW, null);
            const qX = safeParseFloat(dataPoint.quatX, null);
            const qY = safeParseFloat(dataPoint.quatY, null);
            const qZ = safeParseFloat(dataPoint.quatZ, null);
            
            // Verifica che tutti i valori quaternione siano numeri validi
            if (qW !== null && qX !== null && qY !== null && qZ !== null) {
                standardData.quaternion = { qW, qX, qY, qZ };
            }
        } else if ('quat' in dataPoint) {
            standardData.quaternion = dataPoint.quat;
        } else if ('quaternion' in dataPoint) {
            standardData.quaternion = dataPoint.quaternion;
        }

        // Stato del razzo
        if ('state' in dataPoint) {
            standardData.system.rocketState = dataPoint.state.toString();
        } else if ('system' in dataPoint && 'rocketState' in dataPoint.system) {
            standardData.system.rocketState = dataPoint.system.rocketState;
        }

        // Simulazione (se presente)
        if ('Altezza_simulazione' in dataPoint) {
            standardData.simulation.altitude = safeParseFloat(dataPoint.Altezza_simulazione);
        }
        if ('Velocita_totale_simulazione' in dataPoint) {
            standardData.simulation.velocity = safeParseFloat(dataPoint.Velocita_totale_simulazione);
        }

        // Dati del sistema
        if ('battery' in dataPoint) {
            standardData.system.battery_voltage = safeParseFloat(dataPoint.battery);
        } else if ('analogValue' in dataPoint) {
            // Converti il valore analogico in tensione (approssimazione)
            standardData.system.battery_voltage = safeParseFloat(dataPoint.analogValue) / 1023 * 5;
        } else if ('system' in dataPoint && 'battery_voltage' in dataPoint.system) {
            standardData.system.battery_voltage = safeParseFloat(dataPoint.system.battery_voltage);
        }

        // Se ci sono orientamento già calcolati, usali
        if ('orientation' in dataPoint) {
            standardData.orientation = {
                x: safeParseFloat(dataPoint.orientation.x, 0),
                y: safeParseFloat(dataPoint.orientation.y, 0),
                z: safeParseFloat(dataPoint.orientation.z, 0)
            };
        }

        return standardData;
    }
    
    /**
     * Ricalcola l'orientamento per l'intero dataset
     * @param {string} filterType - Tipo di filtro da utilizzare
     * @param {boolean} useQuaternion - Se usare i quaternioni razzo quando disponibili
     */
    recalculateOrientation(filterType = 'complementary', useQuaternion = false) {
        if (this.data.length === 0) return;
        
        // Crea una nuova istanza di filtro con le impostazioni specificate
        const madgwickFilter = new MadgwickAHRS(100, 0.1); // sampleFreq, beta
        let lastTimestamp = this.data[0].timestamp;
        
        // Resetta il primo punto
        if (useQuaternion && this.data[0].quaternion) {
            // Usa il quaternione del razzo se disponibile e richiesto
            const angles = this._quaternionToEuler(this.data[0].quaternion);
            this.data[0].orientation = {
                x: angles.roll,
                y: angles.pitch,
                z: angles.yaw
            };
        } else {
            // Altrimenti imposta valori di default
            this.data[0].orientation = { x: 0, y: 0, z: 0 };
            this.data[0].calculatedQuaternion = { qW: 1, qX: 0, qY: 0, qZ: 0 };
        }
        
        // Completa reset del filtro
        madgwickFilter.reset();
        
        // Ricalcola per ogni punto successivo al primo
        for (let i = 1; i < this.data.length; i++) {
            const currentData = this.data[i];
            const accel = currentData.sensors.accel;
            const gyro = currentData.sensors.gyro;
            
            // Calcola il deltaTime in secondi
            const deltaTime = currentData.deltaTime;
            
            // Se ci sono quaternioni dal razzo e l'opzione è abilitata, usali
            if (useQuaternion && currentData.quaternion) {
                const angles = this._quaternionToEuler(currentData.quaternion);
                currentData.orientation = {
                    x: angles.roll,
                    y: angles.pitch,
                    z: angles.yaw
                };
                
                // Mantieni i quaternioni originali
                currentData.calculatedQuaternion = currentData.quaternion;
            } else {
                // Altrimenti, usa il filtro selezionato
                switch (filterType) {
                    case 'complementary':
                        this._applyComplementaryFilter(currentData, deltaTime);
                        break;
                    case 'kalman':
                        this._applyKalmanFilter(currentData, deltaTime);
                        break;
                    case 'madgwick':
                    case 'fullmadgwick':
                        // Aggiorna il filtro Madgwick con i parametri attuali
                        madgwickFilter.updateIMU(
                            gyro.x, gyro.y, gyro.z,   // Velocità angolari in gradi/s
                            accel.x, accel.y, accel.z, // Accelerazioni in g
                            deltaTime                 // deltaTime in secondi
                        );
                        
                        // Ottieni i risultati
                        const angles = madgwickFilter.getEulerAngles();
                        currentData.orientation = {
                            x: angles.roll,
                            y: angles.pitch,
                            z: angles.yaw
                        };
                        
                        // Salva anche i quaternioni calcolati
                        currentData.calculatedQuaternion = madgwickFilter.getQuaternion();
                        break;
                }
            }
            
            // Normalizza gli angoli
            currentData.orientation.x = this._normalizeAngle(currentData.orientation.x);
            currentData.orientation.y = this._normalizeAngle(currentData.orientation.y);
            currentData.orientation.z = this._normalizeAngle(currentData.orientation.z);
            
            // Aggiorna il timestamp
            lastTimestamp = currentData.timestamp;
        }
    }
    
    /**
     * Applica il filtro complementare
     * @private
     * @param {Object} data - Punto dati corrente
     * @param {number} deltaTime - Tempo trascorso in secondi
     */
    _applyComplementaryFilter(data, deltaTime) {
        if (deltaTime <= 0) return;
        
        const accel = data.sensors.accel;
        const gyro = data.sensors.gyro;
        
        // Ottieni l'orientamento precedente
        const prevIndex = this.data.indexOf(data) - 1;
        if (prevIndex < 0) return;
        
        const prevOrientation = this.data[prevIndex].orientation;
        
        // Calcola angoli dall'accelerometro
        const accelRoll = Math.atan2(accel.y, accel.z) * (180 / Math.PI);
        const accelPitch = Math.atan2(-accel.x, Math.sqrt(accel.y * accel.y + accel.z * accel.z)) * (180 / Math.PI);
        
        // Applica il filtro complementare
        const alpha = 0.98; // Parametro configurabile
        data.orientation = {
            x: alpha * (prevOrientation.x + gyro.x * deltaTime) + (1 - alpha) * accelRoll,
            y: alpha * (prevOrientation.y + gyro.y * deltaTime) + (1 - alpha) * accelPitch,
            z: prevOrientation.z + gyro.z * deltaTime // Integriamo solo il giroscopio per lo yaw
        };
        
        // Anche se non è la soluzione migliore, proviamo a generare quaternioni approssimativi
        data.calculatedQuaternion = this._eulerToQuaternion(
            data.orientation.x,
            data.orientation.y,
            data.orientation.z
        );
    }
    
    /**
     * Applica il filtro di Kalman (versione semplificata)
     * @private
     * @param {Object} data - Punto dati corrente
     * @param {number} deltaTime - Tempo trascorso in secondi
     */
    _applyKalmanFilter(data, deltaTime) {
        if (deltaTime <= 0) return;
        
        const accel = data.sensors.accel;
        const gyro = data.sensors.gyro;
        
        // Ottieni l'orientamento precedente
        const prevIndex = this.data.indexOf(data) - 1;
        if (prevIndex < 0) return;
        
        const prevOrientation = this.data[prevIndex].orientation;
        
        // Calcola angoli dall'accelerometro
        const accelRoll = Math.atan2(accel.y, accel.z) * (180 / Math.PI);
        const accelPitch = Math.atan2(-accel.x, Math.sqrt(accel.y * accel.y + accel.z * accel.z)) * (180 / Math.PI);
        
        // Predizione: integrazione del giroscopio
        const predictedRoll = prevOrientation.x + gyro.x * deltaTime;
        const predictedPitch = prevOrientation.y + gyro.y * deltaTime;
        const predictedYaw = prevOrientation.z + gyro.z * deltaTime;
        
        // Parametri del filtro di Kalman
        const processNoise = 0.01;
        const measurementNoise = 0.1;
        
        // Guadagno di Kalman (semplificato)
        const K = processNoise / (processNoise + measurementNoise);
        
        // Correzione
        data.orientation = {
            x: predictedRoll + K * (accelRoll - predictedRoll),
            y: predictedPitch + K * (accelPitch - predictedPitch),
            z: predictedYaw // Per yaw, utilizziamo solo la predizione
        };
        
        // Calcola quaternioni approssimativi
        data.calculatedQuaternion = this._eulerToQuaternion(
            data.orientation.x,
            data.orientation.y,
            data.orientation.z
        );
    }
    
    /**
     * Converte angoli di Eulero in quaternioni
     * @private
     * @param {number} roll - Angolo di rollio in gradi
     * @param {number} pitch - Angolo di beccheggio in gradi
     * @param {number} yaw - Angolo di imbardata in gradi
     * @returns {Object} - Quaternione {qW, qX, qY, qZ}
     */
    _eulerToQuaternion(roll, pitch, yaw) {
        // Converti in radianti
        const rollRad = roll * Math.PI / 180;
        const pitchRad = pitch * Math.PI / 180;
        const yawRad = yaw * Math.PI / 180;
        
        // Calcola seni e coseni
        const cy = Math.cos(yawRad * 0.5);
        const sy = Math.sin(yawRad * 0.5);
        const cp = Math.cos(pitchRad * 0.5);
        const sp = Math.sin(pitchRad * 0.5);
        const cr = Math.cos(rollRad * 0.5);
        const sr = Math.sin(rollRad * 0.5);
        
        // Calcola quaternione
        const qW = cr * cp * cy + sr * sp * sy;
        const qX = sr * cp * cy - cr * sp * sy;
        const qY = cr * sp * cy + sr * cp * sy;
        const qZ = cr * cp * sy - sr * sp * cy;
        
        return { qW, qX, qY, qZ };
    }
    
    /**
     * Converte quaternioni in angoli di Eulero
     * @private
     * @param {Object} quat - Quaternione {qW, qX, qY, qZ}
     * @returns {Object} - Angoli {roll, pitch, yaw} in gradi
     */
    _quaternionToEuler(quat) {
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
    
    /**
     * Normalizza un angolo nell'intervallo [-180, 180]
     * @private
     * @param {number} angle - Angolo da normalizzare
     * @returns {number} - Angolo normalizzato
     */
    _normalizeAngle(angle) {
        while (angle > 180) angle -= 360;
        while (angle < -180) angle += 360;
        return angle;
    }
    
    /**
     * Ottiene il punto dati all'indice corrente
     * @returns {Object|null} - Punto dati corrente o null
     */
    getCurrentData() {
        if (this.currentIndex >= 0 && this.currentIndex < this.data.length) {
            return this.data[this.currentIndex];
        }
        return null;
    }
    
    /**
     * Ottiene un intervallo di dati
     * @param {number} startIndex - Indice iniziale
     * @param {number} endIndex - Indice finale
     * @returns {Array} - Array di punti dati
     */
    getDataRange(startIndex, endIndex) {
        return this.data.slice(startIndex, endIndex);
    }
    
    /**
     * Ottiene sottoinsiemi di dati per grafici
     * @param {string} dataType - Tipo di dato (e.g., 'accel', 'gyro')
     * @param {number} axis - Indice dell'asse (0=x, 1=y, 2=z)
     * @returns {Array} - Array di valori per quel dato
     */
    getDataSeries(dataType, axis) {
        const result = [];
        
        for (let i = 0; i < this.data.length; i++) {
            const data = this.data[i];
            let value = null;
            
            // Seleziona il giusto dato in base al tipo
            if (dataType === 'accel') {
                if (axis === 0) value = data.sensors.accel.x;
                else if (axis === 1) value = data.sensors.accel.y;
                else if (axis === 2) value = data.sensors.accel.z;
            } else if (dataType === 'gyro') {
                if (axis === 0) value = data.sensors.gyro.x;
                else if (axis === 1) value = data.sensors.gyro.y;
                else if (axis === 2) value = data.sensors.gyro.z;
            } else if (dataType === 'orientation') {
                if (axis === 0) value = data.orientation.x;
                else if (axis === 1) value = data.orientation.y;
                else if (axis === 2) value = data.orientation.z;
            } else if (dataType === 'altitude') {
                value = data.sensors.altitude;
            }
            
            // Aggiungi il punto con timestamp
            result.push({
                x: data.timestamp,
                y: value
            });
        }
        
        return result;
    }
    
    /**
     * Imposta l'indice corrente
     * @param {number} index - Nuovo indice
     * @returns {Object|null} - Punto dati al nuovo indice o null
     */
    setCurrentIndex(index) {
        if (index >= 0 && index < this.data.length) {
            this.currentIndex = index;
            return this.getCurrentData();
        }
        return null;
    }
    
    /**
     * Aggiorna le statistiche sui tassi di campionamento
     * @private
     */
    _updateSamplingRates() {
        if (this.data.length < 2) return;
        
        let totalDeltaTime = 0;
        let minDeltaTime = Infinity;
        let maxDeltaTime = 0;
        
        // Controlla gli ultimi 10 punti o meno se non ne abbiamo abbastanza
        const startIdx = Math.max(0, this.data.length - 10);
        
        for (let i = startIdx + 1; i < this.data.length; i++) {
            const deltaTime = this.data[i].deltaTime;
            if (deltaTime === 0) continue; // Salta punti con deltaTime zero
            
            totalDeltaTime += deltaTime;
            minDeltaTime = Math.min(minDeltaTime, deltaTime);
            maxDeltaTime = Math.max(maxDeltaTime, deltaTime);
        }
        
        const numPoints = this.data.length - startIdx - 1;
        
        if (numPoints > 0 && totalDeltaTime > 0) {
            this.metadata.samplingRates = {
                min: minDeltaTime,
                max: maxDeltaTime,
                avg: totalDeltaTime / numPoints
            };
        }
    }
    
    /**
     * Esporta il dataset come file CSV
     * @returns {string} - Contenuto CSV
     */
    exportToCsv() {
        if (this.data.length === 0) return "";
        
        // Definisci le colonne da esportare
        const columns = [
            'timestamp', 'deltaTime',
            'accel.x', 'accel.y', 'accel.z',
            'gyro.x', 'gyro.y', 'gyro.z',
            'orientation.x', 'orientation.y', 'orientation.z',
            'quaternion.qW', 'quaternion.qX', 'quaternion.qY', 'quaternion.qZ',
            'calculatedQuaternion.qW', 'calculatedQuaternion.qX', 'calculatedQuaternion.qY', 'calculatedQuaternion.qZ',
            'altitude', 'temperature',
            'battery_voltage', 'rocketState'
        ];
        
        // Crea intestazione
        let csv = columns.join(',') + '\n';
        
        // Aggiungi dati
        for (const point of this.data) {
            const row = [
                point.timestamp,
                point.deltaTime,
                point.sensors.accel.x,
                point.sensors.accel.y,
                point.sensors.accel.z,
                point.sensors.gyro.x,
                point.sensors.gyro.y,
                point.sensors.gyro.z,
                point.orientation.x,
                point.orientation.y,
                point.orientation.z,
                point.quaternion ? point.quaternion.qW : '',
                point.quaternion ? point.quaternion.qX : '',
                point.quaternion ? point.quaternion.qY : '',
                point.quaternion ? point.quaternion.qZ : '',
                point.calculatedQuaternion ? point.calculatedQuaternion.qW : '',
                point.calculatedQuaternion ? point.calculatedQuaternion.qX : '',
                point.calculatedQuaternion ? point.calculatedQuaternion.qY : '',
                point.calculatedQuaternion ? point.calculatedQuaternion.qZ : '',
                point.sensors.altitude,
                point.sensors.temperature,
                point.system.battery_voltage,
                point.system.rocketState
            ];
            
            csv += row.join(',') + '\n';
        }
        
        return csv;
    }
    
    /**
     * Carica i dati da un file CSV
     * @param {string} csvContent - Contenuto del file CSV
     * @returns {boolean} - True se il caricamento è riuscito
     */
    loadFromCsv(csvContent) {
        try {
            // Utilizza PapaParse per analizzare il CSV
            const parseResult = Papa.parse(csvContent, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: true
            });
            
            if (!parseResult.data || parseResult.data.length === 0) {
                return false;
            }
            
            // Resetta il dataset corrente
            this.reset();
            
            // Mappa i dati CSV al formato standard
            for (const row of parseResult.data) {
                const standardData = {
                    timestamp: parseFloat(row.timestamp) || 0,
                    deltaTime: parseFloat(row.deltaTime) || 0,
                    sensors: {
                        accel: {
                            x: parseFloat(row['accel.x']) || 0,
                            y: parseFloat(row['accel.y']) || 0,
                            z: parseFloat(row['accel.z']) || 0
                        },
                        gyro: {
                            x: parseFloat(row['gyro.x']) || 0,
                            y: parseFloat(row['gyro.y']) || 0,
                            z: parseFloat(row['gyro.z']) || 0
                        },
                        altitude: parseFloat(row.altitude) || 0,
                        temperature: parseFloat(row.temperature) || 20
                    },
                    orientation: {
                        x: parseFloat(row['orientation.x']) || 0,
                        y: parseFloat(row['orientation.y']) || 0,
                        z: parseFloat(row['orientation.z']) || 0
                    },
                    system: {
                        battery_voltage: parseFloat(row.battery_voltage) || 4.2,
                        rocketState: row.rocketState || "Unknown",
                        millis: parseFloat(row.timestamp) || 0
                    }
                };
                
                // Aggiungi quaternioni solo se presenti
                if (row['quaternion.qW'] !== undefined) {
                    standardData.quaternion = {
                        qW: parseFloat(row['quaternion.qW']) || 0,
                        qX: parseFloat(row['quaternion.qX']) || 0,
                        qY: parseFloat(row['quaternion.qY']) || 0,
                        qZ: parseFloat(row['quaternion.qZ']) || 0
                    };
                }
                
                if (row['calculatedQuaternion.qW'] !== undefined) {
                    standardData.calculatedQuaternion = {
                        qW: parseFloat(row['calculatedQuaternion.qW']) || 0,
                        qX: parseFloat(row['calculatedQuaternion.qX']) || 0,
                        qY: parseFloat(row['calculatedQuaternion.qY']) || 0,
                        qZ: parseFloat(row['calculatedQuaternion.qZ']) || 0
                    };
                }
                
                // Aggiungi il punto dati senza fare la conversione standard
                this.data.push(standardData);
            }
            
            // Aggiorna i metadati
            if (this.data.length > 0) {
                this.metadata.startTime = this.data[0].timestamp;
                this.metadata.endTime = this.data[this.data.length - 1].timestamp;
                this.metadata.totalPoints = this.data.length;
                this._updateSamplingRates();
                
                // Verifica la presenza di quaternioni
                this.metadata.hasQuaternions = this.data.some(d => d.quaternion !== null);
            }
            
            return true;
        } catch (error) {
            console.error('Errore nel caricamento dei dati da CSV:', error);
            return false;
        }
    }
    
    /**
     * Carica dati grezzi da qualsiasi fonte
     * @param {Array} rawData - Array di dati grezzi
     * @returns {boolean} - True se il caricamento è riuscito
     */
    loadFromArray(rawData) {
        try {
            if (!Array.isArray(rawData) || rawData.length === 0) {
                return false;
            }
            
            // Resetta il dataset corrente
            this.reset();
            
            // Aggiungi ogni punto utilizzando addDataPoint
            for (const point of rawData) {
                this.addDataPoint(point);
            }
            
            return true;
        } catch (error) {
            console.error('Errore nel caricamento dei dati dall\'array:', error);
            return false;
        }
    }
    
    /**
     * Filtra il dataset in base a criteri
     * @param {function} filterFn - Funzione di filtro che riceve un punto dati
     * @returns {Array} - Array di punti dati filtrati
     */
    filter(filterFn) {
        return this.data.filter(filterFn);
    }
    
    /**
     * Resetta il dataset
     */
    reset() {
        this.data = [];
        this.currentIndex = 0;
        this.metadata = {
            startTime: null,
            endTime: null,
            samplingRates: { min: null, max: null, avg: null },
            totalPoints: 0,
            hasQuaternions: false
        };
    }
    
    /**
     * Restituisce statistiche sul dataset
     * @returns {Object} - Statistiche del dataset
     */
    getStatistics() {
        if (this.data.length === 0) {
            return {
                count: 0,
                duration: 0,
                samplingRates: { min: 0, max: 0, avg: 0 }
            };
        }
        
        // Calcola durata in secondi
        const duration = (this.metadata.endTime - this.metadata.startTime) / 1000;
        
        // Calcola statistiche per accelerometro e giroscopio
        const accelStats = this._calculateAxisStats('accel');
        const gyroStats = this._calculateAxisStats('gyro');
        const orientStats = this._calculateAxisStats('orientation');
        const altitudeStats = this._calculateValueStats('sensors', 'altitude');
        
        return {
            count: this.data.length,
            duration,
            samplingRates: this.metadata.samplingRates,
            acceleration: accelStats,
            gyroscope: gyroStats,
            orientation: orientStats,
            altitude: altitudeStats,
            hasQuaternions: this.metadata.hasQuaternions
        };
    }
    
    /**
     * Calcola statistiche per assi (x, y, z)
     * @private
     * @param {string} type - Tipo di dati ('accel', 'gyro', 'orientation')
     * @returns {Object} - Statistiche per ogni asse
     */
    _calculateAxisStats(type) {
        const stats = {
            x: { min: Infinity, max: -Infinity, avg: 0 },
            y: { min: Infinity, max: -Infinity, avg: 0 },
            z: { min: Infinity, max: -Infinity, avg: 0 }
        };
        
        let sumX = 0, sumY = 0, sumZ = 0;
        
        for (const point of this.data) {
            let x, y, z;
            
            // Seleziona i dati giusti in base al tipo
            if (type === 'accel' || type === 'gyro') {
                x = point.sensors[type].x;
                y = point.sensors[type].y;
                z = point.sensors[type].z;
            } else if (type === 'orientation') {
                x = point.orientation.x;
                y = point.orientation.y;
                z = point.orientation.z;
            }
            
            // Aggiorna statistiche
            stats.x.min = Math.min(stats.x.min, x);
            stats.x.max = Math.max(stats.x.max, x);
            sumX += x;
            
            stats.y.min = Math.min(stats.y.min, y);
            stats.y.max = Math.max(stats.y.max, y);
            sumY += y;
            
            stats.z.min = Math.min(stats.z.min, z);
            stats.z.max = Math.max(stats.z.max, z);
            sumZ += z;
        }
        
        // Calcola medie
        stats.x.avg = sumX / this.data.length;
        stats.y.avg = sumY / this.data.length;
        stats.z.avg = sumZ / this.data.length;
        
        return stats;
    }
    
    /**
     * Calcola statistiche per un singolo valore
     * @private
     * @param {string} category - Categoria del valore ('sensors', 'system')
     * @param {string} field - Nome del campo
     * @returns {Object} - Statistiche per il valore
     */
    _calculateValueStats(category, field) {
        const stats = { min: Infinity, max: -Infinity, avg: 0 };
        let sum = 0;
        
        for (const point of this.data) {
            const value = point[category][field];
            
            if (value !== undefined && value !== null) {
                stats.min = Math.min(stats.min, value);
                stats.max = Math.max(stats.max, value);
                sum += value;
            }
        }
        
        stats.avg = sum / this.data.length;
        
        return stats;
    }
}