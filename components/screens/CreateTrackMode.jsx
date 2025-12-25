import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Dimensions, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg'; // 绘图组件
import { THEME } from '../../constants/theme';
import { useBluetooth } from '../BluetoothContext';

const { width } = Dimensions.get('window');
const CANVAS_HEIGHT = 250;
const CANVAS_WIDTH = width - 60; // 减去 padding

export default function CreateTrackMode() {
    // 🔥 从 Context 获取 toggleSetupMode
    const { telemetry, saveNewTrack, toggleSetupMode } = useBluetooth();

    // --- 状态 ---
    const [name, setName] = useState(`Track_${new Date().getHours()}${new Date().getMinutes()}`);
    const [trackType, setTrackType] = useState('circuit'); // 'circuit' (闭环) | 'sprint' (点对点)

    // recording 现在对应 "Setup Mode 是否开启"
    const [recording, setRecording] = useState(false);
    const [points, setPoints] = useState([]);
    const [startLine, setStartLine] = useState(null);
    const [finishLine, setFinishLine] = useState(null);

    // --- 1. 生命周期管理 ---
    // 离开页面时，强制关闭 Setup Mode，防止后台持续发送高频数据
    useEffect(() => {
        return () => {
            toggleSetupMode(false);
        };
    }, []);

    // --- 2. 核心录制逻辑 ---
    useEffect(() => {
        // 逻辑变更：只有当 (1)正在录制 (2)起点已设置 (3)GPS有效 时，才记录路径点
        if (recording && startLine && (telemetry.lat !== 0 || telemetry.lon !== 0)) {
            setPoints(prev => {
                // 简单的防抖：如果跟上一个点太近，就不存
                const last = prev[prev.length - 1];
                if (last && Math.abs(last.lat - telemetry.lat) < 0.000005 && Math.abs(last.lon - telemetry.lon) < 0.000005) {
                    return prev;
                }
                // Setup Mode 不包含海拔(alt)，这里存入 telemetry.alt (可能为0)
                return [...prev, { lat: telemetry.lat, lon: telemetry.lon, alt: telemetry.alt }];
            });
        }
    }, [telemetry, recording, startLine]);

    // --- 3. 可视化映射算法 (GPS -> SVG) ---
    const mapData = useMemo(() => {
        if (points.length < 2) return null;

        let minLat = points[0].lat, maxLat = points[0].lat;
        let minLon = points[0].lon, maxLon = points[0].lon;

        points.forEach(p => {
            if (p.lat < minLat) minLat = p.lat;
            if (p.lat > maxLat) maxLat = p.lat;
            if (p.lon < minLon) minLon = p.lon;
            if (p.lon > maxLon) maxLon = p.lon;
        });

        const latRange = maxLat - minLat || 0.001;
        const lonRange = maxLon - minLon || 0.001;
        const padding = 20;

        const availableWidth = CANVAS_WIDTH - (padding * 2);
        const availableHeight = CANVAS_HEIGHT - (padding * 2);

        const getX = (lon) => padding + ((lon - minLon) / lonRange) * availableWidth;
        const getY = (lat) => CANVAS_HEIGHT - padding - ((lat - minLat) / latRange) * availableHeight;

        const pathString = points.map(p => `${getX(p.lon)},${getY(p.lat)}`).join(' ');

        const startPos = startLine ? { x: getX(startLine.lon), y: getY(startLine.lat) } : null;
        const finishPos = finishLine ? { x: getX(finishLine.lon), y: getY(finishLine.lat) } : null;

        // 闭环模式下，如果还没单独设置终点，通常终点位置就是当前的点或者最后一点
        // 这里为了绘图方便，如果 finishLine 存在才画
        return { pathString, startPos, finishPos };
    }, [points, startLine, finishLine]);

    // --- 交互处理 ---

    // 切换设置模式 (Setup ON/OFF)
    const handleToggleSetup = () => {
        const nextState = !recording;
        setRecording(nextState);

        if (nextState) {
            // 开启
            toggleSetupMode(true);
            setPoints([]);
            setStartLine(null);
            setFinishLine(null);
            Alert.alert("设置模式已开启", "设备正以 10Hz 发送数据。\n\n步骤1: 请前往起点，点击“设为起点”。");
        } else {
            // 手动关闭
            toggleSetupMode(false);
        }
    };

    // 设置起点 (开始记录路径)
    const handleSetStart = () => {
        if (!recording) return Alert.alert("提示", "请先开启设置模式");

        setStartLine({ lat: telemetry.lat, lon: telemetry.lon });
        // 在闭环模式下，起点的物理位置也是终点，但我们需要跑一圈后再触发“完成”
        // 所以这里不直接设置 FinishLine
    };

    // 设置终点 (结束记录路径并关闭 Setup Mode)
    const handleSetFinish = () => {
        if (!recording || !startLine) return;

        const currentLoc = { lat: telemetry.lat, lon: telemetry.lon };
        setFinishLine(currentLoc);

        // 🔥 关键逻辑：自动关闭录制和 Setup 协议
        setRecording(false);
        toggleSetupMode(false);

        Alert.alert("🏁 录制完成", "终点已记录，Setup 模式已自动关闭。\n请检查路径并保存赛道。");
    };

    const handleSave = () => {
        if (!startLine) return Alert.alert("错误", "必须设置起点");
        if (points.length < 5) return Alert.alert("错误", "路径点太少，无效赛道");
        if (trackType === 'sprint' && !finishLine) return Alert.alert("错误", "点对点模式必须设置终点");

        // 如果是闭环，且用户点击了完成（finishLine有值），则使用该值
        // 如果用户没点完成（意外停止），可以用 startLine 代替，但建议必须走完流程
        const finalFinish = finishLine || startLine;

        const trackData = {
            name,
            type: trackType,
            created: new Date().toISOString(),
            startLine,
            finishLine: finalFinish,
            path: points
        };

        saveNewTrack(name, trackData);

        // 重置所有状态
        setPoints([]);
        setRecording(false);
        setStartLine(null);
        setFinishLine(null);
        setName(`Track_${new Date().getHours()}${new Date().getMinutes()}`);
    };

    return (
        <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={[styles.modeTag, { borderColor: THEME.secondary }]}>
                <Text style={[styles.modeTagText, { color: THEME.secondary }]}>TRACK CREATOR</Text>
            </View>

            {/* 1. 基础信息设置 */}
            <View style={styles.card}>
                <Text style={styles.label}>赛道名称</Text>
                <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="输入赛道名称"
                    placeholderTextColor="#666"
                />

                <Text style={[styles.label, { marginTop: 15 }]}>赛道类型</Text>
                <View style={styles.typeRow}>
                    <TouchableOpacity
                        style={[styles.typeBtn, trackType === 'circuit' && { backgroundColor: THEME.secondary }]}
                        onPress={() => setTrackType('circuit')}
                    >
                        <Text style={[styles.typeText, trackType === 'circuit' && { color: '#000' }]}>🔄 闭环 (Circuit)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.typeBtn, trackType === 'sprint' && { backgroundColor: THEME.secondary }]}
                        onPress={() => setTrackType('sprint')}
                    >
                        <Text style={[styles.typeText, trackType === 'sprint' && { color: '#000' }]}>➡️ 点对点 (Sprint)</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* 2. 模式开关 */}
            <View style={styles.row}>
                <TouchableOpacity
                    style={[styles.actionBtn, recording && { backgroundColor: THEME.danger }]}
                    onPress={handleToggleSetup}
                >
                    <Text style={styles.btnTextBlack}>
                        {recording ? "⏹ 取消/停止设置 (Setup OFF)" : "⏺ 1. 开启设置模式 (Setup ON)"}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* 3. 可视化预览区域 */}
            <View style={styles.previewBox}>
                <Text style={styles.previewTitle}>PATH PREVIEW</Text>
                {points.length > 0 ? (
                    <Svg height={CANVAS_HEIGHT} width={CANVAS_WIDTH} viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}>
                        {/* 轨迹线 */}
                        {mapData && (
                            <Polyline
                                points={mapData.pathString}
                                fill="none"
                                stroke={THEME.secondary}
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        )}
                        {/* 起点 (绿) */}
                        {mapData && mapData.startPos && (
                            <Circle cx={mapData.startPos.x} cy={mapData.startPos.y} r="5" fill="#00E676" />
                        )}
                        {/* 终点 (红) */}
                        {mapData && mapData.finishPos && (
                            <Circle cx={mapData.finishPos.x} cy={mapData.finishPos.y} r="5" fill="#FF1744" />
                        )}
                        {/* 实时位置光标 (如果是 Set Start 后) */}
                        {startLine && recording && mapData && points.length > 0 && (
                            <Circle
                                cx={mapData.pathString.split(' ').pop().split(',')[0]}
                                cy={mapData.pathString.split(' ').pop().split(',')[1]}
                                r="3" fill="#FFF"
                            />
                        )}
                    </Svg>
                ) : (
                    <View style={styles.emptyPreview}>
                        <Text style={{ color: '#444' }}>等待数据...</Text>
                        <Text style={{ color: '#333', fontSize: 10, marginTop: 5 }}>
                            {recording ? (startLine ? "正在记录路径点..." : "请点击“设为起点”开始绘图") : "请先开启设置模式"}
                        </Text>
                    </View>
                )}
                <Text style={styles.pointCount}>Points: {points.length}</Text>
            </View>

            {/* 4. 步骤控制按钮 */}
            <View style={styles.row}>
                {/* 步骤 2: 设为起点 */}
                <TouchableOpacity
                    style={[styles.outlineBtn, (!recording || startLine) && { opacity: 0.3, borderColor: '#333' }]}
                    onPress={handleSetStart}
                    disabled={!recording || !!startLine} // 录制中且未设置起点时可用
                >
                    <Text style={[styles.outlineBtnText, startLine && { color: '#00E676' }]}>
                        {startLine ? "✅ 起点已设" : "🚩 2. 设为起点 (开始记录)"}
                    </Text>
                </TouchableOpacity>

                {/* 步骤 3: 设为终点/完成 */}
                <TouchableOpacity
                    style={[styles.outlineBtn, (!recording || !startLine) && { opacity: 0.3, borderColor: '#333' }]}
                    onPress={handleSetFinish}
                    disabled={!recording || !startLine} // 录制中且已设置起点时可用
                >
                    <Text style={styles.outlineBtnText}>
                        {trackType === 'circuit' ? "🏁 3. 完成跑圈 (结束)" : "🏁 3. 设为终点 (结束)"}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* 状态文字提示 */}
            <View style={styles.statusBox}>
                <Text style={styles.statusText}>
                    {recording
                        ? (startLine ? "⚠️ 正在记录路径，到达终点请点击上方结束按钮" : "⏳ 等待设置起点...")
                        : "设备处于待机状态"}
                </Text>
            </View>

            {/* 5. 保存 */}
            <TouchableOpacity
                style={[styles.saveBtn, (!finishLine) && { backgroundColor: '#333' }]}
                onPress={handleSave}
                disabled={!finishLine}
            >
                <Text style={[styles.btnTextBlack, !finishLine && { color: '#666' }]}>
                    💾 保存赛道文件
                </Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollContent: { padding: 20, paddingBottom: 50 },
    modeTag: { alignSelf: 'center', borderWidth: 1, borderColor: THEME.secondary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, marginBottom: 20 },
    modeTagText: { color: THEME.secondary, fontSize: 10, fontWeight: 'bold' },

    card: { backgroundColor: THEME.card, padding: 15, borderRadius: 8, marginBottom: 15 },
    label: { color: '#888', fontSize: 12, marginBottom: 5 },
    input: { color: '#fff', borderBottomWidth: 1, borderColor: '#555', paddingVertical: 5, fontSize: 16 },

    typeRow: { flexDirection: 'row', marginTop: 5, gap: 10 },
    typeBtn: { flex: 1, padding: 10, borderRadius: 6, borderWidth: 1, borderColor: '#333', alignItems: 'center' },
    typeText: { color: '#888', fontWeight: 'bold', fontSize: 12 },

    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, gap: 10 },
    actionBtn: { flex: 1, backgroundColor: THEME.secondary, padding: 15, borderRadius: 8, alignItems: 'center' },
    btnTextBlack: { color: '#000', fontWeight: 'bold' },

    previewBox: {
        height: CANVAS_HEIGHT + 40, backgroundColor: '#000', borderRadius: 12,
        borderWidth: 1, borderColor: '#333', marginBottom: 20,
        alignItems: 'center', justifyContent: 'center', padding: 10
    },
    previewTitle: { position: 'absolute', top: 10, left: 15, color: '#444', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
    emptyPreview: { alignItems: 'center' },
    pointCount: { position: 'absolute', bottom: 10, right: 15, color: '#444', fontSize: 10 },

    outlineBtn: { flex: 1, borderWidth: 1, borderColor: '#555', padding: 15, borderRadius: 8, alignItems: 'center' },
    outlineBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

    statusBox: { flexDirection: 'row', justifyContent: 'center', marginVertical: 10 },
    statusText: { color: '#666', fontSize: 12, fontStyle: 'italic' },

    saveBtn: { backgroundColor: THEME.primary, padding: 18, borderRadius: 8, alignItems: 'center', marginTop: 10 },
});