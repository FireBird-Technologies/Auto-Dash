import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface D3ChartRendererProps {
  chartSpec: any;
  data: any[];
}

export const D3ChartRenderer: React.FC<D3ChartRendererProps> = ({ chartSpec, data }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !chartSpec || !data) return;

    // Clear previous chart
    d3.select(containerRef.current).selectAll('*').remove();

    // Execute the D3 code based on chart spec
    // The chart_creator will provide the spec with the necessary D3 code
    try {
      executeChartSpec(containerRef.current, chartSpec, data);
    } catch (error) {
      console.error('Error rendering chart:', error);
    }
  }, [chartSpec, data]);

  const executeChartSpec = (container: HTMLElement, spec: any, dataset: any[]) => {
    try {
      // The backend returns either a string (D3 code) or an object with chart_spec property
      const d3Code = typeof spec === 'string' ? spec : spec.chart_spec || spec.code;
      
      if (!d3Code) {
        console.error('No D3 code found in chart spec:', spec);
        container.innerHTML = '<p style="color: red;">No visualization code received</p>';
        return;
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
      
      const executeD3Code = new Function('d3', 'data', wrappedCode);
      
      // Execute the code with d3 and data in scope
      executeD3Code(d3, dataset);
      
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
      
    } catch (error: any) {
      console.error('Error executing D3 code:', error);
      container.innerHTML = `<p style="color: red; padding: 20px;">Error rendering visualization: ${error.message}</p>`;
    }
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

