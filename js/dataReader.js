/**
 * dataReader.js
 * Gestisce la lettura dei dati telemetrici da file e WebSocket
 */

const DataReader = (function() {
    // Variabili private
    let dataSource = 'realtime'; // 'realtime' o 'file'
    let baseUrl = 'http://192.168.4.1';
    let wsConnection = null;
    let flightData = [];
    let currentIndex = 0;
    let isPlaying = false;
    let playInterval = null;
    let playbackSpeed = 1; // Velocità di riproduzione
    let listeners = []; // Array di callback per notificare i dati
    let lastTimestamp = 0;
    
    // Configura l'URL dell'API
    function setBaseUrl(url) {
        baseUrl = url;
        return this;
    }
    
    // Imposta la sorgente dati
    function setDataSource(source) {
        if (source !== 'realtime' && source !== 'file') {
            console.error('Sorgente dati non valida:', source);
            return this;
        }
        
        // Ferma eventuali connessioni attive
        stop();
        
        dataSource = source;
        return this;
    }
    
    // Aggiunge un listener per ricevere i dati
    function addDataListener(callback) {
        if (typeof callback === 'function') {
            listeners.push(callback);
        }
        return this;
    }
    
    // Rimuove un listener
    function removeDataListener(callback) {
        listeners = listeners.filter(cb => cb !== callback);
        return this;
    }
    
    // Notifica tutti i listener con nuovi dati
    function notifyListeners(data) {
        listeners.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error('Errore nel callback del listener:', error);
            }
        });
    }
    
    // Inizia l'acquisizione dati
    function start() {
        stop(); // Ferma prima eventuali acquisizioni in corso
        
        if (dataSource === 'realtime') {
            connectWebSocket();
        } else if (dataSource === 'file' && flightData.length > 0) {
            startPlayback();
        }
        
        return this;
    }
    
    // Ferma l'acquisizione dati
    function stop() {
        // Ferma il WebSocket
        if (wsConnection) {
            wsConnection.close();
            wsConnection = null;
        }
        
        // Ferma la riproduzione
        if (playInterval) {
            clearInterval(playInterval);
            playInterval = null;
            isPlaying = false;
        }
        
        return this;
    }
    
    // Connette al WebSocket per i dati in tempo reale
    function connectWebSocket() {
        // Determina l'URL del WebSocket
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = new URL(baseUrl).hostname;
        const wsUrl = `${wsProtocol}//${wsHost}/ws`;
        
        try {
            wsConnection = new WebSocket(wsUrl);
            
            wsConnection.onopen = function() {
                console.log('WebSocket connesso a', wsUrl);
                notifyEvent('connection', { status: 'connected' });
            };
            
            wsConnection.onclose = function() {
                console.log('WebSocket disconnesso');
                notifyEvent('connection', { status: 'disconnected' });
                wsConnection = null;
                
                // Riconnetti automaticamente dopo 3 secondi se siamo ancora in modalità realtime
                // if (dataSource === 'realtime') {
                //     setTimeout(() => {
                //         connectWebSocket();
                //     }, 3000);
                // }
            };
            
            wsConnection.onerror = function(error) {
                console.error('Errore WebSocket:', error);
                notifyEvent('error', { message: 'Errore di connessione al WebSocket' });
            };
            
            wsConnection.onmessage = function(event) {
                try {
                    const data = JSON.parse(event.data);
                    processRealtimeData(data);
                } catch (error) {
                    console.error('Errore nel parsing dei dati WebSocket:', error);
                }
            };
        } catch (error) {
            console.error('Errore nella creazione del WebSocket:', error);
            notifyEvent('error', { message: 'Impossibile creare la connessione WebSocket' });
        }
    }
    
    // Processa i dati in tempo reale
    function processRealtimeData(data) {
        // Trasforma i dati dal nuovo formato al formato standard utilizzato dall'applicazione
        const standardData = {
            timestamp: data.timestamp || data.millis || Date.now(),
            sensors: {
                accel: {
                    x: data.accel?.x || 0,
                    y: data.accel?.y || 0,
                    z: data.accel?.z || 0
                },
                gyro: {
                    x: data.gyro?.x || 0,
                    y: data.gyro?.y || 0,
                    z: data.gyro?.z || 0
                },
                altitude: data.altitude || 0,
                temperature: data.temperature || 20 // Valore predefinito se non disponibile
            },
            system: {
                battery_voltage: data.battery_voltage || 4.2, // Valore predefinito
                free_heap: data.free_heap || 0,
                free_space: data.free_space || 0,
                total_space: data.total_space || 1,
                wifi_strength: data.wifi_strength || 0,
                millis: data.millis || data.timestamp || Date.now(),
                rocketState: data.rocketState || "Unknown" // Nuovo campo per lo stato del razzo
            },
            simulation: {
                altitude: data.simulation?.altitude || 0,
                velocity: data.simulation?.velocity || 0
            },
            quaternion: data.quat || null // Salviamo i dati del quaternione per un eventuale uso futuro
        };
        
        // Notifica i dati a tutti i listener
        notifyListeners(standardData);
    }
    
    // Carica dati da file CSV o TXT
    function loadFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                try {
                    parseCSV(e.target.result);
                    resolve(flightData);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = function(error) {
                reject(error);
            };
            
            reader.readAsText(file);
        });
    }
    
    // Carica dati da testo CSV
    function loadFromText(text) {
        try {
            parseCSV(text);
            return Promise.resolve(flightData);
        } catch (error) {
            return Promise.reject(error);
        }
    }
    
    // Analizza i dati CSV
    function parseCSV(text) {
        // Sostituisci le virgole con i punti per i numeri
        text = text.replace(/(\d+),(\d+)/g, '$1.$2');
        
        // Utilizza PapaParse per l'analisi
        const parsedData = Papa.parse(text, { 
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true
        });
        
        if (parsedData.errors && parsedData.errors.length > 0) {
            console.warn('Errori nel parsing CSV:', parsedData.errors);
        }
        
        flightData = parsedData.data;
        currentIndex = 0;
        
        // Notifica l'evento di caricamento dati
        notifyEvent('fileLoaded', { 
            recordCount: flightData.length,
            columns: parsedData.meta.fields 
        });
        
        return flightData;
    }
    
    // Avvia la riproduzione dei dati da file
    function startPlayback() {
        if (flightData.length === 0) return;
        
        isPlaying = true;
        
        // Notifica l'evento di avvio riproduzione
        notifyEvent('playback', { status: 'started', currentIndex });
        
        // Intervallo di riproduzione
        playInterval = setInterval(() => {
            if (currentIndex >= flightData.length) {
                // Fine dei dati, ferma la riproduzione
                stop();
                notifyEvent('playback', { status: 'ended' });
                return;
            }
            
            // Ottieni il punto dati corrente
            const dataPoint = flightData[currentIndex];
            
            // Converti i dati nel formato standard
            const standardData = convertToStandardFormat(dataPoint);
            
            // Notifica i listener
            notifyListeners(standardData);
            
            // Notifica l'evento di aggiornamento indice
            notifyEvent('playback', { 
                status: 'playing',
                currentIndex,
                totalPoints: flightData.length
            });
            
            // Avanza all'indice successivo
            currentIndex++;
        }, 100 / playbackSpeed); // Intervallo regolabile con playbackSpeed
    }
    
    // Pausa la riproduzione
    function pausePlayback() {
        if (playInterval) {
            clearInterval(playInterval);
            playInterval = null;
            isPlaying = false;
            
            // Notifica l'evento di pausa
            notifyEvent('playback', { status: 'paused', currentIndex });
        }
        
        return this;
    }
    
    // Riprende la riproduzione
    function resumePlayback() {
        if (!isPlaying && dataSource === 'file' && flightData.length > 0) {
            startPlayback();
        }
        
        return this;
    }
    
    // Imposta la posizione corrente della riproduzione
    function seek(index) {
        if (index >= 0 && index < flightData.length) {
            currentIndex = index;
            
            // Se la riproduzione è in pausa, invia comunque l'aggiornamento
            if (!isPlaying && flightData.length > 0) {
                const dataPoint = flightData[currentIndex];
                const standardData = convertToStandardFormat(dataPoint);
                notifyListeners(standardData);
            }
            
            // Notifica l'evento di seek
            notifyEvent('playback', { 
                status: isPlaying ? 'playing' : 'paused',
                currentIndex,
                totalPoints: flightData.length
            });
        }
        
        return this;
    }
    
    // Imposta la velocità di riproduzione
    function setPlaybackSpeed(speed) {
        playbackSpeed = speed;
        
        // Se la riproduzione è in corso, aggiorna l'intervallo
        if (isPlaying && playInterval) {
            clearInterval(playInterval);
            startPlayback();
        }
        
        return this;
    }
    
    // Invia un comando al razzo
    async function sendCommand(command) {
        try {
            const response = await fetch(`${baseUrl}/${command}`);
            if (!response.ok) {
                throw new Error(`Errore HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Notifica l'evento di comando
            notifyEvent('command', { 
                command,
                response: data
            });
            
            return data;
        } catch (error) {
            console.error(`Errore nell'invio del comando ${command}:`, error);
            
            // Notifica l'evento di errore
            notifyEvent('error', { 
                command,
                message: error.message
            });
            
            throw error; // Rilancia l'errore per gestione esterna
        }
    }
    
    // Recupera dati IMU on demand
    async function fetchImuData() {
        try {
            const response = await fetch(`${baseUrl}/imudata`);
            if (!response.ok) {
                throw new Error(`Errore HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            processRealtimeData(data);
            return data;
        } catch (error) {
            console.error('Errore nel recupero dei dati IMU:', error);
            throw error;
        }
    }
    
    // Recupera dati di stato on demand
    async function fetchStatusData() {
        try {
            const response = await fetch(`${baseUrl}/status`);
            if (!response.ok) {
                throw new Error(`Errore HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            notifyEvent('status', data);
            return data;
        } catch (error) {
            console.error('Errore nel recupero dei dati di stato:', error);
            throw error;
        }
    }
    
    // Ottiene l'elenco dei file disponibili
    async function fetchFiles() {
        try {
            const response = await fetch(`${baseUrl}/files`);
            if (!response.ok) {
                throw new Error(`Errore HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Notifica l'evento di elenco file
            notifyEvent('files', data.files);
            
            return data.files;
        } catch (error) {
            console.error('Errore nel recupero dell\'elenco file:', error);
            throw error;
        }
    }
    
    // Imposta il range del giroscopio
    async function setGyroRange(range) {
        try {
            const response = await fetch(`${baseUrl}/setgyro?range=${range}`);
            const data = await response.json();
            notifyEvent('sensorConfig', { type: 'gyro', range, response: data });
            return data;
        } catch (error) {
            console.error('Errore nell\'impostazione del range del giroscopio:', error);
            throw error;
        }
    }
    
    // Imposta il range dell'accelerometro
    async function setAccelRange(range) {
        try {
            const response = await fetch(`${baseUrl}/setaccel?range=${range}`);
            const data = await response.json();
            notifyEvent('sensorConfig', { type: 'accel', range, response: data });
            return data;
        } catch (error) {
            console.error('Errore nell\'impostazione del range dell\'accelerometro:', error);
            throw error;
        }
    }
    
    // Notifica eventi generali
    function notifyEvent(eventType, data) {
        const event = new CustomEvent('telemetryEvent', {
            detail: {
                type: eventType,
                timestamp: Date.now(),
                data: data
            }
        });
        
        window.dispatchEvent(event);
    }
    
    // Converte i dati del formato CSV al formato standard utilizzato dall'applicazione
    function convertToStandardFormat(dataPoint) {
        // Determina quali campi sono disponibili
        const hasAccel = 'AccelX_telemetria' in dataPoint || 'accelX' in dataPoint;
        const hasGyro = 'GyroX_telemetria' in dataPoint || 'gyroX' in dataPoint;
        const hasAltitude = 'Altezza_telemetria' in dataPoint || 'altitude' in dataPoint;
        
        // Crea una struttura dati standard
        return {
            timestamp: dataPoint.Tempo * 1000 || dataPoint.timestamp || Date.now(),
            sensors: {
                accel: {
                    x: dataPoint.AccelX_telemetria || dataPoint.accelX || 0,
                    y: dataPoint.AccelY_telemetria || dataPoint.accelY || 0,
                    z: dataPoint.AccelZ_telemetria || dataPoint.accelZ || 0
                },
                gyro: {
                    x: dataPoint.GyroX_telemetria || dataPoint.gyroX || 0,
                    y: dataPoint.GyroY_telemetria || dataPoint.gyroY || 0,
                    z: dataPoint.GyroZ_telemetria || dataPoint.gyroZ || 0
                },
                altitude: dataPoint.Altezza_telemetria || dataPoint.altitude || 0,
                temperature: dataPoint.temperature || 20 // Valore predefinito se non disponibile
            },
            system: {
                battery_voltage: dataPoint.battery || 4.2,
                free_heap: dataPoint.free_heap || 0,
                free_space: dataPoint.free_space || 0,
                total_space: dataPoint.total_space || 1,
                wifi_strength: dataPoint.wifi_strength || 0,
                millis: dataPoint.Tempo * 1000 || dataPoint.timestamp || Date.now()
            },
            simulation: {
                altitude: dataPoint.Altezza_simulazione || 0,
                velocity: dataPoint.Velocita_totale_simulazione || 0
            }
        };
    }
    
    // Metodi pubblici
    return {
        setBaseUrl,
        setDataSource,
        addDataListener,
        removeDataListener,
        start,
        stop,
        loadFromFile,
        loadFromText,
        seek,
        pausePlayback,
        resumePlayback,
        setPlaybackSpeed,
        sendCommand,
        fetchImuData,
        fetchStatusData,
        fetchFiles,
        setGyroRange,
        setAccelRange,
        
        // Proprietà di sola lettura
        get isPlaying() { return isPlaying; },
        get currentIndex() { return currentIndex; },
        get totalPoints() { return flightData.length; },
        get dataSource() { return dataSource; }
    };
})();