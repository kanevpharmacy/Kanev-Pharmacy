import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const TASK = 'KANEV_DRIVER_BACKGROUND_LOCATION';
const STORAGE = 'kanev-active-driver-delivery';
const OPTIONS = {
  accuracy: Location.Accuracy.Balanced,
  timeInterval: 10000,
  distanceInterval: 15,
  pausesUpdatesAutomatically: false,
  showsBackgroundLocationIndicator: true,
  foregroundService: {
    notificationTitle: 'Kanev Pharmacy delivery tracking',
    notificationBody: 'Your location is shared while you are delivering an order.',
    notificationColor: '#064E3B',
  },
};

TaskManager.defineTask(TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  try {
    const stored = await AsyncStorage.getItem(STORAGE);
    if (!stored) return;
    const { assignmentId, driverId } = JSON.parse(stored);
    if (!assignmentId || !driverId) return;
    const { data: assignment, error: assignmentError } = await supabase.from('delivery_assignments')
      .select('status').eq('id', assignmentId).eq('driver_id', driverId).maybeSingle();
    if (assignmentError || !['picked_up', 'in_transit'].includes(assignment?.status)) {
      await stopDriverBackgroundLocation();
      return;
    }
    const position = data.locations[data.locations.length - 1];
    const c = position.coords;
    const { error: writeError } = await supabase.from('delivery_driver_locations').upsert({
      driver_id: driverId, assignment_id: assignmentId,
      latitude: c.latitude, longitude: c.longitude,
      heading: c.heading, speed_mps: c.speed, accuracy_m: c.accuracy,
      recorded_at: new Date(position.timestamp || Date.now()).toISOString(),
    }, { onConflict: 'driver_id' });
    if (writeError) console.warn('Background delivery location upload failed', writeError.message);
  } catch (e) {
    console.warn('Background delivery tracking error', e?.message || e);
  }
});

export async function stopDriverBackgroundLocation() {
  if (Platform.OS !== 'web') {
    try {
      if (await Location.hasStartedLocationUpdatesAsync(TASK)) {
        await Location.stopLocationUpdatesAsync(TASK);
      }
    } catch (e) { console.warn('Could not stop background location', e?.message || e); }
  }
  await AsyncStorage.removeItem(STORAGE);
}

export async function startDriverBackgroundLocation(assignmentId, driverId) {
  if (Platform.OS === 'web') return false;
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') throw new Error('Allow location permission to track deliveries.');
  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== 'granted') throw new Error('Allow background location (Always) to track deliveries while your phone is locked.');
  await stopDriverBackgroundLocation();
  await AsyncStorage.setItem(STORAGE, JSON.stringify({ assignmentId, driverId }));
  try {
    await Location.startLocationUpdatesAsync(TASK, OPTIONS);
  } catch (e) {
    await AsyncStorage.removeItem(STORAGE);
    throw e;
  }
  return true;
}

export async function getDriverBackgroundAssignment() {
  const raw = await AsyncStorage.getItem(STORAGE);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}
