/**
 * Versione migliorata del filtro Madgwick in JavaScript
 * Basato sull'algoritmo originale di Sebastian Madgwick
 * http://x-io.co.uk/open-source-imu-and-ahrs-algorithms/
 * 
 * Questa versione supporta direttamente deltaTime anziché calcolarlo da timestamp
 */
class MadgwickAHRS {
    constructor(sampleFreq = 100, beta = 0.1) {
        // Frequenza di campionamento in Hz (usata solo se non viene fornito deltaTime)
        this.sampleFreq = sampleFreq;
        
        // Parametro di guadagno dell'algoritmo (2 * errore proporzionale stimato)
        this.beta = beta;
        
        // Quaternione che rappresenta l'orientamento
        this.q0 = 1.0;
        this.q1 = 0.0;
        this.q2 = 0.0;
        this.q3 = 0.0;
    }
    
    /**
     * Aggiorna l'orientamento dall'IMU (no magnetometro)
     * @param {number} gx - Velocità angolare X (gradi/s)
     * @param {number} gy - Velocità angolare Y (gradi/s)
     * @param {number} gz - Velocità angolare Z (gradi/s)
     * @param {number} ax - Accelerazione X (g)
     * @param {number} ay - Accelerazione Y (g)
     * @param {number} az - Accelerazione Z (g)
     * @param {number} deltaTime - Tempo trascorso in secondi (opzionale)
     */
    updateIMU(gx, gy, gz, ax, ay, az, deltaTime = null) {
        let recipNorm;
        let s0, s1, s2, s3;
        let qDot1, qDot2, qDot3, qDot4;
        let _2q0, _2q1, _2q2, _2q3, _4q0, _4q1, _4q2, _8q1, _8q2, q0q0, q1q1, q2q2, q3q3;
        
        // Se deltaTime non viene fornito, utilizza 1/sampleFreq
        if (deltaTime === null) {
            deltaTime = 1.0 / this.sampleFreq;
        }
        
        // Converti velocità angolare da gradi/sec a radianti/s
        gx *= 0.0174533; // Math.PI / 180
        gy *= 0.0174533;
        gz *= 0.0174533;
        
        // Tasso di variazione del quaternione dall'orientamento del giroscopio
        qDot1 = 0.5 * (-this.q1 * gx - this.q2 * gy - this.q3 * gz);
        qDot2 = 0.5 * (this.q0 * gx + this.q2 * gz - this.q3 * gy);
        qDot3 = 0.5 * (this.q0 * gy - this.q1 * gz + this.q3 * gx);
        qDot4 = 0.5 * (this.q0 * gz + this.q1 * gy - this.q2 * gx);
        
        // Calcola il feedback solo se l'accelerometro è valido (evita NaN)
        if (!((ax === 0.0) && (ay === 0.0) && (az === 0.0))) {
            // Normalizza le misure dell'accelerometro
            recipNorm = this.invSqrt(ax * ax + ay * ay + az * az);
            ax *= recipNorm;
            ay *= recipNorm;
            az *= recipNorm;
            
            // Variabili ausiliarie per evitare aritmetica ripetuta
            _2q0 = 2.0 * this.q0;
            _2q1 = 2.0 * this.q1;
            _2q2 = 2.0 * this.q2;
            _2q3 = 2.0 * this.q3;
            _4q0 = 4.0 * this.q0;
            _4q1 = 4.0 * this.q1;
            _4q2 = 4.0 * this.q2;
            _8q1 = 8.0 * this.q1;
            _8q2 = 8.0 * this.q2;
            q0q0 = this.q0 * this.q0;
            q1q1 = this.q1 * this.q1;
            q2q2 = this.q2 * this.q2;
            q3q3 = this.q3 * this.q3;
            
            // Gradiente discendente algoritmo passi correttivi
            s0 = _4q0 * q2q2 + _2q2 * ax + _4q0 * q1q1 - _2q1 * ay;
            s1 = _4q1 * q3q3 - _2q3 * ax + 4.0 * q0q0 * this.q1 - _2q0 * ay - _4q1 + _8q1 * q1q1 + _8q1 * q2q2 + _4q1 * az;
            s2 = 4.0 * q0q0 * this.q2 + _2q0 * ax + _4q2 * q3q3 - _2q3 * ay - _4q2 + _8q2 * q1q1 + _8q2 * q2q2 + _4q2 * az;
            s3 = 4.0 * q1q1 * this.q3 - _2q1 * ax + 4.0 * q2q2 * this.q3 - _2q2 * ay;
            
            // Normalizza il passo del gradiente
            recipNorm = this.invSqrt(s0 * s0 + s1 * s1 + s2 * s2 + s3 * s3);
            s0 *= recipNorm;
            s1 *= recipNorm;
            s2 *= recipNorm;
            s3 *= recipNorm;
            
            // Applica il passo di feedback
            qDot1 -= this.beta * s0;
            qDot2 -= this.beta * s1;
            qDot3 -= this.beta * s2;
            qDot4 -= this.beta * s3;
        }
        
        // Integra il tasso di variazione del quaternione per ottenere il quaternione
        this.q0 += qDot1 * deltaTime;
        this.q1 += qDot2 * deltaTime;
        this.q2 += qDot3 * deltaTime;
        this.q3 += qDot4 * deltaTime;
        
        // Normalizza il quaternione
        recipNorm = this.invSqrt(this.q0 * this.q0 + this.q1 * this.q1 + this.q2 * this.q2 + this.q3 * this.q3);
        this.q0 *= recipNorm;
        this.q1 *= recipNorm;
        this.q2 *= recipNorm;
        this.q3 *= recipNorm;
    }
    
