# FridgeBook for iPhone

An Expo (React Native) app that uses the same server and the same account as https://fridge-book.com.

**What's in it so far:** Google sign-in, the Kitchen (add items, change quantities, remove, gluten labels in Celiac Mode), the Gluten check (restaurant, menu photo, recording the server) and Settings (Celiac Mode, Strict, sign out).

## Try it on your iPhone (free, no Apple Developer account)

1. Install **Expo Go** from the App Store.
2. On your computer:
   ```
   cd mobile
   npm install
   npx expo start
   ```
3. Scan the QR code with the iPhone camera. The phone and computer need to be on the same Wi-Fi.

### Signing in from Expo Go

Expo Go opens the app at an `exp://` address on your Wi-Fi rather than the app's own `fridgebook://` address. The server only sends sign-ins to `exp://` addresses when it's told to, so while you test in Expo Go:

- set `MOBILE_DEV_REDIRECTS=true` on Render (it only allows `exp://` addresses on a private network, like your home Wi-Fi);
- remove it when you're done testing, or once the app is a real build.

A real build (TestFlight or the App Store) uses `fridgebook://` and needs no setting.

### Using a local server instead

`EXPO_PUBLIC_API_URL=http://<your computer's Wi-Fi address>:8080 npx expo start` points the app at `npm run start:server` on your computer.

## How sign-in works

The app opens `/auth/mobile/start` in a secure browser sheet, you sign in with Google as on the website, and the server sends back a one-time code. The app swaps that code (plus a PKCE secret only it knows) for a token at `POST /auth/mobile/token`, keeps the token in the iPhone Keychain, and sends it as `Authorization: Bearer …` on every request. Server side: `lib/mobileAuth.js`, `routes/authRoutes.js`.

## Tests

```
npm test                                        # app tests (Jest + React Native Testing Library)
npx expo export --platform ios --output-dir /tmp/ios   # checks the iPhone bundle builds
```
CI runs both on every push.

## Before the App Store

- **Apple Developer Program** ($99/year) for TestFlight and the App Store; builds are made in the cloud with EAS (`npx eas-cli@latest build`), so no Mac is needed.
- **Sign in with Apple** is required by App Store guideline 4.8 because the app offers Google sign-in.
- **In-app account deletion** and a **privacy policy** are required.
- Recording the server works on iPhone only for now (it records WAV; Android would need another format on the server).
- `com.fridgebook.app` in `app.json` is a placeholder bundle ID; pick the final one before the first build.
