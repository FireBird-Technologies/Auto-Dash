import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { config, getAuthHeaders } from '../config';

interface D3ChartRendererProps {
  chartSpec: any;
  data: any[];
  chartIndex?: number; // Index of this chart in the array
  onChartFixed?: (chartIndex: number, fixedCode: string) => void; // Callback when chart is fixed
}

export const D3ChartRenderer: React.FC<D3ChartRendererProps> = ({ 
  chartSpec, 
  data, 
  chartIndex = 0,
  onChartFixed
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [, setRenderError] = useState<string | null>(null);
  const [isFixing, setIsFixing] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !chartSpec || !data) return;

    // Always clear the container first to prevent duplicates
    containerRef.current.innerHTML = '';
    
    setRenderError(null);
    setIsFixing(false);

    // Debug: Log data sample
    console.log(`Chart ${chartIndex} - Data sample:`, data.slice(0, 3));
    console.log(`Chart ${chartIndex} - Data length:`, data.length);

    // Create a new container div for this chart
    const chartContainer = document.createElement('div');
    chartContainer.className = 'chart-item';
    chartContainer.style.marginBottom = '20px';
    containerRef.current.appendChild(chartContainer);

    try {
      executeChartSpec(chartContainer, chartSpec, data);
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown rendering error';
      const codeSnippet = error.codeSnippet || '';
      const errorLine = error.errorLine || null;
      
      console.error(`Chart ${chartIndex} - Error rendering:`, error);
      console.error('Code snippet around error:', codeSnippet);
      setRenderError(errorMessage);
      
      // Show "taking longer than expected" message immediately and attempt to fix
      showFixingMessage();
      attemptFix(errorMessage, chartSpec, codeSnippet, errorLine);
    }
  }, [chartSpec, data, chartIndex]);

  const showFixingMessage = () => {
      if (containerRef.current) {
      setIsFixing(true);
      console.log('Starting fix process, isFixing:', isFixing);
        containerRef.current.innerHTML = `
        <div style="padding: 40px; text-align: center; color: #1976d2; background: #e3f2fd; border-radius: 8px; margin: 20px;">
          <div style="display: inline-block; margin-bottom: 15px;">
            <div style="width: 24px; height: 24px; border: 3px solid #1976d2; border-top: 3px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
          </div>
          <h3 style="margin: 0 0 10px 0; font-size: 18px; color: #1976d2;">🔧 Fixing visualization...</h3>
          <p style="margin: 0; font-size: 14px; color: #666; font-weight: 500;">Sorry for the wait, taking longer than expected</p>
          <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">Our AI is analyzing the error and generating a fix. This may take a few moments...</p>
          <div style="margin-top: 15px; font-size: 11px; color: #888;">
            <span id="fix-status">Analyzing error...</span>
          </div>
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

      // Ensure fixing message is shown before making the request
      showFixingMessage();
      
      // Update status to show request is being sent
      setTimeout(() => {
        const statusEl1 = document.getElementById('fix-status');
        if (statusEl1) statusEl1.textContent = 'Sending request to AI...';
      }, 500);

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
      
      // Update status to show AI is processing
      const statusEl2 = document.getElementById('fix-status');
      if (statusEl2) statusEl2.textContent = 'AI is generating fix...';

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // Update status to show processing is complete
      const statusEl3 = document.getElementById('fix-status');
      if (statusEl3) statusEl3.textContent = 'Processing response...';
      
      setIsFixing(false);

      if (result.fix_failed) {
        // Show error message if fix failed
        showError(errorMessage, codeSnippet, errorLine);
      } else if (result.fixed_complete_code) {
        // Try to render the fixed code
        try {
          let fixedCode = result.fixed_complete_code;
          
          // Strip markdown formatting if present
          if (fixedCode.includes('```javascript')) {
            fixedCode = fixedCode.replace(/```javascript\n?/g, '').replace(/```\n?/g, '').trim();
          } else if (fixedCode.includes('```js')) {
            fixedCode = fixedCode.replace(/```js\n?/g, '').replace(/```\n?/g, '').trim();
          } else if (fixedCode.includes('```')) {
            fixedCode = fixedCode.replace(/```\n?/g, '').trim();
          }
          
          const executeD3Code = new Function('d3', 'data', fixedCode);
          if (containerRef.current) {
            d3.select(containerRef.current).selectAll('*').remove();
            executeD3Code(d3, data);
            setRenderError(null);
            console.log(`Chart ${chartIndex}: Successfully rendered fixed visualization`);
            
            // Notify parent component that this chart was fixed
            if (onChartFixed) {
              onChartFixed(chartIndex, fixedCode);
            }
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

  const removeDataLoadingCode = (code: string): string => {
    /**
     * Neutralizes any data loading code (d3.csv, d3.json, fetch, etc.)
     * Replaces with comments to ensure code uses the provided 'data' parameter
     */
    let cleanedCode = code;
    
    // Pattern 1: d3.csv/json/tsv/xml with .then() callback
    const dataLoadingPatterns = [
      /d3\.(csv|json|tsv|xml|dsv)\s*\([^)]*\)\s*\.then\s*\([^)]*\)\s*=>\s*\{/g,
      /d3\.(csv|json|tsv|xml|dsv)\s*\([^)]*\)\s*\.then\s*\(\s*function\s*\([^)]*\)\s*\{/g,
    ];
    
    for (const pattern of dataLoadingPatterns) {
      if (pattern.test(cleanedCode)) {
        console.warn('⚠️ Detected data loading code - removing entire then/catch block');
        // Remove entire then/catch block content following the match
        cleanedCode = cleanedCode.replace(
          new RegExp(`${pattern.source}[\\s\\S]*?\\}\n?\\)\\s*(?:\\.catch\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\}\\s*\\)\\s*)?;?`, 'g'),
          '// DATA LOADING REMOVED — using provided "data" parameter\n'
        );
      }
    }
    
    // Pattern 2: Standalone d3.csv/json/tsv/xml calls
    cleanedCode = cleanedCode.replace(
      /d3\.(csv|json|tsv|xml|dsv)\s*\([^)]*\)/g,
      (match) => {
        console.warn('⚠️ Commenting out data loading:', match);
        return `// ${match} // Using provided 'data' parameter instead`;
      }
    );
    
    // Pattern 3: fetch() API calls
    cleanedCode = cleanedCode.replace(
      /fetch\s*\([^)]*\)\s*\.then[\s\S]*?\{[\s\S]*?\}[\s\S]*?(?:;|$)/g,
      (match) => {
        console.warn('⚠️ Removing fetch chain:', match.slice(0, 60));
        return `// FETCH REMOVED — Using provided 'data' parameter instead`;
      }
    );
    
    // Pattern 4: d3.text, d3.blob, d3.buffer (other D3 data loaders)
    cleanedCode = cleanedCode.replace(
      /d3\.(text|blob|buffer|image)\s*\([^)]*\)/g,
      (match) => {
        console.warn('⚠️ Commenting out D3 data loader:', match);
        return `// ${match} // Using provided 'data' parameter instead`;
      }
    );
    
    // Add a helpful comment at the top if we found data loading
    if (cleanedCode !== code) {
      cleanedCode = `// NOTE: Data loading code has been commented out.\n// The 'data' parameter contains your dataset and is ready to use.\n\n${cleanedCode}`;
    }
    
    return cleanedCode;
  };

  // Strip line markers like "Line 7:" and balance brackets/parens
  const sanitizeD3Code = (code: string): string => {
    let c = code;
    // Remove standalone line markers
    c = c.replace(/^\s*Line\s+\d+\s*:\s*$/gm, '');
    c = c.replace(/\n\s*Line\s+\d+\s*:\s*\n/g, '\n');
    // Balance braces/parens/brackets
    const count = (s: string, ch: string) => (s.match(new RegExp(`\\${ch}`, 'g')) || []).length;
    const ob = count(c, '{'), cb = count(c, '}');
    const op = count(c, '('), cp = count(c, ')');
    const os = count(c, '['), cs = count(c, ']');
    let out = c;
    // Trim extra closers from end if any
    const trimTail = (text: string, ch: string, excess: number) => {
      if (excess <= 0) return text;
      let i = text.length - 1, removed = 0, acc = '';
      while (i >= 0) {
        const chNow = text[i];
        if (chNow === ch && removed < excess) { removed++; i--; continue; }
        acc = chNow + acc; i--;
      }
      return acc;
    };
    if (cb > ob) out = trimTail(out, '}', cb - ob);
    if (cp > op) out = trimTail(out, ')', cp - op);
    if (cs > os) out = trimTail(out, ']', cs - os);
    // Append missing closers
    const ob2 = count(out, '{'), cb2 = count(out, '}');
    const op2 = count(out, '('), cp2 = count(out, ')');
    const os2 = count(out, '['), cs2 = count(out, ']');
    if (ob2 > cb2) out += '}'.repeat(ob2 - cb2);
    if (op2 > cp2) out += ')'.repeat(op2 - cp2);
    if (os2 > cs2) out += ']'.repeat(os2 - cs2);
    return out;
  };

  const fixIncompleteD3Code = (code: string): string => {
    /**
     * Fixes incomplete D3 code by:
     * 1. Commenting out the last incomplete line
     * 2. Adding necessary closing brackets/parentheses
     */
    let fixedCode = code;
    
    try {
      // Check if code is syntactically complete by trying to parse it
      new Function(fixedCode);
      return fixedCode; // Code is complete, return as-is
    } catch (error) {
      console.log('D3 code appears incomplete, attempting to fix...');
      
      // Split into lines
      const lines = fixedCode.split('\n');
      const lastLineIndex = lines.length - 1;
      const lastLine = lines[lastLineIndex].trim();
      
      // If last line is not empty and doesn't end with proper punctuation
      if (lastLine && !lastLine.match(/[;})\]]$/)) {
        console.log(`Commenting out incomplete last line: "${lastLine}"`);
        // Comment out the last line
        lines[lastLineIndex] = `// ${lastLine}`;
      }
      
      fixedCode = lines.join('\n');
      
      // Count open brackets and add closing ones
      const openBraces = (fixedCode.match(/\{/g) || []).length;
      const closeBraces = (fixedCode.match(/\}/g) || []).length;
      const openParens = (fixedCode.match(/\(/g) || []).length;
      const closeParens = (fixedCode.match(/\)/g) || []).length;
      const openBrackets = (fixedCode.match(/\[/g) || []).length;
      const closeBrackets = (fixedCode.match(/\]/g) || []).length;
      
      // Add missing closing brackets
      const missingBraces = openBraces - closeBraces;
      const missingParens = openParens - closeParens;
      const missingBrackets = openBrackets - closeBrackets;
      
      if (missingBraces > 0 || missingParens > 0 || missingBrackets > 0) {
        console.log(`Adding missing brackets: {${missingBraces}} (${missingParens}) [${missingBrackets}]`);
        
        // Add closing brackets at the end
        fixedCode += '\n' + '}'.repeat(missingBraces) + ')'.repeat(missingParens) + ']'.repeat(missingBrackets);
      }
      
      // Verify the fix worked
      try {
        new Function(fixedCode);
        console.log('D3 code successfully fixed');
        return fixedCode;
      } catch (fixError) {
        console.warn('Could not fully fix D3 code, using original:', fixError);
        return code; // Return original if fix failed
      }
    }
  };

  const executeChartSpec = (container: HTMLElement, spec: any, dataset: any[]) => {
    // The backend returns either a string (D3 code) or an object with chart_spec property
    let d3Code = typeof spec === 'string' ? spec : spec.chart_spec || spec.code;
    
    if (!d3Code) {
      throw new Error('No D3 code found in chart specification');
    }

    // Step 1: Remove any data loading code (d3.csv, fetch, etc.) and sanitize
    d3Code = sanitizeD3Code(removeDataLoadingCode(d3Code));

    // Step 2: Fix incomplete D3 code if needed
    d3Code = fixIncompleteD3Code(d3Code);

    // Use unique IDs per chart to avoid conflicts
    const uniqueId = `visualization-${chartIndex}`;
    const wrapperId = `visualization-wrapper-${chartIndex}`;
    
    // Set up the container with a unique ID
    container.id = uniqueId;
    
    // Add a wrapper div for better layout control
    const wrapper = document.createElement('div');
    wrapper.style.width = '100%';
    wrapper.style.height = '100%';
    wrapper.style.position = 'relative';
    wrapper.id = wrapperId;
    container.appendChild(wrapper);
    
    // Replace all #visualization references with the unique wrapper ID
    let wrappedCode = d3Code.replace(
      /d3\.select\(["']#visualization["']\)/g,
      `d3.select("#${wrapperId}")`
    );
    
    // Also replace string references to #visualization in tooltip/element creation
    wrappedCode = wrappedCode.replace(
      /"#visualization"/g,
      `"#${wrapperId}"`
    );
    wrappedCode = wrappedCode.replace(
      /'#visualization'/g,
      `'#${wrapperId}'`
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
