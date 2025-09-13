import { create } from 'zustand';
import { GoogleGenAI, ChatSession } from "@google/genai";

interface ChatState {
  messages: { text: string; sender: string }[];
  chatSession: ChatSession | null;
  addMessage: (message: { text: string; sender: string }) => void;
  updateLastMessage: (text: string) => void;
  setChatSession: (session: ChatSession) => void;
}

const useChatStore = create<ChatState>((set) => ({
  messages: [
    { text: "Hello! I am a friendly AI assistant. How can I help you today?", sender: "model" },
  ],
  chatSession: null,
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  updateLastMessage: (text) =>
    set((state) => {
      const newMessages = [...state.messages];
      const lastMessage = newMessages[newMessages.length - 1];
      if (lastMessage && lastMessage.sender === "model") {
        lastMessage.text += text;
      }
      return { messages: newMessages };
    }),
  setChatSession: (session) => set({ chatSession: session }),
}));

export default useChatStore;