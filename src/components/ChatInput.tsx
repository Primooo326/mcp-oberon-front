import React, { useRef } from 'react';

interface ChatInputProps {
    inputValue: string;
    onInputChange: (value: string) => void;
    onSendMessage: () => void;
    isStreaming: boolean;
    chatSession: any;
    apiKey: string | null;
    isListening: boolean;
    onMicClick: () => void;
    hasVoiceRecognition: boolean;
}

export default function ChatInput({
    inputValue,
    onInputChange,
    onSendMessage,
    isStreaming,
    chatSession,
    apiKey,
    isListening,
    onMicClick,
    hasVoiceRecognition
}: ChatInputProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !isStreaming) {
            onSendMessage();
        }
    };

    return (
        <div className="p-4 bg-base-300 w-full max-w-4xl rounded-2xl">
            <div className="flex gap-2 sm:gap-4 items-center">
                <button
                    onClick={onMicClick}
                    className={`btn btn-ghost btn-circle ${isListening ? 'text-red-500 animate-pulse' : ''}`}
                    disabled={!hasVoiceRecognition}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                </button>
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => onInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isListening ? "Escuchando..." : "Escribe tu mensaje..."}
                    className="input input-bordered flex-grow"
                    disabled={isStreaming || !chatSession || !apiKey}
                />
                <button
                    onClick={onSendMessage}
                    className="btn btn-primary"
                    disabled={isStreaming || !chatSession || !inputValue.trim() || !apiKey}
                >
                    {isStreaming ? <span className="loading loading-spinner"></span> : "Send"}
                </button>
            </div>
        </div>
    );
}