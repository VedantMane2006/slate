import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { renderMarkdown, renderLatex, renderTable, renderGraph } from '../../src/ai/rendering/renderers.tsx';
import React from 'react';

describe('Renderers', () => {
  describe('renderMarkdown', () => {
    it('correctly renders valid markdown to HTML', () => {
      const { container } = render(renderMarkdown('# Hello World') as React.ReactElement);
      expect(container.innerHTML).toContain('<h1');
      expect(container.innerHTML).toContain('Hello World</h1>');
    });

    it('sanitizes malicious input and removes scripts', () => {
      const malicious = 'Hello <script>alert("hacked")</script>';
      const { container } = render(renderMarkdown(malicious) as React.ReactElement);
      expect(container.innerHTML).not.toContain('<script>');
      expect(container.innerHTML).toContain('Hello');
    });
  });

  describe('renderLatex', () => {
    it('correctly renders latex string using KaTeX', () => {
      const { container } = render(renderLatex('E=mc^2') as React.ReactElement);
      // KaTeX produces complex HTML, but we can verify some standard katex class names
      expect(container.innerHTML).toContain('katex');
      expect(container.innerHTML).toContain('mc^2'); 
    });
  });

  describe('renderTable', () => {
    it('correctly renders an HTML table from a 2D array', () => {
      const rows = [
        ['Header1', 'Header2'],
        ['Val1', 'Val2']
      ];
      const { container } = render(renderTable(rows) as React.ReactElement);
      
      const table = container.querySelector('table');
      expect(table).not.toBeNull();
      
      const ths = container.querySelectorAll('th');
      expect(ths.length).toBe(2);
      expect(ths[0].textContent).toBe('Header1');
      
      const tds = container.querySelectorAll('td');
      expect(tds.length).toBe(2);
      expect(tds[1].textContent).toBe('Val2');
    });
  });

  describe('renderGraph', () => {
    it('correctly renders a bar chart SVG', () => {
      const spec = { type: 'bar' as const, labels: ['A', 'B'], values: [10, 20] };
      const { container } = render(renderGraph(spec) as React.ReactElement);
      
      const svg = container.querySelector('svg');
      expect(svg).not.toBeNull();
      
      const rects = container.querySelectorAll('rect');
      expect(rects.length).toBe(2); // Two bars
    });

    it('correctly renders a line chart SVG', () => {
      const spec = { type: 'line' as const, labels: ['X', 'Y'], values: [5, 15] };
      const { container } = render(renderGraph(spec) as React.ReactElement);
      
      const svg = container.querySelector('svg');
      expect(svg).not.toBeNull();
      
      const polyline = container.querySelector('polyline');
      expect(polyline).not.toBeNull();
    });
  });
});
