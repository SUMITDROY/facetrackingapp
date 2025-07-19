"use client";
import { useEffect, useRef, useState } from "react";
import './globals.css'
import Navbar from "./components/ui/navbar";
import SplitText from "./components/ui/Text";
import GradientText from "./components/ui/GradientText";
import Instruction from "./components/ui/instruction";
import { motion } from "framer-motion";
import React from "react";

function NotificationToast({ notification, onClose }) {
  if (!notification) return null;

  const bgColor = notification.type === 'success' ? 'bg-green-500/20 border-green-400' : 
                  notification.type === 'error' ? 'bg-red-500/20 border-red-400' : 
                  'bg-blue-500/20 border-blue-400';
  
  const iconColor = notification.type === 'success' ? 'text-green-400' : 
                    notification.type === 'error' ? 'text-red-400' : 
                    'text-blue-400';

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top duration-300">
      <div className={`${bgColor} border backdrop-blur-md rounded-lg p-4 max-w-sm shadow-2xl`}>
        <div className="flex items-center space-x-3">
          <div className={`${iconColor} text-lg`}>
            {notification.type === 'success' ? '✅' : 
             notification.type === 'error' ? '❌' : 'ℹ️'}
          </div>
          <p className="text-white text-sm font-medium flex-1">{notification.message}</p>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-lg"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FaceTrackingApp() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVideos, setRecordedVideos] = useState([]);
  const [detectionStatus, setDetectionStatus] = useState("Initializing...");
  const [cameraError, setCameraError] = useState(null);
  const [notification, setNotification] = useState(null);

  const mediaRecorder = useRef(null);
  const recordedChunks = useRef([]);
  const animationFrameId = useRef(null);
  const faceDetector = useRef(null);
  const lastDetections = useRef([]);

  function showNotification(message, type = 'success') {
    setNotification({ message, type, id: Date.now() });
    setTimeout(() => setNotification(null), 4000);
  }

  useEffect(() => {
    initializeApp();
    loadStoredVideos();

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      stopCamera();
    };
  }, []);

  async function initializeApp() {
    try {
      await setupCamera();
      await setupFaceDetection();
      startDetectionLoop();
    } catch (error) {
      console.error("App initialization failed:", error);
      setCameraError(error.message);
    }
  }

  async function setupCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user"
        },
        audio: true
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        await new Promise((resolve) => {
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();

            const canvas = canvasRef.current;
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            console.log(`Canvas set to: ${canvas.width}x${canvas.height}`);

            resolve();
          };
        });
      }

      setDetectionStatus("Camera ready");
    } catch (error) {
      throw new Error(`Camera access failed: ${error.message}`);
    }
  }

  async function setupFaceDetection() {
    try {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4/face_detection.js';
      document.head.appendChild(script);

      await new Promise((resolve, reject) => {
        script.onload = async () => {
          try {
            if (window.FaceDetection) {
              const detection = new window.FaceDetection({
                locateFile: (file) =>
                  `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4/${file}`
              });

              detection.setOptions({
                model: 'short',
                minDetectionConfidence: 0.5,
              });

              detection.onResults((results) => {
                console.log("MediaPipe results:", results?.detections?.length || 0);
                if (results && results.detections) {
                  lastDetections.current = results.detections;
                }
              });

              await detection.initialize();
              faceDetector.current = detection;
              setDetectionStatus("✅ Face detection active");
              resolve();
            } else {
              reject(new Error("MediaPipe not available"));
            }
          } catch (error) {
            reject(error);
          }
        };

        script.onerror = () => reject(new Error("Failed to load MediaPipe"));
      });
    } catch (error) {
      console.warn("MediaPipe failed, using fallback:", error);
      setDetectionStatus("⚠️ Using fallback detection");
      setupMouseTracking();
    }
  }

  function setupMouseTracking() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let mouseX = canvas.width / 2;
    let mouseY = canvas.height / 2;

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = (e.clientX - rect.left) / rect.width * canvas.width;
      mouseY = (e.clientY - rect.top) / rect.height * canvas.height;
    });

    setInterval(() => {
      lastDetections.current = [{
        boundingBox: {
          xCenter: mouseX / canvas.width,
          yCenter: mouseY / canvas.height,
          width: 0.25,
          height: 0.35
        },
        score: 0.95
      }];
    }, 100);
  }

  function startDetectionLoop() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    async function detectAndDraw() {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      try {
        if (faceDetector.current && video.videoWidth > 0 && video.readyState >= 2) {
          await faceDetector.current.send({ image: video });
        }

        drawFaceMarkers(ctx, lastDetections.current);

      } catch (error) {
        console.warn("Detection error:", error);
        drawSearchingIndicator(ctx);
      }

      animationFrameId.current = requestAnimationFrame(detectAndDraw);
    }

    detectAndDraw();
  }

  function drawFaceMarkers(ctx, detections) {
    if (!detections || detections.length === 0) {
      drawSearchingIndicator(ctx);
      return;
    }

    console.log("Drawing markers for", detections.length, "faces");

    detections.forEach((detection) => {
      const bbox = detection.boundingBox;

      const x = (bbox.xCenter - bbox.width / 2) * ctx.canvas.width;
      const y = (bbox.yCenter - bbox.height / 2) * ctx.canvas.height;
      const width = bbox.width * ctx.canvas.width;
      const height = bbox.height * ctx.canvas.height;

      drawTrackingBox(ctx, x, y, width, height, detection.score);
    });
  }

  function drawTrackingBox(ctx, x, y, width, height, confidence) {
    const time = Date.now() * 0.003;
    const pulse = (Math.sin(time * 3) + 1) * 0.5;

    const primaryGreen = `rgba(34, 197, 94, ${0.9 + pulse * 0.1})`;
    const accentCyan = `rgba(6, 182, 212, ${0.8 + pulse * 0.2})`;
    const glowGreen = `rgba(74, 222, 128, ${0.6 + pulse * 0.4})`;

    ctx.shadowColor = glowGreen;
    ctx.shadowBlur = 15 + pulse * 8;
    ctx.strokeStyle = primaryGreen;
    ctx.lineWidth = 4;
    ctx.strokeRect(x, y, width, height);
    ctx.shadowBlur = 0;

    const cornerSize = 30;
    const cornerThickness = 5;
    ctx.fillStyle = `rgba(16, 185, 129, ${0.9 + pulse * 0.1})`;

    ctx.fillRect(x, y, cornerSize, cornerThickness);
    ctx.fillRect(x, y, cornerThickness, cornerSize);
    ctx.fillRect(x + width - cornerSize, y, cornerSize, cornerThickness);
    ctx.fillRect(x + width - cornerThickness, y, cornerThickness, cornerSize);
    ctx.fillRect(x, y + height - cornerThickness, cornerSize, cornerThickness);
    ctx.fillRect(x, y + height - cornerSize, cornerThickness, cornerSize);
    ctx.fillRect(x + width - cornerSize, y + height - cornerThickness, cornerSize, cornerThickness);
    ctx.fillRect(x + width - cornerThickness, y + height - cornerSize, cornerThickness, cornerSize);

    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const crossSize = 25;

    ctx.shadowColor = `rgba(163, 230, 53, 0.8)`;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = `rgba(132, 204, 22, ${0.9 + pulse * 0.1})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centerX - crossSize, centerY);
    ctx.lineTo(centerX + crossSize, centerY);
    ctx.moveTo(centerX, centerY - crossSize);
    ctx.lineTo(centerX, centerY + crossSize);
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (confidence) {
      const confidenceText = `${(confidence * 100).toFixed(1)}%`;
      ctx.font = "bold 18px system-ui";

      ctx.fillStyle = `rgba(30, 41, 59, 0.9)`;
      ctx.fillRect(x, y - 40, 90, 35);

      ctx.strokeStyle = `rgba(74, 222, 128, 0.8)`;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y - 40, 90, 35);

      ctx.fillStyle = `rgb(134, 239, 172)`;
      ctx.fillText(confidenceText, x + 8, y - 18);
    }

    const scanY = y + (Math.sin(time * 4) + 1) * 0.5 * height;
    ctx.shadowColor = `rgba(34, 211, 238, 0.6)`;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = `rgba(6, 182, 212, ${0.7 + pulse * 0.3})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, scanY);
    ctx.lineTo(x + width, scanY);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function drawSearchingIndicator(ctx) {
    const time = Date.now() * 0.003;
    const pulse = (Math.sin(time * 4) + 1) * 0.5;

    ctx.font = "bold 20px system-ui";
    const text = "🔍 SEARCHING FOR FACE...";
    const textWidth = ctx.measureText(text).width;

    ctx.fillStyle = `rgba(17, 24, 39, ${0.85 + pulse * 0.15})`;
    ctx.fillRect((ctx.canvas.width - textWidth) / 2 - 20, 25, textWidth + 40, 50);

    ctx.shadowColor = `rgba(250, 204, 21, 0.6)`;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = `rgba(245, 158, 11, ${0.8 + pulse * 0.2})`;
    ctx.lineWidth = 3;
    ctx.strokeRect((ctx.canvas.width - textWidth) / 2 - 20, 25, textWidth + 40, 50);
    ctx.shadowBlur = 0;

    ctx.fillStyle = `rgb(252, 211, 77, ${0.9 + pulse * 0.1})`;
    ctx.fillText(text, (ctx.canvas.width - textWidth) / 2, 55);

    const centerX = ctx.canvas.width / 2;
    const centerY = ctx.canvas.height / 2;
    const radarRadius = 120 + pulse * 25;

    ctx.shadowColor = `rgba(251, 146, 60, 0.4)`;
    ctx.shadowBlur = 15;
    ctx.strokeStyle = `rgba(249, 115, 22, ${0.4 + pulse * 0.3})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radarRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  async function startRecording() {
    if (!videoRef.current?.srcObject) {
      showNotification('Camera not available', 'error');
      return;
    }

    try {
      const compositeCanvas = document.createElement('canvas');
      const compositeCtx = compositeCanvas.getContext('2d');
      const video = videoRef.current;
      const overlay = canvasRef.current;

      compositeCanvas.width = video.videoWidth;
      compositeCanvas.height = video.videoHeight;

      function drawComposite() {
        if (video.videoWidth > 0) {
          compositeCtx.drawImage(video, 0, 0);
          compositeCtx.drawImage(overlay, 0, 0);
        }

        if (isRecording) {
          requestAnimationFrame(drawComposite);
        }
      }

      drawComposite();
      const stream = compositeCanvas.captureStream(30);

      const audioTracks = video.srcObject.getAudioTracks();
      audioTracks.forEach(track => stream.addTrack(track));

      mediaRecorder.current = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9,opus'
      });

      recordedChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.current.push(event.data);
        }
      };

      mediaRecorder.current.onstop = () => {
        const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
        saveVideoLocally(blob);
      };

      mediaRecorder.current.start(100);
      setIsRecording(true);

    } catch (error) {
      console.error('Recording start failed:', error);
      showNotification(`Failed to start recording: ${error.message}`, 'error');
    }
  }

  function stopRecording() {
    if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
      mediaRecorder.current.stop();
      setIsRecording(false);
    }
  }

  function saveVideoLocally(blob) {
    const videoData = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      size: blob.size,
      url: URL.createObjectURL(blob)
    };

    const updatedVideos = [...recordedVideos, videoData];
    setRecordedVideos(updatedVideos);

    const videosToStore = updatedVideos.map(v => ({
      id: v.id,
      timestamp: v.timestamp,
      size: v.size
    }));

    localStorage.setItem('faceTrackingVideos', JSON.stringify(videosToStore));

    try {
      const reader = new FileReader();
      reader.onload = () => {
        localStorage.setItem(`video_${videoData.id}`, reader.result);
        console.log(`Video ${videoData.id} saved to localStorage`);
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.warn('Failed to save video to localStorage:', error);
    }

    showNotification('Video recorded and saved successfully!', 'success');
  }

  function loadStoredVideos() {
    try {
      const stored = localStorage.getItem('faceTrackingVideos');
      if (stored) {
        const videoList = JSON.parse(stored);
        const loadedVideos = videoList.map(video => {
          const storedBlob = localStorage.getItem(`video_${video.id}`);
          return storedBlob ? { ...video, url: storedBlob } : null;
        }).filter(Boolean);

        setRecordedVideos(loadedVideos);
        console.log(`Loaded ${loadedVideos.length} videos from localStorage`);
      }
    } catch (error) {
      console.warn('Failed to load stored videos:', error);
    }
  }

  function downloadVideo(video) {
    const link = document.createElement('a');
    link.href = video.url;
    link.download = `face-tracking-${video.id}.webm`;
    link.click();
  }

  function deleteVideo(videoId) {
    const updatedVideos = recordedVideos.filter(v => v.id !== videoId);
    setRecordedVideos(updatedVideos);

    localStorage.removeItem(`video_${videoId}`);
    localStorage.setItem('faceTrackingVideos', JSON.stringify(
      updatedVideos.map(v => ({ id: v.id, timestamp: v.timestamp, size: v.size }))
    ));

    showNotification('Video deleted successfully', 'success');
  }

  function clearAllVideos() {
    recordedVideos.forEach(video => {
      localStorage.removeItem(`video_${video.id}`);
    });
    localStorage.removeItem('faceTrackingVideos');
    setRecordedVideos([]);
    showNotification('All videos cleared', 'success');
  }

  function stopCamera() {
    if (videoRef.current?.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
    }
  }

  // Modern Camera Error Screen
  if (cameraError) {
    return (
      <div className="min-h-screen w-full bg-[#020617] relative">
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `
              radial-gradient(circle at 50% 100%, rgba(70, 85, 110, 0.5) 0%, transparent 60%),
              radial-gradient(circle at 50% 100%, rgba(99, 102, 241, 0.4) 0%, transparent 70%),
              radial-gradient(circle at 50% 100%, rgba(181, 184, 208, 0.3) 0%, transparent 80%)
            `,
          }}
        />

        <div className="relative z-10 text-white min-h-screen">
          <Navbar />
          
          <div className="flex items-center justify-center min-h-[80vh] px-4 sm:px-6 lg:px-8">
            <div className="max-w-sm sm:max-w-md w-full text-center">
              {/* Error Icon */}
              <div className="mb-6 sm:mb-8">
                <div className="mx-auto w-20 h-20 sm:w-24 sm:h-24 bg-red-500/20 border border-red-400/30 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 sm:w-12 sm:h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2zM8 12h4m-2-2v4" 
                    />
                  </svg>
                </div>
              </div>

              {/* Error Title */}
              <GradientText
                colors={["#ef4444", "#f87171", "#ef4444"]}
                animationSpeed={2}
                showBorder={false}
                className="text-2xl sm:text-3xl font-bold mb-4"
              >
                Camera Access Error
              </GradientText>

              {/* Error Message */}
              <div className="bg-white/5 border border-red-400/30 backdrop-blur-sm rounded-lg p-4 sm:p-6 mb-6">
                <p className="text-red-300 text-sm mb-3 font-medium">
                  {cameraError}
                </p>
                <div className="text-gray-400 text-xs space-y-2">
                  <p>• Ensure camera and microphone permissions are granted</p>
                  <p>• Check if another application is using your camera</p>
                  <p>• Try refreshing the page or restarting your browser</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full px-4 sm:px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-lg font-medium transition-all duration-200 transform hover:scale-[1.02] text-sm sm:text-base"
                >
                  🔄 Refresh Page
                </button>
                
                <button
                  onClick={() => {
                    navigator.permissions.query({name: 'camera'}).then(result => {
                      if (result.state === 'prompt') {
                        window.location.reload();
                      }
                    });
                  }}
                  className="w-full px-4 sm:px-6 py-3 border border-white/20 hover:bg-white/5 rounded-lg font-medium transition-all duration-200 text-sm sm:text-base"
                >
                  🎥 Request Camera Access
                </button>
              </div>

              {/* Help Text */}
              <p className="text-gray-500 text-xs mt-6">
                Having trouble? Make sure you're using HTTPS and your browser supports camera access.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#020617] relative">
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `
            radial-gradient(circle at 50% 100%, rgba(10, 10, 10, 0.7) 0%, transparent 50%),
            radial-gradient(circle at 50% 80%, rgba(20, 20, 20, 0.6) 0%, transparent 55%),
            radial-gradient(circle at 50% 60%, rgba(30, 30, 30, 0.5) 0%, transparent 60%),
            radial-gradient(circle at 50% 40%, rgba(50, 50, 50, 0.4) 0%, transparent 65%),
            radial-gradient(circle at 50% 20%, rgba(80, 80, 80, 0.3) 0%, transparent 70%)
          `,
        }}
      />

      {/* Modern Notification Toast */}
      <NotificationToast 
        notification={notification} 
        onClose={() => setNotification(null)} 
      />

      <div className="relative z-10 text-white min-h-screen">
        <Navbar />

        {/* Hero Section */}
        <div className="pt-16 sm:pt-20 px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <GradientText
              colors={["#dc2626", "#ef4444", "#f87171", "#fca5a5", "#dc2626"]}
              animationSpeed={3}
              showBorder={false}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight"
            >
              Face Tracker & Recorder
            </GradientText>
            <div className="mt-3 sm:mt-4">
              <p className="text-sm sm:text-base md:text-lg text-gray-300 font-medium tracking-wide">
                Advanced Real-Time Face Detection & Video Recording
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="mt-8 sm:mt-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-xl mx-auto">
            {/* Video Container */}
            <div className="relative bg-black/20 backdrop-blur-sm rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-auto object-cover transform scale-x-[-1]"
              />
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full transform scale-x-[-1]"
              />

              {/* Recording Indicator */}
              {isRecording && (
                <div className="absolute top-3 right-3 bg-red-500/90 backdrop-blur-sm rounded-full px-3 py-1 flex items-center space-x-2 animate-pulse">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  <span className="text-white text-xs font-bold">REC</span>
                </div>
              )}

              {/* Controls Overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-4">
                <div className="flex flex-col sm:flex-row items-center justify-between space-y-3 sm:space-y-0">
                  {/* Status */}
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-white text-sm font-medium">{detectionStatus}</span>
                  </div>

                  {/* Recording Button */}
                  <div className="flex space-x-2">
                    {!isRecording ? (
                      <button
                        onClick={startRecording}
                        className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-full text-white text-sm font-medium transition-all duration-200 transform hover:scale-105 shadow-lg"
                      >
                        ⏺ Start Recording
                      </button>
                    ) : (
                      <button
                        onClick={stopRecording}
                        className="px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 rounded-full text-white text-sm font-medium transition-all duration-200 transform hover:scale-105 shadow-lg"
                      >
                        ⏹ Stop Recording
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Videos Section */}
            <div className="mt-8 sm:mt-12">
              <div className="text-center mb-6">
                <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-red-400 to-rose-300 bg-clip-text text-transparent mb-2">
                  Recorded Sessions
                </h2>
                <p className="text-gray-400 text-sm">
                  Your face tracking recordings are stored locally
                </p>
                
                {recordedVideos.length > 0 && (
                  <button
                    onClick={clearAllVideos}
                    className="mt-4 px-4 py-2 border border-red-400/30 hover:border-red-400/50 bg-red-500/10 hover:bg-red-500/20 rounded-full text-red-300 hover:text-red-200 text-sm font-medium transition-all duration-200"
                  >
                    🗑 Clear All Videos
                  </button>
                )}
              </div>

              {recordedVideos.length === 0 ? (
                <div className="text-center py-12 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-600/20 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-400 text-sm font-medium">
                    No recordings yet. Start your first session!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recordedVideos.map((video) => (
                    <div
                      key={video.id}
                      className="relative bg-white/5 backdrop-blur-md rounded-xl p-4 sm:p-6 border border-white/10 shadow-lg overflow-hidden group transition-all duration-300 hover:border-red-400/30 hover:bg-white/10"
                    >
                      {/* Hover Gradient Effect */}
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-xl bg-gradient-to-br from-red-500/5 via-transparent to-rose-500/5"></div>

                      <div className="relative z-10">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
                          <div>
                            <h3 className="text-base sm:text-lg font-semibold text-white mb-1 bg-gradient-to-r from-red-300 to-rose-200 bg-clip-text text-transparent">
                              Recording #{video.id.toString().slice(-4)}
                            </h3>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 text-xs text-gray-400 space-y-1 sm:space-y-0">
                              <span className="flex items-center space-x-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>{new Date(video.timestamp).toLocaleDateString()}</span>
                              </span>
                              <span className="flex items-center space-x-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h4a1 1 0 011 1v2m3 0V2a1 1 0 011-1h2a1 1 0 011 1v2m0 0a2 2 0 012 2v1a1 1 0 01-1 1H4a1 1 0 01-1-1V6a2 2 0 012-2m10 0V9a1 1 0 01-1 1H6a1 1 0 01-1-1V4h10z" />
                                </svg>
                                <span>{new Date(video.timestamp).toLocaleTimeString()}</span>
                              </span>
                              <span className="flex items-center space-x-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span>{(video.size / (1024 * 1024)).toFixed(1)} MB</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                          <button
                            onClick={() => downloadVideo(video)}
                            className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-blue-500/20 to-blue-600/20 hover:from-blue-500/30 hover:to-blue-600/30 border border-blue-400/30 hover:border-blue-400/50 rounded-lg text-blue-300 hover:text-blue-200 text-sm font-medium transition-all duration-200 flex items-center justify-center space-x-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span>Download</span>
                          </button>
                          <button
                            onClick={() => deleteVideo(video.id)}
                            className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-red-500/20 to-red-600/20 hover:from-red-500/30 hover:to-red-600/30 border border-red-400/30 hover:border-red-400/50 rounded-lg text-red-300 hover:text-red-200 text-sm font-medium transition-all duration-200 flex items-center justify-center space-x-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="mt-8 sm:mt-12 pb-8">   
              <Instruction/>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
