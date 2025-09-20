import React, { useState, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

type DetectionSummary = {
  [key: string]: number;
};

const Spinner = () => (
  <div className="relative">
    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
  </div>
);


const UploadIcon = () => (
  <svg className="w-12 h-12 text-indigo-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg>
);

const DetectionPanel: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [detectionSummary, setDetectionSummary] = useState<DetectionSummary | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [lat, setLat] = useState<string>('20.2961');
  const [lng, setLng] = useState<string>('85.8245');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a video file first");
      return;
    }

    if (!lat || !lng) {
      toast.error("Please provide latitude and longitude");
      return;
    }

    const formData = new FormData();
    formData.append('video', selectedFile);
    formData.append('lat', lat);
    formData.append('lng', lng);

    setIsUploading(true);
    setDetectionSummary(null);
    const uploadToast = toast.loading('AI is analyzing your video...', {
      style: {
        background: 'linear-gradient(135deg, #667eea, #764ba2)',
        color: '#fff',
        borderRadius: '12px',
      },
    });

    try {
      const response = await axios.post('http://localhost:8000/api/detect', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      if (response.data.detection_summary) {
        setDetectionSummary(response.data.detection_summary);
        toast.success('Analysis completed successfully!', { 
          id: uploadToast,
          icon: '🎯',
          style: {
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: '#fff',
            borderRadius: '12px',
          },
        });
      } else if (response.data.message) {
        toast.success(response.data.message, { 
          id: uploadToast,
          style: {
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: '#fff',
            borderRadius: '12px',
          },
        });
        setDetectionSummary({ result: response.data.message });
      } else {
        toast.success('Analysis complete!', { 
          id: uploadToast,
          style: {
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: '#fff',
            borderRadius: '12px',
          },
        });
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Analysis failed';
      toast.error(errorMessage, { 
        id: uploadToast,
        style: {
          background: 'linear-gradient(135deg, #ef4444, #dc2626)',
          color: '#fff',
          borderRadius: '12px',
        },
      });
      console.error('Upload error:', err.response?.data || err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="p-6 h-full">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
          <span className="text-white font-bold">AI</span>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Threat Detection</h2>
          <p className="text-xs text-gray-500">Upload video for AI analysis</p>
        </div>
      </div>

      <div className="space-y-6">
        <div
          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 cursor-pointer ${
            isDragOver
              ? 'border-indigo-500 bg-indigo-50'
              : selectedFile
              ? 'border-green-500 bg-green-50'
              : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/50'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            className="hidden"
          />
          
          {selectedFile ? (
            <div className="space-y-3">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-800">{selectedFile.name}</p>
                <p className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFile(null);
                }}
                className="text-xs text-red-500 hover:text-red-700 underline"
              >
                Remove file
              </button>
            </div>
          ) : (
            <div>
              <UploadIcon />
              <p className="text-lg font-medium text-gray-800 mb-2">Upload Video</p>
              <p className="text-sm text-gray-500 mb-4">
                Drag and drop your video here, or click to browse
              </p>
              <p className="text-xs text-gray-400">Supported formats: MP4, AVI, MOV</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Latitude</label>
            <input
              type="number"
              step="any"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              className="w-full px-3 py-2 bg-white/50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
              placeholder="20.2961"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Longitude</label>
            <input
              type="number"
              step="any"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              className="w-full px-3 py-2 bg-white/50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
              placeholder="85.8245"
            />
          </div>
        </div>

        <button
          onClick={handleUpload}
          disabled={isUploading || !selectedFile}
          className={`w-full py-3 px-4 rounded-xl font-medium transition-all duration-300 flex items-center justify-center space-x-2 ${
            isUploading || !selectedFile
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 transform hover:scale-[1.02] shadow-lg hover:shadow-xl'
          }`}
        >
          {isUploading && <Spinner />}
          <span>{isUploading ? 'Analyzing Video...' : 'Analyze Video'}</span>
        </button>

        {detectionSummary && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">AI</span>
              </div>
              <h3 className="font-semibold text-gray-800">Detection Results</h3>
            </div>
            <div className="bg-white/70 rounded-lg p-3">
              {detectionSummary.result ? (
                <p className="text-sm text-gray-700">{detectionSummary.result}</p>
              ) : (
                <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                  {JSON.stringify(detectionSummary, null, 2)}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DetectionPanel;