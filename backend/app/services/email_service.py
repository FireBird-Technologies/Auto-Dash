"""
Email service abstraction for sending transactional emails.
Supports multiple email providers (Unosend, Resend, SendGrid, etc.)

Architecture:
- Strategy Pattern: BaseEmailProvider defines the interface
- Factory Pattern: EmailService creates the appropriate provider
- Dependency Injection: Providers can be injected for testing

To add a new email provider:
1. Create a class that inherits from BaseEmailProvider
2. Implement the send_email() method
3. Add the provider to _create_provider() in EmailService
4. Set EMAIL_PROVIDER environment variable

Example:
    from app.services.email_service import email_service
    
    await email_service.send_welcome_email(
        to_email="user@example.com",
        user_name="John Doe"
    )
"""
import os
import logging
import asyncio
from abc import ABC, abstractmethod
from typing import Optional
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import httpx
from jinja2 import Environment, FileSystemLoader, select_autoescape
from unosend import Unosend

logger = logging.getLogger(__name__)

# Thread pool for running sync Unosend client in async context
_executor = ThreadPoolExecutor(max_workers=3)


class EmailServiceError(Exception):
    """Base exception for email service errors"""
    pass


class BaseEmailProvider(ABC):
    """Abstract base class for email providers"""
    
    @abstractmethod
    async def send_email(
        self,
        to: str,
        subject: str,
        html_content: str,
        from_email: Optional[str] = None
    ) -> None:
        """
        Send an email
        
        Args:
            to: Recipient email address
            subject: Email subject
            html_content: HTML content of the email
            from_email: Sender email (defaults to configured from_email)
        
        Raises:
            EmailServiceError: If email sending fails
        """
        pass


class UnosendEmailProvider(BaseEmailProvider):
    """Unosend email provider implementation using official SDK"""
    
    def __init__(self, api_key: str, from_email: str):
        """
        Initialize Unosend provider
        
        Args:
            api_key: Unosend API key
            from_email: Default sender email address
        """
        self.api_key = api_key
        self.from_email = from_email
        self.client = None
        
        if not self.api_key:
            logger.warning("UNOSEND_API_KEY not set - email sending will be disabled")
        else:
            self.client = Unosend(api_key=api_key)
    
    async def send_email(
        self,
        to: str,
        subject: str,
        html_content: str,
        from_email: Optional[str] = None
    ) -> None:
        """Send an email using Unosend SDK (runs sync client in thread pool)"""
        if not self.api_key or not self.client:
            error_msg = "Cannot send email: UNOSEND_API_KEY not configured"
            logger.error(error_msg)
            raise EmailServiceError(error_msg)
        
        from_addr = from_email or self.from_email
        
        try:
            # Run synchronous Unosend client in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                _executor,
                lambda: self.client.emails.send(
                    from_address=from_addr,
                    to=to,
                    subject=subject,
                    html=html_content
                )
            )
            
            # Check response status
            if hasattr(response, 'status_code') and response.status_code >= 400:
                error_msg = f"Unosend API error (status {response.status_code})"
                if hasattr(response, 'data'):
                    error_msg += f": {response.data}"
                logger.error(error_msg)
                raise EmailServiceError(error_msg)
            
            logger.info(f"Email sent successfully to {to}")
            return
                    
        except Exception as e:
            error_msg = f"Error sending email to {to}: {str(e)}"
            logger.error(error_msg, exc_info=True)
            raise EmailServiceError(error_msg)


class EmailService:
    """
    Email service abstraction layer.
    Provides a consistent interface regardless of the underlying provider.
    """
    
    def __init__(self, provider: Optional[BaseEmailProvider] = None):
        """
        Initialize email service
        
        Args:
            provider: Optional email provider instance (for testing/DI)
        """
        if provider:
            self.provider = provider
        else:
            self.provider = self._create_provider()
        
        # Initialize Jinja2 template environment
        template_dir = Path(__file__).parent.parent / "templates" / "emails"
        template_dir.mkdir(parents=True, exist_ok=True)
        
        self.jinja_env = Environment(
            loader=FileSystemLoader(str(template_dir)),
            autoescape=select_autoescape(['html', 'xml'])
        )
    
    def _create_provider(self) -> BaseEmailProvider:
        """
        Create email provider based on EMAIL_PROVIDER configuration.
        Defaults to 'unosend' if not specified.
        """
        provider_name = os.getenv('EMAIL_PROVIDER', 'unosend').lower()
        
        if provider_name == 'unosend':
            return UnosendEmailProvider(
                api_key=os.getenv('UNOSEND_API_KEY', ''),
                from_email=os.getenv('EMAIL_FROM_ADDRESS', 'noreply@autodash.com')
            )
        else:
            raise ValueError(
                f"Unknown email provider: {provider_name}. "
                f"Supported providers: unosend"
            )
    
    async def send_welcome_email(
        self,
        to_email: str,
        user_name: Optional[str] = None
    ) -> None:
        """
        Send a welcome email to a new user.
        
        Args:
            to_email: Recipient email address
            user_name: User's name (optional)
        
        Raises:
            EmailServiceError: If email sending fails
        """
        try:
            template = self.jinja_env.get_template("welcome.html")
            html_content = template.render(user_name=user_name or "there")
            
            await self.provider.send_email(
                to=to_email,
                subject="Welcome to AutoDash!",
                html_content=html_content
            )
            
            logger.info(f"Welcome email sent to {to_email}")
            
        except Exception as e:
            logger.error(f"Failed to send welcome email to {to_email}: {e}")
            raise EmailServiceError(f"Failed to send welcome email: {e}")
    
# Singleton instance
email_service = EmailService()
