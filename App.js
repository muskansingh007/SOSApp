import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from './screens/HomeScreen';
import AlertScreen from './screens/AlertScreen';
import ContactsScreen from './screens/ContactsScreen';
import SettingsScreen from './screens/SettingsScreen';
import {
  registerForPushNotifications,
  setupNotificationResponseHandler,
} from './utils/notificationHelper';

const Stack = createStackNavigator();

export default function App() {
  const navigationRef = useRef(null);

  useEffect(() => {
    // Register for push notifications on first launch
    registerForPushNotifications().then((token) => {
      if (token) console.log('Expo Push Token:', token);
    });

    // Handle taps on notifications — deep-link into the app
    const sub = setupNotificationResponseHandler(navigationRef);
    return () => sub.remove();
  }, []);

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: { backgroundColor: '#D32F2F' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: '🚨 SOS App' }} />
        <Stack.Screen name="Alert" component={AlertScreen} options={{ title: 'SOS ACTIVE', headerStyle: { backgroundColor: '#B71C1C' } }} />
        <Stack.Screen name="Contacts" component={ContactsScreen} options={{ title: 'Emergency Contacts' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}