import React, { useState, useCallback } from 'react';
import { ARCanvas } from '@/components/ar/ARCanvas';
import { ToolPalette } from '@/components/ui/ToolPalette';
import { InstructionsOverlay } from '@/components/ui/InstructionsOverlay';
import { GestureType } from '@/lib/gesture-recognition';
import { HelpCircle, Sparkles } from 'lucide-react';
import { toast, Toaster } from 'sonner';
// Define our whimsical color palette
const PALETTE = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#FFE66D', // Yellow
  '#6C5CE7', // Purple
  '#55EFC4', // Green
  '#FFFFFF', // White
];
export function HomePage() {
  const [activeColor, setActiveColor] = useState<string>(PALETTE[1]); // Default to Teal
  const [activeTool, setActiveTool] = useState<'pen' | 'eraser'>('pen');
  const [currentGesture, setCurrentGesture] = useState<GestureType>('IDLE');
  const [showInstructions, setShowInstructions] = useState<boolean>(true);
  const [clearTrigger, setClearTrigger] = useState<number>(0);
  // Handle gesture changes from the AR Canvas
  const handleGestureChange = useCallback((gesture: GestureType) => {
    setCurrentGesture(gesture);
    // Optional: Add sound effects or haptic feedback here
    if (gesture === 'CHANGE_COLOR') {
      // Visual feedback handled in ToolPalette
    }
  }, []);
  // Cycle through colors
  const handleColorChange = useCallback(() => {
    setActiveColor((prevColor) => {
      const currentIndex = PALETTE.indexOf(prevColor);
      const nextIndex = (currentIndex + 1) % PALETTE.length;
      const nextColor = PALETTE[nextIndex];
      toast.success('Color Swapped!', {
        style: { backgroundColor: nextColor, color: '#000' },
        duration: 1500
      });
      return nextColor;
    });
  }, []);
  const handleClear = useCallback(() => {
    setClearTrigger(prev => prev + 1);
    toast.info('Canvas Cleared', { duration: 1500 });
  }, []);
  return (
    <div className="relative w-full h-screen overflow-hidden bg-sketch-dark">
      {/* Header / Logo Area */}
      <div className="absolute top-0 left-0 right-0 z-40 p-4 flex justify-between items-start pointer-events-none">
        <div className="bg-white/90 backdrop-blur-sm p-3 rounded-sketch border-2 border-sketch-dark shadow-sketch pointer-events-auto">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-sketch-yellow fill-sketch-yellow animate-pulse" />
            <h1 className="text-3xl font-display text-sketch-dark m-0 leading-none pt-1">
              AetherDraw
            </h1>
          </div>
        </div>
        <button
          onClick={() => setShowInstructions(true)}
          className="bg-white/90 backdrop-blur-sm p-3 rounded-full border-2 border-sketch-dark shadow-sketch hover:scale-110 transition-transform pointer-events-auto group"
        >
          <HelpCircle className="w-6 h-6 text-sketch-dark group-hover:rotate-12 transition-transform" />
        </button>
      </div>
      {/* Main AR Canvas */}
      <ARCanvas
        activeColor={activeColor}
        onGestureChange={handleGestureChange}
        onColorChange={handleColorChange}
        clearTrigger={clearTrigger}
      />
      {/* UI Overlays */}
      <ToolPalette
        activeColor={activeColor}
        activeTool={activeTool}
        currentGesture={currentGesture}
        onClear={handleClear}
        colors={PALETTE}
      />
      <InstructionsOverlay
        isOpen={showInstructions}
        onClose={() => setShowInstructions(false)}
      />
      {/* Toast Notifications */}
      <Toaster position="top-center" />
    </div>
  );
}