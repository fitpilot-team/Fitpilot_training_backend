import { ReactNode, MouseEvent } from 'react';
import { motion } from 'framer-motion';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  children,
  className = '',
  disabled,
  type = 'button',
  onClick,
}: ButtonProps) {
  const baseStyles = `
    inline-flex items-center justify-center font-semibold rounded-xl
    transition-all duration-200 ease-out
    focus:outline-none focus:ring-2 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
  `;

  const variantStyles = {
    primary: `
      bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700
      hover:from-blue-600 hover:via-blue-700 hover:to-blue-800
      text-white shadow-lg shadow-blue-500/25
      hover:shadow-xl hover:shadow-blue-500/30
      focus:ring-blue-500
      active:scale-[0.98]
      hover:cursor-pointer
    `,
    secondary: `
      bg-gradient-to-r from-gray-100 to-gray-200
      hover:from-gray-200 hover:to-gray-300
      text-gray-800 shadow-md shadow-gray-300/30
      hover:shadow-lg hover:shadow-gray-400/30
      focus:ring-gray-400
      active:scale-[0.98]
      hover:cursor-pointer
    `,
    danger: `
      bg-gradient-to-r from-red-500 via-red-600 to-red-700
      hover:from-red-600 hover:via-red-700 hover:to-red-800
      text-white shadow-lg shadow-red-500/25
      hover:shadow-xl hover:shadow-red-500/30
      focus:ring-red-500
      active:scale-[0.98]
      hover:cursor-pointer
    `,
    ghost: `
      bg-transparent hover:bg-gray-100/80
      text-gray-700 hover:text-gray-900
      focus:ring-gray-400
      active:scale-[0.98]
      hover:cursor-pointer
    `,
  };

  const sizeStyles = {
    sm: 'px-3.5 py-1.5 text-sm gap-1.5',
    md: 'px-5 py-2.5 text-base gap-2',
    lg: 'px-7 py-3.5 text-lg gap-2.5',
  };

  const isDisabled = disabled || isLoading;

  return (
    <motion.button
      type={type}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={isDisabled}
      onClick={onClick}
      whileHover={!isDisabled ? { scale: 1.02 } : undefined}
      whileTap={!isDisabled ? { scale: 0.98 } : undefined}
      transition={{ duration: 0.15 }}
    >
      {isLoading ? (
        <>
          <motion.svg
            className="h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </motion.svg>
          <span>Cargando...</span>
        </>
      ) : (
        children
      )}
    </motion.button>
  );
}
