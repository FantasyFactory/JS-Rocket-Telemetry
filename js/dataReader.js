/**
 * dataReader.js (Modificato)
 * Gestisce la lettura dei dati telemetrici da file e WebSocket
 * utilizzando la nuova classe TelemetryDataset
 */

const DataReader = (function() {
    // Variabili private
    let dataSource = 'realtime'; // 'realtime' o 'file'
    let baseUrl = 'http://192.168.4.1';
    let wsConnection = null;
    let isPlaying = false;
    let playInterval = null;
    let playbackSpeed = 1; // Velocità di riproduzione
    let listeners = []; // Array di callback per notificare i dati
    
    // Nuovo oggetto dataset per mantenere i dati in memoria
    let telemetryDataset = new TelemetryDataset();
    
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
        } else if (dataSource === 'file' && telemetryDataset.data.length > 0) {
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
        pausePlayback();
        
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
        // Aggiungi il nuovo punto dati al dataset
        const processedData = telemetryDataset.addDataPoint(data);
        
        // Imposta l'indice corrente all'ultimo punto
        telemetryDataset.currentIndex = telemetryDataset.data.length - 1;
        
        // Notifica i dati a tutti i listener
        notifyListeners(processedData);
        
        // Notifica statistiche aggiornate
        notifyEvent('stats', telemetryDataset.getStatistics());
    }
    
    // Carica dati da file CSV o TXT
    function loadFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                try {
                    console.log("File caricato, dimensione:", e.target.result.length, "bytes");
                    console.log("Tipo di file:", file.type);
                    
                    let success = false;
                    
                    // Per file CSV, direttamente usa il metodo di importazione CSV
                    if (file.name.toLowerCase().endsWith('.csv')) {
                        success = telemetryDataset.loadFromCsv(e.target.result);
                    } else {
                        // Per altri tipi di file
                        try {
                            // Prova a interpretarlo come JSON
                            const jsonData = JSON.parse(e.target.result);
                            success = telemetryDataset.loadFromArray(
                                Array.isArray(jsonData) ? jsonData : [jsonData]
                            );
                        } catch (jsonError) {
                            // Se non è JSON, prova con CSV come fallback
                            success = telemetryDataset.loadFromCsv(e.target.result);
                        }
                    }
                    
                    if (success) {
                        // Ricalcola l'orientamento per tutto il dataset
                        telemetryDataset.recalculateOrientation(
                            DataProcessor.filterType,
                            DataProcessor.useQuaternion
                        );
                        
                        // Posiziona l'indice all'inizio
                        telemetryDataset.currentIndex = 0;
                        
                        // Notifica l'evento di caricamento dati
                        notifyEvent('fileLoaded', { 
                            recordCount: telemetryDataset.data.length,
                            statistics: telemetryDataset.getStatistics()
                        });
                        
                        // Invia il primo punto per visualizzazione
                        if (telemetryDataset.data.length > 0) {
                            notifyListeners(telemetryDataset.getCurrentData());
                        }
                        
                        resolve(telemetryDataset.data);
                    } else {
                        reject(new Error("Formato file non supportato o dati invalidi"));
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
    
    // Avvia la riproduzione dei dati da file
    function startPlayback() {
        if (telemetryDataset.data.length === 0) return;
        
        isPlaying = true;
        
        // Notifica l'evento di avvio riproduzione
        notifyEvent('playback', { 
            status: 'started', 
            currentIndex: telemetryDataset.currentIndex 
        });
        
        // Intervallo di riproduzione
        playInterval = setInterval(() => {
            if (telemetryDataset.currentIndex >= telemetryDataset.data.length - 1) {
                // Fine dei dati, ferma la riproduzione
                pausePlayback();
                notifyEvent('playback', { status: 'ended' });
                return;
            }
            
            // Avanza all'indice successivo
            telemetryDataset.currentIndex++;
            
            // Ottieni il punto dati corrente
            const dataPoint = telemetryDataset.getCurrentData();
            
            // Notifica i listener
            notifyListeners(dataPoint);
            
            // Notifica l'evento di aggiornamento indice
            notifyEvent('playback', { 
                status: 'playing',
                currentIndex: telemetryDataset.currentIndex,
                totalPoints: telemetryDataset.data.length
            });
            
            // Utilizza deltaTime per calcolare il tempo di attesa per il prossimo punto
            // Questo garantisce una riproduzione con timing più preciso
            if (telemetryDataset.currentIndex < telemetryDataset.data.length - 1) {
                const currentTimestamp = telemetryDataset.data[telemetryDataset.currentIndex].timestamp;
                const nextTimestamp = telemetryDataset.data[telemetryDataset.currentIndex + 1].timestamp;
                const delay = (nextTimestamp - currentTimestamp) / playbackSpeed;
                
                // Aggiusta l'intervallo per il prossimo punto
                clearInterval(playInterval);
                playInterval = setTimeout(playNextPoint, delay);
            }
        }, 100 / playbackSpeed); // Intervallo iniziale (sarà regolato dinamicamente)
    }
    
    // Funzione per riprodurre il punto successivo
    function playNextPoint() {
        if (!isPlaying || telemetryDataset.currentIndex >= telemetryDataset.data.length - 1) {
            return;
        }
        
        // Avanza all'indice successivo
        telemetryDataset.currentIndex++;
        
        // Ottieni il punto dati corrente
        const dataPoint = telemetryDataset.getCurrentData();
        
        // Notifica i listener
        notifyListeners(dataPoint);
        
        // Notifica l'evento di aggiornamento indice
        notifyEvent('playback', { 
            status: 'playing',
            currentIndex: telemetryDataset.currentIndex,
            totalPoints: telemetryDataset.data.length
        });
        
        // Calcola il ritardo per il prossimo punto
        if (telemetryDataset.currentIndex < telemetryDataset.data.length - 1) {
            const currentTimestamp = telemetryDataset.data[telemetryDataset.currentIndex].timestamp;
            const nextTimestamp = telemetryDataset.data[telemetryDataset.currentIndex + 1].timestamp;
            const delay = Math.max(10, (nextTimestamp - currentTimestamp) / playbackSpeed);
            
            // Pianifica il prossimo punto
            playInterval = setTimeout(playNextPoint, delay);
        } else {
            // Fine dei dati
            pausePlayback();
            notifyEvent('playback', { status: 'ended' });
        }
    }
    
    // Pausa la riproduzione
    function pausePlayback() {
        if (playInterval) {
            clearInterval(playInterval);
            clearTimeout(playInterval);
            playInterval = null;
            isPlaying = false;
            
            // Notifica l'evento di pausa
            notifyEvent('playback', { 
                status: 'paused', 
                currentIndex: telemetryDataset.currentIndex 
            });
        }
        
        return this;
    }
    
    // Riprende la riproduzione
    function resumePlayback() {
        if (!isPlaying && dataSource === 'file' && telemetryDataset.data.length > 0) {
            startPlayback();
        }
        
        return this;
    }
    
    // Imposta la posizione corrente della riproduzione
    function seek(index) {
        if (index >= 0 && index < telemetryDataset.data.length) {
            telemetryDataset.currentIndex = index;
            
            // Ottieni il punto dati corrente
            const dataPoint = telemetryDataset.getCurrentData();
            
            // Notifica i listener
            notifyListeners(dataPoint);
            
            // Notifica l'evento di seek
            notifyEvent('playback', { 
                status: isPlaying ? 'playing' : 'paused',
                currentIndex: telemetryDataset.currentIndex,
                totalPoints: telemetryDataset.data.length
            });
        }
        
        return this;
    }
    
    // Imposta la velocità di riproduzione
    function setPlaybackSpeed(speed) {
        playbackSpeed = speed;
        
        // Se la riproduzione è in corso, aggiorna l'intervallo
        if (isPlaying && playInterval) {
            pausePlayback();
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
    
    // Reset del dataset
    function resetDataset() {
        // Ferma la riproduzione o acquisizione
        stop();
        
        // Resetta il dataset
        telemetryDataset.reset();
        
        // Notifica il reset
        notifyEvent('datasetReset', {});
        
        return this;
    }
    
    // Salva il dataset corrente su file
    function saveCurrentDataset() {
        if (telemetryDataset.data.length === 0) {
            return null;
        }
        
        // Genera il CSV
        const csvContent = telemetryDataset.exportToCsv();
        
        // Crea un URL per il download
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        
        // Crea un elemento di download
        const a = document.createElement('a');
        a.href = url;
        
        // Crea un nome file basato sul timestamp
        const now = new Date();
        const dateStr = now.toISOString().replace(/[:.]/g, '-').substring(0, 19);
        a.download = `telemetry_${dateStr}.csv`;
        
        // Avvia il download
        document.body.appendChild(a);
        a.click();
        
        // Pulisci
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        
        return url;
    }
    
    // Ricalcola l'orientamento con nuove impostazioni
    function recalculateOrientation(filterType, useQuaternion) {
        if (telemetryDataset.data.length === 0) return;
        
        // Ricalcola l'orientamento per tutto il dataset
        telemetryDataset.recalculateOrientation(filterType, useQuaternion);
        
        // Notifica i listener con i dati correnti aggiornati
        notifyListeners(telemetryDataset.getCurrentData());
        
        // Notifica l'evento di ricalcolo
        notifyEvent('orientationRecalculated', {
            filterType,
            useQuaternion
        });
        
        return this;
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
        seek,
        pausePlayback,
        resumePlayback,
        setPlaybackSpeed,
        sendCommand,
        fetchImuData,
        resetDataset,
        saveCurrentDataset,
        recalculateOrientation,
        
        // Proprietà di sola lettura
        get isPlaying() { return isPlaying; },
        get currentIndex() { return telemetryDataset.currentIndex; },
        get totalPoints() { return telemetryDataset.data.length; },
        get dataSource() { return dataSource; },
        get telemetryDataset() { return telemetryDataset; }
    };
})();