import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const GREEN = '#064E3B';
const LIME = '#C8F36A';

export default function KanevNoticeModal({ visible, title, message, onClose, onContinue, tone = 'info' }) {
  const warning = tone === 'warning' || tone === 'error';
  const success = tone === 'success';
  const icon = warning ? 'alert-circle-outline' : success ? 'checkmark-circle-outline' : 'information-circle-outline';
  const accent = warning ? '#B54708' : success ? GREEN : '#236DA8';
  return (
    <Modal visible={!!visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close message" />
        <View accessibilityRole="alert" style={styles.card}>
          <View style={[styles.iconWrap, { backgroundColor: warning ? '#FFF4E5' : success ? '#EAF5EE' : '#EAF3FB' }]}>
            <Ionicons name={icon} size={28} color={accent} />
          </View>
          <Text style={styles.brand}>KANEV PHARMACY</Text>
          <Text style={styles.title}>{title || 'Notice'}</Text>
          <Text style={styles.message}>{message}</Text>
          <Pressable onPress={onContinue || onClose} accessibilityRole="button" style={styles.button}>
            <Text style={styles.buttonText}>Continue</Text>
            <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.footer}>Closer to Your Health</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(7, 28, 20, 0.58)', alignItems: 'center', justifyContent: 'center', padding: 22 },
  card: { width: '100%', maxWidth: 420, backgroundColor: '#FFFFFF', borderRadius: 22, paddingHorizontal: 26, paddingTop: 28, paddingBottom: 22, alignItems: 'center', borderWidth: 1, borderColor: '#DCE8E1', shadowColor: '#001D13', shadowOpacity: 0.22, shadowRadius: 28, shadowOffset: { width: 0, height: 12 }, elevation: 18 },
  iconWrap: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  brand: { fontSize: 10, letterSpacing: 2, fontWeight: '900', color: GREEN, marginBottom: 8 },
  title: { fontSize: 22, lineHeight: 28, textAlign: 'center', fontWeight: '900', color: '#172B24', marginBottom: 9 },
  message: { fontSize: 14, lineHeight: 21, textAlign: 'center', color: '#687A72', marginBottom: 22 },
  button: { minHeight: 47, width: '100%', backgroundColor: GREEN, borderRadius: 12, paddingHorizontal: 18, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  footer: { marginTop: 15, fontSize: 11, color: '#8A9992' },
});
