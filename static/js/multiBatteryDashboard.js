// static/js/multiBatteryDashboard.js
'use strict';

// Componente principal para el dashboard múltiple de baterías
const MultiBatteryDashboard = (props) => {
    // Estado para almacenar datos de todas las baterías
    const [batteriesData, setBatteriesData] = React.useState([]);
    // Estado para el tiempo de la última actualización
    const [lastUpdate, setLastUpdate] = React.useState(null);
    // Estado de monitoreo (activo/inactivo)
    const [isMonitoring, setIsMonitoring] = React.useState(false);
    // Estado para errores
    const [error, setError] = React.useState(props && props.error ? props.error : null);
    // Estado para batería seleccionada (vista detallada)
    const [selectedBattery, setSelectedBattery] = React.useState(null);
    // Estado para filtro de visualización
    const [viewFilter, setViewFilter] = React.useState('all'); // 'all', 'active', 'charging', 'discharging', 'critical'
    // Estado para carga inicial
    const [isInitialLoading, setIsInitialLoading] = React.useState(props && props.initialLoading ? props.initialLoading : false);

    // Efecto para manejar props externos (forceUpdate, error, etc.)
    React.useEffect(() => {
        console.log("MultiBatteryDashboard: useEffect para props externos, props=", props);
        
        // Si recibimos error desde props, actualizamos el estado
        if (props && props.error !== undefined && props.error !== error) {
            setError(props.error);
            console.log("MultiBatteryDashboard: Actualizando estado de error:", props.error);
            
            // Si hay error, detener monitoreo si está activo
            if (props.error && isMonitoring) {
                stopMonitoring();
            }
        }
        
        // Si recibimos forceUpdate, actualizar datos
        if (props && props.forceUpdate) {
            console.log("MultiBatteryDashboard: Recibida solicitud de forceUpdate");
            updateBatteriesData();
        }
        
        // Si recibimos initialLoading, actualizar estado
        if (props && props.initialLoading !== undefined) {
            setIsInitialLoading(props.initialLoading);
            console.log("MultiBatteryDashboard: Actualizando estado de carga inicial:", props.initialLoading);
        }
    }, [props]);

    // Función para iniciar el monitoreo
    const startMonitoring = async () => {
        try {
            setError(null);
            setIsInitialLoading(true);
            
            console.log("MultiBatteryDashboard: Iniciando monitoreo...");
            const response = await fetch('/api/batteries/start_monitoring', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ battery_ids: [] }) // Vacío para usar todas las disponibles
            });
            
            const data = await response.json();
            console.log("MultiBatteryDashboard: Respuesta start_monitoring:", data);
            
            if (data.status === 'success') {
                setIsMonitoring(true);
                setIsInitialLoading(false);
                // Iniciar actualizaciones periódicas
                startPeriodicUpdates();
            } else {
                setError(data.message || 'Error al iniciar monitoreo');
                setIsInitialLoading(false);
            }
        } catch (err) {
            console.error("MultiBatteryDashboard: Error al iniciar monitoreo:", err);
            setError(`Error: ${err.message}`);
            setIsInitialLoading(false);
        }
    };

    // Función para detener el monitoreo
    const stopMonitoring = async () => {
        try {
            console.log("MultiBatteryDashboard: Deteniendo monitoreo...");
            const response = await fetch('/api/batteries/stop_monitoring', {
                method: 'POST'
            });
            
            const data = await response.json();
            console.log("MultiBatteryDashboard: Respuesta stop_monitoring:", data);
            
            if (data.status === 'success') {
                setIsMonitoring(false);
                // Detener actualizaciones periódicas
                stopPeriodicUpdates();
            } else {
                setError(data.message || 'Error al detener monitoreo');
            }
        } catch (err) {
            console.error("MultiBatteryDashboard: Error al detener monitoreo:", err);
            setError(`Error: ${err.message}`);
        }
    };

    // Referencia para almacenar el ID del intervalo
    const intervalRef = React.useRef(null);

    // Función para iniciar actualizaciones periódicas
    const startPeriodicUpdates = () => {
        console.log("MultiBatteryDashboard: Iniciando actualizaciones periódicas");
        // Limpiar intervalo existente si hay alguno
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
        
        // Actualizar inmediatamente
        updateBatteriesData();
        
        // Configurar actualización periódica cada 5 segundos
        intervalRef.current = setInterval(updateBatteriesData, 5000);
    };

    // Función para detener actualizaciones periódicas
    const stopPeriodicUpdates = () => {
        console.log("MultiBatteryDashboard: Deteniendo actualizaciones periódicas");
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    };

    // Función para actualizar datos de todas las baterías
    const updateBatteriesData = async () => {
        try {
            console.log("MultiBatteryDashboard: Actualizando datos de baterías...");
            const response = await fetch('/api/batteries/status');
            
            if (!response.ok) {
                throw new Error(`Error HTTP ${response.status}`);
            }
            
            const data = await response.json();
            console.log("MultiBatteryDashboard: Respuesta status:", data);
            
            if (data.batteries && Array.isArray(data.batteries)) {
                setBatteriesData(data.batteries);
                setLastUpdate(new Date());
                // Si había un error de conexión, limpiarlo
                if (error && error.includes("Error HTTP")) {
                    setError(null);
                }
            } else {
                console.warn("MultiBatteryDashboard: La respuesta no contiene datos de baterías válidos");
                if (data.status === "error") {
                    setError(data.message || "Error al obtener datos de baterías");
                }
            }
        } catch (err) {
            console.error('MultiBatteryDashboard: Error al actualizar datos de baterías:', err);
            setError(`Error al actualizar: ${err.message}`);
        }
    };

    // Función para formatear timestamp
    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'N/A';
        const date = new Date(timestamp * 1000);
        return date.toLocaleTimeString();
    };

    // Función para determinar clase de estado de batería
    const getBatteryStatusClass = (batteryData) => {
        if (!batteryData) return 'unknown';
        
        // Verificar si hay error
        if (batteryData.error) return 'error';
        
        // Verificar SOC para estado crítico
        const socValue = batteryData.soc !== undefined ? batteryData.soc : null;
        if (socValue !== null) {
            if (socValue < 20) return 'critical';
            if (socValue < 40) return 'warning';
        }
        
        // Verificar estado basado en corriente
        const status = batteryData.status !== undefined ? batteryData.status : '';
        if (status === 'Cargando') return 'charging';
        if (status === 'Descargando') return 'discharging';
        
        return 'normal';
    };

    // Función para determinar si una batería debe mostrarse según el filtro
    const shouldShowBattery = (batteryData) => {
        if (viewFilter === 'all') return true;
        
        const statusClass = getBatteryStatusClass(batteryData);
        
        switch (viewFilter) {
            case 'active':
                return statusClass === 'charging' || statusClass === 'discharging';
            case 'charging':
                return statusClass === 'charging';
            case 'discharging':
                return statusClass === 'discharging';
            case 'critical':
                return statusClass === 'critical' || statusClass === 'warning';
            default:
                return true;
        }
    };

    // Función para mostrar vista detallada de una batería
    const showBatteryDetail = (batteryId) => {
        setSelectedBattery(batteryId);
    };

    // Función para cerrar vista detallada
    const closeBatteryDetail = () => {
        setSelectedBattery(null);
    };

    // Limpiar intervalo cuando el componente se desmonte
    React.useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    // Renderizar el panel de sistema
    const renderSystemOverview = () => {
        // Calcular estadísticas del sistema
        const totalBatteries = batteriesData.length;
        const activeBatteries = batteriesData.filter(function(b) {
            return b.status === 'Cargando' || b.status === 'Descargando';
        }).length;
        
        const criticalBatteries = batteriesData.filter(function(b) {
            return b.soc !== undefined && b.soc < 20;
        }).length;
        
        let avgSOC = 'N/A';
        if (totalBatteries > 0) {
            const totalSOC = batteriesData.reduce(function(sum, b) {
                const socValue = b.soc !== undefined ? b.soc : 0;
                return sum + socValue;
            }, 0);
            avgSOC = (totalSOC / totalBatteries).toFixed(1);
        }
        
        return (
            React.createElement("div", { className: "system-overview" },
                React.createElement("h3", null, "Resumen del Sistema"),
                React.createElement("div", { className: "system-metrics" },
                    React.createElement("div", { className: "metric" },
                        React.createElement("span", { className: "metric-label" }, "Total de Baterías:"),
                        React.createElement("span", { className: "metric-value" }, totalBatteries)
                    ),
                    React.createElement("div", { className: "metric" },
                        React.createElement("span", { className: "metric-label" }, "Baterías Activas:"),
                        React.createElement("span", { className: "metric-value" }, activeBatteries)
                    ),
                    React.createElement("div", { className: "metric" },
                        React.createElement("span", { className: "metric-label" }, "Baterías Críticas:"),
                        React.createElement("span", { 
                            className: "metric-value " + (criticalBatteries > 0 ? 'critical' : '') 
                        }, criticalBatteries)
                    ),
                    React.createElement("div", { className: "metric" },
                        React.createElement("span", { className: "metric-label" }, "SOC Promedio:"),
                        React.createElement("span", { className: "metric-value" }, avgSOC + "%")
                    ),
                    React.createElement("div", { className: "metric" },
                        React.createElement("span", { className: "metric-label" }, "Última Actualización:"),
                        React.createElement("span", { className: "metric-value" }, 
                            lastUpdate ? formatTimestamp(lastUpdate/1000) : 'N/A'
                        )
                    )
                )
            )
        );
    };

    // Renderizar un mini-panel de batería individual
    const renderBatteryMiniPanel = (batteryData) => {
        if (!batteryData) return null;
        
        const statusClass = getBatteryStatusClass(batteryData);
        
        // Obtener el nombre de la batería de manera segura
        let customName = `Batería ${batteryData.id}`;
        if (batteryData.device_info && batteryData.device_info.custom_name) {
            customName = batteryData.device_info.custom_name;
        }
        
        return (
            <div 
                key={batteryData.id}
                className={`battery-mini-panel ${statusClass}`}
                onClick={() => showBatteryDetail(batteryData.id)}
            >
                <div className="mini-panel-header">
                    <span className="battery-id">{customName}</span>
                    <span className={`battery-status ${statusClass}`}>{batteryData.status || 'N/A'}</span>
                </div>
                <div className="mini-panel-body">
                    <div className="mini-metric">
                        <span className="mini-label">SOC:</span>
                        <span className="mini-value">{batteryData.soc !== undefined ? batteryData.soc : 'N/A'}%</span>
                    </div>
                    <div className="mini-metric">
                        <span className="mini-label">Volt:</span>
                        <span className="mini-value">
                            {batteryData.voltage !== undefined ? batteryData.voltage.toFixed(2) : 'N/A'}V
                        </span>
                    </div>
                    <div className="mini-metric">
                        <span className="mini-label">Corriente:</span>
                        <span className="mini-value">
                            {batteryData.current !== undefined ? batteryData.current.toFixed(2) : 'N/A'}A
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    // Renderizar vista detallada de una batería
    const renderBatteryDetailView = () => {
        if (selectedBattery === null) return null;
        
        // Encontrar la batería seleccionada en los datos
        const batteryData = batteriesData.find(b => b.id === selectedBattery);
        if (!batteryData) return null;
        
        // Obtener el nombre de la batería de manera segura
        let customName = `Batería ${batteryData.id}`;
        if (batteryData.device_info && batteryData.device_info.custom_name) {
            customName = batteryData.device_info.custom_name;
        }
        
        // Obtener datos del dispositivo de manera segura
        const manufacturer = batteryData.device_info && batteryData.device_info.manufacturer ? 
                             batteryData.device_info.manufacturer : 'N/A';
        const model = batteryData.device_info && batteryData.device_info.model ? 
                      batteryData.device_info.model : 'N/A';
        const discoveryDate = batteryData.device_info && batteryData.device_info.discovery_date ? 
                              batteryData.device_info.discovery_date : 'N/A';
        
        return (
            <div className="battery-detail-modal">
                <div className="battery-detail-content">
                    <div className="detail-header">
                        <h3>{customName}</h3>
                        <button className="close-btn" onClick={closeBatteryDetail}>×</button>
                    </div>
                    <div className="detail-body">
                        <div className="detail-section">
                            <h4>Información de la Batería</h4>
                            <div className="info-grid">
                                <div className="info-item">
                                    <span className="info-label">ID:</span>
                                    <span className="info-value">{batteryData.id}</span>
                                </div>
                                <div className="info-item">
                                    <span className="info-label">Fabricante:</span>
                                    <span className="info-value">{manufacturer}</span>
                                </div>
                                <div className="info-item">
                                    <span className="info-label">Modelo:</span>
                                    <span className="info-value">{model}</span>
                                </div>
                                <div className="info-item">
                                    <span className="info-label">Descubierto:</span>
                                    <span className="info-value">{discoveryDate}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="detail-section">
                            <h4>Métricas Actuales</h4>
                            <div className="metrics-grid">
                                <div className="detail-metric">
                                    <span className="metric-label">Estado:</span>
                                    <span className={`metric-value ${getBatteryStatusClass(batteryData)}`}>
                                        {batteryData.status || 'N/A'}
                                    </span>
                                </div>
                                <div className="detail-metric">
                                    <span className="metric-label">SOC:</span>
                                    <span className={`metric-value ${batteryData.soc < 20 ? 'critical' : batteryData.soc < 40 ? 'warning' : ''}`}>
                                        {batteryData.soc !== undefined ? batteryData.soc : 'N/A'}%
                                    </span>
                                </div>
                                <div className="detail-metric">
                                    <span className="metric-label">SOH:</span>
                                    <span className="metric-value">
                                        {batteryData.soh !== undefined ? batteryData.soh : 'N/A'}%
                                    </span>
                                </div>
                                <div className="detail-metric">
                                    <span className="metric-label">Voltaje:</span>
                                    <span className="metric-value">
                                        {batteryData.voltage !== undefined ? batteryData.voltage.toFixed(2) : 'N/A'} V
                                    </span>
                                </div>
                                <div className="detail-metric">
                                    <span className="metric-label">Voltaje Pack:</span>
                                    <span className="metric-value">
                                        {batteryData.pack_voltage !== undefined ? batteryData.pack_voltage.toFixed(2) : 'N/A'} V
                                    </span>
                                </div>
                                <div className="detail-metric">
                                    <span className="metric-label">Corriente:</span>
                                    <span className={`metric-value ${batteryData.current > 0 ? 'charging' : batteryData.current < 0 ? 'discharging' : ''}`}>
                                        {batteryData.current !== undefined ? batteryData.current.toFixed(2) : 'N/A'} A
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="detail-section">
                            <h4>Información Técnica</h4>
                            <div className="tech-info">
                                <div className="info-item">
                                    <span className="info-label">Última Actualización:</span>
                                    <span className="info-value">{formatTimestamp(batteryData.last_updated)}</span>
                                </div>
                                <div className="info-item">
                                    <span className="info-label">Valores Crudos:</span>
                                    <pre className="raw-values">{JSON.stringify(batteryData.raw_values, null, 2)}</pre>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Renderizado principal del componente
    return (
        <div className="multi-battery-dashboard">
            <div className="dashboard-header">
                <h2>Panel de Monitorización de Baterías</h2>
                <div className="control-buttons">
                    <button 
                        onClick={isMonitoring ? stopMonitoring : startMonitoring}
                        className={isMonitoring ? 'stop-btn' : 'start-btn'}
                        disabled={isInitialLoading}
                    >
                        {isInitialLoading ? 'Cargando...' : isMonitoring ? 'Detener Monitoreo' : 'Iniciar Monitoreo'}
                    </button>
                    <button onClick={updateBatteriesData} className="refresh-btn" disabled={isInitialLoading}>
                        Actualizar Ahora
                    </button>
                </div>
                
                <div className="view-filters">
                    <span>Filtrar: </span>
                    <select 
                        value={viewFilter} 
                        onChange={(e) => setViewFilter(e.target.value)}
                        disabled={isInitialLoading}
                    >
                        <option value="all">Todas</option>
                        <option value="active">Activas</option>
                        <option value="charging">Cargando</option>
                        <option value="discharging">Descargando</option>
                        <option value="critical">Estado Crítico</option>
                    </select>
                </div>
            </div>
            
            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}
            
            {isInitialLoading ? 
                React.createElement("div", { className: "loading-container" },
                    React.createElement("p", null, "Cargando datos de baterías...")
                ) : 
                React.createElement("div", null, // Usar div en lugar de fragmento
                    renderSystemOverview(),
                    
                    React.createElement("div", { className: "batteries-grid" },
                        batteriesData.length === 0 ? 
                            React.createElement("div", { className: "no-data-message" },
                                "No hay datos de baterías disponibles. ", 
                                isMonitoring ? 'Esperando datos...' : 'Inicie el monitoreo para comenzar.'
                            ) : 
                            batteriesData
                                .filter(shouldShowBattery)
                                .map(batteryData => renderBatteryMiniPanel(batteryData))
                    )
                )
            }
            
            {renderBatteryDetailView()}
        </div>
    );
};

// Crear el root para el dashboard múltiple
let multiBatteryDashboardRoot = null;

/**
 * Función GLOBAL para actualizar el estado del panel múltiple
 * Similar a window.updateBatteryPanel para permitir actualizaciones externas
 * @param {object} props - Propiedades para actualizar el estado (opcional)
 */
window.updateMultiBatteryDashboard = function(props) {
    // Verificar si el root está inicializado
    if (!multiBatteryDashboardRoot) {
        console.error("ERROR: updateMultiBatteryDashboard llamado pero el root no está inicializado");
        // Intentar inicializar de nuevo
        initializeMultiBatteryDashboardImmediately();
        return;
    }
    
    // Asegurarse de que props sea un objeto
    props = props || {};
    
    // Por ahora, solo actualizamos la vista
    console.log("Actualizando panel multi-batería con props:", props);
    
    // Renderizar el componente (esto forzará una actualización)
    try {
        multiBatteryDashboardRoot.render(React.createElement(MultiBatteryDashboard, props));
    } catch (error) {
        console.error("Error al renderizar MultiBatteryDashboard:", error);
    }
};

/**
 * Intenta inicializar el panel React inmediatamente al cargar el script
 * Similar a la función en reactBatteryPanel.js
 */
function initializeMultiBatteryDashboardImmediately() {
    try {
        const container = document.getElementById('multi-battery-dashboard');
        if (container) {
            // Crear el root solo si no existe
            if (!multiBatteryDashboardRoot) {
                multiBatteryDashboardRoot = ReactDOM.createRoot(container);
                console.log("Panel múltiple React: Root creado inmediatamente.");

                // Renderizado inicial
                multiBatteryDashboardRoot.render(React.createElement(MultiBatteryDashboard));
                console.log("Panel múltiple React: Renderizado inicial realizado.");
            }
        } else {
            // Si el contenedor no está listo, reintentar en DOMContentLoaded
            console.warn("Panel múltiple React: Contenedor #multi-battery-dashboard no encontrado inicialmente. Reintentando en DOMContentLoaded.");
            document.addEventListener('DOMContentLoaded', initializeMultiBatteryDashboardImmediately);
        }
    } catch (error) {
        console.error("Error durante la inicialización inmediata del panel múltiple React:", error);
    }
}

// Iniciar el proceso de inicialización inmediata
initializeMultiBatteryDashboardImmediately();

// También mantener el listener de DOMContentLoaded como respaldo
document.addEventListener('DOMContentLoaded', function() {
    if (!multiBatteryDashboardRoot) {
        console.log("Panel múltiple React: Inicializando desde DOMContentLoaded");
        initializeMultiBatteryDashboardImmediately();
    }
});