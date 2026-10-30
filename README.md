# Liftlog

A simple gym workout tracker that runs in your phone's browser and installs to your home screen like an app. It works offline and keeps all your data on your own phone.

**Open the app:** https://gayan-kangaraarachchi.github.io/liftlog/

---

## Features

### Plans and routines
- **Paste your coach's plan.** Copy the whole message (WhatsApp, Slack and similar), paste it, and every day loads at once with its warm-ups, exercises, cool-down and YouTube links.
- **Bulk add.** Tap *Start an empty workout*, then *Add bulk workouts*, paste the plan and tap **Include**.
- **Plans are grouped** on the Routines tab, for example "Week 1-8" and "Week 8-16".
- **Expire a plan.** Use the *Plan expired* tickbox in Edit, or the *Expire* button on the Routines tab, to hide an old plan from the Train tab without deleting it. *Make active* brings it back.
- **Remove a plan.** Deletes every day in the plan. Your logged workouts are kept.
- **Edit any day.** Change exercises, sets, reps, rest time, order, warm-ups, cool-downs and video links.
- **Optional walks.** When pasting, you can add a 10-minute walk before and a 30-minute incline walk after each day.

### Training
- **Week progress.** The Train tab shows this week's percentage, a progress bar and a ✓ for each day done.
- **Finished days are hidden** for the rest of the week. When every day is done you see *Week complete*. Days come back every Monday, and *Show done this week* lets you repeat one.
- **Warm-up and cool-down checklists** with a ▶ Video button for each move.
- **Set logging.** Enter weight (kg) and reps, tick each set, and see what you lifted last time.
- **Rest timer.** Starts when you tick a set, with −15 s, +15 s and Skip, and beeps and vibrates when rest is over.
- **Timed cardio.** A *Start* button for timed items such as a 10-minute walk or 30-minute incline walk.
- **Form videos.** ▶ buttons open your coach's YouTube links. An exercise with alternatives gets one button each, for example *Hip thrust* or *Glute bridge*.
- **Plate guide.** Barbell lifts show the plates to load on each side.
- **The screen stays awake** during a workout on most phones.

### Progress
- **Strength chart** of your estimated one-rep max for each exercise.
- **Weekly volume** chart covering the last 8 weeks.
- **Personal records** list.
- **Body weight** log with a 7-entry average line to smooth out daily swings.
- **Body measurements:** waist, chest, arm, hips and thigh in cm, with the change since your first entry and a trend chart.

### History and backup
- **Workout history** with time and total weight lifted, and a delete option.
- **Save backup file** exports your plans, workouts, body weight and measurements as a `.json` file.
- **Load backup file** restores a backup or moves your data to another phone. Workouts already in the app are not duplicated.

---

## Install on your phone

### iPhone (Safari)
1. Open the app link in **Safari**. It must be Safari.
2. Tap **Share → Add to Home Screen → Add**.
3. Always open Liftlog from the home-screen icon.

### Android (Chrome)
1. Open the app link in **Chrome**.
2. Tap **Install app**, or **⋮ → Install app** / **Add to Home screen**.
3. Liftlog appears in your app drawer.

Samsung Internet: **☰ → Add page to → Home screen**.

---

## Getting started

The app always starts empty. Each person adds their own plan:

1. Open the app. You'll see **Let's set up your plan**.
2. Paste your plan and tap **Read plan**, then **Load this plan**. Or build days by hand with **Routines → + New**.

### Plan format that works best

```
DAY 01
Warm-up
1. Arm circles - https://youtu.be/...
2. Band pull-aparts - https://youtu.be/...
MAIN WORKOUT
1. Machine chest press 4x8 - https://youtu.be/...
2. Hip thrust or glute bridge - https://youtu.be/...  /
https://youtu.be/...
COOL-DOWN
1. Chest stretch - https://youtu.be/...
2. Incline walk 30 min

DAY 02
...
```

- Start each day with `Day 1`, `DAY 01` and so on.
- Section headings: `Warm-up`, `Workout` / `Main workout`, and `Cool-down` / `Cardio`.
- One exercise per line with its YouTube link. A second link on the next line adds a second video.
- Optional: `4x10` sets the sets and reps, and `10 min` makes a timed item.
- Emoji and `*bold*` markers are ignored.
- Sets and reps you leave out get sensible defaults, which you can change with **Edit**.

---

## Privacy

- **All data stays on your phone,** inside the app. Nothing is sent to a server.
- **No outside requests.** The app loads no fonts, trackers or analytics. YouTube opens only when you tap a video.
- **This repository holds only the app's code.** It contains no names, plans or workout data.
- **Deleting the app or clearing browser data deletes your data,** so use **Save backup file** regularly.

---

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure: header, tab bar, rest-timer bar |
| `css/styles.css` | All styling, with light and dark themes |
| `js/plan-parser.js` | Reads a pasted plan (days, warm-up, workout, cool-down, links) |
| `js/app.js` | The app itself: storage, screens, timers, charts, backup |
| `sw.js` | Offline support and updates |
| `manifest.webmanifest` | App name, colours and icons for installing |
| `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` | App icons |

## Updating the app

1. Upload the changed files with **Add file → Upload files → Commit changes**. Keep the `css` and `js` folders: drag the folders in, or upload into them.
2. Each update raises `VERSION` in `sw.js`, which tells phones to download the new version.
3. Open the app, close it and open it again. The update appears on the second launch.

---

## Changelog

**v5 · 30 Oct 2026**
- Week progress bar is always green.

**v4 · 30 Oct 2026**
- Code split into separate files: `css/styles.css`, `js/plan-parser.js` and `js/app.js`. No change to features or your data.

**v3 · 29 Oct 2026**
- Train tab shows week progress with a percentage, progress bar and ✓ for each day.
- Days finished this week are hidden until Monday, with *Week complete* when all are done and *Show done this week* to repeat one.

**v2 · 28 Oct 2026**
- App starts empty: no built-in plan or example data.
- Removed Google Fonts, so the app makes no outside requests.
- Backups now include your plans.

**v1 · 28 Oct 2026**
- First release as an installable web app that works offline.
- Paste or bulk-add plans; group, expire and remove plans.
- Set logging, rest timer, timed walks, warm-up and cool-down checklists, form videos and plate guide.
- Strength, volume, body-weight and measurement tracking, plus personal records.
- Backup and restore.
