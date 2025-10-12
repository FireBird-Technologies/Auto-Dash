import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { config, getAuthHeaders } from '../config';

interface D3ChartRendererProps {
  chartSpec: any;
  data: any[];
}

export const D3ChartRenderer: React.FC<D3ChartRendererProps> = ({ chartSpec, data }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [, setRenderError] = useState<string | null>(null);
  const [isFixing, setIsFixing] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !chartSpec || !data) return;

    // Clear previous chart and errors
    d3.select(containerRef.current).selectAll('*').remove();
    setRenderError(null);
    setIsFixing(false);

    try {
      executeChartSpec(containerRef.current, chartSpec, data);
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown rendering error';
      const codeSnippet = error.codeSnippet || '';
      const errorLine = error.errorLine || null;
      
      console.error('Error rendering chart:', error);
      console.error('Code snippet around error:', codeSnippet);
      setRenderError(errorMessage);
      
      // Show "taking longer than expected" message and attempt to fix
      showFixingMessage();
      attemptFix(errorMessage, chartSpec, codeSnippet, errorLine);
    }
  }, [chartSpec, data]);

  const showFixingMessage = () => {
    if (containerRef.current) {
      setIsFixing(true);
      console.log('Starting fix process, isFixing:', isFixing);
      containerRef.current.innerHTML = `
        <div style="padding: 40px; text-align: center; color: #1976d2; background: #e3f2fd; border-radius: 8px; margin: 20px;">
          <div style="display: inline-block; margin-bottom: 15px;">
            <div style="width: 20px; height: 20px; border: 2px solid #1976d2; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
          </div>
          <h3 style="margin: 0 0 10px 0; font-size: 18px;">🔧 Fixing visualization...</h3>
          <p style="margin: 0; font-size: 14px; color: #666;">Sorry for the wait, taking longer than expected</p>
          <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">Our AI is analyzing the error and generating a fix.</p>
        </div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      `;
    }
  };

  const attemptFix = async (
    errorMessage: string, 
    chartSpec: any, 
    codeSnippet?: string,
    errorLine?: number | null
  ) => {
    try {
      // Extract D3 code from chartSpec
      let d3Code = '';
      if (typeof chartSpec === 'string') {
        d3Code = chartSpec;
      } else if (chartSpec && typeof chartSpec === 'object') {
        d3Code = chartSpec.chart_spec || chartSpec.d3_code || JSON.stringify(chartSpec);
      }

      // Call fix-visualization endpoint with new format
      const response = await fetch(`${config.backendUrl}/api/data/fix-visualization`, {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        credentials: 'include',
        body: JSON.stringify({
          d3_code: d3Code,
          error_message: errorMessage
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setIsFixing(false);

      if (result.fix_failed) {
        // Show error message if fix failed
        showError(errorMessage, codeSnippet, errorLine);
      } else if (result.fixed_complete_code) {
        // Try to render the fixed code
        try {
          const executeD3Code = new Function('d3', 'data', result.fixed_complete_code);
          if (containerRef.current) {
            d3.select(containerRef.current).selectAll('*').remove();
            executeD3Code(d3, data);
            setRenderError(null);
            console.log('Successfully rendered fixed visualization');
          }
        } catch (fixError) {
          console.error('Fixed code still has errors:', fixError);
          showError(errorMessage, codeSnippet, errorLine);
        }
      }
    } catch (err) {
      console.error('Failed to fix visualization:', err);
      setIsFixing(false);
      showError(errorMessage, codeSnippet, errorLine);
    }
  };

  const showError = (errorMessage: string, codeSnippet?: string, errorLine?: number | null) => {
    if (containerRef.current) {
      const snippetHtml = codeSnippet ? `
        <details style="margin-top: 15px; text-align: left; max-width: 600px; margin-left: auto; margin-right: auto;">
          <summary style="cursor: pointer; font-size: 12px; color: #666;">Show error location</summary>
          <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 11px; margin-top: 10px; text-align: left;">${codeSnippet}</pre>
        </details>
      ` : '';
      
      containerRef.current.innerHTML = `
        <div style="padding: 40px; text-align: center; color: #d32f2f; background: #ffebee; border-radius: 8px; margin: 20px;">
          <h3 style="margin: 0 0 10px 0; font-size: 18px;">⚠️ Visualization Error</h3>
          <p style="margin: 0; font-size: 14px; color: #666;">${errorMessage}</p>
          ${errorLine ? `<p style="margin: 5px 0 0 0; font-size: 12px; color: #999;">Error at line ${errorLine}</p>` : ''}
          ${snippetHtml}
          <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">Try rephrasing your query or asking for a different type of visualization.</p>
        </div>
      `;
    }
  };

  const executeChartSpec = (container: HTMLElement, spec: any, dataset: any[]) => {
    // The backend returns either a string (D3 code) or an object with chart_spec property
    const d3Code = typeof spec === 'string' ? spec : spec.chart_spec || spec.code;
    
    if (!d3Code) {
      throw new Error('No D3 code found in chart specification');
    }

    // Set up the container with an ID that the D3 code expects
    container.id = 'visualization';
    
    // Add a wrapper div for better layout control
    const wrapper = document.createElement('div');
    wrapper.style.width = '100%';
    wrapper.style.height = '100%';
    wrapper.style.position = 'relative';
    wrapper.id = 'visualization-wrapper';
    container.appendChild(wrapper);
    
    // Create a function from the D3 code string and execute it
    // We need to make d3 available in the execution context
    // Also make sure the visualization selects the wrapper
    const wrappedCode = d3Code.replace(
      /d3\.select\(["']#visualization["']\)/g,
      'd3.select("#visualization-wrapper")'
    );
    
    // Add line numbers to code for better error tracking
    const codeLines = wrappedCode.split('\n');
    const numberedCode = codeLines.map((line: string, idx: number) => `/* L${idx + 1} */ ${line}`).join('\n');
    
    try {
      const executeD3Code = new Function('d3', 'data', numberedCode);
      
      // Execute the code with d3 and data in scope (this is where errors typically occur)
      executeD3Code(d3, dataset);
    } catch (execError: any) {
      // Extract line number from error if available
      const errorMessage = execError.message || String(execError);
      const lineMatch = errorMessage.match(/L(\d+)/);
      const errorLine = lineMatch ? parseInt(lineMatch[1]) : null;
      
      // Find the problematic code portion
      let codeSnippet = '';
      if (errorLine && errorLine > 0 && errorLine <= codeLines.length) {
        const start = Math.max(0, errorLine - 3);
        const end = Math.min(codeLines.length, errorLine + 2);
        codeSnippet = codeLines.slice(start, end).map((line: string, idx: number) => {
          const lineNum = start + idx + 1;
          const marker = lineNum === errorLine ? '>>> ' : '    ';
          return `${marker}${lineNum}: ${line}`;
        }).join('\n');
      }
      
      // Enhance error with code context
      const enhancedError = new Error(errorMessage);
      (enhancedError as any).codeSnippet = codeSnippet;
      (enhancedError as any).errorLine = errorLine;
      (enhancedError as any).fullCode = wrappedCode;
      
      throw enhancedError;
    }
    
    // Ensure all SVG elements have proper responsive attributes
    const svgs = container.querySelectorAll('svg');
    svgs.forEach((svg: SVGSVGElement) => {
      if (!svg.hasAttribute('viewBox')) {
        const width = svg.getAttribute('width') || '800';
        const height = svg.getAttribute('height') || '600';
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      }
      svg.style.maxWidth = '100%';
      svg.style.height = 'auto';
    });
  };

  return (
    <div 
      ref={containerRef}
      className="d3-chart-container"
      style={{
        width: '100%',
        height: '100%',
        minHeight: '600px',
        position: 'relative',
        overflow: 'visible'
      }}
    />
  );
};
