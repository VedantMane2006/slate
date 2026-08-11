import { CanvasViewport } from './canvas/CanvasViewport.tsx';
import { AILifecycleProvider } from './providers/AILifecycleProvider.tsx';
import { MetricsProvider } from './providers/MetricsProvider.tsx';
import { MetricsPanel } from './components/MetricsPanel.tsx';

export function App() {
  return (
    <MetricsProvider>
      <AILifecycleProvider>
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
          <MetricsPanel />
          <CanvasViewport />
        </div>
      </AILifecycleProvider>
    </MetricsProvider>
  );
}
