# Account Management System

## Overview
Complete account management system with user profile, logout functionality, and account settings page.

## Features

### 1. **User Menu in Navbar**
- Displays user avatar (profile picture or initial)
- Shows user name
- Dropdown menu with:
  - User info (name and email)
  - Account Settings link
  - Logout button

### 2. **Account Settings Page**
- View profile information:
  - Profile picture
  - Email address
  - Name (editable)
  - OAuth provider
  - Member since date
  - Account status

- Edit profile:
  - Update display name

- Danger zone:
  - Deactivate account (soft delete)

### 3. **Backend API Endpoints**

#### `GET /api/auth/me`
Get current user's profile information.

**Response:**
```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "John Doe",
  "picture": "https://...",
  "provider": "google",
  "is_active": true,
  "created_at": "2025-10-11T..."
}
```

#### `PATCH /api/auth/me`
Update user profile.

**Request:**
```json
{
  "name": "New Name"
}
```

**Response:**
```json
{
  "message": "Profile updated successfully",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "New Name",
    "picture": "https://..."
  }
}
```

#### `DELETE /api/auth/me`
Deactivate user account (soft delete).

**Response:**
```json
{
  "message": "Account deactivated successfully",
  "success": true
}
```

#### `POST /api/auth/logout`
Logout user.

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

## Frontend Components

### `Account.tsx`
Full-page account management component with:
- Profile display
- Edit functionality
- Account deactivation
- Error handling
- Loading states

**Props:**
- `onClose?: () => void` - Optional callback to close the account page

### `Navbar.tsx`
Updated navbar with user menu dropdown.

**Props:**
- `onAccountClick?: () => void` - Callback when "Account Settings" is clicked

### `App.tsx`
Updated to handle account page routing via state management.

**New State:**
- `showAccount: boolean` - Controls whether to show account page

## Usage

### Navigate to Account Settings
1. Click on user avatar/name in navbar
2. Click "Account Settings" in dropdown menu
3. Account page opens as an overlay

### Update Profile
1. Go to Account Settings
2. Click "Edit" next to name field
3. Enter new name
4. Click "Save"

### Logout
1. Click on user avatar/name in navbar
2. Click "Logout" in dropdown menu
3. Token is cleared and user is redirected to landing page

### Deactivate Account
1. Go to Account Settings
2. Scroll to "Danger Zone"
3. Click "Deactivate Account"
4. Confirm in dialog
5. Account is deactivated and user is logged out

## Styling

All styles are in `frontend/src/styles.css`:

**Key CSS Classes:**
- `.user-menu` - User menu container
- `.user-menu-button` - Avatar and name button
- `.user-menu-dropdown` - Dropdown menu
- `.user-avatar` - Profile picture
- `.user-avatar-placeholder` - Initial circle
- `.account-container` - Account page container
- `.account-card` - Account settings card
- `.danger-zone` - Deactivation section

**Responsive Design:**
- On mobile (<768px), user name is hidden in navbar
- Account page is fully responsive
- Edit actions stack vertically on mobile

## Security

1. **Authentication Required:** All endpoints require valid JWT token
2. **User Scoping:** Users can only access/modify their own data
3. **Soft Delete:** Account deactivation doesn't delete data, just sets `is_active = false`
4. **Token Cleanup:** Logout clears both localStorage and sessionStorage

## User Experience

### Visual Feedback
- Hover states on all interactive elements
- Loading indicators during API calls
- Error messages for failed operations
- Success confirmations for updates

### Animations
- Dropdown menu slides down smoothly
- Hover transitions on buttons
- Smooth color transitions

### Accessibility
- ARIA labels on buttons
- Keyboard navigation support
- Focus states on inputs
- Clear visual hierarchy

## Testing

### Manual Testing Checklist

**User Menu:**
- [ ] Avatar displays correctly
- [ ] Name shows in navbar (desktop only)
- [ ] Dropdown opens/closes on click
- [ ] Dropdown closes when clicking outside
- [ ] Email displays correctly in dropdown

**Account Page:**
- [ ] Profile info loads correctly
- [ ] Profile picture displays
- [ ] All fields show correct data
- [ ] Edit mode works
- [ ] Name can be updated
- [ ] Cancel button resets changes
- [ ] Loading states display
- [ ] Error messages appear for failures

**Logout:**
- [ ] Logout clears token
- [ ] Redirects to landing page
- [ ] User menu disappears
- [ ] Can't access protected routes

**Account Deactivation:**
- [ ] Confirmation dialog appears
- [ ] Canceling keeps account active
- [ ] Confirming deactivates account
- [ ] User is logged out after deactivation
- [ ] Deactivated user can't log in

## Future Enhancements

1. **Profile Picture Upload:** Allow users to upload custom avatars
2. **Email Verification:** Add email verification flow
3. **Password Management:** For non-OAuth users
4. **Two-Factor Authentication:** Add 2FA support
5. **Connected Accounts:** Link multiple OAuth providers
6. **Activity Log:** Show recent account activity
7. **Data Export:** GDPR-compliant data export
8. **Account Recovery:** Reactivation flow for deactivated accounts
9. **Notification Preferences:** Email notification settings
10. **Theme Preferences:** Dark mode toggle

## Notes

- Account deactivation is reversible (soft delete)
- Profile pictures come from OAuth provider
- Name editing is the only mutable field currently
- All user actions are authenticated via JWT
- Session data is cleared completely on logout

