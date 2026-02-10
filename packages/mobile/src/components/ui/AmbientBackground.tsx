import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/theme';

export function AmbientBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[colors.ambientGradient, colors.ambientVia, 'transparent']}
        style={styles.topGradient}
      />
      <View style={styles.rightOrb} />
      <View style={styles.leftOrb} />
    </View>
  );
}

const styles = StyleSheet.create({
  topGradient: {
    position: 'absolute',
    top: '-10%',
    left: '-10%',
    width: '120%',
    height: '60%',
  },
  rightOrb: {
    position: 'absolute',
    top: '10%',
    right: '-20%',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: colors.ambientOrbRight,
  },
  leftOrb: {
    position: 'absolute',
    bottom: '20%',
    left: '-10%',
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: colors.ambientOrbLeft,
  },
});
