# Visualization Fix System - Complete Update

## Overview
This document describes the comprehensive improvements made to the visualization fix system, including separating the notification UI and implementing immediate display of fixed visualizations.

## Changes Made

### 1. Separate Notification Component

**New File: `frontend/src/components/FixNotification.tsx`**
- Created a standalone, reusable notification component
- Features:
  - Dismissible with cross button
  - Positioned as a side notification (fixed top-right)
  - Uses Autodash aesthetic (gradient background, smooth animations)
  - Animated spinner to indicate processing
  - Slide-in animation for better UX

### 2. Backend Updates

#### `backend/app/schemas/chat.py`
- Added `dataset_id` field to `FixVisualizationRequest`:
  ```python
  class FixVisualizationRequest(BaseModel):
      plotly_code: str
      error_message: str
      dataset_id: Optional[str] = None
  ```

#### `backend/app/routes/data.py`
- Updated `/api/data/fix-visualization` endpoint:
  - Imports `execute_plotly_code` from `chart_creator`
  - Imports `clean_plotly_code` from `agents`
  - Uses `clean_plotly_code` to properly clean the fixed code
  - Executes the fixed code when `dataset_id` is provided
  - Returns both the fixed code AND the executed figure data:
    ```python
    return {
        "fixed_complete_code": stitched_code,
        "figure": figure_data,           # NEW
        "execution_success": execution_success,  # NEW
        "user_id": current_user.id,
        "fix_failed": False
    }
    ```
  - Keeps using `anthropic/claude-3-7-sonnet-latest` model (as requested)

### 3. Frontend Updates

#### `frontend/src/components/PlotlyChartRenderer.tsx`
- Added new props:
  - `datasetId?: string` - for executing fixed code
  - `onFixingStatusChange?: (isFixing: boolean) => void` - callback to parent
- Removed local notification UI (now in separate component)
- Updated `attemptFix` function:
  - Passes `dataset_id` to backend
  - Notifies parent of fixing status via callback
  - Immediately displays the fixed figure when received:
    ```typescript
    if (result.figure) {
      setFigureData(result.figure);
      setRenderError(null);
    }
    ```

#### `frontend/src/components/steps/Visualization.tsx`
- Imported `FixNotification` component
- Added `showFixNotification` state
- Updated `handleChartFixed` to dismiss notification
- Added `FixNotification` to render:
  ```tsx
  <FixNotification 
    show={showFixNotification} 
    onDismiss={() => setShowFixNotification(false)} 
  />
  ```
- Updated all `PlotlyChartRenderer` calls (both fullscreen and regular):
  ```tsx
  <PlotlyChartRenderer 
    chartSpec={spec} 
    data={localData}
    chartIndex={index}
    datasetId={datasetId}  // NEW
    onChartFixed={handleChartFixed}
    onFixingStatusChange={(isFixing) => setShowFixNotification(isFixing)}  // NEW
  />
  ```

## Key Improvements

### 1. Separation of Concerns
- Notification logic is now separate from chart rendering
- Can be reused in other parts of the application
- Easier to maintain and test

### 2. Immediate Visualization Updates
- Fixed charts are now displayed **immediately** without page refresh
- No more `fig.show()` calls that open new tabs
- Backend executes the fixed code and returns the figure JSON
- Frontend displays the figure as soon as it's received

### 3. Better User Experience
- Notification is dismissible by the user
- Positioned out of the way (top-right corner)
- Automatically dismisses when fix completes
- Clear visual feedback throughout the process

### 4. Maintains Original Behavior
- Still uses Claude model (`claude-3-7-sonnet-latest`)
- Still uses `dspy.Refine` with N=3
- Still only attempts fix once per chart
- Infinite loop prevention remains intact

## Flow Diagram

```
Chart Render Error
       ↓
Check if fix attempted
       ↓ (first time)
Show Notification ──────→ User can dismiss
       ↓
Call /api/data/fix-visualization
       ↓
Backend:
  - Extract error context
  - Use Claude + dspy.Refine
  - Clean the fixed code
  - Execute fixed code with dataset
  - Return {fixed_code, figure}
       ↓
Frontend:
  - Dismiss notification
  - Display figure immediately
  - Update chart spec
```

## Testing Checklist

- [ ] Notification appears when fix starts
- [ ] Notification can be dismissed by user
- [ ] Notification auto-dismisses when fix completes
- [ ] Fixed chart displays immediately (no page refresh)
- [ ] No `fig.show()` opens new tabs
- [ ] Fix only attempted once per chart
- [ ] Works in both fullscreen and regular view
- [ ] Error states handled gracefully
- [ ] Claude model is being used (check logs)

## Files Modified

1. `frontend/src/components/FixNotification.tsx` (NEW)
2. `frontend/src/components/PlotlyChartRenderer.tsx`
3. `frontend/src/components/steps/Visualization.tsx`
4. `backend/app/schemas/chat.py`
5. `backend/app/routes/data.py`

## Notes

- The notification uses the same gradient and colors as other Autodash UI elements
- The fix attempt logic with `fixAttemptedRef` and `lastChartIndexRef` remains unchanged
- All error handling and logging is preserved
- The system gracefully handles cases where dataset_id is not provided

