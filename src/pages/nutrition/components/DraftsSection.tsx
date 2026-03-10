import { useNavigate } from 'react-router-dom';
import { useGetDrafts } from '@/features/menus/queries';
import { useProfessional } from '@/contexts/ProfessionalContext';
import { useProfessionalClients } from '@/features/professional-clients/queries';
import { motion } from 'framer-motion';
import { FileText, ArrowRight, Clock, Loader2, Sparkles } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export function DraftsSection() {
    const navigate = useNavigate();
    const { professional } = useProfessional();
    const { data: drafts, isLoading } = useGetDrafts(professional?.sub ? Number(professional.sub) : undefined);
    const { data: clients } = useProfessionalClients(professional?.sub || '');

    if (isLoading) return (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-nutrition-600" />
        </div>
    );

    if (!drafts || drafts.length === 0) return null;

    // Take only the last 3 drafts to save space
    // Safely handle potentially missing last_autosave
    const recentDrafts = [...drafts]
        .filter(d => d.last_autosave) // Ensure we have a date
        // Screenshot keys: id, professional, client_id, json_data, last_autosave, is_ai_generated, status, applied_at.
        // It does NOT show created_at. I should use last_autosave only? Or check if created_at exists?
        // Let's assume last_autosave is the main date.
        .sort((a, b) => {
            const dateA = new Date(a.last_autosave || 0);
            const dateB = new Date(b.last_autosave || 0);
            return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 3);


    return (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-orange-50 text-orange-600 rounded-xl">
                        <FileText className="w-5 h-5" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900">Menús sin terminar</h2>
                </div>
                {/* Could add a 'View All' if there are many */}
            </div>

            <div className="space-y-3">
                {recentDrafts.map((draft, i) => {
                    const client = clients?.find(c => c.id == draft.client_id); // strict eq might fail if types differ (string vs number)
                    // Fallback to current date if missing to prevent crash
                    const dateStr = draft.last_autosave || new Date().toISOString();
                    const updateDate = parseISO(dateStr);
                    
                    return (
                        <motion.button
                            key={draft.id}
                            initial={{ x: -10, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: i * 0.1 }}
                            onClick={() => {
                                console.log('Clicking draft:', draft.id);
                                navigate(`/nutrition/meal-plans/create-menu?draftId=${draft.id}`);
                            }}
                            className="w-full text-left bg-gray-50 hover:bg-white border border-transparent hover:border-orange-200 hover:shadow-md transition-all p-3 rounded-2xl flex items-center gap-3 group"
                        >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black uppercase shadow-sm
                                ${client ? 'bg-white text-emerald-600' : 'bg-white text-gray-400'}
                            `}>
                                {client?.profile_picture ? (
                                    <img src={client.profile_picture} alt={client.name || 'Cliente'} className="w-full h-full rounded-xl object-cover" />
                                ) : (
                                    (client && client.name) ? client.name.charAt(0) : '?'
                                )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-bold text-gray-900 truncate">
                                        {client ? (client.name || 'Sin nombre') : 'Sin asignar'}
                                    </h3>
                                    {draft.is_ai_generated && (
                                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-md text-[10px] font-bold uppercase tracking-wide border border-purple-200">
                                            <Sparkles className="w-2.5 h-2.5" />
                                            IA
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <Clock className="w-3 h-3" />
                                    <span>{format(updateDate, "d 'de' MMM, HH:mm", { locale: es })}</span>
                                </div>
                            </div>

                            <div className="p-2 bg-white text-orange-600 rounded-xl opacity-0 group-hover:opacity-100 shadow-sm transition-all transform group-hover:translate-x-0 translate-x-2">
                                <ArrowRight className="w-4 h-4" />
                            </div>
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
}
