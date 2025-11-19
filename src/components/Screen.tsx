import React, { useEffect, useRef } from 'react';
import { Emulator } from '../core/Emulator';

interface ScreenProps {
    emulator: Emulator;
}

export const Screen: React.FC<ScreenProps> = ({ emulator }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (canvasRef.current) {
            emulator.attachCanvas(canvasRef.current);
        }
    }, [emulator]);

    return (
        <div className="screen-container" style={{
            height: '80vh',
            aspectRatio: '4/3',
            backgroundColor: 'black',
            boxShadow: '0 0 20px rgba(0,0,0,0.5)',
            borderRadius: '4px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden'
        }}>
            <canvas
                ref={canvasRef}
                width={256}
                height={240}
                style={{
                    width: '100%',
                    height: '100%',
                    imageRendering: 'pixelated'
                }}
            />
        </div>
    );
};
