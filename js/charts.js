/**
 * charts.js (Modificato)
 * Gestisce i grafici per la visualizzazione dei dati telemetrici con supporto per timestamp variabili
 */

const TelemetryCharts = (function() {
    // Variabili private
    const charts = {};
    const maxDataPoints = 200; // Numero massimo di punti dati da visualizzare
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
                    tooltip: { 
                        mode: 'index', 
                        intersect: false,
                        callbacks: {
                            title: function(context) {
                                // Converti il timestamp in formato leggibile
                                const timestamp = context[0].parsed.x;
                                return new Date(timestamp).toLocaleTimeString();
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        display: true,
                        title: { display: true, text: 'Tempo' },
                        ticks: { 
                            maxTicksLimit: 10,
                            callback: function(value) {
                                // Mostra secondi relativi invece di timestamp assoluti
                                const startTime = this.chart.data.datasets[0].data[0]?.x || 0;
                                return ((value - startTime) / 1000).toFixed(1) + 's';
                            }
                        }
                    },
                    y: {
                        display: true,
                        title: { display: true, text: 'Accelerazione (g)' },
                        suggestedMin: -2,
                        suggestedMax: 2
                    }
                },
                onClick: function(e, elements) {
                    // Implementare la funzione per posizionarsi su un punto specifico del grafico
                    if (elements && elements.length > 0) {
                        handleChartClick(this, elements[0].index);
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
                    tooltip: { 
                        mode: 'index', 
                        intersect: false,
                        callbacks: {
                            title: function(context) {
                                // Converti il timestamp in formato leggibile
                                const timestamp = context[0].parsed.x;
                                return new Date(timestamp).toLocaleTimeString();
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        display: true,
                        title: { display: true, text: 'Tempo' },
                        ticks: { 
                            maxTicksLimit: 10,
                            callback: function(value) {
                                // Mostra secondi relativi invece di timestamp assoluti
                                const startTime = this.chart.data.datasets[0].data[0]?.x || 0;
                                return ((value - startTime) / 1000).toFixed(1) + 's';
                            }
                        }
                    },
                    y: {
                        display: true,
                        title: { display: true, text: 'Velocità (°/s)' },
                        suggestedMin: -180,
                        suggestedMax: 180
                    }
                },
                onClick: function(e, elements) {
                    if (elements && elements.length > 0) {
                        handleChartClick(this, elements[0].index);
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
                    tooltip: { 
                        mode: 'index', 
                        intersect: false,
                        callbacks: {
                            title: function(context) {
                                // Converti il timestamp in formato leggibile
                                const timestamp = context[0].parsed.x;
                                return new Date(timestamp).toLocaleTimeString();
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        display: true,
                        title: { display: true, text: 'Tempo' },
                        ticks: { 
                            maxTicksLimit: 10,
                            callback: function(value) {
                                // Mostra secondi relativi invece di timestamp assoluti
                                const startTime = this.chart.data.datasets[0].data[0]?.x || 0;
                                return ((value - startTime) / 1000).toFixed(1) + 's';
                            }
                        }
                    },
                    y: {
                        display: true,
                        title: { display: true, text: 'Angolo (°)' },
                        suggestedMin: -180,
                        suggestedMax: 180
                    }
                },
                onClick: function(e, elements) {
                    if (elements && elements.length > 0) {
                        handleChartClick(this, elements[0].index);
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
                    tooltip: { 
                        mode: 'index', 
                        intersect: false,
                        callbacks: {
                            title: function(context) {
                                // Converti il timestamp in formato leggibile
                                const timestamp = context[0].parsed.x;
                                return new Date(timestamp).toLocaleTimeString();
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        display: true,
                        title: { display: true, text: 'Tempo' },
                        ticks: { 
                            maxTicksLimit: 10,
                            callback: function(value) {
                                // Mostra secondi relativi invece di timestamp assoluti
                                const startTime = this.chart.data.datasets[0].data[0]?.x || 0;
                                return ((value - startTime) / 1000).toFixed(1) + 's';
                            }
                        }
                    },
                    y: {
                        display: true,
                        title: { display: true, text: 'Altitudine (m)' },
                        suggestedMin: 0,
                        suggestedMax: 500
                    }
                },
                onClick: function(e, elements) {
                    if (elements && elements.length > 0) {
                        handleChartClick(this, elements[0].index);
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
    
    // Funzione per gestire il click sul grafico
    function handleChartClick(chart, dataIndex) {
        // Trova l'indice del punto dati nel dataset completo
        const datasetIndex = chart.data.datasets[0].datasetIndex || 0;
        const point = chart.data.datasets[datasetIndex].data[dataIndex];
        
        if (point && point.x) {
            // Trova il punto più vicino al timestamp selezionato nel dataset completo
            const timestamp = point.x;
            const dataset = DataReader.telemetryDataset;
            
            if (dataset && dataset.data.length > 0) {
                let closestIndex = 0;
                let minDiff = Infinity;
                
                for (let i = 0; i < dataset.data.length; i++) {
                    const diff = Math.abs(dataset.data[i].timestamp - timestamp);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closestIndex = i;
                    }
                }
                
                // Notifica l'applicazione che l'utente ha selezionato un punto
                if (DataReader.seek) {
                    DataReader.seek(closestIndex);
                }
            }
        }
    }
    
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
    function update(data) {
        if (!data) return;
        
        // Usa il timestamp del punto dati
        const timestamp = data.timestamp;
        
        // Aggiornamento grafico accelerazione
        if (charts.accel) {
            updateDatasets(charts.accel, [
                data.sensors.accel.x,
                data.sensors.accel.y,
                data.sensors.accel.z
            ], timestamp);
        }
        
        // Aggiornamento grafico giroscopio
        if (charts.gyro) {
            updateDatasets(charts.gyro, [
                data.sensors.gyro.x,
                data.sensors.gyro.y,
                data.sensors.gyro.z
            ], timestamp);
        }
        
        // Aggiornamento grafico orientamento
        if (charts.orientation) {
            updateDatasets(charts.orientation, [
                data.orientation.x, // Roll
                data.orientation.y, // Pitch
                data.orientation.z  // Yaw
            ], timestamp);
        }
        
        // Aggiornamento grafico altitudine
        if (charts.altitude && data.sensors && typeof data.sensors.altitude === 'number') {
            updateDatasets(charts.altitude, [data.sensors.altitude], timestamp);
        }
    }
    
    // Funzione helper per aggiornare i dataset di un grafico
    function updateDatasets(chart, values, timestamp) {
        // Aggiorna ogni dataset
        chart.data.datasets.forEach((dataset, i) => {
            const value = values[i] !== undefined ? values[i] : null;
            
            // Verifica se il punto esiste già a questo timestamp (evita duplicati)
            const existingPointIndex = dataset.data.findIndex(point => point.x === timestamp);
            
            if (existingPointIndex >= 0) {
                // Aggiorna il punto esistente
                dataset.data[existingPointIndex].y = value;
            } else {
                // Aggiungi il nuovo punto dati con il timestamp come coordinata x
                dataset.data.push({x: timestamp, y: value});
                
                // Rimuovi il punto dati più vecchio se necessario
                if (dataset.data.length > maxDataPoints) {
                    dataset.data.shift();
                }
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
    
    // Imposta tutti i dati per un grafico (per visualizzare un dataset completo)
    function setData(type, dataArray) {
        if (!charts[type] || !Array.isArray(dataArray) || dataArray.length === 0) return;
        
        const chart = charts[type];
        
        // Per ogni dataset nel grafico
        chart.data.datasets.forEach((dataset, datasetIndex) => {
            // Ottieni i dati per questo dataset
            const data = dataArray[datasetIndex] || [];
            
            // Sostituisci completamente i dati
            dataset.data = [...data];  // Copia per evitare problemi di riferimento
        });
        
        // Calcola il minimo e massimo timestamp dai dati
        let minTimestamp = Infinity;
        let maxTimestamp = -Infinity;
        
        chart.data.datasets.forEach(dataset => {
            dataset.data.forEach(point => {
                if (point.x < minTimestamp) minTimestamp = point.x;
                if (point.x > maxTimestamp) maxTimestamp = point.x;
            });
        });
        
        // Imposta l'intervallo dell'asse X
        if (minTimestamp !== Infinity && maxTimestamp !== -Infinity) {
            chart.options.scales.x.min = minTimestamp;
            chart.options.scales.x.max = maxTimestamp;
        }
        
        // Aggiorna il grafico
        chart.update();
    }
    
    // Evidenzia un punto specifico sul grafico
    function highlightPoint(type, index) {
        if (!charts[type]) return;
        
        const chart = charts[type];
        
        // Rimuovi gli evidenziatori esistenti
        chart.data.datasets.forEach(dataset => {
            // Ripristina lo stile originale
            dataset.pointBackgroundColor = undefined;
            dataset.pointBorderColor = undefined;
            dataset.pointRadius = undefined;
        });
        
        // Aggiungi l'evidenziatore al punto selezionato
        chart.data.datasets.forEach(dataset => {
            if (dataset.data[index]) {
                // Crea array di colori per i punti se non esiste
                if (!dataset.pointBackgroundColor) {
                    dataset.pointBackgroundColor = Array(dataset.data.length).fill(undefined);
                    dataset.pointBorderColor = Array(dataset.data.length).fill(undefined);
                    dataset.pointRadius = Array(dataset.data.length).fill(undefined);
                }
                
                // Imposta il punto evidenziato
                dataset.pointBackgroundColor[index] = '#FF0000';
                dataset.pointBorderColor[index] = '#000000';
                dataset.pointRadius[index] = 6;
            }
        });
        
        // Aggiorna il grafico
        chart.update();
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
    
    // Carica i dati completi dal dataset di telemetria
    function loadFromDataset(telemetryDataset) {
        if (!telemetryDataset || !telemetryDataset.data || telemetryDataset.data.length === 0) return;
        
        // Per ogni tipo di grafico, estrai i dati rilevanti
        if (charts.accel) {
            setData('accel', [
                telemetryDataset.getDataSeries('accel', 0), // X
                telemetryDataset.getDataSeries('accel', 1), // Y
                telemetryDataset.getDataSeries('accel', 2)  // Z
            ]);
        }
        
        if (charts.gyro) {
            setData('gyro', [
                telemetryDataset.getDataSeries('gyro', 0), // X
                telemetryDataset.getDataSeries('gyro', 1), // Y
                telemetryDataset.getDataSeries('gyro', 2)  // Z
            ]);
        }
        
        if (charts.orientation) {
            setData('orientation', [
                telemetryDataset.getDataSeries('orientation', 0), // Roll
                telemetryDataset.getDataSeries('orientation', 1), // Pitch
                telemetryDataset.getDataSeries('orientation', 2)  // Yaw
            ]);
        }
        
        if (charts.altitude) {
            setData('altitude', [
                telemetryDataset.getDataSeries('altitude', 0)
            ]);
        }
    }
    
    // Metodi pubblici
    return {
        init,
        update,
        addDataPoint,
        clear,
        resize,
        setYRange,
        setData,
        highlightPoint,
        loadFromDataset,
        
        // Getter per accedere ai grafici
        getChart(type) {
            return charts[type];
        }
    };
})();