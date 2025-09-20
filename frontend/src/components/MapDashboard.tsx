import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker as LeafletMarker, Popup, Circle, Tooltip, Polyline } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { socket } from '../socket'; 

interface Incident {
    id: number;
    lat: number;
    lng: number;
    severity: 'Low' | 'Medium' | 'High' | 'Critical';
}
interface ThreatZone {
    id: number;
    lat: number;
    lng: number;
    radius: number;
    threat_score: number;
}
interface ConvoyRouteData {
    convoy_id: number;
    name: string;
    route: [number, number][];
}
interface MapDashboardProps {
    center: [number, number] | null; 
    activeConvoyRoute: ConvoyRouteData | null;
    setActiveConvoyRoute: (route: ConvoyRouteData | null) => void;
}

const createCustomIcon = (severity: Incident['severity']) => {
    const config = {
        'Critical': { color: '#ef4444', shadow: '0 0 20px rgba(239, 68, 68, 0.6)' },
        'High': { color: '#f97316', shadow: '0 0 15px rgba(249, 115, 22, 0.5)' },
        'Medium': { color: '#eab308', shadow: '0 0 10px rgba(234, 179, 8, 0.4)' },
        'Low': { color: '#22c55e', shadow: '0 0 8px rgba(34, 197, 94, 0.3)' }
    }[severity] || { color: '#6b7280', shadow: '0 0 5px rgba(107, 114, 128, 0.3)' };

    const markerHtmlStyles = `
        background: linear-gradient(135deg, ${config.color}, ${config.color}dd);
        width: 2rem; 
        height: 2rem; 
        display: block;
        left: -1rem; 
        top: -1rem; 
        position: relative; 
        border-radius: 2rem 2rem 0;
        transform: rotate(45deg); 
        border: 2px solid #ffffff; 
        box-shadow: ${config.shadow}, 0 4px 8px rgba(0,0,0,0.2);
        animation: pulse-marker 2s infinite;
    `;
    
    return L.divIcon({ 
        className: "modern-marker", 
        html: `
            <span style="${markerHtmlStyles}"></span>
            <style>
                @keyframes pulse-marker {
                    0%, 100% { transform: rotate(45deg) scale(1); }
                    50% { transform: rotate(45deg) scale(1.1); }
                }
            </style>
        ` 
    });
};

