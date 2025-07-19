"use client";
import { useEffect, useRef, useState } from "react";
import './globals.css'
import Navbar from "./components/ui/navbar";
import SplitText from "./components/ui/Text";

export default function FaceTrackingApp() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVideos, setRecordedVideos] = useState([]);
  const [detectionStatus, setDetectionStatus] = useState("Initializing...");
  const [cameraError, setCameraError] = useState(null);

  const mediaRecorder = useRef(null);
  const recordedChunks = useRef([]);
  const animationFrameId = useRef(null);
  const faceDetector = useRef(null);
  const lastDetections = useRef([]);

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

  // ENHANCED: Canvas detection elements with Tailwind-inspired colors and effects
  function drawTrackingBox(ctx, x, y, width, height, confidence) {
    const time = Date.now() * 0.003;
    const pulse = (Math.sin(time * 3) + 1) * 0.5;

    // Tailwind green-400 inspired colors with enhanced glow
    const primaryGreen = `rgba(34, 197, 94, ${0.9 + pulse * 0.1})`;     // green-500
    const accentCyan = `rgba(6, 182, 212, ${0.8 + pulse * 0.2})`;       // cyan-500
    const glowGreen = `rgba(74, 222, 128, ${0.6 + pulse * 0.4})`;       // green-400

    // Main tracking rectangle - Tailwind green-500 with glow effect
    ctx.shadowColor = glowGreen;
    ctx.shadowBlur = 15 + pulse * 8;
    ctx.strokeStyle = primaryGreen;
    ctx.lineWidth = 4;
    ctx.strokeRect(x, y, width, height);
    ctx.shadowBlur = 0;

    // Enhanced corner markers - Tailwind emerald theme
    const cornerSize = 30;
    const cornerThickness = 5;
    ctx.fillStyle = `rgba(16, 185, 129, ${0.9 + pulse * 0.1})`; // emerald-500

    // Top-left corner
    ctx.fillRect(x, y, cornerSize, cornerThickness);
    ctx.fillRect(x, y, cornerThickness, cornerSize);

    // Top-right corner
    ctx.fillRect(x + width - cornerSize, y, cornerSize, cornerThickness);
    ctx.fillRect(x + width - cornerThickness, y, cornerThickness, cornerSize);

    // Bottom-left corner
    ctx.fillRect(x, y + height - cornerThickness, cornerSize, cornerThickness);
    ctx.fillRect(x, y + height - cornerSize, cornerThickness, cornerSize);

    // Bottom-right corner
    ctx.fillRect(x + width - cornerSize, y + height - cornerThickness, cornerSize, cornerThickness);
    ctx.fillRect(x + width - cornerThickness, y + height - cornerSize, cornerThickness, cornerSize);

    // Center crosshair - Tailwind lime-400 inspired
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const crossSize = 25;

    ctx.shadowColor = `rgba(163, 230, 53, 0.8)`; // lime-400
    ctx.shadowBlur = 12;
    ctx.strokeStyle = `rgba(132, 204, 22, ${0.9 + pulse * 0.1})`; // lime-500
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centerX - crossSize, centerY);
    ctx.lineTo(centerX + crossSize, centerY);
    ctx.moveTo(centerX, centerY - crossSize);
    ctx.lineTo(centerX, centerY + crossSize);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Confidence display - Tailwind slate theme
    if (confidence) {
      const confidenceText = `${(confidence * 100).toFixed(1)}%`;
      ctx.font = "bold 18px system-ui";

      // Background - Tailwind slate-800 with opacity
      ctx.fillStyle = `rgba(30, 41, 59, 0.9)`; // slate-800
      ctx.fillRect(x, y - 40, 90, 35);

      // Border - Tailwind green-400
      ctx.strokeStyle = `rgba(74, 222, 128, 0.8)`;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y - 40, 90, 35);

      // Text - Tailwind green-300
      ctx.fillStyle = `rgb(134, 239, 172)`; // green-300
      ctx.fillText(confidenceText, x + 8, y - 18);
    }

    // Scanning line animation - Tailwind cyan-400
    const scanY = y + (Math.sin(time * 4) + 1) * 0.5 * height;
    ctx.shadowColor = `rgba(34, 211, 238, 0.6)`; // cyan-400
    ctx.shadowBlur = 8;
    ctx.strokeStyle = `rgba(6, 182, 212, ${0.7 + pulse * 0.3})`; // cyan-500
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, scanY);
    ctx.lineTo(x + width, scanY);
    ctx.stroke();
    ctx.shadowBlur = 0;



    ctx.shadowBlur = 0; // Reset shadow
  }

  // ENHANCED: Searching indicator with Tailwind colors
  function drawSearchingIndicator(ctx) {
    const time = Date.now() * 0.003;
    const pulse = (Math.sin(time * 4) + 1) * 0.5;

    ctx.font = "bold 20px system-ui";
    const text = "🔍 SEARCHING FOR FACE...";
    const textWidth = ctx.measureText(text).width;

    // Background - Tailwind gray-900 with opacity
    ctx.fillStyle = `rgba(17, 24, 39, ${0.85 + pulse * 0.15})`; // gray-900
    ctx.fillRect((ctx.canvas.width - textWidth) / 2 - 20, 25, textWidth + 40, 50);

    // Border - Tailwind yellow-400 with glow
    ctx.shadowColor = `rgba(250, 204, 21, 0.6)`; // yellow-400
    ctx.shadowBlur = 10;
    ctx.strokeStyle = `rgba(245, 158, 11, ${0.8 + pulse * 0.2})`; // amber-500
    ctx.lineWidth = 3;
    ctx.strokeRect((ctx.canvas.width - textWidth) / 2 - 20, 25, textWidth + 40, 50);
    ctx.shadowBlur = 0;

    // Text - Tailwind amber-300
    ctx.fillStyle = `rgb(252, 211, 77, ${0.9 + pulse * 0.1})`; // amber-300
    ctx.fillText(text, (ctx.canvas.width - textWidth) / 2, 55);

    // Radar effect - Tailwind orange-400
    const centerX = ctx.canvas.width / 2;
    const centerY = ctx.canvas.height / 2;
    const radarRadius = 120 + pulse * 25;

    ctx.shadowColor = `rgba(251, 146, 60, 0.4)`; // orange-400
    ctx.shadowBlur = 15;
    ctx.strokeStyle = `rgba(249, 115, 22, ${0.4 + pulse * 0.3})`; // orange-500
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radarRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // All other functions remain unchanged...
  async function startRecording() {
    if (!videoRef.current?.srcObject) {
      alert('Camera not available');
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
      alert('Failed to start recording: ' + error.message);
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

    alert('✅ Video recorded and saved successfully!');
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

    alert('Video deleted successfully');
  }

  function clearAllVideos() {
    recordedVideos.forEach(video => {
      localStorage.removeItem(`video_${video.id}`);
    });
    localStorage.removeItem('faceTrackingVideos');
    setRecordedVideos([]);
    alert('All videos cleared');
  }

  function stopCamera() {
    if (videoRef.current?.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
    }
  }

  if (cameraError) {
    return (
      <div style={{ backgroundColor: 'black', color: 'white' }}>
        <h1>Camera Error</h1>
        <p>{cameraError}</p>
        <p>Please ensure camera and microphone permissions are granted and refresh the page.</p>
        <button onClick={() => window.location.reload()}>Refresh Page</button>
      </div>
    );
  }












  return (
    <div className="bg-black text-white min-h-screen">
      <Navbar />
      
      <div className="pt-20 flex items-center justify-center">
        <SplitText
          text="Face Tracking Video Recorder"
          className="text-2xl font-semibold text-center"
          delay={100}
          duration={0.6}
          ease="power3.out"
          splitType="chars"
          from={{ opacity: 0, y: 40 }}
          to={{ opacity: 1, y: 0 }}
          threshold={0.1}
          rootMargin="-100px"
        />
      </div>
  
      <div className="pt-8 flex items-center justify-center">
        <p className="text-sm text-gray-400">Real-time face detection with video recording</p>
      </div>
  
      <div className="max-w-xl w-full mx-auto pt-4 relative">
        <div className="relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-auto object-cover rounded-lg transform scale-x-[-1]"
          />
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full transform scale-x-[-1]"
          />
  
          {isRecording && (
            <div className="absolute top-3 right-3 text-red-500 font-bold text-sm animate-pulse">
              REC
            </div>
          )}
  
          <div className="absolute bottom-3 left-3 bg-black/70 px-4 py-2 rounded-lg text-sm">
            {detectionStatus}
            <div className="mt-2 flex space-x-2">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="px-4 py-2 rounded-full border border-white bg-transparent text-white text-xs hover:bg-white/10 transition"
                >
                  Start Recording
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="px-4 py-2 rounded-full border border-white bg-transparent text-white text-xs hover:bg-white/10 transition"
                >
                  Stop Recording
                </button>
              )}
            </div>
          </div>
        </div>
  
        <div className="pt-6 text-center">
          <h2 className="text-lg font-semibold">Recorded Videos</h2>
          {recordedVideos.length > 0 && (
            <button
              onClick={clearAllVideos}
              className="mt-2 px-4 py-2 rounded-full border border-white bg-transparent text-white text-xs hover:bg-white/10 transition"
            >
              Clear All
            </button>
          )}
  
          {recordedVideos.length === 0 ? (
            <p className="mt-4 text-gray-500 text-sm">No videos recorded yet</p>
          ) : (
            <div className="mt-4 space-y-4">
              {recordedVideos.map((video) => (
                <div key={video.id} className="bg-white/5 p-4 rounded-lg">
                  <h3 className="text-sm font-medium">Video {video.id}</h3>
                  <p className="text-xs text-gray-400">
                    {new Date(video.timestamp).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400">
                    {(video.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
  
                  <div className="mt-2 flex space-x-2">
                    <button
                      onClick={() => downloadVideo(video)}
                      className="px-3 py-1 rounded-full border border-white bg-transparent text-xs hover:bg-white/10 transition"
                    >
                      Download
                    </button>
                    <button
                      onClick={() => deleteVideo(video.id)}
                      className="px-3 py-1 rounded-full border border-white bg-transparent text-xs hover:bg-white/10 transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
  





}
