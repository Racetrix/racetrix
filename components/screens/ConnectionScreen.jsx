import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import RNBluetoothClassic from 'react-native-bluetooth-classic';
import AsyncStorage from '@react-native-async-storage/async-storage'; // 引入存储
import { useBluetooth } from '../BluetoothContext';
import { THEME } from '../../constants/theme';

export default function ConnectionScreen() {
    const { connect } = useBluetooth();
    const [list, setList] = useState([]);
    const [scanning, setScanning] = useState(false);
    const [lastAddr, setLastAddr] = useState(null); // 上次连接的地址

    // 🔥 1. 初始化时加载上次连接的地址
    useEffect(() => {
        const loadLastDevice = async () => {
            try {
                const addr = await AsyncStorage.getItem('last_device_address');
                if (addr) setLastAddr(addr);
            } catch (e) { }
        };
        loadLastDevice();
    }, []);

    const scan = async () => {
        setScanning(true);
        setList([]);
        try {
            const devices = await RNBluetoothClassic.startDiscovery();

            // 可选：把上次连接的设备排到第一位
            if (lastAddr) {
                devices.sort((a, b) => (a.address === lastAddr ? -1 : 1));
            }

            setList(devices);
        } catch (e) {
            console.log(e);
        } finally {
            setScanning(false);
        }
    };

    return (
        <View style={styles.centerBox}>
            <View style={styles.heroSection}>
                <Text style={styles.heroTitle}>RACEBOX</Text>
                <Text style={styles.heroSub}>TELEMETRY SYSTEM</Text>
            </View>

            <TouchableOpacity style={styles.scanBtn} onPress={scan} disabled={scanning}>
                {scanning ? <ActivityIndicator color="#000" /> : <Text style={styles.btnTextBlack}>扫描蓝牙设备</Text>}
            </TouchableOpacity>

            <FlatList
                data={list}
                keyExtractor={i => i.address}
                style={{ width: '100%', marginTop: 20 }}
                contentContainerStyle={{ paddingBottom: 40 }}
                renderItem={({ item }) => {
                    // 🔥 2. 判断是否是上次连接的设备
                    const isLast = item.address === lastAddr;
                    return (
                        <TouchableOpacity
                            style={[styles.devItem, isLast && styles.devItemHighlight]}
                            onPress={() => connect(item)}
                        >
                            <View>
                                <Text style={[styles.devName, isLast && { color: THEME.primary }]}>
                                    {item.name || "Unknown Device"}
                                </Text>
                                <Text style={styles.devAddr}>{item.address}</Text>
                            </View>
                            {isLast ? (
                                <View style={styles.lastTag}>
                                    <Text style={styles.lastTagText}>上次连接</Text>
                                </View>
                            ) : (
                                <Text style={styles.connectIcon}>ᐳ</Text>
                            )}
                        </TouchableOpacity>
                    );
                }}
                ListEmptyComponent={
                    !scanning && <Text style={styles.emptyText}>未发现设备，请点击扫描</Text>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    centerBox: { flex: 1, alignItems: 'center', padding: 30, paddingTop: 80, backgroundColor: THEME.bg },
    heroSection: { alignItems: 'center', marginBottom: 50 },
    heroTitle: { fontSize: 32, fontWeight: '900', color: THEME.primary, letterSpacing: 2, fontStyle: 'italic' },
    heroSub: { color: '#666', marginTop: 5, letterSpacing: 4, fontSize: 10 },

    scanBtn: { backgroundColor: THEME.primary, paddingHorizontal: 40, paddingVertical: 15, borderRadius: 30, elevation: 5 },
    btnTextBlack: { color: '#000', fontWeight: 'bold', fontSize: 16 },

    devItem: { backgroundColor: THEME.card, padding: 20, borderRadius: 8, marginBottom: 10, width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: THEME.border },
    devItemHighlight: { borderColor: THEME.primary, borderWidth: 1, backgroundColor: '#051105' }, // 高亮样式
    devName: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    devAddr: { color: '#666', fontSize: 12, marginTop: 4 },
    connectIcon: { color: THEME.primary, fontSize: 20, fontWeight: 'bold' },

    lastTag: { backgroundColor: 'rgba(0, 230, 118, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
    lastTagText: { color: THEME.primary, fontSize: 10, fontWeight: 'bold' },

    emptyText: { color: '#444', marginTop: 20 }
});