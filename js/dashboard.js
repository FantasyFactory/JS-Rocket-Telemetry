/**
 * dashboard.js
 * Gestisce l'interfaccia utente generale della dashboard
 */

const Dashboard = (function() {
    // Variabili private
    let activeTab = 'accel';
    let isLogExpanded = false;
    let isConnected = false;
    
    // Configurazione
    const config = {
        logMaxEntries: 100,
        updateInterval: 100 // ms
    };
    
    // Inizializza la dashboard
    function init() {
        // Inizializza la gestione delle tab
        initTabs();
        
        // Inizializza i controlli di log
        initLogPanel();
        
        // Inizializza i controlli del file
        initFileControls();
        
        // Inizializza i controlli del razzo
        initRocketControls();
        
        // Inizializza i controlli dei sensori
        initSensorControls();
        
        // Inizializza i controlli della timeline
        initTimelineControls();
        
        // Aggiungi gestione eventi generali
        initGeneralEventHandlers();

        // Inizializza i tooltip per gli algoritmi
        setupAlgorithmTooltips();
        
        // Aggiorna lo stato iniziale dell'interfaccia
        updateUIState();
        
        console.log('Dashboard inizializzata');
    }
    
    // Inizializza la gestione delle tab
    function initTabs() {
        const tabs = ['accel', 'gyro', 'orient', 'alt'];
        
        tabs.forEach(tab => {
            const button = document.getElementById(`${tab}Btn`);
            if (button) {
                button.addEventListener('click', () => {
                    setActiveTab(tab);
                });
            }
        });
    }
    
    // Imposta la tab attiva
    function setActiveTab(tab) {
        // Rimuovi la classe active da tutti i bottoni
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Rimuovi la classe active da tutti i container
        document.querySelectorAll('.chart-container').forEach(container => {
            container.classList.remove('active');
        });
        
        // Aggiungi la classe active al bottone e container selezionati
        const button = document.getElementById(`${tab}Btn`);
        const container = document.getElementById(`${tab}-chart`);
        
        if (button) button.classList.add('active');
        if (container) container.classList.add('active');
        
        activeTab = tab;
    }
    
    // Inizializza il pannello di log
    function initLogPanel() {
        const toggleBtn = document.getElementById('toggleLogBtn');
        const clearBtn = document.getElementById('clearLogBtn');
        const logPanel = document.getElementById('logPanel');
        
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                isLogExpanded = !isLogExpanded;
                logPanel.classList.toggle('expanded', isLogExpanded);
                toggleBtn.textContent = isLogExpanded ? 'Nascondi' : 'Mostra';
            });
        }
        
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                clearLog();
            });
        }
    }
    
    // Inizializza i controlli del file
    function initFileControls() {
        const fileInput = document.getElementById('fileInput');
        const loadFileBtn = document.getElementById('loadFileBtn');
        
        if (fileInput && loadFileBtn) {
            loadFileBtn.addEventListener('click', () => {
                fileInput.click();
            });
            
            fileInput.addEventListener('change', (event) => {
                const file = event.target.files[0];
                if (file) {
                    handleFileUpload(file);
                }
            });
        }
    }
    
    // Gestisce l'upload del file
    function handleFileUpload(file) {
        logMessage(`Caricamento del file: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
        
        // Utilizza DataReader per caricare il file
        DataReader.loadFromFile(file)
            .then(data => {
                if (data && data.length > 0) {
                    logMessage(`File caricato con successo. ${data.length} record trovati.`);
                    DataReader.setDataSource('file');
                    
                    // Aggiorna l'interfaccia
                    updateUIState();
                    
                    // Mostra il primo punto dati
                    if (data.length > 0) {
                        DataReader.seek(0);
                    }
                } else {
                    logMessage(`File caricato ma non contiene dati validi.`, 'error');
                }
            })
            .catch(error => {
                logMessage(`Errore nel caricamento del file: ${error.message}`, 'error');
                console.error("Dettaglio errore:", error);
            });
    }
    
    // Inizializza i controlli del razzo
    function initRocketControls() {
        const commandButtons = {
            'parachuteReleaseBtn': 'release',
            'parachuteLockBtn': 'lock',
            'startLogBtn': 'startlog',
            'stopLogBtn': 'stoplog',
            'calibrateBtn': 'calibrate',
            'goBtn': 'go',
            'rebootBtn': 'reboot'
        };
        
        // Aggiungi event listener per ogni pulsante
        Object.entries(commandButtons).forEach(([btnId, command]) => {
            const button = document.getElementById(btnId);
            if (button) {
                button.addEventListener('click', () => {
                    sendRocketCommand(command);
                });
            }
        });
        
        // Listener per il cambio modalità
        const dataSourceSelect = document.getElementById('dataSource');
        if (dataSourceSelect) {
            dataSourceSelect.addEventListener('change', () => {
                const mode = dataSourceSelect.value;
                setDataSource(mode);
            });
        }
        
        // Listener per il pulsante connetti
        const connectBtn = document.getElementById('connectBtn');
        if (connectBtn) {
            connectBtn.addEventListener('click', () => {
                if (isConnected) {
                    stopDataAcquisition();
                } else {
                    startDataAcquisition();
                }
            });
        }

        // Listener per il pulsante di reset del dataset
        const resetDataBtn = document.getElementById('resetDataBtn');
        if (resetDataBtn) {
            resetDataBtn.addEventListener('click', () => {
                if (confirm('Sei sicuro di voler resettare il dataset? Tutti i dati non salvati verranno persi.')) {
                    DataReader.resetDataset();
                    logMessage('Dataset resettato');
                }
            });
        }
        
        // Listener per il pulsante di salvataggio del dataset
        const saveDataBtn = document.getElementById('saveDataBtn');
        if (saveDataBtn) {
            saveDataBtn.addEventListener('click', () => {
                const result = DataReader.saveCurrentDataset();
                if (result) {
                    logMessage('Dataset salvato su file');
                } else {
                    logMessage('Nessun dato da salvare', 'error');
                }
            });
        }
        
        // Listener per il cambio modalità quaternioni
        const quaternionViewMode = document.getElementById('quaternionViewMode');
        if (quaternionViewMode) {
            quaternionViewMode.addEventListener('change', () => {
                const useReceivedQuaternions = quaternionViewMode.value === 'received';
                DataProcessor.setUseQuaternion(useReceivedQuaternions);
                logMessage(`Modalità quaternioni impostata a: ${useReceivedQuaternions ? 'Ricevuti' : 'Calcolati'}`);
            });
            
            // Imposta il valore iniziale in base all'impostazione in DataProcessor
            quaternionViewMode.value = DataProcessor.useQuaternion ? 'received' : 'calculated';
        }
    }
    
    // Invia un comando al razzo
    function sendRocketCommand(command) {
        logMessage(`Invio comando: ${command}`);
        
        DataReader.sendCommand(command)
            .then(response => {
                logMessage(`Risposta al comando ${command}: ${JSON.stringify(response)}`);
            })
            .catch(error => {
                logMessage(`Errore nell'invio del comando ${command}: ${error.message}`, 'error');
            });
    }
    
    // Inizializza i controlli dei sensori
    function initSensorControls() {
        const gyroRange = document.getElementById('gyroRange');
        const accelRange = document.getElementById('accelRange');
        const orientationSource = document.getElementById('orientationSource');
        const orientationAlgorithm = document.getElementById('orientationAlgorithm');
        
        if (gyroRange) {
            gyroRange.addEventListener('change', () => {
                const value = gyroRange.value;
                DataReader.setGyroRange(value)
                    .then(() => {
                        logMessage(`Range giroscopio impostato a ${value} dps`);
                    })
                    .catch(error => {
                        logMessage(`Errore nell'impostazione del range del giroscopio: ${error.message}`, 'error');
                    });
            });
        }
        
        if (accelRange) {
            accelRange.addEventListener('change', () => {
                const value = accelRange.value;
                DataReader.setAccelRange(value)
                    .then(() => {
                        logMessage(`Range accelerometro impostato a ${value}g`);
                    })
                    .catch(error => {
                        logMessage(`Errore nell'impostazione del range dell'accelerometro: ${error.message}`, 'error');
                    });
            });
        }
        
        if (orientationSource) {
            // All'inizializzazione, imposta useQuaternion a false per default
            DataProcessor.setUseQuaternion(false);
            
            orientationSource.addEventListener('change', () => {
                const useQuaternion = orientationSource.value === 'quaternion';
                DataProcessor.setUseQuaternion(useQuaternion);
                
                const sourceText = useQuaternion ? 'quaternioni del razzo' : 'calcolo software';
                logMessage(`Fonte orientamento impostata a: ${sourceText}`);
                updateOrientationControlsState();
            });
            
            // Imposta il valore iniziale in base all'impostazione in DataProcessor
            orientationSource.value = DataProcessor.useQuaternion ? 'quaternion' : 'software';
            updateOrientationControlsState();
        }

        if (orientationAlgorithm) {
            // Imposta il valore iniziale in base all'algoritmo attualmente utilizzato
            orientationAlgorithm.value = DataProcessor.filterType;
            
            orientationAlgorithm.addEventListener('change', () => {
                const algorithmType = orientationAlgorithm.value;
                
                // Imposta il nuovo tipo di filtro nel DataProcessor
                DataProcessor.setFilterType(algorithmType);
                
                logMessage(`Algoritmo di orientamento impostato a: ${algorithmType}`);
                
                // Disabilita il controllo se viene selezionata la fonte "quaternion"
                updateOrientationControlsState();
            });
        }
    }
    
    // Inizializza i controlli della timeline
    function initTimelineControls() {
        const timeSlider = document.getElementById('timeSlider');
        const playBtn = document.getElementById('playBtn');
        const timeDisplay = document.getElementById('timeDisplay');
        
        if (timeSlider) {
            timeSlider.addEventListener('input', () => {
                const index = parseInt(timeSlider.value);
                DataReader.seek(index);
                updateTimeDisplay(index);
            });
        }
        
        if (playBtn) {
            playBtn.addEventListener('click', () => {
                if (DataReader.isPlaying) {
                    DataReader.pausePlayback();
                    playBtn.innerHTML = '<span class="icon">▶</span>';
                } else {
                    DataReader.resumePlayback();
                    playBtn.innerHTML = '<span class="icon">⏸</span>';
                }
            });
        }
    }
    
    // Aggiorna il display del tempo
    // Modificata per usare il timestamp effettivo
    function updateTimeDisplay(index) {
        const timeDisplay = document.getElementById('timeDisplay');
        if (!timeDisplay) return;
        
        if (DataReader.telemetryDataset.data.length === 0) {
            timeDisplay.textContent = '00:00:00';
            return;
        }
        
        // Calcola il tempo reale basandosi sui timestamp
        const startTime = DataReader.telemetryDataset.metadata.startTime;
        const currentTime = DataReader.telemetryDataset.data[index].timestamp;
        const totalMilliseconds = currentTime - startTime;
        
        const seconds = Math.floor(totalMilliseconds / 1000) % 60;
        const minutes = Math.floor(totalMilliseconds / (1000 * 60)) % 60;
        const hours = Math.floor(totalMilliseconds / (1000 * 60 * 60));
        
        timeDisplay.textContent = 
            `${hours.toString().padStart(2, '0')}:` +
            `${minutes.toString().padStart(2, '0')}:` +
            `${seconds.toString().padStart(2, '0')}`;
        
        // Evidenzia il punto corrispondente nei grafici
        TelemetryCharts.highlightPoint('accel', index);
        TelemetryCharts.highlightPoint('gyro', index);
        TelemetryCharts.highlightPoint('orientation', index);
        TelemetryCharts.highlightPoint('altitude', index);
    }
    
    // Inizializza i gestori di eventi generali
    function initGeneralEventHandlers() {
        // Gestione eventi dalla finestra
        window.addEventListener('resize', () => {
            TelemetryCharts.resize();
        });
        
        // Ascolta gli eventi di dataset
        window.addEventListener('telemetryEvent', (event) => {
            handleTelemetryEvent(event.detail);

            const eventDetail = event.detail;
            const { type, data } = eventDetail;
            
            switch (type) {
                case 'datasetReset':
                    TelemetryCharts.clear();
                    updateDatasetInfo();
                    break;
                    
                case 'fileLoaded':
                    // Carica i dati dai grafici dal dataset completo
                    TelemetryCharts.loadFromDataset(DataReader.telemetryDataset);
                    updateDatasetInfo();
                    break;
                    
                case 'stats':
                    updateDatasetInfo();
                    break;
                    
                case 'orientationRecalculated':
                    // Ricarica i dati di orientamento nei grafici
                    if (charts.orientation) {
                        TelemetryCharts.setData('orientation', [
                            DataReader.telemetryDataset.getDataSeries('orientation', 0),
                            DataReader.telemetryDataset.getDataSeries('orientation', 1),
                            DataReader.telemetryDataset.getDataSeries('orientation', 2)
                        ]);
                    }
                    break;
                default:
                    // Non gestire altri eventi
                    break;
            }
        });
        
        // Aggiungi un listener di dati al DataReader
        DataReader.addDataListener(handleDataUpdate);
    }
    
    // Gestisce gli eventi di telemetria
    function handleTelemetryEvent(eventDetail) {
        const { type, timestamp, data } = eventDetail;
        
        switch (type) {
            case 'connection':
                handleConnectionEvent(data);
                break;
                
            case 'playback':
                handlePlaybackEvent(data);
                break;
                
            case 'fileLoaded':
                handleFileLoadedEvent(data);
                break;
                
            case 'command':
                // Già gestito tramite logMessage
                break;
                
            case 'error':
                // Già gestito tramite logMessage
                break;
                
            case 'status':
                updateStatusDisplay(data);
                break;
                
            case 'files':
                // Se vuoi fare qualcosa di specifico con l'elenco dei file
                break;
                
            case 'sensorConfig':
                // Già gestito tramite logMessage
                break;
        }
    }
    
    // Gestisce gli eventi di connessione
    function handleConnectionEvent(data) {
        isConnected = data.status === 'connected';
        updateConnectionStatus(isConnected);
    }
    
    // Gestisce gli eventi di playback
    function handlePlaybackEvent(data) {
        const { status, currentIndex, totalPoints } = data;
        
        // Aggiorna il timeSlider
        const timeSlider = document.getElementById('timeSlider');
        if (timeSlider) {
            timeSlider.value = currentIndex || 0;
            if (totalPoints !== undefined) {
                timeSlider.max = totalPoints - 1;
            }
        }
        
        // Aggiorna il pulsante play/pause
        const playBtn = document.getElementById('playBtn');
        if (playBtn) {
            playBtn.innerHTML = status === 'playing' ? 
                '<span class="icon">⏸</span>' : 
                '<span class="icon">▶</span>';
        }
        
        // Aggiorna il display del tempo
        updateTimeDisplay(currentIndex || 0);
    }
    
    // Gestisce gli eventi di caricamento file
    function handleFileLoadedEvent(data) {
        const { recordCount, columns } = data;
        
        // Aggiorna il timeSlider
        const timeSlider = document.getElementById('timeSlider');
        if (timeSlider) {
            timeSlider.max = recordCount - 1;
            timeSlider.value = 0;
        }
        
        // Aggiorna il display del tempo
        updateTimeDisplay(0);
        
        // Aggiorna il pulsante play
        const playBtn = document.getElementById('playBtn');
        if (playBtn) {
            playBtn.innerHTML = '<span class="icon">▶</span>';
            playBtn.disabled = recordCount === 0;
        }
    }
    
    /**
     * Gestisce gli aggiornamenti di dati
     * @param {Object} data - Dati ricevuti
     */
    function handleDataUpdate(data) {
        // Verifica che i dati siano validi
        if (!data) {
            console.error("handleDataUpdate: dati mancanti");
            return;
        }
        
        // Debug: verifica la struttura dei dati ricevuti
        console.log("Dati ricevuti in handleDataUpdate:", data);
        
        try {
            // Processa i dati con DataProcessor
            const processedData = DataProcessor.processData(data);
            console.log("Dati processati:", processedData);
            
            // Assicuriamoci che processedData contenga anche i dati dei sensori originali
            if (!processedData.sensors && data.sensors) {
                console.log("Copio sensors dai dati originali ai dati processati");
                processedData.sensors = data.sensors;
            }
            
            // Verifica che l'orientamento sia stato calcolato correttamente
            if (!processedData.orientation) {
                console.error("Orientamento mancante nei dati processati");
                processedData.orientation = { x: 0, y: 0, z: 0 };
            }
            
            // Aggiorna RocketRenderer con l'orientamento e i dati dell'accelerometro e giroscopio
            RocketRenderer.update(
                processedData.orientation,
                processedData.sensors.accel,
                processedData.sensors.gyro
            );
            
            // Aggiorna ForceRenderer con i dati dell'accelerometro
            ForceRenderer.draw(processedData.sensors.accel);
            
            // Aggiorna i grafici
            TelemetryCharts.update(processedData);
            
            // Aggiorna i gauge e altri indicatori
            updateGauges(processedData);

            // Aggiorna le informazioni sul dataset
            updateDatasetInfo();
        } catch (error) {
            console.error("Errore in handleDataUpdate:", error);
        }
    }
    
    // Aggiorna le informazioni sul dataset
    function updateDatasetInfo() {
        const datasetSize = document.getElementById('datasetSize');
        const samplingRate = document.getElementById('samplingRate');
        
        if (datasetSize && DataReader.telemetryDataset) {
            datasetSize.textContent = `${DataReader.telemetryDataset.data.length} punti`;
        }
        
        if (samplingRate && DataReader.telemetryDataset && DataReader.telemetryDataset.metadata) {
            const rates = DataReader.telemetryDataset.metadata.samplingRates;
            if (rates && rates.avg) {
                samplingRate.textContent = `Campionamento: media ${(rates.avg * 1000).toFixed(1)} ms (min: ${(rates.min * 1000).toFixed(1)}, max: ${(rates.max * 1000).toFixed(1)})`;
            } else {
                samplingRate.textContent = 'Campionamento: -- ms';
            }
        }
    }

    /**
     * Aggiorna i gauge con i dati
     * @param {Object} data - Dati da visualizzare
     */
    function updateGauges(data) {
        if (!data) {
            console.error("updateGauges: dati mancanti");
            return;
        }
        
        console.log("Aggiornamento gauge con dati:", data);
        
        try {
            // Verifica che i dati dei sensori siano presenti
            if (!data.sensors) {
                console.error("updateGauges: dati sensori mancanti");
                return;
            }
            
            // Aggiorna il gauge dell'altitudine
            if (typeof data.sensors.altitude === 'number') {
                const altitudeValue = document.querySelector('#altitude-gauge .gauge-value');
                if (altitudeValue) {
                    altitudeValue.textContent = `${data.sensors.altitude.toFixed(1)} m`;
                }
                
                // Aggiorna anche il valore del gauge usando l'API di Gauges
                if (typeof Gauges !== 'undefined' && typeof Gauges.setValue === 'function') {
                    Gauges.setValue('altitude-gauge', data.sensors.altitude);
                }
            }
            
            // Aggiorna la velocità (se disponibile)
            if (data.simulation && typeof data.simulation.velocity === 'number') {
                const velocityValue = document.querySelector('#velocity-gauge .gauge-value');
                if (velocityValue) {
                    velocityValue.textContent = `${data.simulation.velocity.toFixed(1)} m/s`;
                }
                
                // Aggiorna anche il valore del gauge
                if (typeof Gauges !== 'undefined' && typeof Gauges.setValue === 'function') {
                    Gauges.setValue('velocity-gauge', data.simulation.velocity);
                }
            }
            
            // Aggiorna la batteria
            if (data.system && typeof data.system.battery_voltage === 'number') {
                const batteryValue = document.querySelector('#battery-gauge .gauge-value');
                if (batteryValue) {
                    batteryValue.textContent = `${data.system.battery_voltage.toFixed(2)} V`;
                }
                
                // Aggiorna anche il valore del gauge
                if (typeof Gauges !== 'undefined' && typeof Gauges.setValue === 'function') {
                    Gauges.setValue('battery-gauge', data.system.battery_voltage);
                }
            }
            
            // Aggiorna la temperatura
            if (typeof data.sensors.temperature === 'number') {
                const temperatureValue = document.querySelector('#temperature-gauge .gauge-value');
                if (temperatureValue) {
                    temperatureValue.textContent = `${data.sensors.temperature.toFixed(1)} °C`;
                }
                
                // Aggiorna anche il valore del gauge
                if (typeof Gauges !== 'undefined' && typeof Gauges.setValue === 'function') {
                    Gauges.setValue('temperature-gauge', data.sensors.temperature);
                }
            }
        } catch (error) {
            console.error("Errore in updateGauges:", error);
        }
    }
    
    // Aggiorna lo stato della connessione nell'UI
    function updateConnectionStatus(connected) {
        const statusIndicator = document.getElementById('connectionStatus');
        const connectBtn = document.getElementById('connectBtn');
        
        if (statusIndicator) {
            statusIndicator.textContent = connected ? 'Connesso' : 'Disconnesso';
            statusIndicator.classList.toggle('connected', connected);
        }
        
        if (connectBtn) {
            connectBtn.textContent = connected ? 'Disconnetti' : 'Connetti';
            connectBtn.classList.toggle('primary', !connected);
        }
        
        // Aggiorna anche lo stato globale
        isConnected = connected;
    }
    
