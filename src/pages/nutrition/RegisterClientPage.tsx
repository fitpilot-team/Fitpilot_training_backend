import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useCreateUser, useValidatePhone } from '@/features/users/queries';
import { useProfessionalClients } from '@/features/professional-clients/queries';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { ChevronLeft, CheckCircle, Smartphone, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useProfessional } from '@/contexts/ProfessionalContext';
import { resolvePlanAccess } from '@/features/subscriptions/planAccess';

export function RegisterClientPage() {
    const navigate = useNavigate();
    const { mutateAsync: createUser, isPending } = useCreateUser();
    const { professional, userData } = useProfessional();
    const accessUser = userData ?? null;
    const professionalId = accessUser?.id
        ? Number(accessUser.id)
        : professional?.sub
            ? Number(professional.sub)
            : undefined;
    const planAccess = resolvePlanAccess(accessUser);
    const {
        data: rawClients,
        isLoading: isLoadingClients,
        refetch: refetchClients,
    } = useProfessionalClients(professionalId ?? '');
    const clientCount = rawClients?.length ?? 0;
    const hasClientLimit = planAccess.maxClients !== null;
    const hasReachedClientLimit = hasClientLimit && clientCount >= Number(planAccess.maxClients);
    
    // Phone Verification Hooks
    const { mutateAsync: validatePhone, isPending: isValidatingPhone } = useValidatePhone();

    const [formData, setFormData] = useState({
        name: '',
        lastname: '',
        email: '',
        phone_number: '',
    });

    // Phone Verification State
    const [isPhoneVerified, setIsPhoneVerified] = useState(false);

    const [errors, setErrors] = useState<Record<string, string>>({});

    const validateForm = () => {
        const newErrors: Record<string, string> = {};
        if (!formData.name) newErrors.name = 'El nombre es requerido';
        if (!formData.lastname) newErrors.lastname = 'Los apellidos son requeridos';
        if (!formData.phone_number) newErrors.phone_number = 'El teléfono es requerido';
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };


    const handleVerifyPhone = async () => {
        if (!formData.phone_number) {
            toast.error('Ingrese un número de teléfono primero');
            return;
        }
        try {
            const result = await validatePhone(formData.phone_number);
            if (result.isValid) {
                setIsPhoneVerified(true);
                toast.success('Teléfono validado correctamente');
            } else {
                toast.error('El número de teléfono no es válido');
            }
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Error al validar el teléfono');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (hasReachedClientLimit) {
            toast.error(
                `Tu plan Starter permite máximo ${planAccess.maxClients} clientes. Mejora tu plan para agregar más.`
            );
            return;
        }
        
        if (!validateForm()) return;

        try {
            if (hasClientLimit) {
                const refreshedClients = await refetchClients();
                const latestClientCount = refreshedClients.data?.length ?? clientCount;

                if (latestClientCount >= Number(planAccess.maxClients)) {
                    toast.error(
                        `Tu plan Starter permite máximo ${planAccess.maxClients} clientes. Mejora tu plan para agregar más.`
                    );
                    return;
                }
            }

            await createUser({
                ...formData,
                role: 'CLIENT', // Hidden from user
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                professional_id: professionalId,
                service_type: 'NUTRITION',
            });
            
            toast.success('Cliente registrado exitosamente');
            navigate('/nutrition/clients');
        } catch (error) {
            console.error(error);
            toast.error('Error al registrar el cliente');
        }
    };

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <div className="mb-6">
                <button
                    onClick={() => navigate('/nutrition/clients')}
                    className="flex items-center text-gray-600 hover:text-gray-900 transition-colors mb-4"
                >
                    <ChevronLeft className="w-5 h-5 mr-1" />
                    Volver al listado
                </button>
                <h1 className="text-2xl font-bold text-gray-900">Registrar Nuevo Cliente</h1>
                <p className="text-gray-500 mt-1">
                    Complete la información para dar de alta un nuevo cliente.
                </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {hasReachedClientLimit && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-semibold text-amber-900">
                                        Tu plan Starter ya alcanzó el máximo de {planAccess.maxClients} clientes.
                                    </p>
                                    <p className="text-sm text-amber-800">
                                        Mejora tu plan para seguir agregando clientes.
                                    </p>
                                </div>
                            </div>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => navigate('/subscriptions/plans')}
                            >
                                Ver planes
                            </Button>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input
                            label="Nombre"
                            placeholder="Ej. Juan"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            error={errors.name}
                        />
                        <Input
                            label="Apellidos"
                            placeholder="Ej. Pérez"
                            value={formData.lastname}
                            onChange={(e) => setFormData({ ...formData, lastname: e.target.value })}
                            error={errors.lastname}
                        />
                    </div>

                    <Input
                        label="Correo Electrónico (Opcional)"
                        type="email"
                        placeholder="juan.perez@ejemplo.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        error={errors.email}
                    />

                    <div>
                        <div className="flex items-end gap-3">
                            <div className="flex-1">
                                    <Input
                                        label="Número de Teléfono"
                                        type="tel"
                                        placeholder="+52 55 1234 5678"
                                        value={formData.phone_number}
                                        onChange={(e) => {
                                            setFormData({ ...formData, phone_number: e.target.value });
                                            if (isPhoneVerified) setIsPhoneVerified(false); // Reset if changed
                                        }}
                                        error={errors.phone_number}
                                    />
                            </div>
                            <div className="mb-[2px]"> {/* Align with input height approx */}
                                {isPhoneVerified ? (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg border border-green-200 h-[42px]">
                                        <CheckCircle className="w-5 h-5" />
                                        <span className="font-medium text-sm">Verificado</span>
                                    </div>
                                ) : (
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={handleVerifyPhone}
                                        isLoading={isValidatingPhone}
                                        className="h-[42px]"
                                    >
                                        <Smartphone className="w-4 h-4 mr-2" />
                                        Verificar
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <Button
                            type="button"
                            variant="secondary"
                            className="mr-3"
                            onClick={() => navigate('/nutrition/clients')}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            isLoading={isPending}
                            disabled={!isPhoneVerified || isPending || hasReachedClientLimit || isLoadingClients}
                            className="bg-gradient-to-r from-green-500 via-green-600 to-green-700 hover:from-green-600 hover:via-green-700 hover:to-green-800 shadow-green-500/25 focus:ring-green-500"
                        >
                            Registrar Cliente
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
