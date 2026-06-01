import { Tabs, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useLogoutMutation } from '../../store/services/authAPI';

export default function TabLayout() {
  const router = useRouter();
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();

  const handleLogout = async () => {
    try {
      await logout().unwrap();
    } catch {
      // auth state is cleared in logout onQueryStarted finally
    } finally {
      router.replace('/login');
    }
  };

  return (
    <Tabs
      screenOptions={{
        // Premium brand color curation matching your backend design layers
        tabBarActiveTintColor: '#670086',   // Royal Purple Primary Accent
        tabBarInactiveTintColor: '#8e8e93', // Balanced Neutral Grey
        tabBarStyle: styles.tabBar,
        headerStyle: styles.header,
        headerTitleAlign: 'center',
        headerTitleStyle: styles.headerTitle,
        headerRight: () => (
          <Pressable
            onPress={handleLogout}
            disabled={isLoggingOut}
            style={({ pressed }) => [
              styles.logoutButton,
              pressed && styles.logoutButtonPressed,
              isLoggingOut && styles.logoutButtonDisabled,
            ]}
          >
            <Text style={styles.logoutText}>{isLoggingOut ? '...' : 'Logout'}</Text>
          </Pressable>
        ),
      }}
    >
      {/* TAB 1: HOME (Predictive Analytics & Recommendation Panel) */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'house.fill',
                android: 'home',
                web: 'home',
              }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />

      {/* TAB 2: GRADES (Adaptive Testing Core - MusicTheoryBench Logic) */}
      <Tabs.Screen
        name="grades"
        options={{
          title: 'Grades',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'graduationcap.fill',
                android: 'school',
                web: 'school',
              }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />

      {/* TAB 3: TUTOR (Generative AI Instructor Guardrail Interface) */}
      <Tabs.Screen
        name="tutor"
        options={{
          title: 'AI Tutor',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'waveform.and.mic',
                android: 'chat',
                web: 'chat',
              }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />

      {/* TAB 4: AURAL (Ear Training & Real-Time Pitch Analysis DSP Math) */}
      <Tabs.Screen
        name="aural"
        options={{
          title: 'Aural Training',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'hearingdevice.ear',
                android: 'hearing',
                web: 'hearing',
              }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />

      {/* TAB 5: TRANSCRIBER (Optical Music Recognition Camera Pipeline) */}
      <Tabs.Screen
        name="transcriber"
        options={{
          title: 'Transcriber',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'camera.metering.matrix',
                android: 'photo_camera',
                web: 'photo_camera',
              }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
    </Tabs>
  );
}

// Separate styling abstractions to optimize screen render efficiency
const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#ffffff',
    borderTopColor: '#f2f2f7',
    borderTopWidth: 1,
    height: 64,
    paddingBottom: 8,
    paddingTop: 6,
    elevation: 8, // Shadows for clean Android material card depth
    shadowColor: '#000000', // Shadows for premium iOS feel
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  header: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#f2f2f7',
    borderBottomWidth: 1,
    elevation: 0,
    shadowOpacity: 0,
  },
  headerTitle: {
    fontWeight: '700',
    fontSize: 18,
    color: '#1c1c1e',
    letterSpacing: -0.4,
  },
  logoutButton: {
    marginRight: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d7d4de',
    backgroundColor: '#f7f5fb',
  },
  logoutButtonPressed: {
    opacity: 0.85,
  },
  logoutButtonDisabled: {
    opacity: 0.6,
  },
  logoutText: {
    color: '#3a2350',
    fontWeight: '700',
    fontSize: 12,
  },
});