// Aggiorna lo stato dell'interfaccia utente
function updateUIState() {
    const dataSource = DataReader.dataSource;
    const isPlayback = dataSource === 'file';
    
    // Attiva/disattiva controlli basati sulla sorgente dati
    document.querySelectorAll('.rocket-controls button').forEach(btn => {
        btn.disabled = isPlayback;
    });
    
    // Mantieni attivi alcuni controlli selezionati anche in modalità file
    document.querySelectorAll('.sensor-controls select').forEach(select => {
        // Se è il selettore per l'algoritmo di orientamento o fonte di orientamento, non disabilitarlo
        if (select.id === 'orientationAlgorithm' || select.id === 'orientationSource') {
            // Non disabilitare questi controlli
            select.disabled = false;
        } else {
            // Disabilita gli altri controlli dei sensori
            select.disabled = isPlayback;
        }
    });
    
    // Aggiorna il selettore della sorgente dati
    const dataSourceSelect = document.getElementById('dataSource');
    if (dataSourceSelect) {
        dataSourceSelect.value = dataSource;
    }
    
    // Aggiorna controlli timeline
    const timeSlider = document.getElementById('timeSlider');
    const playBtn = document.getElementById('playBtn');
    
    if (timeSlider) {
        timeSlider.disabled = !isPlayback || DataReader.totalPoints === 0;
    }
    
    if (playBtn) {
        playBtn.disabled = !isPlayback || DataReader.totalPoints === 0;
    }
    
    // Aggiorna lo stato dei controlli dell'orientamento
    updateOrientationControlsState();
}

    // Aggiorna lo stato dei controlli dell'orientamento
    function updateOrientationControlsState() {
        const orientationSource = document.getElementById('orientationSource');
        const orientationAlgorithm = document.getElementById('orientationAlgorithm');
        
        if (!orientationSource || !orientationAlgorithm) return;
        
        const useQuaternion = orientationSource.value === 'quaternion';
        
        // Disabilita la selezione dell'algoritmo se vengono usati i quaternioni dal razzo
        orientationAlgorithm.disabled = useQuaternion;
        
        // Aggiorna visualmente lo stato (opzionale)
        if (useQuaternion) {
            orientationAlgorithm.classList.add('disabled');
        } else {
            orientationAlgorithm.classList.remove('disabled');
        }
    }
    
    // Imposta la sorgente dati
    function setDataSource(source) {
        // Ferma prima l'acquisizione corrente
        stopDataAcquisition();
        
        // Salva le impostazioni correnti di orientamento per ripristinarle dopo
        const currentUseQuaternion = DataProcessor.useQuaternion;
        const currentFilterType = DataProcessor.filterType;
        
        // Imposta la nuova sorgente
        DataReader.setDataSource(source);
        
        // Resetta il DataProcessor ma mantieni le impostazioni precedenti
        DataProcessor.reset()
                    .setUseQuaternion(currentUseQuaternion)
                    .setFilterType(currentFilterType);
        
        // Aggiorna l'interfaccia
        updateUIState();
        
        // Aggiorna anche i controlli di orientamento
        const orientationSource = document.getElementById('orientationSource');
        const orientationAlgorithm = document.getElementById('orientationAlgorithm');
        
        if (orientationSource) {
            orientationSource.value = currentUseQuaternion ? 'quaternion' : 'software';
        }
        
        if (orientationAlgorithm) {
            orientationAlgorithm.value = currentFilterType;
        }
        
        updateOrientationControlsState();
        
        logMessage(`Modalità cambiata a: ${source}`);
    }
    
    // Avvia l'acquisizione dati
    function startDataAcquisition() {
        DataReader.start();
        updateConnectionStatus(true);
        logMessage('Acquisizione dati avviata');
    }
    
    // Ferma l'acquisizione dati
    function stopDataAcquisition() {
        DataReader.stop();
        updateConnectionStatus(false);
        logMessage('Acquisizione dati fermata');
    }
    
    // Funzioni per il log
    function logMessage(message, type = 'info') {
        const logContent = document.getElementById('logContent');
        if (!logContent) return;
        
        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;
        
        const timestamp = new Date().toLocaleTimeString();
        entry.innerHTML = `<span class="log-time">[${timestamp}]</span> ${message}`;
        
        logContent.appendChild(entry);
        
        // Scorrimento automatico al fondo
        logContent.scrollTop = logContent.scrollHeight;
        
        // Limita il numero di voci
        while (logContent.children.length > config.logMaxEntries) {
            logContent.removeChild(logContent.firstChild);
        }
    }
    
    // Pulisce il log
    function clearLog() {
        const logContent = document.getElementById('logContent');
        if (logContent) {
            logContent.innerHTML = '';
        }
    }
    
    // Metodi pubblici
    return {
        init,
        logMessage,
        setActiveTab,
        startDataAcquisition,
        stopDataAcquisition
    };
})();


