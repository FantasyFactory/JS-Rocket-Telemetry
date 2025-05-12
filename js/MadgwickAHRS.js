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
