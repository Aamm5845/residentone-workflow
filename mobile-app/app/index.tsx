import { Redirect } from 'expo-router';
import useAuthStore from '../store/auth';

export default function Index() {
  const { token, user } = useAuthStore();

  if (!token || !user) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/(tabs)" />;
}
