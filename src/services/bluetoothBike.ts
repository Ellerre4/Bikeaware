import type { BleConnectionState } from '../types/bike';

// Standard Bluetooth SIG GATT UUIDs for indoor cycling & sensors
const FTMS_SERVICE = 0x1826;
const FTMS_INDOOR_BIKE_DATA = 0x2ad2;
const FTMS_CONTROL_POINT = 0x2ad9;
const CSC_SERVICE = 0x1816;
const CSC_MEASUREMENT = 0x2a5b;
const CPS_SERVICE = 0x1818;
const CPS_MEASUREMENT = 0x2a63;
const HRS_SERVICE = 0x180d;
const HRS_MEASUREMENT = 0x2a37;

export interface LiveBikeReading {
  speedKmh: number;
  cadenceRpm: number;
  powerWatts: number;
  heartRateBpm: number;
  resistanceLevel: number;
  totalDistanceM?: number;
  totalEnergyKcal?: number;
}

type TelemetryListener = (reading: LiveBikeReading) => void;
type StatusListener = (state: BleConnectionState) => void;

interface SimulatorTargets {
  resistance: number;
  targetCadenceRpm: number;
  targetPowerWatts: number;
}

// Minimal Web Bluetooth typing for TypeScript without external @types/web-bluetooth
interface BtCharacteristic extends EventTarget {
  value?: DataView;
  startNotifications(): Promise<BtCharacteristic>;
  stopNotifications(): Promise<BtCharacteristic>;
  writeValue(value: BufferSource): Promise<void>;
}
interface BtService {
  getCharacteristic(uuid: number | string): Promise<BtCharacteristic>;
}
interface BtGattServer {
  connected: boolean;
  connect(): Promise<BtGattServer>;
  disconnect(): void;
  getPrimaryService(uuid: number | string): Promise<BtService>;
}
interface BtDevice extends EventTarget {
  name?: string;
  gatt?: BtGattServer;
}
interface NavigatorWithBluetooth extends Navigator {
  bluetooth?: {
    requestDevice(options: {
      filters?: Array<{ services: number[] }>;
      optionalServices?: number[];
      acceptAllDevices?: boolean;
    }): Promise<BtDevice>;
  };
}

class BluetoothBikeManager {
  private device: BtDevice | null = null;
  private hrDevice: BtDevice | null = null;
  private controlPointChar: BtCharacteristic | null = null;
  private telemetryListeners = new Set<TelemetryListener>();
  private statusListeners = new Set<StatusListener>();

  private state: BleConnectionState = {
    status: 'disconnected',
    deviceName: null,
    protocol: null,
    supportsResistanceControl: false,
    errorMessage: null,
  };

  private latest: LiveBikeReading = {
    speedKmh: 0,
    cadenceRpm: 0,
    powerWatts: 0,
    heartRateBpm: 0,
    resistanceLevel: 6,
  };

  // CSC delta tracking
  private prevWheelRevs: number | null = null;
  private prevWheelTime: number | null = null;
  private prevCrankRevs: number | null = null;
  private prevCrankTime: number | null = null;

  // Simulator state
  private simTimer: number | null = null;
  private simTick = 0;
  private simHr = 104;
  private simTargets: SimulatorTargets = {
    resistance: 8,
    targetCadenceRpm: 84,
    targetPowerWatts: 155,
  };

  public isWebBluetoothSupported(): boolean {
    const nav = navigator as NavigatorWithBluetooth;
    return typeof nav.bluetooth !== 'undefined';
  }

  public getState(): BleConnectionState {
    return { ...this.state };
  }

  public onTelemetry(cb: TelemetryListener): () => void {
    this.telemetryListeners.add(cb);
    return () => this.telemetryListeners.delete(cb);
  }

  public onStatus(cb: StatusListener): () => void {
    this.statusListeners.add(cb);
    cb({ ...this.state });
    return () => this.statusListeners.delete(cb);
  }

  private emitStatus(patch: Partial<BleConnectionState>): void {
    this.state = { ...this.state, ...patch };
    const snap = { ...this.state };
    this.statusListeners.forEach((cb) => cb(snap));
  }

  private emitTelemetry(): void {
    const snap = { ...this.latest };
    this.telemetryListeners.forEach((cb) => cb(snap));
  }

