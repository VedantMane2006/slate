import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { App } from '../../src/App.tsx';

describe('App', () => {
  it('renders the canvas viewport', () => {
    const { container } = render(<App />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });
});
