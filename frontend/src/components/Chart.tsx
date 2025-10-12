import React, { useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';

type Row = Record<string, number | string>;

interface ChartProps {
  data: Row[];
  xKey?: string;
  yKey?: string;
  onLoading?: (loading: boolean) => void;
}

export const Chart: React.FC<ChartProps> = ({ data, xKey, yKey, onLoading }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const parsedData = useMemo(() => {
    if (!data.length || !xKey || !yKey) return [];
    
    return data
      .map(d => ({
        x: Number(d[xKey]),
        y: Number(d[yKey]),
        original: d
      }))
      .filter(d => Number.isFinite(d.x) && Number.isFinite(d.y));
  }, [data, xKey, yKey]);

  useEffect(() => {
    if (!svgRef.current) return;
    onLoading?.(true);

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = parseInt(svg.style('width')) || 800;
    const height = parseInt(svg.style('height')) || 400;
    const margin = { top: 20, right: 20, bottom: 40, left: 56 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    if (!parsedData.length) {
      g.append('text')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight / 2)
        .attr('text-anchor', 'middle')
        .style('fill', '#9ca3af')
        .text('Upload a dataset and choose columns to visualize');
      onLoading?.(false);
      return;
    }

    // Scales
    const x = d3.scaleLinear()
      .domain(d3.extent(parsedData, d => d.x) as [number, number])
      .nice()
      .range([0, innerWidth]);

    const y = d3.scaleLinear()
      .domain(d3.extent(parsedData, d => d.y) as [number, number])
      .nice()
      .range([innerHeight, 0]);

    // Axes
    const xAxis = d3.axisBottom(x).ticks(6);
    const yAxis = d3.axisLeft(y).ticks(6);

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .call(g => g.select('.domain').attr('stroke', '#e5e7eb'))
      .call(g => g.selectAll('.tick line').attr('stroke', '#e5e7eb'))
      .call(g => g.selectAll('.tick text').attr('fill', '#6b7280'));

    g.append('g')
      .call(yAxis)
      .call(g => g.select('.domain').attr('stroke', '#e5e7eb'))
      .call(g => g.selectAll('.tick line').attr('stroke', '#e5e7eb'))
      .call(g => g.selectAll('.tick text').attr('fill', '#6b7280'));

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .selectAll('line')
      .data(y.ticks())
      .join('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', d => y(d))
      .attr('y2', d => y(d))
      .attr('stroke', '#f3f4f6')
      .attr('stroke-width', 1);

    // Points
    const color = d3.color('#ff6b6b')!;
    const points = g
      .append('g')
      .selectAll('circle')
      .data(parsedData)
      .join('circle')
      .attr('cx', d => x(d.x))
      .attr('cy', d => y(d.y))
      .attr('r', 4)
      .attr('fill', color.formatHex())
      .attr('opacity', 0.7)
      .attr('stroke', color.brighter(0.5).formatHex())
      .attr('stroke-width', 1);

    // Hover effects
    const tooltip = d3.select('body')
      .append('div')
      .attr('class', 'chart-tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('background', 'white')
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('box-shadow', '0 2px 4px rgba(0,0,0,0.1)')
      .style('font-size', '12px')
      .style('pointer-events', 'none');

    points
      .on('mouseover', (event, d) => {
        d3.select(event.currentTarget)
          .attr('r', 6)
          .attr('opacity', 1);

        if (xKey && yKey) {
          tooltip
            .style('opacity', 1)
            .html(`${xKey}: ${d.original[xKey]}<br/>${yKey}: ${d.original[yKey]}`);
        }
      })
      .on('mousemove', (event) => {
        tooltip
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', (event) => {
        d3.select(event.currentTarget)
          .attr('r', 4)
          .attr('opacity', 0.7);

        tooltip.style('opacity', 0);
      });

    onLoading?.(false);

    return () => {
      tooltip.remove();
    };
  }, [parsedData, xKey, yKey, onLoading]);

  return (
    <div className="chart-section">
      <h3 className="section-title">Visualization</h3>
      <div className="chart-container">
        <svg ref={svgRef} width="100%" height="100%" />
      </div>
    </div>
  );
};
