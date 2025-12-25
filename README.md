# 🏎️ Racetrix

Racetrix 是一个基于 React Native 开发的高精度赛车遥测 APP。它配合 ESP32 等蓝牙 GPS 硬件使用，提供从**赛道绘制**、**自由漫游**到**专业圈速计时**的一站式解决方案。

## ✨ 核心功能

* **📡 蓝牙低功耗连接**: 自动扫描、连接、鉴权（支持动态密码修改）。
* **🚀 漫游模式 (Free Roam)**: 实时显示速度、经纬度、海拔、卫星数，支持**手动强制录制** CSV 数据。
* **🛠️ 赛道创建 (Track Creator)**:
* 可视化录制 GPS 路径。
* 支持 **闭环 (Circuit)** 和 **点对点 (Sprint)** 两种赛道类型。
* 自定义设置起点和终点线。


* **🏁 竞速模式 (Race Mode)**:
* **自动触发**: 基于 GPS 距离自动开始计时/录制（支持自定义误差半径，默认 3米）。
* **实时差距**: 显示距离起点/终点的实时距离。
* **智能圈速**: 闭环赛道自动结算上一圈并开始新一圈。
* **数据记录**: 仅在有效比赛期间记录高频数据，避免垃圾数据。


* **📂 数据管理**: CSV 格式导出数据（PC 可读），本地赛道 JSON 文件管理。



## 🛠️ 安装与运行

### 环境要求

* Node.js >= 18
* JDK 17
* Android Studio (配置好 SDK 和 模拟器/真机)

### 步骤

1. **克隆项目**
```bash
git clone https://github.com/Racetrix/Racetrix.git racebox-app
cd racebox-app

```


2. **安装依赖**
```bash
npm install
# 或
yarn install

```


3. **运行项目 (Android)**
确保手机已连接并开启 USB 调试。
```bash
npx react-native run-android

```



> **注意**: 如果遇到包名报错 (package name error)，请确保已执行 `cd android && ./gradlew clean`。

## 📡 硬件通信协议 (Hardware Protocol)

本应用依赖外部蓝牙设备（如 ESP32 + GNSS 模块），通信通过蓝牙串口（SPP）进行。

### 1. 设备 -> App (上行数据)

所有数据包以 `$` 开头，`\n` 结尾。

* **竞速数据包 (`$RC`)** - 频率: 10Hz+
```text
$RC,[Fix],[Sats],[Lat],[Lon],[Speed],[Alt]
Example: $RC,1,14,22.583120,113.965410,120.5,50.2

```


* `Fix`: 1=定位有效, 0=无效
* `Sats`: 卫星数量
* `Speed`: 速度 (km/h)
* `Alt`: 海拔 (米)


* **设置/勘路数据包 (`$ST`)** - 频率: 10Hz (不含速度/海拔，仅用于绘图)
```text
$ST,[Fix],[Sats],[Lat],[Lon]

```


* **心跳/状态包 (`$HB`)** - 频率: 1Hz
```text
$HB,[Battery],[Fix],[Sats]

```


* **系统消息**
* `Auth OK`: 鉴权成功
* `MSG:Password Updated`: 密码修改成功



### 2. App -> 设备 (下行指令)

所有指令以 `\n` 或 `\r\n` 结尾。

| 指令 | 描述 | 备注 |
| --- | --- | --- |
| `KEY:xxxx` | 发送登录密码 | 默认密码通常为 `1234` |
| `CMD:RACE_ON` | 开启竞速数据流 | 设备开始发送 `$RC` 包 |
| `CMD:RACE_OFF` | 关闭竞速数据流 | 设备停止发送 `$RC`，进入待机 |
| `CMD:SETUP_ON` | 开启设置模式 | 设备开始发送 `$ST` 包 |
| `CMD:SETUP_OFF` | 关闭设置模式 | 停止发送 `$ST` |
| `CMD:SET_PASS:xxxx` | 修改设备密码 | 需先鉴权成功 |

## 📂 文件存储结构

App 会在手机存储中创建以下目录：

* **Android**: `/storage/emulated/0/Android/data/com.yourname.racebox/files/` (如果选择 External)
* `SavedTracks/`: 存放 `.json` 赛道定义文件。
* `RaceRecords/`: 存放 `.csv` 遥测日志文件。



### CSV 数据格式

录制的文件包含以下列：
`Time, Lat, Lon, Alt, Speed_kmh, Sats, Fix`

## 🧩 核心逻辑说明

### 赛道模式 (Race Mode) 触发机制

1. **待机**: 进入页面后发送 `CMD:RACE_ON`，App 接收数据但不录制。
2. **触发**: 当 `Current GPS` 与 `Start Line` 的距离 < **设定误差 (默认3米)** 时：
* 播放 "Beep" 声。
* 自动创建 CSV 文件并开始写入。
* 开始计时。


3. **完成 (Sprint)**: 当距离 `Finish Line` < 误差值 且 比赛时间 > 5秒：
* 停止计时，保存 CSV，停止录制。


4. **跑圈 (Circuit)**: 再次经过起点线时：
* 结算上一圈时间 (Last Lap)。
* 重置当前计时器 (Current Lap)。
* 继续录制。



## ⚠️ 常见问题

1. **无法连接蓝牙？**
* 请确保 App 已获取“附近的设备”和“位置信息”权限。
* 尝试手动配对蓝牙后再在 App 内连接。


2. **赛道模式不自动开始？**
* 检查卫星数量 (Sats) 是否充足。
* 检查设置中的“触发误差”值，如果 GPS 漂移较大，请将误差值调大 (如 10米)。


3. **修改包名后构建失败？**
* 请参考项目文档关于 `namespace` 和 `applicationId` 的修改说明，并务必执行 Clean 操作。



---

**License**
MIT