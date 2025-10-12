import React, { useEffect, useRef } from 'react';
import { FeatureCard } from './landing/FeatureCard';
import { WorkflowStep } from './landing/WorkflowStep';
import { GoogleAuthButton } from './GoogleAuthButton';
import { DemoVisualization } from './landing/DemoVisualization';

interface LandingProps {
  onStart: () => void;
}

export const Landing: React.FC<LandingProps> = ({ onStart }) => {
  const landingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
        }
      });
    }, observerOptions);

    // Observe all sections and cards
    const elementsToAnimate = landingRef.current?.querySelectorAll(
      '.landing-hero, .features-section, .workflow-section, .demo-section, .showcase-section, .benefits-section, .final-cta, .feature-card, .workflow-step, .viz-card, .benefit-card'
    );

    elementsToAnimate?.forEach(el => observer.observe(el));

    // Animate hero section immediately on mount
    setTimeout(() => {
      const hero = landingRef.current?.querySelector('.landing-hero');
      hero?.classList.add('animate-in');
    }, 100);

    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing" ref={landingRef}>
      {/* Hero */}

      <header className="landing-hero">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px', gap: '0.5rem' }}>
          <div className="landing-badge" style={{ marginBottom: 0 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ verticalAlign: 'middle', marginRight: '0.4em' }}>
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
            Open Source
          </div>
          <img 
            src="/logo.svg" 
            alt="AutoDash Logo" 
            className="hero-logo"
            style={{
              width: '300px',
              height: 'auto',
              marginBottom: 0
            }}
          />
        </div>
        <h1 className="landing-title">Your AI Data Artist</h1>
        <p className="landing-subtitle">
          AutoDash transforms raw data into beautiful, interactive visualizations in three simple steps.
          <br />No code. No complexity. Just insights.
        </p>
        <div className="landing-cta">
          <GoogleAuthButton onSuccess={(token) => {
            localStorage.setItem('auth_token', token);
            onStart();
          }}>
            Get Started with Google
          </GoogleAuthButton>
        </div>
      </header>

      {/* Features Grid */}
      <section className="features-section">
        <div className="section-container">
          <h2 className="section-heading">Everything you need to visualize data</h2>
          <div className="features-grid">
            <FeatureCard
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              }
              title="Instant Upload"
              description="Upload CSV, Excel, or use sample datasets. Support for large files with automatic parsing and validation."
            />
            <FeatureCard
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
              }
              title="Natural Language"
              description="Describe your insights in plain English. Our AI understands what you're looking for and generates the perfect visualization."
            />
            <FeatureCard
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="2" x2="12" y2="6" />
                  <line x1="12" y1="18" x2="12" y2="22" />
                  <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                  <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                  <line x1="2" y1="12" x2="6" y2="12" />
                  <line x1="18" y1="12" x2="22" y2="12" />
                  <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                  <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                </svg>
              }
              title="Real-time Updates"
              description="Iteratively refine your charts with feedback. Change appears instantly as our backend generates new D3 instructions."
            />
            <FeatureCard
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              }
              title="Smart Analytics"
              description="Automatic correlation detection, trend analysis, and anomaly identification powered by backend intelligence."
            />
            <FeatureCard
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="9" y1="21" x2="9" y2="9" />
                </svg>
              }
              title="D3-Powered"
              description="Beautiful, interactive charts built with D3.js. Hover, zoom, pan, and explore your data like never before."
            />
            <FeatureCard
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              }
              title="Collaborative"
              description="Share dashboards, export visualizations, and collaborate with your team in real-time."
            />
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section className="workflow-section">
        <div className="section-container">
          <h2 className="section-heading">Building visuals is as easy as 1, 2, 3</h2>
          <p className="section-subheading">
            From raw data to actionable insights in minutes. No technical skills required.
          </p>
          <div className="workflow-steps">
            <WorkflowStep
              number="01"
              title="Connect Your Data"
              description="Start by uploading your dataset or choose from our sample data library."
              details={[
                "Supports CSV, Excel (.xlsx, .xls)",
                "Drag & drop or click to browse",
                "Automatic data type detection",
                "Sample datasets to get started instantly"
              ]}
            />
            <WorkflowStep
              number="02"
              title="Describe Your Insights"
              description="Tell us what you want to discover in plain language."
              details={[
                "Natural language processing understands your intent",
                "Examples: 'Show sales trends', 'Compare regions'",
                "AI suggests relevant chart types",
                "Context-aware recommendations"
              ]}
            />
            <WorkflowStep
              number="03"
              title="Visualize & Refine"
              description="Get instant visualizations and iterate with real-time feedback."
              details={[
                "D3-powered interactive charts",
                "Request changes in plain English",
                "Real-time updates from backend",
                "Export and share your dashboards"
              ]}
            />
          </div>
        </div>
      </section>

      {/* Interactive Demo */}
      <section className="demo-section">
        <div className="section-container">
          <div className="demo-header">
            <span className="demo-badge">Live Demo</span>
            <h2 className="section-heading">See AutoDash in Action</h2>
            <p className="section-subheading">
              Try interacting with this fully functional visualization below. 
              Hover, filter, and sort to explore the data—all powered by D3.js and natural language.
            </p>
          </div>
          <DemoVisualization />
          <div className="demo-cta">
            <p className="demo-cta-text">
              This is just one example. AutoDash can create <strong>any visualization you can imagine</strong>—just describe it.
            </p>
            <GoogleAuthButton
              onSuccess={(token) => {
                localStorage.setItem('auth_token', token);
                onStart();
              }}
            >
              Create Your Own Visualization
            </GoogleAuthButton>
          </div>
        </div>
      </section>

      {/* D3 Visualizations Showcase */}
      <section className="showcase-section">
        <div className="section-container">
          <h2 className="section-heading">Beautiful D3-powered visualizations</h2>
          <p className="section-subheading">
            Interactive charts that bring your data to life
          </p>
          <div className="viz-showcase-grid">
            <div className="viz-card">
              <div className="viz-preview">
                <svg viewBox="0 0 200 120" className="viz-svg">
                  <circle cx="40" cy="60" r="8" fill="#ff6b6b" opacity="0.7" />
                  <circle cx="70" cy="45" r="8" fill="#ff6b6b" opacity="0.7" />
                  <circle cx="100" cy="70" r="8" fill="#ff6b6b" opacity="0.7" />
                  <circle cx="130" cy="35" r="8" fill="#ff6b6b" opacity="0.7" />
                  <circle cx="160" cy="55" r="8" fill="#ff6b6b" opacity="0.7" />
                  <line x1="40" y1="60" x2="70" y2="45" stroke="#ff6b6b" strokeWidth="2" opacity="0.3" />
                  <line x1="70" y1="45" x2="100" y2="70" stroke="#ff6b6b" strokeWidth="2" opacity="0.3" />
                  <line x1="100" y1="70" x2="130" y2="35" stroke="#ff6b6b" strokeWidth="2" opacity="0.3" />
                  <line x1="130" y1="35" x2="160" y2="55" stroke="#ff6b6b" strokeWidth="2" opacity="0.3" />
                </svg>
              </div>
              <h4>Scatter & Line Charts</h4>
              <p>Explore correlations and trends</p>
            </div>

            <div className="viz-card">
              <div className="viz-preview">
                <svg viewBox="0 0 200 120" className="viz-svg">
                  <rect x="30" y="50" width="25" height="60" fill="#ff6b6b" opacity="0.8" rx="2" />
                  <rect x="65" y="30" width="25" height="80" fill="#ff6b6b" opacity="0.8" rx="2" />
                  <rect x="100" y="70" width="25" height="40" fill="#ff6b6b" opacity="0.8" rx="2" />
                  <rect x="135" y="40" width="25" height="70" fill="#ff6b6b" opacity="0.8" rx="2" />
                </svg>
              </div>
              <h4>Bar Charts</h4>
              <p>Compare values across categories</p>
            </div>

            <div className="viz-card">
              <div className="viz-preview">
                <svg viewBox="0 0 200 120" className="viz-svg">
                  <path d="M 20,100 Q 60,20 100,60 T 180,40" fill="none" stroke="#ff6b6b" strokeWidth="3" opacity="0.6" />
                  <path d="M 20,100 Q 60,70 100,80 T 180,70" fill="none" stroke="#ff8f8f" strokeWidth="3" opacity="0.4" />
                  <circle cx="20" cy="100" r="4" fill="#ff6b6b" />
                  <circle cx="100" cy="60" r="4" fill="#ff6b6b" />
                  <circle cx="180" cy="40" r="4" fill="#ff6b6b" />
                </svg>
              </div>
              <h4>Time Series</h4>
              <p>Track changes over time</p>
            </div>
          </div>
          <div className="showcase-features">
            <div className="showcase-feature">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v20M2 12h20" />
              </svg>
              <span>Hover tooltips</span>
            </div>
            <div className="showcase-feature">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v6m0 6v6" />
              </svg>
              <span>Zoom & pan</span>
            </div>
            <div className="showcase-feature">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              <span>Fully interactive</span>
            </div>
            <div className="showcase-feature">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M9 21V9" />
              </svg>
              <span>Responsive design</span>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="benefits-section">
        <div className="section-container">
          <div className="benefits-grid">
            <div className="benefit-card">
              <h3>No Code Required</h3>
              <p>Built for everyone—from analysts to executives. If you can describe it, AutoDash can visualize it.</p>
            </div>
            <div className="benefit-card">
              <h3>Lightning Fast</h3>
              <p>Go from upload to insight in under 60 seconds. Our backend handles all the heavy lifting.</p>
            </div>
            <div className="benefit-card">
              <h3>Enterprise Ready</h3>
              <p>Secure, scalable, and built with production workloads in mind. Connect to any database.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="final-cta">
        <div className="cta-content">
          <h2>Ready to transform your data?</h2>
          <p>Join thousands of teams using AutoDash to make data-driven decisions faster.</p>
          <GoogleAuthButton 
            className="cta-button-primary"
            onSuccess={(token) => {
              localStorage.setItem('auth_token', token);
              onStart();
            }}
          >
            Get Started — It's Free
          </GoogleAuthButton>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <img 
              src="/logo.svg" 
              alt="AutoDash" 
              style={{
                width: '120px',
                height: 'auto',
                marginBottom: '10px'
              }}
            />
          </div>
          <div className="footer-links">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="#features">Features</a>
            <a href="#benefits">Benefits</a>
          </div>
        </div>
      </footer>
    </div>
  );
};