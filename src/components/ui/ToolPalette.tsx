import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Eraser, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GestureType } from '@/lib/gesture-recognition';
interface ToolPaletteProps {
  activeColor: string;
  activeTool: 'pen' | 'eraser';
  currentGesture: GestureType;
  onClear: () => void;
  colors: string[];
  visible?: boolean;
}
export function ToolPalette({
  activeColor,
  activeTool,
  currentGesture,
  onClear,
  colors,
  visible = true
}: ToolPaletteProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-4 w-full max-w-md px-4 pointer-events-none"
        >
          {/* Gesture Feedback Indicator */}
          <AnimatePresence mode="wait">
            {currentGesture !== 'IDLE' && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.8 }}
                className="bg-white/90 backdrop-blur-sm border-2 border-sketch-dark px-4 py-2 rounded-full shadow-sketch flex items-center gap-2 mb-2"
              >
                <span className="text-2xl">
                  {currentGesture === 'DRAW' && '✏️'}
                  {currentGesture === 'HOVER' && '✋'}
                  {currentGesture === 'CHANGE_COLOR' && '✌️'}
                  {currentGesture === 'CLEAR' && '✊'}
                </span>
                <span className="font-hand text-xl font-bold text-sketch-dark">
                  {currentGesture === 'DRAW' && 'Drawing'}
                  {currentGesture === 'HOVER' && 'Hovering'}
                  {currentGesture === 'CHANGE_COLOR' && 'Color Swap!'}
                  {currentGesture === 'CLEAR' && 'Clear?'}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Main Toolbar */}
          <div className="bg-white border-2 border-sketch-dark rounded-2xl shadow-sketch-lg p-3 flex items-center gap-4 pointer-events-auto">
            {/* Tool Indicator */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1 border border-gray-200">
              <div className={cn(
                "p-2 rounded-lg transition-all duration-300",
                activeTool === 'pen' ? "bg-white shadow-sm text-sketch-dark" : "text-gray-400"
              )}>
                <Pencil className="w-6 h-6" />
              </div>
              <div className={cn(
                "p-2 rounded-lg transition-all duration-300",
                activeTool === 'eraser' ? "bg-white shadow-sm text-sketch-dark" : "text-gray-400"
              )}>
                <Eraser className="w-6 h-6" />
              </div>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            {/* Color Palette */}
            <div className="flex items-center gap-2">
              {colors.map((color) => (
                <motion.div
                  key={color}
                  animate={{
                    scale: activeColor === color ? 1.2 : 1,
                    y: activeColor === color ? -4 : 0
                  }}
                  className={cn(
                    "w-8 h-8 rounded-full border-2 border-white shadow-sm cursor-pointer ring-2 ring-transparent transition-all",
                    activeColor === color && "ring-sketch-dark shadow-md"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="w-px h-8 bg-gray-200" />
            {/* Actions */}
            <button
              onClick={onClear}
              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors active:scale-95"
              title="Clear Canvas"
            >
              <Trash2 className="w-6 h-6" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}