import { CanvasViewport } from './canvas/CanvasViewport.tsx';
import { AILifecycleProvider } from './providers/AILifecycleProvider.tsx';

export function App() {
  return (
    <AILifecycleProvider>
      <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
        <CanvasViewport />
      </div>
    </AILifecycleProvider>
  );
}
