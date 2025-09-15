import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import { API_LOGIN, API_REGISTER } from '../config';
import { showSuccess, showError, showInfo } from '../utils/toast';

interface AuthState {
    token: string | null;
    user: { username: string; email?: string } | null;
    isAuthenticated: boolean;
    login: (username: string, password: string) => Promise<void>;
    register: (email: string, username: string, password: string) => Promise<void>;
    logout: () => void;
}

const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            token: null,
            user: null,
            isAuthenticated: false,
            login: async (username, password) => {
                showInfo('Iniciando sesión...');
                try {
                    const response = await axios.post(API_LOGIN, { user: username, password });
                    const token = response.data.data.token;
                    if (token) {
                        set({ token, user: { username }, isAuthenticated: true });
                        showSuccess('Sesión iniciada exitosamente');
                    } else {
                        showError('Respuesta inválida del servidor');
                    }
                } catch (err: any) {
                    showError(err.response?.data?.message || 'Error al iniciar sesión');
                }
            },
            register: async (email, username, password) => {
                showInfo('Registrando usuario...');
                try {
                    const response = await axios.post(API_REGISTER, { email, user: username, password });
                    const token = response.data.token;
                    if (token) {
                        set({ token, user: { username, email }, isAuthenticated: true });
                        showSuccess('Usuario registrado y sesión iniciada exitosamente');
                    } else {
                        showError('Respuesta inválida del servidor');
                    }
                } catch (err: any) {
                    showError(err.response?.data?.message || 'Error al registrar usuario');
                }
            },
            logout: () => {
                set({ token: null, user: null, isAuthenticated: false });
                showSuccess('Sesión cerrada exitosamente');
            },
        }),
        {
            name: 'auth-storage',
        }
    )
);

export default useAuthStore;