import { useState, useCallback } from 'react';
import useChatStore, { Message } from '../store/chatStore';
import { GoogleGenAI, mcpToTool } from "@google/genai";
import OpenAI from "openai";
import { GOOGLE_API_KEY, SYSTEM_PROMPT_LUNA, OPENAI_API_KEY, MCP_SERVER_URL } from "@/config";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export default function useChat() {
    const { messages, addMessage, updateLastMessage, chatSession, setChatSession, selectedModel, clearChat } = useChatStore();
    const [isStreaming, setIsStreaming] = useState(false);
    const [client, setClient] = useState<Client | null>(null);

    const initChat = useCallback(async (key: string) => {
        console.log(`Iniciando conexión del chat para el modelo: ${selectedModel}...`);

        if (client) {
            client.close();
            setClient(null);
        }

        const transportOberon = new StreamableHTTPClientTransport(new URL(MCP_SERVER_URL), {
            requestInit: { headers: { 'x-api-key': key } }
        });
        const clientOberon = new Client({ name: "oberon-client", version: "1.0.0" });

        try {
            await clientOberon.connect(transportOberon);
            console.log("✅ Cliente MCP conectado.");
            setClient(clientOberon);

            const { tools: mcpTools }: any = await clientOberon.listTools();
            console.log("Herramientas MCP disponibles:", mcpTools);

            if (selectedModel === 'google') {
                const ai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });
                const chat = ai.chats.create({
                    config: { tools: [mcpToTool(clientOberon)], systemInstruction: { parts: [{ text: SYSTEM_PROMPT_LUNA }] } },
                    model: "gemini-2.5-flash-lite",
                });
                setChatSession(chat);
                console.log("✅ Chat de Google inicializado.");

            } else if (selectedModel === 'openai') {
                const openai = new OpenAI({ apiKey: OPENAI_API_KEY, dangerouslyAllowBrowser: true, });
                setChatSession(openai);
                console.log("✅ Cliente de OpenAI inicializado.");
            }

        } catch (error) {
            console.error("❌ Falló la inicialización del chat:", error);
            clientOberon.close();
            setClient(null);
            throw error;
        }
    }, [selectedModel, setChatSession, client]);

    const sendMessage = useCallback(async (inputValue: string) => {
        if (!inputValue || !chatSession || isStreaming) return;

        addMessage({ text: inputValue, sender: "user" });
        setIsStreaming(true);
        addMessage({ text: "", sender: "model" });

        try {
            if (selectedModel === 'google') {
                const stream = await (chatSession as any).sendMessageStream({
                    message: { role: "user", parts: [{ text: inputValue }] }
                });
                for await (const chunk of stream) {
                    const functionResponsePart = chunk.candidates?.[0]?.content?.parts?.find((part: any) => part.functionResponse);
                    if (functionResponsePart) {
                        updateLastMessage({
                            toolUsage: {
                                name: functionResponsePart.functionResponse.name,
                                response: functionResponsePart.functionResponse.response
                            }
                        });
                    } else if (chunk.text) {
                        updateLastMessage({ newText: chunk.text });
                    }
                }
            } else if (selectedModel === 'openai' && client) {
                const { tools: mcpTools } = await client.listTools();

                const mcpToolsForOpenAI = mcpTools.map((tool: any) => ({
                    type: 'function',
                    function: {
                        name: tool.name,
                        description: tool.description,
                        parameters: tool.parameters
                    }
                }));

                const openai = chatSession as OpenAI;
                const stream = await openai.chat.completions.create({
                    model: 'gpt-4o',
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT_LUNA },
                        ...messages.slice(1, -1).map(m => ({
                            role: m.sender === 'user' ? 'user' : 'assistant' as 'user' | 'assistant',
                            content: m.text
                        })),
                        { role: 'user', content: inputValue }
                    ],
                    tools: mcpToolsForOpenAI as any,
                    stream: true,
                });

                for await (const chunk of stream) {
                    const delta = chunk.choices[0]?.delta;

                    if (delta?.content) {
                        updateLastMessage({ newText: delta.content });
                    }

                    if (delta?.tool_calls) {
                        const toolCall = delta.tool_calls[0];
                        if (toolCall.function?.name) {
                            const toolName = toolCall.function.name;
                            const toolArgs = JSON.parse(toolCall.function.arguments || '{}');
                            console.log(`🛠️ Usando herramienta (OpenAI): ${toolName}`, toolArgs);
                            updateLastMessage({ toolUsage: { name: toolName, response: "Procesando..." } });

                            try {
                                const toolResult = await (client as any).call(toolName, toolArgs, {});
                                updateLastMessage({ toolUsage: { name: toolName, response: toolResult } });
                            } catch (e) {
                                console.error(`Error al ejecutar la herramienta ${toolName}:`, e);
                                updateLastMessage({ toolUsage: { name: toolName, response: "Error al ejecutar." } });
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Error al enviar el mensaje:", error);
            updateLastMessage({ newText: "Lo siento, ocurrió un error." });
        } finally {
            setIsStreaming(false);
        }
    }, [chatSession, isStreaming, addMessage, updateLastMessage, selectedModel, messages, client]);

    return {
        messages,
        isStreaming,
        chatSession,
        selectedModel,
        initChat,
        sendMessage,
        clearChat,
        client
    };
}