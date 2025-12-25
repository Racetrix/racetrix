import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useBluetooth } from './BluetoothContext'; // 引入 Context
import { THEME } from '../constants/theme';

export default function SettingsScreen() {
    // 解构出 device 对象
    const { device, disconnect, sendCmd, recInfo, storageLocation, setStorageLocation } = useBluetooth();

    // 调试日志：看看 device 到底是不是空的
    // console.log("Current Device in Settings:", device);

    return (
        <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* --- 设备卡片 --- */}
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>已连接设备</Text>
                {/* 增加判断：如果 device 存在，显示信息；否则显示未连接 */}
                {device ? (
                    <>
                        <Text style={styles.val}>{device.name || "未知名称"}</Text>
                        <Text style={styles.label}>{device.address || "无 MAC 地址"}</Text>
                    </>
                ) : (
                    <Text style={[styles.val, { color: THEME.danger }]}>❌ 未连接设备</Text>
                )}

                <TouchableOpacity style={[styles.outlineBtn, { marginTop: 10 }]} onPress={() => sendCmd('KEY:1234')}>
                    <Text style={styles.outlineBtnText}>🔐 手动重发鉴权</Text>
                </TouchableOpacity>
            </View>

            {/* --- 存储设置 --- */}
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>存储设置</Text>
                <Text style={styles.infoText}>{storageLocation === 'external' ? "当前: 外部公开目录 (PC可见)" : "当前: 内部私有目录"}</Text>
                <View style={styles.toggleRow}>
                    <TouchableOpacity style={[styles.toggleBtn, storageLocation === 'external' && { backgroundColor: THEME.primary }]} onPress={() => setStorageLocation('external')}>
                        <Text style={{ color: storageLocation === 'external' ? '#000' : '#fff', fontWeight: 'bold' }}>外部存储</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.toggleBtn, storageLocation === 'internal' && { backgroundColor: THEME.primary }]} onPress={() => setStorageLocation('internal')}>
                        <Text style={{ color: storageLocation === 'internal' ? '#000' : '#fff', fontWeight: 'bold' }}>内部存储</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* --- 录制统计 --- */}
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>录制统计</Text>
                <Text style={styles.label}>当前记录点数: <Text style={styles.val}>{recInfo.count}</Text></Text>
                <Text style={styles.label} numberOfLines={1}>文件: {recInfo.currentFile ? recInfo.currentFile.split('/').pop() : '无'}</Text>
            </View>

            <TouchableOpacity style={styles.logoutBtn} onPress={disconnect}>
                <Text style={{ color: THEME.danger, fontWeight: 'bold' }}>🛑 断开蓝牙连接</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

// 样式定义
const styles = StyleSheet.create({
    scrollContent: { padding: 20, paddingBottom: 50 },
    card: { backgroundColor: THEME.card, padding: 15, borderRadius: 8, marginBottom: 15 },
    sectionTitle: { color: THEME.primary, fontSize: 14, fontWeight: 'bold', marginBottom: 10 },
    val: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    label: { color: '#888', fontSize: 12, marginTop: 2 },
    infoText: { color: '#888', fontSize: 12, marginBottom: 10 },
    toggleRow: { flexDirection: 'row', backgroundColor: '#000', borderRadius: 8, padding: 2 },
    toggleBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 6 },
    outlineBtn: { borderWidth: 1, borderColor: '#555', padding: 10, borderRadius: 8, alignItems: 'center' },
    outlineBtnText: { color: '#fff', fontSize: 12 },
    logoutBtn: { padding: 20, alignItems: 'center', marginTop: 30, borderWidth: 1, borderColor: THEME.danger, borderRadius: 8 },
});