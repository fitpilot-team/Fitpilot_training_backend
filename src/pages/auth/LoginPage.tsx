import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Mail, Lock, Zap, Timer } from 'lucide-react';
import logo from '@/assets/fitpilot-logo.svg';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/newAuthStore';
import { loginSchema, LoginFormData } from '../../utils/validation';
import toast from 'react-hot-toast';
import { useLoginMutation } from '@/hooks/useLogin';
import { useTranslation } from 'react-i18next';

export function LoginPage() {
    const [isLogin] = useState(true);
    const navigate = useNavigate();
    const { t } = useTranslation('auth');
    const { isAuthenticated, authChecked } = useAuthStore();
    const { mutate: login, isPending: isLoading, error } = useLoginMutation();

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            identifier: '',
            password: '',
        },
    });

    useEffect(() => {
        if (authChecked && isAuthenticated) {
            navigate('/', { replace: true });
        }
    }, [authChecked, isAuthenticated, navigate]);

    const translateError = (message?: string) => (message ? t(message) : undefined);

    const onSubmit = (data: LoginFormData) => {
        login({ ...data, app_type: 'PROFESSIONAL_APP' }, {
            onSuccess: () => {
                toast.success(t('messages.loginSuccess'));
                navigate('/', { replace: true });
            },
            onError: (err: any) => {
                toast.error(err.message || t('pages.login.loginFailed'));
            }
        });
    };

    return (
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-5xl w-full flex flex-col md:flex-row min-h-[600px]">
            {/* Left Side - Brand & Visuals */}
            <div className="relative w-full md:w-1/2 bg-linear-to-br from-[#182F50] via-[#1D3A63] to-[#12243D] p-12 text-white overflow-hidden flex flex-col justify-between">
                {/* Background Decor */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#2B568D]/25 rounded-full blur-[100px]" />
                    <div className="absolute bottom-0 right-0 w-64 h-64 bg-[#3A75B8]/15 rounded-full blur-[80px]" />
                </div>

                {/* Header */}
                <div className="relative z-10 flex items-center gap-3">
                    <div className="bg-white rounded-lg shadow-xl flex items-center justify-center overflow-hidden pt-2 px-1">
                        <img src={logo} alt="FitPilot Logo" className="w-14 h-14 object-cover scale-150  object-center " />
                    </div>
                    {/* <span className="text-xl font-bold tracking-wide">FitPilot</span> */}
                </div>

                {/* Central Visual */}
                <div className="relative z-10 flex-1 flex items-center justify-center my-8">
                    <div className="relative w-64 h-64">
                         {/* Circle container */}
                        <div className="absolute inset-0 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm flex items-center justify-center">
                             {/* Stats illustration */}
                             <div className="flex items-end gap-2 h-24">
                                <motion.div 
                                    className="w-6 bg-white rounded-t-sm"
                                    initial={{ height: 0 }}
                                    animate={{ height: "60%" }}
                                    transition={{ duration: 1, delay: 0.2 }}
                                />
                                <motion.div 
                                    className="w-6 bg-white rounded-t-sm"
                                    initial={{ height: 0 }}
                                    animate={{ height: "100%" }}
                                    transition={{ duration: 1, delay: 0.4 }}
                                />
                                <motion.div 
                                    className="w-6 bg-white rounded-t-sm"
                                    initial={{ height: 0 }}
                                    animate={{ height: "40%" }}
                                    transition={{ duration: 1, delay: 0.6 }}
                                />
                             </div>
                        </div>

                        {/* Floating elements */}
                        <motion.div 
                            className="absolute -right-4 top-10 p-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-xl"
                            animate={{ y: [0, -10, 0] }}
                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        >
                            <Timer className="w-6 h-6 text-white" />
                        </motion.div>
                        
                        <motion.div 
                            className="absolute -left-4 bottom-10 p-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-xl"
                            animate={{ y: [0, 10, 0] }}
                            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                        >
                             <Zap className="w-6 h-6 text-white" />
                        </motion.div>
                    </div>
                </div>

                {/* Footer Text */}
                <div className="relative z-10">
                    <h2 className="text-3xl font-bold mb-4">{t('pages.shared.leftTitle')}</h2>
                    <p className="text-gray-300 text-sm leading-relaxed max-w-sm">
                        {t('pages.shared.leftSubtitle')}
                    </p>
                    <div className="mt-8 text-xs text-gray-500">
                        {t('pages.shared.copyright')}
                    </div>
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="w-full md:w-1/2 p-8 md:p-12 bg-white flex flex-col justify-center">
                <div className="max-w-md mx-auto w-full">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('pages.login.title')}</h1>
                        <p className="text-gray-500 text-sm">{t('pages.login.subtitle')}</p>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                        <Input 
                            label={t('pages.login.identifierLabel')}
                            placeholder={t('pages.login.identifierPlaceholder')}
                            type="text"
                            icon={<Mail className="w-5 h-5" />}
                            error={translateError(errors.identifier?.message)}
                            {...register('identifier')}
                        />
                        
                        <div className="space-y-1">
                            <Input 
                                label={t('pages.login.passwordLabel')}
                                placeholder={t('pages.login.passwordPlaceholder')}
                                type="password"
                                icon={<Lock className="w-5 h-5" />}
                                error={translateError(errors.password?.message)}
                                {...register('password')}
                            />
                            {isLogin && (
                                <div className="flex justify-end">
                                    <a href="#" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                                        {t('pages.login.forgotPassword')}
                                    </a>
                                </div>
                            )}
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                                {error.message}
                            </div>
                        )}

                        <Button 
                            type="submit" 
                            className="w-full !bg-none !bg-[#67B5DE] hover:!bg-[#4FA5D2] focus:!ring-[#67B5DE] !shadow-[#67B5DE]/25 hover:!shadow-[#67B5DE]/35"
                            isLoading={isLoading}
                        >
                            {t('pages.login.submit')}
                        </Button>
                    </form>

                    <div className="mt-8">
                        <div className="mt-8 text-center">
                            <p className="text-sm text-gray-500">
                                {t('pages.login.noAccount')}{' '}
                                <Link to="/auth/register" className="font-semibold text-blue-600 hover:text-blue-700 transition-colors hover:cursor-pointer">
                                    {t('pages.login.signUp')}
                                </Link>
                            </p>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
