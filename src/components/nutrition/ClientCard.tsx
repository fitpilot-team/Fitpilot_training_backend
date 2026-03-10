import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronRight, Calendar, Copy, Dumbbell, Utensils } from 'lucide-react';

interface ClientCardProps {
  image: string;
  clientName: string;
  clientLastName: string;
  nextAppointment: string | null;
  activationUrl?: string | null;
  serviceType?: string;
  services?: string[];
  onAction?: () => void;
}

export function ClientCard({ image, clientName, clientLastName, nextAppointment, activationUrl, serviceType, services, onAction }: ClientCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyActivationUrl = async () => {
    if (!activationUrl) return;
    try {
      await navigator.clipboard.writeText(activationUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Fallback is intentionally silent to keep the UI minimal.
    }
  };
  
  const getServiceBadge = (name: string) => {
      // Generate a consistent color based on the service name length or char code if needed, 
      // or just default to a nutrition style for now as requested or generic.
      // Trying to match existing style.
      const isNutrition = name.toLowerCase().includes('nutricion') || name.toLowerCase().includes('nutrition');
      const isTraining = name.toLowerCase().includes('entrenamiento') || name.toLowerCase().includes('training') || name.toLowerCase().includes('coaching');

      let styles = "bg-gray-100 text-gray-700";
      let Icon = Utensils;

      if (isNutrition) {
          styles = "bg-nutrition-100 text-nutrition-700";
          Icon = Utensils;
      } else if (isTraining) {
          styles = "bg-blue-100 text-blue-700";
          Icon = Dumbbell;
      }

      return (
          <div key={name} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${styles} text-[10px] font-bold uppercase tracking-wider`}>
              <Icon className="w-3 h-3" />
              {name}
          </div>
      );
  };

  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: "0 10px 30px -10px rgba(16, 185, 129, 0.2)" }}
      className="bg-white rounded-xl p-4 
      shadow-md border border-gray-100 flex 
      items-center gap-5 relative overflow-hidden group"
    >
      {/* Left side: Image with soft background blob */}
      <div className="relative shrink-0">
        <div className="w-20 h-20 rounded-lg bg-nutrition-50 relative overflow-hidden flex items-center justify-center">
            {/* Soft blob behind image (decorative) */}
            <div className="absolute top-0 right-0 w-16 h-16 bg-nutrition-100 rounded-full blur-xl opacity-60 translate-x-4 -translate-y-4" />
            
            <img 
                src={image} 
                alt={clientName} 
                className="w-full h-full object-cover rounded-2xl relative z-10"
            />
        </div>
      </div>

      {/* Right side: Content */}
      <div className="flex-1 min-w-0 py-1">
        <div className="flex items-center gap-2 mb-1">
             <h3 className="text-lg font-bold text-gray-900 truncate">
                {clientName}
            </h3>
            <h3 className="text-lg font-bold text-gray-900 truncate">
                {clientLastName}
            </h3>
        </div>
       
        
        <p className="text-sm text-gray-500 mb-3 line-clamp-2">
            Gestionar plan nutricional y seguimiento.
        </p>

        <div className="mb-2 flex flex-wrap gap-2">
            {services && services.length > 0 ? (
                services.map(service => getServiceBadge(service))
            ) : (
                // Fallback to old behavior if no services provided, though user implied services would come.
                // Or maybe just show nothing/default.
                // Keeping old logic for backward compatibility if needed or just removing it if services replaces it.
                // User said "los que vengan los puedes mostrar", implies existing ones.
                // I will effectively replace the old single badge with the list.
                // If services is empty/undefined, maybe show nothing?
                // Let's keep the old one as fallback JUST IN CASE services is undefined but serviceType is passed
                serviceType && (
                     <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-nutrition-100 text-nutrition-700 text-[10px] font-bold uppercase tracking-wider">
                      <Utensils className="w-3 h-3" />
                      {serviceType}
                  </div>
                )
            )}
        </div>

        <div className="flex items-center gap-4">
            {nextAppointment ? (
                <div className="flex items-center gap-1.5 text-xs font-medium text-nutrition-600 bg-nutrition-50 px-2.5 py-1 rounded-full">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Proxima sesión en nutrición: {new Date(nextAppointment).toLocaleDateString()}</span>
                </div>
            ) : (
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Sin sesión</span>
                </div>
            )}
        </div>

        {activationUrl ? (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Activación
            </span>
            <button
              type="button"
              onClick={handleCopyActivationUrl}
              className="group inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50/70 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition hover:border-emerald-200 hover:bg-emerald-100/80"
              title="Copiar URL de activación"
            >
              <span className="max-w-[150px] truncate">
                {activationUrl}
              </span>
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-emerald-500 opacity-80 group-hover:opacity-100" />
              )}
            </button>
          </div>
        ) : null}
      </div>

      {/* Action Button */}
      <motion.button
        onClick={onAction}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className="shrink-0 w-10 h-10 rounded-full 
        bg-nutrition-50 flex items-center justify-center 
        text-nutrition-600 group-hover:bg-nutrition-500 group-hover:text-white 
        transition-colors duration-200 hover:cursor-pointer
        hover:shadow-md
        "
      >
        <ChevronRight className="w-5 h-5" />
      </motion.button>
    </motion.div>
  );
}
