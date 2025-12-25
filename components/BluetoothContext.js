// [BluetoothContext.js]
import React, { createContext, useState, useEffect, useRef, useContext } from 'react';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import RNBluetoothClassic from 'react-native-bluetooth-classic';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Sound from 'react-native-sound';

// ❌ 已移除 DocumentPicker 和 Share

const BluetoothContext = createContext();

Sound.setCategory('Playback');

export const BluetoothProvider = ({ children }) => {
    // --- 基础状态 ---
    const [device, setDevice] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [telemetry, setTelemetry] = useState({ speed: 0.0, sats: 0, lat: 0.0, lon: 0.0, alt: 0.0 });
    const [status, setStatus] = useState({ gpsFix: false, authenticated: false, recording: false, raceMode: false });
    const [recInfo, setRecInfo] = useState({ count: 0, currentFile: null });
    const [savedTracks, setSavedTracks] = useState([]);
    const [storageLocation, setStorageLocation] = useState('external');
    const [heartbeat, setHeartbeat] = useState(false);
    const [activeTrack, setActiveTrack] = useState(null);
    const [lapStats, setLapStats] = useState({ currentLapTime: 0, lastLapTime: 0, isRacing: false });
    const [authKey, setAuthKey] = useState('1234');

    // 🔥 修改：默认触发误差改为 3米
    const [triggerRadius, setTriggerRadius] = useState(3);

    // --- Refs ---
    const raceModeRef = useRef(false);
    const recordingPathRef = useRef(null);
    const recordCountRef = useRef(0);
    const readIntervalRef = useRef(null);
    const stringBuffer = useRef("");
    const lastUpdateRef = useRef(Date.now());

    // 门控逻辑 Ref
    const isInsideStartGateRef = useRef(false);
    const isInsideFinishGateRef = useRef(false);

    const beepSoundRef = useRef(null);
    const startTimeRef = useRef(0);
    const isRacingRef = useRef(false);
    const isRecordingRef = useRef(false); // 标记是否正在写文件


    useEffect(() => {
        initPermissions();
        refreshTrackList();
        beepSoundRef.current = new Sound('beep.mp3', Sound.MAIN_BUNDLE, (e) => { });
        return () => { disconnect(); if (beepSoundRef.current) beepSoundRef.current.release(); };
    }, []);

    const initPermissions = async () => { if (Platform.OS === 'android') { await PermissionsAndroid.requestMultiple([PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT, PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE, PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE]); } };
    const getBasePath = () => storageLocation === 'external' ? RNFS.ExternalDirectoryPath : RNFS.DocumentDirectoryPath;

    const refreshTrackList = async () => { const dir = `${getBasePath()}/SavedTracks`; if (!(await RNFS.exists(dir))) await RNFS.mkdir(dir); const files = await RNFS.readDir(dir); setSavedTracks(files.filter(f => f.name.endsWith('.json')).map(f => f.path)); };

    const saveNewTrack = async (trackName, trackData) => { const dir = `${getBasePath()}/SavedTracks`; if (!(await RNFS.exists(dir))) await RNFS.mkdir(dir); const path = `${dir}/${trackName.replace(/[^a-zA-Z0-9]/g, '_')}.json`; await RNFS.writeFile(path, JSON.stringify(trackData, null, 2), 'utf8'); await refreshTrackList(); Alert.alert("✅ 保存成功", path); };

    const loadTrackToMemory = async (filePath) => {
        try {
            const content = await RNFS.readFile(filePath, 'utf8');
            const trackData = JSON.parse(content);
            if (trackData.startLine) {
                setActiveTrack(trackData);
                setLapStats({ currentLapTime: 0, lastLapTime: 0, isRacing: false });
                isRacingRef.current = false;
                // 重置门控状态，防止加载新赛道时误触
                isInsideStartGateRef.current = false;
                isInsideFinishGateRef.current = false;
                Alert.alert("🏁 赛道就绪", `目标：${trackData.name}\n默认误差：${triggerRadius}米\n请前往起点。`);
            }
        } catch (e) { Alert.alert("加载失败", e.message); }
    };

    // --- 录制控制 ---
    const startRecording = async () => {
        if (isRecordingRef.current) return;
        const dir = `${getBasePath()}/RaceRecords`;
        if (!(await RNFS.exists(dir))) await RNFS.mkdir(dir);
        const now = new Date();
        const timeName = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
        const pathC = `${dir}/Session_${timeName}.csv`;
        await RNFS.writeFile(pathC, "Time,Lat,Lon,Alt,Speed_kmh,Sats,Fix\n", 'utf8');
        recordingPathRef.current = pathC;
        recordCountRef.current = 0;
        isRecordingRef.current = true;
        setRecInfo({ count: 0, currentFile: pathC });
        setStatus(p => ({ ...p, recording: true }));
        console.log("📂 录制开始");
    };

    const writeRecord = async (pkt) => {
        if (!isRecordingRef.current || !recordingPathRef.current) return;
        const now = new Date();
        const line = `${now.toISOString()},${pkt.lat.toFixed(8)},${pkt.lon.toFixed(8)},${pkt.alt.toFixed(2)},${pkt.spd.toFixed(2)},${pkt.sats},${pkt.fix}\n`;
        try { await RNFS.appendFile(recordingPathRef.current, line, 'utf8'); recordCountRef.current += 1; setRecInfo(p => ({ ...p, count: recordCountRef.current })); } catch (e) { }
    };

    const stopRecording = () => {
        if (!isRecordingRef.current) return;
        recordingPathRef.current = null;
        recordCountRef.current = 0;
        isRecordingRef.current = false;
        setStatus(p => ({ ...p, recording: false }));
        console.log("🛑 录制结束");
    };

    // --- 连接与指令 ---
    const connect = async (selectedDevice) => { try { const connected = await selectedDevice.connect(); if (connected) { setDevice(selectedDevice); setIsConnected(true); stringBuffer.current = ""; await AsyncStorage.setItem('last_device_address', selectedDevice.address); startReadingLoop(selectedDevice); setTimeout(() => sendAuth(selectedDevice), 1500); setTimeout(() => sendAuth(selectedDevice), 2500); return true; } } catch (e) { return false; } };
    const sendAuth = async (d) => {
        try {
            // 使用当前状态里的 authKey
            const cmd = `KEY:${authKey}`;
            console.log(`🔐 发送鉴权: ${cmd}`);
            await d.write(cmd + '\r\n');
        } catch (e) { }
    };

    const changeDevicePassword = async (newPass) => {
        if (!status.authenticated) {
            Alert.alert("操作被拒绝", "🔒 必须先登录 (鉴权成功) 才能修改密码！");
            return;
        }
        if (!newPass || newPass.length === 0) {
            Alert.alert("错误", "新密码不能为空");
            return;
        }

        try {
            const cmd = `CMD:SET_PASS:${newPass}`;
            console.log(`🛠 发送修改密码指令: ${cmd}`);
            await sendCmd(cmd);

            // 乐观更新：既然发送了修改指令，我们暂时假设用户想用新密码
            // 但最好等到收到 "MSG:Password Updated" 再确认
        } catch (e) {
            Alert.alert("发送失败", e.message);
        }
    };
    const disconnect = async () => { if (readIntervalRef.current) clearInterval(readIntervalRef.current); if (device) { try { await device.disconnect(); } catch (e) { } } setDevice(null); setIsConnected(false); setStatus({ gpsFix: false, authenticated: false, recording: false, raceMode: false }); setTelemetry({ speed: 0.0, sats: 0, lat: 0.0, lon: 0.0, alt: 0.0 }); raceModeRef.current = false; recordingPathRef.current = null; recordCountRef.current = 0; };
    const sendCmd = async (cmd) => { if (device) await device.write(cmd + '\n'); };
    const getDistance = (lat1, lon1, lat2, lon2) => { const R = 6371e3; const φ1 = lat1 * Math.PI / 180; const φ2 = lat2 * Math.PI / 180; const Δφ = (lat2 - lat1) * Math.PI / 180; const Δλ = (lon2 - lon1) * Math.PI / 180; const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2); return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); };
    const playBeep = () => { if (beepSoundRef.current) { beepSoundRef.current.stop(() => { beepSoundRef.current.play(); }); } };

    // --- 🔥 手动控制修改 ---
    const manualStartRace = () => {
        // 强制开启录制
        startRecording();

        startTimeRef.current = Date.now();
        isRacingRef.current = true;
        setLapStats(p => ({ ...p, isRacing: true, currentLapTime: 0 }));
        playBeep();
        console.log("▶ 手动强制开始比赛");
    };

    const manualStopRace = () => {
        if (isRacingRef.current) {
            const finalTime = Date.now() - startTimeRef.current;
            isRacingRef.current = false;
            setLapStats({ isRacing: false, lastLapTime: finalTime, currentLapTime: finalTime });

            // 强制停止录制
            stopRecording();
            console.log("⏹ 手动强制结束比赛");
        }
    };

    // --- 漫游录制开关 ---
    const toggleRoamRecording = () => {
        if (status.recording) {
            setRaceModeState(false);
            stopRecording();
        } else {
            setRaceModeState(true);
            startRecording();
        }
    };

    // --- 赛道模式开关 ---
    const setRaceModeState = (isActive) => {
        raceModeRef.current = isActive;
        setStatus(p => ({ ...p, raceMode: isActive }));
        if (isActive) {
            sendCmd('CMD:RACE_ON');
        } else {
            sendCmd('CMD:RACE_OFF');
            if (isRecordingRef.current) stopRecording();
            setTelemetry(p => ({ ...p, speed: 0.0 }));
        }
    };

    // --- 设置模式开关 (Track Creator) ---
    const toggleSetupMode = (enable) => {
        // ... (保持 setup mode 逻辑不变，省略以节省空间) ...
        // 如果需要完整代码请参考之前的，这里为了聚焦 RaceMode 问题暂时简化
        if (enable) { sendCmd('CMD:SETUP_ON'); } else { sendCmd('CMD:SETUP_OFF'); }
    };

    const startReadingLoop = (d) => { const read = async () => { try { if (!d || !(await d.isConnected())) { disconnect(); return; } const av = await d.available(); if (av > 0) { const da = await d.read(); if (da) { stringBuffer.current += da; processBuffer(); } } } catch (e) { } }; readIntervalRef.current = setInterval(read, 30); };
    const processBuffer = () => { let buf = stringBuffer.current; if (!buf.includes('$')) { if (buf.length > 2000) stringBuffer.current = ""; return; } const f = buf.indexOf('$'); if (f > 0) buf = buf.substring(f); const p = buf.split('$'); if (p.length < 2) return; for (let i = 1; i < p.length - 1; i++) parsePacket('$' + p[i]); stringBuffer.current = '$' + p[p.length - 1]; };

    // --- 🔥 核心解析与触发逻辑 ---
    const parsePacket = (packet) => {
        const line = packet.trim();
        if (Date.now() - lastUpdateRef.current > 500) { lastUpdateRef.current = Date.now(); setHeartbeat(p => !p); }
        if (line.includes("Auth OK")) setStatus(p => ({ ...p, authenticated: true }));
        if (line.includes("Password Updated")) {
            Alert.alert("✅ 修改成功", "设备密码已更新，请牢记新密码！");
            // 这里可以做一个逻辑：自动把 App 本地存储的 authKey 更新为用户刚才输入的
            // 但为了安全，建议让用户自己在输入框确认
        }

        // 增加对 $ST 包的简单处理兼容 (如果有)
        if (line.startsWith("$ST")) {
            const parts = line.split(',');
            if (parts.length >= 5) setTelemetry(p => ({ ...p, sats: parseInt(parts[2]), lat: parseFloat(parts[3]), lon: parseFloat(parts[4]) }));
            return;
        }

        if (line.startsWith("$RC")) {
            if (!raceModeRef.current) return;

            const parts = line.split(',');
            if (parts.length >= 7) {
                const spd = parseFloat(parts[5]); const lat = parseFloat(parts[3]); const lon = parseFloat(parts[4]);

                if (!isNaN(spd)) {
                    // 1. 更新UI
                    setTelemetry({ speed: spd, sats: parseInt(parts[2]), lat, lon, alt: parseFloat(parts[6]) });
                    setStatus(p => ({ ...p, gpsFix: parseInt(parts[1]) === 1 }));

                    // 2. 录制数据 (如果在录制中)
                    if (isRecordingRef.current) {
                        writeRecord({ lat, lon, alt: parseFloat(parts[6]), spd, sats: parseInt(parts[2]), fix: parseInt(parts[1]) });
                    }

                    // 3. 自动触发逻辑 (仅在 activeTrack 存在且 GPS fix 时)
                    if (activeTrack && parseInt(parts[1]) === 1) {
                        const now = Date.now();
                        const distStart = getDistance(lat, lon, activeTrack.startLine.lat, activeTrack.startLine.lon);

                        // 🟢 起点触发 / 跑圈逻辑
                        // 使用 triggerRadius (3m)
                        if (distStart < triggerRadius) {
                            // 打印距离帮助调试
                            // console.log(`Dist to Start: ${distStart.toFixed(2)}m (Threshold: ${triggerRadius}m)`);

                            if (!isInsideStartGateRef.current) {
                                // 防抖 (防止 10秒内重复触发起点)
                                if (!isRacingRef.current || (now - startTimeRef.current > 10000)) {
                                    console.log(`🚦 触发起点/计时点! (Dist: ${distStart.toFixed(2)}m)`);
                                    playBeep();

                                    // 自动开始录制
                                    startRecording();

                                    // 计时状态管理
                                    if (isRacingRef.current && activeTrack.type === 'circuit') {
                                        // 跑圈：结算上一圈
                                        const lapTime = now - startTimeRef.current;
                                        setLapStats({ isRacing: true, lastLapTime: lapTime, currentLapTime: 0 });
                                    } else {
                                        // 首次起步
                                        setLapStats(p => ({ ...p, isRacing: true }));
                                    }

                                    startTimeRef.current = now;
                                    isRacingRef.current = true;
                                }
                                isInsideStartGateRef.current = true;
                            }
                        } else {
                            isInsideStartGateRef.current = false;
                        }

                        // 🏁 终点触发 (仅限点对点 Sprint 模式)
                        // 如果是 Circuit，终点坐标就是起点坐标，上面已经处理了
                        if (isRacingRef.current && activeTrack.finishLine && activeTrack.type === 'sprint') {
                            const distFinish = getDistance(lat, lon, activeTrack.finishLine.lat, activeTrack.finishLine.lon);
                            const minTime = 5000; // 最小比赛时间 5秒

                            if (distFinish < triggerRadius && (now - startTimeRef.current > minTime)) {
                                if (!isInsideFinishGateRef.current) {
                                    console.log(`🏁 触发终点! (Dist: ${distFinish.toFixed(2)}m)`);
                                    playBeep();

                                    const finalTime = now - startTimeRef.current;
                                    isRacingRef.current = false;
                                    setLapStats({ isRacing: false, lastLapTime: finalTime, currentLapTime: finalTime });

                                    // 自动停止录制
                                    stopRecording();
                                    Alert.alert("🏁 完成", `成绩: ${(finalTime / 1000).toFixed(2)}秒`);

                                    isInsideFinishGateRef.current = true;
                                }
                            } else {
                                isInsideFinishGateRef.current = false;
                            }
                        }
                    }
                }
            }
        }
    };

    return (
        <BluetoothContext.Provider value={{
            device, isConnected, telemetry, status, recInfo, storageLocation, heartbeat, savedTracks, activeTrack, lapStats,
            setStorageLocation, connect, disconnect, sendCmd, saveNewTrack, refreshTrackList, loadTrackToMemory,
            manualStartRace, manualStopRace, startTimeRef, playBeep,

            triggerRadius, setTriggerRadius,
            setRaceModeState, toggleSetupMode, toggleRoamRecording,
            authKey, setAuthKey,           
            changeDevicePassword,        
        }}>
            {children}
        </BluetoothContext.Provider>
    );
};
export const useBluetooth = () => useContext(BluetoothContext);