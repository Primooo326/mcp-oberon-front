import { useState, useEffect, useRef, useCallback } from 'react';

interface CustomSpeechRecognition extends SpeechRecognition {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
}

const SILENCE_DELAY = 1500; // 1.5 segundos
const VOICE_COMMANDS = ['okey luna', 'hey luna', 'luna'];

export default function useVoiceRecognition(onSendMessage: (inputValue: string) => void) {
    const [isListening, setIsListening] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const recognitionRef = useRef<CustomSpeechRecognition | null>(null);
    const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

    const handleSendMessageRef = useRef<(inputValue: string) => Promise<void>>(null);

    useEffect(() => {
        handleSendMessageRef.current = onSendMessage as any;
    }, [onSendMessage]);

    const processTranscript = useCallback((transcript: string) => {
        const lowerTranscript = transcript.toLowerCase().trim();

        // Check for voice commands to activate microphone
        const isVoiceCommand = VOICE_COMMANDS.some(command =>
            lowerTranscript.includes(command)
        );

        if (isVoiceCommand) {
            console.log('🎤 Comando de voz detectado:', transcript);
            if (!isListening && recognitionRef.current) {
                recognitionRef.current.start();
                return;
            }
        }

        // Add transcript to input value
        setInputValue(currentVal => currentVal + transcript.trim() + ' ');

        // Set timer to send message after silence
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
        }

        silenceTimerRef.current = setTimeout(() => {
            if (handleSendMessageRef.current) {
                handleSendMessageRef.current(inputValue + transcript.trim());
            }
        }, SILENCE_DELAY);
    }, [isListening]);

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition() as CustomSpeechRecognition;
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'es-CO';

            recognition.onstart = () => setIsListening(true);
            recognition.onend = () => setIsListening(false);

            recognition.onresult = (event) => {
                if (silenceTimerRef.current) {
                    clearTimeout(silenceTimerRef.current);
                }

                let finalTranscript = '';
                let interimTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }

                if (finalTranscript) {
                    processTranscript(finalTranscript);
                }
            };

            recognition.onerror = (event) => {
                console.error("Error en el reconocimiento de voz:", event.error);
                setIsListening(false);
            };

            recognitionRef.current = recognition;
        } else {
            console.warn("La API de Reconocimiento de Voz no es compatible con este navegador.");
        }

        return () => {
            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
            }
        };
    }, [processTranscript]);

    const toggleListening = useCallback(() => {
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
        }
        if (!recognitionRef.current) return;

        if (isListening) {
            console.log("STOP");
            recognitionRef.current.stop();
        } else {
            console.log("START");
            recognitionRef.current.start();
        }
    }, [isListening]);

    const clearInput = useCallback(() => {
        setInputValue('');
    }, []);

    return {
        isListening,
        inputValue,
        setInputValue,
        toggleListening,
        hasVoiceRecognition: !!recognitionRef.current,
        clearInput
    };
}