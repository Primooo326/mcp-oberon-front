import { create } from 'zustand';
// CORRECCIÓN: El tipo correcto importado desde la librería es 'Chat'.
import { Chat } from "@google/genai";

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

// Interfaz que define el estado completo de nuestro store
interface ChatState {
  messages: Message[];
  // CORRECCIÓN: Usamos el tipo 'Chat' para la sesión.
  chatSession: Chat | null;
  addMessage: (message: Message) => void;
  updateLastMessage: (update: { newText?: string; toolUsage?: ToolUsage }) => void;
  // CORRECCIÓN: La función ahora espera un objeto de tipo 'Chat'.
  setChatSession: (session: Chat) => void;
}

const useChatStore = create<ChatState>((set) => ({
  messages: [
    { text: "¡Hola! Soy Luna, la IA experta del ecosistema Oberon 360. ¿Cómo puedo ayudarte hoy?", sender: "model" },
  ],
  chatSession: null,
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
  // CORRECCIÓN: El parámetro 'session' ahora es de tipo 'Chat'.
  setChatSession: (session) => set({ chatSession: session }),
}));

export default useChatStore;