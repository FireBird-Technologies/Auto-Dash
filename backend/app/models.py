from sqlalchemy import String, Integer, Boolean, ForeignKey, DateTime, Text, JSON, Numeric, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from decimal import Decimal
import enum
from .db import Base


class TransactionType(str, enum.Enum):
    """Credit transaction types"""
    RESET = "reset"
    DEDUCT = "deduct"
    REFUND = "refund"
    ADJUSTMENT = "adjustment"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    picture: Mapped[str | None] = mapped_column(String(512), nullable=True)
    provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    provider_id: Mapped[str | None] = mapped_column(String(255), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    subscriptions: Mapped[list["Subscription"]] = relationship(back_populates="user")
    datasets: Mapped[list["Dataset"]] = relationship(back_populates="user")
    credits: Mapped["UserCredits"] = relationship(back_populates="user", uselist=False)
    credit_transactions: Mapped[list["CreditTransaction"]] = relationship(back_populates="user")
    dashboard_queries: Mapped[list["DashboardQuery"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    chat_messages: Mapped[list["ChatMessage"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    public_dashboards: Mapped[list["PublicDashboard"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    plan_id: Mapped[int | None] = mapped_column(ForeignKey("subscription_plans.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="inactive")
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    current_period_start: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped[User] = relationship(back_populates="subscriptions")
    plan: Mapped["SubscriptionPlan"] = relationship(back_populates="subscriptions")


class Dataset(Base):
    __tablename__ = "datasets"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    dataset_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    
    # Basic metadata
    filename: Mapped[str] = mapped_column(String(255))
    row_count: Mapped[int] = mapped_column(Integer)
    column_count: Mapped[int] = mapped_column(Integer)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    
    # Dataset context from DSPy (rich description)
    context: Mapped[str | None] = mapped_column(Text, nullable=True)
    context_generated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    
    # Column metadata as JSON
    columns_info: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # Store: {"columns": [...], "dtypes": {...}, "statistics": {...}}
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Status tracking
    context_status: Mapped[str] = mapped_column(String(50), default="pending")
    # Values: "pending", "generating", "completed", "failed"
    
    user: Mapped[User] = relationship(back_populates="datasets")
    dashboard_queries: Mapped[list["DashboardQuery"]] = relationship(back_populates="dataset", cascade="all, delete-orphan")
    chat_messages: Mapped[list["ChatMessage"]] = relationship(back_populates="dataset", cascade="all, delete-orphan")
    public_dashboards: Mapped[list["PublicDashboard"]] = relationship(back_populates="dataset", cascade="all, delete-orphan")


class DashboardQuery(Base):
    __tablename__ = "dashboard_queries"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    dataset_id: Mapped[int] = mapped_column(ForeignKey("datasets.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    
    query: Mapped[str] = mapped_column(Text)  # User's request
    query_type: Mapped[str] = mapped_column(String(50))  # "analyze", "edit", "add"
    dashboard_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    charts_data: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)  # Array of chart objects with code, figure, etc.
    background_color: Mapped[str | None] = mapped_column(String(7), nullable=True, default="#ffffff")  # Hex color code
    text_color: Mapped[str | None] = mapped_column(String(7), nullable=True, default="#1a1a1a")  # Hex color code for text
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    
    dataset: Mapped["Dataset"] = relationship(back_populates="dashboard_queries")
    user: Mapped["User"] = relationship(back_populates="dashboard_queries")


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    dataset_id: Mapped[int] = mapped_column(ForeignKey("datasets.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    
    role: Mapped[str] = mapped_column(String(20))  # "user", "assistant"
    content: Mapped[str] = mapped_column(Text)
    query_type: Mapped[str | None] = mapped_column(String(50), nullable=True)  # "edit", "add", "data_analysis", "general_qa", "need_clarity", etc.
    code: Mapped[str | None] = mapped_column(Text, nullable=True)  # Executable code if applicable
    chart_index: Mapped[int | None] = mapped_column(Integer, nullable=True)  # If related to a chart
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    
    dataset: Mapped["Dataset"] = relationship(back_populates="chat_messages")
    user: Mapped["User"] = relationship(back_populates="chat_messages")


class PublicDashboard(Base):
    __tablename__ = "public_dashboards"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    dataset_id: Mapped[int] = mapped_column(ForeignKey("datasets.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    
    share_token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    figures_data: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)  # Array of chart figures
    dashboard_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    background_color: Mapped[str | None] = mapped_column(String(7), nullable=True, default="#ffffff")  # Hex color code
    text_color: Mapped[str | None] = mapped_column(String(7), nullable=True, default="#1a1a1a")  # Hex color code for text
    container_colors: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # Container-specific colors
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    dataset: Mapped["Dataset"] = relationship(back_populates="public_dashboards")
    user: Mapped["User"] = relationship(back_populates="public_dashboards")


class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    stripe_price_id: Mapped[str | None] = mapped_column(String(255), nullable=True)  # Legacy field, use stripe_price_id_monthly
    stripe_price_id_monthly: Mapped[str | None] = mapped_column(String(255), nullable=True)
    stripe_price_id_yearly: Mapped[str | None] = mapped_column(String(255), nullable=True)
    stripe_product_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    price_monthly: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0.0)
    price_yearly: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    
    # Credit configuration
    credits_per_month: Mapped[int] = mapped_column(Integer, default=0)
    credits_per_analyze: Mapped[int] = mapped_column(Integer, default=5)
    credits_per_edit: Mapped[int] = mapped_column(Integer, default=2)
    
    # Extensible features as JSON
    features: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    
    # Plan management
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    subscriptions: Mapped[list["Subscription"]] = relationship(back_populates="plan")
    user_credits: Mapped[list["UserCredits"]] = relationship(back_populates="plan")


class UserCredits(Base):
    __tablename__ = "user_credits"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, index=True)
    plan_id: Mapped[int | None] = mapped_column(ForeignKey("subscription_plans.id"), nullable=True)
    balance: Mapped[int] = mapped_column(Integer, default=0)
    last_reset_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user: Mapped[User] = relationship(back_populates="credits")
    plan: Mapped["SubscriptionPlan"] = relationship(back_populates="user_credits")


class CreditTransaction(Base):
    __tablename__ = "credit_transactions"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    amount: Mapped[int] = mapped_column(Integer)  # Can be negative for deductions
    transaction_type: Mapped[TransactionType] = mapped_column(Enum(TransactionType), index=True)
    description: Mapped[str] = mapped_column(Text)
    transaction_metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    user: Mapped[User] = relationship(back_populates="credit_transactions")


