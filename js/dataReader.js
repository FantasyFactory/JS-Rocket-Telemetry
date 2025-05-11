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
                    console.log("File caricato, dimensione:", e.target.result.length, "bytes");
                    console.log("Tipo di file:", file.type);
                    
                    // Per file CSV, assicuriamoci che la codifica sia corretta
                    if (file.name.toLowerCase().endsWith('.csv')) {
                        const result = e.target.result;
                        parseCSV(result);
                        resolve(flightData);
                    } else {
                        // Per altri tipi di file
                        try {
                            // Prova a interpretarlo come JSON
                            const jsonData = JSON.parse(e.target.result);
                            flightData = Array.isArray(jsonData) ? jsonData : [jsonData];
                            currentIndex = 0;
                            
                            // Notifica l'evento di caricamento dati
                            notifyEvent('fileLoaded', { 
                                recordCount: flightData.length,
                                columns: Object.keys(flightData[0] || {})
                            });
                            
                            resolve(flightData);
                        } catch (jsonError) {
                            // Se non è JSON, prova con CSV come fallback
                            parseCSV(e.target.result);
                            resolve(flightData);
                        }
                    }
                } catch (error) {
                    console.error("Errore nel caricamento del file:", error);
                    reject(error);
                }
            };
            
            reader.onerror = function(error) {
                console.error("Errore nella lettura del file:", error);
                reject(error);
            };
            
            // Leggi il file come testo
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
        // Debug originale
        console.log("Primi 200 caratteri del CSV:", text.substring(0, 200));
        
        // Non eseguire la sostituzione delle virgole qui, lasciamo che PapaParse gestisca correttamente
        
        // Configurazione per PapaParse
        const parseConfig = {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
            delimiter: ",", // Assicurati che il separatore di campo sia la virgola
            // La funzione di transform è fondamentale per convertire i valori correttamente
            transform: function(value, field) {
                // Se è una stringa che sembra un numero
                if (typeof value === 'string') {
                    // Se contiene una virgola come separatore decimale, sostituiscila con un punto
                    if (/^-?\d+,\d+$/.test(value)) {
                        return parseFloat(value.replace(',', '.'));
                    }
                    // Se è già un numero con punto come separatore decimale
                    else if (/^-?\d+\.\d+$/.test(value)) {
                        return parseFloat(value);
                    }
                    // Se è un numero intero
                    else if (/^-?\d+$/.test(value)) {
                        return parseInt(value, 10);
                    }
                }
                return value;
            },
            // Funzione di errore personalizzata
            error: function(error, file) {
                console.error("Errore di parsing CSV:", error, file);
            }
        };
        
        // Utilizza PapaParse per l'analisi
        const parsedData = Papa.parse(text, parseConfig);
        
        // Log dettagliato degli errori
        if (parsedData.errors && parsedData.errors.length > 0) {
            console.warn('Errori nel parsing CSV:', parsedData.errors);
            parsedData.errors.forEach((error, index) => {
                console.warn(`Errore ${index + 1}:`, error);
            });
        }
        
        // Debug: mostra i risultati del parsing
        console.log('Meta informazioni:', parsedData.meta);
        
        // Se non ci sono dati parsati, restituisci un errore
        if (!parsedData.data || parsedData.data.length === 0) {
            throw new Error("Nessun dato valido trovato nel file CSV");
        }
        
        // Debug: mostra i primi elementi dei dati parsati
        console.log('Numero di record CSV parsati:', parsedData.data.length);
        console.log('Primo record CSV parsato:', parsedData.data[0]);
        
        // Verifica dei quaternioni nel primo record
        const firstRecord = parsedData.data[0];
        const hasQuaternions = 'quatW' in firstRecord && 'quatX' in firstRecord && 
                            'quatY' in firstRecord && 'quatZ' in firstRecord;
        
        console.log('Il file CSV contiene quaternioni:', hasQuaternions);
        
        if (hasQuaternions) {
            console.log('Valori dei quaternioni:',
                {
                    qW: firstRecord.quatW,
                    qX: firstRecord.quatX,
                    qY: firstRecord.quatY,
                    qZ: firstRecord.quatZ
                }
            );
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
        
        // Debug del dataPoint in ingresso
        console.log("ConvertToStandardFormat - Input dataPoint:", JSON.stringify(dataPoint).substring(0, 100) + "...");
        
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
            quaternion: null
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
        }

        // Altitudine
        if ('altitude' in dataPoint) {
            standardData.sensors.altitude = safeParseFloat(dataPoint.altitude);
        } else if ('Altezza_telemetria' in dataPoint) {
            standardData.sensors.altitude = safeParseFloat(dataPoint.Altezza_telemetria);
        }

        // Temperatura
        if ('temperature' in dataPoint) {
            standardData.sensors.temperature = safeParseFloat(dataPoint.temperature);
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
        }

        // Stato del razzo
        if ('state' in dataPoint) {
            standardData.system.rocketState = dataPoint.state.toString();
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
        }

        // Debug per i quaternioni
        if (standardData.quaternion) {
            console.log("Quaternioni convertiti:", standardData.quaternion);
        }

        return standardData;
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