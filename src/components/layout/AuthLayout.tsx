import { Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LanguageSelector } from "./LanguageSelector";

const MOLECULAR_PATTERN = `<svg width="250" height="250" viewBox="0 0 250 250" xmlns="http://www.w3.org/2000/svg"><g stroke="#6b7280" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M 30,50 L 45,24 L 75,24 L 90,50 L 75,76 L 45,76 Z" /><path d="M 30,50 L 15,50 M 90,50 L 105,40 M 75,76 L 85,95 M 45,24 L 35,10 M 75,24 L 85,15" /><line x1="49" y1="32" x2="69" y2="32" /><path d="M 140,150 L 155,130 L 170,150 L 185,130 L 200,150 L 215,130 L 230,150" /><path d="M 140,150 L 125,150 L 115,165" /><line x1="123" y1="148" x2="113" y2="133" /><line x1="127" y1="152" x2="117" y2="137" /><path d="M 180,40 L 160,50 L 160,75 L 180,85 M 160,75 L 140,85 L 120,75" /><path d="M 140,85 L 140,110 L 125,125" /><path d="M 140,110 L 155,125" /><line x1="178" y1="45" x2="162" y2="55" /><path d="M 40,160 L 55,145 L 75,145 L 90,160 L 75,175 L 55,175 Z" /><path d="M 90,160 L 105,145 L 105,125 L 90,110 L 75,125" /><path d="M 75,175 L 90,190 L 110,190 L 125,175 L 110,160 L 90,160" /><path d="M 125,175 L 140,160 L 140,135 L 120,135 L 110,160" /><path d="M 40,160 L 25,150 M 55,145 L 45,130" /><circle cx="20" cy="20" r="1.5" fill="#6b7280" /><circle cx="110" cy="30" r="1.5" fill="#6b7280" /><circle cx="210" cy="90" r="1.5" fill="#6b7280" /><circle cx="40" cy="220" r="1.5" fill="#6b7280" /><circle cx="180" cy="200" r="1.5" fill="#6b7280" /><circle cx="230" cy="40" r="1.5" fill="#6b7280" /><path d="M 200,200 L 210,190 L 220,200" /><path d="M 15,100 L 25,110 L 35,100" /></g></svg>`;

export function AuthLayout() {
    const location = useLocation();

    return (
        <div className="min-h-screen w-full bg-gray-100 relative flex items-center justify-center p-4 overflow-hidden">
            {/* Language Switcher */}
            <div className="absolute top-4 right-4 z-50">
                <LanguageSelector />
            </div>

            {/* Background Texture - Molecular Structure (Carbons, Proteins, Fats) */}
            <div 
                className="absolute inset-0 z-0 pointer-events-none"
                style={{
                    backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(MOLECULAR_PATTERN)}")`,
                    backgroundSize: '200px 200px',
                    backgroundPosition: 'center',
                    opacity: 0.6
                }}
            />
            
            <div className="absolute inset-0 z-0 bg-linear-to-br from-white/60 via-gray-100/40 to-gray-200/90 pointer-events-none" />

            <AnimatePresence mode="wait">
                <motion.div
                    key={location.pathname}
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="relative z-10 w-full flex justify-center"
                >
                    <Outlet />
                </motion.div>
            </AnimatePresence>
        </div>
    )
}