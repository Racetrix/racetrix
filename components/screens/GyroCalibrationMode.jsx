import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Switch, Alert } from 'react-native';
import { useBluetooth } from '../BluetoothContext';
import { THEME } from '../../constants/theme';

export default function GyroCalibrationMode() {
    const {
        telemetry,
        gyroConfig,
        saveGyroConfig,
        previewGyroConfig, // 🔥 获取预览函数
        setRaceModeState,
        setZeroLevel,
        resetLevel
    } = useBluetooth();

    // 初始化配置
    const [config, setConfig] = useState(gyroConfig || {
        headSource: 'head', rollSource: 'roll', pitchSource: 'pitch',
        invertHead: false, invertRoll: false, invertPitch: false,
        invertLonG: false, invertLatG: false, swapG: false
    });

    // 1. 当本地 config 改变时，实时同步给 Context 进行预览计算
    // 这样不用点保存，上面的模型也会立刻跟着变
    useEffect(() => {
        previewGyroConfig(config);
    }, [config]);

    // 2. 自动开启数据流
    useEffect(() => {
        setRaceModeState(true);
        return () => setRaceModeState(false);
    }, []);

    const handleSave = () => {
        saveGyroConfig(config); // 写盘保存
        Alert.alert("✅ 保存成功", "传感器映射配置已永久生效");
    };

    const handleReset = () => {
        Alert.alert("确认重置", "恢复默认设置并清除水平校准？", [
            { text: "取消", style: "cancel" },
            {
                text: "确定重置",
                onPress: () => {
                    resetLevel();
                    const def = {
                        headSource: 'head', rollSource: 'roll', pitchSource: 'pitch',
                        invertHead: false, invertRoll: false, invertPitch: false,
                        invertLonG: false, invertLatG: false, swapG: false
                    };
                    setConfig(def);
                    saveGyroConfig(def);
                }
            }
        ]);
    };

    const val = (v) => (v || 0);

    const AxisSelector = ({ label, value, onChange }) => (
        <View style={styles.selectorContainer}>
            <Text style={styles.selectorLabel}>{label}</Text>
            <View style={styles.btnGroup}>
                {['head', 'roll', 'pitch'].map((axis) => {
                    const displayMap = { head: 'HEAD(Z)', roll: 'ROLL(X)', pitch: 'PITCH(Y)' };
                    const isActive = value === axis;
                    return (
                        <TouchableOpacity
                            key={axis}
                            style={[styles.selectBtn, isActive && styles.selectBtnActive]}
                            onPress={() => onChange(axis)}
                        >
                            <Text style={[styles.btnText, isActive && styles.selectBtnActiveText]}>
                                {displayMap[axis]}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );

    return (
        <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.modeTag}>
                <Text style={styles.modeTagText}>GYRO CALIBRATION</Text>
            </View>

            {/* --- 3D 预览 --- */}
            <View style={styles.previewContainer}>
                <Text style={styles.previewTitle}>实时姿态预览 (10 FPS)</Text>
                <View style={styles.scene}>
                    <View style={[
                        styles.box,
                        {
                            transform: [
                                { perspective: 800 },
                                { rotateX: `${val(telemetry.pitch)}deg` },
                                { rotateY: `${val(telemetry.head)}deg` },
                                { rotateZ: `${val(telemetry.roll)}deg` },
                            ]
                        }
                    ]}>
                        <View style={styles.boxContent}>
                            <Text style={styles.boxText}>TOP</Text>
                            <Text style={styles.arrow}>⬆</Text>
                        </View>
                        <View style={styles.frontFace}><Text style={styles.faceText}>F</Text></View>
                    </View>
                </View>
                <Text style={styles.hintText}>如果模型不跟随动作，请调整下方轴向映射</Text>
            </View>

            {/* --- 数值显示 --- */}
            <View style={styles.dataGrid}>
                <View style={styles.dataItem}><Text style={styles.label}>Head</Text><Text style={styles.val}>{val(telemetry.head).toFixed(0)}°</Text></View>
                <View style={styles.dataItem}><Text style={styles.label}>Roll</Text><Text style={styles.val}>{val(telemetry.roll).toFixed(1)}°</Text></View>
                <View style={styles.dataItem}><Text style={styles.label}>Pitch</Text><Text style={styles.val}>{val(telemetry.pitch).toFixed(1)}°</Text></View>
            </View>
            <View style={[styles.dataGrid, { marginTop: -10 }]}>
                <View style={styles.dataItem}><Text style={styles.label}>Lon G</Text><Text style={styles.val}>{val(telemetry.lonG).toFixed(2)}</Text></View>
                <View style={styles.dataItem}><Text style={styles.label}>Lat G</Text><Text style={styles.val}>{val(telemetry.latG).toFixed(2)}</Text></View>
            </View>

            {/* --- 1. 水平校准区 --- */}
            <View style={[styles.card, { borderColor: '#FFD700', borderWidth: 1 }]}>
                <Text style={[styles.sectionTitle, { color: '#FFD700' }]}>水平校准 (Leveling)</Text>
                <Text style={styles.hint}>* 车辆停稳在平地，点击“设为水平”将当前姿态归零。</Text>

                <View style={styles.btnRow}>
                    <TouchableOpacity style={styles.levelBtn} onPress={setZeroLevel}>
                        <Text style={styles.levelBtnText}>⚖️ 设为水平 (Set Zero)</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
                        <Text style={styles.resetBtnText}>↺ 恢复默认</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* --- 2. 轴向映射 --- */}
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>输入源映射 (Input Mapping)</Text>
                <Text style={styles.hint}>* 选择每个车身轴向对应的设备原始轴</Text>

                <View style={styles.channelBox}>
                    <Text style={styles.channelTitle}>🧭 车头朝向 (Heading)</Text>
                    <AxisSelector
                        label="输入源:"
                        value={config.headSource}
                        onChange={v => setConfig(p => ({ ...p, headSource: v }))}
                    />
                    <View style={styles.row}>
                        <Text style={styles.settingLabel}>反转方向:</Text>
                        <Switch value={config.invertHead} onValueChange={v => setConfig(p => ({ ...p, invertHead: v }))} trackColor={{ false: "#333", true: THEME.secondary }} />
                    </View>
                </View>

                <View style={styles.channelBox}>
                    <Text style={styles.channelTitle}>🚗 车身横滚 (Roll)</Text>
                    <AxisSelector
                        label="输入源:"
                        value={config.rollSource}
                        onChange={v => setConfig(p => ({ ...p, rollSource: v }))}
                    />
                    <View style={styles.row}>
                        <Text style={styles.settingLabel}>反转方向:</Text>
                        <Switch value={config.invertRoll} onValueChange={v => setConfig(p => ({ ...p, invertRoll: v }))} trackColor={{ false: "#333", true: THEME.secondary }} />
                    </View>
                </View>

                <View style={styles.channelBox}>
                    <Text style={styles.channelTitle}>🚗 车身俯仰 (Pitch)</Text>
                    <AxisSelector
                        label="输入源:"
                        value={config.pitchSource}
                        onChange={v => setConfig(p => ({ ...p, pitchSource: v }))}
                    />
                    <View style={styles.row}>
                        <Text style={styles.settingLabel}>反转方向:</Text>
                        <Switch value={config.invertPitch} onValueChange={v => setConfig(p => ({ ...p, invertPitch: v }))} trackColor={{ false: "#333", true: THEME.secondary }} />
                    </View>
                </View>

                {/* G值设置 */}
                <View style={[styles.channelBox, { borderBottomWidth: 0 }]}>
                    <Text style={styles.channelTitle}>📐 G值设置</Text>
                    <View style={styles.row}>
                        <Text style={styles.settingLabel}>交换 G 值 (Lon/Lat):</Text>
                        <Switch value={config.swapG} onValueChange={v => setConfig(p => ({ ...p, swapG: v }))} trackColor={{ false: "#333", true: THEME.primary }} />
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.settingLabel}>反转纵向 G (加速):</Text>
                        <Switch value={config.invertLonG} onValueChange={v => setConfig(p => ({ ...p, invertLonG: v }))} trackColor={{ false: "#333", true: THEME.secondary }} />
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.settingLabel}>反转侧向 G (过弯):</Text>
                        <Switch value={config.invertLatG} onValueChange={v => setConfig(p => ({ ...p, invertLatG: v }))} trackColor={{ false: "#333", true: THEME.secondary }} />
                    </View>
                </View>
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>💾 保存映射配置</Text>
            </TouchableOpacity>
            <View style={{ height: 30 }} />

        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollContent: { padding: 20, paddingBottom: 50 },
    modeTag: { alignSelf: 'center', borderWidth: 1, borderColor: '#00E676', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, marginBottom: 20 },
    modeTagText: { color: '#00E676', fontSize: 10, fontWeight: 'bold' },

    previewContainer: { alignItems: 'center', marginBottom: 20, height: 220, justifyContent: 'center', backgroundColor: '#050505', borderRadius: 12, borderWidth: 1, borderColor: '#333' },
    previewTitle: { position: 'absolute', top: 10, left: 15, color: '#666', fontSize: 10, fontWeight: 'bold' },
    scene: { width: 150, height: 150, alignItems: 'center', justifyContent: 'center' },
    box: { width: 100, height: 140, backgroundColor: 'rgba(0, 230, 118, 0.2)', borderWidth: 2, borderColor: '#00E676', borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
    boxContent: { alignItems: 'center' },
    boxText: { color: '#00E676', fontWeight: 'bold', fontSize: 10 },
    arrow: { color: '#00E676', fontSize: 24, marginTop: 5 },
    frontFace: { position: 'absolute', bottom: 5, width: '100%', alignItems: 'center', borderTopWidth: 1, borderColor: 'rgba(0,255,0,0.3)' },
    faceText: { color: 'rgba(0,255,0,0.5)', fontSize: 8 },
    hintText: { position: 'absolute', bottom: 10, color: '#555', fontSize: 10, fontStyle: 'italic' },

    dataGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    dataItem: { flex: 1, marginHorizontal: 2, backgroundColor: THEME.card, padding: 8, borderRadius: 6, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
    label: { color: '#888', fontSize: 10, marginBottom: 2 },
    val: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

    card: { backgroundColor: THEME.card, padding: 15, borderRadius: 8, marginBottom: 20 },
    sectionTitle: { color: THEME.primary, fontSize: 14, fontWeight: 'bold', marginBottom: 5 },
    hint: { color: '#666', fontSize: 10, marginBottom: 15, fontStyle: 'italic' },

    btnRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
    levelBtn: { flex: 1, backgroundColor: THEME.primary, padding: 12, borderRadius: 6, alignItems: 'center' },
    levelBtnText: { color: '#000', fontWeight: 'bold' },
    resetBtn: { flex: 1, backgroundColor: '#333', padding: 12, borderRadius: 6, alignItems: 'center', borderWidth: 1, borderColor: '#555' },
    resetBtnText: { color: '#fff' },

    channelBox: { marginBottom: 15, borderBottomWidth: 1, borderColor: '#333', paddingBottom: 10 },
    channelTitle: { color: '#fff', fontSize: 12, fontWeight: 'bold', marginBottom: 10, backgroundColor: '#222', padding: 5, borderRadius: 4 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    settingLabel: { color: '#ccc', fontSize: 12 },

    selectorContainer: { marginBottom: 8 },
    selectorLabel: { color: '#ccc', fontSize: 12, marginBottom: 5 },
    btnGroup: { flexDirection: 'row', gap: 8 },
    selectBtn: { flex: 1, paddingVertical: 8, backgroundColor: '#222', borderRadius: 4, borderWidth: 1, borderColor: '#444', alignItems: 'center' },
    selectBtnActive: { backgroundColor: THEME.primary, borderColor: THEME.primary },
    btnText: { color: '#888', fontSize: 10, fontWeight: 'bold' },
    selectBtnActiveText: { color: '#000' },

    saveBtn: { backgroundColor: THEME.primary, padding: 18, borderRadius: 8, alignItems: 'center' },
    saveBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 }
});