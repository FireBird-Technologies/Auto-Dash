<div align="center">
  <img src="frontend/public/logo.svg" alt="AutoDash Logo" width="300" />
  
  <h1>AutoDash</h1>
  <p><strong>Your AI Data Artist</strong></p>
  
  <p>
    <img src="https://img.shields.io/badge/Open%20Source-♥-red?style=flat-square" alt="Open Source" />
    <img src="https://img.shields.io/badge/D3.js-Powered-orange?style=flat-square" alt="D3.js Powered" />
    <img src="https://img.shields.io/badge/AI-Enabled-blue?style=flat-square" alt="AI Enabled" />
  </p>

  <p>
    <em>AutoDash transforms raw data into beautiful, interactive visualizations in three simple steps.</em>
    <br />
    <strong>No code. No complexity. Just insights.</strong>
  </p>
</div>

---

## ✨ Features

<table>
  <tr>
    <td width="33%" valign="top">
      <h3>📤 Instant Upload</h3>
      <p>Upload CSV, Excel, or use sample datasets. Support for large files with automatic parsing and validation.</p>
    </td>
    <td width="33%" valign="top">
      <h3>💬 Natural Language</h3>
      <p>Describe your insights in plain English. Our AI understands what you're looking for and generates the perfect visualization.</p>
    </td>
    <td width="33%" valign="top">
      <h3>⚡ Real-time Updates</h3>
      <p>Iteratively refine your charts with feedback. Changes appear instantly as our backend generates new D3 instructions.</p>
    </td>
  </tr>
  <tr>
    <td width="33%" valign="top">
      <h3>📊 Smart Analytics</h3>
      <p>Automatic correlation detection, trend analysis, and anomaly identification powered by backend intelligence.</p>
    </td>
    <td width="33%" valign="top">
      <h3>🎨 D3-Powered</h3>
      <p>Beautiful, interactive charts built with D3.js. Hover, zoom, pan, and explore your data like never before.</p>
    </td>
    <td width="33%" valign="top">
      <h3>👥 Collaborative</h3>
      <p>Share dashboards, export visualizations, and collaborate with your team in real-time.</p>
    </td>
  </tr>
</table>

---

## 🚀 How It Works

### Building visuals is as easy as 1, 2, 3

> From raw data to actionable insights in minutes. No technical skills required.

#### **01. Connect Your Data**
Start by uploading your dataset or choose from our sample data library.
- ✅ Supports CSV, Excel (.xlsx, .xls)
- ✅ Drag & drop or click to browse
- ✅ Automatic data type detection
- ✅ Sample datasets to get started instantly

#### **02. Describe Your Insights**
Tell us what you want to discover in plain language.
- ✅ Natural language processing understands your intent
- ✅ Examples: "Show sales trends", "Compare regions"
- ✅ AI suggests relevant chart types
- ✅ Context-aware recommendations

#### **03. Visualize & Refine**
Get instant visualizations and iterate with real-time feedback.
- ✅ D3-powered interactive charts
- ✅ Request changes in plain English
- ✅ Real-time updates from backend
- ✅ Export and share your dashboards

---

## 🎯 Beautiful D3-powered Visualizations

**Interactive charts that bring your data to life**

- 📈 **Trend Analysis** - Line charts, area charts, time series
- 📊 **Comparisons** - Bar charts, grouped bars, stacked bars
- 🎯 **Distributions** - Histograms, box plots, violin plots
- 🔗 **Relationships** - Scatter plots, bubble charts, correlation matrices
- 🌳 **Hierarchies** - Treemaps, sunburst charts, dendrograms
- 🌐 **Networks** - Sankey diagrams, chord diagrams, force layouts

### Visualization Features
- ✨ **Hover tooltips** - Detailed information on hover
- 🔍 **Zoom & pan** - Explore large datasets interactively
- 🎮 **Fully interactive** - Click, filter, sort, and drill down
- 📱 **Responsive design** - Beautiful on any screen size

---

## 💡 Why AutoDash?

<table>
  <tr>
    <td width="33%" align="center">
      <h3>No Code Required</h3>
      <p>Built for everyone—from analysts to executives. If you can describe it, AutoDash can visualize it.</p>
    </td>
    <td width="33%" align="center">
      <h3>Lightning Fast</h3>
      <p>Go from upload to insight in under 60 seconds. Our backend handles all the heavy lifting.</p>
    </td>
    <td width="33%" align="center">
      <h3>Enterprise Ready</h3>
      <p>Secure, scalable, and built with production workloads in mind. Connect to any database.</p>
    </td>
  </tr>
</table>

---

## 🛠️ Tech Stack

### Frontend
- **React** + **TypeScript** - Modern, type-safe UI
- **D3.js** - Powerful data visualization library
- **Vite** - Lightning-fast build tool

### Backend
- **FastAPI** - High-performance Python API
- **DSPy** - AI-powered visualization generation
- **SQLAlchemy** - Database ORM
- **Pandas** - Data processing and analysis

### AI & Intelligence
- **Natural Language Processing** - Understand user intent
- **Code Generation** - Automatic D3.js code creation
- **Error Recovery** - Self-healing visualizations
- **Context-Aware** - Smart recommendations based on data

---

## 📦 Installation

### Prerequisites
- **Node.js** 18+ and **npm**
- **Python** 3.9+
- **Git**

### Clone the Repository
```bash
git clone https://github.com/yourusername/autodash.git
cd autodash
```

### Backend Setup
```bash
cd backend
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys (OpenAI, Google OAuth, etc.)

# Run the backend
python -m app.main
```

The backend will start on `http://localhost:8000`

### Frontend Setup
```bash
cd frontend
npm install

# Run the development server
npm run dev
```

The frontend will start on `http://localhost:5173`

---

## 🎮 Usage

1. **Start the Application**
   - Navigate to `http://localhost:5173`
   - Sign in with Google

2. **Upload Your Data**
   - Click "Upload Dataset" or drag & drop a CSV/Excel file
   - Preview your data to ensure it loaded correctly

3. **Ask for Insights**
   - Type your question in plain English
   - Examples:
     - "Show me a histogram of prices"
     - "Create a scatter plot of sqft_living vs price"
     - "Compare sales trends by region"

4. **Refine & Export**
   - Request changes: "Make the bars blue" or "Add a trend line"
   - Download your visualization as PNG, SVG, or PDF
   - Share your dashboard with your team

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Workflow
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🌟 Acknowledgments

- **D3.js** - For the incredible visualization library
- **FastAPI** - For the blazing-fast Python framework
- **DSPy** - For AI-powered code generation
- **Open Source Community** - For inspiration and support

---

<div align="center">
  <h3>Ready to transform your data?</h3>
  <p><strong>Join thousands of teams using AutoDash to make data-driven decisions faster.</strong></p>
  
  <p>
    <a href="https://github.com/yourusername/autodash">⭐ Star on GitHub</a> •
    <a href="#installation">🚀 Get Started</a> •
    <a href="https://github.com/yourusername/autodash/issues">🐛 Report Bug</a> •
    <a href="https://github.com/yourusername/autodash/issues">💡 Request Feature</a>
  </p>

  <p>
    <sub>Built with ❤️ by the AutoDash team</sub>
  </p>
</div>


