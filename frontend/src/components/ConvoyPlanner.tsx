import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

interface ConvoyPlannerProps {
  userLocation: [number, number] | null;
  onConvoyPlanned: (convoy: any) => void;
}

const ConvoyPlanner: React.FC<ConvoyPlannerProps> = ({ userLocation, onConvoyPlanned }) => {
  const [convoyName, setConvoyName] = useState('');
  const [startLat, setStartLat] = useState('');
  const [startLng, setStartLng] = useState('');
  const [endLat, setEndLat] = useState('');
  const [endLng, setEndLng] = useState('');
  const [isPlanning, setIsPlanning] = useState(false);

  React.useEffect(() => {
    if (userLocation) {
      setStartLat(userLocation[0].toFixed(6));
      setStartLng(userLocation[1].toFixed(6));
    }
  }, [userLocation]);

  const handlePlanConvoy = async () => {
    if (!convoyName.trim()) {
      toast.error('Please enter a convoy name');
      return;
    }

    if (!startLat || !startLng || !endLat || !endLng) {
      toast.error('Please fill in all coordinates');
      return;
    }

    const startLatNum = parseFloat(startLat);
    const startLngNum = parseFloat(startLng);
    const endLatNum = parseFloat(endLat);
    const endLngNum = parseFloat(endLng);

    if (isNaN(startLatNum) || isNaN(startLngNum) || isNaN(endLatNum) || isNaN(endLngNum)) {
      toast.error('Please enter valid coordinates');
      return;
    }

    setIsPlanning(true);
    const planningToast = toast.loading('Planning safe route...', {
      style: {
        background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
        color: '#fff',
        borderRadius: '12px',
      },
    });

    try {
      const response = await axios.post('http://localhost:8000/api/convoys', {
        name: convoyName,
        start: { lat: startLatNum, lng: startLngNum },
        end: { lat: endLatNum, lng: endLngNum }
      });

      const convoy = response.data;
      onConvoyPlanned(convoy);
      
      toast.success(`Convoy "${convoyName}" planned successfully!`, {
        id: planningToast,
        style: {
          background: 'linear-gradient(135deg, #10b981, #059669)',
          color: '#fff',
          borderRadius: '12px',
        },
      });

      
      setConvoyName('');
      setEndLat('');
      setEndLng('');

    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Failed to plan convoy';
      toast.error(errorMessage, {
        id: planningToast,
        style: {
          background: 'linear-gradient(135deg, #ef4444, #dc2626)',
          color: '#fff',
          borderRadius: '12px',
        },
      });
      console.error('Convoy planning error:', error);
    } finally {
      setIsPlanning(false);
    }
  };

  const useCurrentLocation = (isStart: boolean) => {
    if (!userLocation) {
      toast.error('Current location not available');
      return;
    }

    if (isStart) {
      setStartLat(userLocation[0].toFixed(6));
      setStartLng(userLocation[1].toFixed(6));
    } else {
      setEndLat(userLocation[0].toFixed(6));
      setEndLng(userLocation[1].toFixed(6));
    }
    
    toast.success('Location set successfully');
  };

  return (
    <div className="p-6 h-full">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
          <span className="text-white font-bold">🚛</span>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Convoy Planner</h2>
          <p className="text-xs text-gray-500">Plan safe routes avoiding threats</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Convoy Name</label>
          <input
            type="text"
            value={convoyName}
            onChange={(e) => setConvoyName(e.target.value)}
            placeholder="e.g., Medical Supply Convoy"
            className="w-full px-3 py-2 bg-white/50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Start Location</label>
            <button
              onClick={() => useCurrentLocation(true)}
              className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-md hover:bg-blue-200 transition-colors"
            >
              Use Current
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              step="any"
              value={startLat}
              onChange={(e) => setStartLat(e.target.value)}
              placeholder="Latitude"
              className="w-full px-3 py-2 bg-white/50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            />
            <input
              type="number"
              step="any"
              value={startLng}
              onChange={(e) => setStartLng(e.target.value)}
              placeholder="Longitude"
              className="w-full px-3 py-2 bg-white/50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            />
          </div>
        </div>

        {}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Destination</label>
            <button
              onClick={() => useCurrentLocation(false)}
              className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded-md hover:bg-green-200 transition-colors"
            >
              Use Current
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              step="any"
              value={endLat}
              onChange={(e) => setEndLat(e.target.value)}
              placeholder="Latitude"
              className="w-full px-3 py-2 bg-white/50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
            />
            <input
              type="number"
              step="any"
              value={endLng}
              onChange={(e) => setEndLng(e.target.value)}
              placeholder="Longitude"
              className="w-full px-3 py-2 bg-white/50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
            />
          </div>
        </div>

        {startLat && startLng && endLat && endLng && (
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-200">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">i</span>
              </div>
              <span className="font-medium text-gray-800">Route Information</span>
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              <div>Distance: {calculateDistance(
                parseFloat(startLat), parseFloat(startLng),
                parseFloat(endLat), parseFloat(endLng)
              ).toFixed(2)} km</div>
              <div>AI will plan the safest route avoiding all threat zones</div>
            </div>
          </div>
        )}

        <button
          onClick={handlePlanConvoy}
          disabled={isPlanning || !convoyName.trim() || !startLat || !startLng || !endLat || !endLng}
          className={`w-full py-3 px-4 rounded-xl font-medium transition-all duration-300 flex items-center justify-center space-x-2 ${
            isPlanning || !convoyName.trim() || !startLat || !startLng || !endLat || !endLng
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700 transform hover:scale-[1.02] shadow-lg hover:shadow-xl'
          }`}
        >
          {isPlanning && (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          )}
          <span>{isPlanning ? 'Planning Route...' : 'Plan Safe Route'}</span>
        </button>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              setConvoyName('');
              setStartLat('');
              setStartLng('');
              setEndLat('');
              setEndLng('');
            }}
            className="py-2 px-3 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors text-sm"
          >
            Clear All
          </button>
          <button
            onClick={() => {
              if (userLocation) {
                setStartLat(userLocation[0].toFixed(6));
                setStartLng(userLocation[1].toFixed(6));
                setEndLat((userLocation[0] + 0.01).toFixed(6));
                setEndLng((userLocation[1] + 0.01).toFixed(6));
                setConvoyName(`Convoy-${Date.now().toString().slice(-4)}`);
              }
            }}
            className="py-2 px-3 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors text-sm"
          >
            Quick Setup
          </button>
        </div>
      </div>
    </div>
  );
};


function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export default ConvoyPlanner;