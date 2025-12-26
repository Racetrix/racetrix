import React, { useState } from 'react';
import { View, SafeAreaView, StatusBar, Platform, StyleSheet } from 'react-native';
import { BluetoothProvider, useBluetooth } from '../components/BluetoothContext';
import { THEME } from '../constants/theme';
import KeepAwake from 'react-native-keep-awake';

// 引入拆分后的组件
import ConnectionScreen from '../components/screens/ConnectionScreen';
import SettingsScreen from '../components/screens/SettingsScreen';
import GyroCalibrationMode from '../components/screens/GyroCalibrationMode';
import RoamMode from '../components/screens/RoamMode';
import CreateTrackMode from '../components/screens/CreateTrackMode';
import RaceMode from '../components/screens/RaceMode';

import Header from '../components/ui/Header';
import Sidebar from '../components/ui/Sidebar';
import BottomTabBar from '../components/ui/BottomTabBar';

const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? StatusBar.currentHeight : 44;

// 主控台容器 (处理不同模式的切换)
const HomeTab = () => {
    const { heartbeat } = useBluetooth();
    const [mode, setMode] = useState('roam');
    const [sidebarOpen, setSidebarOpen] = useState(false);

    let content, title;
    switch (mode) {
        case 'roam': content = <RoamMode />; title = "漫游仪表盘"; break;
        case 'create': content = <CreateTrackMode />; title = "创建赛道"; break;
        case 'race': content = <RaceMode />; title = "赛道模式"; break;
        case 'gyro': content = <GyroCalibrationMode />; title = "传感器校准"; break;
        default: content = <RoamMode />; title = "仪表盘";
    }

    // 心跳灯
    const HeartbeatDot = () => (
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: heartbeat ? THEME.primary : '#333' }} />
    );

    return (
        <View style={{ flex: 1 }}>
            <Header
                title={title}
                leftIcon="☰"
                onLeftPress={() => setSidebarOpen(true)}
                rightContent={<HeartbeatDot />}
            />
            {content}
            <Sidebar
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                activeMode={mode}
                onSelectMode={setMode}
            />
        </View>
    );
};

// 根应用逻辑
const RootApp = () => {
    const { isConnected } = useBluetooth();
    const [activeTab, setActiveTab] = useState('home'); // 'home' | 'settings'

    // 1. 未连接 -> 显示连接页
    if (!isConnected) {
        return (
            <SafeAreaView style={styles.container}>
                <ConnectionScreen />
            </SafeAreaView>
        );
    }

    // 2. 已连接 -> 显示双层导航
    return (
        <SafeAreaView style={styles.container}>
            <View style={{ flex: 1 }}>
                {activeTab === 'home' ? (
                    <HomeTab />
                ) : (
                    <View style={{ flex: 1 }}>
                        <Header title="系统设置" leftIcon="" onLeftPress={() => { }} />
                        <SettingsScreen />
                    </View>
                )}
            </View>
            <BottomTabBar activeTab={activeTab} onChange={setActiveTab} />
        </SafeAreaView>
    );
};

export default function App() {
    return (
        <BluetoothProvider>
            <StatusBar barStyle="light-content" backgroundColor="#000" translucent={true} />
            <RootApp />
            <KeepAwake />
        </BluetoothProvider>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.bg, paddingTop: STATUS_BAR_HEIGHT },
});