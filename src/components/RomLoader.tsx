import React, { useCallback } from 'react';

interface RomLoaderProps {
    onRomLoaded: (data: Uint8Array) => void;
    compact?: boolean;
}

export const RomLoader: React.FC<RomLoaderProps> = ({ onRomLoaded, compact = false }) => {
    const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const buffer = e.target?.result;
            if (buffer instanceof ArrayBuffer) {
                onRomLoaded(new Uint8Array(buffer));
            }
        };
        reader.readAsArrayBuffer(file);
    }, [onRomLoaded]);

    return (
        <div className="rom-loader" style={{ margin: '0', textAlign: 'center' }}>
            <label
                htmlFor="rom-upload"
                style={{
                    cursor: 'pointer',
                    padding: '10px 20px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    borderRadius: '5px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    display: 'inline-block'
                }}
            >
                {compact ? 'Load New ROM' : 'Load NES ROM'}
            </label>
            <input
                id="rom-upload"
                type="file"
                accept=".nes"
                onChange={handleFileChange}
                style={{ display: 'none' }}
            />
        </div>
    );
};
