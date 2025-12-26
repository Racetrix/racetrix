import React, { createContext, useState, useEffect, useRef, useContext } from 'react';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import RNBluetoothClassic from 'react-native-bluetooth-classic';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Sound from 'react-native-sound';

const BluetoothContext = createContext();

Sound.setCategory('Playback');

export const BluetoothProvider = ({ children }) => {
    // --- 基础状态 ---
    const [device, setDevice] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    const [telemetry, setTelemetry] = useState({
        speed: 0.0, sats: 0, lat: 0.0, lon: 0.0, alt: 0.0,
        head: 0.0, roll: 0.0, pitch: 0.0, lonG: 0.0, latG: 0.0
    });

    const [status, setStatus] = useState({ gpsFix: false, authenticated: false, recording: false, raceMode: false, battery: 0 });
    const [recInfo, setRecInfo] = useState({ count: 0, currentFile: null });
    const [savedTracks, setSavedTracks] = useState([]);
    const [storageLocation, setStorageLocation] = useState('external');
    const [heartbeat, setHeartbeat] = useState(false);
    const [activeTrack, setActiveTrack] = useState(null);
    const [lapStats, setLapStats] = useState({ currentLapTime: 0, lastLapTime: 0, isRacing: false });

    // 映射配置
    const [gyroConfig, setGyroConfig] = useState({
        headSource: 'head', rollSource: 'roll', pitchSource: 'pitch',
        invertHead: false, invertRoll: false, invertPitch: false,
        invertLonG: false, invertLatG: false, swapG: false
    });

    // 偏差值状态 (用于 UI 回显)
    const [gyroOffsets, setGyroOffsets] = useState({ head: 0, roll: 0, pitch: 0 });

    // Ref 存储偏差，确保高频计算时读到最新值
    const gyroOffsetsRef = useRef({ head: 0, roll: 0, pitch: 0 });
    // Ref 存储配置，确保高频计算时读到最新配置 (新增，用于预览)
    const gyroConfigRef = useRef(gyroConfig);

    const [triggerRadius, setTriggerRadius] = useState(3);
    const [authKey, setAuthKey] = useState('1234');

    // --- Refs ---
    const raceModeRef = useRef(false);
    const recordingPathRef = useRef(null);
    const recordCountRef = useRef(0);
    const readIntervalRef = useRef(null);
    const stringBuffer = useRef("");

    // 性能优化 Refs
    const lastUpdateRef = useRef(Date.now());
    const lastUiUpdateRef = useRef(Date.now());

    const isInsideStartGateRef = useRef(false);
    const isInsideFinishGateRef = useRef(false);
    const beepSoundRef = useRef(null);
    const startTimeRef = useRef(0);
    const isRacingRef = useRef(false);
    const isRecordingRef = useRef(false);

    // 临时存储当前的 Raw Mapped 值 (未减 Offset 的值)
    const currentRawMappedRef = useRef({ head: 0, roll: 0, pitch: 0 });

    useEffect(() => {
        initPermissions();
        refreshTrackList();
        loadSettings();
        beepSoundRef.current = new Sound('beep.mp3', Sound.MAIN_BUNDLE, (e) => { });
        return () => { disconnect(); if (beepSoundRef.current) beepSoundRef.current.release(); };
    }, []);

    const loadSettings = async () => {
        try {
            const savedGyro = await AsyncStorage.getItem('GYRO_CONFIG');
            if (savedGyro) {
                const parsed = JSON.parse(savedGyro);
                setGyroConfig(parsed);
                gyroConfigRef.current = parsed; // 同步 Ref
            }

            const savedOffsets = await AsyncStorage.getItem('GYRO_OFFSETS');
            if (savedOffsets) {
                const parsed = JSON.parse(savedOffsets);
                setGyroOffsets(parsed);
                gyroOffsetsRef.current = parsed; // 同步 Ref
            }

            const savedPass = await AsyncStorage.getItem('SAVED_PASSWORD');
            if (savedPass) setAuthKey(savedPass);
        } catch (e) { }
    };

    const initPermissions = async () => { if (Platform.OS === 'android') { await PermissionsAndroid.requestMultiple([PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT, PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE, PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE]); } };
    const getBasePath = () => storageLocation === 'external' ? RNFS.ExternalDirectoryPath : RNFS.DocumentDirectoryPath;
    const refreshTrackList = async () => { const dir = `${getBasePath()}/SavedTracks`; if (!(await RNFS.exists(dir))) await RNFS.mkdir(dir); const files = await RNFS.readDir(dir); setSavedTracks(files.filter(f => f.name.endsWith('.json')).map(f => f.path)); };
    const saveNewTrack = async (trackName, trackData) => { const dir = `${getBasePath()}/SavedTracks`; if (!(await RNFS.exists(dir))) await RNFS.mkdir(dir); const path = `${dir}/${trackName.replace(/[^a-zA-Z0-9]/g, '_')}.json`; await RNFS.writeFile(path, JSON.stringify(trackData, null, 2), 'utf8'); await refreshTrackList(); Alert.alert("✅ 保存成功", path); };
    const loadTrackToMemory = async (filePath) => { try { const content = await RNFS.readFile(filePath, 'utf8'); const trackData = JSON.parse(content); if (trackData.startLine) { setActiveTrack(trackData); setLapStats({ currentLapTime: 0, lastLapTime: 0, isRacing: false }); isRacingRef.current = false; Alert.alert("🏁 赛道就绪", `目标：${trackData.name}\n触发范围：${triggerRadius}米\n请前往起点。`); } } catch (e) { Alert.alert("加载失败", e.message); } };

    // 🔥 1. 保存配置 (写盘 + 更新状态)
    const saveGyroConfig = async (newConfig) => {
        setGyroConfig(newConfig);
        gyroConfigRef.current = newConfig; // 同步 Ref
        await AsyncStorage.setItem('GYRO_CONFIG', JSON.stringify(newConfig));
    };

    // 🔥 2. 仅预览配置 (只更新状态，不写盘) -> 用于 UI 实时反馈
    const previewGyroConfig = (newConfig) => {
        setGyroConfig(newConfig);
        gyroConfigRef.current = newConfig; // 同步 Ref，让 parsePacket 立即使用
    };

    // 设置当前姿态为 0 (Set Zero)
    const setZeroLevel = async () => {
        const currentRaw = currentRawMappedRef.current;
        const newOffsets = { head: currentRaw.head, roll: currentRaw.roll, pitch: currentRaw.pitch };
        gyroOffsetsRef.current = newOffsets;
        setGyroOffsets(newOffsets);
        await AsyncStorage.setItem('GYRO_OFFSETS', JSON.stringify(newOffsets));
        setTelemetry(prev => ({ ...prev, head: 0.0, roll: 0.0, pitch: 0.0 }));
        Alert.alert("✅ 校准成功", "三轴已归零 (0°)\n当前方向已设为正前方。");
    };

    const resetLevel = async () => {
        const zeros = { head: 0, roll: 0, pitch: 0 };
        gyroOffsetsRef.current = zeros;
        setGyroOffsets(zeros);
        await AsyncStorage.setItem('GYRO_OFFSETS', JSON.stringify(zeros));
        Alert.alert("✅ 已复位", "零点偏移已清除，显示原始数据");
    };

    const changeDevicePassword = async (newPass) => { if (!status.authenticated) return Alert.alert("拒绝", "请先登录"); await sendCmd(`CMD:SET_PASS:${newPass}`); };
    const startRecording = async () => { if (isRecordingRef.current) return; const dir = `${getBasePath()}/RaceRecords`; if (!(await RNFS.exists(dir))) await RNFS.mkdir(dir); const now = new Date(); const timeName = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`; const pathC = `${dir}/Session_${timeName}.csv`; await RNFS.writeFile(pathC, "Time,Lat,Lon,Alt,Speed_kmh,Sats,Fix,Heading,Roll,Pitch,Lon_G,Lat_G\n", 'utf8'); recordingPathRef.current = pathC; recordCountRef.current = 0; isRecordingRef.current = true; setRecInfo({ count: 0, currentFile: pathC }); setStatus(p => ({ ...p, recording: true })); };
    const writeRecord = async (pkt) => { if (!isRecordingRef.current || !recordingPathRef.current) return; const now = new Date(); const timeStr = now.toISOString().replace('T', ' ').replace('Z', ''); const line = `${timeStr},${pkt.lat.toFixed(8)},${pkt.lon.toFixed(8)},${pkt.alt.toFixed(2)},${pkt.speed.toFixed(2)},${pkt.sats},${status.gpsFix ? 1 : 0},${pkt.head.toFixed(2)},${pkt.roll.toFixed(2)},${pkt.pitch.toFixed(2)},${pkt.lonG.toFixed(3)},${pkt.latG.toFixed(3)}\n`; try { await RNFS.appendFile(recordingPathRef.current, line, 'utf8'); recordCountRef.current += 1; setRecInfo(p => ({ ...p, count: recordCountRef.current })); } catch (e) { } };
    const stopRecording = () => { if (!isRecordingRef.current) return; recordingPathRef.current = null; recordCountRef.current = 0; isRecordingRef.current = false; setStatus(p => ({ ...p, recording: false })); };
    const connect = async (selectedDevice) => { try { const connected = await selectedDevice.connect(); if (connected) { setDevice(selectedDevice); setIsConnected(true); stringBuffer.current = ""; await AsyncStorage.setItem('last_device_address', selectedDevice.address); startReadingLoop(selectedDevice); setTimeout(() => sendAuth(selectedDevice), 1500); return true; } } catch (e) { return false; } };
    const sendAuth = async (d) => { try { await d.write(`KEY:${authKey}\r\n`); } catch (e) { } };
    const disconnect = async () => { if (readIntervalRef.current) clearInterval(readIntervalRef.current); if (device) { try { await device.disconnect(); } catch (e) { } } setDevice(null); setIsConnected(false); setStatus({ gpsFix: false, authenticated: false, recording: false, raceMode: false, battery: 0 }); setTelemetry({ speed: 0, sats: 0, lat: 0, lon: 0, alt: 0, head: 0, roll: 0, pitch: 0, lonG: 0, latG: 0 }); raceModeRef.current = false; recordingPathRef.current = null; recordCountRef.current = 0; };
    const sendCmd = async (cmd) => { if (device) await device.write(cmd + '\n'); };
    const setRaceModeState = (isActive) => { raceModeRef.current = isActive; setStatus(p => ({ ...p, raceMode: isActive })); if (isActive) { sendCmd('CMD:RACE_ON'); } else { sendCmd('CMD:RACE_OFF'); stopRecording(); setTelemetry(p => ({ ...p, speed: 0.0 })); } };
    const toggleRace = () => setRaceModeState(!raceModeRef.current);
    const toggleRoamRecording = () => { if (status.recording) { setRaceModeState(false); } else { setRaceModeState(true); startRecording(); } };
    const getDistance = (lat1, lon1, lat2, lon2) => { const R = 6371e3; const φ1 = lat1 * Math.PI / 180; const φ2 = lat2 * Math.PI / 180; const Δφ = (lat2 - lat1) * Math.PI / 180; const Δλ = (lon2 - lon1) * Math.PI / 180; const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2); return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); };
    const playBeep = () => { if (beepSoundRef.current) { beepSoundRef.current.stop(() => { beepSoundRef.current.play(); }); } };
    const manualStartRace = () => { startRecording(); startTimeRef.current = Date.now(); isRacingRef.current = true; setLapStats(p => ({ ...p, isRacing: true, currentLapTime: 0 })); playBeep(); };
    const manualStopRace = () => { if (isRacingRef.current) { const finalTime = Date.now() - startTimeRef.current; isRacingRef.current = false; setLapStats({ isRacing: false, lastLapTime: finalTime, currentLapTime: finalTime }); stopRecording(); } };
    const startReadingLoop = (d) => { const read = async () => { try { if (!d || !(await d.isConnected())) { disconnect(); return; } const av = await d.available(); if (av > 0) { const da = await d.read(); if (da) { stringBuffer.current += da; processBuffer(); } } } catch (e) { } }; readIntervalRef.current = setInterval(read, 30); };
    const processBuffer = () => { let buf = stringBuffer.current; if (!buf.includes('$')) { if (buf.length > 2000) stringBuffer.current = ""; return; } const f = buf.indexOf('$'); if (f > 0) buf = buf.substring(f); const p = buf.split('$'); if (p.length < 2) return; for (let i = 1; i < p.length - 1; i++) parsePacket('$' + p[i]); stringBuffer.current = '$' + p[p.length - 1]; };

    const mapAxis = (sourceKey, inputs, invert) => {
        let val = 0;
        if (sourceKey === 'head') val = inputs.head;
        else if (sourceKey === 'roll') val = inputs.roll;
        else if (sourceKey === 'pitch') val = inputs.pitch;
        return invert ? -val : val;
    };

    const parsePacket = (packet) => {
        const line = packet.trim();
        const now = Date.now();

        if (now - lastUpdateRef.current > 500) { lastUpdateRef.current = now; setHeartbeat(p => !p); }
        if (line.includes("Auth OK")) { setStatus(p => ({ ...p, authenticated: true })); AsyncStorage.setItem('SAVED_PASSWORD', authKey); }
        if (line.includes("Password Updated")) Alert.alert("提示", "密码修改成功");

        if (line.startsWith("$RC")) {
            if (!raceModeRef.current) return;
            const parts = line.split(',');
            if (parts.length >= 7) {
                const spd = parseFloat(parts[5]); const lat = parseFloat(parts[3]); const lon = parseFloat(parts[4]);
                const alt = parseFloat(parts[6]);
                const fix = parseInt(parts[1]);

                const rawInputs = {
                    head: parts.length >= 8 ? (parseFloat(parts[7]) || 0) : 0,
                    roll: parts.length >= 9 ? (parseFloat(parts[8]) || 0) : 0,
                    pitch: parts.length >= 10 ? (parseFloat(parts[9]) || 0) : 0
                };
                let rawLonG = parts.length >= 11 ? (parseFloat(parts[10]) || 0) : 0;
                let rawLatG = parts.length >= 12 ? (parseFloat(parts[11]) || 0) : 0;

                // 🔥 使用 Ref 读取最新配置 (实时预览的关键)
                const cfg = gyroConfigRef.current;
                const mappedHead = mapAxis(cfg.headSource, rawInputs, cfg.invertHead);
                const mappedRoll = mapAxis(cfg.rollSource, rawInputs, cfg.invertRoll);
                const mappedPitch = mapAxis(cfg.pitchSource, rawInputs, cfg.invertPitch);

                currentRawMappedRef.current = { roll: mappedRoll, pitch: mappedPitch, head: mappedHead };

                const offsets = gyroOffsetsRef.current;
                const finalRoll = mappedRoll - offsets.roll;
                const finalPitch = mappedPitch - offsets.pitch;
                const finalHead = mappedHead - offsets.head;

                let calLonG = cfg.swapG ? rawLatG : rawLonG;
                let calLatG = cfg.swapG ? rawLonG : rawLatG;
                if (cfg.invertLonG) calLonG *= -1;
                if (cfg.invertLatG) calLatG *= -1;

                if (!isNaN(spd)) {
                    const newTelemetry = {
                        speed: spd, sats: parseInt(parts[2]), lat, lon, alt,
                        head: finalHead, roll: finalRoll, pitch: finalPitch, lonG: calLonG, latG: calLatG
                    };

                    if (now - lastUiUpdateRef.current > 100) {
                        setTelemetry(newTelemetry);
                        setStatus(p => ({ ...p, gpsFix: fix === 1 }));
                        lastUiUpdateRef.current = now;
                    }
                    if (isRecordingRef.current) writeRecord(newTelemetry);

                    // 触发逻辑 (保持不变)
                    if (activeTrack && fix === 1) {
                        const distStart = getDistance(lat, lon, activeTrack.startLine.lat, activeTrack.startLine.lon);
                        if (distStart < triggerRadius) {
                            if (!isInsideStartGateRef.current) {
                                const tNow = Date.now();
                                if (!isRacingRef.current || (tNow - startTimeRef.current > 10000)) {
                                    playBeep();
                                    startRecording();
                                    if (isRacingRef.current && activeTrack.type === 'circuit') { setLapStats({ isRacing: true, lastLapTime: tNow - startTimeRef.current, currentLapTime: 0 }); }
                                    else { setLapStats(p => ({ ...p, isRacing: true })); }
                                    startTimeRef.current = tNow;
                                    isRacingRef.current = true;
                                }
                                isInsideStartGateRef.current = true;
                            }
                        } else { isInsideStartGateRef.current = false; }
                        if (isRacingRef.current && activeTrack.finishLine && activeTrack.type === 'sprint') {
                            const distFinish = getDistance(lat, lon, activeTrack.finishLine.lat, activeTrack.finishLine.lon);
                            if (distFinish < triggerRadius && (Date.now() - startTimeRef.current > 5000)) {
                                if (!isInsideFinishGateRef.current) {
                                    playBeep();
                                    const finalTime = Date.now() - startTimeRef.current;
                                    isRacingRef.current = false;
                                    setLapStats({ isRacing: false, lastLapTime: finalTime, currentLapTime: finalTime });
                                    stopRecording();
                                    isInsideFinishGateRef.current = true;
                                }
                            } else { isInsideFinishGateRef.current = false; }
                        }
                    }
                }
            }
        } else if (line.startsWith("$HB")) { const parts = line.split(','); if (parts.length >= 4) { const bat = parseInt(parts[1]); setTelemetry(p => ({ ...p, sats: parseInt(parts[3]) || 0 })); setStatus(p => ({ ...p, gpsFix: parseInt(parts[2]) === 1, authenticated: true, battery: bat || 0 })); } }
    };

    return (
        <BluetoothContext.Provider value={{
            device, isConnected, telemetry, status, recInfo, storageLocation, heartbeat, savedTracks, activeTrack, lapStats,
            setStorageLocation, connect, disconnect, sendCmd, saveNewTrack, refreshTrackList, loadTrackToMemory, manualStartRace, manualStopRace, startTimeRef, playBeep,
            authKey, setAuthKey, changeDevicePassword,
            setRaceModeState, toggleRace, toggleRoamRecording,
            triggerRadius, setTriggerRadius,
            gyroConfig, saveGyroConfig,
            setZeroLevel, resetLevel,

            // 🔥 新增：导出预览函数
            previewGyroConfig
        }}>
            {children}
        </BluetoothContext.Provider>
    );
};

export const useBluetooth = () => useContext(BluetoothContext);