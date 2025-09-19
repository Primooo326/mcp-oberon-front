"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import useChatStore, { Message } from "../store";
import { GoogleGenAI, mcpToTool } from "@google/genai";
import { GOOGLE_API_KEY, MCP_SERVER_URL, SYSTEM_PROMPT_LUNA } from "@/config";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import LoginModal from "../components/LoginModal";
import useAuthStore from "../store/authStore";
import ReactMarkdown from 'react-markdown';

interface CustomSpeechRecognition extends SpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
}

// Define el tiempo de silencio en milisegundos
const SILENCE_DELAY = 1500; // 1.5 segundos

export default function ChatPage() {
  const { messages, addMessage, updateLastMessage, chatSession, setChatSession } = useChatStore();
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [showModal, setShowModal] = useState(false);
  const { token, isAuthenticated } = useAuthStore();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<CustomSpeechRecognition | null>(null);
  const clientRef = useRef<Client | null>(null);

  // Refs para manejar el temporizador y la función de envío
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const handleSendMessageRef = useRef<() => Promise<void>>(null);

  const initChat = async (key: string) => {
    console.log("Iniciando conexión del chat...");
    const transportOberon = new StreamableHTTPClientTransport(new URL(MCP_SERVER_URL), {
      requestInit: { headers: { 'x-api-key': key } }
    });
    const clientOberon = new Client({ name: "oberon-client", version: "1.0.0" });

    try {
      await clientOberon.connect(transportOberon);
      console.log("✅ Cliente conectado.");

      const { tools }: any = await clientOberon.listTools();
      console.log("Herramientas disponibles:", tools);

      const ai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });
      const chat = ai.chats.create({
        config: { tools: [mcpToTool(clientOberon)], systemInstruction: SYSTEM_PROMPT_LUNA },
        model: "gemini-2.5-flash-lite",
      });

      setChatSession(chat);
      console.log("✅ Chat inicializado y listo.");
      return clientOberon;
    } catch (error) {
      console.error("❌ Falló la inicialización del chat:", error);
      clientOberon.close();
      return null;
    }
  };

  const handleSendMessage = useCallback(async () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const currentInput = inputValue.trim();

    if (currentInput && chatSession && !isStreaming && apiKey) {
      const userMessage: Message = { text: currentInput, sender: "user" };
      addMessage(userMessage);
      setInputValue("");
      setIsStreaming(true);
      addMessage({ text: "", sender: "model" });

      try {
        const stream = await chatSession.sendMessageStream({ message: currentInput });
        for await (const chunk of stream) {
          const functionResponsePart: any = chunk.candidates?.[0]?.content?.parts?.find(part => part.functionResponse);
          if (functionResponsePart) {
            const toolName = functionResponsePart.functionResponse.name;
            const toolResponse = functionResponsePart.functionResponse.response;
            console.log(`🛠️ Usando herramienta: ${toolName}`, toolResponse);
            updateLastMessage({
              toolUsage: { name: toolName, response: toolResponse }
            });
          } else if (chunk.text) {
            updateLastMessage({ newText: chunk.text });
          }
        }
      } catch (error) {
        console.error("Error al enviar el mensaje:", error);
        updateLastMessage({ newText: "Lo siento, ocurrió un error." });
      } finally {
        setIsStreaming(false);
      }
    }
  }, [inputValue, chatSession, isStreaming, apiKey, addMessage, updateLastMessage, isListening]);

  useEffect(() => {
    handleSendMessageRef.current = handleSendMessage;
  }, [handleSendMessage]);

  useEffect(() => {
    const initialize = async () => {
      const storedKey = localStorage.getItem('x-api-key');
      if (storedKey) {
        setApiKey(storedKey);
        const client = await initChat(storedKey);
        if (client) {
          clientRef.current = client;
        }
      } else {
        setShowModal(true);
      }
    };
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (clientRef.current) {
        console.log("🧹 Cerrando conexión MCP...");
        clientRef.current.close();
        clientRef.current = null;
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated && token) {
      localStorage.setItem('x-api-key', token);
      setApiKey(token);
      setShowModal(false);
      const initializeClient = async () => {
        const client = await initChat(token);
        if (client) {
          clientRef.current = client;
        }
      };
      initializeClient();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, token]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

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
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setInputValue(currentVal => currentVal + finalTranscript.trim() + ' ');
          silenceTimerRef.current = setTimeout(() => {
            if (handleSendMessageRef.current) {
              handleSendMessageRef.current();
            }
          }, SILENCE_DELAY);
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
  }, []);

  const handleMicClick = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  return (
    <>
      <div className="flex flex-col h-screen bg-base-100 p-4 sm:p-8 items-center gap-4">
        <header className="w-full max-w-4xl text-center mb-2">
          <h1 className="text-3xl font-bold text-primary">Luna</h1>
        </header>

        <div ref={chatContainerRef} className="flex-grow p-6 overflow-auto w-full max-w-4xl bg-base-300 rounded-2xl">
          <div className="chat-container">
            {messages.map((message, index) => (
              <div key={index} className={`chat ${message.sender === "user" ? "chat-sender" : "chat-receiver"}`}>
                <div className="chat-bubble">
                  {message.sender === 'model' && message.toolUsage && (
                    <div className="badge badge-info gap-2 mb-2">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block w-4 h-4 stroke-current"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                      Usando: {message.toolUsage.name}
                    </div>
                  )}
                  {message.sender === 'model' ? (
                    <>
                      {message.toolUsage?.response && (
                        <div className="tool-response mb-4 p-3 bg-base-200 rounded-lg">
                          {(() => {
                            let parsedResponse;
                            try {
                              parsedResponse = typeof message.toolUsage.response === 'string'
                                ? JSON.parse(message.toolUsage.response)
                                : message.toolUsage.response;
                            } catch (e) {
                              const responseText = typeof message.toolUsage.response === 'string' ? message.toolUsage.response : JSON.stringify(message.toolUsage.response);
                              const urlMatch = responseText.match(/(?:https?:\/\/)?[^\s]+\.(xlsx|csv|pdf)$/i);
                              if (urlMatch) {
                                let url = urlMatch[0];
                                const filename = url.split('/').pop() || 'archivo.xlsx';
                                if (url.startsWith('/')) {
                                  url = `http://localhost:3001${url}`;
                                }
                                const textWithoutUrl = responseText.replace(urlMatch[0], '').trim();
                                return (
                                  <div className="bg-base-100 p-3 rounded">
                                    <div className="mb-2 text-sm prose prose-sm">
                                      {textWithoutUrl || 'Archivo listo para descargar.'}
                                    </div>
                                    <a
                                      href={url}
                                      download={filename}
                                      className="btn btn-secondary btn-sm"
                                      rel="noopener noreferrer"
                                    >
                                      📥 Descargar {filename.split('-')[0]?.split('.')[0] || 'Archivo'}
                                    </a>
                                  </div>
                                );
                              }
                              return (
                                <pre className="bg-base-100 p-2 rounded overflow-auto text-xs">
                                  {responseText}
                                </pre>
                              );
                            }

                            // Manejo de wrapper JSON con content.text
                            let listData = parsedResponse;
                            if (parsedResponse.content && parsedResponse.content[0] && parsedResponse.content[0].type === 'text') {
                              try {
                                listData = JSON.parse(parsedResponse.content[0].text);
                              } catch (innerE) {
                                // Fallback a parsedResponse
                              }
                            }

                            if (listData.type === 'list' && listData.data && listData.meta) {
                              return (
                                <>
                                  <div className="mb-3 text-sm font-semibold text-base-content/80">
                                    {listData.meta.funcionalidadName} - {listData.count} registros
                                  </div>

                                  <div className="w-full overflow-x-auto mb-4">
                                    <table className="table table-zebra w-full">
                                      <thead>
                                        <tr>
                                          {Object.entries(listData.meta.fieldsMap || {} as Record<string, string>).map(([key, label]: any) => (
                                            <th key={key} className="text-left">{label}</th>
                                          ))}
                                          <th>Estado</th>
                                          <th>Acciones</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(listData.data as any[]).slice(0, 10).map((item: any, idx: number) => (
                                          <tr key={idx}>
                                            {Object.entries(listData.meta.fieldsMap || {}).map(([key]) => (
                                              <td key={key} className="max-w-xs truncate">
                                                {item[key]?.label || item[key] || 'N/A'}
                                              </td>
                                            ))}
                                            <td>
                                              <span
                                                className={`badge text-xs ${item['0e0b1300hm']?.label === 'TERMINADO' ? 'badge-success' :
                                                  item['0e0b1300hm']?.label === 'PLANEADO' ? 'badge-warning' :
                                                    item['0e0b1300hm']?.label === 'EN EJECUCION' ? 'badge-info' : 'badge-neutral'
                                                  }`}
                                              >
                                                {item['0e0b1300hm']?.label || 'N/A'}
                                              </span>
                                            </td>
                                            <td>
                                              <div className="flex gap-1">
                                                <button className="btn btn-circle btn-ghost btn-sm" aria-label="Editar" disabled>
                                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                  </svg>
                                                </button>
                                                <button className="btn btn-circle btn-ghost btn-sm" aria-label="Eliminar" disabled>
                                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                  </svg>
                                                </button>
                                                <button className="btn btn-circle btn-ghost btn-sm" aria-label="Más opciones" disabled>
                                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                                  </svg>
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                        ))}
                                        {listData.data.length > 10 && (
                                          <tr>
                                            <td colSpan={Object.keys(listData.meta.fieldsMap || {}).length + 2} className="text-center text-sm italic">
                                              ... y {listData.data.length - 10} más registros. Descarga el Excel para ver todo.
                                            </td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>

                                  {listData.meta.excelUrl && (
                                    <div className="mt-4 flex justify-end">
                                      <a
                                        href={listData.meta.excelUrl}
                                        download={listData.meta.excelFilename}
                                        className="btn btn-secondary btn-sm"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        📥 Descargar Excel Completo ({listData.meta.funcionalidadName})
                                      </a>
                                    </div>
                                  )}
                                </>
                              );
                            }

                            return (
                              <pre className="bg-base-100 p-2 rounded overflow-auto text-xs">
                                {JSON.stringify(parsedResponse, null, 2)}
                              </pre>
                            );
                          })()}
                        </div>
                      )}
                      {(message.text === '' && isStreaming && index === messages.length - 1) ? (
                        <span className="loading loading-dots loading-md"></span>
                      ) : (
                        <div className="prose prose-sm max-w-none prose-invert">
                          <ReactMarkdown>
                            {message.text}
                          </ReactMarkdown>
                        </div>
                      )}
                    </>
                  ) : (
                    message.text
                  )}
                </div>
              </div>
            ))}
            {!chatSession && <span className="loading loading-dots loading-lg"></span>}
          </div>
        </div>

        <div className="p-4 bg-base-300 w-full max-w-4xl rounded-2xl">
          <div className="flex gap-2 sm:gap-4 items-center">
            <button
              onClick={handleMicClick}
              className={`btn btn-ghost btn-circle ${isListening ? 'text-red-500 animate-pulse' : ''}`}
              disabled={!recognitionRef.current}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isStreaming && handleSendMessage()}
              placeholder={isListening ? "Escuchando..." : "Escribe tu mensaje..."}
              className="input input-bordered flex-grow"
              disabled={isStreaming || !chatSession || !apiKey}
            />
            <button onClick={handleSendMessage} className="btn btn-primary" disabled={isStreaming || !chatSession || !inputValue.trim() || !apiKey}>
              {isStreaming ? <span className="loading loading-spinner"></span> : "Send"}
            </button>
          </div>
        </div>
      </div>
      <LoginModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}
