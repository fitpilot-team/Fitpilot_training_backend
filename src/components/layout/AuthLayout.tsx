import { Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

export function AuthLayout() {
    const location = useLocation();

    return (
        <div className="min-h-screen w-full bg-gray-200 flex items-center justify-center p-4">
            <AnimatePresence mode="wait">
                <motion.div
                    key={location.pathname}
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="w-full flex justify-center"
                >
                    <Outlet />
                </motion.div>
            </AnimatePresence>
        </div>
    )
}