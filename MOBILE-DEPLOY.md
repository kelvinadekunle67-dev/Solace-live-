# Solace — mobile-only deployment guide

No computer, no command line, no npm install needed on your end. Everything below happens through GitHub.com and Render.com in your phone's browser.

**Files in this folder** (already laid out so you can just upload them, no editing needed):
```
server.js
package.json
public/index.html
public/styles.css
public/app.js
public/manifest.json
public/icon-192.png
public/icon-512.png
public/apple-touch-icon.png
public/favicon.png
public/logo-header.png
public/logo-medium.png
```

---

## Step 1 — Create a GitHub account (2 min)
Open your phone's browser, go to **github.com**, tap **Sign up**, and create a free account if you don't have one.

## Step 2 — Create a new repository
1. Tap the **+** icon (top right) → **New repository**
2. Name it `solace` (or anything you like)
3. Set it to **Public** (Render's free tier needs this) or Private if you're on a paid Render plan later
4. Tap **Create repository**

## Step 3 — Create the `public` folder
GitHub's mobile upload can't create empty folders directly, so we create it via one small file first:
1. On your new repo's page, tap **Add file → Create new file**
2. In the file name box, type: `public/.gitkeep`
3. Tap **Commit changes** (leave the content blank, that's fine)
4. You'll now see a `public` folder appear in your repo

## Step 4 — Upload the frontend files into `public`
1. Tap into the `public` folder you just created
2. Tap **Add file → Upload files**
3. Tap to browse, and select **all of these at once** from the `public/` folder you unzipped: `index.html`, `styles.css`, `app.js`, `manifest.json`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `favicon.png`, `logo-header.png`, `logo-medium.png`
4. Tap **Commit changes**

That's your candle logo and app icon going along for the ride — once this is live, "Add to Home Screen" on the real URL will use your actual logo too.

## Step 5 — Upload the server files to the root
1. Tap the repo name at the top to go back to the root
2. Tap **Add file → Upload files**
3. Select `server.js` and `package.json` (these are the two files directly inside this `solace-live` folder / the top of the zip)
4. Tap **Commit changes**

Your repo should now look like:
```
solace/
  server.js
  package.json
  public/
    index.html
    styles.css
    app.js
```

## Step 6 — Deploy on Render
1. Go to **render.com** in your browser, sign up (you can use your GitHub account to sign in — one tap)
2. Tap **New → Web Service**
3. Connect your GitHub account if asked, then select your `solace` repo
4. Leave **Root Directory** blank
5. **Build Command:** `npm install`
6. **Start Command:** `npm start`
7. Choose the **Free** instance type
8. Tap **Deploy Web Service**

Render will build it (takes 1-3 minutes) and give you a live link like `https://solace-xxxx.onrender.com` — that's your real, public, shareable website.

**Note:** on the free tier, the site "sleeps" after 15 minutes of no visitors and takes about a minute to wake back up on the next visit — totally normal, and free.

---

## Later, if you want to update anything
Edit a file directly on GitHub (tap the file → pencil/edit icon → make changes → Commit), and Render automatically redeploys within a couple minutes. No re-uploading needed.

## Before opening this to the public
Please still read the safety/legal checklist — anonymous posting carries real responsibility (moderation, a privacy policy, handling someone in crisis). Ask me any time and I'll walk through it with you.
