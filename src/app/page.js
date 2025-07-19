"use client"
import { useEffect, useRef } from "react";

export default function Home() {
  const videoRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const videoRecorder = useRef(null)
  const recordedVid = useRef([])

  useEffect(() => {
    async function enableCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing webcam: ", err);
      }
    }

    enableCamera();
  }, []);

  useEffect(() => {
    
  },[])




  return (
    <div className="flex justify-center items-center h-screen bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full max-w-md rounded-xl shadow-lg"
      />
    </div>
  );
}
