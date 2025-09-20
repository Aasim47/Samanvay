import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';
import toast from 'react-hot-toast';

interface CommunicationSuiteProps {
  userLocation: [number, number] | null;
}

interface Message {
  id?: number;
  sid: string;
  text: string;
  timestamp: string;
}

const CommunicationSuite: React.FC<CommunicationSuiteProps> = ({ userLocation }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(1);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    
    const loadMessages = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/messages');
        if (response.ok) {
          const data = await response.json();
          setMessages(data);
        }
      } catch (error) {
        console.error('Failed to load messages:', error);
      }
    };

    loadMessages();

    const handleConnect = () => {
      setIsConnected(true);
      toast.success('Connected to emergency channel', {
        icon: '📡',
        style: {
          background: 'linear-gradient(135deg, #10b981, #059669)',
          color: '#fff',
          borderRadius: '12px',
        },
      });
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      toast.error('Disconnected from emergency channel', {
        icon: '📡',
        style: {
          background: 'linear-gradient(135deg, #ef4444, #dc2626)',
          color: '#fff',
          borderRadius: '12px',
        },
      });
    };

    const handleMessage = (data: { sid: string; text: string }) => {
      const newMsg: Message = {
        sid: data.sid,
        text: data.text,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, newMsg]);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('message', handleMessage);

    
    if (socket.connected) {
      setIsConnected(true);
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('message', handleMessage);
    };
  }, []);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim()) return;
    
    if (!isConnected) {
      toast.error('Not connected to emergency channel');
      return;
    }

    setIsSending(true);
    
    try {
      socket.emit('message', newMessage.trim());
      setNewMessage('');
      inputRef.current?.focus();
    } catch (error) {
      toast.error('Failed to send message');
      console.error('Send message error:', error);
    } finally {
      setIsSending(false);
    }
  };

  const sendEmergencySOS = () => {
    if (!userLocation) {
      toast.error('Location not available for SOS');
      return;
    }

    if (!isConnected) {
      toast.error('Not connected to emergency channel');
      return;
    }

    const confirmSOS = window.confirm('Send emergency SOS alert to all units?');
    
    if (confirmSOS) {
      socket.emit('sos', {
        lat: userLocation[0],
        lng: userLocation[1],
        severity: 'Critical',
        intensity: 10
      });

      toast.success('Emergency SOS sent to all units!', {
        icon: '🚨',
        duration: 6000,
        style: {
          background: 'linear-gradient(135deg, #ef4444, #dc2626)',
          color: '#fff',
          borderRadius: '12px',
        },
      });
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatSID = (sid: string) => {
    return `User-${sid.slice(-4)}`;
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold">💬</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Emergency Chat</h2>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <p className="text-xs text-gray-500">
                {isConnected ? `${onlineUsers} online` : 'Disconnected'}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={sendEmergencySOS}
          className="bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2 rounded-lg font-medium hover:from-red-600 hover:to-red-700 transition-all duration-300 transform hover:scale-105 shadow-lg text-sm"
        >
          🚨 SOS
        </button>
      </div>

      <div className="flex-1 bg-gradient-to-b from-gray-50 to-white rounded-xl p-4 mb-4 overflow-y-auto max-h-64 border border-gray-100">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-gray-400 text-xl">💬</span>
            </div>
            <p className="text-gray-500 text-sm">Emergency communication channel</p>
            <p className="text-gray-400 text-xs mt-1">Messages will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message, index) => (
              <div
                key={`${message.sid}-${index}`}
                className={`flex ${message.sid === socket.id ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-xl ${
                    message.sid === socket.id
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-800 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-medium ${
                      message.sid === socket.id ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {message.sid === socket.id ? 'You' : formatSID(message.sid)}
                    </span>
                    <span className={`text-xs ${
                      message.sid === socket.id ? 'text-blue-200' : 'text-gray-400'
                    }`}>
                      {formatTime(message.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm break-words">{message.text}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <form onSubmit={sendMessage} className="space-y-3">
        <div className="flex space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={isConnected ? "Type emergency message..." : "Connecting..."}
            disabled={!isConnected || isSending}
            className={`flex-1 px-4 py-2 rounded-xl border transition-all duration-200 ${
              isConnected
                ? 'bg-white border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-transparent'
                : 'bg-gray-100 border-gray-200 cursor-not-allowed text-gray-500'
            }`}
            maxLength={500}
          />
          <button
            type="submit"
            disabled={!isConnected || !newMessage.trim() || isSending}
            className={`px-6 py-2 rounded-xl font-medium transition-all duration-300 ${
              !isConnected || !newMessage.trim() || isSending
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 transform hover:scale-105 shadow-lg'
            }`}
          >
            {isSending ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              'Send'
            )}
          </button>
        </div>
        
        {newMessage.length > 0 && (
          <div className="flex justify-between items-center text-xs text-gray-500">
            <span>{newMessage.length}/500 characters</span>
            <span>Press Enter to send</span>
          </div>
        )}
      </form>

      <div className="grid grid-cols-3 gap-2 mt-4">
        <button
          onClick={() => setNewMessage('Medical assistance needed')}
          className="py-2 px-3 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors text-xs"
        >
          Medical
        </button>
        <button
          onClick={() => setNewMessage('Requesting backup support')}
          className="py-2 px-3 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors text-xs"
        >
          Backup
        </button>
        <button
          onClick={() => setNewMessage('All clear, situation normal')}
          className="py-2 px-3 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors text-xs"
        >
          All Clear
        </button>
      </div>
    </div>
  );
};

export default CommunicationSuite;