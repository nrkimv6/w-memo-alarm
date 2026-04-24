# /settings - Design Prompt

Describe the `/settings` screen in terms of what the user should see and what the user should be able to control. Layout, component choices, interaction patterns, and implementation details are up to the builder.

---

## Principles

- The screen should feel mobile-first.
- Most settings on this screen feel personal to the current device.
- When a setting change affects existing memos or todos, that impact should be visible at the moment the user makes the change.

---

## Theme

- The currently selected appearance mode is visible.
- The user can choose between Light, Dark, and System.
- When System is selected, the currently applied appearance is visible.
- When the device appearance changes, the applied appearance updates automatically.

## Cloud Sign-In

- It is clear whether the user is signed in or signed out.
- When signed in, the user's display name and email are visible.
- If sign-in fails, an error message is visible.
- The user can sign in with Google.
- The user can sign in with Kakao.
- The user can sign out.
- When signed in, there is a clear message that memos and folders stay in sync with the cloud.
- There is a clear message that the settings on this screen stay on the current device.

## Default Reminders

- The user can turn automatic default reminders for new memos on or off.
- The user can set the default reminder time.
- The user can select multiple repeat days from Sunday through Saturday.
- The number of memos currently following the default reminder is visible.
- If the default reminder time or days change, there is a visible explanation that all memos using the default reminder will change as well.
- In the web environment, there is a visible note that background notification delivery may be limited.

## Memo Lock (PIN)

- It is clear whether a PIN is currently set.
- The user can create a new PIN.
- The user can change the PIN.
- The user can remove the PIN.
- PIN input accepts only 4 to 8 digits.
- While entering a PIN, the user can switch between hidden and visible digits.
- When creating or changing a PIN, the user goes through a confirmation step by entering it again.
- When changing or removing a PIN, the current PIN must be entered correctly first.
- After creating or changing a PIN, there is a period of time where locked content stays unlocked without asking again immediately.

## Memo Display

- The user can turn Markdown rendering in memo content on or off.
- When Markdown rendering is enabled, a small example shows what kinds of formatting are supported: headings, bold, italic, lists, and inline code.

## Todo Defaults

- The total number of todos is visible.
- The user can turn daily reminder notifications for todos on or off.
- The user can set the global reminder time.
- The user can turn automatic alerts before due time on or off.
- The user can choose the automatic alert timing from: 30 minutes before, 1 hour before, 3 hours before, 1 day before, 3 days before, 1 week before.
- The user can turn overdue emphasis on or off.
- The user can turn progress display on or off.
- The user can turn upcoming todo suggestions on empty states on or off.
- If the global reminder time changes, there is a visible explanation that all todos using the shared reminder time will change as well.
- If the automatic alert timing changes, there is a visible explanation that all todos using the shared alert timing will change as well.

## Notification Management

- All memo reminders are visible, grouped by reminder time.
- The user can turn an entire time group on or off at once.
- The user can turn all reminders off at once.
- Each item shows the memo title.
- Each item shows whether it is a repeating reminder or a one-time reminder.
- Repeating reminders show their repeat days.
- One-time reminders show their date.
- Each item provides a way to open the related memo for editing.
- If there are no reminders, an empty-state message is visible.

## Data Management

- The total number of memos is visible.
- The user can export all memos, folders, and default reminder settings as one backup file.
- The exported file name includes the export date.
- The user can import a backup file and restore its contents.
- If the selected file is not valid, an error message is visible.
- While importing, a progress state is visible.
- If the same memo exists in both places, there is a visible explanation that the newer version is kept.
- The restored scope is explained clearly: memos, folders, default reminder time, default reminder days, and automatic reminders for new memos.
- The non-restored scope is explained clearly: todo defaults, Markdown setting, theme, PIN, and sign-in session.

## Destructive Actions

- The user can delete all memos and folders at once.
- Before deletion, the user goes through a confirmation step that makes the action feel irreversible.
- It is clearly explained what remains even after deletion: settings on this screen, theme, PIN, and sign-in session.

## App Info

- The app version is visible.
- The user can check for updates and refresh to the latest version.
- While update checking or applying is in progress, a progress state is visible.
- If the version label is tapped repeatedly within a short time, developer mode opens.

## Developer Mode

The following areas appear only when developer mode is open.

### Notification Permission

- The current browser notification permission state is visible.
- The user can request browser notification permission.

### Instant Notification Test

- The user can send an instant test notification.
- The user can manually trigger a reminder check once.

### Native App Notification Test

The following items appear only in the native app environment.

- The native notification permission state is visible.
- The user can request native notification permission.
- The user can choose a delay for a test notification from: 5 seconds, 10 seconds, 30 seconds, 1 minute, 2 minutes.
- The user can schedule a test notification with the selected delay.
- A list of scheduled native notifications is visible.
- The user can cancel all scheduled native notifications.

### Web Notification Test

- The user can send an instant web test notification.
- The user can send a delayed web test notification.
- The user can choose the delay for the test.

### Background Reminder Schedule

- A list of memo reminders registered for background delivery is visible.
- Each item shows the memo title, reminder time, and reminder type.
- It is visible whether the background schedule is currently active.
- The user can register the background schedule again.

### Web Push Diagnostics

- It is visible whether web push setup looks healthy.
- It is visible whether the client and server appear to be aligned.
- If they do not appear aligned, a warning is visible.
- The number of active device tokens for the signed-in user is visible.
- The most recent successful delivery time and failed delivery time are visible.
- If there was a recent failure, the latest server error message is visible.
- If specific push setup problems are detected, each problem appears as its own warning.
- The signed-in user can register the device token again.
- The user can refresh the diagnostic information.

### Internal Logs

- The user can inspect internal notification-related logs.
- Logs can be filtered by notification events, background events, or all events.
- Each log item shows time, severity, source, and message.
- The user can clear all logs.

### Status Diagnostics

- It is visible whether the notification system has been initialized.
- Counts for today's reminders, upcoming reminders, completed reminders, and snoozed reminders are visible.
- It is visible whether background notifications are supported on the current device.
- It is visible whether notification features are supported on the current device.
- It is visible whether the app is currently running in a native environment.
