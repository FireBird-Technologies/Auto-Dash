# Routing and Subscription Updates

## Overview
Major updates to implement proper routing with React Router and integrate subscription information into the account management system.

## Changes Implemented

### 1. **React Router Integration**

#### Added Dependency
- `react-router-dom` v6.20.0 added to `package.json`

#### New Route Structure

**Routes:**
- `/` - Landing page (public)
- `/visualize` - Visualization wizard (requires authentication)
- `/account` - Account settings page (requires authentication)

**Authentication Guards:**
- Unauthenticated users trying to access `/visualize` or `/account` are redirected to `/`
- OAuth callback redirects to `/visualize` instead of showing wizard on main page

#### New Components

**`frontend/src/pages/VisualizePage.tsx`**
- Extracted visualization wizard from App.tsx
- Contains the 3-step wizard (Connect Data, Style Context, Visualization)
- Progress bar included
- Self-contained state management

**Updated `frontend/src/App.tsx`**
- Now uses React Router for navigation
- `AuthHandler` component handles OAuth callback
- `AppRoutes` component manages route configuration
- Protected routes with authentication checks
- Cleaner separation of concerns

### 2. **Subscription Information Integration**

#### Backend Changes (`backend/app/routes/auth.py`)

**Updated `GET /api/auth/me` endpoint:**
```python
{
  "id": 1,
  "email": "user@example.com",
  "name": "John Doe",
  "picture": "https://...",
  "provider": "google",
  "is_active": true,
  "created_at": "2025-10-11T...",
  "subscription": {
    "tier": "free",  // or "pro", "enterprise"
    "status": "active",  // or "inactive"
    "stripe_customer_id": "cus_...",
    "stripe_subscription_id": "sub_...",
    "created_at": "2025-10-11T..."
  }
}
```

**Features:**
- Fetches user's most recent subscription from database
- Returns subscription tier and status
- Defaults to "free" tier if no subscription exists
- Includes Stripe customer and subscription IDs

#### Frontend Changes (`frontend/src/components/Account.tsx`)

**New Subscription Section:**
- Displays current subscription tier (Free, Pro, Enterprise)
- Shows subscription status badge (Active/Inactive)
- Action button:
  - "Upgrade Plan" for free tier users
  - "Manage Subscription" for paying users
- Benefits list for free tier users showing what they get with Pro
- Subscription start date display

**Subscription Benefits (Free → Pro):**
- ✨ Unlimited visualizations
- 📊 Advanced chart types
- 🔄 Real-time data updates
- 💾 Persistent data storage
- 🎨 Custom themes and branding
- 🚀 Priority support

#### CSS Styling (`frontend/src/styles.css`)

**New Classes:**
- `.subscription-section` - Section container
- `.subscription-card` - Card with gradient background
- `.subscription-header` - Tier name and action button
- `.subscription-tier` - Large tier name (e.g., "Free Plan")
- `.subscription-status` - Status display with badge
- `.subscription-benefits` - Benefits list container
- `.subscription-footer` - Subscription date info

**Responsive:**
- Subscription header stacks vertically on mobile
- Button becomes full-width on mobile devices

## User Flow Changes

### Before (Old Flow)
```
Login → Main Page (Shows wizard immediately)
```

### After (New Flow)
```
Login → Redirected to /visualize → Wizard shown
Landing page → Click "Get Started" → /visualize
Account menu → Click "Account Settings" → /account page
```

## Navigation

### Programmatic Navigation
All navigation now uses React Router's `navigate()`:

```typescript
// In components
const navigate = useNavigate();

// Navigate to visualize
navigate('/visualize');

// Navigate to account
navigate('/account');

// Go back
navigate(-1);
```

### URL Structure
- Clean URLs: `/visualize`, `/account`
- Browser back/forward buttons work properly
- Bookmarkable pages
- Deep linking support

## OAuth Callback Flow

### New Implementation
1. User clicks "Get Started with Google"
2. `auth_callback` flag set in sessionStorage
3. Redirects to Google OAuth
4. Google redirects back with token in query params
5. `AuthHandler` component detects callback
6. Token stored in localStorage
7. **User automatically redirected to `/visualize`**
8. Query params cleaned from URL