const MapDashboard: React.FC<MapDashboardProps> = ({ center, activeConvoyRoute, setActiveConvoyRoute }) => {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [threatZones, setThreatZones] = useState<ThreatZone[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState({ incidents: 0, threats: 0, convoys: 0 });

    useEffect(() => {
        if (!center) return;

        const initializeAndFetch = async () => {
            try {
                setLoading(true);
                await axios.post('http://localhost:8000/api/scenario/initialize', {
                    lat: center[0],
                    lng: center[1]
                });
                
                toast.success("Scenario initialized successfully", {
                    icon: '🎯',
                    style: {
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        color: '#fff',
                        borderRadius: '12px',
                    },
                });

                const [incidentsRes, zonesRes] = await Promise.all([
                    axios.get('http://localhost:8000/api/incidents'),
                    axios.get('http://localhost:8000/api/threat_zones')
                ]);
                
                setIncidents(incidentsRes.data);
                setThreatZones(zonesRes.data);
                setStats({
                    incidents: incidentsRes.data.length,
                    threats: zonesRes.data.length,
                    convoys: activeConvoyRoute ? 1 : 0
                });
                setError(null);

            } catch (err) {
                setError("Failed to initialize scenario");
                toast.error("Failed to initialize map data", {
                    style: {
                        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                        color: '#fff',
                        borderRadius: '12px',
                    },
                });
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        initializeAndFetch();
    }, [center]);

    useEffect(() => {
        const onReroute = (data: ConvoyRouteData) => {
            if (activeConvoyRoute && data.convoy_id === activeConvoyRoute.convoy_id) {
                toast.error("Route updated due to dynamic threat!", { 
                    duration: 5000,
                    icon: '🚨',
                    style: {
                        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                        color: '#fff',
                        borderRadius: '12px',
                    },
                });
                setActiveConvoyRoute({ ...activeConvoyRoute, route: data.route });
            }
        };
        
        const onNewIncident = (newIncident: Incident) => {
            setIncidents(prev => [newIncident, ...prev]);
            setStats(prev => ({ ...prev, incidents: prev.incidents + 1 }));
            toast.error(`New ${newIncident.severity} incident detected!`, { 
                icon: '🚨',
                style: {
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    color: '#fff',
                    borderRadius: '12px',
                },
            });
        };

        socket.on('new_incident', onNewIncident);
        socket.on('reroute_update', onReroute);

        return () => {
            socket.off('new_incident', onNewIncident);
            socket.off('reroute_update', onReroute);
        };
    }, [activeConvoyRoute, setActiveConvoyRoute]);

    if (!center) {
        return (
            <div className="h-[calc(100vh-8rem)] flex flex-col items-center justify-center p-8">
                <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-lg font-medium text-gray-600">Detecting location...</p>
                <p className="text-sm text-gray-500 mt-2">Please enable location services</p>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col">
            {/* Modern Header with Stats */}
            <div className="flex items-center justify-between p-6 border-b border-white/20">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                        <span className="text-white font-bold">📍</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-gray-800">Operational Map</h2>
                        <p className="text-sm text-gray-500">Real-time threat monitoring</p>
                    </div>
                </div>
                
                <div className="flex space-x-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-red-500">{stats.incidents}</div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide">Incidents</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-orange-500">{stats.threats}</div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide">Threats</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-green-500">{stats.convoys}</div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide">Convoys</div>
                    </div>
                </div>
            </div>

            {/* Map Container */}
            <div className="flex-1 relative">
                {loading && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 backdrop-blur-sm">
                        <div className="text-center space-y-4">
                            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-lg font-medium text-gray-600">Initializing Scenario...</p>
                            <p className="text-sm text-gray-500">Setting up threat zones and incidents</p>
                        </div>
                    </div>
                )}
                
                {error && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-red-50/90 backdrop-blur-sm">
                        <div className="text-center space-y-4 max-w-md mx-auto p-6">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                                <span className="text-2xl">⚠️</span>
                            </div>
                            <h3 className="text-lg font-semibold text-red-800">Map Initialization Failed</h3>
                            <p className="text-red-600">{error}</p>
                            <button 
                                onClick={() => window.location.reload()}
                                className="bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 transition-colors"
                            >
                                Retry
                            </button>
                        </div>
                    </div>
                )}
                
                <MapContainer 
                    key={center.toString()} 
                    center={center} 
                    zoom={13} 
                    scrollWheelZoom={true} 
                    className="w-full h-full rounded-xl z-0"
                    style={{ borderRadius: '12px' }}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    
                    {/* Display Incidents with modern markers */}
                    {incidents.map((incident) => (
                        <LeafletMarker 
                            key={`incident-${incident.id}`} 
                            position={[incident.lat, incident.lng]} 
                            icon={createCustomIcon(incident.severity)}
                        >
                            <Popup className="modern-popup">
                                <div className="p-2">
                                    <div className="flex items-center space-x-2 mb-2">
                                        <div className={`w-3 h-3 rounded-full ${
                                            incident.severity === 'Critical' ? 'bg-red-500' :
                                            incident.severity === 'High' ? 'bg-orange-500' :
                                            incident.severity === 'Medium' ? 'bg-yellow-500' : 'bg-green-500'
                                        }`}></div>
                                        <span className="font-semibold text-gray-800">{incident.severity} Incident</span>
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        <p>ID: #{incident.id}</p>
                                        <p>Location: {incident.lat.toFixed(4)}, {incident.lng.toFixed(4)}</p>
                                    </div>
                                </div>
                            </Popup>
                        </LeafletMarker>
                    ))}

                    {/* Display Threat Zones with modern styling */}
                    {threatZones.map(zone => (
                        <Circle 
                            key={`zone-${zone.id}`} 
                            center={[zone.lat, zone.lng]} 
                            radius={zone.radius} 
                            pathOptions={{ 
                                color: '#ef4444', 
                                fillColor: '#fee2e2', 
                                fillOpacity: 0.3, 
                                weight: 2,
                                dashArray: '10, 10'
                            }}
                        >
                            <Tooltip className="modern-tooltip">
                                <div className="p-2">
                                    <div className="font-semibold text-red-800 mb-1">Threat Zone</div>
                                    <div className="text-sm text-gray-600">
                                        <p>Risk Score: {zone.threat_score}/10</p>
                                        <p>Radius: {zone.radius}m</p>
                                    </div>
                                </div>
                            </Tooltip>
                        </Circle>
                    ))}
                    
                    {/* Display Active Convoy Route with enhanced styling */}
                    {activeConvoyRoute && (
                        <>
                            <Polyline 
                                positions={activeConvoyRoute.route} 
                                pathOptions={{
                                    color: '#10b981', 
                                    weight: 6, 
                                    opacity: 0.8,
                                    dashArray: '20, 10'
                                }} 
                            />
                            {/* Start marker */}
                            <LeafletMarker 
                                position={activeConvoyRoute.route[0]}
                                icon={L.divIcon({
                                    className: 'convoy-marker',
                                    html: `
                                        <div style="
                                            background: linear-gradient(135deg, #10b981, #059669);
                                            width: 2rem; height: 2rem;
                                            border-radius: 50%;
                                            display: flex;
                                            align-items: center;
                                            justify-content: center;
                                            border: 3px solid white;
                                            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
                                            font-weight: bold;
                                            color: white;
                                            font-size: 0.8rem;
                                        ">START</div>
                                    `
                                })}
                            >
                                <Popup>
                                    <div className="p-2">
                                        <div className="font-semibold text-green-800">Convoy Start</div>
                                        <div className="text-sm text-gray-600">{activeConvoyRoute.name}</div>
                                    </div>
                                </Popup>
                            </LeafletMarker>
                            
                            {/* End marker */}
                            <LeafletMarker 
                                position={activeConvoyRoute.route[activeConvoyRoute.route.length - 1]}
                                icon={L.divIcon({
                                    className: 'convoy-marker',
                                    html: `
                                        <div style="
                                            background: linear-gradient(135deg, #3b82f6, #1d4ed8);
                                            width: 2rem; height: 2rem;
                                            border-radius: 50%;
                                            display: flex;
                                            align-items: center;
                                            justify-content: center;
                                            border: 3px solid white;
                                            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
                                            font-weight: bold;
                                            color: white;
                                            font-size: 0.8rem;
                                        ">END</div>
                                    `
                                })}
                            >
                                <Popup>
                                    <div className="p-2">
                                        <div className="font-semibold text-blue-800">Convoy Destination</div>
                                        <div className="text-sm text-gray-600">{activeConvoyRoute.name}</div>
                                    </div>
                                </Popup>
                            </LeafletMarker>
                        </>
                    )}
                </MapContainer>
                
                {/* Map Legend */}
                <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-xl p-4 shadow-lg z-10">
                    <h4 className="font-semibold text-gray-800 mb-2">Legend</h4>
                    <div className="space-y-2 text-sm">
                        <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                            <span>Critical Incidents</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                            <span>High Priority</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 border-2 border-red-400 rounded-full bg-red-50"></div>
                            <span>Threat Zones</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="w-4 h-1 bg-green-500 rounded"></div>
                            <span>Safe Routes</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MapDashboard;