    /**
     * Aggiornamento completo AHRS con magnetometro
     * @param {number} gx - Velocità angolare X (gradi/s)
     * @param {number} gy - Velocità angolare Y (gradi/s)
     * @param {number} gz - Velocità angolare Z (gradi/s)
     * @param {number} ax - Accelerazione X (g)
     * @param {number} ay - Accelerazione Y (g)
     * @param {number} az - Accelerazione Z (g)
     * @param {number} mx - Campo magnetico X
     * @param {number} my - Campo magnetico Y
     * @param {number} mz - Campo magnetico Z
     * @param {number} deltaTime - Tempo trascorso in secondi (opzionale)
     */
    update(gx, gy, gz, ax, ay, az, mx, my, mz, deltaTime = null) {
        // Se i dati del magnetometro non sono validi, utilizza la versione solo IMU
        if ((mx === 0.0) && (my === 0.0) && (mz === 0.0)) {
            this.updateIMU(gx, gy, gz, ax, ay, az, deltaTime);
            return;
        }
        
        // Se deltaTime non viene fornito, utilizza 1/sampleFreq
        if (deltaTime === null) {
            deltaTime = 1.0 / this.sampleFreq;
        }
        
        let recipNorm;
        let s0, s1, s2, s3;
        let qDot1, qDot2, qDot3, qDot4;
        let hx, hy;
        let _2q0mx, _2q0my, _2q0mz, _2q1mx, _2bx, _2bz, _4bx, _4bz;
        let _2q0, _2q1, _2q2, _2q3, _2q0q2, _2q2q3, q0q0, q0q1, q0q2, q0q3, q1q1, q1q2, q1q3, q2q2, q2q3, q3q3;
        
        // Converti velocità angolare da gradi/sec a radianti/s
        gx *= 0.0174533; // Math.PI / 180
        gy *= 0.0174533;
        gz *= 0.0174533;
        
        // Tasso di variazione del quaternione dall'orientamento del giroscopio
        qDot1 = 0.5 * (-this.q1 * gx - this.q2 * gy - this.q3 * gz);
        qDot2 = 0.5 * (this.q0 * gx + this.q2 * gz - this.q3 * gy);
        qDot3 = 0.5 * (this.q0 * gy - this.q1 * gz + this.q3 * gx);
        qDot4 = 0.5 * (this.q0 * gz + this.q1 * gy - this.q2 * gx);
        
        // Calcola il feedback solo se l'accelerometro è valido (evita NaN)
        if (!((ax === 0.0) && (ay === 0.0) && (az === 0.0))) {
            // Normalizza le misure dell'accelerometro
            recipNorm = this.invSqrt(ax * ax + ay * ay + az * az);
            ax *= recipNorm;
            ay *= recipNorm;
            az *= recipNorm;
            
            // Normalizza le misure del magnetometro
            recipNorm = this.invSqrt(mx * mx + my * my + mz * mz);
            mx *= recipNorm;
            my *= recipNorm;
            mz *= recipNorm;
            
            // Variabili ausiliarie per evitare aritmetica ripetuta
            _2q0mx = 2.0 * this.q0 * mx;
            _2q0my = 2.0 * this.q0 * my;
            _2q0mz = 2.0 * this.q0 * mz;
            _2q1mx = 2.0 * this.q1 * mx;
            _2q0 = 2.0 * this.q0;
            _2q1 = 2.0 * this.q1;
            _2q2 = 2.0 * this.q2;
            _2q3 = 2.0 * this.q3;
            _2q0q2 = 2.0 * this.q0 * this.q2;
            _2q2q3 = 2.0 * this.q2 * this.q3;
            q0q0 = this.q0 * this.q0;
            q0q1 = this.q0 * this.q1;
            q0q2 = this.q0 * this.q2;
            q0q3 = this.q0 * this.q3;
            q1q1 = this.q1 * this.q1;
            q1q2 = this.q1 * this.q2;
            q1q3 = this.q1 * this.q3;
            q2q2 = this.q2 * this.q2;
            q2q3 = this.q2 * this.q3;
            q3q3 = this.q3 * this.q3;
            
            // Riferimenti direzione del campo magnetico terrestre
            hx = mx * q0q0 - _2q0my * this.q3 + _2q0mz * this.q2 + mx * q1q1 + _2q1 * my * this.q2 + _2q1 * mz * this.q3 - mx * q2q2 - mx * q3q3;
            hy = _2q0mx * this.q3 + my * q0q0 - _2q0mz * this.q1 + _2q1mx * this.q2 - my * q1q1 + my * q2q2 + _2q2 * mz * this.q3 - my * q3q3;
            _2bx = Math.sqrt(hx * hx + hy * hy);
            _2bz = -_2q0mx * this.q2 + _2q0my * this.q1 + mz * q0q0 + _2q1mx * this.q3 - mz * q1q1 + _2q2 * my * this.q3 - mz * q2q2 + mz * q3q3;
            _4bx = 2.0 * _2bx;
            _4bz = 2.0 * _2bz;
            
            // Gradiente discendente algoritmo passi correttivi
            s0 = -_2q2 * (2.0 * q1q3 - _2q0q2 - ax) + _2q1 * (2.0 * q0q1 + _2q2q3 - ay) - _2bz * this.q2 * (_2bx * (0.5 - q2q2 - q3q3) + _2bz * (q1q3 - q0q2) - mx) + (-_2bx * this.q3 + _2bz * this.q1) * (_2bx * (q1q2 - q0q3) + _2bz * (q0q1 + q2q3) - my) + _2bx * this.q2 * (_2bx * (q0q2 + q1q3) + _2bz * (0.5 - q1q1 - q2q2) - mz);
            s1 = _2q3 * (2.0 * q1q3 - _2q0q2 - ax) + _2q0 * (2.0 * q0q1 + _2q2q3 - ay) - 4.0 * this.q1 * (1 - 2.0 * q1q1 - 2.0 * q2q2 - az) + _2bz * this.q3 * (_2bx * (0.5 - q2q2 - q3q3) + _2bz * (q1q3 - q0q2) - mx) + (_2bx * this.q2 + _2bz * this.q0) * (_2bx * (q1q2 - q0q3) + _2bz * (q0q1 + q2q3) - my) + (_2bx * this.q3 - _4bz * this.q1) * (_2bx * (q0q2 + q1q3) + _2bz * (0.5 - q1q1 - q2q2) - mz);
            s2 = -_2q0 * (2.0 * q1q3 - _2q0q2 - ax) + _2q3 * (2.0 * q0q1 + _2q2q3 - ay) - 4.0 * this.q2 * (1 - 2.0 * q1q1 - 2.0 * q2q2 - az) + (-_4bx * this.q2 - _2bz * this.q0) * (_2bx * (0.5 - q2q2 - q3q3) + _2bz * (q1q3 - q0q2) - mx) + (_2bx * this.q1 + _2bz * this.q3) * (_2bx * (q1q2 - q0q3) + _2bz * (q0q1 + q2q3) - my) + (_2bx * this.q0 - _4bz * this.q2) * (_2bx * (q0q2 + q1q3) + _2bz * (0.5 - q1q1 - q2q2) - mz);
            s3 = _2q1 * (2.0 * q1q3 - _2q0q2 - ax) + _2q2 * (2.0 * q0q1 + _2q2q3 - ay) + (-_4bx * this.q3 + _2bz * this.q1) * (_2bx * (0.5 - q2q2 - q3q3) + _2bz * (q1q3 - q0q2) - mx) + (-_2bx * this.q0 + _2bz * this.q2) * (_2bx * (q1q2 - q0q3) + _2bz * (q0q1 + q2q3) - my) + _2bx * this.q1 * (_2bx * (q0q2 + q1q3) + _2bz * (0.5 - q1q1 - q2q2) - mz);
            
            // Normalizza il passo del gradiente
            recipNorm = this.invSqrt(s0 * s0 + s1 * s1 + s2 * s2 + s3 * s3);
            s0 *= recipNorm;
            s1 *= recipNorm;
            s2 *= recipNorm;
            s3 *= recipNorm;
            
            // Applica il passo di feedback
            qDot1 -= this.beta * s0;
            qDot2 -= this.beta * s1;
            qDot3 -= this.beta * s2;
            qDot4 -= this.beta * s3;
        }
        
        // Integra il tasso di variazione del quaternione per ottenere il quaternione
        this.q0 += qDot1 * deltaTime;
        this.q1 += qDot2 * deltaTime;
        this.q2 += qDot3 * deltaTime;
        this.q3 += qDot4 * deltaTime;
        
        // Normalizza il quaternione
        recipNorm = this.invSqrt(this.q0 * this.q0 + this.q1 * this.q1 + this.q2 * this.q2 + this.q3 * this.q3);
        this.q0 *= recipNorm;
        this.q1 *= recipNorm;
        this.q2 *= recipNorm;
        this.q3 *= recipNorm;
    }
    