  public async connectBike(): Promise<boolean> {
    this.stopSimulator();
    const nav = navigator as NavigatorWithBluetooth;
    if (!nav.bluetooth) {
      this.emitStatus({
        status: 'error',
        errorMessage:
          'Web Bluetooth non supportato su questo browser. Usa Chrome, Edge o attiva il Simulatore BLE.',
      });
      return false;
    }

    try {
      this.emitStatus({ status: 'connecting', errorMessage: null });

      const device = await nav.bluetooth.requestDevice({
        filters: [
          { services: [FTMS_SERVICE] },
          { services: [CSC_SERVICE] },
          { services: [CPS_SERVICE] },
        ],
        optionalServices: [FTMS_SERVICE, CSC_SERVICE, CPS_SERVICE, HRS_SERVICE],
      });

      if (!device.gatt) {
        throw new Error('Dispositivo GATT non disponibile.');
      }

      this.device = device;
      device.addEventListener('gattserverdisconnected', this.handleDisconnect);

      const server = await device.gatt.connect();
      let protocol: BleConnectionState['protocol'] = null;
      let supportsResistance = false;

      // 1. Try FTMS (Fitness Machine Service — standard on modern smart stationary bikes)
      try {
        const ftms = await server.getPrimaryService(FTMS_SERVICE);
        const bikeChar = await ftms.getCharacteristic(FTMS_INDOOR_BIKE_DATA);
        await bikeChar.startNotifications();
        bikeChar.addEventListener('characteristicvaluechanged', this.handleFtmsData);
        protocol = 'FTMS';

        try {
          this.controlPointChar = await ftms.getCharacteristic(FTMS_CONTROL_POINT);
          supportsResistance = true;
        } catch {
          this.controlPointChar = null;
        }
      } catch {
        // Fallback to CSC or CPS below
      }

      // 2. Try Cycling Power Service (CPS)
      if (!protocol) {
        try {
          const cps = await server.getPrimaryService(CPS_SERVICE);
          const powerChar = await cps.getCharacteristic(CPS_MEASUREMENT);
          await powerChar.startNotifications();
          powerChar.addEventListener('characteristicvaluechanged', this.handleCpsData);
          protocol = 'CPS';
        } catch {
          // Continue to CSC
        }
      }

      // 3. Try Cycling Speed & Cadence (CSC)
      if (!protocol) {
        try {
          const csc = await server.getPrimaryService(CSC_SERVICE);
          const cscChar = await csc.getCharacteristic(CSC_MEASUREMENT);
          await cscChar.startNotifications();
          cscChar.addEventListener('characteristicvaluechanged', this.handleCscData);
          protocol = 'CSC';
        } catch {
          // No supported cycling characteristic found
        }
      }

      // 4. Optional Heart Rate Service on same device
      try {
        const hrs = await server.getPrimaryService(HRS_SERVICE);
        const hrChar = await hrs.getCharacteristic(HRS_MEASUREMENT);
        await hrChar.startNotifications();
        hrChar.addEventListener('characteristicvaluechanged', this.handleHrData);
      } catch {
        // Bike does not broadcast separate HRS
      }

      if (!protocol) {
        server.disconnect();
        throw new Error(
          'Nessun profilo cyclette compatibile trovato (FTMS, CSC o Cycling Power).'
        );
      }

      this.emitStatus({
        status: 'connected',
        deviceName: device.name || 'Cyclette Bluetooth',
        protocol,
        supportsResistanceControl: supportsResistance,
        errorMessage: null,
      });

      return true;
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.name === 'NotFoundError'
            ? 'Selezione dispositivo annullata.'
            : err.message
          : 'Errore di connessione Bluetooth.';
      this.emitStatus({
        status: err instanceof Error && err.name === 'NotFoundError' ? 'disconnected' : 'error',
        errorMessage: err instanceof Error && err.name === 'NotFoundError' ? null : msg,
      });
      return false;
    }
  }

  public async connectHeartRateStrap(): Promise<boolean> {
    const nav = navigator as NavigatorWithBluetooth;
    if (!nav.bluetooth) return false;
    try {
      const device = await nav.bluetooth.requestDevice({
        filters: [{ services: [HRS_SERVICE] }],
        optionalServices: [HRS_SERVICE],
      });
      if (!device.gatt) return false;
      this.hrDevice = device;
      const server = await device.gatt.connect();
      const hrs = await server.getPrimaryService(HRS_SERVICE);
      const hrChar = await hrs.getCharacteristic(HRS_MEASUREMENT);
      await hrChar.startNotifications();
      hrChar.addEventListener('characteristicvaluechanged', this.handleHrData);
      return true;
    } catch {
      return false;
    }
  }

  public disconnect(): void {
    this.stopSimulator();
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    if (this.hrDevice?.gatt?.connected) {
      this.hrDevice.gatt.disconnect();
    }
    this.device = null;
    this.hrDevice = null;
    this.controlPointChar = null;
    this.prevWheelRevs = null;
    this.prevWheelTime = null;
    this.prevCrankRevs = null;
    this.prevCrankTime = null;
    this.emitStatus({
      status: 'disconnected',
      deviceName: null,
      protocol: null,
      supportsResistanceControl: false,
      errorMessage: null,
    });
  }

