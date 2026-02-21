import React, { useEffect, useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { detectGesture, GestureType, HandLandmark } from '@/lib/gesture-recognition';

interface ARCanvasProps {
  activeColor: string;
  onGestureChange: (gesture: GestureType) => void;
  onColorChange: () => void;
  clearTrigger: number;
}

export function ARCanvas({
  activeColor,
  onGestureChange,
  onColorChange,
  clearTrigger
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

  const [isLoaded, setIsLoaded] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);

  // Update the ref when prop changes
  useEffect(() => {
    activeColorRef.current = activeColor;
  }, [activeColor]);

  // Explicitly request camera permissions
  useEffect(() => {
    let isMounted = true;

    const requestCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        // Stop the stream immediately, we just wanted to check permissions
        stream.getTracks().forEach(track => track.stop());
        
        if (isMounted) {
          setHasCameraPermission(true);
        }
      } catch (err: any) {
        console.error("Camera permission error:", err);
        if (isMounted) {
          let errorMessage = "Could not access webcam.";
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            errorMessage = "Camera permission denied. Please allow access in your browser settings.";
          } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            errorMessage = "No camera found. Please connect a camera.";
          } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
            errorMessage = "Camera is in use by another application.";
          }
          setCameraError(errorMessage);
        }
      }
    };

    requestCamera();

    return () => {
      isMounted = false;
    };
  }, []);

  // Initialize MediaPipe HandLandmarker
  useEffect(() => {
    if (!hasCameraPermission) return;

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

        if (isMounted) setIsLoaded(true);
      } catch (error) {
        console.error("Error initializing hand landmarker:", error);
        if (isMounted) setCameraError("Failed to load AI models. Please refresh.");
      }
    };

    initHandLandmarker();

    return () => {
      isMounted = false;
      if (handLandmarkerRef.current) {
        handLandmarkerRef.current.close();
      }
    };
  }, []);

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
  }, [onGestureChange, onColorChange]); // Removed activeColor from dependencies

  // Start loop when loaded
  useEffect(() => {
    if (isLoaded) {
      requestRef.current = requestAnimationFrame(predictWebcam);
    }
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isLoaded, predictWebcam]);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-black flex items-center justify-center">
      {/* Loading State */}
      {!isLoaded && !cameraError && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-sketch-paper">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-sketch-blue border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h3 className="text-2xl font-display text-sketch-dark">Summoning AI Spirits...</h3>
          </div>
        </div>
      )}

      {/* Error State */}
      {cameraError && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-red-50 p-8">
          <div className="text-center max-w-md">
            <h3 className="text-3xl font-display text-red-500 mb-4">Camera Error</h3>
            <p className="text-lg text-gray-700 mb-6">{cameraError}</p>
            <button
              onClick={() => window.location.reload()}
              className="btn-sketch bg-white"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Webcam Layer */}
      {hasCameraPermission && (
        <Webcam
          ref={webcamRef}
          audio={false}
          mirrored={true}
          className="absolute inset-0 w-full h-full object-cover"
          onUserMediaError={(err) => {
              console.error("Webcam error:", err);
              setCameraError(`Webcam error: ${(err as any)?.message || 'Unknown error'}`);
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
//