    /**
     * Inverse square root (algoritmo fast inverse square root)
     * @param {number} x - Valore di input
     * @return {number} 1/sqrt(x)
     */
    invSqrt(x) {
        // Implementazione JS della funzione invSqrt
        return 1.0 / Math.sqrt(x);
    }
    
    /**
     * Converte i quaternioni in angoli di Eulero (in gradi)
     * @return {Object} Oggetto con roll, pitch e yaw in gradi
     */
    getEulerAngles() {
        const q0 = this.q0;
        const q1 = this.q1;
        const q2 = this.q2;
        const q3 = this.q3;
        
        // Roll (x-axis rotation)
        const sinr_cosp = 2 * (q0 * q1 + q2 * q3);
        const cosr_cosp = 1 - 2 * (q1 * q1 + q2 * q2);
        const roll = Math.atan2(sinr_cosp, cosr_cosp) * 180 / Math.PI;
        
        // Pitch (y-axis rotation)
        const sinp = 2 * (q0 * q2 - q3 * q1);
        let pitch;
        if (Math.abs(sinp) >= 1) {
            // Usa 90 gradi se fuori range (gimbal lock)
            pitch = Math.sign(sinp) * 90;
        } else {
            pitch = Math.asin(sinp) * 180 / Math.PI;
        }
        
        // Yaw (z-axis rotation)
        const siny_cosp = 2 * (q0 * q3 + q1 * q2);
        const cosy_cosp = 1 - 2 * (q2 * q2 + q3 * q3);
        const yaw = Math.atan2(siny_cosp, cosy_cosp) * 180 / Math.PI;
        
        return { roll, pitch, yaw };
    }
    
