import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { BRAND } from '@polevka/core';
import { color, fonts } from '@polevka/design';

export default function App() {
  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Text style={styles.brand}>{BRAND}</Text>
      <Text style={styles.sub}>Нативная оболочка Expo. Карта — react-native-maps / MapLibre Native, аудио — expo-av. Общая логика — @polevka/core, токены — @polevka/design.</Text>
      <View style={styles.tabs}>
        {['Лента', 'Карта', 'Профиль'].map((t) => (
          <View key={t} style={styles.tab}><Text style={styles.tabText}>{t}</Text></View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.phoneBg, alignItems: 'center', justifyContent: 'center', padding: 28 },
  brand: { fontSize: 32, color: color.ink, fontFamily: fonts.brand, marginBottom: 12 },
  sub: { fontSize: 14, color: color.olive, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { backgroundColor: color.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16 },
  tabText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
