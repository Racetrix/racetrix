import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { THEME } from '../../constants/theme';

export default function BottomTabBar({ activeTab, onChange }) {
    return (
        <View style={styles.tabBar}>
            <TouchableOpacity style={styles.tabItem} onPress={() => onChange('home')}>
                <Text style={{ fontSize: 20, marginBottom: 4 }}>🏎️</Text>
                <Text style={[styles.tabText, activeTab === 'home' && styles.tabTextActive]}>主控台</Text>
                {activeTab === 'home' && <View style={styles.tabLine} />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabItem} onPress={() => onChange('settings')}>
                <Text style={{ fontSize: 20, marginBottom: 4 }}>⚙️</Text>
                <Text style={[styles.tabText, activeTab === 'settings' && styles.tabTextActive]}>设置</Text>
                {activeTab === 'settings' && <View style={styles.tabLine} />}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    tabBar: { height: 60, flexDirection: 'row', backgroundColor: THEME.sidebar, borderTopWidth: 1, borderColor: THEME.border },
    tabItem: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    tabText: { color: '#666', fontSize: 10, fontWeight: 'bold' },
    tabTextActive: { color: THEME.primary },
    tabLine: { width: 40, height: 2, backgroundColor: THEME.primary, position: 'absolute', bottom: 0 },
});