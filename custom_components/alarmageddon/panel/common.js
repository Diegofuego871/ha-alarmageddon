// Gemeinsame Bausteine des Panels: Symbole, Maskieren, Sensorarten, Fehlererkennung.
// Aus alarmageddon-panel.js ausgelagert, damit die Ansichten (Liste, Sensoren, Anlage) eigene Module sein können.

// --- Symbole (Material Design Icons) ---------------------------------------
export const P = {
  eye: "M12,9A3,3 0 0,1 15,12A3,3 0 0,1 12,15A3,3 0 0,1 9,12A3,3 0 0,1 12,9M12,4.5C17,4.5 21.27,7.61 23,12C21.27,16.39 17,19.5 12,19.5C7,19.5 2.73,16.39 1,12C2.73,7.61 7,4.5 12,4.5M3.18,12C4.83,15.36 8.24,17.5 12,17.5C15.76,17.5 19.17,15.36 20.82,12C19.17,8.64 15.76,6.5 12,6.5C8.24,6.5 4.83,8.64 3.18,12Z",
  eyeOff: "M2,5.27L3.28,4L20,20.72L18.73,22L15.65,18.92C14.5,19.3 13.28,19.5 12,19.5C7,19.5 2.73,16.39 1,12C1.69,10.24 2.79,8.69 4.19,7.46L2,5.27M12,9A3,3 0 0,1 15,12C15,12.35 14.94,12.69 14.83,13L11,9.17C11.31,9.06 11.65,9 12,9M12,4.5C17,4.5 21.27,7.61 23,12C22.18,14.08 20.79,15.88 19,17.19L17.58,15.76C18.94,14.82 20.06,13.54 20.82,12C19.17,8.64 15.76,6.5 12,6.5C10.91,6.5 9.84,6.68 8.84,7L7.3,5.47C8.74,4.85 10.33,4.5 12,4.5M3.18,12C4.83,15.36 8.24,17.5 12,17.5C12.69,17.5 13.37,17.43 14,17.29L11.72,15C10.29,14.85 9.15,13.71 9,12.28L5.6,8.87C4.61,9.72 3.78,10.78 3.18,12Z",
  thermo: "M15,13V5A3,3 0 0,0 9,5V13A5,5 0 1,0 15,13M12,4A1,1 0 0,1 13,5V8H11V5A1,1 0 0,1 12,4Z",
  gauge: "M16,11.78L20.24,4.45L21.97,5.45L16.74,14.5L10.23,10.75L5.46,19H22V21H2V3H4V17.54L9.5,8L16,11.78Z", // Verlauf: Messwerte
  shieldHome: "M12,1L3,5V11C3,16.5 6.8,21.7 12,23C17.2,21.7 21,16.5 21,11V5L12,1M12,7L17,11V17H14V13H10V17H7V11L12,7Z",
  shieldAway: "M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,5A3,3 0 0,1 15,8A3,3 0 0,1 12,11A3,3 0 0,1 9,8A3,3 0 0,1 12,5M17.13,17C15.92,18.85 14.11,20.24 12,20.92C9.89,20.24 8.08,18.85 6.87,17C6.53,16.5 6.24,16 6,15.47C6,13.82 8.71,12.47 12,12.47C15.29,12.47 18,13.79 18,15.47C17.76,16 17.47,16.5 17.13,17Z",
  shieldOff: "M1,4.27L2.28,3L21,21.72L19.73,23L17.5,20.77C16.06,22 14.11,22.67 12,23C6.84,21.74 3,16.55 3,11V6.27L1,4.27M12,1L21,5V11C21,13.28 20.36,15.5 19.27,17.38L5.3,3.41L12,1Z",
  shield: "M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1Z",
  moon: "M17.75,4.09L15.22,6.03L16.13,9.09L13.5,7.28L10.87,9.09L11.78,6.03L9.25,4.09L12.44,4L13.5,1L14.56,4L17.75,4.09M21.25,11L19.61,12.25L20.2,14.23L18.5,13.06L16.8,14.23L17.39,12.25L15.75,11L17.81,10.95L18.5,9L19.19,10.95L21.25,11M18.97,15.95C19.8,15.87 20.69,17.05 20.16,17.8C19.84,18.25 19.5,18.67 19.08,19.07C15.17,23 8.84,23 4.94,19.07C1.03,15.17 1.03,8.83 4.94,4.93C5.34,4.53 5.76,4.17 6.21,3.85C6.96,3.32 8.14,4.21 8.06,5.04C7.79,7.9 8.75,10.87 10.95,13.06C13.14,15.26 16.1,16.22 18.97,15.95Z",
  timer: "M12,20A7,7 0 0,1 5,13A7,7 0 0,1 12,6A7,7 0 0,1 19,13A7,7 0 0,1 12,20M19.03,7.39L20.45,5.97C20,5.46 19.55,5 19.04,4.56L17.62,6C16.07,4.74 14.12,4 12,4A9,9 0 0,0 3,13A9,9 0 0,0 12,22C17,22 21,17.97 21,13C21,10.88 20.26,8.93 19.03,7.39M11,14H13V8H11M15,1H9V3H15V1Z",
  alert: "M13,14H11V10H13M13,18H11V16H13M1,21H23L12,2L1,21Z",
  window: "M6,11H10V9H14V11H18V4H6V11M18,13H6V20H18V13M6,2H18A2,2 0 0,1 20,4V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V4A2,2 0 0,1 6,2Z",
  door: "M8,3C6.89,3 6,3.89 6,5V21H18V5C18,3.89 17.11,3 16,3H8M8,5H16V19H8V5M13,11V13H15V11H13Z",
  motion: "M13.5,5.5C14.59,5.5 15.5,4.58 15.5,3.5C15.5,2.38 14.59,1.5 13.5,1.5C12.39,1.5 11.5,2.38 11.5,3.5C11.5,4.58 12.39,5.5 13.5,5.5M9.89,19.38L10.89,15L13,17V23H15V15.5L12.89,13.5L13.5,10.5C14.79,12 16.79,13 19,13V11C17.09,11 15.5,10 14.69,8.58L13.69,7C13.29,6.38 12.69,6 12,6C11.69,6 11.5,6.08 11.19,6.08L6,8.28V13H8V9.58L9.79,8.88L8.19,17L3.29,16L2.89,18L9.89,19.38Z",
  smoke: "M12,3.25C12,3.25 6,10 6,14C6,17.32 8.69,20 12,20A6,6 0 0,0 18,14C18,10 12,3.25 12,3.25M14.47,9.97L15.53,11.03L9.53,17.03L8.47,15.97M9.75,10A1.25,1.25 0 0,1 11,11.25A1.25,1.25 0 0,1 9.75,12.5A1.25,1.25 0 0,1 8.5,11.25A1.25,1.25 0 0,1 9.75,10M14.25,14.5A1.25,1.25 0 0,1 15.5,15.75A1.25,1.25 0 0,1 14.25,17A1.25,1.25 0 0,1 13,15.75A1.25,1.25 0 0,1 14.25,14.5Z",
  garage: "M22,9V20H20V11H4V20H2V9L12,5L22,9M19,12H5V14H19V12M19,18H5V20H19V18M19,15H5V17H19V15Z",
  water: "M12,20A6,6 0 0,1 6,14C6,10 12,3.25 12,3.25C12,3.25 18,10 18,14A6,6 0 0,1 12,20Z",
  sensor: "M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,7A5,5 0 0,0 7,12A5,5 0 0,0 12,17A5,5 0 0,0 17,12A5,5 0 0,0 12,7Z",
  battery: "M16,20H8V6H16M16.67,4H15V2H9V4H7.33A1.33,1.33 0 0,0 6,5.33V20.67C6,21.4 6.6,22 7.33,22H16.67A1.33,1.33 0 0,0 18,20.67V5.33C18,4.6 17.4,4 16.67,4Z",
  offline: "M2.28,3L1,4.27L2.47,5.74C2.04,6 1.61,6.29 1.2,6.6L3,9C3.53,8.6 4.08,8.25 4.66,7.93L6.89,10.16C6.15,10.5 5.44,10.91 4.8,11.4L6.6,13.8C7.38,13.22 8.26,12.77 9.2,12.47L11.75,15C10.5,15.07 9.34,15.5 8.4,16.2L12,21L14.46,17.73L17.74,21L19,19.72M12,3C9.85,3 7.8,3.38 5.9,4.07L8.29,6.47C9.5,6.16 10.72,6 12,6C15.38,6 18.5,7.11 21,9L22.8,6.6C19.79,4.34 16.06,3 12,3M12,9C11.62,9 11.25,9 10.88,9.05L14.07,12.25C15.29,12.53 16.43,13.07 17.4,13.8L19.2,11.4C17.2,9.89 14.7,9 12,9Z",
  refresh: "M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z",
  download: "M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z",
  reset: "M18.93,8.00A8,8 0 1 1 12,4L12,6A6,6 0 1 0 17.20,9.00ZM12,1.5L16.5,5L12,8.5Z",
  info: "M13,9H11V7H13M13,17H11V11H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z",
  open: "M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z",
  pause: "M14,19H18V5H14M6,19H10V5H6V19Z",
  chevRight: "M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z",
  plus: "M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z",
  check: "M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z",
  search: "M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z",
  close: "M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z",
  // Ansicht der Liste (1.23.0): Gruppieren und Sortieren
  area: "M2,2H8V4H16V2H22V8H20V16H22V22H16V20H8V22H2V16H4V8H2V2M16,8V6H8V8H6V16H8V18H16V16H18V8H16M4,4V6H6V4H4M18,4V6H20V4H18M4,18V20H6V18H4M18,18V20H20V18H18Z",
  minus: "M19,13H5V11H19V13Z",
  orderUp: "M19 7H22L18 3L14 7H17V21H19M2 17H12V19H2M6 5V7H2V5M2 11H9V13H2V11Z",
  orderDown: "M19 17H22L18 21L14 17H17V3H19M2 17H12V19H2M6 5V7H2V5M2 11H9V13H2V11Z",
  groups: "M3,4H7V8H3V4M9,5V7H21V5H9M3,10H7V14H3V10M9,11V13H21V11H9M3,16H7V20H3V16M9,17V19H21V17H9Z",
  // Eigene Symbole der Knöpfe "… anzeigen" (1.64.0, Wunsch des Nutzers: jede Liste ihr Symbol; Routinen behalten groups, Töne speaker).
  // key: Schlüssel, waagrecht entworfen und um 45 Grad gedreht (Ring links unten, Bart rechts oben); archive: Kiste mit Deckel und Griff.
  key: "M4.08,11.58A5.9,5.9 0 1,1 12.42,19.92A5.9,5.9 0 1,1 4.08,11.58ZM6.56,14.05A2.4,2.4 0 1,0 9.95,17.44A2.4,2.4 0 1,0 6.56,14.05ZM10.8,11.08L18.58,3.3L20.7,5.42L19.85,6.27L22.32,8.75L20.41,10.66L17.94,8.18L17.16,8.96L18.86,10.66L16.95,12.57L15.25,10.87L12.92,13.2Z",
  archive: "M3,3H21V8H3V3ZM4,9H20V20A1,1 0 0,1 19,21H5A1,1 0 0,1 4,20V9ZM9,12V14H15V12H9Z",
  hand: "M10,9A1,1 0 0,1 11,8A1,1 0 0,1 12,9V13.47L13.21,13.6L18.15,15.79C18.68,16.03 19,16.56 19,17.14V21.5C18.97,22.32 18.32,22.97 17.5,23H11C10.62,23 10.26,22.85 10,22.57L5.1,18.37L5.84,17.6C6.03,17.39 6.3,17.28 6.58,17.28H6.8L10,19V9Z",
  tune: "M3,17V19H9V17H3M3,5V7H13V5H3M13,21V19H21V17H13V15H11V21H13M7,9V11H3V13H7V15H9V9H7M21,13V11H11V13H21M15,9H17V7H21V5H17V3H15V9Z",
  flash: "M7,2V13H10V22L17,10H13L17,2H7Z",
  lockClosed: "M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z",
  doorOpen: "M12,3C10.89,3 10,3.89 10,5H3V19H2V21H22V19H21V5C21,3.89 20.11,3 19,3H12M12,5H19V19H12V5M5,11H7V13H5V11Z",
  undo: "M12.5,8C9.85,8 7.45,9 5.6,10.6L2,7V16H11L7.38,12.38C8.77,11.22 10.54,10.5 12.5,10.5C16.04,10.5 19.05,12.81 20.1,16L22.47,15.22C21.08,11.03 17.15,8 12.5,8Z",
  cog: "M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z",
  grid: "M3,11H11V3H3M3,21H11V13H3M13,21H21V13H13M13,3V11H21V3",
  repeat: "M17,17H7V14L3,18L7,22V19H19V13H17M7,7H17V10L21,6L17,2V5H5V11H7V7Z", // Aktions-Gruppe (1.59.0): wiederholen
  copy: "M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z",
  columns: "M16,5V18H21V5M4,18H9V5H4M10,18H15V5H10V18Z",
  signal: "M3,21H6V18H3M8,21H11V14H8M13,21H16V9H13M18,21H21V3H18V21Z",
  chip: "M6,4H18V5H21V7H18V9H21V11H18V13H21V15H18V17H21V19H18V20H6V19H3V17H6V15H3V13H6V11H3V9H6V7H3V5H6V4M11,15V18H12V15H11M13,15V18H14V15H13M15,15V18H16V15H15Z",
  bellOff: "M20.84,22.73L18.11,20H3V19L5,17V11C5,9.86 5.29,8.73 5.83,7.72L1.11,3L2.39,1.73L22.11,21.46L20.84,22.73M19,15.8V11C19,7.9 16.97,5.17 14,4.29C14,4.19 14,4.1 14,4A2,2 0 0,0 12,2A2,2 0 0,0 10,4C10,4.1 10,4.19 10,4.29C9.39,4.47 8.8,4.74 8.26,5.09L19,15.8M12,23A2,2 0 0,0 14,21H10A2,2 0 0,0 12,23Z",
  bell: "M21,19V20H3V19L5,17V11C5,7.9 7.03,5.17 10,4.29C10,4.19 10,4.1 10,4A2,2 0 0,1 12,2A2,2 0 0,1 14,4C14,4.1 14,4.19 14,4.29C16.97,5.17 19,7.9 19,11V17L21,19M14,21A2,2 0 0,1 12,23A2,2 0 0,1 10,21",
  power: "M16.56,5.44L15.11,6.89C16.84,7.94 18,9.83 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12C6,9.83 7.16,7.94 8.88,6.88L7.44,5.44C5.36,6.88 4,9.28 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12C20,9.28 18.64,6.88 16.56,5.44M13,3H11V13H13",
  powerOff: "M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12C20,13.85 19.37,15.55 18.31,16.9L7.1,5.69C8.45,4.63 10.15,4 12,4M4,12C4,10.15 4.63,8.45 5.69,7.1L16.9,18.31C15.55,19.37 13.85,20 12,20A8,8 0 0,1 4,12Z",
  speaker: "M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z",
  blinds: "M3,4H21V8H19V20H17V8H7V20H5V8H3V4M8,9H16V11H8V9M8,12H16V14H8V12Z",
  script: "M17.8,20C17.4,21.2 16.3,22 15,22H5C3.3,22 2,20.7 2,19V18H5L14.2,18C14.6,19.2 15.7,20 17,20H17.8M19,2C20.7,2 22,3.3 22,5V6H20V5C20,4.4 19.6,4 19,4C18.4,4 18,4.4 18,5V18H17C16.4,18 16,17.6 16,17V16H5V5C5,3.3 6.3,2 8,2H19M8,6V8H15V6H8M8,10V12H14V10H8Z",
  play: "M8,5.14V19.14L19,12.14L8,5.14Z",
  stop: "M18,18H6V6H18V18Z",
  upload: "M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z",
  palette: "M17.5,12A1.5,1.5 0 0,1 16,10.5A1.5,1.5 0 0,1 17.5,9A1.5,1.5 0 0,1 19,10.5A1.5,1.5 0 0,1 17.5,12M14.5,8A1.5,1.5 0 0,1 13,6.5A1.5,1.5 0 0,1 14.5,5A1.5,1.5 0 0,1 16,6.5A1.5,1.5 0 0,1 14.5,8M9.5,8A1.5,1.5 0 0,1 8,6.5A1.5,1.5 0 0,1 9.5,5A1.5,1.5 0 0,1 11,6.5A1.5,1.5 0 0,1 9.5,8M6.5,12A1.5,1.5 0 0,1 5,10.5A1.5,1.5 0 0,1 6.5,9A1.5,1.5 0 0,1 8,10.5A1.5,1.5 0 0,1 6.5,12M12,3A9,9 0 0,0 3,12A9,9 0 0,0 12,21A1.5,1.5 0 0,0 13.5,19.5C13.5,19.11 13.35,18.76 13.11,18.5C12.88,18.23 12.73,17.88 12.73,17.5A1.5,1.5 0 0,1 14.23,16H16A5,5 0 0,0 21,11C21,6.58 16.97,3 12,3Z",
  chartBox: "M9,17H7V10H9V17M13,17H11V7H13V17M17,17H15V13H17V17M19,19H5V5H19V19.1M19,3H5C3.9,3 3,3.9 3,5V19C3,20.1 3.9,21 5,21H19C20.1,21 21,20.1 21,19V5C21,3.9 20.1,3 19,3Z",
  arrowUp: "M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z",
  arrowDown: "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z",
  external: "M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z",
  note: "M12,3V13.55C11.41,13.21 10.73,13 10,13A4,4 0 0,0 6,17A4,4 0 0,0 10,21A4,4 0 0,0 14,17V7H18V3H12Z",
  tone: "M5,9V15H9L14,20V4L9,9M18.5,12C18.5,10.23 17.5,8.71 16,7.97V16C17.5,15.29 18.5,13.76 18.5,12Z",
  history: "M13,3A9,9 0 0,0 4,12H1L4.89,15.89L4.96,16.03L9,12H6A7,7 0 0,1 13,5A7,7 0 0,1 20,12A7,7 0 0,1 13,19C11.07,19 9.32,18.21 8.06,16.94L6.64,18.36C8.27,20 10.5,21 13,21A9,9 0 0,0 22,12A9,9 0 0,0 13,3M12,8V13L16.28,15.54L17,14.33L13.5,12.25V8H12Z",
  arrowLine: "M19.92,12.08L12,20L4.08,12.08L5.5,10.67L11,16.17V2H13V16.17L18.5,10.66L19.92,12.08M12,20H2V22H22V20H12Z",
  calendar: "M19,19H5V8H19M16,1V3H8V1H6V3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3H18V1M17,12H12V17H17V12Z",
  // Routinen (1.44.0): Auslöser Zeitplan und Gerätearten
  clock: "M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z",
  person: "M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z",
  toggle: "M17,7H7A5,5 0 0,0 2,12A5,5 0 0,0 7,17H17A5,5 0 0,0 22,12A5,5 0 0,0 17,7M17,15A3,3 0 0,1 14,12A3,3 0 0,1 17,9A3,3 0 0,1 20,12A3,3 0 0,1 17,15Z",
  bulb: "M12,2A7,7 0 0,0 5,9C5,11.38 6.19,13.47 8,14.74V17A1,1 0 0,0 9,18H15A1,1 0 0,0 16,17V14.74C17.81,13.47 19,11.38 19,9A7,7 0 0,0 12,2M9,21A1,1 0 0,0 10,22H14A1,1 0 0,0 15,21V20H9V21Z",
  pencil: "M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z",
  trash: "M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z",
  grip: "M9,3H11V5H9V3M13,3H15V5H13V3M9,7H11V9H9V7M13,7H15V9H13V7M9,11H11V13H9V11M13,11H15V13H13V11M9,15H11V17H9V15M13,15H15V17H13V15M9,19H11V21H9V19M13,19H15V21H13V19Z",
  restore: "M13,3A9,9 0 0,0 4,12H1L4.89,15.89L4.96,16.03L9,12H6A7,7 0 0,1 13,5A7,7 0 0,1 20,12A7,7 0 0,1 13,19C11.07,19 9.32,18.21 8.06,16.94L6.64,18.36C8.27,20 10.5,21 13,21A9,9 0 0,0 22,12A9,9 0 0,0 13,3Z",
  // HealthCheck (1.65.0): Lebenszeichen an externe Dienste
  heartPulse: "M7.5,4A5.5,5.5 0 0,0 2,9.5C2,10 2.09,10.5 2.22,11H6.3L7.57,7.63C7.87,6.83 9.05,6.75 9.43,7.63L11.5,13L12.09,11.58C12.22,11.25 12.57,11 13,11H21.78C21.91,10.5 22,10 22,9.5A5.5,5.5 0 0,0 16.5,4C14.64,4 13,4.93 12,6.34C11,4.93 9.36,4 7.5,4V4M3,12.5A1,1 0 0,0 2,13.5A1,1 0 0,0 3,14.5H5.44L11,20C12,20.9 12,20.9 13,20L18.56,14.5H21A1,1 0 0,0 22,13.5A1,1 0 0,0 21,12.5H13.4L12.47,14.8C12.07,15.81 10.92,15.67 10.55,14.83L8.5,9.5L7.54,11.83C7.39,12.21 7.05,12.5 6.6,12.5H3Z",
  // Selbsttest (1.65.0)
  stethoscope: "M19,8C19.56,8 20,8.43 20,9A1,1 0 0,1 19,10C18.43,10 18,9.55 18,9C18,8.43 18.43,8 19,8M2,2V11C2,13.96 4.19,16.5 7.14,16.91C7.76,19.92 10.42,22 13.5,22A6.5,6.5 0 0,0 20,15.5V11.81C21.16,11.39 22,10.29 22,9A3,3 0 0,0 19,6A3,3 0 0,0 16,9C16,10.29 16.84,11.4 18,11.81V15.41C18,17.91 16,19.91 13.5,19.91C11.5,19.91 9.82,18.7 9.22,16.9C12,16.3 14,13.8 14,11V2H10V5H12V11A4,4 0 0,1 8,15A4,4 0 0,1 4,11V5H6V2H2Z",
  // Einrichtungsassistent (1.69.0): Zauberstab (MDI "auto-fix")
  wand: "M7.5,5.6L5,7L6.4,4.5L5,2L7.5,3.4L10,2L8.6,4.5L10,7L7.5,5.6M19.5,15.4L22,14L20.6,16.5L22,19L19.5,17.6L17,19L18.4,16.5L17,14L19.5,15.4M22,2L20.6,4.5L22,7L19.5,5.6L17,7L18.4,4.5L17,2L19.5,3.4L22,2M13.34,12.78L15.78,10.34L13.66,8.22L11.22,10.66L13.34,12.78M14.37,7.29L16.71,9.63C17.1,10 17.1,10.65 16.71,11.04L5.04,22.71C4.65,23.1 4,23.1 3.63,22.71L1.29,20.37C0.9,20 0.9,19.35 1.29,18.96L12.96,7.29C13.35,6.9 14,6.9 14.37,7.29Z",
};
// Symbole aus mehreren Teilen: "Ansicht" ist ein Auge mit Zahnrad (das Zahnrad schneidet eine Lücke in das Auge, damit beide lesbar bleiben)
const RAW = {
  viewOptions: `<mask id="ag-vo"><rect width="24" height="24" fill="#fff"/><circle cx="18" cy="18" r="5.4" fill="#000"/></mask>
    <g mask="url(#ag-vo)" transform="translate(0.3 -0.6) scale(.9)"><path fill="currentColor" d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z"/></g>
    <g transform="translate(18 18) scale(.43) translate(-12 -12)"><path fill="currentColor" d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/></g>`,
};
// Eine eingestellte Zeit (Sekunden) einheitlich anzeigen: unter 60 s in Sekunden, ab 60 s in Minuten und Sekunden, ab 1 h mit Stunden;
// Teile, die null sind, entfallen ("2 min", "1 min 30 s", "1 h 5 min"). Die Kürzel sind in Deutsch und Englisch gleich.
// Akzentfarbe je Anlage (1.75.0, Wunsch des Nutzers 2026-11-21, Auswahl wie im Device Panel). "ha" folgt der Farbe des Home-Assistant-Themes (kein Wert);
// dieselben Schlüssel wie der Server (const.ACCENTS). Die Farbe gilt überall dort, wo das Panel sein Blau (--ag-primary) nutzt.
export const ACCENTS = [["ha", null], ["sky", "#4aa8f2"], ["ocean", "#3b82e0"], ["teal", "#3fb0c4"], ["indigo", "#7a82dc"], ["pink", "#e0507d"], ["orange", "#f2953a"], ["red", "#d9453d"], ["green", "#4a8f5f"], ["graphite", "#98a4b3"]];
export const accentColor = (key) => ACCENTS.find(([k]) => k === key)?.[1] || null;
// Raster der Farben als Knöpfe (Punkt in der Farbe, Name); `attr` ist das Attribut mit dem Ziel des Klicks, `data-key` der Schlüssel der Farbe
export const accentGrid = (current, attr, t) => `<div class="ag-acc" role="radiogroup" aria-label="${esc(t("accTitle"))}">${ACCENTS.map(([k, hex]) =>
  `<button type="button" role="radio" class="ag-accbtn ${current === k ? "on" : ""}" ${attr} data-key="${k}" aria-checked="${current === k}"><span class="ag-accdot" style="background:${hex || "var(--primary-color, #03a9f4)"}"></span><span>${esc(t(`acc_${k}`))}</span></button>`).join("")}</div>`;

// Vorschau der gewählten Farbe (Fenster der Akzentfarbe, Wunsch des Nutzers 2026-11-22): die Bausteine, in denen das Panel sie braucht, mit der Farbe nur in
// diesem Kasten (--ag-primary lokal). Sie sind eine kleine Simulation (Wunsch des Nutzers 2026-11-22): Reiter, Schalter, Haken, Pfeil und Knopf lassen sich
// antippen und ändern nur diese Anzeige (Zustand `pv`: tab, tog, chk, up, tag), nie etwas an der Anlage
export const ACC_PV = () => ({ tab: 0, tog: true, chk: true, up: true, tag: true, val: 62, flash: false });
export const accentPreview = (key, t, pv = ACC_PV()) => {
  const hex = accentColor(key);
  const b = (act, label, inner, cls = "") => `<button type="button" class="${cls}" data-sys="${act}" aria-label="${esc(label)}">${inner}</button>`;
  return `<div class="ag-accprev" style="${hex ? `--ag-primary:${hex}` : ""}"><div class="ag-accprev-t ag-t2">${esc(t("accPreview"))} · ${esc(t("accPvTry"))}</div>
    <div class="ag-accprev-body"><div class="ag-seg ag-accprev-seg" role="tablist">${[["accPvTab", "shield"], ["accPvTab2", null]].map(([k, icon], i) =>
      `<button type="button" role="tab" class="${pv.tab === i ? "on" : ""}" data-sys="accpv-tab" data-i="${i}" aria-selected="${pv.tab === i}">${icon ? ic(icon, 16) : ""}<span>${esc(t(k))}</span></button>`).join("")}</div>
      <div class="ag-accprev-row">${b("accpv-btn", t("accPvBtn"), `${ic("check", 16)}${esc(pv.flash ? t("accPvDone") : t("accPvBtn"))}`, "ag-btn primary")}
        <button type="button" class="ag-toggle ${pv.tog ? "on" : ""}" role="switch" aria-checked="${pv.tog}" data-sys="accpv-tog" aria-label="${esc(t("accPvTog"))}"></button>
        ${b("accpv-round", t("accPvRound"), ic(pv.up ? "arrowUp" : "arrowDown", 16), "ag-accprev-round")}
        ${b("accpv-chk", t("accPvChk"), pv.chk ? ic("check", 14) : "", `ag-accprev-chk ${pv.chk ? "on" : ""}`)}</div>
      <div class="ag-accprev-row">${b("accpv-tag", t("accPvTag"), esc(t("accPvTag")), `ag-accprev-tag ${pv.tag ? "on" : ""}`)}<span class="ag-accprev-link">${esc(t("accPvLink"))}</span><input type="range" class="ag-accprev-range" data-sys="accpv-val" min="0" max="100" value="${pv.val}" style="--v:${pv.val}%" aria-label="${esc(t("accPvSlider"))}"></div></div></div>`;
};
// Kleine Vorschau in der Zeile der Seite: Punkt wie am Logo (mit Ring und Schimmer), Schalter, Pille und Balken in der Farbe

export const fmtDur = (seconds) => {
  const n = Math.max(0, Math.round(Number(seconds) || 0));
  if (n < 60) return `${n} s`;
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = n % 60;
  return [h && `${h} h`, m && `${m} min`, s && `${s} s`].filter(Boolean).join(" ");
};

export const ic = (name, size = 18) =>
  `<svg class="ag-ic" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${RAW[name] || `<path fill="currentColor" d="${P[name]}"/>`}</svg>`;

// Play-Knöpfe (Vorgabe des Nutzers, 2026-11-17): Jeder Play-Knopf im Panel wird beim Drücken rot und zum Stopp-Knopf, überall gleich
// (Klasse "ag-running" in styles.js). Läuft etwas, das sich anhalten lässt (Test der Aktionen, Ton), stoppt der Knopf es. Einmalige Tests
// (Testmeldung, ein Schritt der Überwachung) sind nach dem Senden schon fertig: der Knopf bleibt rot, bis der Server geantwortet hat, mindestens
// ONCE_MS (sonst wäre der Wechsel nicht zu sehen); Stopp beendet dort nur die Anzeige, eine gesendete Meldung lässt sich nicht zurückholen.
export const ONCE_MS = 1500;

// Knopf eines einmaligen Tests. `key` sagt, welcher Test es ist: läuft er (owner.onceKey === key), ist der Knopf rot mit Stopp-Symbol. Der Knopf
// wird beim Wechsel nur umgemalt (paintOnce), nie neu gezeichnet: ein offenes Fenster behält Eingaben und Fokus.
export function onceBtn(key, attrs, { running = false, label, stopLabel, text = "", size = 18, cls = "ag-iconbtn", disabled = false, title = "" }) {
  const tip = running ? stopLabel : title || label;
  return `<button type="button" class="${cls} ${running ? "ag-running" : ""}" ${attrs} data-once="${esc(key)}" data-label="${esc(label)}" data-stop="${esc(stopLabel)}" data-tip="${esc(title || label)}"
    ${disabled && !running ? "disabled" : ""} aria-label="${esc(running ? stopLabel : label)}" title="${esc(tip)}">${ic(running ? "stop" : "play", size)}${esc(text)}</button>`;
}

// Alle Knöpfe einmaliger Tests in den Bereichen `roots` dem laufenden Test `key` anpassen (rot und Stopp oder wieder Play)
export function paintOnce(roots, key) {
  for (const root of roots) {
    for (const b of root?.querySelectorAll?.("[data-once]") || []) {
      const run = b.dataset.once === key;
      b.classList.toggle("ag-running", run);
      const svg = b.querySelector("svg");
      if (svg) svg.outerHTML = ic(run ? "stop" : "play", Number(svg.getAttribute("width")) || 18);
      b.setAttribute("aria-label", run ? b.dataset.stop : b.dataset.label);
      b.title = run ? b.dataset.stop : b.dataset.tip;
      if (run) b.disabled = false;
    }
  }
}

// Einen einmaligen Test ausführen: Knopf rot, Arbeit, mindestens ONCE_MS, dann wieder Play (wenn nicht inzwischen gestoppt oder ersetzt)
export async function runOnce(owner, key, work, paint) {
  owner.onceKey = key;
  paint();
  const started = Date.now();
  try {
    await work();
  } finally {
    const rest = ONCE_MS - (Date.now() - started);
    if (rest > 0) await new Promise((resolve) => setTimeout(resolve, rest));
    if (owner.onceKey === key) {
      owner.onceKey = null;
      paint();
    }
  }
}

// Kopieren in die Zwischenablage (1.64.0 zusammengelegt, Wunsch des Nutzers: auch im Fenster "Anlage hinzufügen"): überall derselbe Knopf und
// dieselbe Rückmeldung. Bisher nur in der Sensoransicht (`sensorview.js`). `attrs` trägt das Attribut des zuständigen Klick-Handlers.
export const copyBtn = (value, label, attrs = "", cls = "") =>
  `<button type="button" class="ag-iconbtn ag-copy ${cls}" ${attrs} data-value="${esc(value)}" aria-label="${esc(label)}" title="${esc(label)}">${ic("copy", 16)}</button>`;

// Wert des Knopfs `el` in die Zwischenablage. Der Browser erlaubt `navigator.clipboard` im Panel (iframe) nicht überall (Companion App, kein
// HTTPS): dann der Weg über ein verstecktes Textfeld, in einem offenen Fenster in diesem (ausserhalb eines modalen Fensters lässt sich nichts
// markieren). Rückmeldung am Knopf selbst (Häkchen oder Warnzeichen), ein Hinweis läge hinter dem Fenster. `doc`: Dokument des Panels.
export async function copyValue(el, doc) {
  const value = el.dataset.value || "";
  let ok = false;
  try {
    await doc.defaultView.navigator.clipboard.writeText(value);
    ok = true;
  } catch {
    try {
      const area = doc.createElement("textarea");
      area.value = value;
      area.setAttribute("readonly", "");
      area.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
      (el.closest("dialog") || doc.body).appendChild(area);
      area.select();
      area.setSelectionRange(0, value.length);
      ok = doc.execCommand("copy");
      area.remove();
    } catch {
      ok = false;
    }
  }
  el.classList.toggle("done", ok);
  el.classList.toggle("fail", !ok);
  el.innerHTML = ic(ok ? "check" : "alert", 16);
  clearTimeout(el._copyTimer);
  el._copyTimer = setTimeout(() => {
    el.classList.remove("done", "fail");
    el.innerHTML = ic("copy", 16);
  }, 1600);
  return ok;
}

// Maskieren auch von Anführungszeichen: Namen landen in Attributen (LEARNINGS)
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const MODE_ICON = { off: "shieldOff", home: "shieldHome", away: "shieldAway", night: "moon" };
export const MODE_KEY = { off: "modeOff", home: "modeHome", away: "modeAway", night: "modeNight" };
export const ARMED = { armed_home: "home", armed_away: "away", armed_night: "night" };
export const DC = {
  door: ["door", "dcDoor"], window: ["window", "dcWindow"], opening: ["door", "dcOpening"], garage_door: ["garage", "dcGarage"],
  motion: ["motion", "dcMotion"], occupancy: ["motion", "dcOccupancy"], presence: ["motion", "dcPresence"],
  smoke: ["smoke", "dcSmoke"], gas: ["smoke", "dcGas"], carbon_monoxide: ["smoke", "dcCo"], moisture: ["water", "dcMoisture"],
  vibration: ["sensor", "dcVibration"], tamper: ["alert", "dcTamper"], safety: ["alert", "dcSafety"], sound: ["sensor", "dcSound"],
  glass_break: ["window", "dcGlass"],
  heat: ["smoke", "dcHeat"], lock: ["lockClosed", "dcLock"], moving: ["motion", "dcMoving"],
  // Messwerte (Überwachung, 1.48.0)
  temperature: ["thermo", "dcTemperature"], humidity: ["smoke", "dcHumidity"], carbon_dioxide: ["gauge", "dcCo2"], pressure: ["gauge", "dcPressure"],
  illuminance: ["bulb", "dcIlluminance"], pm25: ["gauge", "dcPm"], pm10: ["gauge", "dcPm"], aqi: ["gauge", "dcAqi"], volatile_organic_compounds: ["gauge", "dcVoc"],
};
export const MEASURE_CLASSES = new Set(["temperature", "humidity", "carbon_dioxide", "pressure", "illuminance", "pm25", "pm10", "aqi", "volatile_organic_compounds"]);
export const OPENINGS = new Set(["door", "window", "opening", "garage_door"]);
export const MOTION = new Set(["motion", "occupancy", "presence"]);
// Luftqualität unter den Messwerten (CO2, CO, Feinstaub, VOC, AQI, NO2, Ozon, SO2)
export const AIR = new Set(["carbon_dioxide", "carbon_monoxide", "pm1", "pm25", "pm10", "aqi", "volatile_organic_compounds", "volatile_organic_compounds_parts", "nitrogen_dioxide", "ozone", "sulphur_dioxide"]);
// Art eines Messwerts für die Filter: Temperatur, Luftfeuchtigkeit, Helligkeit, Luftqualität, sonst "Weitere" (etwa Luftdruck)
export const measureKind = (dc) => (dc === "temperature" || dc === "humidity" || dc === "illuminance" ? dc : AIR.has(dc) ? "air" : "other");
// Filter der Sensoren unter Konfiguration › Sensoren und im Fenster "Sensoren hinzufügen" (seit 1.72.0, Wunsch des Nutzers 2026-11-20, 13:56): Messwerte
// nach Art statt einer Pille "Messwerte"; Wassermelder mit eigener Pille (Wunsch des Nutzers 14:45: "das kommt oft vor"); "Weitere" nimmt alles, was keine
// eigene Pille hat (Rauch, Gas, CO, Hitze, Erschütterung, Sabotage, Geräusch, Glasbruch, Schloss, Bewegung eines Geräts, Sicherheit, Luftdruck). Zu sehen
// sind nur die Pillen, zu denen es Sensoren gibt (`sensorFilters`)
export const SENSOR_FILTERS = [["all", "filterAll"], ["openings", "filterOpenings"], ["motion", "filterMotion"], ["water", "dcMoisture"], ["temperature", "dcTemperature"],
  ["humidity", "dcHumidity"], ["illuminance", "dcIlluminance"], ["air", "dcAqi"], ["other", "filterOther"]];
export const sensorKind = (info) => (info?.kind === "value" ? measureKind(info.device_class) : OPENINGS.has(info?.device_class) ? "openings"
  : MOTION.has(info?.device_class) ? "motion" : info?.device_class === "moisture" ? "water" : "other");
export const sensorFilters = (infos) => {
  const kinds = new Set(infos.map(sensorKind));
  return SENSOR_FILTERS.filter(([k]) => k === "all" || kinds.has(k));
};
export const LOW_BATTERY = 20;
export const POLL_MS = 30000;
// Messwerte, Batterie und Empfang: so oft werden die Ansichten höchstens neu gezeichnet, wenn sich nur solche Werte ändern (1.60.0).
// Zustände der Anlagen und der Sensoren (offen, zu, Bewegung, Alarm) erscheinen sofort.
export const SOFT_MS = 2000;
export const WS_TIMEOUT_MS = 20000;

// callWS wirft nicht immer einen Error (LEARNINGS): Text und Verbindungsfehler robust erkennen
export const errText = (err) => (err && (err.message || err.code)) || String(err);
export const isConnectionError = (err) => err === 1 || err === 3 || err?.code === 3 || /connection.?lost|socket/i.test(String(err?.message || err));


// Optionen pro Sensor (Reihenfolge wie im Seitenblatt) und Sensorarten (wie const.py)
export const OPTIONS = [
  { key: "always", icon: "flash", name: "optAlways", hint: "optAlwaysHint", short: "optAlwaysShort" },
  { key: "open_ok", icon: "doorOpen", name: "optOpenOk", hint: "optOpenOkHint", short: "optOpenOkShort" },
  { key: "bypass", icon: "shieldOff", name: "optBypass", hint: "optBypassHint", short: "optBypassShort" },
  { key: "arm_on_close", icon: "lockClosed", name: "optArmOnClose", hint: "optArmOnCloseHint", short: "optArmOnCloseShort" },
  { key: "offline_alarm", icon: "offline", name: "optOffline", hint: "optOfflineHint", short: "optOfflineShort" },
  { key: "confirm", icon: "groups", name: "optConfirm", hint: "optConfirmHint", short: "optConfirmShort" },
  { key: "report_only", icon: "bell", name: "optReport", hint: "optReportHint", short: "optReportShort" },
];
export const TYPES = [
  ["door", "door", "typeDoor"], ["window", "window", "typeWindow"], ["motion", "motion", "typeMotion"],
  ["environment", "smoke", "typeEnvironment"], ["tamper", "alert", "typeTamper"], ["other", "sensor", "typeOther"],
];
export const DEFAULT_PRESETS = { door: ["arm_on_close"], window: [], motion: ["open_ok"], environment: ["always"], tamper: ["offline_alarm"], other: [] };
export const GONE = new Set(["unavailable", "unknown"]);

// Suche in den Listen der Fenster (Routinen, eigene Töne, Sicherungen; 1.60.0): jedes Wort der Eingabe muss in einem der Texte vorkommen,
// Gross- und Kleinschreibung zählen nicht. Die Texte sind alles, was die Zeile zeigt, dazu, was man kennt, aber nicht sieht (Entitäts-IDs).
export const matchQuery = (q, ...parts) => {
  const hay = parts.flat().filter(Boolean).join(" ").toLowerCase();
  return String(q || "").toLowerCase().split(/\s+/).filter(Boolean).every((word) => hay.includes(word));
};
// Das Suchfeld dazu, im Design der übrigen Listen: `attr` ist das Ereignis-Attribut des Moduls (data-sys ...), `name` der Wert darin;
// der Knopf zum Leeren heisst `<name>-clear`
export const searchField = (attr, name, value, label, clearLabel) => `<label class="list-search">${ic("search", 18)}<input type="search" ${attr}="${name}" placeholder="${esc(label)}" value="${esc(value)}" aria-label="${esc(label)}" autocomplete="off">
  <button type="button" class="ag-clear" ${attr}="${name}-clear" aria-label="${esc(clearLabel)}" ${value ? "" : "hidden"}>${ic("close", 16)}</button></label>`;

// Kapitel in den Einstellungen (wie in Device Panel): Titel mit Strich davor, optional eine Zeile Erklärung, darunter die Karte
// Titel eines Fensters mit dem Symbol seines Kapitels (1.66.2, Wunsch des Nutzers 2026-11-19): dieselbe getönte Kachel wie in der Zeile unter
// Konfiguration › Anlage, etwas grösser (Computer 42 px, Handy 38 px). `cls` ist die Tönung der Zeile, etwa "ag-tint ag-tint-health on".
export const iconTitle = (icon, cls, text) => `<h3 class="ag-ttl"><span class="ag-oav ag-ttl-av ${cls}" aria-hidden="true">${ic(icon, 24)}</span><span>${esc(text)}</span></h3>`;
export const chapter = (title, body, hint = "", extra = "") => `<section class="ag-chap ${extra}"><h3 class="ag-chap-t">${esc(title)}</h3>${hint ? `<p class="ag-chap-h">${esc(hint)}</p>` : ""}${body}</section>`;