  public async setResistanceLevel(level: number): Promise<void> {
    const clamped = Math.max(1, Math.min(20, Math.round(level)));
    this.latest.resistanceLevel = clamped;
    this.simTargets.resistance = clamped;

    if (this.controlPointChar && this.state.status === 'connected') {
      try {
        // FTMS Request Control (0x00), then Set Target Resistance Level (0x04, uint8 * 10)
        await this.controlPointChar.writeValue(new Uint8Array([0x00]));
        await this.controlPointChar.writeValue(new Uint8Array([0x04, clamped * 5]));
      } catch {
        // Some bikes ignore FTMS control writes; keep local resistance target updated
      }
    }
  }

  public setSimulatorTargets(targets: Partial<SimulatorTargets>): void {
    this.simTargets = { ...this.simTargets, ...targets };
  }

  public startSimulator(): void {
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.stopSimulator();
    this.simTick = 0;
    this.simHr = 108;

    this.emitStatus({
      status: 'simulating',
      deviceName: 'Simulatore FTMS Cyclette',
      protocol: 'SIM',
      supportsResistanceControl: true,
      errorMessage: null,
    });

    this.simTimer = window.setInterval(() => {
      this.simTick += 1;
      const res = this.simTargets.resistance;
      const targetCad = this.simTargets.targetCadenceRpm;
      const targetPow = this.simTargets.targetPowerWatts;

      const wave = Math.sin(this.simTick * 0.22) * 3.2 + (Math.random() - 0.5) * 3.6;
      const cadence = Math.max(52, Math.min(118, Math.round(targetCad + wave)));
      const resistanceFactor = res / Math.max(1, 8);
      const naturalPower = Math.round((targetPow * 0.65 + cadence * 1.15 * resistanceFactor) * 0.95);
      const power = Math.max(
        55,
        Math.round(naturalPower + Math.sin(this.simTick * 0.17) * 9 + (Math.random() - 0.5) * 8)
      );
      const speed = Number(Math.max(12, 14.5 + power / 11.4).toFixed(1));

      // Smooth heart rate response toward effort-derived target HR
      const targetHr = Math.min(182, 92 + power * 0.34);
      this.simHr += (targetHr - this.simHr) * 0.08 + (Math.random() - 0.5) * 1.2;

      this.latest = {
        speedKmh: speed,
        cadenceRpm: cadence,
        powerWatts: power,
        heartRateBpm: Math.round(this.simHr),
        resistanceLevel: res,
      };
      this.emitTelemetry();
    }, 1000);
  }

  public stopSimulator(): void {
    if (this.simTimer !== null) {
      window.clearInterval(this.simTimer);
      this.simTimer = null;
    }
    if (this.state.status === 'simulating') {
      this.emitStatus({
        status: 'disconnected',
        deviceName: null,
        protocol: null,
        supportsResistanceControl: false,
      });
    }
  }

  private handleDisconnect = (): void => {
    this.controlPointChar = null;
    this.emitStatus({
      status: 'disconnected',
      deviceName: null,
      protocol: null,
      supportsResistanceControl: false,
      errorMessage: 'Connessione Bluetooth interrotta.',
    });
  };

