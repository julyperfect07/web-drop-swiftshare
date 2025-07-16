import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import QRCode from 'qrcode';
import { Card } from '@/components/ui/card';

interface QRCodeGeneratorProps {
  value: string;
  size?: number;
  className?: string;
}

export function QRCodeGenerator({ value, size = 200, className }: QRCodeGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      QRCode.toCanvas(canvasRef.current, value, {
        width: size,
        margin: 2,
        color: {
          dark: '#10B981', // accent color
          light: '#0F172A'  // dark background
        }
      });
    }
  }, [value, size]);

  if (!value) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={className}
    >
      <Card className="p-4 bg-card/80 border border-border/50 text-center">
        <div className="mb-3">
          <h4 className="text-sm font-medium text-foreground">Scan to Connect</h4>
          <p className="text-xs text-muted-foreground">
            Open ShareDrop on another device and scan this code
          </p>
        </div>
        <motion.div
          className="inline-block rounded-lg overflow-hidden glow-effect"
          whileHover={{ scale: 1.05 }}
          transition={{ duration: 0.2 }}
        >
          <canvas 
            ref={canvasRef} 
            className="block"
            style={{ imageRendering: 'pixelated' }}
          />
        </motion.div>
      </Card>
    </motion.div>
  );
}