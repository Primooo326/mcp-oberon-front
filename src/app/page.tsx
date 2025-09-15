"use client";
import { useEffect, useState, useRef } from "react";
import useChatStore, { Message } from "../store";
import { GoogleGenAI, mcpToTool } from "@google/genai";
import { GOOGLE_API_KEY, MCP_SERVER_URL } from "@/config";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import LoginModal from "../components/LoginModal";
import useAuthStore from "../store/authStore";


export default function ChatPage() {
  const { messages, addMessage, updateLastMessage, chatSession, setChatSession } = useChatStore();
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [availableTools, setAvailableTools] = useState<any[]>([]);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [showModal, setShowModal] = useState(false);
  const { token, isAuthenticated } = useAuthStore();
  const [apiKey, setApiKey] = useState<string | null>(null);

  const clientRef = useRef<Client | null>(null);

  const initChat = async (key: string) => {
    console.log("Iniciando conexión del chat...");
    const transport = new StreamableHTTPClientTransport(new URL(MCP_SERVER_URL), {
      requestInit: { headers: { 'x-api-key': key } }
    });
    const client = new Client({ name: "example-client", version: "1.0.0" });

    try {
      await client.connect(transport);
      console.log("✅ Cliente conectado.");

      const { tools }: any = await client.listTools();
      console.log("Herramientas disponibles:", tools);
      setAvailableTools(tools);

      const ai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });
      const chat = ai.chats.create({
        config: { tools: [mcpToTool(client)] },
        model: "gemini-1.5-flash",
      });

      setChatSession(chat);
      console.log("✅ Chat inicializado y listo.");
      return client;
    } catch (error) {
      console.error("❌ Falló la inicialización del chat:", error);
      client.close();
      return null;
    }
  };

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
  }, []);

  useEffect(() => {
    return () => {
      if (clientRef.current) {
        console.log("🧹 Cerrando conexión MCP...");
        clientRef.current.close();
        clientRef.current = null;
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
  }, [isAuthenticated, token]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (inputValue.trim() && chatSession && !isStreaming && apiKey) {
      const userMessage: Message = { text: inputValue, sender: "user" };
      addMessage(userMessage);
      setInputValue("");
      setIsStreaming(true);

      addMessage({ text: "", sender: "model" });

      try {
        const stream = await chatSession.sendMessageStream({ message: inputValue });
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
  };


  return (
    <>
      <div className="flex flex-col h-screen bg-base-100 p-8 items-center gap-4">
        <div ref={chatContainerRef} className="flex-grow p-6 overflow-auto w-2/3 bg-base-300 rounded-2xl">
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
                  {message.text}
                </div>
              </div>
            ))}
            {!chatSession && <span className="loading loading-dots loading-lg"></span>}
          </div>
        </div>
        <div className="p-6 bg-base-300 w-2/3 rounded-2xl">
          <div className="flex gap-4 items-center">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder={!apiKey ? "Iniciando sesión..." : !chatSession ? "Conectando..." : (isStreaming ? "Esperando respuesta..." : "Escribe tu mensaje...")}
              className="input input-bordered flex-grow"
              disabled={isStreaming || !chatSession || !apiKey}
            />
            <button onClick={handleSendMessage} className="btn btn-primary" disabled={isStreaming || !chatSession || !apiKey}>
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