"use client";
import { useEffect, useState, useRef } from "react";
import useChatStore from "../store";
import { GoogleGenAI, mcpToTool, Chat as GenAIChat } from "@google/genai";
import { GOOGLE_API_KEY } from "@/config";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const OBERON_HTTP_URL = "http://localhost:3001/mcp";
const OBERON_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI3Mjg0MTc1NS0zRjNELTQyNjYtQUI3QS1DRjBFMUQ3RUIyM0QiLCJjbGllbnRJZCI6IkZDOUNFQ0VGLTkzQjktRUYxMS04OEQwLTYwNDVCRDc5OTBFMSIsImlhdCI6MTc1NzY5MDU4OSwiZXhwIjoxNzU3Nzc2OTg5fQ.6hWNKh-gLCWwENOHpeDkgYhCFY4eTVoORbrMrUllkE";

export default function Chat() {
  const { messages, addMessage, updateLastMessage, chatSession, setChatSession } = useChatStore();
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Definimos client aquí para que sea accesible en la función de limpieza
    let client: Client;

    const initChat = async () => {
      console.log("Iniciando conexión del chat...");

      const transport = new StreamableHTTPClientTransport(new URL(OBERON_HTTP_URL), {
        requestInit: {
          headers: {
            'x-api-key': OBERON_API_KEY,
          }
        }
      });

      client = new Client({
        name: "example-client",
        version: "1.0.0"
      });

      try {
        await client.connect(transport);

        const ai = new GoogleGenAI({
          apiKey: GOOGLE_API_KEY
        });

        const chat = ai.chats.create({
          config: {
            tools: [
              mcpToTool(client)
            ]
          },
          model: "gemini-1.5-flash",
        });

        setChatSession(chat as GenAIChat);
        console.log("✅ Chat inicializado y listo. Session ID:", transport.sessionId);

      } catch (error) {
        console.error("❌ Falló la inicialización del chat:", error);
      }
    };

    initChat();

    // --- LA SOLUCIÓN DEFINITIVA ESTÁ AQUÍ ---
    // Esta función se ejecuta cuando el componente se desmonta (debido al Strict Mode).
    return () => {
      if (client) {
        console.log("🧹 Ejecutando limpieza de useEffect y cerrando conexión MCP...");
        client.close();
      }
    };

  }, [setChatSession]); // Dejamos setChatSession para seguir las buenas prácticas de React

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (inputValue.trim() && chatSession && !isStreaming) {
      const userMessage = { text: inputValue, sender: "user" };
      addMessage(userMessage);
      setInputValue("");
      setIsStreaming(true);

      addMessage({ text: "", sender: "model" });

      try {
        const stream = await chatSession.sendMessageStream({
          message: inputValue,
        });

        for await (const chunk of stream) {
          updateLastMessage(chunk.text);
        }
      } catch (error) {
        console.error("Error al enviar el mensaje:", error);
        updateLastMessage("Lo siento, ocurrió un error.");
      } finally {
        setIsStreaming(false);
      }
    }
  };

  return (
    <div className="flex flex-col h-screen bg-base-300 p-8 items-center gap-4">
      <div ref={chatContainerRef} className="flex-grow p-6 overflow-auto w-2/3 bg-base-200 rounded-2xl">
        <div className="chat-container">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`chat ${message.sender === "user" ? "chat-end" : "chat-start"}`}
            >
              <div className={`chat-bubble ${message.sender === "user" ? "chat-bubble-primary" : ""}`}>{message.text}</div>
            </div>
          ))}
          {!chatSession && <span className="loading loading-dots loading-lg"></span>}
        </div>
      </div>
      <div className="p-6 bg-base-200 w-2/3 rounded-2xl">
        <div className="flex gap-4">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder={!chatSession ? "Conectando..." : (isStreaming ? "Esperando respuesta..." : "Escribe tu mensaje...")}
            className="input input-bordered flex-grow"
            disabled={isStreaming || !chatSession}
          />
          <button
            onClick={handleSendMessage}
            className="btn btn-primary"
            disabled={isStreaming || !chatSession}
          >
            {isStreaming ? <span className="loading loading-spinner"></span> : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}