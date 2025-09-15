"use client";

import { useEffect, useState } from "react";
import useAuthStore from "@/store/authStore";
import { showSuccess, showError, showInfo } from "@/utils/toast";

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [username, setUsername] = useState("user");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("password");
    const [isLoading, setIsLoading] = useState(false);
    const { login, register, isAuthenticated } = useAuthStore();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        if (mode === 'login') {
            await login(username, password);
        } else {
            if (!email) {
                showError("Email es requerido para registro");
                setIsLoading(false);
                return;
            }
            await register(email, username, password);
        }

        setIsLoading(false);
    };

    useEffect(() => {
        if (isAuthenticated) {
            onClose();
        }
    }, [isAuthenticated]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-base-100 p-6 rounded-lg shadow-xl w-96">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold">
                        {mode === 'login' ? 'Iniciar Sesión' : 'Registrarse'}
                    </h2>
                    {/* <button
                        type="button"
                        onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                        className="btn btn-ghost btn-sm"
                        disabled={isLoading}
                    >
                        {mode === 'login' ? 'Registrarse' : 'Iniciar Sesión'}
                    </button> */}
                </div>
                <form onSubmit={handleSubmit}>
                    {mode === 'register' && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-2">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="input input-bordered w-full"
                                required
                            />
                        </div>
                    )}
                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-2">Usuario</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="input input-bordered w-full"
                            required
                        />
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-2">Contraseña</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="input input-bordered w-full"
                            required
                        />
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn btn-ghost"
                            disabled={isLoading}
                        >
                            Cancelar
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={isLoading}>
                            {isLoading ? <span className="loading loading-spinner"></span> : (mode === 'login' ? 'Iniciar Sesión' : 'Registrarse')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}