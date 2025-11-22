# Credits Display - Usage Guide

## Overview

The credits display system has been implemented and is now visible in the navbar. Credits automatically refresh every 30 seconds and can be manually refreshed after operations.

## Features Implemented

✅ **Simple Red Badge** - Minimalist credit counter next to user menu  
✅ **Clickable Upgrade Prompt** - Shows upgrade dialog when clicked  
✅ **Pricing Page** - Full-featured pricing page with all plans  
✅ **Auto-refresh** - Updates every 30 seconds  
✅ **Low Credit Warning** - Pulses when balance < 10  
✅ **Responsive Design** - Adapts to mobile screens  
✅ **Context Provider** - Easy access from any component  

## Files Created/Modified

### New Files:
- `frontend/src/hooks/useCredits.ts` - Credits fetching hook
- `frontend/src/contexts/CreditsContext.tsx` - Context provider for app-wide access
- `frontend/src/pages/PricingPage.tsx` - Full pricing page with plan selection

### Modified Files:
- `frontend/src/App.tsx` - Wrapped app with CreditsProvider, added /pricing route
- `frontend/src/components/Navbar.tsx` - Added simple red credit badge with upgrade prompt
- `frontend/src/styles.css` - Added credit badge and pricing page styles

## Design

### Credit Badge
- **Position**: Next to user account icon in navbar (right side)
- **Style**: Simple red circular badge with white number
- **Behavior**: Clickable - shows upgrade prompt when balance < 100
- **Animation**: Pulses when credits < 10 (low credit warning)

### Upgrade Flow
1. User clicks credit badge
2. Shows confirmation dialog with current balance
3. If user confirms, redirects to `/pricing` page
4. User selects plan and clicks "Upgrade Now"
5. Redirects to Stripe Checkout
6. After payment, redirects back and credits are updated

## How to Use

### 1. Access Credits in Any Component

```typescript
import { useCreditsContext } from '../contexts/CreditsContext';

function YourComponent() {
  const { credits, loading, error, refetch } = useCreditsContext();
  
  if (loading) return <div>Loading credits...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <div>
      <p>Balance: {credits?.balance}</p>
      <p>Plan: {credits?.plan_name}</p>
    </div>
  );
}
```

### 2. Refresh Credits After Operations

After any analyze or edit operation, call `refetch()` to update the display:

```typescript
import { useCreditsContext } from '../contexts/CreditsContext';

function AnalyzeComponent() {
  const { refetch: refetchCredits } = useCreditsContext();
  
  const handleAnalyze = async () => {
    try {
      // Perform analysis
      const response = await fetch(`${config.backendUrl}/api/data/analyze`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: userQuery,
          dataset_id: datasetId
        })
      });
      
      const result = await response.json();
      
      // Refresh credits after successful operation
      await refetchCredits();
      
      return result;
    } catch (error) {
      console.error('Analysis failed:', error);
    }
  };
  
  return <button onClick={handleAnalyze}>Analyze Data</button>;
}
```

### 3. Check Credits Before Operation (Optional)

You can pre-check if user has enough credits:

```typescript
import { useCreditsContext } from '../contexts/CreditsContext';

function AnalyzeButton() {
  const { credits } = useCreditsContext();
  const requiredCredits = 5; // Cost of analyze operation
  
  const hasEnoughCredits = credits && credits.balance >= requiredCredits;
  
  return (
    <button 
      onClick={handleAnalyze}
      disabled={!hasEnoughCredits}
      title={!hasEnoughCredits ? 'Insufficient credits' : ''}
    >
      Create Dashboard ({requiredCredits} credits)
    </button>
  );
}
```

### 4. Display Low Credit Warning

```typescript
import { useCreditsContext } from '../contexts/CreditsContext';

function CreditWarning() {
  const { credits } = useCreditsContext();
  
  if (!credits || credits.balance >= 10) return null;
  
  return (
    <div className="credit-warning">
      ⚠️ Low credits! You have {credits.balance} credits remaining.
      <button onClick={() => window.location.href = '/upgrade'}>
        Upgrade Plan
      </button>
    </div>
  );
}
```

## Where to Add Refetch Calls

Add `refetchCredits()` calls after these operations:

### In Analyze Components:
```typescript
// After successful analysis
await analyzeData();
await refetchCredits(); // Refresh credit display
```

### In Edit Components:
```typescript
// After successful edit
await editChart();
await refetchCredits(); // Refresh credit display
```

### In Execute Code Components:
```typescript
// After successful code execution
await executeCode();
await refetchCredits(); // Refresh credit display
```

## Styling Customization

### Change Color Scheme

Edit `frontend/src/styles.css`:

```css
/* Change gradient colors */
.credits-display {
  background: linear-gradient(135deg, #YOUR_COLOR_1 0%, #YOUR_COLOR_2 100%);
}

/* Change low credit warning colors */
.credits-display.low-credits {
  background: linear-gradient(135deg, #YOUR_WARNING_1 0%, #YOUR_WARNING_2 100%);
}
```

### Adjust Position

In `Navbar.tsx`, the credits display is positioned between the logo and user menu. To change position, move the credits display JSX block.

### Change Refresh Interval

Edit `frontend/src/hooks/useCredits.ts`:

```typescript
// Change from 30 seconds to your preferred interval
const interval = setInterval(fetchCredits, 60000); // 60 seconds
```

## Error Handling

The system handles common errors:

- **401 Unauthorized**: Automatically logs user out and redirects
- **Network errors**: Shows error state without blocking UI
- **No credits initialized**: Shows 0 credits without error

## API Endpoint

The credits display fetches from:
```
GET /api/credits/balance
```

Response:
```json
{
  "balance": 25,
  "plan_name": "Free",
  "plan_id": 1,
  "credits_per_analyze": 5,
  "credits_per_edit": 2,
  "last_reset_at": "2024-01-15T00:00:00",
  "updated_at": "2024-01-20T15:30:00"
}
```

## Troubleshooting

### Credits Not Showing
1. Check if user is authenticated (token in localStorage)
2. Verify backend is running and `/api/credits/balance` endpoint works
3. Check browser console for errors

### Credits Not Updating After Operation
1. Ensure `refetchCredits()` is called after operation
2. Check if operation actually succeeded (status 200)
3. Verify backend is deducting credits correctly

### 401 Errors
- Token expired - user will be automatically logged out
- Check backend JWT configuration

## Next Steps

Consider adding:
- Credit purchase flow
- Upgrade to Pro/Ultra buttons
- Credit usage history view
- Low credit email notifications
- Credit usage analytics

## Support

For issues or questions:
- Check backend logs for credit deduction
- Verify Stripe webhook is processing correctly
- Check browser console for frontend errors

