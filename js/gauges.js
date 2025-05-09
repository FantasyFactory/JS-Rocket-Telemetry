/**
 * gauges.js
 * Gestisce i gauge per la visualizzazione dei valori
 */

const Gauges = (function() {
    // Variabili private
    const gauges = {};
    
    // Configurazione predefinita
    const defaultConfig = {
        minValue: 0,
        maxValue: 100,
        size: 120,
        gaugeWidth: 10,
        gaugeColor: '#e0e0e0',
        valueColor: '#3498db',
        animationSpeed: 10,
        decimals: 1,
        label: '',
        startAngle: -Math.PI / 2,
        endAngle: Math.PI / 2,
        showValue: true
    };
    
    // Inizializza un gauge
    function init(elementId, config = {}) {
        const element = document.getElementById(elementId);
        if (!element) {
            console.error(`Elemento #${elementId} non trovato`);
            return null;
        }
        
        // Recupera il container e il canvas del gauge
        const container = element;
        const canvas = container.querySelector('canvas');
        
        if (!canvas) {
            console.error(`Canvas non trovato in #${elementId}`);
            return null;
        }
        
        // Ottieni il contesto di disegno
        const ctx = canvas.getContext('2d');
        
        // Mescola configurazione predefinita con quella fornita
        const gaugeConfig = { ...defaultConfig, ...config };
        
        // Imposta le dimensioni del canvas
        canvas.width = gaugeConfig.size;
        canvas.height = gaugeConfig.size / 2 + 10; // Per gauge semicircolari
        
        // Crea l'oggetto gauge
        const gauge = {
            canvas,
            ctx,
            config: gaugeConfig,
            currentValue: gaugeConfig.minValue,
            targetValue: gaugeConfig.minValue
        };
        
        // Memorizza il gauge
        gauges[elementId] = gauge;
        
        // Disegna il gauge iniziale
        drawGauge(gauge);
        
        return gauge;
    }
    
    // Disegna un gauge
    function drawGauge(gauge) {
        const { ctx, canvas, config, currentValue } = gauge;
        const { size, minValue, maxValue, gaugeWidth, gaugeColor, valueColor, 
                startAngle, endAngle, showValue } = config;
        
        // Pulisci il canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Calcola il centro e il raggio
        const centerX = canvas.width / 2;
        const centerY = canvas.height - 10;
        const radius = (size / 2) - (gaugeWidth / 2);
        
        // Disegna il fondo del gauge
        drawArc(
            ctx, 
            centerX, 
            centerY, 
            radius, 
            startAngle, 
            endAngle, 
            gaugeWidth, 
            gaugeColor
        );
        
        // Calcola l'angolo per il valore attuale
        const valueRatio = (currentValue - minValue) / (maxValue - minValue);
        const valueAngle = startAngle + valueRatio * (endAngle - startAngle);
        
        // Disegna il valore
        drawArc(
            ctx,
            centerX,
            centerY,
            radius,
            startAngle,
            valueAngle,
            gaugeWidth,
            valueColor
        );
        
        // Disegna l'etichetta se presente
        if (config.label) {
            ctx.font = 'bold 12px Arial';
            ctx.fillStyle = '#333';
            ctx.textAlign = 'center';
            ctx.fillText(config.label, centerX, 15);
        }
    }
    
    // Funzione helper per disegnare un arco
    function drawArc(ctx, x, y, radius, startAngle, endAngle, width, color) {
        ctx.beginPath();
        ctx.arc(x, y, radius, startAngle, endAngle);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.stroke();
    }
    
    // Aggiorna il valore di un gauge
    function setValue(elementId, newValue) {
        const gauge = gauges[elementId];
        if (!gauge) return false;
        
        // Limita il valore all'intervallo
        const { minValue, maxValue } = gauge.config;
        gauge.targetValue = Math.min(Math.max(newValue, minValue), maxValue);
        
        // Se ci sono animazioni in corso, usa quelle
        if (!gauge.animationId) {
            animateGauge(gauge);
        }
        
        return true;
    }
    
    // Anima il cambio di valore
    function animateGauge(gauge) {
        // Se il valore è già raggiunto, ferma l'animazione
        if (Math.abs(gauge.currentValue - gauge.targetValue) < 0.01) {
            gauge.currentValue = gauge.targetValue;
            drawGauge(gauge);
            gauge.animationId = null;
            return;
        }
        
        // Calcola il prossimo valore
        const diff = gauge.targetValue - gauge.currentValue;
        const step = diff / gauge.config.animationSpeed;
        gauge.currentValue += step;
        
        // Ridisegna il gauge
        drawGauge(gauge);
        
        // Richiedi il prossimo frame
        gauge.animationId = requestAnimationFrame(() => animateGauge(gauge));
    }
    
    // Aggiorna la configurazione di un gauge
    function updateConfig(elementId, config) {
        const gauge = gauges[elementId];
        if (!gauge) return false;
        
        // Aggiorna la configurazione
        Object.assign(gauge.config, config);
        
        // Ridisegna il gauge
        drawGauge(gauge);
        
        return true;
    }
    
    // Metodi pubblici
    return {
        init,
        setValue,
        updateConfig,
        
        // Crea e configura tutti i gauge standard per la dashboard
        initDashboardGauges: function() {
            // Configura il gauge dell'altitudine
            this.init('altitude-gauge', {
                minValue: 0,
                maxValue: 1000,
                label: 'Altitudine (m)',
                valueColor: '#2196F3'
            });
            
            // Configura il gauge della velocità
            this.init('velocity-gauge', {
                minValue: 0,
                maxValue: 300,
                label: 'Velocità (m/s)',
                valueColor: '#4CAF50'
            });
            
            // Configura il gauge della batteria
            this.init('battery-gauge', {
                minValue: 3.0,
                maxValue: 4.2,
                label: 'Batteria (V)',
                valueColor: '#FF9800'
            });
            
            // Configura il gauge della temperatura
            this.init('temperature-gauge', {
                minValue: -10,
                maxValue: 60,
                label: 'Temperatura (°C)',
                valueColor: '#F44336'
            });
        }
    };
})();