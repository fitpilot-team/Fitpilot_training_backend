import { useState, useMemo, Fragment, useEffect, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Search, X, Check, Loader2 } from 'lucide-react';
import { IProfessionalClient } from '@/features/professional-clients/types';
import { motion } from 'framer-motion';

interface EnhancedClientSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (client: IProfessionalClient | null) => void;
    clients: IProfessionalClient[] | undefined;
    isLoading: boolean;
}

export function EnhancedClientSelectorModal({ isOpen, onClose, onSelect, clients, isLoading }: EnhancedClientSelectorModalProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const filteredClients = useMemo(() => {
        if (!clients) return [];
        const filtered = clients.filter(client =>
            client.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            client.lastname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            client.email?.toLowerCase().includes(searchQuery.toLowerCase())
        );
        return filtered;
    }, [clients, searchQuery]);

    // Reset selected index when search changes
    useEffect(() => {
        setSelectedIndex(0);
    }, [searchQuery]);

    // Keyboard navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev < filteredClients.length - 1 ? prev + 1 : prev));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filteredClients[selectedIndex]) {
                    onSelect(filteredClients[selectedIndex]);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, filteredClients, selectedIndex, onSelect]);

    // Scroll selected item into view
    useEffect(() => {
        if (scrollContainerRef.current) {
            const selectedElement = scrollContainerRef.current.children[selectedIndex] as HTMLElement;
            if (selectedElement) {
                selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }, [selectedIndex]);

    return (
        <Transition show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-100" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95 translate-y-8"
                            enterTo="opacity-100 scale-100 translate-y-0"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100 translate-y-0"
                            leaveTo="opacity-0 scale-95 translate-y-8"
                        >
                            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-[2.5rem] bg-white p-6 text-left align-middle shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] transition-all border border-gray-100">
                                <div className="flex items-center justify-between mb-8">
                                    <div>
                                        <Dialog.Title as="h3" className="text-2xl font-black text-gray-900 tracking-tight">
                                            Seleccionar Cliente
                                        </Dialog.Title>
                                        <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mt-0.5">
                                            Filtra por paciente
                                        </p>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-2xl transition-all"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>

                                <div className="relative mb-8">
                                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                        <Search className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input
                                        autoFocus
                                        type="text"
                                        className="block w-full pl-12 pr-6 py-4 bg-gray-50 border-2 border-transparent focus:border-emerald-500 rounded-3xl text-base font-bold text-gray-900 focus:ring-0 transition-all placeholder:text-gray-400"
                                        placeholder="Escribe para buscar..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                    {searchQuery && (
                                        <button 
                                            onClick={() => setSearchQuery('')}
                                            className="absolute right-5 top-1/2 -translate-y-1/2 p-1.5 bg-gray-200 hover:bg-gray-300 rounded-full transition-colors"
                                        >
                                            <X className="w-4 h-4 text-gray-600" />
                                        </button>
                                    )}
                                </div>

                                <div 
                                    ref={scrollContainerRef}
                                    className="max-h-[450px] overflow-y-auto pr-2 space-y-3 custom-scrollbar"
                                >
                                    {isLoading ? (
                                        <div className="py-20 flex flex-col items-center justify-center gap-4">
                                            <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                                            <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Cargando base de datos...</p>
                                        </div>
                                    ) : filteredClients.length > 0 ? (
                                        <>
                                            {/* Option to clear filter */}
                                            <button
                                                onClick={() => onSelect(null)}
                                                className={`w-full flex items-center justify-center gap-3 p-4 rounded-3xl border-2 transition-all font-bold ${
                                                    selectedIndex === -1 
                                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                                                    : 'border-dashed border-gray-200 text-gray-400 hover:border-gray-300'
                                                }`}
                                            >
                                                Ver Todos los Clientes
                                            </button>

                                            {filteredClients.map((client, index) => (
                                                <motion.button
                                                    key={client.id}
                                                    layout
                                                    onClick={() => onSelect(client)}
                                                    onMouseEnter={() => setSelectedIndex(index)}
                                                    className={`w-full flex items-center gap-4 p-4 rounded-3xl border-2 transition-all group text-left ${
                                                        selectedIndex === index
                                                        ? 'border-emerald-500 bg-emerald-50/50 shadow-lg shadow-emerald-500/10'
                                                        : 'border-transparent hover:bg-gray-50'
                                                    }`}
                                                >
                                                    <div className="relative">
                                                        <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center overflow-hidden border-2 border-white shadow-md transition-transform group-hover:scale-110">
                                                            {client.profile_picture ? (
                                                                <img src={client.profile_picture} alt={client.name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <img 
                                                                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${client.email || client.name}`} 
                                                                    alt={client.name} 
                                                                    className="w-full h-full object-cover" 
                                                                />
                                                            )}
                                                        </div>
                                                        {selectedIndex === index && (
                                                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center">
                                                                <Check className="w-3 h-3 text-white" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-base font-black truncate tracking-tight ${
                                                            selectedIndex === index ? 'text-emerald-900' : 'text-gray-900'
                                                        }`}>
                                                            {client.name} {client.lastname}
                                                        </p>
                                                        <p className="text-[10px] font-bold text-gray-400 truncate uppercase tracking-tight">
                                                            {client.email || 'Sin correo registrado'}
                                                        </p>
                                                    </div>
                                                    
                                                    <div className={`transition-all ${
                                                        selectedIndex === index ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'
                                                    }`}>
                                                        <div className="p-3 bg-emerald-500 text-white rounded-2xl shadow-xl shadow-emerald-500/30">
                                                            <Check className="w-5 h-5" />
                                                        </div>
                                                    </div>
                                                </motion.button>
                                            ))}
                                        </>
                                    ) : (
                                        <div className="py-20 text-center">
                                            <div className="w-20 h-20 bg-gray-50 rounded-4xl flex items-center justify-center mx-auto mb-6 border border-gray-100">
                                                <Search className="w-10 h-10 text-gray-300" />
                                            </div>
                                            <p className="text-gray-900 font-black text-2xl tracking-tight">No hay resultados</p>
                                            <p className="text-gray-400 font-bold mt-2 uppercase tracking-widest text-sm">Prueba con otro nombre o email</p>
                                        </div>
                                    )}
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}
