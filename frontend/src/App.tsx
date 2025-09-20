import React, { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { type LatLngExpression } from 'leaflet';
import MapDashboard from './components/MapDashboard';
import DetectionPanel from './components/DetectionPanel';
import CommunicationSuite from './components/CommunicationSuite';
import ConvoyPlanner from './components/ConvoyPlanner';

const App: React.FC = () => {
  const [activeConvoyRoute, setActiveConvoyRoute] = useState<any>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const getLocation = () => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
          toast.success("Location detected successfully!", {
            icon: '📍',
            style: {
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#fff',
            },
          });
          setIsLoading(false);
        },
        () => {
          setUserLocation([20.2961, 85.8245]);
          toast.error("Using default location (Bhubaneswar)", {
            icon: '⚠️',
            style: {
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#fff',
            },
          });
          setIsLoading(false);
        },
        {
          timeout: 10000,
          enableHighAccuracy: true,
        }
      );
    };

    getLocation();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <h2 className="text-xl font-semibold text-gray-700">Initializing Samanvay</h2>
          <p className="text-gray-500">Detecting your location...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Toaster 
        position="top-center" 
        reverseOrder={false}
        toastOptions={{
          duration: 4000,
          style: {
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          },
        }}
      />
      
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <header className="sticky top-0 z-40 backdrop-blur-md bg-white/80 border-b border-white/20 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-lg">🛡️</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    SAMANVAY
                  </h1>
                  <p className="text-xs text-gray-500 -mt-1">Emergency Management System</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-gray-600">System Online</span>
                </div>
                <div className="hidden sm:flex items-center space-x-1 bg-white/60 backdrop-blur-sm rounded-lg px-3 py-1">
                  <span className="text-xs text-gray-500">Location:</span>
                  <span className="text-xs font-medium text-gray-700">
                    {userLocation ? `${userLocation[0].toFixed(4)}, ${userLocation[1].toFixed(4)}` : 'Loading...'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            {/* Map Dashboard - Takes up more space */}
            <div className="xl:col-span-3">
              <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 overflow-hidden">
                <MapDashboard 
                  center={userLocation}
                  activeConvoyRoute={activeConvoyRoute} 
                  setActiveConvoyRoute={setActiveConvoyRoute}
                />
              </div>
            </div>
            
            {/* Control Panels Sidebar */}
            <div className="xl:col-span-1 space-y-6">
              {/* Convoy Planning */}
              <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 overflow-hidden transform hover:scale-[1.02] transition-all duration-300">
                <ConvoyPlanner 
                  userLocation={userLocation}
                  onConvoyPlanned={setActiveConvoyRoute}
                />
              </div>
              
              {/* AI Detection */}
              <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 overflow-hidden transform hover:scale-[1.02] transition-all duration-300">
                <DetectionPanel />
              </div>
              
              {/* Communication Suite */}
              <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 overflow-hidden transform hover:scale-[1.02] transition-all duration-300">
                <CommunicationSuite userLocation={userLocation} />
              </div>
            </div>
          </div>
        </main>

        <button className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-r from-red-500 to-red-600 rounded-full shadow-2xl flex items-center justify-center text-white font-bold text-xl hover:scale-110 transform transition-all duration-300 z-50">
          🚨
        </button>
      </div>
    </>
  );
};

export default App;