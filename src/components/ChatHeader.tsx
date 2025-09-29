import React from 'react';
import ModelSelector from './ModelSelector';

export default function ChatHeader() {
    return (
        <header className="w-full max-w-4xl text-center mb-2">
            <div className="flex items-center justify-center gap-4">
                <h1 className="text-3xl font-bold text-primary">Luna</h1>
                <ModelSelector />
            </div>
        </header>
    );
}