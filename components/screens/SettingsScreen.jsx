import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal, FlatList, Alert, Platform, TextInput } from 'react-native';
import RNFS from 'react-native-fs';
import { useBluetooth } from '../../components/BluetoothContext'; // 请确认路径
import { THEME } from '../../constants/theme';

export default function SettingsScreen() {
    const {
        device, disconnect, sendCmd, recInfo, storageLocation, setStorageLocation,
        isConnected, status, telemetry, playBeep,
        // 🔥 新增：密码相关状态与函数
        authKey, setAuthKey, changeDevicePassword
    } = useBluetooth();

    // --- 本地状态 ---
    const [modalVisible, setModalVisible] = useState(false);
    const [fileList, setFileList] = useState([]);
    const [newPassInput, setNewPassInput] = useState(''); // 新密码输入框状态

    // --- 文件管理逻辑 (保持不变) ---
    const currentPath = storageLocation === 'external'
        ? `${RNFS.ExternalDirectoryPath}/RaceRecords`
        : `${RNFS.DocumentDirectoryPath}/RaceRecords`;

    const loadFiles = async () => {
        try {
            if (await RNFS.exists(currentPath)) {
                const files = await RNFS.readDir(currentPath);
                const sortedFiles = files.filter(f => f.isFile()).sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
                setFileList(sortedFiles);
            } else { setFileList([]); }
        } catch (e) { console.log(e); }
    };

    const openFileModal = () => { loadFiles(); setModalVisible(true); };

    const handleDelete = (item) => {
        Alert.alert("确认删除", `删除 ${item.name}？`, [
            { text: "取消", style: "cancel" },
            { text: "删除", style: "destructive", onPress: async () => { await RNFS.unlink(item.path); loadFiles(); } }
        ]);
    };

    const formatSize = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024; const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    // --- 功能测试 ---
    const handleTestSound = () => {
        console.log("测试声音...");
        playBeep();
        Alert.alert("提示音测试", "你应该能听到 '哔' 的一声。\n如果没有，请检查媒体音量。");
    };

    // --- 🔥 登录与鉴权 ---
    const handleLogin = () => {
        if (!device) return Alert.alert("提示", "请先连接蓝牙设备");
        sendCmd(`KEY:${authKey}`);
    };

    // --- 🔥 修改密码 ---
    const handleChangePass = () => {
        Alert.alert("确认修改", `确定将设备密码修改为 "${newPassInput}" 吗？\n\n注意：修改成功后，请牢记新密码！`, [
            { text: "取消", style: "cancel" },
            {
                text: "确定修改",
                onPress: async () => {
                    await changeDevicePassword(newPassInput);
                    // 乐观更新：假设成功，自动填充为新密码以便下次登录
                    setAuthKey(newPassInput);
                    setNewPassInput('');
                }
            }
        ]);
    };

    return (
        <ScrollView contentContainerStyle={styles.scrollContent}>

            {/* 🔥 1. 设备连接与登录 (核心控制区) */}
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>设备连接与登录</Text>

                {device ? (
                    <View style={{ marginBottom: 10 }}>
                        <Text style={styles.val}>{device.name}</Text>
                        <Text style={styles.label}>{device.address}</Text>
                    </View>
                ) : (
                    <Text style={[styles.val, { color: THEME.danger, marginBottom: 10 }]}>❌ 未连接</Text>
                )}

                <View style={styles.statRow}>
                    <Text style={styles.label}>连接状态: </Text>
                    <Text style={{ color: isConnected ? THEME.primary : THEME.danger, fontWeight: 'bold' }}>
                        {isConnected ? "已连接" : "断开"}
                    </Text>
                </View>

                <View style={styles.statRow}>
                    <Text style={styles.label}>鉴权状态: </Text>
                    <Text style={{ color: status.authenticated ? THEME.secondary : '#FFD700', fontWeight: 'bold' }}>
                        {status.authenticated ? "✅ 已登录 (Auth OK)" : "🔒 未登录"}
                    </Text>
                </View>

                {/* 密码输入与登录按钮 */}
                <View style={styles.inputBox}>
                    <Text style={styles.inputLabel}>当前设备密码:</Text>
                    <View style={styles.row}>
                        <TextInput
                            style={styles.input}
                            value={authKey}
                            onChangeText={setAuthKey}
                            placeholder="默认1234"
                            placeholderTextColor="#666"
                            secureTextEntry={true}
                            keyboardType="numeric"
                        />
                        <TouchableOpacity style={styles.btnSmall} onPress={handleLogin}>
                            <Text style={styles.btnTextBlack}>🔐 登录/鉴权</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* 🔥 2. 修改密码 (仅登录后显示) */}
            {status.authenticated && (
                <View style={[styles.card, { borderColor: THEME.secondary }]}>
                    <Text style={[styles.sectionTitle, { color: THEME.secondary }]}>修改设备密码</Text>
                    <Text style={styles.hint}>* 修改后旧密码将失效，请牢记新密码。</Text>

                    <View style={styles.inputBox}>
                        <Text style={styles.inputLabel}>输入新密码:</Text>
                        <View style={styles.row}>
                            <TextInput
                                style={styles.input}
                                value={newPassInput}
                                onChangeText={setNewPassInput}
                                placeholder="例如 6666"
                                placeholderTextColor="#666"
                                keyboardType="numeric"
                            />
                            <TouchableOpacity style={[styles.btnSmall, { backgroundColor: THEME.secondary }]} onPress={handleChangePass}>
                                <Text style={styles.btnTextBlack}>💾 确认修改</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}

            {/* 3. 实时状态监控 */}
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>实时状态监控</Text>
                <View style={styles.statGrid}>
                    <View style={styles.statItem}><Text style={styles.statLabel}>定位状态</Text><Text style={[styles.statVal, { color: status.gpsFix ? THEME.primary : THEME.danger }]}>{status.gpsFix ? "3D FIX" : "NO FIX"}</Text></View>
                    <View style={styles.statItem}><Text style={styles.statLabel}>卫星数量</Text><Text style={styles.statVal}>{telemetry.sats} <Text style={{ fontSize: 12, color: '#666' }}>颗</Text></Text></View>
                    <View style={styles.statItem}><Text style={styles.statLabel}>录制状态</Text><Text style={[styles.statVal, { color: status.recording ? THEME.danger : '#666' }]}>{status.recording ? "● REC" : "IDLE"}</Text></View>
                    <View style={styles.statItem}><Text style={styles.statLabel}>模式</Text><Text style={styles.statVal}>{status.raceMode ? "RACE" : "ROAM"}</Text></View>
                </View>
            </View>

            {/* 4. 系统功能测试 */}
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>系统功能测试</Text>
                <View style={styles.rowSpaced}>
                    <Text style={styles.label}>过线提示音</Text>
                    <TouchableOpacity style={styles.testBtn} onPress={handleTestSound}>
                        <Text style={styles.btnTextBlack}>🔊 播放测试</Text>
                    </TouchableOpacity>
                </View>
                <Text style={styles.pathHint}>* 用于测试“经过起终点”时的蜂鸣声</Text>
            </View>

            {/* 5. 存储路径设置 */}
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>存储路径设置</Text>
                <View style={styles.toggleRow}>
                    <TouchableOpacity style={[styles.toggleBtn, storageLocation === 'external' && { backgroundColor: THEME.primary }]} onPress={() => setStorageLocation('external')}><Text style={{ color: storageLocation === 'external' ? '#000' : '#fff', fontWeight: 'bold' }}>外部存储</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.toggleBtn, storageLocation === 'internal' && { backgroundColor: THEME.primary }]} onPress={() => setStorageLocation('internal')}><Text style={{ color: storageLocation === 'internal' ? '#000' : '#fff', fontWeight: 'bold' }}>内部存储</Text></TouchableOpacity>
                </View>
                <View style={styles.pathBox}>
                    <Text style={styles.pathLabel}>PC导出路径:</Text>
                    <Text style={styles.pathText}>{currentPath}</Text>
                    <Text style={[styles.pathHint, { color: THEME.secondary, marginTop: 5 }]}>
                        💡 使用 USB 线连接手机和电脑，进入该目录即可直接复制 CSV 文件。
                    </Text>
                </View>
            </View>

            {/* 6. 录制数据管理 */}
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>录制数据管理</Text>
                <View style={styles.rowSpaced}>
                    <View><Text style={styles.label}>本次记录点数</Text><Text style={styles.val}>{recInfo.count}</Text></View>
                    <View style={{ alignItems: 'flex-end' }}><Text style={styles.label}>当前文件</Text><Text style={[styles.val, { fontSize: 12 }]} numberOfLines={1}>{recInfo.currentFile ? recInfo.currentFile.split('/').pop() : '无'}</Text></View>
                </View>
                <TouchableOpacity style={styles.actionBtn} onPress={openFileModal}><Text style={styles.btnTextBlack}>📂 管理历史文件 (删除)</Text></TouchableOpacity>
            </View>

            {/* 断开连接按钮 */}
            <TouchableOpacity style={styles.logoutBtn} onPress={disconnect}><Text style={{ color: THEME.danger, fontWeight: 'bold' }}>🛑 断开蓝牙连接</Text></TouchableOpacity>

            {/* --- 文件列表弹窗 (Modal) --- */}
            <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}><Text style={styles.modalTitle}>本地数据文件</Text><TouchableOpacity onPress={() => setModalVisible(false)}><Text style={styles.closeText}>关闭</Text></TouchableOpacity></View>
                        {fileList.length === 0 ? (<View style={styles.emptyBox}><Text style={styles.label}>暂无文件</Text></View>) : (
                            <FlatList
                                data={fileList}
                                keyExtractor={item => item.path}
                                renderItem={({ item }) => (
                                    <View style={styles.fileItem}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.fileName}>{item.name}</Text>
                                            <Text style={styles.fileInfo}>{formatSize(item.size)} | {new Date(item.mtime).toLocaleString()}</Text>
                                        </View>
                                        <View style={styles.fileActions}>
                                            <TouchableOpacity style={[styles.miniBtn, { backgroundColor: '#330000', marginLeft: 8 }]} onPress={() => handleDelete(item)}>
                                                <Text style={{ fontSize: 16 }}>🗑️</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}
                            />
                        )}
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollContent: { padding: 20, paddingBottom: 50 },
    card: { backgroundColor: THEME.card, padding: 15, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: THEME.border },
    sectionTitle: { color: THEME.primary, fontSize: 14, fontWeight: 'bold', marginBottom: 10 },

    // 文字样式
    val: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    label: { color: '#888', fontSize: 12, marginTop: 2 },
    hint: { color: '#666', fontSize: 10, marginBottom: 10, fontStyle: 'italic' },

    // 网格与行布局
    statGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    statItem: { width: '48%', backgroundColor: '#111', padding: 10, borderRadius: 6, marginBottom: 8 },
    statLabel: { color: '#666', fontSize: 10, marginBottom: 4 },
    statVal: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
    statRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
    row: { flexDirection: 'row', gap: 10 },
    rowSpaced: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

    // 输入框与按钮
    inputBox: { marginTop: 15, backgroundColor: '#111', padding: 10, borderRadius: 6 },
    inputLabel: { color: '#888', fontSize: 10, marginBottom: 5 },
    input: { flex: 1, backgroundColor: '#222', color: '#fff', paddingHorizontal: 10, borderRadius: 4, height: 40, borderWidth: 1, borderColor: '#444' },
    btnSmall: { backgroundColor: THEME.primary, paddingHorizontal: 15, justifyContent: 'center', borderRadius: 4, height: 40 },
    btnTextBlack: { color: '#000', fontWeight: 'bold', fontSize: 12 },
    testBtn: { backgroundColor: THEME.primary, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
    actionBtn: { marginTop: 15, backgroundColor: '#333', padding: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#555' },
    logoutBtn: { padding: 20, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: THEME.danger, borderRadius: 8 },

    // 路径显示
    pathBox: { marginTop: 15, backgroundColor: '#111', padding: 10, borderRadius: 6 },
    pathLabel: { color: '#888', fontSize: 10, marginBottom: 2 },
    pathText: { color: THEME.secondary, fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
    pathHint: { color: '#555', fontSize: 10, fontStyle: 'italic' },

    // Toggle
    toggleRow: { flexDirection: 'row', backgroundColor: '#000', borderRadius: 8, padding: 2 },
    toggleBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 6 },

    // Modal
    modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.8)' },
    modalContent: { height: '70%', backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderColor: '#333', paddingBottom: 15 },
    modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    closeText: { color: THEME.secondary, fontSize: 16 },
    emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    fileItem: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#333', alignItems: 'center' },
    fileName: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
    fileInfo: { color: '#666', fontSize: 10 },
    fileActions: { flexDirection: 'row' },
    miniBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
});