### Code
```typescript
function AuthHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const token = urlParams.get('token');
    
    if (token && sessionStorage.getItem('auth_callback')) {
      localStorage.setItem('auth_token', token);
      sessionStorage.removeItem('auth_callback');
      navigate('/visualize', { replace: true });
    }
  }, [navigate, location]);

  return null;
}
```

## Subscription Management

### Current Implementation
- Shows subscription info from database
- Button links to `/api/payment/portal` (Stripe Customer Portal)
- Free tier users see upgrade benefits
- Paying users can manage their subscription

### Future Enhancements
1. **Inline Plan Selection:** Choose plans without leaving the app
2. **Usage Metrics:** Show current usage vs. plan limits
3. **Billing History:** Display past invoices
4. **Team Management:** Add team members (for enterprise)
5. **Feature Comparisons:** Side-by-side plan comparison
6. **Trial Management:** Free trial countdown and conversion

## Testing Checklist

### Routing
- [ ] Landing page loads at `/`
- [ ] "Get Started" button navigates to `/visualize`
- [ ] Unauthenticated users redirected from protected routes
- [ ] OAuth callback redirects to `/visualize`
- [ ] Account menu navigates to `/account`
- [ ] Browser back button works correctly
- [ ] Direct URL navigation works
- [ ] 404 redirects to home

### Subscription Display
- [ ] Subscription tier displays correctly
- [ ] Status badge shows correct state
- [ ] Free tier shows benefits list
- [ ] Paid tier shows manage button
- [ ] Button links to payment portal
- [ ] Subscription date displays when available
- [ ] Handles missing subscription gracefully
- [ ] Responsive on mobile devices

## Database Schema

No changes required. Uses existing `Subscription` model:
```python
class Subscription(Base):
    id: int
    user_id: int
    status: str  # Used as "tier" in response
    stripe_customer_id: str | None
    stripe_subscription_id: str | None
    created_at: datetime
```

## API Endpoints

### Modified Endpoints

**`GET /api/auth/me`**
- Now includes subscription information
- Queries Subscription table
- Returns full user profile with subscription

### No New Endpoints
All subscription management uses existing Stripe integration.

## Security

1. **Route Protection:** Private routes check for valid JWT token
2. **API Security:** All endpoints require authentication
3. **Subscription Validation:** Backend validates subscription status
4. **Stripe Integration:** Uses secure Stripe Customer Portal for payments

## Migration Notes

### For Users
- No action required
- Existing users default to "free" tier
- Bookmarked URLs to old structure redirect to new routes

### For Developers
- Run `npm install` in frontend directory
- Restart frontend dev server
- No database migration needed
- Backend changes are backward compatible

## Browser Support
- All modern browsers (Chrome, Firefox, Safari, Edge)
- Requires JavaScript enabled
- HTML5 History API support (all modern browsers)

## Performance
- Code splitting: Landing page loads separately from wizard
- Lazy loading: Routes loaded on demand
- No performance impact from routing
- Subscription data fetched once per session

## Accessibility
- Semantic HTML in route components
- Focus management on navigation
- Screen reader compatible
- Keyboard navigation support

## Known Limitations
1. No in-app payment processing (uses Stripe portal)
2. Subscription status not real-time (requires page refresh)
3. No webhook handling for subscription updates yet
4. Single subscription per user (no team subscriptions)

## Future Improvements

### Routing
1. Add loading states during navigation
2. Implement route transitions/animations
3. Add breadcrumb navigation
4. Persist wizard state across page refreshes

### Subscriptions
1. Real-time subscription updates via webhooks
2. Stripe Checkout integration for seamless upgrade
3. Subscription analytics dashboard
4. Usage tracking and limits enforcement
5. Promo code/coupon support
6. Team/organization subscriptions

## Related Files

**Modified:**
- `frontend/package.json` - Added react-router-dom
- `frontend/src/App.tsx` - Router setup
- `frontend/src/components/Account.tsx` - Subscription UI
- `frontend/src/styles.css` - Subscription styles
- `backend/app/routes/auth.py` - Subscription endpoint

**Created:**
- `frontend/src/pages/VisualizePage.tsx` - Wizard page

**Documentation:**
- `ROUTING_AND_SUBSCRIPTION_UPDATE.md` - This file

