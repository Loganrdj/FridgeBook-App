// fridgebook://auth is where sign-in comes back to. The secure browser sheet
// normally catches it first; if the link opens the app instead, just go home.
import { Redirect } from 'expo-router';

export default function AuthReturn() {
  return <Redirect href="/" />;
}
