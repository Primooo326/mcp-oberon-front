import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Message } from '../store/chatStore';

interface MessageBubbleProps {
    message: Message;
    isStreaming: boolean;
    isLastMessage: boolean;
}

export default function MessageBubble({ message, isStreaming, isLastMessage }: MessageBubbleProps) {
    const renderToolResponse = (toolUsage: any) => {
        if (!toolUsage?.response) return null;

        try {
            let parsedResponse = typeof toolUsage.response === 'string'
                ? JSON.parse(toolUsage.response)
                : toolUsage.response;

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

            // Handle URL in response text
            const responseText = typeof toolUsage.response === 'string' ? toolUsage.response : JSON.stringify(toolUsage.response);
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
                    {JSON.stringify(parsedResponse, null, 2)}
                </pre>
            );
        } catch (e) {
            const responseText = typeof toolUsage.response === 'string' ? toolUsage.response : JSON.stringify(toolUsage.response);
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
    };

    return (
        <div className={`chat ${message.sender === "user" ? "chat-sender" : "chat-receiver"}`}>
            <div className="chat-bubble">
                {message.sender === 'model' && message.toolUsage && (
                    <div className="badge badge-info gap-2 mb-2">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block w-4 h-4 stroke-current">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                        </svg>
                        Usando: {message.toolUsage.name}
                    </div>
                )}
                {message.sender === 'model' ? (
                    <>
                        {message.toolUsage?.response && (
                            <div className="tool-response mb-4 p-3 bg-base-200 rounded-lg">
                                {renderToolResponse(message.toolUsage)}
                            </div>
                        )}
                        {(message.text === '' && isStreaming && isLastMessage) ? (
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
    );
}