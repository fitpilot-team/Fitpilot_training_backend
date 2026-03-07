import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, User, Briefcase, Mail, Phone, Calendar, Edit2, X, Save, Shield, LogOut, Loader2, ChevronDown, Monitor, Clock3, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAvailableSlots, useInsertAvailableSlot, useUpdateAvailableSlot } from '@/features/professional-clients/queries';
import { IAvailableSlots } from '@/features/professional-clients/types';
import { useProfessional } from '@/contexts/ProfessionalContext';
import { AvailableSlot } from '@/components/profile/availableSlot';
import { ProfileAvatarUploader } from '@/components/profile/ProfileAvatarUploader';
import { Modal } from '@/components/common/Modal';
import { useAuthStore } from '@/store/newAuthStore';
import { useCancelSubscription } from '@/features/subscriptions/queries';
import { useUser, useUpdateProfilePicture, useUpdateUser } from '@/features/users/queries';
import { useAuthSessions, useRevokeAuthSession, useLogoutAllAuthSessions } from '@/features/auth/queries';
import { AuthSession } from '@/features/auth/types';
import { CancelSubscriptionModal } from '@/components/profile/CancelSubscriptionModal';


const DAYS = [
    { id: 1, label: 'Lunes' },
    { id: 2, label: 'Martes' },
    { id: 3, label: 'Miércoles' },
    { id: 4, label: 'Jueves' },
    { id: 5, label: 'Viernes' },
    { id: 6, label: 'Sábado' },
    { id: 7, label: 'Domingo' }
];

const formatTimeForInput = (time: string) => {
    if (!time) return '09:00';
    if (time.includes('T')) {
        // Use Date object to correctly extract local time from ISO strings
        const date = new Date(time);
        if (!isNaN(date.getTime())) {
            return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        }
        return time.split('T')[1].substring(0, 5);
    }
    return time.substring(0, 5);
};

const SESSION_FIELD_ORDER = [
    'id',
    'ip_address',
    'device_name',
    'device',
    'browser',
    'os',
    'platform',
    'user_agent',
    'created_at',
    'last_activity_at',
    'last_used_at',
    'expires_at',
    'updated_at',
    'revoked_at',
    'is_current',
    'current',
    'isCurrent',
];

const SESSION_DETAILS_HIDDEN_FIELDS = new Set([
    'id',
    'session_id',
    'sessionId',
    'created_at',
    'createdAt',
    'expires_at',
    'expiresAt',
    'updated_at',
    'updatedAt',
    'is_revoked',
    'isRevoked',
    'revoked_at',
    'revokedAt',
]);

