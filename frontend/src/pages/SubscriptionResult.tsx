import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useNotification } from '../contexts/NotificationContext';
import { useCreditsContext } from '../contexts/CreditsContext';

export const SubscriptionResult: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const notification = useNotification();
  const { refetch: refetchCredits } = useCreditsContext();
  const [status, setStatus] = useState<'loading' | 'success' | 'canceled' | 'error'>('loading');
  const [waitingForWebhook, setWaitingForWebhook] = useState(false);
  const hasProcessed = useRef(false); // Track if we've already processed the subscription result

  useEffect(() => {
    // Prevent multiple executions
    if (hasProcessed.current) return;
    
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');
    const sessionId = searchParams.get('session_id');

    if (canceled === 'true') {
      hasProcessed.current = true; // Mark as processed
      setStatus('canceled');
      notification.warning('Subscription checkout was canceled');
      // Redirect to account page after 2 seconds
      setTimeout(() => {
        navigate('/account');
      }, 2000);
    } else if (success === 'true' && sessionId) {
      hasProcessed.current = true; // Mark as processed
      setStatus('success');
      setWaitingForWebhook(true);
      notification.success('Subscription activated successfully! Processing your subscription...');
      
      // Poll for subscription updates (webhook may take a few seconds)
      const pollForUpdates = async () => {
        const { config, getAuthHeaders, checkAuthResponse } = await import('../config');
        
        // Wait 3 seconds for webhook to process, then start polling
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        let attempts = 0;
        const maxAttempts = 10; // Poll for up to 30 seconds (3 seconds * 10)
        
        const pollInterval = setInterval(async () => {
          attempts++;
          
          try {
            // Check subscription status
            const statusResponse = await fetch(`${config.backendUrl}/api/payment/subscription-status`, {
              headers: getAuthHeaders(),
            });
            
            await checkAuthResponse(statusResponse);
            
            if (statusResponse.ok) {
              const subscriptionData = await statusResponse.json();
              
              // Check if subscription is active and has a plan
              if (subscriptionData.has_subscription && subscriptionData.plan && subscriptionData.plan.name !== 'Free') {
                clearInterval(pollInterval);
                setWaitingForWebhook(false);
                
                // Refetch credits to update balance
                refetchCredits();
                
                notification.success('Subscription fully activated! Your credits have been updated.');
                
                // Redirect to account page after 1 second
                setTimeout(() => {
                  navigate('/account');
                }, 1000);
                return;
              }
            }
            
            // If max attempts reached, redirect anyway
            if (attempts >= maxAttempts) {
              clearInterval(pollInterval);
              setWaitingForWebhook(false);
              refetchCredits();
              notification.info('Subscription is processing. Please refresh your account page in a moment.');
              setTimeout(() => {
                navigate('/account');
              }, 2000);
            }
          } catch (error) {
            console.error('Error polling subscription status:', error);
            // Continue polling on error
          }
        }, 3000); // Poll every 3 seconds
      };
      
      pollForUpdates();
    } else {
      hasProcessed.current = true; // Mark as processed
      setStatus('error');
      notification.error('Unable to determine subscription status');
      // Redirect to account page after 2 seconds
      setTimeout(() => {
        navigate('/account');
      }, 2000);
    }
  }, [searchParams, navigate, notification, refetchCredits]);

  // Reset the processed flag when component unmounts (allows re-processing if user navigates back)
  useEffect(() => {
    return () => {
      hasProcessed.current = false;
    };
  }, []);

  return (
    <div className="subscription-result-page">
      <div className="subscription-result-card">
        {status === 'loading' && (
          <>
            <div className="result-icon loading">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
            <h1>Processing your subscription...</h1>
            <p>Please wait while we confirm your subscription.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className={`result-icon ${waitingForWebhook ? 'loading' : 'success'}`}>
              {waitingForWebhook ? (
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              ) : (
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              )}
            </div>
            <h1>{waitingForWebhook ? 'Processing Subscription...' : 'Subscription Activated!'}</h1>
            <p>
              {waitingForWebhook 
                ? 'Please wait while we finalize your subscription and update your credits. This may take a few seconds.'
                : 'Your subscription has been successfully activated and your credits have been updated. You will be redirected to your account page shortly.'}
            </p>
            {!waitingForWebhook && (
              <button onClick={() => navigate('/account')} className="cta-button-primary">
                Go to Account
              </button>
            )}
          </>
        )}

        {status === 'canceled' && (
          <>
            <div className="result-icon canceled">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h1>Checkout Canceled</h1>
            <p>Your subscription checkout was canceled. No charges were made. You will be redirected to your account page shortly.</p>
            <button onClick={() => navigate('/account')} className="cta-button-primary">
              Go to Account
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="result-icon error">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h1>Unable to Process</h1>
            <p>We were unable to determine your subscription status. Please check your account page or contact support.</p>
            <button onClick={() => navigate('/account')} className="cta-button-primary">
              Go to Account
            </button>
          </>
        )}
      </div>
    </div>
  );
};

