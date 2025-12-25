// [RoamMode.jsx]
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useBluetooth } from '../../components/BluetoothContext'; // 路径按你实际的来
import { THEME } from '../../constants/theme';

const GridItem = ({ label, val, wide }) => (
    <View style={[styles.gridItem, wide && { width: '100%' }]}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.val}>{val}</Text>
    </View>
);

export default function RoamMode() {
    // 🔥 引入 toggleRoamRecording 和 status
    const { telemetry, status, toggleRoamRecording } = useBluetooth();

    return (
        <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.modeTag}>
                <Text style={styles.modeTagText}>FREE ROAM MODE</Text>
            </View>

            {/* 速度显示 */}
            <View style={styles.speedBox}>
                <Text style={[styles.speedVal, telemetry.speed > 100 && { color: THEME.danger }]}>
                    {telemetry.speed.toFixed(1)}
                </Text>
                <Text style={styles.speedUnit}>KM/H</Text>
            </View>

            {/* 数据网格 */}
            <View style={styles.grid}>
                <GridItem label="SATS (卫星)" val={telemetry.sats} />
                <GridItem label="ALTITUDE (海拔)" val={`${telemetry.alt.toFixed(0)}m`} />
                <GridItem label="LATITUDE" val={telemetry.lat.toFixed(6)} wide />
                <GridItem label="LONGITUDE" val={telemetry.lon.toFixed(6)} wide />
            </View>

            {/* 🔥 按钮逻辑修改 */}
            <TouchableOpacity
                style={[
                    styles.bigBtn,
                    status.recording ? styles.bgRedOp : styles.bgGreenOp // 这里用 status.recording 来判断颜色更准确
                ]}
                onPress={toggleRoamRecording} // <--- 关键修改：使用专用函数
            >
                <Text style={[
                    styles.bigBtnText,
                    { color: status.recording ? THEME.danger : THEME.primary }
                ]}>
                    {status.recording ? "⏹ 停止漫游记录" : "▶ 开始漫游记录"}
                </Text>
            </TouchableOpacity>

            {/* 状态提示 */}
            <Text style={{ textAlign: 'center', color: '#666', marginTop: 10, fontSize: 10 }}>
                {status.recording ? "🔴 正在录制 CSV 文件..." : "设备待机中"}
            </Text>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollContent: { padding: 20, paddingBottom: 50 },
    modeTag: { alignSelf: 'center', borderWidth: 1, borderColor: THEME.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, marginBottom: 20 },
    modeTagText: { color: THEME.primary, fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
    speedBox: { alignItems: 'center', marginVertical: 20 },
    speedVal: { fontSize: 100, fontWeight: '900', color: THEME.primary, includeFontPadding: false },
    speedUnit: { color: '#666', fontSize: 18, marginTop: -10, letterSpacing: 2 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    gridItem: { width: '48%', backgroundColor: THEME.card, padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: THEME.border },
    label: { color: '#888', fontSize: 10, fontWeight: 'bold', marginBottom: 2 },
    val: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
    bigBtn: { width: '100%', padding: 22, borderWidth: 2, borderRadius: 12, alignItems: 'center', marginTop: 20 },
    bgGreenOp: { backgroundColor: 'rgba(0,230,118,0.1)', borderColor: THEME.primary },
    bgRedOp: { backgroundColor: 'rgba(255,23,68,0.1)', borderColor: THEME.danger },
    bigBtnText: { fontSize: 18, fontWeight: '900', letterSpacing: 1 },
});