// Funzione per aggiungere tooltip dinamici che mostrano info specifiche
function setupAlgorithmTooltips() {
    const algorithmSelect = document.getElementById('orientationAlgorithm');
    const tooltips = {
        'complementary': 'Algoritmo semplice che combina accelerometro e giroscopio con un filtro passa-basso. Leggero ma meno preciso con movimenti rapidi.',
        'kalman': 'Filtro statistico che stima lo stato del sistema in base a misurazioni rumorose. Offre un buon compromesso tra velocità e precisione.',
        'madgwick': 'Algoritmo avanzato che usa quaternioni. Offre la migliore precisione, specialmente durante movimenti rapidi, ed è identico a quello usato nel razzo.'
    };
    
    if (algorithmSelect) {
        const tooltip = document.querySelector('label[for="orientationAlgorithm"] .tooltiptext');
        if (tooltip) {
            algorithmSelect.addEventListener('change', () => {
                const algorithm = algorithmSelect.value;
                if (tooltips[algorithm]) {
                    tooltip.textContent = tooltips[algorithm];
                }
            });
            
            // Imposta il tooltip iniziale
            const initialAlgorithm = algorithmSelect.value;
            if (tooltips[initialAlgorithm]) {
                tooltip.textContent = tooltips[initialAlgorithm];
            }
        }
    }
}
