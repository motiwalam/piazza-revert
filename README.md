# Piazza Revert

This userscript is intended for use with [Piazza](https://piazza.com)'s new UI. This UI suffers from severe design flaws such as excessive padding on desktops, missing contrast between question/answer elements, etc.
The userscript aims to address these pitfalls. Overall, it attempts to follow a design inspired by Piazza's legacy UI.

It also adds some small quality-of-life features:

* Support for displaying multiple instructor endorsements
* Better handling of multiple/large images in posts

## How to use

1. Ensure you have a userscript extension (I use [Tampermonkey](https://www.tampermonkey.net/), but any Greasemonkey derivative will likely work) installed in your browser.
2. Open the raw userscript in your browser after the extension is installed: https://github.com/embeddedt/piazza-revert/raw/refs/heads/main/revert.user.js

   This should bring up a window asking you to confirm installation of the script. Once it is installed, refresh Piazza.

   Note: newer versions of the script use a minified, bundled blob rather than
   directly injecting raw JavaScript as shown below, so the contents of the
   script may look a bit different.

   <img width="1920" height="914" alt="image" src="https://github.com/user-attachments/assets/37cabccf-2e73-4f19-9fca-eb37f161565b" />

## How to develop

You will need a working Node.js installation (I use v22 locally, CI uses v20).

1. Clone the repository to your local machine.
2. Run `npm install` to install all necessary dependencies.
3. `npm run dev` will start the live dev server.
4. Install the userscript from http://localhost:8080/revert.user.js
5. When you make changes, you will need to trigger your userscript manager of choice to check for updates.