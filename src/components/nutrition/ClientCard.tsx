import { motion } from 'framer-motion';
import { ChevronRight, Calendar, Dumbbell, Utensils } from 'lucide-react';

interface ClientCardProps {
  image: string;
  clientName: string;
  nextAppointment: string | null;
  serviceType?: string;
  onAction?: () => void;
}

export function ClientCard({ image, clientName, nextAppointment, serviceType, onAction }: ClientCardProps) {
  
  const getServiceBadge = (type?: string) => {
      switch(type) {
          case 'Nutrition':
              return (
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-nutrition-100 text-nutrition-700 text-[10px] font-bold uppercase tracking-wider">
                      <Utensils className="w-3 h-3" />
                      Nutrición
                  </div>
              );
          case 'Coaching':
              return (
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
                      <Dumbbell className="w-3 h-3" />
                      Entrenamiento
                  </div>
              );
          case 'Nutrition & Coaching':
              return (
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 text-[10px] font-bold uppercase tracking-wider">
                      <Utensils className="w-3 h-3" />
                      <span className="text-[8px]">+</span>
                      <Dumbbell className="w-3 h-3" />
                      Completo
                  </div>
              );
          default:
              return null;
      }
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
        </div>
       
        
        <p className="text-sm text-gray-500 mb-3 line-clamp-2">
            Gestionar plan nutricional y seguimiento.
        </p>

        <div className="mb-2">
            {getServiceBadge(serviceType)}
        </div>

        <div className="flex items-center gap-4">
            {nextAppointment ? (
                <div className="flex items-center gap-1.5 text-xs font-medium text-nutrition-600 bg-nutrition-50 px-2.5 py-1 rounded-full">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Proxima cita en nutrición: {new Date(nextAppointment).toLocaleDateString()}</span>
                </div>
            ) : (
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Sin cita</span>
                </div>
            )}
        </div>
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
