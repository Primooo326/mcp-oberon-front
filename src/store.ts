import { create } from 'zustand';
import { Chat as GoogleChat } from "@google/genai";
import OpenAI from "openai";

// Define los modelos de IA soportados
export type AiModel = 'google' | 'openai';

// Interfaz para la información de la herramienta utilizada en un mensaje
export interface ToolUsage {
  name: string;
  response: any;
}

// Interfaz que define la estructura de cada mensaje en el chat
export interface Message {
  text: string;
  sender: 'user' | 'model';
  toolUsage?: ToolUsage; // Propiedad opcional para la herramienta
}

// Define un tipo genérico para la sesión de chat que puede ser de Google o de OpenAI
export type ChatSession = GoogleChat | OpenAI | null;

// Interfaz que define el estado completo de nuestro store
interface ChatState {
  messages: Message[];
  chatSession: ChatSession;
  selectedModel: AiModel; // Estado para el modelo seleccionado
  addMessage: (message: Message) => void;
  updateLastMessage: (update: { newText?: string; toolUsage?: ToolUsage }) => void;
  setChatSession: (session: ChatSession) => void;
  setSelectedModel: (model: AiModel) => void; // Función para cambiar el modelo
  clearChat: () => void; // Función para limpiar el chat al cambiar de modelo
}

const useChatStore = create<ChatState>((set) => ({
  messages: [
    { text: "¡Hola! Soy Luna, la IA experta del ecosistema Oberon 360. ¿Cómo puedo ayudarte hoy?", sender: "model" },
  ],
  chatSession: null,
  selectedModel: 'google', // Modelo por defecto
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  updateLastMessage: (update) =>
    set((state) => {
      const newMessages = [...state.messages];
      const lastMessage = newMessages[newMessages.length - 1];

      if (lastMessage && lastMessage.sender === "model") {
        if (update.newText) {
          lastMessage.text += update.newText;
        }
        if (update.toolUsage) {
          lastMessage.toolUsage = update.toolUsage;
        }
      }
      return { messages: newMessages };
    }),

  setChatSession: (session) => set({ chatSession: session }),

  setSelectedModel: (model) => set({ selectedModel: model }),

  clearChat: () => set({
    messages: [
      { text: "¡Hola! Soy Luna, la IA experta del ecosistema Oberon 360. ¿Cómo puedo ayudarte hoy?", sender: "model" },
    ],
    chatSession: null
  })
}));

export default useChatStore;