const formatSessionKey = (key: string) => {
    return key
        .replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatSessionValue = (key: string, value: unknown) => {
    if (value === null || value === undefined || value === '') {
        return 'N/D';
    }

    if (typeof value === 'boolean') {
        return value ? 'Sí' : 'No';
    }

    if (typeof value === 'number') {
        return value.toString();
    }

    if (typeof value === 'string') {
        const normalizedKey = key.toLowerCase();
        const looksLikeDate =
            normalizedKey.endsWith('_at') ||
            normalizedKey.includes('date') ||
            normalizedKey.includes('last_') ||
            normalizedKey.includes('expires');

        if (looksLikeDate) {
            const parsedDate = new Date(value);
            if (!isNaN(parsedDate.getTime())) {
                return parsedDate.toLocaleString('es-MX');
            }
        }

        return value;
    }

    return JSON.stringify(value);
};

const isCurrentSession = (session: AuthSession) => {
    return Boolean(session.is_current ?? session.current ?? session.isCurrent);
};

const getSessionTitle = (session: AuthSession) => {
    const candidates = ['device_name', 'device', 'browser', 'platform', 'user_agent'];

    for (const key of candidates) {
        const value = session[key];
        if (typeof value === 'string' && value.trim()) {
            return value;
        }
    }

    return `Sesión #${session.id}`;
};

const getSessionEntries = (session: AuthSession) => {
    const orderedEntries = Object.entries(session)
        .filter(([key, value]) => {
            if (value === null || value === undefined || value === '') {
                return false;
            }

            return !SESSION_DETAILS_HIDDEN_FIELDS.has(key);
        })
        .sort(([keyA], [keyB]) => {
            const indexA = SESSION_FIELD_ORDER.indexOf(keyA);
            const indexB = SESSION_FIELD_ORDER.indexOf(keyB);
            const rankA = indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA;
            const rankB = indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB;
            return rankA - rankB;
        });

    return orderedEntries;
};

const getSessionStringValue = (session: AuthSession, keys: string[]) => {
    for (const key of keys) {
        const value = session[key];
        if (typeof value === 'string' && value.trim()) {
            return value;
        }
    }

    return 'N/D';
};

const getSessionFormattedDate = (session: AuthSession, keys: string[]) => {
    for (const key of keys) {
        const value = session[key];
        if (typeof value === 'string' && value.trim()) {
            return formatSessionValue(key, value);
        }
    }

    return 'N/D';
};

const getApiErrorMessage = (error: unknown) => {
    if (
        error &&
        typeof error === 'object' &&
        'response' in error &&
        error.response &&
        typeof error.response === 'object' &&
        'data' in error.response &&
        error.response.data &&
        typeof error.response.data === 'object'
    ) {
        const responseData = error.response.data as {
            message?: string;
            error?: string;
            detail?: string;
        };

        return responseData.message || responseData.error || responseData.detail || null;
    }

    if (error instanceof Error && error.message) {
        return error.message;
    }

    return null;
};

type SessionConfirmAction =
    | { type: 'single'; session: AuthSession }
    | { type: 'all' };

export function ProfilePage() {
    const navigate = useNavigate();
    const { professional, userData, refreshProfessional } = useProfessional();
    const { user } = useAuthStore();
    const professionalId = professional?.sub;
    
    // Fetch full user data to get name, lastname, phone, etc.
    const userId = user?.id ? Number(user.id) : undefined;
    const { data: fetchedUser, isLoading: isLoadingUser } = useUser(userId);
    const updateUserMutation = useUpdateUser();
    const updateProfilePictureMutation = useUpdateProfilePicture();
    const cancelSubscriptionMutation = useCancelSubscription();

    const { data: slots, isLoading: isLoadingSlots } = useAvailableSlots(professionalId || '');
    const insertMutation = useInsertAvailableSlot();
    const updateMutation = useUpdateAvailableSlot();
    const { data: sessions = [], isLoading: isLoadingSessions, isFetching: isFetchingSessions, refetch: refetchSessions } = useAuthSessions();
    const revokeSessionMutation = useRevokeAuthSession();
    const logoutAllSessionsMutation = useLogoutAllAuthSessions();

    const [activeTab, setActiveTab] = useState<'personal' | 'professional' | 'sessions'>('personal');
    const [workSlots, setWorkSlots] = useState<IAvailableSlots[]>([]);
    const [savingSlots, setSavingSlots] = useState<number[]>([]);
    const [closingSessionIds, setClosingSessionIds] = useState<number[]>([]);
    const [sessionConfirmAction, setSessionConfirmAction] = useState<SessionConfirmAction | null>(null);
    const [expandedSessionId, setExpandedSessionId] = useState<number | null>(null);
    const [showToast, setShowToast] = useState(false);
    const [cancelModalState, setCancelModalState] = useState<{
        isOpen: boolean;
        mode: 'immediately' | 'period_end' | null;
    }>({ isOpen: false, mode: null });
    
    // Edit Mode State
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        lastname: '',
        phone_number: ''
    });

    const isSaving = insertMutation.isPending || updateMutation.isPending;
    const isUpdatingUser = updateUserMutation.isPending;
    const isUploadingPicture = updateProfilePictureMutation.isPending;
    const isSyncingSessions = isFetchingSessions || revokeSessionMutation.isPending || logoutAllSessionsMutation.isPending;
    const isCancellingSubscription = cancelSubscriptionMutation.isPending;

    // Derived user data - prioritize fetched data over auth store data
    // The API might return 'name' and 'lastname' separately, or a 'full_name'
    // Based on IUserProfessionalClient in types.ts: name, lastname, phone_number
    const displayFirstName = fetchedUser?.name || user?.name || user?.full_name?.split(' ')[0] || '';
    const displayLastName = fetchedUser?.lastname || user?.lastname || user?.full_name?.split(' ').slice(1).join(' ') || '';
    const displayEmail = fetchedUser?.email || user?.email || '';
    const displayPhone = fetchedUser?.phone_number || user?.phone || '';
    const displayProfilePicture = fetchedUser?.profile_picture || null;
    const subscriptionSource = userData || user;
    const currentSubscription = subscriptionSource?.current_subscription ?? null;
    const subscriptionVigency = subscriptionSource?.subscription_vigency ?? null;
    const hasSubscriptionAccess =
        subscriptionSource?.has_active_subscription === true ||
        subscriptionVigency?.is_vigent === true;
    const isCancellationScheduled = currentSubscription?.cancel_at_period_end === true;
    const subscriptionPlanName =
        typeof currentSubscription?.plan === 'string'
            ? currentSubscription.plan
            : currentSubscription?.plan && typeof currentSubscription.plan === 'object' && 'name' in currentSubscription.plan
                ? String(currentSubscription.plan.name ?? '')
                : currentSubscription?.name
                    ? String(currentSubscription.name)
                    : null;
    const accessEndsAt =
        subscriptionVigency?.end_at ??
        currentSubscription?.current_period_end ??
        currentSubscription?.trial_end ??
        currentSubscription?.ended_at ??
        null;
    const sortedSessions = useMemo(
        () => [...sessions].sort((a, b) => Number(isCurrentSession(b)) - Number(isCurrentSession(a))),
        [sessions]
    );

    // Initialize form data when user data is available
    useEffect(() => {
        if (fetchedUser || user) {
            setFormData({
                name: displayFirstName,
                lastname: displayLastName,
                phone_number: displayPhone
            });
        }
    }, [fetchedUser, user, displayFirstName, displayLastName, displayPhone]);

    useEffect(() => {
        if (slots) {
            const mappedSlots = DAYS.map(day => {
                const existingSlot = slots.find(s => s.day_of_week === day.id);
                if (existingSlot) {
                    return {
                        ...existingSlot,
                        start_time: formatTimeForInput(existingSlot.start_time),
                        end_time: formatTimeForInput(existingSlot.end_time)
                    };
                }
                return {
                    day_of_week: day.id,
                    is_active: false,
                    start_time: '09:00',
                    end_time: '17:00'
                };
            });
            setWorkSlots(mappedSlots);
        } else if (!isLoadingSlots) {
            // Default state if no data yet (all disabled)
            setWorkSlots(DAYS.map(day => ({
                day_of_week: day.id,
                is_active: false,
                start_time: '09:00',
                end_time: '17:00'
            })));
        }
    }, [slots, isLoadingSlots]);

    useEffect(() => {
        if (sortedSessions.length === 0) {
            setExpandedSessionId(null);
            return;
        }

        setExpandedSessionId((previousValue) => {
            if (previousValue && sortedSessions.some((session) => session.id === previousValue)) {
                return previousValue;
            }

            const currentSession = sortedSessions.find((session) => isCurrentSession(session));
            return currentSession?.id ?? sortedSessions[0].id;
        });
    }, [sortedSessions]);

    const handleToggleDay = async (index: number) => {
        if (!professionalId) return;
        const slot = workSlots[index];
        const newIsActiveStatus = !slot.is_active;

        // Optimistic update
        const newSlots = [...workSlots];
        newSlots[index] = { ...slot, is_active: newIsActiveStatus };
        setWorkSlots(newSlots);

        setSavingSlots(prev => [...prev, slot.day_of_week]);

        try {
            if (slot.id) {
                // Update
                await updateMutation.mutateAsync({
                    id: slot.id,
                    slotData: { is_active: newIsActiveStatus }
                });
            } else {
                // Insert
                await insertMutation.mutateAsync({
                    day_of_week: slot.day_of_week,
                    is_active: newIsActiveStatus,
                    start_time: slot.start_time.length === 5 ? `${slot.start_time}:00` : slot.start_time,
                    end_time: slot.end_time.length === 5 ? `${slot.end_time}:00` : slot.end_time,
                    professional_id: parseInt(professionalId.toString())
                });
            }
            setShowToast(true);
            setTimeout(() => setShowToast(false), 2000);
        } catch (error) {
            // Rollback on error
            setWorkSlots(workSlots);
            console.error('Failed to save slot:', error);
        } finally {
            setSavingSlots(prev => prev.filter(id => id !== slot.day_of_week));
        }
    };

    const handleTimeChange = async (index: number, field: 'start_time' | 'end_time', value: string, skipSave: boolean = false) => {
        const slot = workSlots[index];
        const formattedValue = value.length === 5 ? `${value}:00` : value;

        // Optimistic update
        const newSlots = [...workSlots];
        newSlots[index] = { ...slot, [field]: value };
        setWorkSlots(newSlots);

        if (skipSave) return;

        setSavingSlots(prev => [...prev, slot.day_of_week]);

        try {
            if (slot.id) {
                await updateMutation.mutateAsync({
                    id: slot.id,
                    slotData: { [field]: formattedValue }
                });
                setShowToast(true);
                setTimeout(() => setShowToast(false), 2000);
            }
        } catch (error) {
            setWorkSlots(workSlots);
            console.error('Failed to update time:', error);
        } finally {
            setSavingSlots(prev => prev.filter(id => id !== slot.day_of_week));
        }
    };

    const handleSaveProfile = async () => {
        if (!userId) return;
        
        try {
            await updateUserMutation.mutateAsync({
                id: userId,
                data: {
                    name: formData.name,
                    lastname: formData.lastname,
                    phone_number: formData.phone_number
                }
            });
            setIsEditing(false);
            setShowToast(true);
            setTimeout(() => setShowToast(false), 2000);
        } catch (error) {
            console.error("Failed to update profile", error);
            // Optionally add error toast here
        }
    };

    const handleCancelEdit = () => {
        // Reset form data to current display values
        setFormData({
            name: displayFirstName,
            lastname: displayLastName,
            phone_number: displayPhone
        });
        setIsEditing(false);
    };

    const handleSaveProfilePicture = async (profilePicture: Blob) => {
        await updateProfilePictureMutation.mutateAsync(profilePicture);
    };

    const handleCancelSubscription = async (mode: 'immediately' | 'period_end') => {
        try {
            const response = await cancelSubscriptionMutation.mutateAsync({ mode });
            await refreshProfessional(true);
            setCancelModalState({ isOpen: false, mode: null });
            toast.success(
                response.message ||
                (mode === 'period_end'
                    ? 'Tu suscripción se cancelará al terminar el periodo actual.'
                    : 'Tu suscripción fue cancelada de inmediato.')
            );
        } catch (error) {
            toast.error(
                getApiErrorMessage(error) ||
                'No se pudo actualizar el estado de la suscripción.'
            );
        }
    };

    const handleCloseSession = (session: AuthSession) => {
        setSessionConfirmAction({ type: 'single', session });
    };

    const handleCloseAllSessions = () => {
        setSessionConfirmAction({ type: 'all' });
    };

    const isConfirmingSessionAction = sessionConfirmAction?.type === 'single'
        ? closingSessionIds.includes(sessionConfirmAction.session.id)
        : Boolean(sessionConfirmAction?.type === 'all' && logoutAllSessionsMutation.isPending);

    const closeSessionConfirmModal = () => {
        if (isConfirmingSessionAction) {
            return;
        }

        setSessionConfirmAction(null);
    };

    const handleConfirmSessionAction = async () => {
        if (!sessionConfirmAction) {
            return;
        }

        if (sessionConfirmAction.type === 'single') {
            const sessionId = sessionConfirmAction.session.id;
            setClosingSessionIds((prev) => (prev.includes(sessionId) ? prev : [...prev, sessionId]));

            try {
                await revokeSessionMutation.mutateAsync(sessionId);
                setSessionConfirmAction(null);
            } catch (error) {
                console.error('Failed to revoke session:', error);
            } finally {
                setClosingSessionIds((prev) => prev.filter((id) => id !== sessionId));
            }

            return;
        }

        try {
            await logoutAllSessionsMutation.mutateAsync();
            setSessionConfirmAction(null);
        } catch (error) {
            console.error('Failed to logout all sessions:', error);
        }
    };

    const toggleSessionExpand = (sessionId: number) => {
        setExpandedSessionId((previousValue) => (previousValue === sessionId ? null : sessionId));
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Mi Perfil</h1>
                    <p className="text-gray-500 mt-1">Gestiona tu información personal y profesional.</p>
                </div>

                {activeTab === 'professional' && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-2xl shadow-sm">
                        {isSaving ? (
                            <div className="flex items-center gap-2 text-nutrition-600">
                                <div className="w-4 h-4 border-2 border-nutrition-600/30 border-t-nutrition-600 rounded-full animate-spin" />
                                <span className="text-xs font-bold uppercase tracking-wider">Guardando...</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-nutrition-500">
                                <CheckCircle className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase tracking-wider">Sincronizado</span>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'sessions' && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-2xl shadow-sm">
                        {isSyncingSessions ? (
                            <div className="flex items-center gap-2 text-blue-600">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span className="text-xs font-bold uppercase tracking-wider">Actualizando...</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-blue-600">
                                <CheckCircle className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase tracking-wider">Sesiones al día</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 rounded-xl bg-gray-100 p-1">
                <button
                    onClick={() => setActiveTab('personal')}
                    className={`w-full rounded-lg py-2.5 text-sm font-medium leading-5 ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2
                        ${activeTab === 'personal'
                            ? 'bg-white text-blue-700 shadow'
                            : 'text-gray-500 hover:bg-white/12 hover:text-white'
                        }`}
                >
                    <div className="flex items-center justify-center gap-2">
                        <User className="w-4 h-4" />
                        Información Personal
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('professional')}
                    className={`w-full rounded-lg py-2.5 text-sm font-medium leading-5 ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2
                        ${activeTab === 'professional'
                            ? 'bg-white text-blue-700 shadow'
                            : 'text-gray-500 hover:bg-white/12 hover:text-white'
                        }`}
                >
                    <div className="flex items-center justify-center gap-2">
                        <Briefcase className="w-4 h-4" />
                        Configuración Profesional
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('sessions')}
                    className={`w-full rounded-lg py-2.5 text-sm font-medium leading-5 ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2
                        ${activeTab === 'sessions'
                            ? 'bg-white text-blue-700 shadow'
                            : 'text-gray-500 hover:bg-white/12 hover:text-white'
                        }`}
                >
                    <div className="flex items-center justify-center gap-2">
                        <Shield className="w-4 h-4" />
                        Sesiones
                    </div>
                </button>
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
                {activeTab === 'personal' ? (
                    <motion.div
                        key="personal"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="grid grid-cols-1 lg:grid-cols-3 gap-8"
                    >
                        {isLoadingUser ? (
                            <div className="lg:col-span-3 flex justify-center py-20">
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                                    <p className="text-gray-400 font-medium">Cargando información...</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Personal Info Card */}
                         <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm relative">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                        <User className="w-5 h-5 text-gray-500" />
                                        Datos Básicos
                                    </h2>
                                    
                                    {!isEditing ? (
                                        <button 
                                            onClick={() => setIsEditing(true)}
                                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                            Editar
                                        </button>
                                    ) : (
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={handleCancelEdit}
                                                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                                disabled={isUpdatingUser}
                                            >
                                                <X className="w-4 h-4" />
                                                Cancelar
                                            </button>
                                            <button 
                                                onClick={handleSaveProfile}
                                                disabled={isUpdatingUser}
                                                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                                            >
                                                {isUpdatingUser ? (
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                ) : (
                                                    <Save className="w-4 h-4" />
                                                )}
                                                Guardar
                                            </button>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Nombre(s)</label>
                                        {isEditing ? (
                                            <input 
                                                type="text"
                                                value={formData.name}
                                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                                className="w-full p-4 bg-white rounded-xl border border-gray-200 text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                                placeholder="Tu nombre"
                                            />
                                        ) : (
                                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-gray-900 font-medium">
                                                {displayFirstName || 'No definido'}
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Apellidos</label>
                                        {isEditing ? (
                                            <input 
                                                type="text"
                                                value={formData.lastname}
                                                onChange={(e) => setFormData({...formData, lastname: e.target.value})}
                                                className="w-full p-4 bg-white rounded-xl border border-gray-200 text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                                placeholder="Tus apellidos"
                                            />
                                        ) : (
                                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-gray-900 font-medium">
                                                {displayLastName || 'No definido'}
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Correo Electrónico</label>
                                        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100 text-gray-900">
                                            <Mail className="w-5 h-5 text-gray-400" />
                                            <span className="font-medium">{displayEmail}</span>
                                            {user?.email_verified && (
                                                <span className="ml-auto px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg flex items-center gap-1">
                                                    <CheckCircle className="w-3 h-3" />
                                                    Verificado
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-400 pl-1">* El correo electrónico no se puede editar.</p>
                                    </div>

                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Teléfono de Contacto</label>
                                        {isEditing ? (
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                    <Phone className="w-5 h-5 text-gray-400" />
                                                </div>
                                                <input 
                                                    type="tel"
                                                    value={formData.phone_number}
                                                    onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                                                    className="w-full p-4 pl-12 bg-white rounded-xl border border-gray-200 text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                                    placeholder="Tu número de teléfono"
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100 text-gray-500">
                                                <Phone className="w-5 h-5 text-gray-400" />
                                                <span className={`font-medium ${!displayPhone ? 'italic' : ''}`}>
                                                    {displayPhone || 'Sin registrar'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                         {/* Side Card */}
                         <div className="lg:col-span-1 space-y-6">
                             <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 blur-2xl opacity-50" />
                                
                                <div className="relative z-10 flex flex-col items-center text-center">
                                    <ProfileAvatarUploader
                                        firstName={displayFirstName}
                                        lastName={displayLastName}
                                        imageUrl={displayProfilePicture}
                                        onSave={handleSaveProfilePicture}
                                        isSaving={isUploadingPicture}
                                        previewMode="overlay"
                                    />
                                    <h3 className="text-lg font-bold text-gray-900">{displayFirstName} {displayLastName}</h3>
                                    <span className="inline-flex mt-2 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full border border-blue-100 uppercase tracking-wide">
                                        {user?.role}
                                    </span>
                                    
                                    <div className="mt-6 w-full pt-6 border-t border-gray-100">
                                        <p className="text-xs text-center text-gray-400">
                                            Miembro desde {new Date().getFullYear()}
                                        </p>
                                    </div>
                                </div>
                             </div>

                             <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900">Suscripción</h3>
                                        <p className="text-sm text-gray-500 mt-1">
                                            Administra tu acceso y la cancelación de tu plan.
                                        </p>
                                    </div>
                                    <span
                                        className={`inline-flex px-3 py-1 text-[11px] font-bold rounded-full border uppercase tracking-wide ${
                                            hasSubscriptionAccess
                                                ? isCancellationScheduled
                                                    ? 'bg-amber-50 text-amber-700 border-amber-100'
                                                    : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                : 'bg-gray-100 text-gray-600 border-gray-200'
                                        }`}
                                    >
                                        {hasSubscriptionAccess
                                            ? isCancellationScheduled
                                                ? 'Termina al final'
                                                : 'Activa'
                                            : 'Sin acceso'}
                                    </span>
                                </div>

                                <div className="mt-5 space-y-3">
                                    <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                                            Plan
                                        </p>
                                        <p className="mt-1 text-sm font-semibold text-gray-900">
                                            {subscriptionPlanName || 'Sin suscripción registrada'}
                                        </p>
                                    </div>

                                    {accessEndsAt && (
                                        <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                                                Acceso hasta
                                            </p>
                                            <p className="mt-1 text-sm font-semibold text-gray-900">
                                                {new Date(accessEndsAt).toLocaleString('es-MX')}
                                            </p>
                                        </div>
                                    )}

                                    {isCancellationScheduled && hasSubscriptionAccess && (
                                        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex gap-2">
                                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                            <span>
                                                Tu suscripción ya está programada para terminar automáticamente cuando cierre el periodo actual.
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {currentSubscription && hasSubscriptionAccess ? (
                                    <div className="mt-5 space-y-3">
                                        {!isCancellationScheduled && (
                                            <button
                                                onClick={() => setCancelModalState({ isOpen: true, mode: 'period_end' })}
                                                disabled={isCancellingSubscription}
                                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-amber-200 bg-amber-50 text-amber-800 text-sm font-semibold hover:bg-amber-100 disabled:opacity-50 transition-colors"
                                            >
                                                {isCancellingSubscription && cancelModalState.mode === 'period_end' ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Calendar className="w-4 h-4" />
                                                )}
                                                Cancelar al terminar periodo
                                            </button>
                                        )}

                                        <button
                                            onClick={() => setCancelModalState({ isOpen: true, mode: 'immediately' })}
                                            disabled={isCancellingSubscription}
                                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-red-200 bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 disabled:opacity-50 transition-colors"
                                        >
                                            {isCancellingSubscription && cancelModalState.mode === 'immediately' ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <X className="w-4 h-4" />
                                            )}
                                            Cancelar inmediatamente
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => navigate('/subscriptions/plans')}
                                        className="mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
                                    >
                                        Ver planes disponibles
                                    </button>
                                )}
                             </div>
                         </div>
                            </>
                        )}

                    </motion.div>
                ) : activeTab === 'professional' ? (
                    <motion.div
                        key="professional"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="grid grid-cols-1 lg:grid-cols-3 gap-8"
                    >
                        {/* Lateral Info */}
                        <div className="lg:col-span-1 space-y-6">
                            <motion.div
                                className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm"
                            >
                                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <Calendar className="w-5 h-5 text-nutrition-600" />
                                    Horarios de Trabajo
                                </h2>
                                <p className="text-sm text-gray-500 leading-relaxed">
                                    Define los intervalos de tiempo en los que estarás disponible para recibir sesiones. Estos horarios se reflejarán en tu calendario de agenda.
                                </p>

                                <div className="mt-6 flex items-start gap-3 p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                                    <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                                    <p className="text-xs text-blue-700 leading-normal">
                                        Los cambios realizados aquí actualizarán automáticamente los espacios disponibles en el dashboard de nutrición.
                                    </p>
                                </div>
                            </motion.div>
                        </div>

                        {/* Main Content: Work Slots */}
                        <div className="lg:col-span-2 space-y-4">
                            {isLoadingSlots ? (
                                /* Skeleton Loader */
                                Array.from({ length: 7 }).map((_, i) => (
                                    <div key={i} className="p-6 bg-white border border-gray-100 rounded-3xl animate-pulse">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-6 bg-gray-200 rounded-full" />
                                                <div className="w-20 h-4 bg-gray-200 rounded-md" />
                                            </div>
                                            <div className="flex gap-3">
                                                <div className="w-20 h-10 bg-gray-200 rounded-xl" />
                                                <div className="w-20 h-10 bg-gray-200 rounded-xl" />
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                workSlots.map((slot, index) => (
                                    <AvailableSlot
                                        key={slot.day_of_week}
                                        slot={slot}
                                        index={index}
                                        isSaving={savingSlots.includes(slot.day_of_week)}
                                        dayName={DAYS[index].label}
                                        handleToggleDay={handleToggleDay}
                                        handleTimeChange={handleTimeChange}
                                    />
                                ))
                            )}
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="sessions"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-4"
                    >
                        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    <Shield className="w-5 h-5 text-blue-600" />
                                    Gestión de Sesiones
                                </h2>
                                <p className="text-sm text-gray-500 mt-1">
                                    Revisa tus sesiones activas y cierra las que no reconozcas.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => refetchSessions()}
                                    disabled={isSyncingSessions}
                                    className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
                                >
                                    Actualizar
                                </button>
                                <button
                                    onClick={handleCloseAllSessions}
                                    disabled={logoutAllSessionsMutation.isPending}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 text-red-700 text-sm font-medium border border-red-100 hover:bg-red-100 disabled:opacity-50 transition-colors"
                                >
                                    {logoutAllSessionsMutation.isPending ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <LogOut className="w-4 h-4" />
                                    )}
                                    Cerrar todas
                                </button>
                            </div>
                        </div>

                        {isLoadingSessions ? (
                            Array.from({ length: 3 }).map((_, index) => (
                                <div key={index} className="p-6 bg-white border border-gray-100 rounded-3xl animate-pulse">
                                    <div className="w-40 h-5 bg-gray-200 rounded-md mb-4" />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="h-14 bg-gray-100 rounded-xl" />
                                        <div className="h-14 bg-gray-100 rounded-xl" />
                                        <div className="h-14 bg-gray-100 rounded-xl" />
                                        <div className="h-14 bg-gray-100 rounded-xl" />
                                    </div>
                                </div>
                            ))
                        ) : sortedSessions.length === 0 ? (
                            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm text-center">
                                <p className="text-gray-500 font-medium">No hay sesiones activas para mostrar.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {sortedSessions.map((session) => {
                                    const currentSession = isCurrentSession(session);
                                    const isClosing = closingSessionIds.includes(session.id);
                                    const isExpanded = expandedSessionId === session.id;
                                    const ipAddress = getSessionStringValue(session, ['ip_address']);
                                    const location = getSessionStringValue(session, ['location']);
                                    const networkLabel =
                                        ipAddress !== 'N/D' && location !== 'N/D'
                                            ? `${ipAddress} - ${location}`
                                            : ipAddress !== 'N/D'
                                                ? ipAddress
                                                : location;
                                    const createdAt = getSessionFormattedDate(session, ['created_at', 'last_used_at', 'last_activity_at']);
                                    const expiresAt = getSessionFormattedDate(session, ['expires_at']);

                                    return (
                                        <motion.article
                                            key={session.id}
                                            layout
                                            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                                            className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden"
                                        >
                                            <div className="p-5 sm:p-6">
                                                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3 md:gap-4 items-start">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleSessionExpand(session.id)}
                                                        aria-expanded={isExpanded}
                                                        aria-controls={`session-details-${session.id}`}
                                                        className="text-left rounded-2xl border border-transparent hover:border-gray-200 hover:bg-gray-50/60 transition-all p-2 -m-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-nutrition-500/40"
                                                    >
                                                        <div className="flex items-start sm:items-center gap-3">
                                                            <span className="shrink-0 rounded-xl border border-gray-200 bg-gray-50 p-2">
                                                                <Monitor className="w-4 h-4 text-gray-600" />
                                                            </span>

                                                            <div className="min-w-0 flex-1">
                                                                <p className="font-semibold text-gray-900 leading-snug break-words">
                                                                    {getSessionTitle(session)}
                                                                </p>
                                                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                                                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                                                                        Activa
                                                                    </span>
                                                                    {currentSession && (
                                                                        <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                                                                            Sesión actual
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <motion.span
                                                                animate={{ rotate: isExpanded ? 180 : 0 }}
                                                                transition={{ duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
                                                                className="text-gray-400 self-center shrink-0"
                                                            >
                                                                <ChevronDown className="w-5 h-5" />
                                                            </motion.span>
                                                        </div>
                                                    </button>

                                                    <button
                                                        onClick={() => handleCloseSession(session)}
                                                        disabled={isClosing || logoutAllSessionsMutation.isPending}
                                                        className="inline-flex w-full md:w-auto shrink-0 items-center justify-center gap-2 px-4 py-2 rounded-xl border border-red-100 bg-red-50 text-red-700 text-sm font-medium whitespace-nowrap hover:bg-red-100 disabled:opacity-50 transition-colors"
                                                    >
                                                        {isClosing ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <LogOut className="w-4 h-4" />
                                                        )}
                                                        Cerrar sesión
                                                    </button>
                                                </div>

                                                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                                                    <div className="inline-flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2 text-sm text-gray-600">
                                                        <Globe className="w-4 h-4 text-gray-400 shrink-0" />
                                                        <span className="break-all">{networkLabel}</span>
                                                    </div>
                                                    <div className="inline-flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2 text-sm text-gray-600">
                                                        <Clock3 className="w-4 h-4 text-gray-400 shrink-0" />
                                                        <span>Creada: {createdAt}</span>
                                                    </div>
                                                    <div className="inline-flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2 text-sm text-gray-600">
                                                        <Clock3 className="w-4 h-4 text-gray-400 shrink-0" />
                                                        <span>Expira: {expiresAt}</span>
                                                    </div>
                                                </div>

                                                <AnimatePresence initial={false}>
                                                    {isExpanded && (
                                                        <motion.div
                                                            id={`session-details-${session.id}`}
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                                                            className="overflow-hidden"
                                                        >
                                                            <motion.div
                                                                initial={{ y: -8, opacity: 0 }}
                                                                animate={{ y: 0, opacity: 1 }}
                                                                exit={{ y: -6, opacity: 0 }}
                                                                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                                                className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3"
                                                            >
                                                                {getSessionEntries(session).map(([key, value]) => (
                                                                    <div key={`${session.id}-${key}`} className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
                                                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                                                                            {formatSessionKey(key)}
                                                                        </p>
                                                                        <p className="text-sm text-gray-700 mt-1 break-all">
                                                                            {formatSessionValue(key, value)}
                                                                        </p>
                                                                    </div>
                                                                ))}
                                                            </motion.div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        </motion.article>
                                    );
                                })}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            <Modal
                isOpen={Boolean(sessionConfirmAction)}
                onClose={closeSessionConfirmModal}
                title={sessionConfirmAction?.type === 'all' ? 'Cerrar todas las sesiones' : 'Cerrar sesión'}
                size="md"
            >
                <div className="space-y-6 pt-2">
                    <div className="flex flex-col items-center text-center gap-4">
                        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center">
                            <LogOut className="w-7 h-7 text-red-600" />
                        </div>

                        <div className="space-y-2 max-w-sm">
                            {sessionConfirmAction?.type === 'all' ? (
                                <p className="text-sm text-gray-600">
                                    Vas a cerrar todas las sesiones activas de tu cuenta en otros dispositivos.
                                </p>
                            ) : (
                                <p className="text-sm text-gray-600">
                                    {sessionConfirmAction && isCurrentSession(sessionConfirmAction.session)
                                        ? 'Vas a cerrar tu sesión actual. Tendrás que iniciar sesión nuevamente.'
                                        : '¿Deseas cerrar esta sesión?'}
                                </p>
                            )}

                            {sessionConfirmAction?.type === 'single' && (
                                <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-left">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Sesión</p>
                                    <p className="text-sm text-gray-700 mt-1 break-words">
                                        {getSessionTitle(sessionConfirmAction.session)}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                        <button
                            onClick={closeSessionConfirmModal}
                            disabled={isConfirmingSessionAction}
                            className="px-5 py-2.5 text-xs font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all uppercase tracking-wide disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirmSessionAction}
                            disabled={isConfirmingSessionAction}
                            className="px-6 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-lg shadow-red-500/20 transition-all hover:-translate-y-0.5 active:translate-y-0 uppercase tracking-wide text-xs inline-flex items-center gap-2"
                        >
                            {isConfirmingSessionAction ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Procesando...
                                </>
                            ) : (
                                <>
                                    <LogOut className="w-4 h-4" />
                                    {sessionConfirmAction?.type === 'all' ? 'Cerrar todas' : 'Cerrar sesión'}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Success Toast */}
            <AnimatePresence>
                {showToast && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, x: "-50%" }}
                        animate={{ opacity: 1, y: 0, x: "-50%" }}
                        exit={{ opacity: 0, y: 20, x: "-50%" }}
                        className="fixed bottom-10 left-1/2 z-50 flex items-center gap-3 bg-gray-900 text-white px-6 py-4 rounded-3xl shadow-2xl border border-white/10 backdrop-blur-md"
                    >
                        <div className="w-8 h-8 rounded-full bg-nutrition-500/20 flex items-center justify-center">
                            <CheckCircle className="w-5 h-5 text-nutrition-400" />
                        </div>
                        <div>
                            <p className="font-bold text-sm">Cambios guardados</p>
                            <p className="text-gray-400 text-xs text-nowrap">Tus horarios se han actualizado correctamente.</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <CancelSubscriptionModal
                isOpen={cancelModalState.isOpen}
                onClose={() => setCancelModalState({ isOpen: false, mode: null })}
                onConfirm={() => {
                    if (cancelModalState.mode) {
                        handleCancelSubscription(cancelModalState.mode);
                    }
                }}
                isCancelling={isCancellingSubscription}
                cancelMode={cancelModalState.mode}
            />
        </div>
    );
}
