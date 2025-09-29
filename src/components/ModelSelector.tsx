"use client";
import React from 'react';
import useChatStore, { AiModel } from '../store/chatStore';

const ModelSelector: React.FC = () => {
    const { selectedModel, setSelectedModel, clearChat } = useChatStore();

    const handleModelChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newModel = event.target.value as AiModel;
        if (newModel !== selectedModel) {
            setSelectedModel(newModel);
            clearChat();
        }
    };

    return (
        <div className="form-control">
            <select
                className="select select-bordered select-sm"
                value={selectedModel}
                onChange={handleModelChange}
            >
                <option value="google">Google</option>
                <option value="openai">ChatGPT</option>
            </select>
        </div>
    );
};

export default ModelSelector;