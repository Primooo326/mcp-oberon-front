"use client";
import { useEffect, useState, useRef } from "react";
import useChatStore, { Message } from "../store";
import { GoogleGenAI, mcpToTool } from "@google/genai";
import { GOOGLE_API_KEY } from "@/config";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const OBERON_HTTP_URL = "http://localhost:3001/mcp";
const OBERON_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJERkYyN0Q1Ri03MkQwLTQxNzMtOUZDQS03MDhENjE4NUQ5MUIiLCJjbGllbnRJZCI6IkZDOUNFQ0VGLTkzQjktRUYxMS04OEQwLTYwNDVCRDc5OTBFMSIsImlhdCI6MTc1NzczMDU0NSwiZXhwIjoxNzU3ODE2OTQ1fQ.AoH_l-WWDbIgxE3lsTuOVTe4bXDxfUIS9w5q4W00pZM";

export default function ChatPage() {
  const { messages, addMessage, updateLastMessage, chatSession, setChatSession } = useChatStore();
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [availableTools, setAvailableTools] = useState<any[]>([]);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let client: Client;
    const initChat = async () => {
      console.log("Iniciando conexión del chat...");
      const transport = new StreamableHTTPClientTransport(new URL(OBERON_HTTP_URL), {
        requestInit: { headers: { 'x-api-key': OBERON_API_KEY } }
      });
      client = new Client({ name: "example-client", version: "1.0.0" });

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
      } catch (error) {
        console.error("❌ Falló la inicialización del chat:", error);
      }
    };

    initChat();
    return () => {
      if (client) {
        console.log("🧹 Cerrando conexión MCP...");
        client.close();
      }
    };
  }, [setChatSession]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (inputValue.trim() && chatSession && !isStreaming) {
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
          {/* <div className="dropdown dropdown-top">
            <button tabIndex={0} className="btn btn-square btn-ghost" disabled={!chatSession || availableTools.length === 0}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>
            </button>
            <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52 max-h-60 overflow-y-auto">
              {availableTools.map((tool) => (
                <li key={tool.name}>
                  <a onClick={() => setInputValue(prev => `${prev} ${tool.name}`.trim())}>
                    {tool.name}
                  </a>
                </li>
              ))}
            </ul>
          </div> */}
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder={!chatSession ? "Conectando..." : (isStreaming ? "Esperando respuesta..." : "Escribe tu mensaje...")}
            className="input input-bordered flex-grow"
            disabled={isStreaming || !chatSession}
          />
          <button onClick={handleSendMessage} className="btn btn-primary" disabled={isStreaming || !chatSession}>
            {isStreaming ? <span className="loading loading-spinner"></span> : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}