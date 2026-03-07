import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Mail, Lock, Zap, Timer, User, Phone } from 'lucide-react';
import logo from '@/assets/fitpilot-logo.svg';
import { motion } from 'framer-motion';
import { Modal } from '../../components/common/Modal';
import { OTPInput } from '../../components/common/OTPInput';
import { useSendVerification, useSignupMutation, useVerifyPhone } from '@/features/auth/queries';
import { useAuthStore } from '@/store/newAuthStore';
import { getUserRequest } from '@/api/auth/auth.api';
import { useTranslation } from 'react-i18next';

export function RegisterPage() {
    const navigate = useNavigate();
    const { t } = useTranslation('auth');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
    const [isPhoneVerified, setIsPhoneVerified] = useState(false);
    const [verificationAttempts, setVerificationAttempts] = useState(0);
    const [cooldownTime, setCooldownTime] = useState(0);
    
    const sendVerificationMutation = useSendVerification();
    const verifyPhoneMutation = useVerifyPhone();
    const signupMutation = useSignupMutation();

    const isFormValid = 
        firstName.trim() !== '' &&
        lastName.trim() !== '' &&
        email.trim() !== '' &&
        password.length >= 8 &&
        confirmPassword !== '' &&
        password === confirmPassword &&
        isPhoneVerified;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isFormValid || signupMutation.isPending) return;

        signupMutation.mutate(
            {
                name: firstName.trim(),
                lastname: lastName.trim(),
                email: email.trim(),
                password,
                role: 'PROFESSIONAL',
                phone_number: phoneNumber.trim(),
            },
            {
                onSuccess: async (response) => {
                    if (response.access_token) {
                        useAuthStore.getState().setAuth({ token: response.access_token });

                        try {
                            const user = await getUserRequest();
                            useAuthStore.getState().setUser(user);
                        } catch (error) {
                            console.error('Failed to load user after signup:', error);
                        }

                        navigate('/', { replace: true });
                        return;
                    }

                    console.warn('Signup succeeded but no access_token was returned');
                },
                onError: (error) => {
                    console.error('Failed to signup:', error);
                },
            }
        );
    };

    useEffect(() => {
        if (cooldownTime > 0) {
            const timer = setTimeout(() => setCooldownTime(cooldownTime - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [cooldownTime]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        if (m > 0) {
            return `${m}:${s.toString().padStart(2, '0')}`;
        }
        return `${s}s`;
    };

    const handleSendVerification = () => {
        if (!phoneNumber || cooldownTime > 0) return;
        
        sendVerificationMutation.mutate(
            { phone_number: phoneNumber },
            {
                onSuccess: () => {
                    setIsVerificationModalOpen(true);
                    
                    const nextAttempt = verificationAttempts + 1;
                    setVerificationAttempts(nextAttempt);
                    
                    // Backoff logic
                    if (nextAttempt === 1) setCooldownTime(60); // 1 minute
                    else if (nextAttempt === 2) setCooldownTime(300); // 5 minutes
                    else if (nextAttempt === 3) setCooldownTime(900); // 15 minutes
                    else setCooldownTime(1800); // 30 minutes
                },
                onError: (error) => {
                    console.error("Failed to send verification:", error);
                    // Handle error (show toast, etc.)
                }
            }
        );
    };

    const handleVerifyPhone = () => {
        if (!verificationCode || verificationCode.length !== 6) return;
        
        verifyPhoneMutation.mutate(
            { phone_number: phoneNumber, code: verificationCode },
            {
                onSuccess: () => {
                    setIsVerificationModalOpen(false);
                    setVerificationCode('');
                    setIsPhoneVerified(true);
                    // Handle success (show success message, mark phone as verified, etc.)
                },
                onError: (error) => {
                    console.error("Failed to verify phone:", error);
                    // Handle error (show toast, etc.)
                }
            }
        );
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
                        <img src={logo} alt="FitPilot Logo" className="w-14 h-14 object-cover scale-150 object-center" />
                    </div>
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

            {/* Right Side - Register Form */}
            <div className="w-full md:w-1/2 p-8 md:p-12 bg-white flex flex-col justify-center">
                <div className="max-w-md mx-auto w-full">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('pages.register.title')}</h1>
                        <p className="text-gray-500 text-sm">{t('pages.register.subtitle')}</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <Input 
                                label={t('pages.register.firstNameLabel')}
                                placeholder={t('pages.register.firstNamePlaceholder')}
                                type="text"
                                icon={<User className="w-5 h-5" />}
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                            />
                            <Input 
                                label={t('pages.register.lastNameLabel')}
                                placeholder={t('pages.register.lastNamePlaceholder')}
                                type="text"
                                icon={<User className="w-5 h-5" />}
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-2 items-end">
                            <div className="flex-1">
                                <Input 
                                    label={t('pages.register.phoneLabel')}
                                    placeholder={t('pages.register.phonePlaceholder')}
                                    type="tel"
                                    icon={<Phone className="w-5 h-5" />}
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    disabled={isPhoneVerified}
                                />
                            </div>
                            <Button 
                                type="button" 
                                variant="secondary"
                                className="mb-[2px]"
                                onClick={handleSendVerification}
                                isLoading={sendVerificationMutation.isPending}
                                disabled={isPhoneVerified || !phoneNumber || cooldownTime > 0}
                            >
                                {isPhoneVerified 
                                    ? t('pages.register.verify.verified')
                                    : cooldownTime > 0 
                                        ? t('pages.register.verify.resendIn', { time: formatTime(cooldownTime) })
                                        : verificationAttempts > 0 
                                            ? t('pages.register.verify.resend')
                                            : t('pages.register.verify.validate')}
                            </Button>
                        </div>

                        <Input 
                            label={t('pages.register.emailLabel')}
                            placeholder={t('pages.register.emailPlaceholder')}
                            type="email"
                            icon={<Mail className="w-5 h-5" />}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        
                        <div className="space-y-4">
                            <div>
                                <Input 
                                    label={t('pages.register.passwordLabel')}
                                    placeholder={t('pages.register.passwordPlaceholder')}
                                    type="password"
                                    icon={<Lock className="w-5 h-5" />}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                {password.length > 0 && password.length < 8 && (
                                    <p className="text-xs text-red-500 font-medium pl-1 mt-1">
                                        {t('pages.register.passwordMin')}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <Input 
                                    label={t('pages.register.confirmPasswordLabel')}
                                    placeholder={t('pages.register.confirmPasswordPlaceholder')}
                                    type="password"
                                    icon={<Lock className="w-5 h-5" />}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                                {password && confirmPassword && password === confirmPassword && (
                                    <p className="text-xs text-green-600 font-medium pl-1">
                                        {`✓ ${t('pages.register.passwordsMatch')}`}
                                    </p>
                                )}
                            </div>
                        </div>

                        <Button 
                            type="submit" 
                            className="w-full !bg-none !bg-[#67B5DE] hover:!bg-[#4FA5D2] focus:!ring-[#67B5DE] !shadow-[#67B5DE]/25 hover:!shadow-[#67B5DE]/35"
                            isLoading={signupMutation.isPending}
                            disabled={!isFormValid || signupMutation.isPending}
                        >
                            {t('pages.register.submit')}
                        </Button>
                    </form>

                    <div className="mt-8">
                        <div className="text-center">
                            <p className="text-sm text-gray-500">
                                {t('pages.register.hasAccount')}{' '}
                                <Link to="/auth/login" className="font-semibold text-blue-600 hover:text-blue-700 transition-colors hover:cursor-pointer">
                                    {t('pages.register.signIn')}
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <Modal
                isOpen={isVerificationModalOpen}
                onClose={() => {
                    setIsVerificationModalOpen(false);
                    setVerificationCode('');
                }}
                title={t('pages.register.verify.modalTitle')}
            >
                <div className="space-y-4">
                    <p className="text-gray-600 text-sm mb-6 text-center">
                        {t('pages.register.verify.modalDescription', { phoneNumber })}
                    </p>
                    <div className="flex justify-center mb-8">
                        <OTPInput
                            value={verificationCode}
                            onChange={setVerificationCode}
                            length={6}
                        />
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button
                            variant="secondary"
                            onClick={() => {
                                setIsVerificationModalOpen(false);
                                setVerificationCode('');
                            }}
                        >
                            {t('pages.register.verify.cancel')}
                        </Button>
                        <Button
                            onClick={handleVerifyPhone}
                            isLoading={verifyPhoneMutation.isPending}
                            disabled={verificationCode.length !== 6}
                        >
                            {t('pages.register.verify.accept')}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
