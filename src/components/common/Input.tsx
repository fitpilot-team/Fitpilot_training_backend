import { InputHTMLAttributes, forwardRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, icon, className = '', type, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative group">
          {icon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400
                            group-focus-within:text-blue-500 transition-colors duration-200">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            type={isPassword ? (showPassword ? 'text' : 'password') : type}
            className={`
              block w-full rounded-xl border border-gray-200 bg-white/80
              shadow-sm shadow-gray-100
              transition-all duration-200 ease-out
              focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 focus:bg-white
              focus:shadow-md focus:shadow-blue-100
              hover:border-gray-300 hover:bg-white
              disabled:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60
              placeholder:text-gray-400
              ${icon ? 'pl-11' : 'px-4'}
              ${isPassword ? 'pr-11' : 'pr-4'}
              py-2.5
              ${error
                ? 'border-red-400 focus:border-red-400 focus:ring-red-500/20 focus:shadow-red-100'
                : ''
              }
              ${className}
            `}
            {...props}
          />
          
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          )}

          {/* Focus indicator line */}
          <motion.div
            className="absolute bottom-0 left-1/2 h-0.5 bg-linear-to-r from-blue-500 to-blue-600 rounded-full"
            initial={{ width: 0, x: '-50%' }}
            whileFocus={{ width: '100%' }}
          />
        </div>
        <AnimatePresence mode="wait">
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
              className="mt-1.5 text-sm text-red-600 font-medium flex items-center gap-1"
            >
              <span className="inline-block w-1 h-1 rounded-full bg-red-500" />
              {error}
            </motion.p>
          )}
          {helperText && !error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-1.5 text-sm text-gray-500"
            >
              {helperText}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

Input.displayName = 'Input';

