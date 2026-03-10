import React, { useRef, KeyboardEvent } from 'react';

interface OTPInputProps {
    length?: number;
    value: string;
    onChange: (value: string) => void;
}

export function OTPInput({ length = 6, value, onChange }: OTPInputProps) {
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    React.useEffect(() => {
        // Find the first empty input or the first one if all are empty
        const firstEmptyIndex = value.split('').findIndex(v => !v);
        const indexToFocus = firstEmptyIndex === -1 ? 0 : firstEmptyIndex;
        
        // Use a small timeout to ensure the modal animation or rendering is complete
        const timer = setTimeout(() => {
            inputRefs.current[indexToFocus]?.focus();
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const val = e.target.value;
        if (/[^0-9]/.test(val)) return; // Only allow numbers

        let newValue = value.split('');
        
        // Take the last character entered (in case they typed multiple quickly or pasted one char)
        newValue[index] = val.slice(-1); 
        
        const nextValue = newValue.join('');
        onChange(nextValue);

        // Move to next input
        if (val && index < length - 1) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
        if (e.key === 'Backspace') {
            e.preventDefault();
            const newValue = value.split('');
            if (!newValue[index] && index > 0) {
                // If current input is empty and we press backspace, move to previous and clear it
                inputRefs.current[index - 1]?.focus();
                newValue[index - 1] = '';
            } else {
                // Clear current input
                newValue[index] = '';
            }
            onChange(newValue.join(''));
        } else if (e.key === 'ArrowLeft' && index > 0) {
            inputRefs.current[index - 1]?.focus();
        } else if (e.key === 'ArrowRight' && index < length - 1) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text/plain').replace(/[^0-9]/g, '').slice(0, length);
        if (pastedData) {
            onChange(pastedData);
            // Focus the last filled input or the first empty one
            const nextIndex = Math.min(pastedData.length, length - 1);
            inputRefs.current[nextIndex]?.focus();
        }
    };

    return (
        <div className="flex gap-2 sm:gap-3 justify-center" onPaste={handlePaste}>
            {Array.from({ length }).map((_, index) => (
                <input
                    key={index}
                    ref={(el) => { inputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-semibold bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    value={value[index] || ''}
                    onChange={(e) => handleChange(e, index)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                />
            ))}
        </div>
    );
}
