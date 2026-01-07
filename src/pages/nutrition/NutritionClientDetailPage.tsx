import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Mail, User, X, TrendingUp, Activity, Scale, Ruler, HeartPulse, FileText, AlertCircle, Dumbbell, History, Edit2, Eye, Droplet } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import clientsData from '../../../clients.json';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
// import { useTranslation } from 'react-i18next';

interface Appointment {
  id: string;
  date: string;
  weight: number;
  bodyFat: number;
  muscleMass: number;
  waist: number;
  hip: number;
  glucose: number;
  notes: string;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar: string;
  nextAppointment: string | null;
  serviceType?: string;
  metrics?: {
    startWeight: number;
    currentWeight: number;
    weightUnit: string;
    adherenceScore: number;
    daysSinceLastLog: number;
  };
}

export function NutritionClientDetailPage() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  // const { t } = useTranslation('common');
  
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [isWeightChartOpen, setIsWeightChartOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [activeTab, setActiveTab] = useState<'nutrition' | 'training'>('nutrition');

  useEffect(() => {
    // In real implementation this would be an API call by specific ID
    // For now we simulate fetching from our list
    axios.get('http://localhost:3001/clients')
    .then(response => {
       const found = response.data.find((c: Client) => c.id === clientId);
       setClient(found || null);
       
       // Set initial tab based on service type
       if (found) {
           if (found.serviceType === 'Coaching') {
               setActiveTab('training');
           } else {
               setActiveTab('nutrition');
           }
       }
       
       setLoading(false);
    })
    .catch(error => {
      console.error('Error fetching client:', error);
      // Fallback
      let found = null;
      
      if ('clients' in clientsData && Array.isArray((clientsData as any).clients)) {
         found = (clientsData as any).clients.find((c: Client) => c.id === clientId);
      } else if (Array.isArray(clientsData)) {
         found = (clientsData as Client[]).find((c: Client) => c.id === clientId);
      }
      
      setClient(found || null);
        // Set initial tab based on service type for fallback
       if (found) {
           if (found.serviceType === 'Coaching') {
               setActiveTab('training');
           } else {
               setActiveTab('nutrition');
           }
       }
      setLoading(false);
    });
  }, [clientId]);

  // Generate mock history data based on start and current weight
  const weightHistory = useMemo(() => {
    if (!client?.metrics) return [];
    
    const start = client.metrics.startWeight;
    const current = client.metrics.currentWeight;
    const steps = 6;
    const data = [];
    
    // Create a smooth curve between start and current
    for (let i = 0; i < steps; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (steps - 1 - i) * 14); // Every 2 weeks
        
        // Linear-ish interpolation with some random noise
        const progress = i / (steps - 1);
        const weight = start + (current - start) * progress;
        // Add tiny random fluctuation (+- 0.5kg) except for start/end
        const noise = (i === 0 || i === steps - 1) ? 0 : (Math.random() - 0.5); 
        
        data.push({
            date: date.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }),
            weight: Number((weight + noise).toFixed(1))
        });
    }
    return data;
  }, [client]);

  // Generate mock appointment history
  const appointmentHistory: Appointment[] = useMemo(() => {
    if (!client?.metrics) return [];
    
    const start = client.metrics.startWeight;
    const current = client.metrics.currentWeight;
    const steps = 5; // Past 5 appointments
    const appointments: Appointment[] = [];
    
    for (let i = 0; i < steps; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (steps - 1 - i) * 14 - 7); // Shifted slightly from chart
        const progress = i / (steps - 1);
        const weight = start + (current - start) * progress;
        
        appointments.push({
            id: `appt-${i}`,
            date: date.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }),
            weight: Number(weight.toFixed(1)),
            bodyFat: Number((20 - progress * 2 + (Math.random())).toFixed(1)), // Mock fat loss
            muscleMass: Number((58 + progress * 1 + (Math.random())).toFixed(1)), // Mock muscle gain
            waist: Math.round(85 - progress * 3),
            hip: 100,
            glucose: Math.round(85 + (Math.random() * 10)), // Mock glucose 85-95
            notes: i === steps - 1 ? 'Seguimiento quincenal. Paciente reporta buena adherencia.' : 'Consulta de rutina. Ajuste de macros.'
        });
    }
    return appointments.reverse(); // Newest first
  }, [client]);

  if (loading) {
      return <div className="p-8 text-center text-gray-500">Cargando...</div>;
  }

  if (!client) {
      return (
          <div className="p-8 text-center">
              <p className="text-gray-500 mb-4">Cliente no encontrado</p>
              <button 
                onClick={() => navigate(-1)} 
                className="text-nutrition-600 font-medium hover:cursor-pointer"
            >
                Volver
            </button>
          </div>
      );
  }

  // Determine which tabs to show based on serviceType
  const showNutrition = !client.serviceType || client.serviceType === 'Nutrition' || client.serviceType === 'Nutrition & Coaching';
  const showTraining = client.serviceType === 'Coaching' || client.serviceType === 'Nutrition & Coaching';

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Chart Modal */}
      <AnimatePresence>
        {isWeightChartOpen && (
            <>
                {/* Backdrop */}
                <motion.div 

                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsWeightChartOpen(false)}
                    className="fixed inset-0 bg-black/20 backdrop-blur-xs z-50 flex items-center justify-center p-4"
                >
                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-2xl bg-white rounded-3xl shadow-xl border border-gray-100 relative"
                    >
                        <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-nutrition-50 text-nutrition-600">
                                <TrendingUp className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Progreso de Peso</h2>
                                <p className="text-sm text-gray-500">Historial de registros</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setIsWeightChartOpen(false)}
                            className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={weightHistory}>
                                <defs>
                                    <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                    dataKey="date" 
                                    tick={{ fill: '#64748b', fontSize: 12 }} 
                                    axisLine={false}
                                    tickLine={false}
                                    dy={10}
                                />
                                <YAxis 
                                    domain={['dataMin - 2', 'dataMax + 2']} 
                                    tick={{ fill: '#64748b', fontSize: 12 }}
                                    axisLine={false}
                                    tickLine={false}
                                    unit="kg"
                                    dx={-10}
                                />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="weight" 
                                    stroke="#10B981" 
                                    strokeWidth={3}
                                    fillOpacity={1} 
                                    fill="url(#colorWeight)" 
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    
                    <div className="mt-6 flex items-center justify-between text-sm">
                         <div className="bg-gray-50 px-4 py-2 rounded-xl">
                             <span className="text-gray-500">Inicial: </span>
                             <span className="font-semibold text-gray-900">{client?.metrics?.startWeight} {client?.metrics?.weightUnit}</span>
                         </div>
                         <div className="bg-nutrition-50 px-4 py-2 rounded-xl">
                             <span className="text-nutrition-600">Actual: </span>
                             <span className="font-bold text-nutrition-700">{client?.metrics?.currentWeight} {client?.metrics?.weightUnit}</span>
                         </div>
                    </div>
                        </div>
                    </motion.div>
                </motion.div>
            </>
        )}
      </AnimatePresence>

      {/* Appointment Detail Modal */}
      <AnimatePresence>
        {selectedAppointment && (
            <>
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setSelectedAppointment(null)}
                    className="fixed inset-0 bg-black/20 backdrop-blur-xs z-50 flex items-center justify-center p-4"
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-2xl bg-white rounded-3xl shadow-xl border border-gray-100 max-h-[90vh] overflow-y-auto relative"
                    >
                        <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                                <Calendar className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Detalles de la Cita</h2>
                                <p className="text-sm text-gray-500">{selectedAppointment.date}</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setSelectedAppointment(null)}
                            className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="space-y-6">
                        {/* Summary Cards */}
                         <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-gray-50 rounded-2xl">
                                <p className="text-xs text-gray-500 mb-1">Peso</p>
                                <p className="text-xl font-bold text-gray-900">{selectedAppointment.weight} kg</p>
                            </div>
                             <div className="p-4 bg-gray-50 rounded-2xl">
                                <p className="text-xs text-gray-500 mb-1">Grasa Corporal</p>
                                <p className="text-xl font-bold text-gray-900">{selectedAppointment.bodyFat}%</p>
                            </div>
                             <div className="p-4 bg-red-50 rounded-2xl">
                                <p className="text-xs text-red-500 mb-1">Glucosa</p>
                                <p className="text-xl font-bold text-red-700">{selectedAppointment.glucose} mg/dL</p>
                            </div>
                        </div>

                        {/* Detailed Metrics */}
                        <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
                             <div className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                                <span className="text-gray-600 text-sm">Masa Muscular</span>
                                <span className="font-semibold text-gray-900">{selectedAppointment.muscleMass} kg</span>
                             </div>
                             <div className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                                <span className="text-gray-600 text-sm">Cintura</span>
                                <span className="font-semibold text-gray-900">{selectedAppointment.waist} cm</span>
                             </div>
                              <div className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                                <span className="text-gray-600 text-sm">Cadera</span>
                                <span className="font-semibold text-gray-900">{selectedAppointment.hip} cm</span>
                             </div>
                        </div>

                         <div className="bg-yellow-50/50 p-4 rounded-2xl border border-yellow-100">
                             <div className="flex items-start gap-3">
                                <FileText className="w-5 h-5 text-yellow-600 mt-0.5" />
                                <div>
                                    <h4 className="text-sm font-bold text-yellow-800 mb-1">Notas de la consulta</h4>
                                    <p className="text-sm text-yellow-700 leading-relaxed">
                                        {selectedAppointment.notes}
                                    </p>
                                </div>
                             </div>
                         </div>
                    </div>

                    <div className="mt-8 flex justify-end gap-3">
                        <button 
                            onClick={() => setSelectedAppointment(null)}
                            className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
                        >
                            Cerrar
                        </button>
                        <button className="px-5 py-2.5 rounded-xl bg-nutrition-600 text-white font-medium hover:bg-nutrition-700 transition-colors shadow-lg shadow-nutrition-200 flex items-center gap-2">
                            <Edit2 className="w-4 h-4" />
                            Editar Registro
                        </button>
                    </div>
                        </div>
                    </motion.div>
                </motion.div>
            </>
        )}
      </AnimatePresence>

      {/* Header / Back Button */}
      <button 
        onClick={() => navigate(-1)} 
        className="flex items-center text-gray-500 
        hover:text-nutrition-600 transition-colors gap-2 group
        hover:cursor-pointer
        "
      >
        <div className="p-2 rounded-full bg-white border border-gray-200 group-hover:border-nutrition-200 group-hover:bg-nutrition-50 transition-colors">
            <ArrowLeft className="w-4 h-4" />
        </div>
        <span className="text-sm font-medium ">Volver</span>
      </button>

      {/* Main Content Info */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden"
      >
        {/* Banner/Header of Card */}
        <div className="h-32 bg-linear-to-r from-nutrition-50 to-nutrition-100 border-b border-gray-100 relative">
             <div className="absolute -bottom-10 left-8">
                 <div className="w-24 h-24 rounded-2xl bg-white p-1 shadow-sm">
                    <img src={client.avatar} alt={client.firstName} className="w-full h-full object-cover rounded-xl" />
                 </div>
             </div>
        </div>

        <div className="pt-12 px-8 pb-8 flex flex-col md:flex-row justify-between items-start gap-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">{client.firstName} {client.lastName}</h1>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    <div className="flex items-center gap-1.5">
                        <User className="w-4 h-4" />
                        <span>Cliente Activo</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Mail className="w-4 h-4" />
                        <span>{client.email}</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3">
                 {client.nextAppointment && (
                     <div className="px-4 py-2 bg-nutrition-50 text-nutrition-700 rounded-xl text-sm font-medium flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Próxima cita: {new Date(client.nextAppointment).toLocaleDateString()}
                     </div>
                 )}
                 <button className="px-5 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors shadow-lg shadow-gray-200">
                     Editar Cliente
                 </button>
            </div>
        </div>
      </motion.div>

      {/* Tabs Navigation */}
      {(showNutrition && showTraining) && (
      <div className="flex justify-center">
          <div className="bg-gray-100/80 p-1 rounded-2xl inline-flex relative">
              <motion.div 
                  layoutId="activeTab"
                  className="absolute inset-y-1 left-1 bg-white rounded-xl shadow-sm"
                  initial={false}
                  animate={{ 
                      x: activeTab === 'nutrition' ? 0 : '100%',
                      width: 'calc(50% - 4px)' 
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
              <button
                  onClick={() => setActiveTab('nutrition')}
                  className={`relative z-10 px-8 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-200 ${
                      activeTab === 'nutrition' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                  Nutrición
              </button>
              <button
                  onClick={() => setActiveTab('training')}
                  className={`relative z-10 px-8 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-200 ${
                      activeTab === 'training' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                  Entrenamiento
              </button>
          </div>
      </div>
      )}

      <AnimatePresence mode="wait">
        {activeTab === 'nutrition' ? (
            <motion.div
                key="nutrition"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
            >
                {/* Grid for details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Stats Card */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 col-span-2">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Progreso y Métricas</h3>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="p-4 rounded-2xl bg-gray-50">
                                <p className="text-xs text-gray-500 mb-1">Peso Inicial</p>
                                <p className="text-xl font-bold text-gray-900">{client.metrics?.startWeight || '-'} {client.metrics?.weightUnit}</p>
                            </div>
                            <motion.div 
                                whileHover={{ scale: 1.02, y: -2 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setIsWeightChartOpen(true)}
                                className="p-4 rounded-2xl bg-nutrition-50 cursor-pointer hover:shadow-md hover:shadow-nutrition-100 transition-all duration-200 relative group"
                            >
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <TrendingUp className="w-4 h-4 text-nutrition-600" />
                                </div>
                                <p className="text-xs text-nutrition-600 mb-1">Peso Actual</p>
                                <p className="text-xl font-bold text-nutrition-700">{client.metrics?.currentWeight || '-'} {client.metrics?.weightUnit}</p>
                            </motion.div>
                            <div className="p-4 rounded-2xl bg-blue-50">
                                <p className="text-xs text-blue-600 mb-1">Adherencia</p>
                                <p className="text-xl font-bold text-blue-700">{client.metrics?.adherenceScore || 0}%</p>
                            </div>
                            <div className="p-4 rounded-2xl bg-purple-50">
                                <p className="text-xs text-purple-600 mb-1">Ultimo Registro</p>
                                <p className="text-xl font-bold text-purple-700">{client.metrics?.daysSinceLastLog || 0} días</p>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions / Notes */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Acciones Rápidas</h3>
                        <div className="space-y-2">
                            <button className="w-full text-left px-4 py-3 rounded-xl hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors flex justify-between items-center group">
                                Asignar nueva dieta
                                <ArrowLeft className="w-4 h-4 rotate-180 text-gray-400 group-hover:text-nutrition-500 transition-colors" />
                            </button>
                            <button className="w-full text-left px-4 py-3 rounded-xl hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors flex justify-between items-center group">
                                Ver historial de citas
                                <ArrowLeft className="w-4 h-4 rotate-180 text-gray-400 group-hover:text-nutrition-500 transition-colors" />
                            </button>
                            <button className="w-full text-left px-4 py-3 rounded-xl hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors flex justify-between items-center group">
                                Enviar mensaje
                                <ArrowLeft className="w-4 h-4 rotate-180 text-gray-400 group-hover:text-nutrition-500 transition-colors" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Clinical Record Section */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-8 border-b border-gray-100 pb-4">
                        <div className="p-2 bg-nutrition-50 rounded-lg text-nutrition-600">
                            <FileText className="w-6 h-6" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900">Expediente Clínico</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                        {/* Column 1: Anthropometry */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 text-nutrition-700 font-semibold mb-2">
                                <Ruler className="w-5 h-5" />
                                <h3>Antropometría</h3>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                                    <span className="text-gray-500 text-sm">Estatura</span>
                                    <span className="font-bold text-gray-900">175 cm</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                                    <span className="text-gray-500 text-sm">IMC</span>
                                    <span className="font-bold text-gray-900">{client?.metrics?.currentWeight ? (client.metrics.currentWeight / (1.75 * 1.75)).toFixed(1) : '-'}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                                    <span className="text-gray-500 text-sm">Cintura</span>
                                    <span className="font-bold text-gray-900">82 cm</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                                    <span className="text-gray-500 text-sm">Cadera</span>
                                    <span className="font-bold text-gray-900">100 cm</span>
                                </div>
                            </div>
                        </div>

                        {/* Column 2: Body Composition */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 text-blue-600 font-semibold mb-2">
                                <Scale className="w-5 h-5" />
                                <h3>Composición Corporal</h3>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-blue-50/50 rounded-2xl flex flex-col items-center justify-center text-center">
                                    <span className="text-xs text-blue-500 font-medium mb-1">Grasa Corporal</span>
                                    <span className="text-2xl font-bold text-blue-700">18.5%</span>
                                </div>
                                <div className="p-4 bg-purple-50/50 rounded-2xl flex flex-col items-center justify-center text-center">
                                    <span className="text-xs text-purple-500 font-medium mb-1">Masa Muscular</span>
                                    <span className="text-2xl font-bold text-purple-700">62.0kg</span>
                                </div>
                                <div className="p-4 bg-orange-50/50 rounded-2xl flex flex-col items-center justify-center text-center">
                                    <span className="text-xs text-orange-500 font-medium mb-1">Grasa Visceral</span>
                                    <span className="text-2xl font-bold text-orange-700">4.0</span>
                                </div>
                                <div className="p-4 bg-teal-50/50 rounded-2xl flex flex-col items-center justify-center text-center">
                                    <span className="text-xs text-teal-500 font-medium mb-1">Hidratación</span>
                                    <span className="text-2xl font-bold text-teal-700">58%</span>
                                </div>
                            </div>
                        </div>

                        {/* Column 3: Vitals & History */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 text-pink-600 font-semibold mb-2">
                                <Activity className="w-5 h-5" />
                                <h3>Signos y Antecedentes</h3>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-3 p-3 border border-pink-100 bg-pink-50/30 rounded-xl">
                                    <HeartPulse className="w-5 h-5 text-pink-500" />
                                    <div>
                                        <p className="text-xs text-pink-400 font-bold uppercase tracking-wider">Presión Arterial</p>
                                        <p className="font-bold text-gray-900">120/80 mmHg</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 p-3 border border-red-100 bg-red-50/30 rounded-xl">
                                    <Droplet className="w-5 h-5 text-red-500" />
                                    <div>
                                        <p className="text-xs text-red-400 font-bold uppercase tracking-wider">Glucosa (Ayuno)</p>
                                        <p className="font-bold text-gray-900">92 mg/dL</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 p-3 border border-gray-100 bg-gray-50 rounded-xl">
                                    <Dumbbell className="w-5 h-5 text-gray-400 mt-0.5" />
                                    <div>
                                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Nivel de Actividad</p>
                                        <p className="text-sm font-medium text-gray-800">Moderado (3-4 días/sem)</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 p-3 border border-red-100 bg-red-50 rounded-xl">
                                    <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
                                    <div>
                                        <p className="text-xs text-red-400 font-bold uppercase tracking-wider mb-1">Alergias / Intolerancias</p>
                                        <div className="flex flex-wrap gap-1">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white text-red-600 border border-red-100">
                                                Lactosa
                                            </span>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white text-red-600 border border-red-100">
                                                Nueces
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Appointment History List */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                            <History className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Historial de Citas</h2>
                            <p className="text-sm text-gray-500">Registro de consultas anteriores</p>
                        </div>
                    </div>

                    <div className="overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-100 text-left">
                                    <th className="pb-3 pl-4 font-semibold text-gray-500 text-sm">Fecha</th>
                                    <th className="pb-3 font-semibold text-gray-500 text-sm">Peso</th>
                                    <th className="pb-3 font-semibold text-gray-500 text-sm hidden sm:table-cell">Grasa %</th>
                                    <th className="pb-3 font-semibold text-gray-500 text-sm hidden md:table-cell">Glucosa</th>
                                    <th className="pb-3 pr-4 text-right font-semibold text-gray-500 text-sm">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {appointmentHistory.map((appt) => (
                                    <tr key={appt.id} className="group hover:bg-gray-50/80 transition-colors">
                                        <td className="py-4 pl-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-nutrition-50 text-nutrition-600 flex items-center justify-center text-xs font-bold">
                                                    {new Date(appt.date).getDate()}
                                                </div>
                                                <span className="font-medium text-gray-900">{appt.date}</span>
                                            </div>
                                        </td>
                                        <td className="py-4">
                                            <span className="font-semibold text-gray-700">{appt.weight} kg</span>
                                        </td>
                                        <td className="py-4 hidden sm:table-cell">
                                            <span className="text-gray-600">{appt.bodyFat}%</span>
                                        </td>
                                        <td className="py-4 hidden md:table-cell">
                                            <span className="text-gray-600">{appt.glucose} mg/dL</span>
                                        </td>
                                        <td className="py-4 pr-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button 
                                                    onClick={() => setSelectedAppointment(appt)}
                                                    className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors tooltip"
                                                    title="Ver detalles"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => setSelectedAppointment(appt)}
                                                    className="p-2 rounded-lg text-gray-400 hover:text-nutrition-600 hover:bg-nutrition-50 transition-colors tooltip"
                                                    title="Editar registro"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </motion.div>
        ) : (
            <motion.div
                key="training"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="min-h-[400px] flex flex-col items-center justify-center p-8 bg-white rounded-3xl border border-gray-100 shadow-sm text-center"
            >
                <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4">
                    <Dumbbell className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Entrenamiento</h3>
                <p className="text-gray-500 max-w-sm">
                    La gestión de planes de entrenamiento estará disponible pronto.
                </p>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
