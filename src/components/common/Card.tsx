import { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  gradient?: boolean;
}

export function Card({
  children,
  className = '',
  padding = 'md',
  hover = false,
  gradient = false,
}: CardProps) {
  const paddingStyles = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  const baseStyles = `
    bg-white/80 backdrop-blur-sm rounded-2xl
    border border-gray-100/80
    shadow-sm shadow-gray-200/50
    transition-all duration-300
    ${hover ? 'hover:shadow-lg hover:shadow-gray-200/70 hover:border-gray-200 hover:-translate-y-0.5' : ''}
    ${gradient ? 'bg-gradient-to-br from-white to-gray-50/50' : ''}
  `;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`${baseStyles} ${paddingStyles[padding]} ${className}`}
    >
      {children}
    </motion.div>
  );
}
