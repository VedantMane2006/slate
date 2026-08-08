import { CanvasViewport } from './canvas/CanvasViewport.tsx';

export function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <CanvasViewport />
    </div>
  );
}
