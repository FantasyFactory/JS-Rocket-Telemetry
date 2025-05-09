/**
 * forceRenderer.js
 * Gestisce la visualizzazione dei vettori di forza su un canvas 2D
 */

const ForceRenderer = (function() {
    // Variabili private
    let canvas, ctx;
    let width, height;
    let isInitialized = false;
    
    // Configurazione
    const config = {
        background: '#000000',
        gridColor: '#222222',
        axisColor: '#444444',
        textColor: '#FFFFFF',
        forceColors: {
            x: '#FF4136', // Rosso
            y: '#2ECC40', // Verde
            z: '#0074D9', // Blu
            total: '#FFFFFF' // Bianco
        },
        arrowSize: 10,
        scaleFactor: 50, // Scala per le forze
        gridSize: 20
    };
    
    // Funzione di inizializzazione
    function init(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container #${containerId} non trovato`);
            return false;
        }
        
        // Crea il canvas
        canvas = document.createElement('canvas');
        ctx = canvas.getContext('2d');
        
        // Imposta dimensioni
        width = container.clientWidth;
        height = container.clientHeight;
        canvas.width = width;
        canvas.height = height;
        
        // Aggiungi al container
        container.innerHTML = '';
        container.appendChild(canvas);
        
        // Aggiungi listener per il ridimensionamento
        window.addEventListener('resize', handleResize);
        
        // Segna come inizializzato
        isInitialized = true;
        
        // Disegna la scena iniziale
        draw({ x: 0, y: 0, z: -1 });
        
        return true;
    }
    
    // Gestisce il ridimensionamento del canvas
    function handleResize() {
        if (!canvas || !ctx) return;
        
        const container = canvas.parentElement;
        if (!container) return;
        
        width = container.clientWidth;
        height = container.clientHeight;
        canvas.width = width;
        canvas.height = height;
        
        // Ridisegna con gli ultimi dati
        redraw();
    }
    
    // Variabile per memorizzare l'ultima accelerazione
    let lastAcceleration = { x: 0, y: 0, z: -1 };
    
    // Funzione per ridisegnare con gli ultimi dati
    function redraw() {
        draw(lastAcceleration);
    }
    
    // Disegna i vettori di forza
    function draw(acceleration) {
        if (!isInitialized) return;
        
        // Memorizza l'accelerazione
        lastAcceleration = acceleration;
        
        // Pulisci il canvas
        ctx.fillStyle = config.background;
        ctx.fillRect(0, 0, width, height);
        
        // Disegna la griglia
        drawGrid();
        
        // Disegna gli assi
        drawAxes();
        
        // Calcola il centro
        const centerX = width / 2;
        const centerY = height / 2;
        
        // Disegna i vettori di accelerazione
        drawAccelerationVectors(centerX, centerY, acceleration);
        
        // Disegna la legenda
        drawLegend();
    }
    
    // Disegna la griglia di riferimento
    function drawGrid() {
        ctx.strokeStyle = config.gridColor;
        ctx.lineWidth = 1;
        
        // Griglia verticale
        for (let x = 0; x < width; x += config.gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        
        // Griglia orizzontale
        for (let y = 0; y < height; y += config.gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
    }
    
    // Disegna gli assi di riferimento
    function drawAxes() {
        const centerX = width / 2;
        const centerY = height / 2;
        
        ctx.lineWidth = 2;
        
        // Asse X
        ctx.strokeStyle = config.forceColors.x;
        ctx.beginPath();
        ctx.moveTo(centerX - width / 3, centerY);
        ctx.lineTo(centerX + width / 3, centerY);
        ctx.stroke();
        ctx.fillText('X', centerX + width / 3 + 10, centerY);
        
        // Asse Y
        ctx.strokeStyle = config.forceColors.y;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - height / 3);
        ctx.lineTo(centerX, centerY + height / 3);
        ctx.stroke();
        ctx.fillText('Y', centerX, centerY - height / 3 - 10);
        
        // Asse Z (profondità, rappresentato come un cerchio)
        ctx.strokeStyle = config.forceColors.z;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillText('Z', centerX + 20, centerY - 20);
    }
    
    // Disegna i vettori di accelerazione
    function drawAccelerationVectors(centerX, centerY, acceleration) {
        ctx.lineWidth = 3;
        const scale = config.scaleFactor;
        
        // Vettore X
        drawVector(
            centerX, centerY,
            centerX + acceleration.x * scale, centerY,
            config.forceColors.x
        );
        
        // Vettore Y (invertito perché l'asse Y del canvas è invertito)
        drawVector(
            centerX, centerY,
            centerX, centerY - acceleration.y * scale,
            config.forceColors.y
        );
        
        // Vettore Z (rappresentato come un cerchio di dimensione proporzionale)
        const zRadius = Math.abs(acceleration.z) * scale / 3;
        ctx.strokeStyle = config.forceColors.z;
        ctx.beginPath();
        ctx.arc(centerX, centerY, zRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Disegna un punto o una X al centro del cerchio per indicare la direzione
        if (acceleration.z > 0) {
            // Punto per Z positivo (verso l'osservatore)
            ctx.fillStyle = config.forceColors.z;
            ctx.beginPath();
            ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // X per Z negativo (lontano dall'osservatore)
            ctx.beginPath();
            ctx.moveTo(centerX - 5, centerY - 5);
            ctx.lineTo(centerX + 5, centerY + 5);
            ctx.moveTo(centerX + 5, centerY - 5);
            ctx.lineTo(centerX - 5, centerY + 5);
            ctx.stroke();
        }
        
        // Vettore totale (combinazione di X e Y)
        const totalX = centerX + acceleration.x * scale;
        const totalY = centerY - acceleration.y * scale;
        drawVector(centerX, centerY, totalX, totalY, config.forceColors.total);
        
        // Etichette dei valori
        ctx.font = '12px Arial';
        ctx.fillStyle = config.textColor;
        ctx.fillText(`X: ${acceleration.x.toFixed(2)}g`, centerX + 50, centerY - 60);
        ctx.fillText(`Y: ${acceleration.y.toFixed(2)}g`, centerX + 50, centerY - 40);
        ctx.fillText(`Z: ${acceleration.z.toFixed(2)}g`, centerX + 50, centerY - 20);
        
        // Magnitudine totale
        const totalMag = Math.sqrt(
            acceleration.x * acceleration.x +
            acceleration.y * acceleration.y +
            acceleration.z * acceleration.z
        );
        ctx.fillText(`Total: ${totalMag.toFixed(2)}g`, centerX + 50, centerY);
    }
    
    // Funzione helper per disegnare un vettore con freccia
    function drawVector(fromX, fromY, toX, toY, color) {
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        
        // Disegna la linea
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();
        
        // Disegna la punta della freccia
        const angle = Math.atan2(toY - fromY, toX - fromX);
        const arrowSize = config.arrowSize;
        
        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(
            toX - arrowSize * Math.cos(angle - Math.PI / 6),
            toY - arrowSize * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
            toX - arrowSize * Math.cos(angle + Math.PI / 6),
            toY - arrowSize * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
    }
    
    // Disegna la legenda
    function drawLegend() {
        const legendX = 20;
        const legendY = 20;
        const lineHeight = 20;
        
        ctx.font = '12px Arial';
        ctx.fillStyle = config.textColor;
        ctx.fillText('Vettori di Forza (g)', legendX, legendY);
        
        // Legenda X
        ctx.fillStyle = config.forceColors.x;
        ctx.fillRect(legendX, legendY + lineHeight, 15, 15);
        ctx.fillStyle = config.textColor;
        ctx.fillText('Asse X', legendX + 25, legendY + lineHeight + 12);
        
        // Legenda Y
        ctx.fillStyle = config.forceColors.y;
        ctx.fillRect(legendX, legendY + lineHeight * 2, 15, 15);
        ctx.fillStyle = config.textColor;
        ctx.fillText('Asse Y', legendX + 25, legendY + lineHeight * 2 + 12);
        
        // Legenda Z
        ctx.fillStyle = config.forceColors.z;
        ctx.fillRect(legendX, legendY + lineHeight * 3, 15, 15);
        ctx.fillStyle = config.textColor;
        ctx.fillText('Asse Z', legendX + 25, legendY + lineHeight * 3 + 12);
        
        // Legenda forza totale
        ctx.fillStyle = config.forceColors.total;
        ctx.fillRect(legendX, legendY + lineHeight * 4, 15, 15);
        ctx.fillStyle = config.textColor;
        ctx.fillText('Forza Totale', legendX + 25, legendY + lineHeight * 4 + 12);
    }
    
    // Metodi pubblici
    return {
        init,
        draw,
        
        // Configura le opzioni di visualizzazione
        configure: function(options) {
            Object.assign(config, options);
            redraw();
            return this;
        },
        
        // Imposta la scala per i vettori di forza
        setScale: function(scale) {
            config.scaleFactor = scale;
            redraw();
            return this;
        }
    };
})();