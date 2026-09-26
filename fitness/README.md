# Fit Log

A phone app (installable web app) for calories and macros, AI food logging, training plans with weight logging, weekly meal plans with a grocery list, and weight, measurement and photo tracking.

## Put it on your phone

1. On GitHub: repo **Settings → Pages → Build and deployment → Deploy from a branch**, choose the branch and `/ (root)`, save.
2. After a minute, open `https://i9990610.github.io/Learn/fitness/` on your phone.
3. iPhone (Safari): Share → **Add to Home Screen**. Android (Chrome): menu → **Install app**.

It then opens full screen like a normal app and works offline (AI features need internet).

## AI setup

Settings → AI coach: paste an Anthropic key (console.anthropic.com) and/or an OpenAI key (platform.openai.com) and pick the provider. Keys stay on your phone and go straight to the provider. Set a monthly spend limit in the provider console.

## Data

Everything is stored on the device (browser storage; photos in IndexedDB). Use Settings → Export backup regularly. Clearing Safari website data deletes it.