    /**
     * Restituisce i componenti del quaternione
     * @return {Object} Oggetto con i componenti del quaternione
     */
    getQuaternion() {
        return {
            qW: this.q0,
            qX: this.q1,
            qY: this.q2,
            qZ: this.q3
        };
    }
    
    /**
     * Reimposta il quaternione ai valori iniziali (orientamento di default)
     */
    reset() {
        this.q0 = 1.0;
        this.q1 = 0.0;
        this.q2 = 0.0;
        this.q3 = 0.0;
    }
    
    /**
     * Imposta il valore di beta (guadagno dell'algoritmo)
     * @param {number} beta - Nuovo valore di beta
     */
    setBeta(beta) {
        this.beta = beta;
    }
    
    /**
     * Imposta direttamente i valori del quaternione
     * @param {Object} quaternion - Quaternione {qW, qX, qY, qZ}
     */
    setQuaternion(quaternion) {
        if (quaternion && typeof quaternion === 'object') {
            this.q0 = quaternion.qW !== undefined ? quaternion.qW : 1.0;
            this.q1 = quaternion.qX !== undefined ? quaternion.qX : 0.0;
            this.q2 = quaternion.qY !== undefined ? quaternion.qY : 0.0;
            this.q3 = quaternion.qZ !== undefined ? quaternion.qZ : 0.0;
            
            // Normalizza il quaternione
            const recipNorm = this.invSqrt(this.q0 * this.q0 + this.q1 * this.q1 + this.q2 * this.q2 + this.q3 * this.q3);
            this.q0 *= recipNorm;
            this.q1 *= recipNorm;
            this.q2 *= recipNorm;
            this.q3 *= recipNorm;
        }
    }
}

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
    
    // Processa i dati telemetrici (nuova versione che utilizza deltaTime dal punto dati)
    function processData(data) {
        // Usa direttamente i dati di orientamento ricalcolati se disponibili
        if (data.orientation) {
            return data;
        }
        
        const accel = data.sensors.accel;
        const gyro = data.sensors.gyro;
        
        // Ottieni il deltaTime in secondi
        const deltaTime = data.deltaTime || 0.01; // Default a 10ms se non disponibile
        
        // Crea l'oggetto risultato con una copia profonda dei dati originali
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
            
            // Mantieni il quaternione originale
            result.calculatedQuaternion = data.quaternion;
        } 
        // Altrimenti, se il filtro è disabilitato, esegui una stima semplice
        else if (!filterEnabled) {
            // Stima grossolana dell'orientamento dall'accelerometro
            result.orientation = {
                x: Math.atan2(accel.y, accel.z) * (180 / Math.PI), // Roll
                y: Math.atan2(-accel.x, Math.sqrt(accel.y * accel.y + accel.z * accel.z)) * (180 / Math.PI), // Pitch
                z: 0 // Yaw non può essere stimato solo dall'accelerometro
            };
        } 
        // Altrimenti, applica il filtro selezionato
        else {
            switch (filterType) {
                case 'complementary':
                    applyComplementaryFilter(result, deltaTime);
                    break;
                case 'kalman':
                    applyKalmanFilter(result, deltaTime);
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
                    break;
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