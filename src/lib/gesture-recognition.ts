// Types for our gesture system
export type GestureType = 'IDLE' | 'DRAW' | 'HOVER' | 'CHANGE_COLOR' | 'CLEAR' | 'ERASE';
export interface HandLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}
/**
 * Calculates the Euclidean distance between two landmarks
 */
function calculateDistance(p1: HandLandmark, p2: HandLandmark): number {
  return Math.sqrt(
    Math.pow(p1.x - p2.x, 2) +
    Math.pow(p1.y - p2.y, 2) +
    Math.pow(p1.z - p2.z, 2)
  );
}
/**
 * Determines if a finger is extended based on landmark positions
 * We compare the fingertip position to the PIP (Proximal Interphalangeal) joint
 * relative to the wrist to determine extension.
 */
function isFingerExtended(
  tip: HandLandmark,
  pip: HandLandmark,
  mcp: HandLandmark,
  wrist: HandLandmark
): boolean {
  // Check distance from wrist to tip vs wrist to PIP
  const tipDist = calculateDistance(tip, wrist);
  const pipDist = calculateDistance(pip, wrist);
  const mcpDist = calculateDistance(mcp, wrist);
  // Robust check: Tip must be further than PIP, and Tip must be further than MCP
  // This helps prevent false positives when fingers are curled but angled towards camera
  return tipDist > pipDist && tipDist > mcpDist;
}
/**
 * Analyzes hand landmarks to detect specific gestures
 *
 * Landmarks mapping (MediaPipe Hands):
 * 0: Wrist
 * 4: Thumb tip
 * 8: Index tip
 * 12: Middle tip
 * 16: Ring tip
 * 20: Pinky tip
 */
export function detectGesture(landmarks: HandLandmark[]): GestureType {
  if (!landmarks || landmarks.length < 21) return 'IDLE';
  const wrist = landmarks[0];
  // Thumb
  // const thumbTip = landmarks[4];
  // const thumbIP = landmarks[3];
  // Fingers
  const indexTip = landmarks[8];
  const indexPIP = landmarks[6];
  const indexMCP = landmarks[5];
  const middleTip = landmarks[12];
  const middlePIP = landmarks[10];
  const middleMCP = landmarks[9];
  const ringTip = landmarks[16];
  const ringPIP = landmarks[14];
  const ringMCP = landmarks[13];
  const pinkyTip = landmarks[20];
  const pinkyPIP = landmarks[18];
  const pinkyMCP = landmarks[17];
  // Check extension of each finger
  const isIndexExtended = isFingerExtended(indexTip, indexPIP, indexMCP, wrist);
  const isMiddleExtended = isFingerExtended(middleTip, middlePIP, middleMCP, wrist);
  const isRingExtended = isFingerExtended(ringTip, ringPIP, ringMCP, wrist);
  const isPinkyExtended = isFingerExtended(pinkyTip, pinkyPIP, pinkyMCP, wrist);
  // 1. ERASE GESTURE: Rock/Horns Sign (Index + Pinky extended, Middle + Ring closed)
  if (isIndexExtended && !isMiddleExtended && !isRingExtended && isPinkyExtended) {
    return 'ERASE';
  }
  // 2. CHANGE COLOR GESTURE: Victory/Peace sign (Index + Middle extended)
  // Ring and Pinky must be closed.
  if (isIndexExtended && isMiddleExtended && !isRingExtended && !isPinkyExtended) {
    return 'CHANGE_COLOR';
  }
  // 3. HOVER/STOP GESTURE: Open Palm (All fingers extended)
  // At least Index, Middle, Ring, Pinky must be extended.
  if (isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended) {
    return 'HOVER';
  }
  // 4. DRAW GESTURE: Index finger is extended.
  // We allow thumb to be extended or not (L-shape or pointing), as long as other fingers are closed.
  // IMPORTANT: Check this AFTER 'ERASE' and 'CHANGE_COLOR' because those also have index extended.
  if (isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
    return 'DRAW';
  }
  // 5. CLEAR GESTURE: Closed Fist (No fingers extended)
  // We add a check to ensure it's not just a transition state
  if (!isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
    return 'CLEAR';
  }
  return 'IDLE';
}