// static/js/connectionHandler.js

/**
 * Módulo para gestionar la conexión con dispositivos Modbus y el estado de conexión
 * Encapsula toda la lógica de conexión para mantenerla separada de la UI
 */
const ConnectionHandler = (function() {
    // Estado interno
    let isConnected = false;
    
    // Referencias a elementos DOM críticos para la conexión
    let elements = {
        connectBtn: null,
        disconnectBtn: null,
        messageEl: null,
        slaveIdSelect: null,
        portInput: null,
        baudrateSelect: null,
        paritySelect: null,
        stopbitsSelect: null,
        bytesizeSelect: null,
        timeoutInput: null
    };
    
    /**
     * Obtiene los parámetros de conexión actuales desde los inputs
     * @returns {Object} Parámetros de conexión
     */
    function getConnectionParams() {
        return {
            port: elements.portInput?.value || 'COM8',
            baudrate: parseInt(elements.baudrateSelect?.value || '9600'),
            parity: elements.paritySelect?.value || 'N',
            stopbits: parseInt(elements.stopbitsSelect?.value || '1'),
            bytesize: parseInt(elements.bytesizeSelect?.value || '8'),
            timeout: parseInt(elements.timeoutInput?.value || '1'),
            slaveId: parseInt(elements.slaveIdSelect?.value || 217)
        };
    }
    
    /**
     * Maneja el proceso de conexión
     */
    async function handleConnect() {
        if (!elements.connectBtn || !elements.disconnectBtn) return;
        
        // Deshabilitar botones mientras conecta
        elements.connectBtn.disabled = true;
        elements.disconnectBtn.disabled = true;
        
        // Obtener parámetros de conexión
        const params = getConnectionParams();
        
        // Mostrar mensaje de conexión
        showConnectionMessage('Conectando...', 'info');
        
        let connectSuccess = false;
        try {
            // Usar la función de modbusApi.js
            const result = await connectModbus(params);
            showConnectionMessage(result.message, result.status || 'info');
            
            // Considerar éxito si status es 'success' o 'warning'
            if (result.status === 'success' || result.status === 'warning') {
                connectSuccess = true;
            }
        } catch (error) {
            showConnectionMessage(`Error: ${error.message}`, 'error');
            connectSuccess = false;
        } finally {
            // Actualizar estado interno
            isConnected = connectSuccess;
            
            // Disparar evento para notificar del cambio de estado
            dispatchConnectionEvent(connectSuccess);
        }
    }
    
    /**
     * Maneja el proceso de desconexión
     */
    async function handleDisconnect() {
        if (!elements.connectBtn || !elements.disconnectBtn) return;
        
        // Deshabilitar botones mientras desconecta
        elements.connectBtn.disabled = true;
        elements.disconnectBtn.disabled = true;
        
        showConnectionMessage('Desconectando...', 'info');
        try {
            // Usar la función de modbusApi.js
            const result = await disconnectModbus();
            showConnectionMessage(result.message, 'success');
        } catch (error) {
            showConnectionMessage(`Error: ${error.message}`, 'error');
        } finally {
            // Actualizar estado interno y notificar
            isConnected = false;
            dispatchConnectionEvent(false);
        }
    }
    
    /**
     * Muestra un mensaje en el área de conexión
     * @param {string} message - Mensaje a mostrar
     * @param {string} type - Tipo de mensaje (success, error, info)
     */
    function showConnectionMessage(message, type = 'info') {
        if (!elements.messageEl) return;
        
        if (elements.messageEl.timeoutId) {
            clearTimeout(elements.messageEl.timeoutId);
        }
        
        elements.messageEl.textContent = message;
        elements.messageEl.className = `message-area ${type}`;
        
        // Auto-limpiar después de un tiempo
        elements.messageEl.timeoutId = setTimeout(() => {
            if (elements.messageEl.textContent === message) {
                elements.messageEl.textContent = '';
                elements.messageEl.className = 'message-area';
            }
        }, 5000);
    }
    
    /**
     * Dispara un evento de cambio de estado de conexión
     * @param {boolean} connected - Estado de conexión
     */
    function dispatchConnectionEvent(connected) {
        console.log(`ConnectionHandler: Disparando evento connection-status-change (connected: ${connected})`);
        
        // Actualizar estado de los botones
        if (elements.connectBtn) elements.connectBtn.disabled = connected;
        if (elements.disconnectBtn) elements.disconnectBtn.disabled = !connected;
        
        // Disparar evento para otros módulos
        document.dispatchEvent(new CustomEvent('connection-status-change', {
            detail: { connected: connected }
        }));
    }
    
    /**
     * Inicializa el selector de baterías disponibles
     */
    async function initBatterySelector() {
        if (!elements.slaveIdSelect) return;
        
        try {
            // Obtener baterías disponibles desde la API
            const result = await getAvailableBatteries();
            
            if (result && result.batteries && Array.isArray(result.batteries)) {
                // Limpiar opciones existentes
                elements.slaveIdSelect.innerHTML = '';
                
                // Añadir opciones basadas en configuración
                result.batteries.forEach(id => {
                    const option = document.createElement('option');
                    option.value = id;
                    option.textContent = `Batería ${id}`;
                    
                    // Seleccionar la predeterminada
                    if (id === result.default_id) {
                        option.selected = true;
                    }
                    
                    elements.slaveIdSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error al cargar baterías disponibles:', error);
            // Añadir opción predeterminada en caso de error
            elements.slaveIdSelect.innerHTML = '<option value="217">Batería 217</option>';
        }
    }
    
    /**
     * Comprueba el estado actual de conexión con el backend
     */
    async function checkConnectionStatus() {
        try {
            const result = await checkStatus(); // Función de modbusApi.js
            
            // Si el estado no coincide con nuestro registro, actualizar
            if (result.connected !== isConnected) {
                isConnected = result.connected;
                dispatchConnectionEvent(isConnected);
            }
            
            return result.connected;
        } catch (error) {
            console.error('Error al verificar estado de conexión:', error);
            return false;
        }
    }
    
    // API pública
    return {
        /**
         * Inicializa el módulo de conexión
         * @param {Object} domElements - Referencias a elementos DOM necesarios
         */
        init: function(domElements) {
            console.log('ConnectionHandler: Inicializando...');
            
            // Guardar referencias a elementos DOM
            elements = { ...elements, ...domElements };
            
            // Configurar listeners para botones principales
            if (elements.connectBtn) {
                elements.connectBtn.addEventListener('click', handleConnect);
            }
            
            if (elements.disconnectBtn) {
                elements.disconnectBtn.addEventListener('click', handleDisconnect);
            }
            
            // Inicializar selector de baterías
            initBatterySelector();
            
            // Verificar estado inicial
            checkConnectionStatus().then(connected => {
                console.log(`ConnectionHandler: Estado inicial - Conectado: ${connected}`);
            });
            
            console.log('ConnectionHandler: Inicialización completada');
        },
        
        /**
         * Devuelve el estado actual de conexión
         * @returns {boolean} - true si está conectado, false si no
         */
        isConnected: function() {
            return isConnected;
        },
        
        /**
         * Inicia el proceso de conexión manualmente
         */
        connect: handleConnect,
        
        /**
         * Inicia el proceso de desconexión manualmente
         */
        disconnect: handleDisconnect,
        
        /**
         * Actualiza el estado de conexión sin iniciar la conexión/desconexión
         * @param {boolean} connected - Nuevo estado de conexión
         */
        updateConnectionState: function(connected) {
            if (connected !== isConnected) {
                isConnected = connected;
                dispatchConnectionEvent(connected);
            }
        }
    };
})();

// Exportar para uso global
window.ConnectionHandler = ConnectionHandler;