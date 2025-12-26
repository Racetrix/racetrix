import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { THEME } from '../../constants/theme';

const { width, height } = Dimensions.get('window');

export default function Sidebar({ isOpen, onClose, activeMode, onSelectMode }) {
    if (!isOpen) return null;

    const modes = [
        { id: 'roam', icon: '🚀', label: '漫游模式', desc: '自由驾驶数据监控' },
        { id: 'create', icon: '🛠', label: '创建赛道', desc: '录制路径与起终点' },
        { id: 'race', icon: '🏁', label: '赛道模式', desc: '加载赛道进行刷圈' },
        { id: 'gyro', icon: '📐', label: '陀螺仪校准', desc: '调整 G 值与姿态方向' },
    ];

    return (
        <View style={styles.overlay}>
            <TouchableOpacity style={styles.overlayBg} onPress={onClose} />
            <View style={styles.sidebar}>
                <View style={styles.sidebarHeader}>
                    <Text style={styles.sidebarTitle}>选择驾驶模式</Text>
                </View>
                {modes.map((m) => (
                    <TouchableOpacity
                        key={m.id}
                        style={[styles.menuItem, activeMode === m.id && styles.menuItemActive]}
                        onPress={() => { onSelectMode(m.id); onClose(); }}
                    >
                        <Text style={styles.menuIcon}>{m.icon}</Text>
                        <View>
                            <Text style={[styles.menuTitle, activeMode === m.id && { color: '#000' }]}>{m.label}</Text>
                            <Text style={[styles.menuDesc, activeMode === m.id && { color: '#333' }]}>{m.desc}</Text>
                        </View>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: { position: 'absolute', top: 0, left: 0, width: width, height: height, zIndex: 100 },
    overlayBg: { position: 'absolute', width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.7)' },
    sidebar: { width: '70%', height: '100%', backgroundColor: THEME.sidebar, padding: 20, borderRightWidth: 1, borderColor: THEME.border },
    sidebarTitle: { color: '#666', fontSize: 12, fontWeight: 'bold', marginBottom: 20, marginTop: 40 },
    menuItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: THEME.border },
    menuItemActive: { backgroundColor: THEME.primary, borderColor: THEME.primary },
    menuIcon: { fontSize: 24, marginRight: 15 },
    menuTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    menuDesc: { color: '#888', fontSize: 10 },
});