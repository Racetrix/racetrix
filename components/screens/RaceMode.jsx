// [RaceMode.jsx]
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useBluetooth } from '../../components/BluetoothContext';
import { THEME } from '../../constants/theme';

// 辅助函数
const getDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatTime = (ms) => {
    if (ms < 0) ms = 0;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const centis = Math.floor((ms % 1000) / 10);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
};

export default function RaceMode() {
    const {
        savedTracks, activeTrack, telemetry, lapStats, status,
        refreshTrackList, loadTrackToMemory,
        manualStartRace, manualStopRace, startTimeRef,
        setRaceModeState,
        triggerRadius, setTriggerRadius
    } = useBluetooth();

    const [displayTime, setDisplayTime] = useState(0);
    const [liveDistance, setLiveDistance] = useState(null); // 统一的距离显示变量
    const [distanceLabel, setDistanceLabel] = useState("距离起点"); // 距离标题

    // 1. 自动开启数据流
    useEffect(() => {
        setRaceModeState(true);
        return () => setRaceModeState(false);
    }, []);

    // 2. 核心距离计算逻辑 (包含终点距离)
    useEffect(() => {
        if (!activeTrack || telemetry.lat === 0) {
            setLiveDistance(null);
            return;
        }

        // 逻辑分支：正在比赛 vs 等待开始
        if (lapStats.isRacing) {
            // --- 正在比赛中 ---
            if (activeTrack.type === 'sprint' && activeTrack.finishLine) {
                // 点对点模式：显示到终点的距离
                const d = getDistance(telemetry.lat, telemetry.lon, activeTrack.finishLine.lat, activeTrack.finishLine.lon);
                setLiveDistance(d);
                setDistanceLabel("🏁 距离终点");
            } else {
                // 闭环模式：显示到起点(也是下一圈终点)的距离
                const d = getDistance(telemetry.lat, telemetry.lon, activeTrack.startLine.lat, activeTrack.startLine.lon);
                setLiveDistance(d);
                setDistanceLabel("🔄 距离下一圈起点");
            }
        } else {
            // --- 等待开始 ---
            // 显示到起点的距离
            const d = getDistance(telemetry.lat, telemetry.lon, activeTrack.startLine.lat, activeTrack.startLine.lon);
            setLiveDistance(d);
            setDistanceLabel("🚀 距离起点");
        }
    }, [telemetry, activeTrack, lapStats.isRacing]);

    // 3. 计时器刷新
    useEffect(() => {
        let interval;
        if (lapStats.isRacing) {
            // 立即刷新一次
            setDisplayTime(Date.now() - startTimeRef.current);
            interval = setInterval(() => {
                setDisplayTime(Date.now() - startTimeRef.current);
            }, 33);
        } else {
            setDisplayTime(lapStats.lastLapTime || 0);
        }
        return () => clearInterval(interval);
    }, [lapStats.isRacing, lapStats.lastLapTime]);

    // 手动开始处理
    const handleManualStart = () => {
        if (!activeTrack) return Alert.alert("提示", "请先加载赛道");
        manualStartRace();
    };

    return (
        <ScrollView contentContainerStyle={styles.scrollContent}>

            {/* 状态栏 + 误差设置 */}
            <View style={styles.statusBar}>
                <View style={[styles.statusBadge, status.recording ? { backgroundColor: THEME.danger } : { backgroundColor: '#333' }]}>
                    <Text style={{ color: status.recording ? '#fff' : '#888', fontWeight: 'bold', fontSize: 12 }}>
                        {status.recording ? "🔴 REC (Recording)" : "📡 待机 (GPS Active)"}
                    </Text>
                </View>

                {/* 误差设置 */}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: '#666', fontSize: 10, marginRight: 5 }}>触发误差(m):</Text>
                    <TextInput
                        style={styles.inputSmall}
                        keyboardType="numeric"
                        value={String(triggerRadius)}
                        onChangeText={(t) => setTriggerRadius(Number(t) || 3)} // 默认值 fallback 到 3
                    />
                </View>
            </View>

            {/* 主仪表盘 */}
            <View style={styles.dashboard}>
                <Text style={styles.trackName}>{activeTrack ? `📍 ${activeTrack.name}` : "⚠️ 请先加载赛道"}</Text>

                {/* 大计时器 */}
                <Text style={[styles.timerText, lapStats.isRacing && { color: THEME.primary }]}>
                    {formatTime(displayTime)}
                </Text>

                {/* 状态标签 */}
                <Text style={{ color: lapStats.isRacing ? '#00E676' : '#666', fontSize: 12, fontWeight: 'bold', marginBottom: 15 }}>
                    {lapStats.isRacing ? "🔥 RACING - 计时中" : "WAITING - 等待触发"}
                </Text>

                {/* 动态距离显示 (起点/终点) */}
                {activeTrack && liveDistance !== null && (
                    <View style={styles.distBox}>
                        <Text style={styles.distLabel}>{distanceLabel}</Text>
                        <Text style={[styles.distVal, liveDistance < triggerRadius ? { color: '#00E676' } : { color: '#FFD700' }]}>
                            {liveDistance.toFixed(1)} <Text style={{ fontSize: 14 }}>米</Text>
                        </Text>
                        {/* 如果在等待开始，显示提示 */}
                        {!lapStats.isRacing && (
                            <Text style={styles.hintText}>
                                {liveDistance < triggerRadius ? "🚀 范围内！准备起步！" : `进入 ${triggerRadius}米 范围内自动开始`}
                            </Text>
                        )}
                    </View>
                )}
            </View>

            {/* 🔥 手动控制按钮 (回归) */}
            <View style={styles.controlRow}>
                <TouchableOpacity
                    style={[styles.ctrlBtn, { backgroundColor: THEME.primary }]}
                    onPress={handleManualStart}
                >
                    <Text style={styles.btnTextBlack}>▶ 手动开始</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.ctrlBtn, { backgroundColor: THEME.danger }]}
                    onPress={manualStopRace}
                >
                    <Text style={styles.btnTextWhite}>⏹ 停止/复位</Text>
                </TouchableOpacity>
            </View>

            {/* 赛道列表 (简略版) */}
            <View style={styles.listSection}>
                <View style={styles.listHeader}>
                    <Text style={styles.sectionTitle}>本地赛道列表</Text>
                    <TouchableOpacity onPress={refreshTrackList}><Text style={{ color: THEME.secondary }}>🔄 刷新</Text></TouchableOpacity>
                </View>
                {savedTracks.map((path, i) => (
                    <View key={i} style={styles.trackItem}>
                        <Text style={styles.itemText}>{path.split('/').pop().replace('.json', '')}</Text>
                        <TouchableOpacity style={styles.loadBtn} onPress={() => loadTrackToMemory(path)}>
                            <Text style={styles.btnTextBlack}>加载</Text>
                        </TouchableOpacity>
                    </View>
                ))}
            </View>

        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollContent: { padding: 20, paddingBottom: 50 },
    statusBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4 },
    inputSmall: { backgroundColor: '#222', color: '#fff', padding: 2, paddingHorizontal: 8, borderRadius: 4, width: 40, textAlign: 'center', fontSize: 12 },

    dashboard: { backgroundColor: '#111', borderRadius: 12, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#333', marginBottom: 20 },
    trackName: { color: '#888', fontSize: 14, marginBottom: 10 },
    timerText: { color: '#fff', fontSize: 60, fontWeight: '900', fontVariant: ['tabular-nums'] },

    distBox: { width: '100%', alignItems: 'center', padding: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8 },
    distLabel: { color: '#888', fontSize: 12 },
    distVal: { fontSize: 32, fontWeight: 'bold', color: '#FFD700', marginVertical: 5 },
    hintText: { color: '#666', fontSize: 10, fontStyle: 'italic' },

    controlRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    ctrlBtn: { width: '48%', padding: 18, borderRadius: 10, alignItems: 'center' },
    btnTextBlack: { color: '#000', fontWeight: 'bold', fontSize: 16 },
    btnTextWhite: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

    listSection: { marginTop: 10 },
    listHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    sectionTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    trackItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: THEME.card, padding: 15, borderRadius: 8, marginBottom: 10 },
    itemText: { color: '#fff', fontWeight: 'bold' },
    loadBtn: { backgroundColor: '#FFD700', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 6 },
});