import React, { useEffect, useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { detectGesture, GestureType, HandLandmark } from '@/lib/gesture-recognition';
import { Camera, AlertCircle, Loader2 } from 'lucide-react';

interface ARCanvasProps {
  activeColor: string;
  onGestureChange: (gesture: GestureType) => void;
  onColorChange: () => void;
  clearTrigger: number;
  onCameraReady?: () => void;
}

type PermissionStatus = 'idle' | 'prompting' | 'granted' | 'denied' | 'error';

export function ARCanvas({
  activeColor,
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
  
  // Store activeColor in a ref to access it inside the animation loop without restarting the loop
  const activeColorRef = useRef(activeColor);

  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);

  // Update the ref when prop changes
  useEffect(() => {
    activeColorRef.current = activeColor;
  }, [activeColor]);

  // Function to request camera permission explicitly
  const requestCameraPermission = async () => {
    setPermissionStatus('prompting');
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // We just needed the permission, we can stop this stream now
      // The Webcam component will request its own stream
      stream.getTracks().forEach(track => track.stop());
      setPermissionStatus('granted');
    } catch (err: any) {
      console.error("Camera permission error:", err);
      setPermissionStatus('denied');
      let msg = "Could not access webcam.";
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = "Camera permission denied. Please allow access in your browser settings.";
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = "No camera found. Please connect a camera.";
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = "Camera is in use by another application.";
      } else if (!err.name && !err.message) {
        // Handle generic/empty error objects often seen in some browsers
        msg = "Camera access failed. Please check your browser privacy settings and ensure camera access is allowed for this site.";
      }
      
      setErrorMessage(msg);
    }
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
          setPermissionStatus('error');
          setErrorMessage("Failed to load AI models. Please refresh.");
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
  }, [permissionStatus, onCameraReady]);

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
      ctx.lineWidth = 8;
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

            // 1. DRAWING
            if (gesture === 'DRAW') {
                const indexTip = landmarks[8];
                // Mirror x coordinate because webcam is mirrored via CSS
                // Coordinates are normalized [0,1], so we multiply by canvas dimensions
                const x = (1 - indexTip.x) * canvas.width;
                const y = indexTip.y * canvas.height;

                // Draw line
                if (lastPointRef.current) {
                    ctx.beginPath();
                    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
                    ctx.lineTo(x, y);
                    ctx.strokeStyle = activeColorRef.current; // Use ref to avoid dependency
                    ctx.lineWidth = 8;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.stroke();
                }
                
                lastPointRef.current = { x, y };
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
        console.warn("Detection error:", e);
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
              onClick={() => setPermissionStatus('idle')}
              className="btn-sketch bg-white text-sketch-dark"
            >
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
              setPermissionStatus('error');
              setErrorMessage(`Webcam error: ${(err as any)?.message || 'Unknown error'}`);
          }}
          videoConstraints={{
              facingMode: "user"
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