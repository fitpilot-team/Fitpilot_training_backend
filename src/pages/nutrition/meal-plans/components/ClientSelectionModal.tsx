import { useState, useMemo, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useProfessionalClients } from '@/features/professional-clients/queries';
import { useProfessional } from '@/contexts/ProfessionalContext';
import { IProfessionalClient } from '@/features/professional-clients/types';
import { Search, X, User as UserIcon, Check, Loader2 } from 'lucide-react';

interface ClientSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (client: IProfessionalClient) => void;
    planName: string;
}

export function ClientSelectionModal({ isOpen, onClose, onSelect, planName }: ClientSelectionModalProps) {
    const { professional } = useProfessional();
    const { data: clients, isLoading } = useProfessionalClients(professional?.sub || '');
    const [searchQuery, setSearchQuery] = useState('');

    const filteredClients = useMemo(() => {
        if (!clients) return [];
        return clients.filter(client =>
            client.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            client.email?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [clients, searchQuery]);

    return (
        <Transition show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95 translate-y-4"
                            enterTo="opacity-100 scale-100 translate-y-0"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100 translate-y-0"
                            leaveTo="opacity-0 scale-95 translate-y-4"
                        >
                            <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-[2.5rem] bg-white p-8 text-left align-middle shadow-2xl transition-all border border-gray-100">
                                <div className="flex items-center justify-between mb-8">
                                    <div>
                                        <Dialog.Title as="h3" className="text-2xl font-black text-gray-900 tracking-tight">
                                            Asignar a Cliente
                                        </Dialog.Title>
                                        <p className="text-gray-500 text-sm font-medium mt-1">
                                            Creando menú de: <span className="text-emerald-600 font-bold">{planName}</span>
                                        </p>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-2xl transition-all"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="relative mb-6">
                                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                        <Search className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input
                                        type="text"
                                        className="block w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-gray-400"
                                        placeholder="Buscar por nombre o email..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>

                                <div className="max-h-[350px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                                    {isLoading ? (
                                        <div className="py-12 flex flex-col items-center justify-center gap-4">
                                            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                                            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Cargando clientes...</p>
                                        </div>
                                    ) : filteredClients.length > 0 ? (
                                        filteredClients.map((client) => (
                                            <button
                                                key={client.id}
                                                onClick={() => onSelect(client)}
                                                className="w-full flex items-center gap-4 p-4 rounded-3xl border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all group text-left"
                                            >
                                                <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center overflow-hidden border-2 border-white shadow-sm group-hover:bg-emerald-100 transition-colors">
                                                    {client.profile_picture ? (
                                                        <img src={client.profile_picture} alt={client.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <UserIcon className="w-6 h-6 text-gray-400 group-hover:text-emerald-500 transition-colors" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-base font-extrabold text-gray-900 truncate tracking-tight">{client.name}</p>
                                                    <p className="text-xs font-bold text-gray-400 truncate">{client.email}</p>
                                                </div>
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity pr-2">
                                                    <div className="p-2 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/25">
                                                        <Check className="w-4 h-4" />
                                                    </div>
                                                </div>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="py-12 text-center">
                                            <div className="w-16 h-16 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-gray-100">
                                                <Search className="w-8 h-8 text-gray-300" />
                                            </div>
                                            <p className="text-gray-900 font-extrabold text-lg">No se encontraron clientes</p>
                                            <p className="text-gray-400 font-bold text-xs mt-1 uppercase tracking-tight">Intenta con otro término de búsqueda</p>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-8">
                                    <button
                                        onClick={() => onClose()}
                                        className="w-full py-4 text-sm font-black text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-2xl transition-all uppercase tracking-widest"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}
