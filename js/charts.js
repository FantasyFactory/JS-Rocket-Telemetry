/**
 * charts.js
 * Gestisce i grafici per la visualizzazione dei dati telemetrici
 */

const TelemetryCharts = (function() {
    // Variabili private
    const charts = {};
    const maxDataPoints = 100; // Numero massimo di punti dati da visualizzare
    const colors = {
        accel: ['#FF4136', '#2ECC40', '#0074D9'], // RGB per XYZ
        gyro: ['#B10DC9', '#FFDC00', '#01FF70'],  // Magenta, Giallo, Ciano per XYZ
        orientation: ['#7FDBFF', '#FF851B', '#85144b'], // Azzurro, Arancione, Bordeaux per Roll, Pitch, Yaw
        altitude: ['#3D9970']  // Verde per l'altitudine
    };
    
    // Configurazioni base per i vari tipi di grafici
    const chartConfigs = {
        accel: {
            type: 'line',
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false, // Disabilita le animazioni per prestazioni migliori
                parsing: false, // Disabilita il parsing automatico per usare il formato {x, y}
                normalized: true, // Normalizza i dati
                plugins: {
                    title: {
                        display: true,
                        text: 'Accelerazione (g)',
                        font: { size: 16 }
                    },
                    legend: { position: 'top' },
                    tooltip: { mode: 'index', intersect: false }
                },
                scales: {
                    x: {
                        type: 'linear',
                        display: true,
                        title: { display: true, text: 'Tempo (s)' },
                        min: 0,
                        max: maxDataPoints,
                        ticks: { maxTicksLimit: 10 }
                    },
                    y: {
                        display: true,
                        title: { display: true, text: 'Accelerazione (g)' },
                        suggestedMin: -2,
                        suggestedMax: 2
                    }
                }
            },
            data: {
                datasets: [
                    { label: 'Accel X', data: [], borderColor: colors.accel[0], backgroundColor: 'transparent', borderWidth: 2 },
                    { label: 'Accel Y', data: [], borderColor: colors.accel[1], backgroundColor: 'transparent', borderWidth: 2 },
                    { label: 'Accel Z', data: [], borderColor: colors.accel[2], backgroundColor: 'transparent', borderWidth: 2 }
                ]
            }
        },
        
        gyro: {
            type: 'line',
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                parsing: false, // Disabilita il parsing automatico per usare il formato {x, y}
                normalized: true, // Normalizza i dati
                plugins: {
                    title: {
                        display: true,
                        text: 'Velocità Angolare (°/s)',
                        font: { size: 16 }
                    },
                    legend: { position: 'top' },
                    tooltip: { mode: 'index', intersect: false }
                },
                scales: {
                    x: {
                        type: 'linear',
                        display: true,
                        title: { display: true, text: 'Tempo (s)' },
                        min: 0,
                        max: maxDataPoints,
                        ticks: { maxTicksLimit: 10 }
                    },
                    y: {
                        display: true,
                        title: { display: true, text: 'Velocità (°/s)' },
                        suggestedMin: -180,
                        suggestedMax: 180
                    }
                }
            },
            data: {
                datasets: [
                    { label: 'Gyro X', data: [], borderColor: colors.gyro[0], backgroundColor: 'transparent', borderWidth: 2 },
                    { label: 'Gyro Y', data: [], borderColor: colors.gyro[1], backgroundColor: 'transparent', borderWidth: 2 },
                    { label: 'Gyro Z', data: [], borderColor: colors.gyro[2], backgroundColor: 'transparent', borderWidth: 2 }
                ]
            }
        },
        
        orientation: {
            type: 'line',
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                parsing: false, // Disabilita il parsing automatico per usare il formato {x, y}
                normalized: true, // Normalizza i dati
                plugins: {
                    title: {
                        display: true,
                        text: 'Orientamento (°)',
                        font: { size: 16 }
                    },
                    legend: { position: 'top' },
                    tooltip: { mode: 'index', intersect: false }
                },
                scales: {
                    x: {
                        type: 'linear',
                        display: true,
                        title: { display: true, text: 'Tempo (s)' },
                        min: 0,
                        max: maxDataPoints,
                        ticks: { maxTicksLimit: 10 }
                    },
                    y: {
                        display: true,
                        title: { display: true, text: 'Angolo (°)' },
                        suggestedMin: -180,
                        suggestedMax: 180
                    }
                }
            },
            data: {
                datasets: [
                    { label: 'Roll (X)', data: [], borderColor: colors.orientation[0], backgroundColor: 'transparent', borderWidth: 2 },
                    { label: 'Pitch (Y)', data: [], borderColor: colors.orientation[1], backgroundColor: 'transparent', borderWidth: 2 },
                    { label: 'Yaw (Z)', data: [], borderColor: colors.orientation[2], backgroundColor: 'transparent', borderWidth: 2 }
                ]
            }
        },
        
        altitude: {
            type: 'line',
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                parsing: false, // Disabilita il parsing automatico per usare il formato {x, y}
                normalized: true, // Normalizza i dati
                plugins: {
                    title: {
                        display: true,
                        text: 'Altitudine (m)',
                        font: { size: 16 }
                    },
                    legend: { position: 'top' },
                    tooltip: { mode: 'index', intersect: false }
                },
                scales: {
                    x: {
                        type: 'linear',
                        display: true,
                        title: { display: true, text: 'Tempo (s)' },
                        min: 0,
                        max: maxDataPoints,
                        ticks: { maxTicksLimit: 10 }
                    },
                    y: {
                        display: true,
                        title: { display: true, text: 'Altitudine (m)' },
                        suggestedMin: 0,
                        suggestedMax: 500
                    }
                }
            },
            data: {
                datasets: [
                    { 
                        label: 'Altitudine',
                        data: [],
                        borderColor: colors.altitude[0],
                        backgroundColor: 'rgba(61, 153, 112, 0.1)',
                        borderWidth: 2,
                        fill: true
                    }
                ]
            }
        }
    };
    
    // Inizializza tutti i grafici
    function init(containers) {
        // Verifica che Chart.js sia disponibile
        if (typeof Chart === 'undefined') {
            console.error('Chart.js non trovato. Assicurati di includere la libreria.');
            return false;
        }
        
        // Inizializza ogni grafico
        Object.keys(chartConfigs).forEach(type => {
            const container = containers[type];
            if (!container) {
                console.warn(`Container per il grafico ${type} non trovato.`);
                return;
            }
            
            const ctx = container.getContext('2d');
            const config = chartConfigs[type];
            
            charts[type] = new Chart(ctx, {
                type: config.type,
                data: JSON.parse(JSON.stringify(config.data)), // Deep clone
                options: JSON.parse(JSON.stringify(config.options)) // Deep clone
            });
        });
        
        return true;
    }
    
    // Aggiorna i grafici con nuovi dati
    function update(data, baseTimestamp) {
        if (!data) return;
        
        // Se baseTimestamp è fornito, lo usimao per calcolare l'offset temporale
        const timeOffset = baseTimestamp ? (data.timestamp - baseTimestamp) / 1000 : 0;
        
        // Aggiornamento grafico accelerazione
        if (charts.accel) {
            updateDatasets(charts.accel, [
                data.acceleration.x,
                data.acceleration.y,
                data.acceleration.z
            ], timeOffset);
        }
        
        // Aggiornamento grafico giroscopio
        if (charts.gyro) {
            updateDatasets(charts.gyro, [
                data.gyro.x,
                data.gyro.y,
                data.gyro.z
            ], timeOffset);
        }
        
        // Aggiornamento grafico orientamento
        if (charts.orientation) {
            updateDatasets(charts.orientation, [
                data.orientation.x, // Roll
                data.orientation.y, // Pitch
                data.orientation.z  // Yaw
            ], timeOffset);
        }
        
        // Aggiornamento grafico altitudine
        if (charts.altitude && data.sensors && data.sensors.altitude !== undefined) {
            updateDatasets(charts.altitude, [data.sensors.altitude], timeOffset);
        }
    }
    
    // Funzione helper per aggiornare i dataset di un grafico
    function updateDatasets(chart, values, timeOffset) {
        // Ottieni il timestamp attuale in millisecondi
        const timestamp = timeOffset || (chart.data.datasets[0].data.length > 0 ? 
            chart.data.datasets[0].data[chart.data.datasets[0].data.length - 1].x + 1 : 0);
        
        // Aggiorna ogni dataset
        chart.data.datasets.forEach((dataset, i) => {
            const value = values[i] !== undefined ? values[i] : null;
            
            // Aggiungi il nuovo punto dati con il timestamp come coordinata x
            dataset.data.push({x: timestamp, y: value});
            
            // Rimuovi il punto dati più vecchio se necessario
            if (dataset.data.length > maxDataPoints) {
                dataset.data.shift();
            }
        });
        
        // Calcola il minimo e massimo timestamp dai dati attuali
        let minTimestamp = Infinity;
        let maxTimestamp = -Infinity;
        
        chart.data.datasets.forEach(dataset => {
            dataset.data.forEach(point => {
                if (point.x < minTimestamp) minTimestamp = point.x;
                if (point.x > maxTimestamp) maxTimestamp = point.x;
            });
        });
        
        // Imposta l'intervallo dell'asse X per mostrare tutti i punti dati attuali
        if (minTimestamp !== Infinity && maxTimestamp !== -Infinity) {
            chart.options.scales.x.min = minTimestamp;
            chart.options.scales.x.max = maxTimestamp;
        }
        
        // Aggiorna il grafico senza animazioni
        chart.update('none');
    }
    
    // Aggiunge un singolo punto al grafico
    function addDataPoint(type, values, timestamp) {
        if (!charts[type]) return;
        
        const chart = charts[type];
        updateDatasets(chart, values, timestamp);
    }
    
    // Pulisce tutti i dati dai grafici
    function clear() {
        Object.values(charts).forEach(chart => {
            chart.data.datasets.forEach(dataset => {
                dataset.data = [];
            });
            chart.update();
        });
    }
    
    // Ridimensiona i grafici (ad es. dopo ridimensionamento finestra)
    function resize() {
        Object.values(charts).forEach(chart => {
            chart.resize();
        });
    }
    
    // Imposta l'intervallo dell'asse Y
    function setYRange(type, min, max) {
        if (!charts[type]) return;
        
        const chart = charts[type];
        chart.options.scales.y.suggestedMin = min;
        chart.options.scales.y.suggestedMax = max;
        chart.update();
    }
    
    // Funzione per esportare i dati di un grafico
    function exportData(type) {
        if (!charts[type]) return null;
        
        const chart = charts[type];
        return {
            datasets: chart.data.datasets.map(ds => ({
                label: ds.label,
                data: [...ds.data]
            }))
        };
    }
    
    // Metodi pubblici
    return {
        init,
        update,
        addDataPoint,
        clear,
        resize,
        setYRange,
        exportData,
        
        // Getter per accedere ai grafici
        getChart(type) {
            return charts[type];
        }
    };
})();