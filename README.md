# RobuxToGBP

**See your Robux in pounds. A Chrome extension that shows GBP values next to Robux amounts on Roblox, at the DevEx rate.**

RobuxToGBP puts a converted GBP amount beside your Robux balance in the navbar, so you can see roughly what your Robux are worth in the UK without doing the maths.

<img width="161" height="34" alt="image" src="https://github.com/user-attachments/assets/5616f6ab-ea7c-49a2-94ee-c1ac187f6726" />


## Features

- Shows your **navbar balance** in GBP, using your exact balance rather than the abbreviated one on screen (e.g. `1.2K+`)
- Adds GBP values to **Community Funds** and other Robux amounts on the site
- Uses **live USD → GBP exchange rates**, cached to keep requests low
- Lightweight: no popup, no settings, no account needed

## Installation (developer mode)

1. Clone this repository or download it as a ZIP and extract it:
   ```bash
   git clone https://github.com/lurin4/RobuxToGBP.git
   ```
2. Open `chrome://extensions` in Chrome, Edge or Brave.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the folder that contains `manifest.json`.
5. Open [roblox.com](https://www.roblox.com) while logged in. GBP values appear next to Robux amounts.

## How it works

The conversion is `robux × DevEx USD-per-Robux × USD→GBP rate`.

1. **Balance:** the content script asks Roblox for the logged-in user (`users.roblox.com`) and then their exact Robux balance (`economy.roblox.com`). The balance is cached in memory for 60 seconds.
2. **Exchange rate:** the content script messages the background service worker (`background.js`), which fetches the current USD→GBP rate from the [Frankfurter API](https://www.frankfurter.app/). The rate is cached for 6 hours.
3. **Annotation:** every 2 seconds the content script scans the page for Robux amounts (the navbar balance, Community Funds, and numbers next to a Robux icon) and inserts the GBP value after each one. Already-processed elements are tracked so nothing is annotated twice.

## Configuration

The DevEx rate is a constant at the top of `content.js`:

```js
const DEVEX_USD_PER_ROBUX = 0.0038;
```

If Roblox changes the DevEx rate, update this value.

## Privacy and permissions

- The extension only has access to the hosts listed in `manifest.json`: `www.roblox.com`, `users.roblox.com`, `economy.roblox.com` and `api.frankfurter.app`.
- Your balance is fetched from Roblox using your existing session and is only used to show the converted value on the page. It is never sent anywhere else.
- The only third-party request is to Frankfurter for the public exchange rate, which contains no user data.
- The only thing saved is the cached exchange rate.

## Limitations

- Values are **estimates** based on the DevEx rate, not what you would actually receive after fees or requirements.
- Amounts are found by scanning the page, so a Roblox UI update could stop some of them being detected.

## Tech

JavaScript · CSS · Chrome Extensions API (Manifest V3, service worker, message passing) · Roblox web APIs · Frankfurter API

## Project structure

```
RobuxToGBP/
├── manifest.json   # Extension config, permissions and script registration
├── content.js      # Fetches balance, converts amounts and annotates the page
├── background.js   # Service worker that fetches the USD→GBP exchange rate
└── styles.css      # Styling for the inserted GBP values
```

## Disclaimer

RobuxToGBP is an independent project and is not affiliated with or endorsed by Roblox Corporation.

## License

Released under the [MIT License](LICENSE).
