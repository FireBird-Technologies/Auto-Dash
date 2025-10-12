import { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';

// Bar chart data - Tech Startup Valuations
const barChartData = [
  { name: 'NeuralTech AI', value: 2850, category: 'AI/ML', growth: 245, employees: 450 },
  { name: 'QuantumScale', value: 1920, category: 'Cloud', growth: 189, employees: 380 },
  { name: 'CyberShield Pro', value: 1650, category: 'Security', growth: 167, employees: 290 },
  { name: 'DataFlow Systems', value: 1480, category: 'Analytics', growth: 145, employees: 320 },
  { name: 'BlockChain Labs', value: 1320, category: 'Crypto', growth: 198, employees: 210 },
  { name: 'EdgeCompute Inc', value: 1180, category: 'Cloud', growth: 134, employees: 260 },
  { name: 'SmartVision AI', value: 1050, category: 'AI/ML', growth: 156, employees: 195 },
  { name: 'SecureNet', value: 920, category: 'Security', growth: 112, employees: 180 },
  { name: 'DataMesh', value: 850, category: 'Analytics', growth: 98, employees: 150 },
  { name: 'CloudNative', value: 780, category: 'Cloud', growth: 87, employees: 140 },
  { name: 'AI Dynamics', value: 720, category: 'AI/ML', growth: 105, employees: 125 },
  { name: 'CryptoVault', value: 650, category: 'Crypto', growth: 142, employees: 110 },
  { name: 'Analytics Pro', value: 590, category: 'Analytics', growth: 76, employees: 95 },
  { name: 'SecurityFirst', value: 530, category: 'Security', growth: 68, employees: 85 },
  { name: 'DeepLearn AI', value: 480, category: 'AI/ML', growth: 92, employees: 75 }
];

// Scatter plot data - GDP per Country
const scatterData = [
  { country: 'USA', gdp: 68309, energy: 6895, population: 331 },
  { country: 'China', gdp: 12720, energy: 2237, population: 1425 },
  { country: 'Japan', gdp: 33950, energy: 3310, population: 125 },
  { country: 'Germany', gdp: 48756, energy: 3752, population: 83 },
  { country: 'UK', gdp: 46371, energy: 2705, population: 67 },
  { country: 'India', gdp: 2389, energy: 637, population: 1417 },
  { country: 'France', gdp: 42330, energy: 3525, population: 67 },
  { country: 'Italy', gdp: 35551, energy: 2598, population: 59 },
  { country: 'Canada', gdp: 52051, energy: 7333, population: 38 },
  { country: 'South Korea', gdp: 34758, energy: 5851, population: 52 },
  { country: 'Spain', gdp: 30116, energy: 2686, population: 47 },
  { country: 'Australia', gdp: 64491, energy: 5450, population: 26 },
  { country: 'Netherlands', gdp: 57534, energy: 4375, population: 17 },
  { country: 'Switzerland', gdp: 91992, energy: 2923, population: 9 },
  { country: 'Sweden', gdp: 60239, energy: 5129, population: 10 },
];

// Time series data - Stock Market Performance
const timeSeriesData = [
  { month: 'Jan', price: 412.5, volume: 85.2, volatility: 18.5 },
  { month: 'Feb', price: 398.2, volume: 92.1, volatility: 22.3 },
  { month: 'Mar', price: 385.7, volume: 98.5, volatility: 25.8 },
  { month: 'Apr', price: 408.3, volume: 88.7, volatility: 20.1 },
  { month: 'May', price: 432.8, volume: 82.3, volatility: 16.4 },
  { month: 'Jun', price: 456.1, volume: 79.6, volatility: 14.2 },
  { month: 'Jul', price: 478.9, volume: 86.4, volatility: 15.7 },
  { month: 'Aug', price: 462.3, volume: 94.8, volatility: 19.3 },
  { month: 'Sep', price: 485.6, volume: 81.5, volatility: 13.8 },
  { month: 'Oct', price: 512.4, volume: 77.2, volatility: 12.4 },
  { month: 'Nov', price: 538.7, volume: 83.9, volatility: 14.6 },
  { month: 'Dec', price: 565.2, volume: 89.3, volatility: 16.2 },
];

type ChartType = 'bar' | 'scatter' | 'timeseries';

export const DemoVisualization: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ChartType>('bar');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    d3.select(containerRef.current).selectAll('*').remove();

    if (activeTab === 'bar') {
      renderBarChart();
    } else if (activeTab === 'scatter') {
      renderScatterPlot();
    } else {
      renderTimeSeries();
    }
  }, [activeTab]);

  const renderBarChart = () => {
    if (!containerRef.current) return;

    const container = d3.select(containerRef.current);
    const width = 900;
    const height = 500;
    const margin = { top: 60, right: 140, bottom: 80, left: 80 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    let displayCount = 10;
    let sortedData = [...barChartData].sort((a, b) => b.value - a.value);

    const svg = container.append('svg')
      .attr('width', '100%')
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('max-width', '900px')
      .style('margin', '0 auto')
      .style('display', 'block');

    // Title
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 30)
      .attr('text-anchor', 'middle')
      .attr('font-size', '22px')
      .attr('font-weight', 'bold')
      .attr('fill', '#ff6b6b')
      .text('Tech Startup Valuations 2024');

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Scales
    const xScale = d3.scaleBand()
      .range([0, innerWidth])
      .padding(0.15);

    const yScale = d3.scaleLinear()
      .range([innerHeight, 0]);

    // Axes
    const xAxis = d3.axisBottom(xScale);
    const xAxisGroup = g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0, ${innerHeight})`);

    const yAxis = d3.axisLeft(yScale)
      .ticks(8)
      .tickFormat(d => `$${d}M`);
    
    const yAxisGroup = g.append('g')
      .attr('class', 'y-axis');

    // Y-axis label
    g.append('text')
      .attr('x', -innerHeight / 2)
      .attr('y', -60)
      .attr('font-size', '13px')
      .attr('text-anchor', 'middle')
      .attr('transform', 'rotate(-90)')
      .attr('fill', '#1a1a1a')
      .attr('font-weight', '600')
      .text('Valuation ($ Millions)');

    // Tooltip
    const tooltip = container.append('div')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background', 'white')
      .style('color', '#1a1a1a')
      .style('border', '2px solid #ff6b6b')
      .style('border-radius', '8px')
      .style('padding', '12px 16px')
      .style('box-shadow', '0 4px 16px rgba(0, 0, 0, 0.15)')
      .style('font-size', '13px')
      .style('z-index', '1000')
      .style('pointer-events', 'none');

    function updateChart() {
      const displayData = sortedData.slice(0, displayCount);

      xScale.domain(displayData.map(d => d.name));
      yScale.domain([0, d3.max(displayData, d => d.value)! * 1.15]);

      // Update axes
      xAxisGroup
        .transition()
        .duration(500)
        .call(xAxis)
        .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .attr('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('font-size', '11px')
        .attr('fill', '#1a1a1a');

      yAxisGroup
        .transition()
        .duration(500)
        .call(yAxis)
        .selectAll('text')
        .attr('fill', '#1a1a1a');

      // Style axis lines
      g.selectAll('.domain').attr('stroke', '#ccc');
      g.selectAll('.tick line').attr('stroke', '#eee');

      // Bars
      const bars = g.selectAll('.bar')
        .data(displayData, (d: any) => d.name);

      bars.exit()
        .transition()
        .duration(300)
        .attr('height', 0)
        .attr('y', innerHeight)
        .remove();

      const barsEnter = bars.enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => xScale(d.name)!)
        .attr('y', innerHeight)
        .attr('width', xScale.bandwidth())
        .attr('height', 0)
        .attr('fill', '#ff6b6b')
        .attr('rx', 4);

      barsEnter.merge(bars as any)
        .on('mouseover', function(event, d: any) {
          d3.select(this)
            .transition()
            .duration(200)
            .attr('fill', '#1a1a1a');

          tooltip.style('visibility', 'visible')
            .html(`
              <div style="font-weight: 700; margin-bottom: 10px; font-size: 15px; color: #ff6b6b;">${d.name}</div>
              <div style="display: grid; gap: 6px;">
                <div><strong>Valuation:</strong> $${d.value}M</div>
                <div><strong>Category:</strong> ${d.category}</div>
                <div><strong>Growth:</strong> ${d.growth}%</div>
                <div><strong>Employees:</strong> ${d.employees}</div>
              </div>
            `)
            .style('left', (event.pageX + 15) + 'px')
            .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', function() {
          d3.select(this)
            .transition()
            .duration(200)
            .attr('fill', '#ff6b6b');
          tooltip.style('visibility', 'hidden');
        })
        .transition()
        .duration(500)
        .attr('x', d => xScale(d.name)!)
        .attr('y', d => yScale(d.value))
        .attr('width', xScale.bandwidth())
        .attr('height', d => innerHeight - yScale(d.value));

      // Value labels
      const labels = g.selectAll('.bar-label')
        .data(displayData, (d: any) => d.name);

      labels.exit().remove();

      const labelsEnter = labels.enter()
        .append('text')
        .attr('class', 'bar-label')
        .attr('text-anchor', 'middle')
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .attr('fill', '#1a1a1a');

      labelsEnter.merge(labels as any)
        .transition()
        .duration(500)
        .attr('x', d => xScale(d.name)! + xScale.bandwidth() / 2)
        .attr('y', d => yScale(d.value) - 8)
        .text(d => `$${d.value}M`);
    }

    // Controls
    const controls = container.append('div')
      .style('margin-top', '20px')
      .style('text-align', 'center')
      .style('display', 'flex')
      .style('justify-content', 'center')
      .style('gap', '20px')
      .style('flex-wrap', 'wrap');

    // Display count selector
    const countControl = controls.append('div');
    countControl.append('label')
      .style('margin-right', '8px')
      .style('font-weight', '500')
      .style('color', '#1a1a1a')
      .style('font-size', '13px')
      .text('Show top: ');

    countControl.append('select')
      .style('padding', '6px 12px')
      .style('border', '2px solid #ff6b6b')
      .style('border-radius', '6px')
      .style('background', 'white')
      .style('cursor', 'pointer')
      .style('font-size', '13px')
      .on('change', function() {
        displayCount = parseInt((this as HTMLSelectElement).value);
        updateChart();
      })
      .selectAll('option')
      .data([5, 10, 15])
      .enter()
      .append('option')
      .attr('value', d => d)
      .property('selected', d => d === 10)
      .text(d => d);

    // Sort selector
    const sortControl = controls.append('div');
    sortControl.append('label')
      .style('margin-right', '8px')
      .style('font-weight', '500')
      .style('color', '#1a1a1a')
      .style('font-size', '13px')
      .text('Sort by: ');

    sortControl.append('select')
      .style('padding', '6px 12px')
      .style('border', '2px solid #ff6b6b')
      .style('border-radius', '6px')
      .style('background', 'white')
      .style('cursor', 'pointer')
      .style('font-size', '13px')
      .on('change', function() {
        const sortBy = (this as HTMLSelectElement).value;
        if (sortBy === 'value') {
          sortedData.sort((a, b) => b.value - a.value);
        } else if (sortBy === 'growth') {
          sortedData.sort((a, b) => b.growth - a.growth);
        } else if (sortBy === 'employees') {
          sortedData.sort((a, b) => b.employees - a.employees);
        }
        updateChart();
      })
      .selectAll('option')
      .data([
        { value: 'value', text: 'Valuation' },
        { value: 'growth', text: 'Growth Rate' },
        { value: 'employees', text: 'Team Size' }
      ])
      .enter()
      .append('option')
      .attr('value', d => d.value)
      .text(d => d.text);

    // Legend
    const legend = svg.append('g')
      .attr('transform', `translate(${width - margin.right + 20}, ${margin.top})`);

    legend.append('rect')
      .attr('width', 18)
      .attr('height', 18)
      .attr('fill', '#ff6b6b')
      .attr('rx', 3);

    legend.append('text')
      .attr('x', 26)
      .attr('y', 9)
      .attr('dy', '.35em')
      .style('font-size', '12px')
      .attr('fill', '#1a1a1a')
      .text('Valuation');

    // Initial render
    updateChart();
  };

  const renderScatterPlot = () => {
    if (!containerRef.current) return;

    const container = d3.select(containerRef.current);
    const width = 900;
    const height = 500;
    const margin = { top: 60, right: 140, bottom: 60, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = container.append('svg')
      .attr('width', '100%')
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('max-width', '900px')
      .style('margin', '0 auto')
      .style('display', 'block');

    // Title
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 30)
      .attr('text-anchor', 'middle')
      .attr('font-size', '22px')
      .attr('font-weight', 'bold')
      .attr('fill', '#ff6b6b')
      .text('Global Economics: GDP per Capita vs Energy Use');

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Scales
    const xScale = d3.scaleLinear()
      .domain([0, 8000])
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain([0, 100000])
      .range([innerHeight, 0]);

    const sizeScale = d3.scaleSqrt()
      .domain([0, d3.max(scatterData, d => d.population)!])
      .range([6, 28]);

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .selectAll('line.horizontal')
      .data(yScale.ticks(6))
      .enter()
      .append('line')
      .attr('class', 'horizontal')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', d => yScale(d))
      .attr('y2', d => yScale(d))
      .attr('stroke', '#f0f0f0')
      .attr('stroke-width', 1);

    g.append('g')
      .attr('class', 'grid')
      .selectAll('line.vertical')
      .data(xScale.ticks(8))
      .enter()
      .append('line')
      .attr('class', 'vertical')
      .attr('x1', d => xScale(d))
      .attr('x2', d => xScale(d))
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', '#f0f0f0')
      .attr('stroke-width', 1);

    // Axes
    g.append('g')
      .attr('transform', `translate(0, ${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(8))
      .selectAll('text')
      .attr('fill', '#1a1a1a');

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(6))
      .selectAll('text')
      .attr('fill', '#1a1a1a');

    // Axis labels
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 45)
      .attr('text-anchor', 'middle')
      .attr('fill', '#1a1a1a')
      .attr('font-size', '13px')
      .attr('font-weight', '600')
      .text('Energy Use per Capita (kg oil equivalent)');

    g.append('text')
      .attr('x', -innerHeight / 2)
      .attr('y', -45)
      .attr('text-anchor', 'middle')
      .attr('transform', 'rotate(-90)')
      .attr('fill', '#1a1a1a')
      .attr('font-size', '13px')
      .attr('font-weight', '600')
      .text('GDP per Capita ($)');

    // Tooltip
    const tooltip = container.append('div')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background', 'white')
      .style('color', '#1a1a1a')
      .style('border', '2px solid #ff6b6b')
      .style('border-radius', '8px')
      .style('padding', '12px 16px')
      .style('box-shadow', '0 4px 16px rgba(0, 0, 0, 0.15)')
      .style('font-size', '13px')
      .style('z-index', '1000')
      .style('pointer-events', 'none');

    // Circles
    g.selectAll('circle')
      .data(scatterData)
      .enter()
      .append('circle')
      .attr('cx', d => xScale(d.energy))
      .attr('cy', d => yScale(d.gdp))
      .attr('r', d => sizeScale(d.population))
      .attr('fill', '#ff6b6b')
      .attr('opacity', 0.7)
      .attr('stroke', 'transparent')
      .attr('stroke-width', 0)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('opacity', 1);

        tooltip.style('visibility', 'visible')
          .html(`
            <div style="font-weight: 700; margin-bottom: 10px; font-size: 15px; color: #ff6b6b;">${d.country}</div>
            <div style="display: grid; gap: 6px;">
              <div><strong>GDP per Capita:</strong> $${d.gdp.toLocaleString()}</div>
              <div><strong>Energy Use:</strong> ${d.energy.toLocaleString()} kg</div>
              <div><strong>Population:</strong> ${d.population}M</div>
            </div>
          `)
          .style('left', (event.pageX + 15) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('opacity', 0.7);
        tooltip.style('visibility', 'hidden');
      });

    // Labels
    g.selectAll('text.label')
      .data(scatterData)
      .enter()
      .append('text')
      .attr('class', 'label')
      .attr('x', d => xScale(d.energy))
      .attr('y', d => yScale(d.gdp) - sizeScale(d.population) - 8)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('font-weight', '600')
      .attr('fill', '#1a1a1a')
      .text(d => d.country);

    // Legend
    const legend = svg.append('g')
      .attr('transform', `translate(${width - margin.right + 20}, ${margin.top})`);

    legend.append('text')
      .attr('x', 0)
      .attr('y', 0)
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .attr('fill', '#1a1a1a')
      .text('Bubble Size:');

    legend.append('text')
      .attr('x', 0)
      .attr('y', 18)
      .attr('font-size', '11px')
      .attr('fill', '#666')
      .text('Population (M)');
  };

  const renderTimeSeries = () => {
    if (!containerRef.current) return;

    const container = d3.select(containerRef.current);
    const width = 900;
    const height = 500;
    const margin = { top: 60, right: 140, bottom: 60, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = container.append('svg')
      .attr('width', '100%')
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('max-width', '900px')
      .style('margin', '0 auto')
      .style('display', 'block');

    // Title
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 30)
      .attr('text-anchor', 'middle')
      .attr('font-size', '22px')
      .attr('font-weight', 'bold')
      .attr('fill', '#ff6b6b')
      .text('Stock Market Performance: 2024 Trading Year');

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Scales
    const xScale = d3.scaleBand()
      .domain(timeSeriesData.map(d => d.month))
      .range([0, innerWidth])
      .padding(0.1);

    const yScale = d3.scaleLinear()
      .domain([350, Math.max(...timeSeriesData.map(d => d.price)) * 1.05])
      .range([innerHeight, 0]);

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .selectAll('line')
      .data(yScale.ticks(8))
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', d => yScale(d))
      .attr('y2', d => yScale(d))
      .attr('stroke', '#f0f0f0')
      .attr('stroke-width', 1);

    // Axes
    g.append('g')
      .attr('transform', `translate(0, ${innerHeight})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .attr('fill', '#1a1a1a')
      .attr('font-size', '12px');

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(8).tickFormat(d => `$${d}`))
      .selectAll('text')
      .attr('fill', '#1a1a1a');

    // Axis labels
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 45)
      .attr('text-anchor', 'middle')
      .attr('fill', '#1a1a1a')
      .attr('font-size', '13px')
      .attr('font-weight', '600')
      .text('Month (2024)');

    g.append('text')
      .attr('x', -innerHeight / 2)
      .attr('y', -45)
      .attr('text-anchor', 'middle')
      .attr('transform', 'rotate(-90)')
      .attr('fill', '#1a1a1a')
      .attr('font-size', '13px')
      .attr('font-weight', '600')
      .text('Stock Price ($)');

    // Line
    const line = d3.line<typeof timeSeriesData[0]>()
      .x(d => xScale(d.month)! + xScale.bandwidth() / 2)
      .y(d => yScale(d.price))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(timeSeriesData)
      .attr('fill', 'none')
      .attr('stroke', '#ff6b6b')
      .attr('stroke-width', 3)
      .attr('d', line);

    // Area under curve
    const area = d3.area<typeof timeSeriesData[0]>()
      .x(d => xScale(d.month)! + xScale.bandwidth() / 2)
      .y0(innerHeight)
      .y1(d => yScale(d.price))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(timeSeriesData)
      .attr('fill', '#ff6b6b')
      .attr('opacity', 0.2)
      .attr('d', area);

    // Tooltip
    const tooltip = container.append('div')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background', 'white')
      .style('color', '#1a1a1a')
      .style('border', '2px solid #ff6b6b')
      .style('border-radius', '8px')
      .style('padding', '12px 16px')
      .style('box-shadow', '0 4px 16px rgba(0, 0, 0, 0.15)')
      .style('font-size', '13px')
      .style('z-index', '1000')
      .style('pointer-events', 'none');

    // Points
    g.selectAll('circle')
      .data(timeSeriesData)
      .enter()
      .append('circle')
      .attr('cx', d => xScale(d.month)! + xScale.bandwidth() / 2)
      .attr('cy', d => yScale(d.price))
      .attr('r', 5)
      .attr('fill', '#ff6b6b')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 0)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', 8);

        const priceChange = ((d.price - 412.5) / 412.5 * 100).toFixed(1);
        const changeColor = parseFloat(priceChange) >= 0 ? '#10b981' : '#ef4444';
        
        tooltip.style('visibility', 'visible')
          .html(`
            <div style="font-weight: 700; margin-bottom: 10px; font-size: 15px; color: #ff6b6b;">${d.month} 2024</div>
            <div style="display: grid; gap: 6px;">
              <div><strong>Price:</strong> $${d.price.toFixed(2)}</div>
              <div><strong>Volume:</strong> ${d.volume}M</div>
              <div><strong>Volatility:</strong> ${d.volatility}%</div>
              <div style="margin-top: 4px; padding-top: 6px; border-top: 1px solid #e5e5e5;">
                <strong>YTD Change:</strong> <span style="color: ${changeColor}">${priceChange}%</span>
              </div>
            </div>
          `)
          .style('left', (event.pageX + 15) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', 5);
        tooltip.style('visibility', 'hidden');
      });

    // Legend
    const legend = svg.append('g')
      .attr('transform', `translate(${width - margin.right + 20}, ${margin.top})`);

    legend.append('line')
      .attr('x1', 0)
      .attr('x2', 30)
      .attr('y1', 10)
      .attr('y2', 10)
      .attr('stroke', '#ff6b6b')
      .attr('stroke-width', 3);

    legend.append('circle')
      .attr('cx', 15)
      .attr('cy', 10)
      .attr('r', 5)
      .attr('fill', '#ff6b6b')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 0);

    legend.append('text')
      .attr('x', 40)
      .attr('y', 10)
      .attr('dy', '.35em')
      .attr('font-size', '12px')
      .attr('fill', '#1a1a1a')
      .text('Stock Price');
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Tabs */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '4px',
        marginBottom: '24px',
        background: '#f8f8f8',
        padding: '4px',
        borderRadius: '8px',
        width: 'fit-content',
        margin: '0 auto 24px',
      }}>
        <button
          onClick={() => setActiveTab('bar')}
          style={{
            padding: '8px 20px',
            fontSize: '14px',
            fontWeight: '500',
            border: 'none',
            background: activeTab === 'bar' ? 'white' : 'transparent',
            color: activeTab === 'bar' ? '#ff6b6b' : '#666',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: activeTab === 'bar' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
          }}
        >
          Bar Chart
        </button>
        <button
          onClick={() => setActiveTab('scatter')}
          style={{
            padding: '8px 20px',
            fontSize: '14px',
            fontWeight: '500',
            border: 'none',
            background: activeTab === 'scatter' ? 'white' : 'transparent',
            color: activeTab === 'scatter' ? '#ff6b6b' : '#666',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: activeTab === 'scatter' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
          }}
        >
          Scatter Plot
        </button>
        <button
          onClick={() => setActiveTab('timeseries')}
          style={{
            padding: '8px 20px',
            fontSize: '14px',
            fontWeight: '500',
            border: 'none',
            background: activeTab === 'timeseries' ? 'white' : 'transparent',
            color: activeTab === 'timeseries' ? '#ff6b6b' : '#666',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: activeTab === 'timeseries' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
          }}
        >
          Time Series
        </button>
      </div>

      {/* Chart Container */}
      <div 
        ref={containerRef}
        style={{
          width: '100%',
          padding: '30px',
          background: 'linear-gradient(135deg, #fff7f8 0%, #ffffff 100%)',
          borderRadius: '16px',
          boxShadow: '0 4px 20px rgba(255, 107, 107, 0.1)',
          border: '1px solid #ffe0e6'
        }}
      />

      {/* Info Text */}
      <div style={{
        marginTop: '20px',
        textAlign: 'center',
        fontStyle: 'italic',
        color: '#666',
        fontSize: '14px'
      }}>
        Hover over {activeTab === 'bar' ? 'bars' : activeTab === 'scatter' ? 'bubbles' : 'data points'} for detailed insights
      </div>
    </div>
  );
};
