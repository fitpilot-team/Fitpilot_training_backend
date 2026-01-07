import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Mail, Lock, Linkedin, Twitter, Dumbbell, Zap, Timer } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/newAuthStore';
import { loginSchema, LoginFormData } from '../../utils/validation';
import toast from 'react-hot-toast';
import { useLoginMutation} from '@/hooks/useLogin';

export function LoginPage() {
    const [isLogin, setIsLogin] = useState(true);
    const navigate = useNavigate();
    const { isAuthenticated } = useAuthStore();
    const { mutate: login, isPending: isLoading, error } = useLoginMutation();

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: '',
            password: '',
        },
    });

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/', { replace: true });
        }
    }, [isAuthenticated, navigate]);

    const onSubmit = (data: LoginFormData) => {
        login(data, {
            onSuccess: () => {
                toast.success('Successfully logged in!');
                navigate('/', { replace: true });
            },
            onError: (err: any) => {
                toast.error(err.message || 'Login failed. Please try again.');
            }
        });
    };

    return (
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-5xl w-full flex flex-col md:flex-row min-h-[600px]">
            {/* Left Side - Brand & Visuals */}
            <div className="relative w-full md:w-1/2 bg-linear-to-br from-[#1a1c4b] via-[#2d1b4e] to-[#1a1033] p-12 text-white overflow-hidden flex flex-col justify-between">
                {/* Background Decor */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/20 rounded-full blur-[100px]" />
                    <div className="absolute bottom-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px]" />
                </div>

                {/* Header */}
                <div className="relative z-10 flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                        <Dumbbell className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-xl font-bold tracking-wide">FitPilot</span>
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
                    <h2 className="text-3xl font-bold mb-4">Elevate Your Training</h2>
                    <p className="text-gray-300 text-sm leading-relaxed max-w-sm">
                        AI-assisted workout routine management tailored specifically for professional trainers and dedicated athletes.
                    </p>
                    <div className="mt-8 text-xs text-gray-500">
                        © 2024 FitPilot Inc. All rights reserved.
                    </div>
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="w-full md:w-1/2 p-8 md:p-12 bg-white flex flex-col justify-center">
                <div className="max-w-md mx-auto w-full">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
                        <p className="text-gray-500 text-sm">Please enter your details to sign in.</p>
                    </div>

                    {/* Tabs */}
                    

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                        <Input 
                            label="Email"
                            placeholder="trainer1@fitpilot.com"
                            type="email"
                            icon={<Mail className="w-5 h-5" />}
                            error={errors.email?.message}
                            {...register('email')}
                        />
                        
                        <div className="space-y-1">
                            <Input 
                                label="Password"
                                placeholder="••••••••"
                                type="password"
                                icon={<Lock className="w-5 h-5" />}
                                error={errors.password?.message}
                                {...register('password')}
                            />
                            {isLogin && (
                                <div className="flex justify-end">
                                    <a href="#" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                                        Forgot password?
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
                            className="w-full"
                            isLoading={isLoading}
                        >
                            Sign In
                        </Button>
                    </form>

                    <div className="mt-8">
                        {/* <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-100"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-4 bg-white text-gray-400">Or continue with</span>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-center gap-4">
                            <button className="p-2 border border-blue-100 rounded-xl hover:bg-blue-50 hover:border-blue-200 transition-colors group">
                                <Linkedin className="w-5 h-5 text-gray-400 group-hover:text-[#0077b5] transition-colors" />
                            </button>
                            <button className="p-2 border border-blue-100 rounded-xl hover:bg-blue-50 hover:border-blue-200 transition-colors group hover:cursor-pointer">
                                <Twitter className="w-5 h-5 text-gray-400 group-hover:text-[#1da1f2] transition-colors" />
                            </button>
                        </div> */}
                        
                        <div className="mt-8 text-center">
                            <p className="text-sm text-gray-500">
                                Don't have an account?{' '}
                                <Link to="/auth/register" className="font-semibold text-blue-600 hover:text-blue-700 transition-colors hover:cursor-pointer">
                                    Sign Up
                                </Link>
                            </p>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}