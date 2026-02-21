import React, { useEffect, useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { detectGesture, GestureType, HandLandmark } from '@/lib/gesture-recognition';
import { Camera, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
interface ARCanvasProps {
  activeColor: string;
  activeTool: 'pen' | 'eraser';
  onGestureChange: (gesture: GestureType) => void;
  onColorChange: () => void;
  clearTrigger: number;
  onCameraReady?: () => void;
}
type PermissionStatus = 'idle' | 'prompting' | 'granted' | 'denied' | 'error';
export function ARCanvas({
  activeColor,
  activeTool,
  onGestureChange,
  onColorChange,
  clearTrigger,
  onCameraReady
}: ARCanvasProps) {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Refs for logic to avoid re-renders and dependency cycles
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>(0);
  const lastGestureRef = useRef<GestureType>('IDLE');
  const lastPointRef = useRef<{x: number, y: number} | null>(null);
  const isDrawingRef = useRef<boolean>(false);
  const gestureCooldownRef = useRef<number>(0);
  // Store activeColor and activeTool in refs to access inside animation loop
  const activeColorRef = useRef(activeColor);
  const activeToolRef = useRef(activeTool);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  // Update refs when props change
  useEffect(() => {
    activeColorRef.current = activeColor;
  }, [activeColor]);
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);
  // Check initial permission state if possible
  useEffect(() => {
    async function checkPermission() {
      try {
        // @ts-expect-error - navigator.permissions.query support varies
        const result = await navigator.permissions.query({ name: 'camera' });
        if (result.state === 'granted') {
          setPermissionStatus('granted');
        } else if (result.state === 'denied') {
          setPermissionStatus('denied');
          setErrorMessage("Camera access is blocked. Please enable it in your browser settings.");
        }
      } catch (e) {
        // Browser doesn't support querying camera permission, default to idle
        console.log("Permission query not supported", e);
      }
    }
    checkPermission();
  }, []);
  // Function to request camera permission explicitly
  const requestCameraPermission = async () => {
    setPermissionStatus('prompting');
    setErrorMessage(null);
    try {
      // We request the stream to trigger the browser prompt
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user"
        }
      });
      // If we get here, permission is granted.
      // We stop the tracks immediately because react-webcam will request its own stream.
      stream.getTracks().forEach(track => track.stop());
      setPermissionStatus('granted');
      toast.success("Camera access granted!");
    } catch (err: any) {
      console.error("Camera permission error:", err);
      setPermissionStatus('denied');
      let msg = "Could not access webcam.";
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = "Camera permission denied. Please click the lock icon in your address bar to allow access.";
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = "No camera found. Please connect a camera.";
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = "Camera is in use by another application.";
      } else if (!err.name && !err.message) {
        msg = "Camera access failed. Please check your browser privacy settings.";
      }
      setErrorMessage(msg);
      toast.error("Camera access failed");
    }
  };
  const handleRetry = () => {
    setPermissionStatus('idle');
    setRetryCount(c => c + 1);
  };
  // Initialize MediaPipe HandLandmarker ONLY after permission is granted
  useEffect(() => {
    if (permissionStatus !== 'granted') return;
    let isMounted = true;
    const initHandLandmarker = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        if (!isMounted) return;
        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
        if (isMounted) {
          setIsModelLoaded(true);
          onCameraReady?.();
        }
      } catch (error) {
        console.error("Error initializing hand landmarker:", error);
        if (isMounted) {
          // Don't fail completely on model error, maybe just retry
          toast.error("Failed to load AI models. Retrying...");
          setTimeout(() => {
             if (isMounted) initHandLandmarker();
          }, 2000);
        }
      }
    };
    initHandLandmarker();
    return () => {
      isMounted = false;
      if (handLandmarkerRef.current) {
        handLandmarkerRef.current.close();
      }
    };
  }, [permissionStatus, onCameraReady, retryCount]);
  // Handle Canvas Clearing
  useEffect(() => {
    if (clearTrigger > 0 && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        lastPointRef.current = null; // Reset last point to prevent connecting lines after clear
      }
    }
  }, [clearTrigger]);
  // Main Detection Loop
  const predictWebcam = useCallback(() => {
    if (
      !handLandmarkerRef.current ||
      !webcamRef.current ||
      !webcamRef.current.video ||
      !webcamRef.current.video.readyState
    ) {
      requestRef.current = requestAnimationFrame(predictWebcam);
      return;
    }
    const video = webcamRef.current.video;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
        requestRef.current = requestAnimationFrame(predictWebcam);
        return;
    }
    // CRITICAL: Match canvas dimensions to video dimensions exactly
    // This prevents coordinate mismatch due to CSS scaling
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      // Restore context properties after resize (resizing clears context state)
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = activeToolRef.current === 'eraser' ? 24 : 8;
    }
    const startTimeMs = performance.now();
    try {
        const results = handLandmarkerRef.current.detectForVideo(video, startTimeMs);
        // Process results
        if (results.landmarks && results.landmarks.length > 0) {
            const landmarks = results.landmarks[0] as HandLandmark[];
            const gesture = detectGesture(landmarks);
            // Handle Gesture State Changes
            if (gesture !== lastGestureRef.current) {
                lastGestureRef.current = gesture;
                onGestureChange(gesture);
                // Reset drawing state if we stop drawing
                if (gesture !== 'DRAW') {
                    isDrawingRef.current = false;
                    lastPointRef.current = null;
                }
            }
            // Handle Specific Gestures
            const now = Date.now();
            // 1. DRAWING (or ERASING)
            if (gesture === 'DRAW') {
                const indexTip = landmarks[8];
                // Mirror x coordinate because webcam is mirrored via CSS
                // Coordinates are normalized [0,1], so we multiply by canvas dimensions
                const x = (1 - indexTip.x) * canvas.width;
                const y = indexTip.y * canvas.height;
                // Smoothing: Simple moving average
                // If we have a last point, we can smooth the current point towards it slightly
                // to reduce jitter.
                let smoothX = x;
                let smoothY = y;
                if (lastPointRef.current) {
                    // 0.7 weight to new point, 0.3 to old point (adjust as needed)
                    smoothX = x * 0.6 + lastPointRef.current.x * 0.4;
                    smoothY = y * 0.6 + lastPointRef.current.y * 0.4;
                }
                // Draw line
                if (lastPointRef.current) {
                    ctx.beginPath();
                    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
                    ctx.lineTo(smoothX, smoothY);
                    if (activeToolRef.current === 'eraser') {
                        ctx.globalCompositeOperation = 'destination-out';
                        ctx.lineWidth = 32; // Eraser is thicker
                    } else {
                        ctx.globalCompositeOperation = 'source-over';
                        ctx.strokeStyle = activeColorRef.current;
                        ctx.lineWidth = 8;
                    }
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.stroke();
                    // Reset composite operation to default just in case
                    ctx.globalCompositeOperation = 'source-over';
                }
                lastPointRef.current = { x: smoothX, y: smoothY };
                isDrawingRef.current = true;
            }
            // 2. COLOR CHANGE (with cooldown)
            if (gesture === 'CHANGE_COLOR') {
                if (now - gestureCooldownRef.current > 1500) { // 1.5s cooldown
                    onColorChange();
                    gestureCooldownRef.current = now;
                }
            }
            // 3. HOVER (Optional: Draw cursor)
            if (gesture === 'HOVER' || gesture === 'CHANGE_COLOR') {
                 // We could draw a cursor here, but let's keep it simple for now
                 // or maybe just a small dot to show tracking is working
            }
        } else {
            // No hands detected
            if (lastGestureRef.current !== 'IDLE') {
                lastGestureRef.current = 'IDLE';
                onGestureChange('IDLE');
                isDrawingRef.current = false;
                lastPointRef.current = null;
            }
        }
    } catch (e) {
        // Suppress WebGL warnings in console if possible, or just log once
        // console.warn("Detection error:", e);
    }
    requestRef.current = requestAnimationFrame(predictWebcam);
  }, [onGestureChange, onColorChange]);
  // Start loop when loaded
  useEffect(() => {
    if (isModelLoaded) {
      requestRef.current = requestAnimationFrame(predictWebcam);
    }
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isModelLoaded, predictWebcam]);
  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-black flex items-center justify-center">
      {/* 1. IDLE STATE: Request Permission */}
      {permissionStatus === 'idle' && (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-sketch-paper p-4">
          <div className="text-center max-w-md bg-white p-8 rounded-sketch border-2 border-sketch-dark shadow-sketch">
            <div className="w-20 h-20 bg-sketch-blue/20 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-sketch-blue border-dashed">
              <Camera className="w-10 h-10 text-sketch-blue" />
            </div>
            <h3 className="text-3xl font-display text-sketch-dark mb-4">Enable Camera</h3>
            <p className="text-lg text-gray-600 font-hand font-bold mb-8">
              AetherDraw needs to see your hands to create magic! Please allow camera access to continue.
            </p>
            <button
              onClick={requestCameraPermission}
              className="btn-sketch bg-sketch-blue text-white border-sketch-dark hover:bg-sketch-blue/90 w-full"
            >
              Start Magic
            </button>
          </div>
        </div>
      )}
      {/* 2. PROMPTING STATE: Waiting for user decision */}
      {permissionStatus === 'prompting' && (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-sketch-paper/90 backdrop-blur-sm">
          <div className="text-center">
            <Loader2 className="w-16 h-16 text-sketch-purple animate-spin mx-auto mb-4" />
            <h3 className="text-2xl font-display text-sketch-dark">Waiting for permission...</h3>
            <p className="text-gray-500 mt-2">Please click "Allow" in your browser pop-up.</p>
          </div>
        </div>
      )}
      {/* 3. LOADING STATE: Permission granted, loading AI */}
      {permissionStatus === 'granted' && !isModelLoaded && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-sketch-paper">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-sketch-blue border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h3 className="text-2xl font-display text-sketch-dark">Summoning AI Spirits...</h3>
          </div>
        </div>
      )}
      {/* 4. ERROR/DENIED STATE */}
      {(permissionStatus === 'denied' || permissionStatus === 'error') && (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-red-50 p-8">
          <div className="text-center max-w-md bg-white p-8 rounded-sketch border-2 border-red-200 shadow-lg">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-3xl font-display text-red-500 mb-4">Camera Error</h3>
            <p className="text-lg text-gray-700 mb-6">{errorMessage || "Something went wrong."}</p>
            <button
              onClick={handleRetry}
              className="btn-sketch bg-white text-sketch-dark flex items-center justify-center gap-2 mx-auto"
            >
              <RefreshCw className="w-5 h-5" />
              Try Again
            </button>
          </div>
        </div>
      )}
      {/* Webcam Layer - Only render if granted */}
      {permissionStatus === 'granted' && (
        <Webcam
          ref={webcamRef}
          audio={false}
          mirrored={true}
          className="absolute inset-0 w-full h-full object-cover"
          onUserMediaError={(err) => {
              console.error("Webcam error:", err);
              // Only set error if we haven't already (prevents loops)
              if (permissionStatus !== 'error') {
                setPermissionStatus('error');
                setErrorMessage(`Webcam error: ${(err as any)?.message || 'Unknown error'}`);
              }
          }}
          videoConstraints={{
              facingMode: "user",
              width: { ideal: 1280 },
              height: { ideal: 720 }
          }}
        />
      )}
      {/* Drawing Canvas Layer */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-10 object-cover"
      />
      {/* Vignette Overlay for style */}
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.2)] z-10" />
    </div>
  );
}