import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
interface InstructionsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}
export function InstructionsOverlay({ isOpen, onClose }: InstructionsOverlayProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border-4 border-sketch-dark relative"
          >
            {/* Header */}
            <div className="bg-sketch-paper p-6 border-b-2 border-sketch-dark flex justify-between items-center">
              <h2 className="text-4xl font-display text-sketch-dark">How to Draw Magic</h2>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-black/5 rounded-full transition-colors"
              >
                <X className="w-8 h-8 text-sketch-dark" />
              </button>
            </div>
            {/* Content */}
            <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8 bg-white">
              {/* Gesture 1: Draw */}
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-32 h-32 bg-sketch-blue/20 rounded-full flex items-center justify-center border-2 border-sketch-blue border-dashed">
                  <span className="text-6xl">☝️</span>
                </div>
                <div>
                  <h3 className="text-2xl font-display text-sketch-dark mb-2">Point to Draw</h3>
                  <p className="font-hand text-xl text-gray-600 font-bold">
                    Raise your index finger to start drawing lines in the air!
                  </p>
                </div>
              </div>
              {/* Gesture 2: Hover */}
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-32 h-32 bg-sketch-yellow/20 rounded-full flex items-center justify-center border-2 border-sketch-yellow border-dashed">
                  <span className="text-6xl">✋</span>
                </div>
                <div>
                  <h3 className="text-2xl font-display text-sketch-dark mb-2">Open to Hover</h3>
                  <p className="font-hand text-xl text-gray-600 font-bold">
                    Open your hand to stop drawing and move the cursor.
                  </p>
                </div>
              </div>
              {/* Gesture 3: Color */}
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-32 h-32 bg-sketch-red/20 rounded-full flex items-center justify-center border-2 border-sketch-red border-dashed">
                  <span className="text-6xl">✌️</span>
                </div>
                <div>
                  <h3 className="text-2xl font-display text-sketch-dark mb-2">Peace for Color</h3>
                  <p className="font-hand text-xl text-gray-600 font-bold">
                    Show a peace sign to cycle through magical colors!
                  </p>
                </div>
              </div>
            </div>
            {/* Footer */}
            <div className="bg-sketch-paper p-6 border-t-2 border-sketch-dark text-center">
              <button
                onClick={onClose}
                className="btn-sketch bg-sketch-green text-white border-sketch-dark hover:bg-sketch-green/90"
              >
                Got it, let's create!
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}