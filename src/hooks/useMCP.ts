import { useState, useRef, useCallback } from 'react';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { MCP_SERVER_URL } from '@/config';

export default function useMCP() {
    const [client, setClient] = useState<Client | null>(null);
    const clientRef = useRef<Client | null>(null);

    const connectMCP = useCallback(async (apiKey: string) => {
        console.log('Conectando a MCP...');

        if (clientRef.current) {
            clientRef.current.close();
            clientRef.current = null;
            setClient(null);
        }

        const transportOberon = new StreamableHTTPClientTransport(new URL(MCP_SERVER_URL), {
            requestInit: { headers: { 'x-api-key': apiKey } }
        });
        const clientOberon = new Client({ name: "oberon-client", version: "1.0.0" });

        try {
            await clientOberon.connect(transportOberon);
            console.log("✅ Cliente MCP conectado.");
            clientRef.current = clientOberon;
            setClient(clientOberon);

            const { tools: mcpTools }: any = await clientOberon.listTools();
            console.log("Herramientas MCP disponibles:", mcpTools);

            return clientOberon;
        } catch (error) {
            console.error("❌ Falló la conexión MCP:", error);
            clientOberon.close();
            clientRef.current = null;
            setClient(null);
            throw error;
        }
    }, []);

    const disconnectMCP = useCallback(() => {
        if (clientRef.current) {
            console.log("🧹 Cerrando conexión MCP...");
            clientRef.current.close();
            clientRef.current = null;
            setClient(null);
        }
    }, []);

    const getMCPTools = useCallback(async () => {
        if (!clientRef.current) {
            throw new Error('Cliente MCP no conectado');
        }

        const { tools } = await clientRef.current.listTools();
        return tools;
    }, []);

    const callMCPTool = useCallback(async (toolName: string, args: any) => {
        if (!clientRef.current) {
            throw new Error('Cliente MCP no conectado');
        }

        return await (clientRef.current as any).call(toolName, args, {});
    }, []);

    return {
        client,
        connectMCP,
        disconnectMCP,
        getMCPTools,
        callMCPTool
    };
}