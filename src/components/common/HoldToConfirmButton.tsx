import React, { useState, useEffect, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface HoldToConfirmButtonProps {
  onConfirm: () => void;
  holdTime?: number;
  className?: string;
  loading?: boolean;
  children: React.ReactNode;
  bgClassName?: string;
}

export function HoldToConfirmButton({
  onConfirm,
  holdTime = 3000,
  className = '',
  loading = false,
  children,
  bgClassName = 'bg-red-600/20'
}: HoldToConfirmButtonProps) {
  const [isCompleted, setIsCompleted] = useState(false);
  const controls = useAnimation();
  const holdTimer = useRef<NodeJS.Timeout | null>(null);

  const startHold = (e: React.PointerEvent) => {
    // Only accept left clicks or touches
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (loading || isCompleted) return;
    
    controls.start({
      width: '100%',
      transition: { duration: holdTime / 1000, ease: 'linear' }
    });

    holdTimer.current = setTimeout(() => {
      setIsCompleted(true);
      onConfirm();
    }, holdTime);
  };

  const cancelHold = () => {
    if (loading || isCompleted) return;
    
    controls.stop();
    controls.start({ 
      width: '0%', 
      transition: { duration: 0.2, ease: 'easeOut' } 
    });

    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (holdTimer.current) {
        clearTimeout(holdTimer.current);
      }
    };
  }, []);

  return (
    <motion.button
      type="button"
      className={`relative overflow-hidden select-none touch-none ${className}`}
      onPointerDown={startHold}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onContextMenu={(e) => {
        // Prevent context menu to avoid issues on mobile long-press
        e.preventDefault();
      }}
      whileTap={!loading && !isCompleted ? { scale: 0.98 } : {}}
      disabled={loading}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <motion.div
        className={`absolute inset-0 ${bgClassName} origin-left z-0`}
        initial={{ width: '0%' }}
        animate={controls}
      />
      <div className="relative z-10 flex items-center justify-center gap-2 pointer-events-none">
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : children}
      </div>
    </motion.button>
  );
}
