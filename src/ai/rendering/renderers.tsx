import React from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * Render Markdown as sanitized HTML.
 * Converts markdown string to HTML and strips any malicious scripts/tags.
 */
export function renderMarkdown(text: string): React.ReactNode {
  // Convert markdown to HTML synchronously
  const rawHtml = marked.parse(text, { async: false }) as string;
  // Sanitize the generated HTML to prevent XSS from AI output
  const safeHtml = DOMPurify.sanitize(rawHtml);
  
  return <div dangerouslySetInnerHTML={{ __html: safeHtml }} />;
}

/**
 * Render LaTeX using KaTeX.
 * Returns a span with dangerouslySetInnerHTML containing the rendered math,
 * or an error message if parsing fails.
 */
export function renderLatex(latex: string): React.ReactNode {
  try {
    const html = katex.renderToString(latex, { throwOnError: true, output: 'html' });
    // KaTeX output is generally safe, but we can sanitize it if we want to be paranoid.
    // However, KaTeX is designed to be XSS-safe out of the box when used properly.
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  } catch (err: any) {
    return <span style={{ color: 'red' }}>LaTeX Error: {err.message}</span>;
  }
}

/**
 * Render a simple HTML table from a 2D string array.
 */
export function renderTable(rows: string[][]): React.ReactNode {
  if (!rows || rows.length === 0) return null;

  const [headerRow, ...bodyRows] = rows;

  return (
    <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '16px' }}>
      <thead>
        <tr>
          {headerRow.map((col, idx) => (
            <th key={idx} style={{ border: '1px solid #dee2e6', padding: '8px', background: '#f8f9fa' }}>
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {bodyRows.map((row, rowIdx) => (
          <tr key={rowIdx}>
            {row.map((col, colIdx) => (
              <td key={colIdx} style={{ border: '1px solid #dee2e6', padding: '8px' }}>
                {col}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Render a Graph using a minimal custom SVG renderer.
 * Choice Documented: We use a custom SVG instead of pulling in a heavyweight library
 * like Chart.js or Recharts to keep the bundle size and dependency footprint small.
 * This aligns with Phase 10 performance goals and the simple nature of AI chart outputs.
 */
export function renderGraph(spec: { type: 'bar' | 'line'; labels: string[]; values: number[] }): React.ReactNode {
  const { type, labels, values } = spec;
  if (!labels.length || labels.length !== values.length) return null;

  const width = 400;
  const height = 250;
  const padding = 40;

  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0); // Always start from at least 0
  const range = maxVal - minVal || 1;

  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const barWidth = chartWidth / values.length;

  const getX = (index: number) => padding + index * barWidth + barWidth / 2;
  const getY = (val: number) => height - padding - ((val - minVal) / range) * chartHeight;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ background: '#fff', border: '1px solid #e9ecef', borderRadius: '4px' }}>
      {/* Axes */}
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#ced4da" strokeWidth="2" />
      <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#ced4da" strokeWidth="2" />

      {/* Bars or Lines */}
      {type === 'bar' ? (
        values.map((val, i) => {
          const barHeight = ((val - minVal) / range) * chartHeight;
          return (
            <rect
              key={i}
              x={padding + i * barWidth + barWidth * 0.1}
              y={height - padding - barHeight}
              width={barWidth * 0.8}
              height={barHeight}
              fill="#0d6efd"
            />
          );
        })
      ) : (
        <polyline
          points={values.map((val, i) => `${getX(i)},${getY(val)}`).join(' ')}
          fill="none"
          stroke="#0d6efd"
          strokeWidth="3"
        />
      )}

      {/* Points for Line Chart */}
      {type === 'line' &&
        values.map((val, i) => (
          <circle key={i} cx={getX(i)} cy={getY(val)} r="4" fill="#0d6efd" />
        ))}

      {/* Labels */}
      {labels.map((label, i) => (
        <text
          key={i}
          x={getX(i)}
          y={height - padding + 15}
          fontSize="10"
          textAnchor="middle"
          fill="#495057"
        >
          {label}
        </text>
      ))}
    </svg>
  );
}
