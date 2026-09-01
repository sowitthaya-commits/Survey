import Dexie, { type Table } from 'dexie';

export interface RoomImage {
  id: string; // uuid
  step: number; // 1 = Existing, 2 = Room, 3 = Visual, 4 = Audio, 5 = Control
  originalImage: string; // base64 or filepath URL
  annotatedImage: string; // base64 or filepath URL
  description?: string;
  createdAt: string;
}

export interface InputPortItem {
  id: string; // uuid
  portType: string;
  portQty: number;
}

export interface RoomData {
  id: string; // uuid
  name: string; // e.g. "Room 1"
  
  // Step 2: Dimensions & Site Survey
  roomWidth?: number;
  roomLength?: number;
  roomHeight?: number;
  roomType?: string;
  floor?: string;
  surfaceType?: string;
  installationType?: string;
  structureResponsibility?: string;
  cablingResponsibility?: string;
  distanceToControlRoom?: number;
  distanceToPowerRoom?: number;
  mainPowerResponsibility?: string;
  rackLocation?: string; // ห้องควบคุม, ภายในห้องประชุม
  rackDistanceToRoom?: number;
  rackResponsibility?: string; // SWS จัดเตรียม, ลูกค้าจัดเตรียม
  rackPowerSource?: string; // SWS จัดเตรียม, ลูกค้าจัดเตรียม
  wallPlateWiring?: string; // เดินราง, เดินฝัง
  wallPlateType?: string; // HDMI, LAN Extender, LAN HDBaseT
  wallPlateLocation?: string;

  // Step 3: Visual System
  ledWidth?: number;
  ledHeight?: number;
  ledPixelPitch?: string;
  ledModelName?: string;
  ledType?: string;
  ledSubstrate?: string;
  ledApplication?: string;
  
  visualOthersEnabled?: {
    interactive?: boolean;
    projector?: boolean;
    sideDisplay?: boolean;
    ptzCamera?: boolean;
    signage?: boolean;
  };
  interactiveSize?: string;
  interactiveQty?: number;
  interactiveBrand?: string;
  projectorLumen?: string;
  projectorQty?: number;
  projectorBrand?: string;
  sideDisplayType?: string;
  sideDisplayQty?: number;
  sideDisplayDiffImage?: string;
  ptzQty?: number;
  ptzTracking?: string;
  ptzBrand?: string;
  signageSize?: string;
  signageQty?: number;
  signageBrand?: string;
  inputPorts?: InputPortItem[];
  visualNote?: string;

  // Step 4: Audio System
  micWiredQty?: number;
  micWiredBrand?: string;
  micWirelessHandQty?: number;
  micWirelessHandBrand?: string;
  micWirelessLapelQty?: number;
  micWirelessLapelBrand?: string;
  speakerType?: string;
  speakerBrand?: string;
  allInOneQty?: number;
  allInOneWirelessType?: string; // BYOD, BYOM
  allInOneBrand?: string;
  vdoConferencePlatform?: string;
  tabletopChairmanQty?: number;
  tabletopDelegateQty?: number;
  tabletopType?: string; // มีสาย, ไร้สาย
  tabletopBrand?: string;
  tabletopSpecialFeatures?: string;
  audioNote?: string;

  // Step 5: Smart Control & Network
  controlType?: string;
  controlInterface?: string;
  controlIpadStatus?: string;
  controlNote?: string;

  // Step 5: Network details
  networkInterface?: string; // LAN, Wi-Fi, No Network
  networkResponsibility?: string; // SWS จัดเตรียม, ลูกค้าจัดเตรียม
  networkIPRequirement?: string; // DHCP, Static IP, No IP
  networkNote?: string;

  // Step Images (multiple images per room)
  images: RoomImage[];
}

export interface DraftSurvey {
  id: string; // uuid
  projectName: string;
  customerName: string;
  salesPersonId?: number;
  salesPersonName?: string;
  status: 'draft' | 'pending_sync' | 'synced' | 'completed' | 'deleted' | 'generating';
  createdAt: string;
  updatedAt: string;
  
  // General Info
  requestDate?: string;
  locationLat?: number;
  locationLng?: number;
  locationAddress?: string;
  quotationDeadline?: string;
  budget?: string;

  // Existing Customer Systems (Project-wide images)
  existingImages: RoomImage[];

  // Contact Info
  contactName?: string;
  contactPhone?: string;
  surveyDate?: string;

  // Rooms Data JSON/Object structure
  roomsData: RoomData[];
}

export interface SalesPersonCache {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
}

export interface DisplayModelCache {
  id: number;
  modelName: string;
  brand: string;
  specifications?: string | null;
}

export interface DropdownOptionCache {
  id: number;
  category: string;
  value: string;
}

class OfflineDatabase extends Dexie {
  draftSurveys!: Table<DraftSurvey, string>;
  salesPersonsCache!: Table<SalesPersonCache, number>;
  displayModelsCache!: Table<DisplayModelCache, number>;
  dropdownOptionsCache!: Table<DropdownOptionCache, number>;

  constructor() {
    super('SurveyOfflineDb');
    this.version(6).stores({
      draftSurveys: 'id, projectName, customerName, status, updatedAt',
      salesPersonsCache: 'id, name',
      displayModelsCache: 'id, modelName, brand',
      dropdownOptionsCache: 'id, category, value',
    });
  }
}

export const offlineDb = new OfflineDatabase();
export type { OfflineDatabase };
