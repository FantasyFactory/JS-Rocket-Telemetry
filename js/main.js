/**
 * main.js
 * Script principale che orchestra tutti i moduli dell'applicazione
 */

// Funzione principale avviata all'inizializzazione
function initApp() {
    console.log('Inizializzazione applicazione...');
    
    // Controlla se le librerie necessarie sono disponibili
    if (!checkDependencies()) {
        showErrorMessage('Librerie mancanti. Controlla la console per dettagli.');
        return;
    }
    
    // Inizializza RocketRenderer
    if (!RocketRenderer.init('rocket-view')) {
        showErrorMessage('Errore nell\'inizializzazione della visualizzazione 3D.');
        return;
    }
    
    // Inizializza ForceRenderer
    if (!ForceRenderer.init('force-view')) {
        showErrorMessage('Errore nell\'inizializzazione della visualizzazione delle forze.');
        return;
    }
    
    // Inizializza TelemetryCharts
    if (!initCharts()) {
        showErrorMessage('Errore nell\'inizializzazione dei grafici.');
        return;
    }

    // Inizializza i gauge
    Gauges.initDashboardGauges();
    
    // Configura DataProcessor
    DataProcessor.setFilterType('complementary')
                 .enableFilter(true);
    
    // Configura DataReader
    DataReader.setBaseUrl('http://192.168.4.1')
              .setDataSource('realtime')
              .addDataListener(handleDataUpdate);
    
    // Inizializza Dashboard
    Dashboard.init();
    
    // Applica tema scuro/chiaro in base alle preferenze utente
    applyTheme();
    
    console.log('Inizializzazione completata.');
    
    // Aggiungi event listener per tasto F11 (modalità fullscreen)
    window.addEventListener('keydown', (e) => {
        if (e.key === 'F11') {
            toggleFullscreen();
            e.preventDefault();
        }
    });
}

// Verifica che tutte le dipendenze siano caricate
function checkDependencies() {
    let missingDeps = [];
    
    if (typeof THREE === 'undefined') missingDeps.push('Three.js');
    if (typeof Chart === 'undefined') missingDeps.push('Chart.js');
    if (typeof Papa === 'undefined') missingDeps.push('PapaParse');
    
    if (missingDeps.length > 0) {
        console.error('Dipendenze mancanti:', missingDeps.join(', '));
        return false;
    }
    
    return true;
}

// Inizializza i grafici di telemetria
function initCharts() {
    try {
        // Ottieni i container dei grafici
        const containers = {
            accel: document.getElementById('accel-chart'),
            gyro: document.getElementById('gyro-chart'),
            orientation: document.getElementById('orient-chart'),
            altitude: document.getElementById('alt-chart')
        };
        
        // Verifica che tutti i container esistano
        for (const [key, container] of Object.entries(containers)) {
            if (!container) {
                console.error(`Container per il grafico ${key} non trovato.`);
                return false;
            }
            
            // Necessario per Chart.js: crea un canvas in ogni container
            const canvas = document.createElement('canvas');
            container.appendChild(canvas);
            containers[key] = canvas;
        }
        
        // Inizializza TelemetryCharts con i canvas appena creati
        return TelemetryCharts.init(containers);
    } catch (error) {
        console.error('Errore nell\'inizializzazione dei grafici:', error);
        return false;
    }
}

// Gestisce gli aggiornamenti dei dati
function handleDataUpdate(data) {
    // I dati verranno già elaborati da DataProcessor,
    // ma qui possiamo eseguire operazioni aggiuntive se necessario
    
    // Qui ad esempio possiamo mostrare statistiche di performance, aggiornamento UI, ecc.
    updateDataRate(data);
}

// Calcola e visualizza la velocità di trasferimento dati
let lastDataTimestamp = 0;
let dataRateAccumulator = 0;
let dataRateCounter = 0;

function updateDataRate(data) {
    const now = Date.now();
    const dataSize = JSON.stringify(data).length;
    
    if (lastDataTimestamp !== 0) {
        const elapsed = now - lastDataTimestamp;
        const bytesPerSecond = dataSize / (elapsed / 1000);
        
        // Accumula per una media mobile
        dataRateAccumulator += bytesPerSecond;
        dataRateCounter++;
        
        // Aggiorna l'UI ogni 5 pacchetti
        if (dataRateCounter >= 5) {
            const avgBytesPerSecond = dataRateAccumulator / dataRateCounter;
            displayDataRate(avgBytesPerSecond);
            
            // Reset accumulatore
            dataRateAccumulator = 0;
            dataRateCounter = 0;
        }
    }
    
    lastDataTimestamp = now;
}

// Visualizza la velocità di trasferimento dati
function displayDataRate(bytesPerSecond) {
    const dataRateElement = document.getElementById('dataRate');
    if (!dataRateElement) return;
    
    let displayText;
    
    if (bytesPerSecond < 1024) {
        displayText = `${bytesPerSecond.toFixed(1)} B/s`;
    } else if (bytesPerSecond < 1024 * 1024) {
        displayText = `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    } else {
        displayText = `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
    }
    
    dataRateElement.textContent = displayText;
}

// Visualizza un messaggio di errore
function showErrorMessage(message) {
    // Crea un elemento per il messaggio di errore
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
        <div class="error-icon">⚠️</div>
        <div class="error-text">${message}</div>
    `;
    
    // Aggiungi stili
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '50%';
    errorDiv.style.left = '50%';
    errorDiv.style.transform = 'translate(-50%, -50%)';
    errorDiv.style.backgroundColor = '#f44336';
    errorDiv.style.color = 'white';
    errorDiv.style.padding = '20px';
    errorDiv.style.borderRadius = '8px';
    errorDiv.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
    errorDiv.style.zIndex = '1000';
    errorDiv.style.display = 'flex';
    errorDiv.style.alignItems = 'center';
    errorDiv.style.gap = '10px';
    
    // Aggiungi al DOM
    document.body.appendChild(errorDiv);
    
    // Rimuovi dopo 5 secondi
    setTimeout(() => {
        if (errorDiv.parentElement) {
            errorDiv.parentElement.removeChild(errorDiv);
        }
    }, 5000);
}

// Modalità schermo intero
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error(`Errore nella richiesta di schermo intero: ${err.message}`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

// Applica il tema in base alle preferenze utente
function applyTheme() {
    // Controlla se il sistema preferisce il tema scuro
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (prefersDarkScheme) {
        document.body.classList.add('dark-theme');
    }
    
    // Ascolta per cambiamenti nelle preferenze
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        document.body.classList.toggle('dark-theme', e.matches);
    });
}

// Avvia l'applicazione quando il DOM è completamente caricato
document.addEventListener('DOMContentLoaded', initApp);