import React, { useEffect } from 'react';
import { Emulator } from '../core/Emulator';
import jsnes from 'jsnes';

interface ControlsProps {
    emulator: Emulator;
}

// Helper to check if key is a direction key (to prevent scrolling/default)
const isDirectionKey = (code: string) => {
    return ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code);
};

// Custom constants for Turbo keys (not real NES buttons)
// const TURBO_A = 100;
// const TURBO_B = 101;

export const ControlsLogic: React.FC<ControlsProps> = ({ emulator }) => {
    const pressedKeys = React.useRef<Set<string>>(new Set());
    const requestRef = React.useRef<number | undefined>(undefined);
    const lastButtonState = React.useRef<{ [key: number]: boolean }>({});

    const updateButtonState = (button: number, isPressed: boolean) => {
        if (lastButtonState.current[button] !== isPressed) {
            if (isPressed) {
                emulator.buttonDown(1, button);
            } else {
                emulator.buttonUp(1, button);
            }
            lastButtonState.current[button] = isPressed;
        }
    };

    const loop = () => {
        // Turbo timing: ~15Hz (toggle every ~33ms). 
        // Using Date.now() for simplicity. 
        // 60FPS is ~16ms. Toggle every 2-3 frames.
        // Let's use a 50ms cycle for distinct presses (20Hz).
        const turboOn = (Date.now() / 50 | 0) % 2 === 0;

        const keys = pressedKeys.current;

        // Calculate state for A (K or Turbo I)
        // K = A
        // I = Turbo A
        const stateA = keys.has('KeyK') || (keys.has('KeyI') && turboOn);
        updateButtonState(jsnes.Controller.BUTTON_A, stateA);

        // Calculate state for B (J or Turbo U)
        // J = B
        // U = Turbo B
        const stateB = keys.has('KeyJ') || (keys.has('KeyU') && turboOn);
        updateButtonState(jsnes.Controller.BUTTON_B, stateB);

        requestRef.current = requestAnimationFrame(loop);
    };

    useEffect(() => {
        requestRef.current = requestAnimationFrame(loop);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isDirectionKey(e.code)) {
                e.preventDefault();
            }

            pressedKeys.current.add(e.code);

            const button = keyMap[e.code];
            if (button !== undefined) {
                if (!isDirectionKey(e.code)) {
                    e.preventDefault();
                }
                // For non-A/B keys, handle immediately
                if (button !== jsnes.Controller.BUTTON_A && button !== jsnes.Controller.BUTTON_B) {
                    emulator.buttonDown(1, button);
                }
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            pressedKeys.current.delete(e.code);

            const button = keyMap[e.code];
            if (button !== undefined) {
                // For non-A/B keys, handle immediately
                if (button !== jsnes.Controller.BUTTON_A && button !== jsnes.Controller.BUTTON_B) {
                    emulator.buttonUp(1, button);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [emulator]);

    return null;
};

const keyMap: { [key: string]: number } = {
    // WASD
    'KeyW': jsnes.Controller.BUTTON_UP,
    'KeyS': jsnes.Controller.BUTTON_DOWN,
    'KeyA': jsnes.Controller.BUTTON_LEFT,
    'KeyD': jsnes.Controller.BUTTON_RIGHT,

    // Keep Arrows just in case
    'ArrowUp': jsnes.Controller.BUTTON_UP,
    'ArrowDown': jsnes.Controller.BUTTON_DOWN,
    'ArrowLeft': jsnes.Controller.BUTTON_LEFT,
    'ArrowRight': jsnes.Controller.BUTTON_RIGHT,

    // Action Buttons (Handled in loop, but mapped here for preventDefault)
    'KeyK': jsnes.Controller.BUTTON_A, // K = A
    'KeyJ': jsnes.Controller.BUTTON_B, // J = B
    'KeyI': jsnes.Controller.BUTTON_A, // I = Turbo A
    'KeyU': jsnes.Controller.BUTTON_B, // U = Turbo B

    // System
    'ShiftLeft': jsnes.Controller.BUTTON_SELECT,
    'ShiftRight': jsnes.Controller.BUTTON_SELECT,
    'Enter': jsnes.Controller.BUTTON_START,
};
