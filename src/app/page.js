"use client";
import { useEffect, useRef, useState } from "react";
import "./globals.css";
import Navbar from "./components/ui/navbar";
import GradientText from "./components/ui/GradientText";
import Instruction from "./components/ui/instruction";

function NotificationToast({ notification, onClose }) {
  if (!notification) return null;
  const bgColor =
    notification.type === "success"
      ? "bg-green-500/20 border-green-400"
      : notification.type === "error"
      ? "bg-red-500/20 border-red-400"
      : "bg-blue-500/20 border-blue-400";
  const iconColor =
    notification.type === "success"
      ? "text-green-400"
      : notification.type === "error"
      ? "text-red-400"
      : "text-blue-400";
  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top duration-300">
      <div className={`${bgColor} border backdrop-blur-md rounded-lg p-4 max-w-sm shadow-2xl`}>
        <div className="flex items-center space-x-3">
          <div className={`${iconColor} text-lg`}>
            {notification.type === "success" ? "✅" : notification.type === "error" ? "❌" : "ℹ️"}
          </div>
          <p className="text-white text-sm font-medium flex-1">{notification.message}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors text-lg">×</button>
        </div>
      </div>
    </div>
  );
}

export default function FaceTrackingApp() {
  const videoRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVideos, setRecordedVideos] = useState([]);
  const [notification, setNotification] = useState(null);
  const [detectionStatus, setDetectionStatus] = useState("Initializing...");
  const mediaRecorder = useRef(null);
  const recordedChunks = useRef([]);
  const requestLoopId = useRef(null);
  const recordingLoopId = useRef(null);
  const overlayDetections = useRef([]);
  const faceDetector = useRef(null);

  function showNotification(message, type = "success") {
    setNotification({ message, type, id: Date.now() });
    setTimeout(() => setNotification(null), 4000);
  }

  useEffect(() => {
    (async () => {
      try {
        await setupCamera();
        await setupFaceDetection();
        startDetectionLoop();
        loadStoredVideos();
      } catch {
        setDetectionStatus("Camera error");
        showNotification("Camera initialization failed", "error");
      }
    })();
    return () => {
      requestLoopId.current && cancelAnimationFrame(requestLoopId.current);
      recordingLoopId.current && cancelAnimationFrame(recordingLoopId.current);
      stopCamera();
    };
    // eslint-disable-next-line
  }, []);

  async function setupCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user", frameRate: { ideal: 30 } },
      audio: false,
    });
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await new Promise((res) => {
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          previewCanvasRef.current.width = videoRef.current.videoWidth;
          previewCanvasRef.current.height = videoRef.current.videoHeight;
          res();
        };
      });
    }
    setDetectionStatus("Camera ready");
  }

  async function setupFaceDetection() {
    if (window.FaceDetection) return;
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4/face_detection.js";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    if (window.FaceDetection) {
      const detector = new window.FaceDetection({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4/${file}`,
      });
      detector.setOptions({ model: "short", minDetectionConfidence: 0.5 });
      detector.onResults((results) => {
        overlayDetections.current = results && results.detections ? results.detections : [];
      });
      await detector.initialize();
      faceDetector.current = detector;
      setDetectionStatus("✅ Face detection active");
    } else {
      setDetectionStatus("Detection unavailable");
    }
  }

  function startDetectionLoop() {
    const detect = async () => {
      const video = videoRef.current;
      const previewCanvas = previewCanvasRef.current;
      const ctx = previewCanvas.getContext("2d");
      ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      if (faceDetector.current && video.readyState >= 2) {
        await faceDetector.current.send({ image: video });
      }
      drawOverlay(ctx, overlayDetections.current);
      requestLoopId.current = requestAnimationFrame(detect);
    };
    detect();
  }

  function drawOverlay(ctx, dets) {
    if (!dets || dets.length === 0) {
      const text = "🔍 SEARCHING FOR FACE...";
      ctx.font = "bold 20px system-ui";
      const w = ctx.measureText(text).width;
      ctx.fillStyle = "rgba(17,24,39,0.88)";
      ctx.fillRect((ctx.canvas.width - w) / 2 - 20, 25, w + 40, 50);
      ctx.fillStyle = "#facc15";
      ctx.fillText(text, (ctx.canvas.width - w) / 2, 55);
      return;
    }
    dets.forEach((det) => {
      const bbox = det.boundingBox;
      const x = (bbox.xCenter - bbox.width / 2) * ctx.canvas.width;
      const y = (bbox.yCenter - bbox.height / 2) * ctx.canvas.height;
      const w = bbox.width * ctx.canvas.width;
      const h = bbox.height * ctx.canvas.height;
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 3.5;
      ctx.shadowColor = "#4ade80cc";
      ctx.shadowBlur = 16;
      ctx.strokeRect(x, y, w, h);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#10b981";
      ctx.fillRect(x, y, 28, 6);
      ctx.fillRect(x, y, 6, 28);
      ctx.fillRect(x + w - 28, y, 28, 6);
      ctx.fillRect(x + w - 6, y, 6, 28);
      ctx.fillRect(x, y + h - 6, 28, 6);
      ctx.fillRect(x, y + h - 28, 6, 28);
      ctx.fillRect(x + w - 28, y + h - 6, 28, 6);
      ctx.fillRect(x + w - 6, y + h - 28, 6, 28);
      const cx = x + w / 2, cy = y + h / 2;
      ctx.strokeStyle = "#84cc16";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "#a3e635";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(cx - 22, cy);
      ctx.lineTo(cx + 22, cy);
      ctx.moveTo(cx, cy - 22);
      ctx.lineTo(cx, cy + 22);
      ctx.stroke();
      ctx.shadowBlur = 0;
    });
  }

  // RECORDING WITH CONTINUOUS LOOP
  async function startRecording() {
    if (!videoRef.current) return;
    showNotification("Recording started (Video only + Overlay)", "success");
    const video = videoRef.current;
    const overlayCanvas = document.createElement("canvas");
    overlayCanvas.width = video.videoWidth;
    overlayCanvas.height = video.videoHeight;
    const ctx = overlayCanvas.getContext("2d");
    let running = true;
    function drawFrameForRecording() {
      if (!running) return;
      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-overlayCanvas.width, 0);
      ctx.drawImage(video, 0, 0, overlayCanvas.width, overlayCanvas.height);
      ctx.restore();
      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-overlayCanvas.width, 0);
      drawOverlay(ctx, overlayDetections.current);
      ctx.restore();
      recordingLoopId.current = requestAnimationFrame(drawFrameForRecording);
    }
    setIsRecording(true);
    drawFrameForRecording();
    const stream = overlayCanvas.captureStream(30);
    mediaRecorder.current = new window.MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8" });
    recordedChunks.current = [];
    mediaRecorder.current.ondataavailable = (e) => e.data.size && recordedChunks.current.push(e.data);
    mediaRecorder.current.onstop = () => {
      running = false;
      cancelAnimationFrame(recordingLoopId.current);
      const blob = new Blob(recordedChunks.current, { type: "video/webm" });
      saveVideo(blob);
    };
    mediaRecorder.current.start(1000);
  }

  function stopRecording() {
    if (mediaRecorder.current && mediaRecorder.current.state === "recording") {
      mediaRecorder.current.stop();
    }
    setIsRecording(false);
    showNotification("Recording stopped", "info");
  }

  function saveVideo(blob) {
    const id = Date.now();
    const url = URL.createObjectURL(blob);
    const vid = {
      id,
      timestamp: new Date().toISOString(),
      size: blob.size,
      url,
      format: "webm"
    };
    setRecordedVideos((prev) => [...prev, vid]);
    localStorage.setItem("faceTrackingVideos", JSON.stringify([...recordedVideos, { ...vid, url: undefined }]));
    const reader = new FileReader();
    reader.onload = () => localStorage.setItem(`video_${id}`, reader.result);
    reader.readAsDataURL(blob);
    showNotification("Video with overlay saved! (.webm)", "success");
  }

  function loadStoredVideos() {
    const stored = localStorage.getItem("faceTrackingVideos");
    if (!stored) return;
    const list = JSON.parse(stored);
    setRecordedVideos(list.map((v) => {
      const storedBlob = localStorage.getItem(`video_${v.id}`);
      return storedBlob ? { ...v, url: storedBlob } : null;
    }).filter(Boolean));
  }

  function downloadVideo(video) {
    const link = document.createElement("a");
    link.href = video.url;
    link.download = `face-tracking-${video.id}.webm`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification("Downloading WebM video with overlay...", "success");
  }

  function deleteVideo(videoId) {
    setRecordedVideos((prev) => prev.filter((v) => v.id !== videoId));
    localStorage.removeItem(`video_${videoId}`);
    const updated = recordedVideos.filter((v) => v.id !== videoId)
      .map((v) => ({ id: v.id, timestamp: v.timestamp, size: v.size, format: v.format }));
    localStorage.setItem("faceTrackingVideos", JSON.stringify(updated));
    showNotification("Video deleted", "success");
  }

  function clearAllVideos() {
    recordedVideos.forEach((v) => localStorage.removeItem(`video_${v.id}`));
    localStorage.removeItem("faceTrackingVideos");
    setRecordedVideos([]);
    showNotification("All videos cleared", "success");
  }

  function stopCamera() {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#020617] relative px-4 sm:px-6 lg:px-8">
      <NotificationToast notification={notification} onClose={() => setNotification(null)} />
      <div className="relative z-10 text-white min-h-screen">
        <Navbar />
        <div className="pt-16 text-center">
        <div className="text-lg sm:text-xl md:text-2xl font-semibold text-blue-200 bg-gradient-to-r from-white/20 via-blue-200 to-white/20 bg-clip-text text-transparent">
        Introducing you to the advanced 
        </div>
          
          <GradientText
            colors={[" #3b82f6, #8b5cf6, #ec4899, #f97316, #facc15"]}
            animationSpeed={10}
            showBorder={false}
            className="text-3xl sm:text-5xl leading-tight"
          >
            Face Tracker and Recorder
          </GradientText>
          <div className="mt-3">
            <p className="text-sm sm:text-base md:text-lg font-light text-gray-400 tracking-wide">
              Real-Time Face Detection & Video-Only Recording 
            </p>
          </div>
        </div>
        <div className="mt-8 max-w-xl mx-auto">
          <div className="relative bg-black/20 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-auto object-cover transform scale-x-[-1]" />
            <canvas ref={previewCanvasRef} className="absolute top-0 left-0 w-full h-full transform scale-x-[-1]" />
            {isRecording && (
              <div className="absolute top-3 right-3 bg-red-500/90 rounded-full px-3 py-1 flex items-center space-x-2 animate-pulse">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                <span className="text-white text-xs font-bold">REC</span>
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-4">
              <div className="flex flex-col sm:flex-row items-center justify-between space-y-3 sm:space-y-0">
                <span className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-white text-sm font-medium">{detectionStatus}</span>
                </span>
                <div className="flex space-x-2">
                  {!isRecording ? (
                    <button
                      onClick={startRecording}
                      className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-full text-white text-sm font-medium transition-all duration-200 hover:scale-105 shadow-lg"
                    >
                      ⏺ Start Recording
                    </button>
                  ) : (
                    <button
                      onClick={stopRecording}
                      className="px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 rounded-full text-white text-sm font-medium transition-all duration-200 hover:scale-105 shadow-lg"
                    >
                      ⏹ Stop Recording
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-8">
            <div className="text-center mb-6">
              <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-red-400 to-rose-300 bg-clip-text text-transparent mb-2">
                Recorded Sessions
              </h2>
              <p className="text-gray-400 text-sm">
                Your face tracking videos are stored locally (.webm with overlay)
              </p>
              {recordedVideos.length > 0 && (
                <button
                  onClick={clearAllVideos}
                  className="mt-4 px-4 py-2 border border-red-400/30 bg-red-500/10 rounded-full text-red-300 text-sm font-medium hover:bg-red-500/20 hover:text-red-200 transition"
                >
                  🗑 Clear All Videos
                </button>
              )}
            </div>
            {recordedVideos.length === 0 ? (
              <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
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
                  <div key={video.id} className="relative bg-white/5 rounded-xl p-4 sm:p-6 border border-white/10 shadow-lg overflow-hidden flex flex-col sm:flex-row items-center sm:justify-between group hover:border-red-400/30 hover:bg-white/10">
                    <div>
                      <h3 className="text-base sm:text-lg font-semibold text-white bg-gradient-to-r from-red-300 to-rose-200 bg-clip-text text-transparent">
                        Recording #{video.id.toString().slice(-4)}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 mt-1">
                        <span>{new Date(video.timestamp).toLocaleString()}</span>
                        <span>·</span>
                        <span>{(video.size / (1024 * 1024)).toFixed(1)} MB</span>
                        <span>·</span>
                        <span className="text-blue-200">WEBM</span>
                        <span>·</span>
                        <span className="text-green-200">Video + Overlay</span>
                      </div>
                    </div>
                    <div className="flex space-x-2 mt-3 sm:mt-0">
                      <button
                        onClick={() => downloadVideo(video)}
                        className="px-4 py-2 bg-blue-600/20 border border-blue-400/30 rounded-lg text-blue-300 text-sm font-medium hover:bg-blue-600/30 hover:text-blue-200"
                      >
                        Download
                      </button>
                      <button
                        onClick={() => deleteVideo(video.id)}
                        className="px-4 py-2 bg-red-600/20 border border-red-400/30 rounded-lg text-red-300 text-sm font-medium hover:bg-red-600/30 hover:text-red-200"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-8 pb-8">
              <Instruction />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
