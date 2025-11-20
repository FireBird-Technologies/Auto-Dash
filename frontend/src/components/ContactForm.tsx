import React, { useState } from 'react';

interface ContactFormProps {
  onBack: () => void;
}

export const ContactForm: React.FC<ContactFormProps> = ({ onBack }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    budget: '',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Here you would typically send the data to your backend
    console.log('Contact form submitted:', formData);
    
    setSubmitting(false);
    setSubmitted(true);

    // Reset form after 3 seconds and go back
    setTimeout(() => {
      setSubmitted(false);
      setFormData({
        name: '',
        email: '',
        company: '',
        budget: '',
        message: ''
      });
      onBack();
    }, 3000);
  };

  if (submitted) {
    return (
      <div className="contact-form-container">
        <div className="contact-form-wrapper">
          <div className="contact-success">
            <div className="success-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
            </div>
            <h2>Thank You!</h2>
            <p>We've received your message and will get back to you within 24 hours.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="contact-form-container">
      <div className="contact-form-wrapper">
        <button className="back-button" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>

        <div className="contact-form-content">
          <h1 className="page-title page-title-center">Contact Us</h1>
          <p className="page-subtitle page-subtitle-center">
            Tell us about your needs and we'll get back to you with a custom solution.
          </p>

          <form onSubmit={handleSubmit} className="contact-form">
            <div className="form-group">
              <label htmlFor="name">Name</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="form-input"
                placeholder="Full Name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Business Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="form-input"
                placeholder="Email Address"
              />
            </div>

            <div className="form-group">
              <label htmlFor="company">Company</label>
              <input
                type="text"
                id="company"
                name="company"
                value={formData.company}
                onChange={handleChange}
                required
                className="form-input"
                placeholder="Company Name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="budget">Budget (USD)</label>
              <input
                type="text"
                id="budget"
                name="budget"
                value={formData.budget}
                onChange={handleChange}
                className="form-input"
                placeholder="Enter your budget"
              />
            </div>

            <div className="form-group">
              <label htmlFor="message">Message</label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                required
                className="form-textarea"
                placeholder="Tell us about your needs..."
                rows={6}
              />
            </div>

            <button
              type="submit"
              className="button-primary"
              style={{ 
                width: '100%', 
                marginTop: '8px',
                opacity: 1,
                transform: 'none'
              }}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <svg style={{ animation: 'spin 1s linear infinite' }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" opacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75" />
                  </svg>
                  Sending...
                </>
              ) : (
                'Send Message'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

