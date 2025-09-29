"use client";
import { useEffect, useState, useRef } from "react";
import useChatStore from "../store/chatStore";
import LoginModal from "../components/LoginModal";
import useAuthStore from "../store/authStore";
import ChatHeader from "../components/ChatHeader";
import MessageBubble from "../components/MessageBubble";
import ChatInput from "../components/ChatInput";
import useVoiceRecognition from "../hooks/useVoiceRecognition";
import useChat from "../hooks/useChat";
import useMCP from "../hooks/useMCP";

export default function ChatPage() {
  const { messages } = useChatStore();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [showModal, setShowModal] = useState(false);
  const { token, isAuthenticated } = useAuthStore();
  const [apiKey, setApiKey] = useState<string | null>(null);

  const { initChat, sendMessage, isStreaming, chatSession } = useChat();
  const { isListening, inputValue, setInputValue, toggleListening, hasVoiceRecognition, clearInput } = useVoiceRecognition(sendMessage);
  const { connectMCP, disconnectMCP } = useMCP();


  // Efectos para inicialización y autenticación
  useEffect(() => {
    const initialize = async () => {
      const storedKey = localStorage.getItem('x-api-key');
      try {
        if (storedKey) {
          setApiKey(storedKey);
          await initChat(storedKey);
        } else {
          setShowModal(true);
        }
      } catch (error) {
      }
    };
    initialize();
  }, []);

  useEffect(() => {
    if (isAuthenticated && token) {
      localStorage.setItem('x-api-key', token);
      setApiKey(token);
      setShowModal(false);
      initChat(token);
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Cleanup
  useEffect(() => {
    return () => {
      disconnectMCP();
    };
  }, [disconnectMCP]);

  const handleSendMessage = () => {
    if (inputValue.trim()) {
      sendMessage(inputValue.trim());
      clearInput();
    }
  };

  return (
    <>
      <div className="flex flex-col h-screen bg-base-100 p-4 sm:p-8 items-center gap-4">
        <ChatHeader />

        <div ref={chatContainerRef} className="flex-grow p-6 overflow-auto w-full max-w-4xl bg-base-300 rounded-2xl">
          <div className="chat-container">
            {messages.map((message, index) => (
              <MessageBubble
                key={index}
                message={message}
                isStreaming={isStreaming}
                isLastMessage={index === messages.length - 1}
              />
            ))}
            {!chatSession && <span className="loading loading-dots loading-lg"></span>}
          </div>
        </div>

        <ChatInput
          inputValue={inputValue}
          onInputChange={setInputValue}
          onSendMessage={handleSendMessage}
          isStreaming={isStreaming}
          chatSession={chatSession}
          apiKey={apiKey}
          isListening={isListening}
          onMicClick={toggleListening}
          hasVoiceRecognition={hasVoiceRecognition}
        />
      </div>
      <LoginModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}