  // Parse FTMS Indoor Bike Data Characteristic (0x2AD2) according to Bluetooth SIG spec
  private handleFtmsData = (event: Event): void => {
    const target = event.target as BtCharacteristic;
    const data = target.value;
    if (!data || data.byteLength < 2) return;

    const flags = data.getUint16(0, true);
    let offset = 2;

    // Bit 0 == 0 => Instantaneous Speed present (uint16, 0.01 km/h)
    if ((flags & 0x0001) === 0 && offset + 2 <= data.byteLength) {
      this.latest.speedKmh = Number((data.getUint16(offset, true) * 0.01).toFixed(1));
      offset += 2;
    }
    // Bit 1 => Average Speed present
    if ((flags & 0x0002) !== 0 && offset + 2 <= data.byteLength) {
      offset += 2;
    }
    // Bit 2 => Instantaneous Cadence present (uint16, 0.5 RPM)
    if ((flags & 0x0004) !== 0 && offset + 2 <= data.byteLength) {
      this.latest.cadenceRpm = Math.round(data.getUint16(offset, true) * 0.5);
      offset += 2;
    }
    // Bit 3 => Average Cadence present
    if ((flags & 0x0008) !== 0 && offset + 2 <= data.byteLength) {
      offset += 2;
    }
    // Bit 4 => Total Distance present (uint24, meters)
    if ((flags & 0x0010) !== 0 && offset + 3 <= data.byteLength) {
      const dist =
        data.getUint8(offset) |
        (data.getUint8(offset + 1) << 8) |
        (data.getUint8(offset + 2) << 16);
      this.latest.totalDistanceM = dist;
      offset += 3;
    }
    // Bit 5 => Resistance Level present (sint16)
    if ((flags & 0x0020) !== 0 && offset + 2 <= data.byteLength) {
      const rawRes = data.getInt16(offset, true);
      this.latest.resistanceLevel = Math.max(1, Math.min(20, Math.round(rawRes)));
      offset += 2;
    }
    // Bit 6 => Instantaneous Power present (sint16, Watts)
    if ((flags & 0x0040) !== 0 && offset + 2 <= data.byteLength) {
      this.latest.powerWatts = Math.max(0, data.getInt16(offset, true));
      offset += 2;
    }
    // Bit 7 => Average Power present
    if ((flags & 0x0080) !== 0 && offset + 2 <= data.byteLength) {
      offset += 2;
    }
    // Bit 8 => Expended Energy present (uint16 total + uint16/h + uint8/m = 5 bytes)
    if ((flags & 0x0100) !== 0 && offset + 5 <= data.byteLength) {
      this.latest.totalEnergyKcal = data.getUint16(offset, true);
      offset += 5;
    }
    // Bit 9 => Heart Rate present (uint8, BPM)
    if ((flags & 0x0200) !== 0 && offset + 1 <= data.byteLength) {
      this.latest.heartRateBpm = data.getUint8(offset);
      offset += 1;
    }

    this.emitTelemetry();
  };

  // Parse Cycling Power Measurement (0x2A63)
  private handleCpsData = (event: Event): void => {
    const target = event.target as BtCharacteristic;
    const data = target.value;
    if (!data || data.byteLength < 4) return;
    const power = data.getInt16(2, true);
    this.latest.powerWatts = Math.max(0, power);
    this.latest.speedKmh = Number((14 + this.latest.powerWatts / 11.5).toFixed(1));
    this.emitTelemetry();
  };

  // Parse Cycling Speed & Cadence Measurement (0x2A5B)
  private handleCscData = (event: Event): void => {
    const target = event.target as BtCharacteristic;
    const data = target.value;
    if (!data || data.byteLength < 1) return;

    const flags = data.getUint8(0);
    let offset = 1;
    const WHEEL_CIRCUMFERENCE_M = 2.096;

    if ((flags & 0x01) !== 0 && offset + 6 <= data.byteLength) {
      const wheelRevs = data.getUint32(offset, true);
      const wheelTime = data.getUint16(offset + 4, true); // 1/1024 s
      offset += 6;

      if (this.prevWheelRevs !== null && this.prevWheelTime !== null) {
        const dRevs = wheelRevs - this.prevWheelRevs;
        const dTime = ((wheelTime - this.prevWheelTime + 65536) % 65536) / 1024;
        if (dRevs >= 0 && dTime > 0) {
          const speedMs = (dRevs * WHEEL_CIRCUMFERENCE_M) / dTime;
          this.latest.speedKmh = Number((speedMs * 3.6).toFixed(1));
          this.latest.powerWatts = Math.round(
            Math.max(40, this.latest.speedKmh * 5.2 + this.latest.resistanceLevel * 4)
          );
        }
      }
      this.prevWheelRevs = wheelRevs;
      this.prevWheelTime = wheelTime;
    }

    if ((flags & 0x02) !== 0 && offset + 4 <= data.byteLength) {
      const crankRevs = data.getUint16(offset, true);
      const crankTime = data.getUint16(offset + 2, true);
      if (this.prevCrankRevs !== null && this.prevCrankTime !== null) {
        const dRevs = (crankRevs - this.prevCrankRevs + 65536) % 65536;
        const dTime = ((crankTime - this.prevCrankTime + 65536) % 65536) / 1024;
        if (dRevs >= 0 && dTime > 0) {
          this.latest.cadenceRpm = Math.min(180, Math.round((dRevs / dTime) * 60));
        }
      }
      this.prevCrankRevs = crankRevs;
      this.prevCrankTime = crankTime;
    }

    this.emitTelemetry();
  };

  // Parse Heart Rate Measurement (0x2A37)
  private handleHrData = (event: Event): void => {
    const target = event.target as BtCharacteristic;
    const data = target.value;
    if (!data || data.byteLength < 2) return;
    const flags = data.getUint8(0);
    const is16Bit = (flags & 0x01) !== 0;
    const hr = is16Bit && data.byteLength >= 3 ? data.getUint16(1, true) : data.getUint8(1);
    this.latest.heartRateBpm = hr;
    this.emitTelemetry();
  };
}

export const bluetoothBike = new BluetoothBikeManager();
