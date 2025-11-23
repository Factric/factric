/* ---------- FIREBASE CONFIGURATION ---------- */
// TODO: Replace with your Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyDCKQ3AgzTFTOxSEou_EWi1C6LpGXCFL8o",
  authDomain: "harbinger-of-death.firebaseapp.com",
  databaseURL: "https://harbinger-of-death-default-rtdb.firebaseio.com",
  projectId: "harbinger-of-death",
  storageBucket: "harbinger-of-death.firebasestorage.app",
  messagingSenderId: "274136846573",
  appId: "1:274136846573:web:5e9f771d3daf8ec77e7ce4",
  measurementId: "G-EXHDMZVJBR"
}

/*
  IMPORTANT: To use Firebase authentication, you need to:
  1. Create a Firebase project at https://console.firebase.google.com/
  2. Enable Email/Password authentication in the Firebase Console
  3. Replace the placeholder values above with your actual Firebase project configuration
  4. Ensure your domain is added to the list of authorized domains in Firebase
  5. Configure Firebase Realtime Database security rules (see FIREBASE_SETUP.md for details)
     The rules should allow authenticated users to read/write their own data:
     {
       "rules": {
         "users": {
           "$uid": {
             ".read": "auth !== null && auth.uid === $uid",
             ".write": "auth !== null && auth.uid === $uid"
           }
         }
       }
     }
*/

// Initialize Firebase
let app;
let auth;
let db;
let database; // Realtime Database instance
let currentUser = null;
let isAuthReady = false;

// Initialize Firebase when the app loads
try {
  app = firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();
  database = firebase.database(); // Initialize Realtime Database
  storage = firebase.storage(); // Initialize Firebase Storage

  console.log('[FIREBASE] Firebase initialized successfully');
  try {
    const authStatusElement = document.getElementById('auth-status');
    if (authStatusElement) {
      authStatusElement.textContent = 'Firebase Ready';
    }
  } catch (e) {
    console.log('[FIREBASE] Auth status element not found in header (expected after move to settings)');
  }

  // Check initial auth state
  if (auth) {
    auth.onAuthStateChanged(user => {
      try {
        const authStatusElement = document.getElementById('auth-status');
        if (authStatusElement) {
          if (user) {
            console.log('[FIREBASE] Initial user detected:', user.email);
            authStatusElement.textContent = `Logged in as ${user.email}`;
          } else {
            console.log('[FIREBASE] No initial user detected');
            authStatusElement.textContent = 'Not logged in';
          }
        }
      } catch (e) {
        console.log('[FIREBASE] Auth status element not found in header (expected after move to settings)');
      }
    });
  }
} catch (error) {
  console.error('[FIREBASE] Error initializing Firebase:', error);
  try {
    const authStatusElement = document.getElementById('auth-status');
    if (authStatusElement) {
      authStatusElement.textContent = 'Firebase Error';
    }
  } catch (e) {
    console.log('[FIREBASE] Auth status element not found in header (expected after move to settings)');
  }
}

/* ---------- GOOGLE SHEETS CONFIGURATION ---------- */
// Google Sheets API configuration
let googleSheetsReady = false;
let googleApiKey = 'AIzaSyAsrbURdNN9yORiZxSg3RGfg-hUhkhiLjs';
let googleSheetId = '1lJjq-cjvzBBjbihkoLtFuiGG8qOqObio2Ws8hJepaa0';
let googleAccessToken = null;

/*
  IMPORTANT: To use Google Sheets integration, you need to:
  1. Create a Google Cloud Project and enable the Google Sheets API
  2. Create API credentials (API key and OAuth client ID)
  3. Replace 'YOUR_GOOGLE_API_KEY' with your actual API key
  4. Replace 'YOUR_SHEET_ID' with your actual Google Sheet ID
  5. Implement proper OAuth authentication flow
  
  For detailed setup instructions, see: https://developers.google.com/sheets/api/quickstart/js
*/

/* ---------- EMBEDDED DATA STORAGE ---------- */
// ALL DATA IS SAVED HERE - Copy this file to backup all progress!
const STORAGE_KEY = 'harbinger_v1';
const SETTINGS_KEY = 'harbinger_settings_v1';
const ADVANCEMENTS_KEY = 'harbinger_advancements_v1'; // NEW: Store advancements locally
const ADVANCEMENT_BASELINES_KEY = 'harbinger_advancement_baselines_v1'; // NEW: Store baseline reps for each completed difficulty
let logData = null; // Stored in the HTML file itself (Reps, Max, Challenge State)
let settings = null; // Stored in the HTML file itself (Theme, Accent)
let completedDifficulties = {}; // Stored in the HTML file itself (Advancement Unlocks)
let advancementBaselines = {}; // Stored in the HTML file itself
let currentPage = 'home';

// SPA Routing System
const routes = {
  'home': { title: 'Home', render: renderHome },
  'pushups': { title: 'Pushups', render: () => renderTab('pushups') },
  'pullups': { title: 'Pullups', render: () => renderTab('pullups') },
  'legs': { title: 'Legs', render: () => renderTab('legs') },
  'abs': { title: 'Abs', render: () => renderTab('abs') },
  'kicks': { title: 'Kicks', render: () => renderTab('kicks') },
  'advancements': { title: 'Advancements', render: renderAdvancements },
  'bodystats': { title: 'Body Stats', render: renderBodyStats },
  'grand-total': { title: 'Overview', render: renderGrandTotal },
  'ranking': { title: 'Ranking', render: renderRanking },
  'settings': { title: 'Settings', render: renderSettings }
};

// Get current page from URL hash
function getCurrentPageFromHash() {
  const hash = window.location.hash.substring(1);
  return hash && routes[hash] ? hash : 'home';
}

// Update URL without page reload
function updateURL(page) {
  const route = routes[page];
  if (route) {
    history.pushState({ page: page }, route.title, `#${page}`);
    document.title = `${route.title} - Harbinger Log`;
  }
}

// Handle browser back/forward buttons
window.addEventListener('popstate', function (event) {
  if (event.state && event.state.page) {
    changePage(event.state.page);
  } else {
    // Default to home page
    changePage('home');
  }
});

// Handle hash changes for direct navigation
window.addEventListener('hashchange', function () {
  const hash = window.location.hash.substring(1);
  if (hash && routes[hash]) {
    changePage(hash);
  } else {
    changePage('home');
  }
});
// MODIFIED: Set default difficulty to Beginner
let currentAdvancementDifficulty = 'Beginner';

const ACCENT_COLORS = { // NEW
  Blue: { primary: '#2323FF', secondary: '#1a1ae6' },
  Red: { primary: '#dc2626', secondary: '#b91c1c' },
  Yellow: { primary: 'rgb(255, 237, 41)', secondary: 'rgb(200, 180, 30)' },
  Green: { primary: 'rgb(57, 255, 20)', secondary: 'rgb(45, 200, 15)' },
  Purple: { primary: 'rgb(127, 0, 255)', secondary: 'rgb(100, 0, 200)' },
  Cyan: { primary: 'rgb(0, 255, 255)', secondary: 'rgb(0, 200, 200)' },
  Orange: { primary: 'rgb(255, 95, 31)', secondary: 'rgb(200, 75, 25)' },
  White: { primary: 'rgb(255, 255, 255)', secondary: 'rgb(200, 200, 200)' },
  Gold: { primary: '#facc15', secondary: '#bfa100' },
  Custom: { primary: 'rgb(100, 100, 100)', secondary: 'rgb(80, 80, 80)' }, // Default custom color
};

// RGB Animation Effects
const RGB_ANIMATIONS = {
  Rainbow: {
    name: 'Rainbow Cycle',
    description: 'Cycles through all colors of the rainbow'
  },
  Fire: {
    name: 'Fire Effect',
    description: 'Cycles through red, orange, and yellow tones'
  },
  Ocean: {
    name: 'Ocean Wave',
    description: 'Cycles through blue and cyan tones'
  },
  Forest: {
    name: 'Forest Glow',
    description: 'Cycles through green and teal tones'
  },
  Sunset: {
    name: 'Sunset Glow',
    description: 'Cycles through warm colors like pink, orange, and purple'
  }
};

const THEMES = { // NEW
  Dark: { label: 'Dark (Default)' },
  Grave: { label: 'Grave (Pitch Black)' },
  Light: { label: 'Light (High Contrast)' },
  Video: { label: 'Video Backgrounds' }
};

const INITIAL_SETTINGS = { // NEW
  accent: 'Blue',
  videoBackground: null
};

const MUSIC_TONES = [
  'Synthwave Assault',
  'Industrial Grind',
  'Metal Mayhem',
  'Epic Orchestral',
  'Dark Trap',
  'Viking War Drums'
];

const BASE_XP = {
  pushups: { Standard: 1, Diamond: 2, Wide: 1, Incline: 1, Pike: 2, Knee: 1 },
  pullups: { Standard: 2, Chin: 3 },
  legs: { Squats: 1, Lunges: 1, SideSquat: 2, JumpSquats: 2, PistolSquat: 2 },
  abs: { Planks: 1, LegRaises: 1, RussianTwists: 1, HangingLegRaise: 2, AbRoller: 2 },
  kicks: { Groin: 1, Front: 1, Roundhouse: 2, UchiRoundhouse: 2, Side: 2, BackSide: 2, Hook: 2, BackHook: 3, Axe: 2, Mikkazuk: 2, '360Round': 3, '720Hook': 4, DoubleRound: 3 }
};
const DIFFICULTY_MULTIPLIER = { 'Beginner': 1, 'Easy': 1, 'Medium': 2, 'Hard': 2, 'Insane': 3 };

// XP Rewards for completing advancements (now calculated dynamically based on reps * base XP)
const ADVANCEMENT_XP_REWARDS = {
  'Beginner': 0,  // Will be calculated dynamically
  'Easy': 0,      // Will be calculated dynamically
  'Medium': 0,    // Will be calculated dynamically
  'Hard': 0,      // Will be calculated dynamically
  'Insane': 0     // Will be calculated dynamically
};
/* --- EXERCISE DEFINITIONS & TIERS (MODIFIED: Recruit's Resolve removed) --- */
const TIERS_DEFINITION = {
  // Pushups - Removed Recruit's Resolve (goal: 50)
  PUSHUP_STD_EASY: [{ goal: 200, name: "Iron Shoulders", desc: "Develops chest, shoulders, and triceps strength." }],
  PUSHUP_DIAMOND_EASY: [{ goal: 100, name: "Diamond Strength", desc: "Targets triceps and inner chest." }],
  PUSHUP_WIDE_EASY: [{ goal: 200, name: "Broad Chest", desc: "Emphasizes outer chest and shoulders." }],
  PUSHUP_INCLINE_EASY: [{ goal: 200, name: "Upper Chest Builder", desc: "Focuses on the lower chest and front deltoids." }],
  PUSHUP_PIKE_EASY: [{ goal: 150, name: "Shoulder Press Mimic", desc: "Works shoulders and upper chest, similar to a press." }],
  PUSHUP_KNEE_EASY: [{ goal: 300, name: "Assisted Strength", desc: "Builds foundational pushing strength with less intensity." }],
  // Pullups - Removed Rookie Hang (goal: 10)
  PULLUP_STD_EASY: [{ goal: 40, name: "Back Vulture", desc: "Developing wing span." }],

  // Chin-ups - Removed Chin Initiate (goal: 20)
  PULLUP_CHIN_EASY: [{ goal: 80, name: "Chin Master", desc: "Perfecting chin-up technique." }],

  // Squats - Removed Earthbound Stance (goal: 100)
  LEG_SQUAT_EASY: [{ goal: 400, name: "Legion's Might", desc: "Solidifying lower body strength." }],

  // Lunges
  LEG_LUNGE_EASY: [{ goal: 300, name: "Stride Master", desc: "Building unilateral leg strength and balance." }],

  // Side Squats
  LEG_SIDESQUAT_EASY: [{ goal: 150, name: "Lateral Dominator", desc: "Developing lateral leg strength and mobility." }],

  // Jump Squats
  LEG_JUMPSQUAT_EASY: [{ goal: 200, name: "Explosive Leaper", desc: "Building explosive lower body power." }],

  // Pistol Squats (Advanced - Easy start, no Beginner)
  LEG_PISTOLSQUAT_EASY: [{ goal: 60, name: "Single Leg Master", desc: "Mastering unilateral leg strength and balance." }],

  // Planks - Removed Core Discipline (goal: 120s)
  ABS_PLANK_EASY: [{ goal: 360, name: "Abyssal Hold", desc: "Total plank hold time" }],

  // Basic Kicks (Easy-Medium) - Removed first tiers
  KICK_ROUNDHOUSE_EASY: [{ goal: 200, name: "Rotation Master", desc: "Perfecting hip movement." }],
  KICK_FRONT_EASY: [{ goal: 160, name: "Straight Arrow", desc: "Perfecting linear power." }],
  KICK_GROIN_EASY: [{ goal: 140, name: "Ground Pounder", desc: "Dominating low-level combat." }],
  KICK_SIDE_EASY: [{ goal: 180, name: "Side Winder", desc: "Perfecting lateral movement." }],
  KICK_MIKKAZUK_EASY: [{ goal: 160, name: "Crescent Master", desc: "Perfecting curved strikes." }],
  KICK_DOUBLEROUND_EASY: [{ goal: 120, name: "Double Master", desc: "Perfecting double strikes." }],

  // Intermediate Kicks (Medium-Hard) - Removed first tiers
  KICK_UCHIROUNDHOUSE_MEDIUM: [{ goal: 100, name: "Curve Master", desc: "Perfecting curved strikes." }],
  KICK_BACKSIDE_MEDIUM: [{ goal: 80, name: "Back Blaster", desc: "Mastering rear attacks." }],
  KICK_HOOK_MEDIUM: [{ goal: 60, name: "Hook Master", desc: "Perfecting hook strikes." }],
  KICK_BACKHOOK_MEDIUM: [{ goal: 48, name: "Back Hook Master", desc: "Perfecting reverse technique." }],
  KICK_AXE_MEDIUM: [{ goal: 72, name: "Axe Master", desc: "Perfecting downward strikes." }],

  // Advanced Kicks (Hard-Insane) - Removed first tiers
  KICK_720HOOK_HARD: [{ goal: 20, name: "Whirlwind Master", desc: "Perfecting the deadly spin." }],
  KICK_360ROUND_HARD: [{ goal: 24, name: "Spin Master", desc: "Perfecting full rotation." }],
};
function createScaledTiers(easyTiers, unit = 'reps') {
  const createTier = (tier, factor, level) => {
    // Since the source array now only contains one tier (the higher one), 
    // we scale that single tier.
    const newGoal = Math.round(tier.goal * factor);
    const baseName = tier.name.split(' (')[0];

    // Create dynamic description with proper formatting
    let description = tier.desc;

    // For planks (seconds), add time conversion
    if (unit === 's' && newGoal >= 60) {
      const mins = Math.floor(newGoal / 60);
      const secs = newGoal % 60;
      const timeStr = secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
      description = `${tier.desc} (${timeStr})`;
    }

    return {
      goal: newGoal,
      name: `${baseName} (${level})`,
      desc: `${description} (Goal: ${newGoal.toLocaleString()} ${unit})`
    };
  };

  // The tier array now only has one goal, which defines the 'mastery' of that difficulty level.
  return {
    Beginner: [createTier(easyTiers[0], 0.5, 'Beginner')], // NEW: 0.5x, using only the first (and only) element
    Easy: [createTier(easyTiers[0], 1, 'Easy')],
    Medium: [createTier(easyTiers[0], 2, 'Medium')],
    Hard: [createTier(easyTiers[0], 3.5, 'Hard')],
    Insane: [createTier(easyTiers[0], 5, 'Insane')],
  };
}

// Special function for Pistol Squat - Easy to Insane only (no Beginner)
function createPistolSquatTiers(easyTiers, unit = 'reps') {
  const createTier = (tier, factor, level) => {
    const newGoal = Math.round(tier.goal * factor);
    const baseName = tier.name.split(' (')[0];
    return {
      goal: newGoal,
      name: `${baseName} (${level})`,
      desc: `${tier.desc} (Goal: ${newGoal.toLocaleString()} ${unit})`
    };
  };

  return {
    Beginner: [], // No Beginner tier
    Easy: [createTier(easyTiers[0], 1, 'Easy')], // Starts at Easy, pre-unlocked
    Medium: [createTier(easyTiers[0], 2, 'Medium')],
    Hard: [createTier(easyTiers[0], 3.5, 'Hard')],
    Insane: [createTier(easyTiers[0], 5, 'Insane')],
  };
}
// Special function for 720Hook kick - only Hard and Insane difficulties
function create720HookTiers(hardTiers, unit = 'reps') {
  const createTier = (tier, factor, level) => {
    const newGoal = Math.round(tier.goal * factor);
    const baseName = tier.name.split(' (')[0];
    return {
      goal: newGoal,
      name: `${baseName} (${level})`,
      desc: `${tier.desc} (Goal: ${newGoal.toLocaleString()} ${unit})`
    };
  };

  return {
    Beginner: [],
    Easy: [],
    Medium: [],
    Hard: [createTier(hardTiers[0], 1, 'Hard')],
    Insane: [createTier(hardTiers[0], 1.43, 'Insane')],
  };
}
// Special function for intermediate kicks - Medium and Hard difficulties
function createIntermediateKickTiers(mediumTiers, unit = 'reps') {
  const createTier = (tier, factor, level) => {
    const newGoal = Math.round(tier.goal * factor);
    const baseName = tier.name.split(' (')[0];
    return {
      goal: newGoal,
      name: `${baseName} (${level})`,
      desc: `${tier.desc} (Goal: ${newGoal.toLocaleString()} ${unit})`
    };
  };

  return {
    Beginner: [],
    Easy: [],
    Medium: [createTier(mediumTiers[0], 1, 'Medium')],
    Hard: [createTier(mediumTiers[0], 1.75, 'Hard')],
    Insane: [createTier(mediumTiers[0], 2.5, 'Insane')],
  };
}

// Special function for advanced kicks - Hard and Insane difficulties
function createAdvancedKickTiers(hardTiers, unit = 'reps') {
  const createTier = (tier, factor, level) => {
    const newGoal = Math.round(tier.goal * factor);
    const baseName = tier.name.split(' (')[0];
    return {
      goal: newGoal,
      name: `${baseName} (${level})`,
      desc: `${tier.desc} (Goal: ${newGoal.toLocaleString()} ${unit})`
    };
  };

  return {
    Beginner: [],
    Easy: [],
    Medium: [],
    Hard: [createTier(hardTiers[0], 1, 'Hard')],
    Insane: [createTier(hardTiers[0], 1.43, 'Insane')],
  };
}

const INITIAL_STATE = {
  pushups: { Standard: { max: 0, total: 0 }, Diamond: { max: 0, total: 0 }, Wide: { max: 0, total: 0 }, Incline: { max: 0, total: 0 }, Pike: { max: 0, total: 0 }, Knee: { max: 0, total: 0 } },
  pullups: { Standard: { max: 0, total: 0 }, Chin: { max: 0, total: 0 } },
  legs: { Squats: { max: 0, total: 0 }, Lunges: { max: 0, total: 0 }, SideSquat: { max: 0, total: 0 }, JumpSquats: { max: 0, total: 0 }, PistolSquat: { maxLeft: 0, maxRight: 0, totalLeft: 0, totalRight: 0, total: 0 } },
  abs: { Planks: { max: 0, total: 0 }, LegRaises: { max: 0, total: 0 }, RussianTwists: { max: 0, total: 0 }, HangingLegRaise: { max: 0, total: 0 }, AbRoller: { max: 0, total: 0 } },
  kicks: {
    Groin: { maxLeft: 0, maxRight: 0, totalLeft: 0, totalRight: 0, total: 0 },
    Front: { maxLeft: 0, maxRight: 0, totalLeft: 0, totalRight: 0, total: 0 },
    Roundhouse: { maxLeft: 0, maxRight: 0, totalLeft: 0, totalRight: 0, total: 0 },
    UchiRoundhouse: { maxLeft: 0, maxRight: 0, totalLeft: 0, totalRight: 0, total: 0 },
    Side: { maxLeft: 0, maxRight: 0, totalLeft: 0, totalRight: 0, total: 0 },
    BackSide: { maxLeft: 0, maxRight: 0, totalLeft: 0, totalRight: 0, total: 0 },
    Hook: { maxLeft: 0, maxRight: 0, totalLeft: 0, totalRight: 0, total: 0 },
    BackHook: { maxLeft: 0, maxRight: 0, totalLeft: 0, totalRight: 0, total: 0 },
    Axe: { maxLeft: 0, maxRight: 0, totalLeft: 0, totalRight: 0, total: 0 },
    Mikkazuk: { maxLeft: 0, maxRight: 0, totalLeft: 0, totalRight: 0, total: 0 },
    '360Round': { maxLeft: 0, maxRight: 0, totalLeft: 0, totalRight: 0, total: 0 },
    '720Hook': { maxLeft: 0, maxRight: 0, totalLeft: 0, totalRight: 0, total: 0 },
    DoubleRound: { maxLeft: 0, maxRight: 0, totalLeft: 0, totalRight: 0, total: 0 }
  },
  xp: 0,
  weeklyChallenge: { weekKey: null, challenge: null, progress: 0, isComplete: false, baseline: 0, completionNotified: false },
  specialAbilities: { Handstand: 'Locked', 'L-Sit': 'Locked' },
  userProfile: { weight: null, height: null, age: null } // NEW: User profile data for Combat Identity Analyzer
};
const DEFAULT_TIERS = createScaledTiers(TIERS_DEFINITION.PUSHUP_STD_EASY);
const BASE_TIERS = {
  'pushups': {
    'Standard': createScaledTiers(TIERS_DEFINITION.PUSHUP_STD_EASY),
    'Diamond': createScaledTiers(TIERS_DEFINITION.PUSHUP_DIAMOND_EASY),
    'Wide': createScaledTiers(TIERS_DEFINITION.PUSHUP_WIDE_EASY),
    'Incline': createScaledTiers(TIERS_DEFINITION.PUSHUP_INCLINE_EASY),
    'Pike': createScaledTiers(TIERS_DEFINITION.PUSHUP_PIKE_EASY),
    'Knee': createScaledTiers(TIERS_DEFINITION.PUSHUP_KNEE_EASY)
  },
  'pullups': {
    'Standard': createScaledTiers(TIERS_DEFINITION.PULLUP_STD_EASY),
    'Chin': createScaledTiers(TIERS_DEFINITION.PULLUP_CHIN_EASY)
  },
  'legs': {
    'Squats': createScaledTiers(TIERS_DEFINITION.LEG_SQUAT_EASY),
    'Lunges': createScaledTiers(TIERS_DEFINITION.LEG_LUNGE_EASY),
    'SideSquat': createScaledTiers(TIERS_DEFINITION.LEG_SIDESQUAT_EASY),
    'JumpSquats': createScaledTiers(TIERS_DEFINITION.LEG_JUMPSQUAT_EASY),
    'PistolSquat': createPistolSquatTiers(TIERS_DEFINITION.LEG_PISTOLSQUAT_EASY)
  },
  'abs': { 'Planks': createScaledTiers(TIERS_DEFINITION.ABS_PLANK_EASY, 's') },
  'kicks': {
    // Basic kicks (Beginner-Insane)
    'Roundhouse': createScaledTiers(TIERS_DEFINITION.KICK_ROUNDHOUSE_EASY),
    'Front': createScaledTiers(TIERS_DEFINITION.KICK_FRONT_EASY),
    'Groin': createScaledTiers(TIERS_DEFINITION.KICK_GROIN_EASY),
    'Side': createScaledTiers(TIERS_DEFINITION.KICK_SIDE_EASY),
    'Mikkazuk': createScaledTiers(TIERS_DEFINITION.KICK_MIKKAZUK_EASY),
    'DoubleRound': createScaledTiers(TIERS_DEFINITION.KICK_DOUBLEROUND_EASY),

    // Intermediate kicks (Medium-Insane)
    'UchiRoundhouse': createIntermediateKickTiers(TIERS_DEFINITION.KICK_UCHIROUNDHOUSE_MEDIUM),
    'BackSide': createIntermediateKickTiers(TIERS_DEFINITION.KICK_BACKSIDE_MEDIUM),
    'Hook': createIntermediateKickTiers(TIERS_DEFINITION.KICK_HOOK_MEDIUM),
    'BackHook': createIntermediateKickTiers(TIERS_DEFINITION.KICK_BACKHOOK_MEDIUM),
    'Axe': createIntermediateKickTiers(TIERS_DEFINITION.KICK_AXE_MEDIUM),

    // Advanced kicks (Hard-Insane)
    '720Hook': create720HookTiers(TIERS_DEFINITION.KICK_720HOOK_HARD),
    '360Round': createAdvancedKickTiers(TIERS_DEFINITION.KICK_360ROUND_HARD),
  },
};

const TIERS = {};
for (const section in INITIAL_STATE) {
  if (section === 'weeklyChallenge' || section === 'specialAbilities') continue;
  TIERS[section] = TIERS[section] || {};
  for (const variation in INITIAL_STATE[section]) {
    const tierDefinition = BASE_TIERS[section]?.[variation] || DEFAULT_TIERS;
    TIERS[section][variation] = tierDefinition;
  }
}
const CHALLENGE_POOL = [
  // Original Challenges
  { name: "Standard Pushup Beast", type: 'pushups', variation: 'Standard', goal: 300, progressType: 'total', desc: "Do 300 Standard Pushups this week." },
  { name: "Diamond Crusher", type: 'pushups', variation: 'Diamond', goal: 150, progressType: 'total', desc: "Do 150 Diamond Pushups this week." },
  { name: "Side Squat Master", type: 'legs', variation: 'SideSquat', goal: 100, progressType: 'total', desc: "Do 100 Side Squats this week." },
  { name: "Plank Titan", type: 'abs', variation: 'Planks', goal: 600, progressType: 'total', desc: "Hold Planks for 600s this week." },
  { name: "Roundhouse Barrage", type: 'kicks', variation: 'Roundhouse', goal: 200, progressType: 'total', desc: "Do 200 Roundhouse Kicks this week." },

  // --- NEW CHALLENGES START HERE ---
  // Pushup Challenges (more detailed)
  { name: "Standard Pushup Novice", type: 'pushups', variation: 'Standard', goal: 100, progressType: 'total', desc: "Achieve 100 Standard Pushups this week." },
  { name: "Standard Pushup Cadet", type: 'pushups', variation: 'Standard', goal: 200, progressType: 'total', desc: "Push your limits with 200 Standard Pushups." },
  { name: "Standard Pushup Soldier", type: 'pushups', variation: 'Standard', goal: 300, progressType: 'total', desc: "Master the basics with 300 Standard Pushups." },
  { name: "Standard Pushup Veteran", type: 'pushups', variation: 'Standard', goal: 400, progressType: 'total', desc: "Prove your endurance with 400 Standard Pushups." },
  { name: "Standard Pushup Elite", type: 'pushups', variation: 'Standard', goal: 500, progressType: 'total', desc: "Achieve elite status with 500 Standard Pushups." },

  { name: "Diamond Pushup Initiate", type: 'pushups', variation: 'Diamond', goal: 50, progressType: 'total', desc: "Start strong with 50 Diamond Pushups this week." },
  { name: "Diamond Pushup Master", type: 'pushups', variation: 'Diamond', goal: 100, progressType: 'total', desc: "Master the Diamond Pushup with 100 reps." },
  { name: "Wide Pushup Opener", type: 'pushups', variation: 'Wide', goal: 150, progressType: 'total', desc: "Expand your chest with 150 Wide Pushups." },
  { name: "Wide Pushup Expander", type: 'pushups', variation: 'Wide', goal: 250, progressType: 'total', desc: "Widen your stance for 250 Wide Pushups." },
  { name: "Incline Pushup Ascent", type: 'pushups', variation: 'Incline', goal: 150, progressType: 'total', desc: "Build upper chest with 150 Incline Pushups." },
  { name: "Incline Pushup Apex", type: 'pushups', variation: 'Incline', goal: 250, progressType: 'total', desc: "Reach the apex with 250 Incline Pushups." },
  { name: "Pike Pushup Spear", type: 'pushups', variation: 'Pike', goal: 75, progressType: 'total', desc: "Sharpen your shoulders with 75 Pike Pushups." },
  { name: "Pike Pushup Javelin", type: 'pushups', variation: 'Pike', goal: 125, progressType: 'total', desc: "Throw the javelin with 125 Pike Pushups." },
  { name: "Knee Pushup Foundation", type: 'pushups', variation: 'Knee', goal: 200, progressType: 'total', desc: "Lay the foundation with 200 Knee Pushups." },
  { name: "Knee Pushup Builder", type: 'pushups', variation: 'Knee', goal: 350, progressType: 'total', desc: "Build strength with 350 Knee Pushups." },

  // Pullup Challenges
  { name: "Standard Pullup Gripper", type: 'pullups', variation: 'Standard', goal: 20, progressType: 'total', desc: "Grip and pull for 20 Standard Pullups." },
  { name: "Standard Pullup Ascender", type: 'pullups', variation: 'Standard', goal: 40, progressType: 'total', desc: "Ascend to 40 Standard Pullups." },
  { name: "Standard Pullup High-Flyer", type: 'pullups', variation: 'Standard', goal: 60, progressType: 'total', desc: "Become a high-flyer with 60 Standard Pullups." },
  { name: "Chinup Initiate", type: 'pullups', variation: 'Chin', goal: 30, progressType: 'total', desc: "Initiate your chinup journey with 30 reps." },
  { name: "Chinup Challenger", type: 'pullups', variation: 'Chin', goal: 50, progressType: 'total', desc: "Challenge yourself to 50 Chinups." },
  { name: "Chinup Overlord", type: 'pullups', variation: 'Chin', goal: 80, progressType: 'total', desc: "Become the chinup overlord with 80 reps." },

  // Leg Challenges
  { name: "Squat Beginner", type: 'legs', variation: 'Squats', goal: 100, progressType: 'total', desc: "Start with 100 Squats this week." },
  { name: "Squat Machine", type: 'legs', variation: 'Squats', goal: 250, progressType: 'total', desc: "Become a squat machine with 250 reps." },
  { name: "Squat Beast", type: 'legs', variation: 'Squats', goal: 500, progressType: 'total', desc: "Unleash the beast with 500 Squats." },
  { name: "Lunge Strider", type: 'legs', variation: 'Lunges', goal: 80, progressType: 'total', desc: "Stride for 80 Lunges." },
  { name: "Lunge Marathoner", type: 'legs', variation: 'Lunges', goal: 150, progressType: 'total', desc: "Conquer 150 Lunges." },
  { name: "Side Squat Weaver", type: 'legs', variation: 'SideSquat', goal: 70, progressType: 'total', desc: "Weave your way to 70 Side Squats." },
  { name: "Side Squat Glider", type: 'legs', variation: 'SideSquat', goal: 120, progressType: 'total', desc: "Glide through 120 Side Squats." },
  { name: "Jump Squat Leaper", type: 'legs', variation: 'JumpSquats', goal: 60, progressType: 'total', desc: "Leap to new heights with 60 Jump Squats." },
  { name: "Jump Squat Blaster", type: 'legs', variation: 'JumpSquats', goal: 100, progressType: 'total', desc: "Blast off with 100 Jump Squats." },
  { name: "Pistol Squat Initiate", type: 'legs', variation: 'PistolSquat', goal: 20, progressType: 'total', desc: "Master single-leg strength with 20 Pistol Squats." },
  { name: "Pistol Squat Balancer", type: 'legs', variation: 'PistolSquat', goal: 40, progressType: 'total', desc: "Perfect your balance with 40 Pistol Squats." },
  { name: "Pistol Squat Elite", type: 'legs', variation: 'PistolSquat', goal: 60, progressType: 'total', desc: "Achieve elite status with 60 Pistol Squats." },

  // Abs Challenges
  { name: "Plank Holder 1min", type: 'abs', variation: 'Planks', goal: 60, progressType: 'total', desc: "Hold a plank for 60 seconds this week." }, // 60 seconds
  { name: "Plank Holder 3min", type: 'abs', variation: 'Planks', goal: 180, progressType: 'total', desc: "Hold a plank for 180 seconds this week." },
  { name: "Plank Holder 5min", type: 'abs', variation: 'Planks', goal: 300, progressType: 'total', desc: "Achieve 300 seconds of plank time this week." },
  { name: "Leg Raise Initiator", type: 'abs', variation: 'LegRaises', goal: 80, progressType: 'total', desc: "Initiate your core with 80 Leg Raises." },
  { name: "Leg Raise Core Blaster", type: 'abs', variation: 'LegRaises', goal: 150, progressType: 'total', desc: "Blast your core with 150 Leg Raises." },
  { name: "Russian Twist Spinner", type: 'abs', variation: 'RussianTwists', goal: 150, progressType: 'total', desc: "Spin your way to 150 Russian Twists." },
  { name: "Russian Twist Tornado", type: 'abs', variation: 'RussianTwists', goal: 250, progressType: 'total', desc: "Unleash a tornado of 250 Russian Twists." },
  { name: "Hanging Leg Raise Grasp", type: 'abs', variation: 'HangingLegRaise', goal: 40, progressType: 'total', desc: "Grasp new core strength with 40 Hanging Leg Raises." },
  { name: "Hanging Leg Raise Ascension", type: 'abs', variation: 'HangingLegRaise', goal: 70, progressType: 'total', desc: "Ascend to 70 Hanging Leg Raises." },
  { name: "Ab Roller Glide", type: 'abs', variation: 'AbRoller', goal: 50, progressType: 'total', desc: "Glide to a strong core with 50 Ab Roller reps." },
  { name: "Ab Roller Shredder", type: 'abs', variation: 'AbRoller', goal: 100, progressType: 'total', desc: "Shred your abs with 100 Ab Roller reps." },

  // Kick Challenges
  { name: "Groin Kick Starter", type: 'kicks', variation: 'Groin', goal: 50, progressType: 'total', desc: "Start your kick journey with 50 Groin Kicks." },
  { name: "Groin Kick Impact", type: 'kicks', variation: 'Groin', goal: 100, progressType: 'total', desc: "Deliver impact with 100 Groin Kicks." },
  { name: "Front Kick Thrust", type: 'kicks', variation: 'Front', goal: 70, progressType: 'total', desc: "Thrust forward with 70 Front Kicks." },
  { name: "Front Kick Power", type: 'kicks', variation: 'Front', goal: 130, progressType: 'total', desc: "Generate power with 130 Front Kicks." },
  { name: "Roundhouse Cyclone", type: 'kicks', variation: 'Roundhouse', goal: 100, progressType: 'total', desc: "Unleash a cyclone of 100 Roundhouse Kicks." },
  { name: "Roundhouse Storm", type: 'kicks', variation: 'Roundhouse', goal: 180, progressType: 'total', desc: "Rage with a storm of 180 Roundhouse Kicks." },
  { name: "Uchi Roundhouse Sweep", type: 'kicks', variation: 'UchiRoundhouse', goal: 40, progressType: 'total', desc: "Sweep the competition with 40 Uchi Roundhouse Kicks." },
  { name: "Uchi Roundhouse Vortex", type: 'kicks', variation: 'UchiRoundhouse', goal: 80, progressType: 'total', desc: "Create a vortex with 80 Uchi Roundhouse Kicks." },
  { name: "Side Kick Impaler", type: 'kicks', variation: 'Side', goal: 60, progressType: 'total', desc: "Impaler your targets with 60 Side Kicks." },
  { name: "Side Kick Breaker", type: 'kicks', variation: 'Side', goal: 110, progressType: 'total', desc: "Break through with 110 Side Kicks." },
  { name: "Back Side Kick Spinner", type: 'kicks', variation: 'BackSide', goal: 30, progressType: 'total', desc: "Spin for 30 Back Side Kicks." },
  { name: "Back Side Kick Twister", type: 'kicks', variation: 'BackSide', goal: 60, progressType: 'total', desc: "Twist and kick for 60 Back Side Kicks." },
  { name: "Hook Kick Reacher", type: 'kicks', variation: 'Hook', goal: 25, progressType: 'total', desc: "Reach out with 25 Hook Kicks." },
  { name: "Hook Kick Snapper", type: 'kicks', variation: 'Hook', goal: 50, progressType: 'total', desc: "Snap your way to 50 Hook Kicks." },
  { name: "Back Hook Kick Reverse", type: 'kicks', variation: 'BackHook', goal: 20, progressType: 'total', desc: "Reverse your technique with 20 Back Hook Kicks." },
  { name: "Back Hook Kick Blender", type: 'kicks', variation: 'BackHook', goal: 40, progressType: 'total', desc: "Blend with 40 Back Hook Kicks." },
  { name: "Axe Kick Chopper", type: 'kicks', variation: 'Axe', goal: 30, progressType: 'total', desc: "Chop down with 30 Axe Kicks." },
  { name: "Axe Kick Cleaver", type: 'kicks', variation: 'Axe', goal: 60, progressType: 'total', desc: "Cleave through with 60 Axe Kicks." },
  { name: "Mikkazuk Kick Crescent", type: 'kicks', variation: 'Mikkazuk', goal: 50, progressType: 'total', desc: "Form a crescent with 50 Mikkazuk Kicks." },
  { name: "Mikkazuk Kick Lunar", type: 'kicks', variation: 'Mikkazuk', goal: 90, progressType: 'total', desc: "Unleash a lunar strike with 90 Mikkazuk Kicks." },
  { name: "360 Round Spin", type: 'kicks', variation: '360Round', goal: 15, progressType: 'total', desc: "Spin for 15 360 Round Kicks." },
  { name: "360 Round Vortex", type: 'kicks', variation: '360Round', goal: 30, progressType: 'total', desc: "Create a vortex with 30 360 Round Kicks." },
  { name: "720 Hook Whirlwind", type: 'kicks', variation: '720Hook', goal: 10, progressType: 'total', desc: "Unleash a whirlwind with 10 720 Hook Kicks." },
  { name: "720 Hook Tornado", type: 'kicks', variation: '720Hook', goal: 20, progressType: 'total', desc: "Become a tornado with 20 720 Hook Kicks." },
  { name: "Double Round Flurry", type: 'kicks', variation: 'DoubleRound', goal: 40, progressType: 'total', desc: "Execute a flurry of 40 Double Round Kicks." },
  { name: "Double Round Barrage", type: 'kicks', variation: 'DoubleRound', goal: 70, progressType: 'total', desc: "Unleash a barrage of 70 Double Round Kicks." },

  // Additional General Challenges to ensure 100+ total
  { name: "Full Body Burn I", type: 'pushups', variation: 'Standard', goal: 150, progressType: 'total', desc: "Complete 150 Standard Pushups." },
  { name: "Full Body Burn II", type: 'pullups', variation: 'Standard', goal: 25, progressType: 'total', desc: "Complete 25 Standard Pullups." },
  { name: "Full Body Burn III", type: 'legs', variation: 'Squats', goal: 200, progressType: 'total', desc: "Complete 200 Squats." },
  { name: "Core Crusher I", type: 'abs', variation: 'Planks', goal: 120, progressType: 'total', desc: "Hold planks for 120 seconds." },
  { name: "Core Crusher II", type: 'abs', variation: 'LegRaises', goal: 100, progressType: 'total', desc: "Complete 100 Leg Raises." },
  { name: "Kickboxing Blitz I", type: 'kicks', variation: 'Roundhouse', goal: 120, progressType: 'total', desc: "Perform 120 Roundhouse Kicks." },
  { name: "Kickboxing Blitz II", type: 'kicks', variation: 'Front', goal: 90, progressType: 'total', desc: "Perform 90 Front Kicks." },
  { name: "Triceps Terminator", type: 'pushups', variation: 'Diamond', goal: 120, progressType: 'total', desc: "Terminate your triceps with 120 Diamond Pushups." },
  { name: "Chest Widener", type: 'pushups', variation: 'Wide', goal: 220, progressType: 'total', desc: "Widen your chest with 220 Wide Pushups." },
  { name: "Lower Chest Blast", type: 'pushups', variation: 'Incline', goal: 200, progressType: 'total', desc: "Blast your lower chest with 200 Incline Pushups." },
  { name: "Shoulder Sculptor", type: 'pushups', variation: 'Pike', goal: 100, progressType: 'total', desc: "Sculpt your shoulders with 100 Pike Pushups." },
  { name: "Beginner's Push", type: 'pushups', variation: 'Knee', goal: 400, progressType: 'total', desc: "Perfect your form with 400 Knee Pushups." },

  { name: "Back Strength I", type: 'pullups', variation: 'Standard', goal: 35, progressType: 'total', desc: "Build your back strength with 35 Standard Pullups." },
  { name: "Back Strength II", type: 'pullups', variation: 'Chin', goal: 65, progressType: 'total', desc: "Enhance your back strength with 65 Chinups." },

  { name: "Leg Endurance I", type: 'legs', variation: 'Squats', goal: 350, progressType: 'total', desc: "Test leg endurance with 350 Squats." },
  { name: "Leg Endurance II", type: 'legs', variation: 'Lunges', goal: 100, progressType: 'total', desc: "Boost leg endurance with 100 Lunges." },
  { name: "Leg Agility I", type: 'legs', variation: 'SideSquat', goal: 90, progressType: 'total', desc: "Improve leg agility with 90 Side Squats." },
  { name: "Leg Agility II", type: 'legs', variation: 'JumpSquats', goal: 80, progressType: 'total', desc: "Increase leg agility with 80 Jump Squats." },

  { name: "Abdominal Fortitude I", type: 'abs', variation: 'Planks', goal: 240, progressType: 'total', desc: "Build fortitude with 240 seconds of plank." },
  { name: "Abdominal Fortitude II", type: 'abs', variation: 'LegRaises', goal: 120, progressType: 'total', desc: "Strengthen your abs with 120 Leg Raises." },
  { name: "Oblique Shredder I", type: 'abs', variation: 'RussianTwists', goal: 200, progressType: 'total', desc: "Shred obliques with 200 Russian Twists." },
  { name: "Oblique Shredder II", type: 'abs', variation: 'HangingLegRaise', goal: 55, progressType: 'total', desc: "Target obliques with 55 Hanging Leg Raises." },
  { name: "Core Compressor", type: 'abs', variation: 'AbRoller', goal: 75, progressType: 'total', desc: "Compress your core with 75 Ab Roller reps." },

  { name: "Precision Kicks I", type: 'kicks', variation: 'Groin', goal: 75, progressType: 'total', desc: "Enhance precision with 75 Groin Kicks." },
  { name: "Precision Kicks II", type: 'kicks', variation: 'Front', goal: 100, progressType: 'total', desc: "Refine precision with 100 Front Kicks." },
  { name: "Rotation Power I", type: 'kicks', variation: 'Roundhouse', goal: 150, progressType: 'total', desc: "Develop rotational power with 150 Roundhouse Kicks." },
  { name: "Rotation Power II", type: 'kicks', variation: 'UchiRoundhouse', goal: 60, progressType: 'total', desc: "Boost rotational power with 60 Uchi Roundhouse Kicks." },
  { name: "Lateral Agility Kicks I", type: 'kicks', variation: 'Side', goal: 90, progressType: 'total', desc: "Improve lateral agility with 90 Side Kicks." },
  { name: "Lateral Agility Kicks II", type: 'kicks', variation: 'BackSide', goal: 45, progressType: 'total', desc: "Master lateral agility with 45 Back Side Kicks." },
  { name: "Hooking Technique I", type: 'kicks', variation: 'Hook', goal: 40, progressType: 'total', desc: "Practice hooking technique with 40 Hook Kicks." },
  { name: "Hooking Technique II", type: 'kicks', variation: 'BackHook', goal: 30, progressType: 'total', desc: "Refine hooking technique with 30 Back Hook Kicks." },
  { name: "Downward Strike Mastery", type: 'kicks', variation: 'Axe', goal: 45, progressType: 'total', desc: "Master downward strikes with 45 Axe Kicks." },
  { name: "Crescent Flow", type: 'kicks', variation: 'Mikkazuk', goal: 70, progressType: 'total', desc: "Achieve crescent flow with 70 Mikkazuk Kicks." },
  { name: "Spinning Mastery I", type: 'kicks', variation: '360Round', goal: 20, progressType: 'total', desc: "Begin spinning mastery with 20 360 Round Kicks." },
  { name: "Spinning Mastery II", type: 'kicks', variation: '720Hook', goal: 15, progressType: 'total', desc: "Advance spinning mastery with 15 720 Hook Kicks." },
  { name: "Double Strike Power", type: 'kicks', variation: 'DoubleRound', goal: 55, progressType: 'total', desc: "Develop double strike power with 55 Double Round Kicks." },

  // Even More Challenges to reach 100+
  { name: "Pushup Gauntlet", type: 'pushups', variation: 'Standard', goal: 600, progressType: 'total', desc: "Conquer the Pushup Gauntlet with 600 reps." },
  { name: "Diamond Decimator", type: 'pushups', variation: 'Diamond', goal: 150, progressType: 'total', desc: "Decimate your triceps with 150 Diamond Pushups." },
  { name: "Wide Chest Builder Advanced", type: 'pushups', variation: 'Wide', goal: 300, progressType: 'total', desc: "Build a formidable chest with 300 Wide Pushups." },
  { name: "Incline Peak Performance", type: 'pushups', variation: 'Incline', goal: 300, progressType: 'total', desc: "Achieve peak performance with 300 Incline Pushups." },
  { name: "Pike Press Pro", type: 'pushups', variation: 'Pike', goal: 175, progressType: 'total', desc: "Become a Pike Press Pro with 175 reps." },
  { name: "Knee Pushup Grandmaster", type: 'pushups', variation: 'Knee', goal: 500, progressType: 'total', desc: "Become a grandmaster with 500 Knee Pushups." },

  { name: "Pullup Endurance Test", type: 'pullups', variation: 'Standard', goal: 70, progressType: 'total', desc: "Test your pullup endurance with 70 reps." },
  { name: "Chinup Dominator", type: 'pullups', variation: 'Chin', goal: 90, progressType: 'total', desc: "Dominate the chinup bar with 90 reps." },
  { name: "Squat Overlord", type: 'legs', variation: 'Squats', goal: 700, progressType: 'total', desc: "Become the squat overlord with 700 reps." },
  { name: "Lunge Conqueror", type: 'legs', variation: 'Lunges', goal: 200, progressType: 'total', desc: "Conquer all lunges with 200 reps." },
  { name: "Side Squat Wizard", type: 'legs', variation: 'SideSquat', goal: 150, progressType: 'total', desc: "Perform side squat magic with 150 reps." },
  { name: "Jump Squat Destroyer", type: 'legs', variation: 'JumpSquats', goal: 120, progressType: 'total', desc: "Destroy your limits with 120 Jump Squats." },
  { name: "Plank Infinity", type: 'abs', variation: 'Planks', goal: 420, progressType: 'total', desc: "Hold a plank for eternity (420 seconds)." },
  { name: "Leg Raise Virtuoso", type: 'abs', variation: 'LegRaises', goal: 180, progressType: 'total', desc: "Become a virtuoso of 180 Leg Raises." },
  { name: "Russian Twist Hurricane", type: 'abs', variation: 'RussianTwists', goal: 350, progressType: 'total', desc: "Unleash a hurricane of 350 Russian Twists." },
  { name: "Hanging Leg Raise Grandmaster", type: 'abs', variation: 'HangingLegRaise', goal: 85, progressType: 'total', desc: "Achieve grandmaster status with 85 Hanging Leg Raises." },
  { name: "Ab Roller Annihilator", type: 'abs', variation: 'AbRoller', goal: 120, progressType: 'total', desc: "Annihilate your abs with 120 Ab Roller reps." },

  { name: "Groin Kick Assassin", type: 'kicks', variation: 'Groin', goal: 130, progressType: 'total', desc: "Become a groin kick assassin with 130 reps." },
  { name: "Front Kick Precisionist", type: 'kicks', variation: 'Front', goal: 160, progressType: 'total', desc: "Achieve precision with 160 Front Kicks." },
  { name: "Roundhouse Tornado", type: 'kicks', variation: 'Roundhouse', goal: 220, progressType: 'total', desc: "Unleash a roundhouse tornado with 220 kicks." },
  { name: "Uchi Roundhouse Whirlwind", type: 'kicks', variation: 'UchiRoundhouse', goal: 100, progressType: 'total', desc: "Create a whirlwind with 100 Uchi Roundhouse Kicks." },
  { name: "Side Kick Destroyer", type: 'kicks', variation: 'Side', goal: 140, progressType: 'total', desc: "Destroy opponents with 140 Side Kicks." },
  { name: "Back Side Kick Phantom", type: 'kicks', variation: 'BackSide', goal: 75, progressType: 'total', desc: "Become a phantom with 75 Back Side Kicks." },
  { name: "Hook Kick Shadow", type: 'kicks', variation: 'Hook', goal: 65, progressType: 'total', desc: "Move like a shadow with 65 Hook Kicks." },
  { name: "Back Hook Kick Reaper", type: 'kicks', variation: 'BackHook', goal: 55, progressType: 'total', desc: "Reap souls with 55 Back Hook Kicks." },
  { name: "Axe Kick Executioner", type: 'kicks', variation: 'Axe', goal: 80, progressType: 'total', desc: "Become an executioner with 80 Axe Kicks." },
  { name: "Mikkazuk Kick Eclipse", type: 'kicks', variation: 'Mikkazuk', goal: 110, progressType: 'total', desc: "Cause an eclipse with 110 Mikkazuk Kicks." },
  { name: "360 Round Cyclone", type: 'kicks', variation: '360Round', goal: 40, progressType: 'total', desc: "Spin like a cyclone with 40 360 Round Kicks." },
  { name: "720 Hook Nova", type: 'kicks', variation: '720Hook', goal: 25, progressType: 'total', desc: "Unleash a nova with 25 720 Hook Kicks." },
  { name: "Double Round Cataclysm", type: 'kicks', variation: 'DoubleRound', goal: 85, progressType: 'total', desc: "Create a cataclysm with 85 Double Round Kicks." }
];

const RANKS = [
  { name: "The Dormant Flame", req: 100, xpReq: 0, bodyStatReq: 20 },
  { name: "The Resolute Initiate", req: 500, xpReq: 500, bodyStatReq: 30 },
  { name: "The Steel Sentinel", req: 1000, xpReq: 1500, bodyStatReq: 40 },
  { name: "The Ironclad Guardian", req: 2000, xpReq: 3000, bodyStatReq: 50 },
  { name: "The Rising Tempest", req: 3500, xpReq: 5500, bodyStatReq: 60 },
  { name: "The Silent Reaper", req: 5500, xpReq: 9000, bodyStatReq: 70 },
  { name: "The Crimson Phantom", req: 8000, xpReq: 14000, bodyStatReq: 80 },
  { name: "Harbinger of Death", req: 12000, xpReq: 25000, bodyStatReq: 90 }
];

/* ---------- BODY STATS ANALYSIS SYSTEM ---------- */
const BODY_STATS_THRESHOLDS = {
  strength: { low: 50, medium: 150, high: 300, elite: 500 },
  endurance: { low: 100, medium: 300, high: 600, elite: 1000 },
  explosive: { low: 30, medium: 80, high: 150, elite: 250 },
  control: { variations: 3, balanced: 5, mastery: 8 },
  recovery: { weeklyMin: 200, weeklyGood: 500, weeklyElite: 1000 },
  mental: { consistency: 7, dedication: 14, resilience: 30 }
};

function calculateBodyStats() {
  // Calculate using rule-based system only
  return calculateBodyStatsRuleBased();
}

function calculateBodyStatsRuleBased() {
  const stats = {
    rawStrength: 0,
    muscularEndurance: 0,
    explosivePower: 0,
    muscularControl: 0,
    recoveryManagement: 0,
    mentalResilience: 0,
    agility: 0,
    speed: 0,
    attackPotency: 0
  };

  // Gather all exercise data
  const allExercises = [];
  ['pushups', 'pullups', 'legs', 'abs', 'kicks'].forEach(section => {
    // Add null check to prevent "Cannot read properties of null" error
    if (logData && logData[section]) {
      Object.entries(logData[section]).forEach(([variation, data]) => {
        allExercises.push({
          section,
          variation,
          total: data.total || 0,
          max: data.max || 0
        });
      });
    }
  });

  // Calculate Raw Strength (based on max reps and heavy compound movements)
  let strengthScore = 0;
  const strengthWeights = {
    pullups: 3.0,  // Hardest
    pushups: 1.5,
    legs: 1.2,
    abs: 1.0,
    kicks: 0.8
  };

  allExercises.forEach(ex => {
    const weight = strengthWeights[ex.section] || 1;
    const maxContribution = Math.min(ex.max * weight, 100);
    const totalContribution = Math.min((ex.total / 100) * weight, 50);
    strengthScore += maxContribution + totalContribution;
  });

  // Check for balanced development
  const sectionsWithWork = allExercises.filter(ex => ex.total > 50).length;
  const balanceBonus = Math.min(sectionsWithWork * 5, 30);
  strengthScore += balanceBonus;

  stats.rawStrength = Math.min(Math.round(strengthScore / 10), 100);

  // Calculate Muscular Endurance (total volume and sustained performance)
  let enduranceScore = 0;
  const grandTotal = calculateGrandTotalReps();

  // Base endurance from total volume
  enduranceScore += Math.min(grandTotal / 50, 60);

  // Check for high-rep variations
  const highRepVariations = allExercises.filter(ex => ex.total > 200).length;
  enduranceScore += highRepVariations * 5;

  // Endurance penalty if too focused on max without volume
  allExercises.forEach(ex => {
    if (ex.max > 0 && ex.total > 0) {
      const ratio = ex.total / ex.max;
      if (ratio > 50) { // High volume relative to max = good endurance
        enduranceScore += 2;
      }
    }
  });

  stats.muscularEndurance = Math.min(Math.round(enduranceScore), 100);

  // Calculate Explosive Power (based on max reps in explosive movements)
  let explosiveScore = 0;

  // Explosive exercises
  const explosiveExercises = {
    'pullups': ['Standard', 'Chin'],
    'legs': ['JumpSquats'],
    'kicks': ['720Hook', '360Round', 'DoubleRound', 'BackHook', 'Hook']
  };

  Object.entries(explosiveExercises).forEach(([section, variations]) => {
    variations.forEach(v => {
      const ex = allExercises.find(e => e.section === section && e.variation === v);
      if (ex) {
        explosiveScore += Math.min(ex.max * 2, 30);
        explosiveScore += Math.min(ex.total / 20, 15);
      }
    });
  });

  // Bonus for high max reps across all exercises
  const highMaxCount = allExercises.filter(ex => ex.max > 20).length;
  explosiveScore += highMaxCount * 3;

  stats.explosivePower = Math.min(Math.round(explosiveScore), 100);

  // Calculate Muscular Control (variation diversity and balanced development)
  let controlScore = 0;

  // Count active variations (with meaningful work)
  const activeVariations = allExercises.filter(ex => ex.total > 30).length;
  controlScore += Math.min(activeVariations * 4, 40);

  // Balance across sections
  const sectionTotals = {};
  ['pushups', 'pullups', 'legs', 'abs', 'kicks'].forEach(section => {
    // Add null check to prevent "Cannot read properties of null" error
    if (logData && logData[section]) {
      sectionTotals[section] = allExercises
        .filter(ex => ex.section === section)
        .reduce((sum, ex) => sum + ex.total, 0);
    } else {
      sectionTotals[section] = 0;
    }
  });

  const sectionValues = Object.values(sectionTotals).filter(v => v > 0);
  if (sectionValues.length > 0) {
    const avg = sectionValues.reduce((a, b) => a + b, 0) / sectionValues.length;
    const variance = sectionValues.reduce((sum, val) => sum + Math.abs(val - avg), 0) / sectionValues.length;
    const balanceScore = Math.max(0, 30 - (variance / 50)); // Lower variance = better balance
    controlScore += balanceScore;
  }

  // Advanced exercise mastery
  const advancedExercises = {
    'pushups': ['Pike', 'Diamond'],
    'abs': ['HangingLegRaise', 'AbRoller'],
    'kicks': ['720Hook', '360Round', 'BackHook']
  };

  let advancedCount = 0;
  Object.entries(advancedExercises).forEach(([section, variations]) => {
    variations.forEach(v => {
      const ex = allExercises.find(e => e.section === section && e.variation === v);
      if (ex && ex.total > 20) advancedCount++;
    });
  });
  controlScore += advancedCount * 5;
  // Penalty for unilateral exercise imbalance (kicks and pistol squats)
  let unilateralImbalancePenalty = 0;
  // Check all kicks for balance
  // Add null check to prevent "Cannot read properties of null" error
  if (logData && logData.kicks) {
    Object.keys(logData.kicks).forEach(kickName => {
      const balanceStatus = getBalanceStatus('kicks', kickName);
      const kickData = logData.kicks[kickName];
      const combined = (kickData.totalLeft || 0) + (kickData.totalRight || 0);

      if (combined > 30) {
        if (balanceStatus.imbalancePercent > 25) {
          unilateralImbalancePenalty += 8; // Severe imbalance
        } else if (balanceStatus.imbalancePercent > 15) {
          unilateralImbalancePenalty += 4; // Moderate imbalance
        }
      }
    });
  }

  // Check pistol squats for balance
  // Add null check to prevent "Cannot read properties of null" error
  if (logData && logData.legs && logData.legs.PistolSquat) {
    const pistolBalance = getBalanceStatus('legs', 'PistolSquat');
    const pistolData = logData.legs.PistolSquat;
    const pistolCombined = (pistolData.totalLeft || 0) + (pistolData.totalRight || 0);
    if (pistolCombined > 30) {
      if (pistolBalance.imbalancePercent > 25) {
        unilateralImbalancePenalty += 10; // Severe imbalance
      } else if (pistolBalance.imbalancePercent > 15) {
        unilateralImbalancePenalty += 5; // Moderate imbalance
      }
    }
  }

  controlScore -= unilateralImbalancePenalty;

  stats.muscularControl = Math.min(Math.round(Math.max(0, controlScore)), 100);

  // Calculate Recovery Management (consistency and volume distribution)
  let recoveryScore = 50; // Base score

  // Weekly volume (estimate based on total reps)
  const estimatedWeeklyVolume = grandTotal / Math.max(1, Math.floor(grandTotal / 300));

  if (estimatedWeeklyVolume > BODY_STATS_THRESHOLDS.recovery.weeklyElite) {
    recoveryScore += 30;
  } else if (estimatedWeeklyVolume > BODY_STATS_THRESHOLDS.recovery.weeklyGood) {
    recoveryScore += 20;
  } else if (estimatedWeeklyVolume > BODY_STATS_THRESHOLDS.recovery.weeklyMin) {
    recoveryScore += 10;
  }

  // Balanced load across muscle groups = good recovery
  const sectionsWithGoodVolume = Object.values(sectionTotals).filter(v => v > 50).length;
  recoveryScore += Math.min(sectionsWithGoodVolume * 4, 20);

  stats.recoveryManagement = Math.min(Math.round(recoveryScore), 100);

  // Calculate Mental Resilience (total volume, challenges completed, consistency)
  let mentalScore = 0;

  // Base score from total volume (shows dedication)
  mentalScore += Math.min(grandTotal / 100, 40);

  // Advancements completed (shows perseverance)
  const advancementsCompleted = Object.keys(completedDifficulties).length;
  mentalScore += Math.min(advancementsCompleted * 2, 30);

  // Weekly challenge completion - Add null check to prevent "Cannot read properties of null" error
  if (logData && logData.weeklyChallenge && logData.weeklyChallenge.isComplete) {
    mentalScore += 10;
  }

  // High max reps show mental fortitude
  const veryHighMax = allExercises.filter(ex => ex.max > 30).length;
  mentalScore += Math.min(veryHighMax * 3, 20);

  stats.mentalResilience = Math.min(Math.round(mentalScore), 100);

  // Calculate Agility (movement variety, kicks, dynamic exercises)
  let agilityScore = 0;

  // Kick variety and volume (kicks require coordination and quick direction changes)
  const kickExercises = allExercises.filter(ex => ex.section === 'kicks');
  const kickVariety = kickExercises.length;
  const totalKicks = kickExercises.reduce((sum, ex) => sum + ex.total, 0);

  agilityScore += Math.min(kickVariety * 8, 30); // Variety bonus
  agilityScore += Math.min(totalKicks / 50, 25); // Volume bonus

  // Dynamic pushup variations (explosive movements)
  const dynamicPushups = ['Explosive', 'Clap', 'Superman'];
  dynamicPushups.forEach(v => {
    const ex = allExercises.find(e => e.section === 'pushups' && e.variation === v);
    if (ex && ex.total > 20) agilityScore += 10;
  });

  // Leg exercise variety (squats, lunges show mobility)
  const legVariety = allExercises.filter(ex => ex.section === 'legs').length;
  agilityScore += Math.min(legVariety * 5, 20);

  // Overall exercise balance (agility requires full-body coordination)
  const activeSections = Object.values(sectionTotals).filter(v => v > 30).length;
  agilityScore += activeSections * 5;

  stats.agility = Math.min(Math.round(agilityScore), 100);

  // Calculate Speed (explosive exercises, max reps, dynamic movements)
  let speedScore = 0;
  // High max reps in explosive exercises (speed-strength)
  const explosiveMax = Math.max(
    (logData && logData.pushups && logData.pushups.Explosive?.max) || 0,
    (logData && logData.pushups && logData.pushups.Clap?.max) || 0,
    (logData && logData.legs && logData.legs.JumpSquat?.max) || 0
  );
  speedScore += Math.min(explosiveMax * 2, 30);

  // Kick performance (speed-focused movements)
  const kickMax = Math.max(...kickExercises.map(ex => ex.max));
  speedScore += Math.min(kickMax * 1.5, 25);

  // High-rep sets indicate fast execution capability
  const highMaxSpeedCount = allExercises.filter(ex => ex.max > 40).length;
  speedScore += Math.min(highMaxSpeedCount * 5, 20);

  // Jump squat mastery (pure speed-power)
  const jumpSquats = (logData && logData.legs && logData.legs.JumpSquat?.total) || 0;
  speedScore += Math.min(jumpSquats / 30, 15);

  // Fast-twitch muscle development (total explosive work)
  const explosiveTotal = ((logData && logData.pushups && logData.pushups.Explosive?.total) || 0) +
    ((logData && logData.pushups && logData.pushups.Clap?.total) || 0) +
    ((logData && logData.legs && logData.legs.JumpSquat?.total) || 0);
  speedScore += Math.min(explosiveTotal / 50, 10);

  stats.speed = Math.min(Math.round(speedScore), 100);

  // Calculate Attack Potency (kick technique, accuracy, and balance)
  let attackPotencyScore = 0;

  const kickCategories = {
    basic: ['Groin', 'Front', 'Roundhouse', 'Side'],
    intermediate: ['UchiRoundhouse', 'BackSide', 'Hook', 'Axe', 'Mikkazuk'],
    advanced: ['BackHook', '360Round', '720Hook', 'DoubleRound']
  };

  // 1. Variety bonus (75 pts max)
  let varietyScore = 0;
  // Add null check for logData.kicks
  if (logData && logData.kicks) {
    Object.entries(kickCategories).forEach(([category, kickNames]) => {
      kickNames.forEach(kickName => {
        const kickData = logData.kicks[kickName];
        if (kickData && kickData.total > 0) {
          const balancedTotal = getBalancedTotal('kicks', kickName);
          if (balancedTotal > 20) {
            if (category === 'basic') varietyScore += 20;
            else if (category === 'intermediate') varietyScore += 30;
            else if (category === 'advanced') varietyScore += 25;
          }
        }
      });
    });
  }
  attackPotencyScore += Math.min(varietyScore, 75);

  // 2. Left/Right balance across all kicks (30 pts max, with penalties)
  let balanceScore = 0;
  let totalImbalancePenalty = 0;
  let kicksWithData = 0;

  // Add null check for logData.kicks
  if (logData && logData.kicks) {
    Object.keys(logData.kicks).forEach(kickName => {
      const kickData = logData.kicks[kickName];
      const leftTotal = kickData.totalLeft || 0;
      const rightTotal = kickData.totalRight || 0;
      const combined = leftTotal + rightTotal;

      if (combined > 30) {
        kicksWithData++;
        const balanceStatus = getBalanceStatus('kicks', kickName);
        const imbalancePercent = balanceStatus.imbalancePercent;

        if (imbalancePercent <= 5) {
          balanceScore += 3; // Perfect balance
        } else if (imbalancePercent <= 10) {
          balanceScore += 2; // Good balance
        } else if (imbalancePercent <= 20) {
          balanceScore += 1; // Acceptable
        }

        // Penalties for poor balance
        if (imbalancePercent > 25) {
          totalImbalancePenalty += 10; // Severe imbalance
        } else if (imbalancePercent > 15) {
          totalImbalancePenalty += 5; // Moderate imbalance
        }
      }
    });
  }
  attackPotencyScore += Math.min(balanceScore, 30);
  attackPotencyScore -= totalImbalancePenalty;
  // 3. Form consistency (10 pts max) - based on max/total ratio across kicks
  let consistencyScore = 0;
  let kicksWithMax = 0;

  // Add null check for logData.kicks
  if (logData && logData.kicks) {
    Object.keys(logData.kicks).forEach(kickName => {
      const kickData = logData.kicks[kickName];
      const maxLeft = kickData.maxLeft || 0;
      const maxRight = kickData.maxRight || 0;
      const totalLeft = kickData.totalLeft || 0;
      const totalRight = kickData.totalRight || 0;

      if (maxLeft > 0 && totalLeft > 0) {
        kicksWithMax++;
        const ratioLeft = totalLeft / maxLeft;
        if (ratioLeft >= 10 && ratioLeft <= 50) consistencyScore += 1;
      }
      if (maxRight > 0 && totalRight > 0) {
        kicksWithMax++;
        const ratioRight = totalRight / maxRight;
        if (ratioRight >= 10 && ratioRight <= 50) consistencyScore += 1;
      }
    });
  }
  attackPotencyScore += Math.min(consistencyScore, 10);

  // 4. Advanced technique mastery (15 pts max)
  let masteryScore = 0;
  const masteryKicks = {
    '720Hook': 5,
    '360Round': 4,
    'Hook': 3,
    'BackHook': 3
  };

  // Add null check for logData.kicks
  if (logData && logData.kicks) {
    Object.entries(masteryKicks).forEach(([kickName, points]) => {
      const kickData = logData.kicks[kickName];
      if (kickData) {
        const balancedTotal = getBalancedTotal('kicks', kickName);
        if (balancedTotal > 50) {
          masteryScore += points;
        }
      }
    });
  }

  attackPotencyScore += Math.min(masteryScore, 15);

  stats.attackPotency = Math.min(Math.max(Math.round(attackPotencyScore), 0), 100);

  return stats;
}
// AI-Enhanced Body Stats Calculation
function calculateBodyStatsWithAI(ruleBasedStats) {
  // For now, we'll enhance the rule-based stats with AI-like adjustments
  // In a full implementation, this would connect to an AI service

  // Create a copy of the rule-based stats to work with
  const aiStats = { ...ruleBasedStats };

  // Get exercise data for comprehensive analysis
  const allExercises = [];
  ['pushups', 'pullups', 'legs', 'abs', 'kicks'].forEach(section => {
    Object.entries(logData[section]).forEach(([variation, data]) => {
      allExercises.push({
        section,
        variation,
        total: data.total || 0,
        max: data.max || 0
      });
    });
  });

  // 1. Analyze max reps vs total reps ratio for intensity insight
  let intensityAdjustment = 0;
  const highIntensityExercises = allExercises.filter(ex => ex.max > 0 && ex.total > 0 && (ex.total / ex.max) < 20);
  const lowIntensityExercises = allExercises.filter(ex => ex.max > 0 && ex.total > 0 && (ex.total / ex.max) > 50);

  // High intensity (low total:max ratio) indicates strength focus
  // Low intensity (high total:max ratio) indicates endurance focus
  const intensityBalance = highIntensityExercises.length - lowIntensityExercises.length;
  intensityAdjustment = Math.max(-3, Math.min(3, intensityBalance * 0.5));

  // 2. Analyze progression patterns (recent vs past performance)
  let progressionAdjustment = 0;
  const totalReps = allExercises.reduce((sum, ex) => sum + ex.total, 0);
  const maxReps = Math.max(...allExercises.map(ex => ex.max));

  // Check if user is improving (higher max reps relative to total)
  if (totalReps > 0 && maxReps > 0) {
    const progressionRatio = maxReps / (totalReps / 20); // Normalize against typical volume
    progressionAdjustment = Math.max(-4, Math.min(4, (progressionRatio - 1) * 2));
  }

  // 3. Analyze consistency patterns
  const activeExercises = allExercises.filter(ex => ex.total > 10);
  const consistencyScore = Math.min(100, activeExercises.length * 2);

  // 4. Analyze balance across training categories
  const sectionTotals = {};
  ['pushups', 'pullups', 'legs', 'abs', 'kicks'].forEach(section => {
    sectionTotals[section] = allExercises
      .filter(ex => ex.section === section)
      .reduce((sum, ex) => sum + ex.total, 0);
  });

  const sectionValues = Object.values(sectionTotals).filter(v => v > 0);
  let balanceAdjustment = 0;
  if (sectionValues.length > 0) {
    const avg = sectionValues.reduce((a, b) => a + b, 0) / sectionValues.length;
    const variance = sectionValues.reduce((sum, val) => sum + Math.abs(val - avg), 0) / sectionValues.length;
    // Lower variance = better balance = positive adjustment
    balanceAdjustment = Math.max(-5, Math.min(5, 30 - (variance / 50)));
  }

  // 5. Analyze exercise variety
  const uniqueExercises = allExercises.length;
  const varietyScore = Math.min(10, uniqueExercises * 0.5);

  // 6. Analyze unilateral balance (for kicks and pistol squats)
  let unilateralBalanceAdjustment = 0;
  const kickExercises = allExercises.filter(ex => ex.section === 'kicks');
  if (kickExercises.length > 0) {
    let totalImbalance = 0;
    let kickCount = 0;

    kickExercises.forEach(ex => {
      const kickData = logData.kicks[ex.variation];
      if (kickData && kickData.totalLeft !== undefined && kickData.totalRight !== undefined) {
        const left = kickData.totalLeft || 0;
        const right = kickData.totalRight || 0;
        const combined = left + right;

        if (combined > 20) { // Only consider kicks with meaningful volume
          kickCount++;
          const imbalance = Math.abs(left - right) / combined;
          totalImbalance += imbalance;
        }
      }
    });

    if (kickCount > 0) {
      const avgImbalance = totalImbalance / kickCount;
      // Lower imbalance = better balance = positive adjustment
      unilateralBalanceAdjustment = Math.max(-4, Math.min(4, (0.3 - avgImbalance) * 10));
    }
  }

  // Apply AI-like adjustments based on multiple factors
  Object.keys(aiStats).forEach(stat => {
    // Base adjustment
    let adjustment = 0;

    // Apply different weights based on stat type
    switch (stat) {
      case 'rawStrength':
      case 'explosivePower':
        // These benefit more from intensity and max reps
        adjustment += intensityAdjustment * 1.5;
        adjustment += progressionAdjustment;
        break;
      case 'muscularEndurance':
        // This benefits more from volume
        adjustment += (100 - consistencyScore) / 10; // Inverse because high consistency helps endurance
        break;
      case 'muscularControl':
        // This benefits greatly from balance
        adjustment += balanceAdjustment * 1.2;
        adjustment += unilateralBalanceAdjustment * 1.5;
        break;
      case 'agility':
      case 'speed':
        // These benefit from variety and intensity
        adjustment += varietyScore;
        adjustment += intensityAdjustment;
        break;
      case 'recoveryManagement':
        // This benefits from balance and consistency
        adjustment += balanceAdjustment;
        adjustment += (consistencyScore / 20) - 2.5;
        break;
      case 'mentalResilience':
        // This benefits from consistency and progression
        adjustment += (consistencyScore / 15) - 3;
        adjustment += progressionAdjustment * 0.8;
        break;
      case 'attackPotency':
        // This benefits most from unilateral balance
        adjustment += unilateralBalanceAdjustment * 2;
        adjustment += varietyScore * 0.5;
        break;
      default:
        // Apply general adjustments
        adjustment += intensityAdjustment * 0.5;
        adjustment += balanceAdjustment * 0.5;
        adjustment += (consistencyScore / 25) - 2;
    }
    // Apply the adjustment
    aiStats[stat] = Math.min(100, Math.max(0, aiStats[stat] + adjustment));

    // Ensure values stay within bounds and are rounded
    aiStats[stat] = Math.round(aiStats[stat]);
  });
  console.log('[AI STATS] Rule-based stats:', ruleBasedStats);
  console.log('[AI STATS] AI-enhanced stats:', aiStats);
  console.log('[AI STATS] Adjustments - Intensity:', intensityAdjustment, 'Progression:', progressionAdjustment,
    'Balance:', unilateralBalanceAdjustment, 'Variety:', varietyScore);

  return aiStats;
}
function getBodyConditionSummary(stats) {
  const avg = Math.round(
    (stats.rawStrength + stats.muscularEndurance + stats.explosivePower +
      stats.muscularControl + stats.recoveryManagement + stats.mentalResilience +
      stats.agility + stats.speed + stats.attackPotency) / 9
  );

  let condition = '';
  let description = '';

  if (avg >= 90) {
    condition = 'Elite Warrior';
    description = 'Your body is operating at peak performance. You have achieved exceptional balance across all physical attributes.';
  } else if (avg >= 75) {
    condition = 'Advanced Athlete';
    description = 'You demonstrate strong capabilities across multiple domains. Continue refining your weaknesses to reach elite status.';
  } else if (avg >= 60) {
    condition = 'Intermediate Trainee';
    description = 'Solid foundation established. Focus on consistency and progressive overload to advance to the next level.';
  } else if (avg >= 40) {
    condition = 'Developing Novice';
    description = 'You are building your base. Stay consistent and focus on proper form and gradual progression.';
  } else {
    condition = 'Beginner';
    description = 'Welcome to your fitness journey. Every rep counts. Build consistency before intensity.';
  }

  // Identify strongest and weakest attributes
  const statNames = {
    rawStrength: 'Raw Strength',
    muscularEndurance: 'Muscular Endurance',
    explosivePower: 'Explosive Power',
    muscularControl: 'Muscular Control',
    recoveryManagement: 'Recovery Management',
    mentalResilience: 'Mental Resilience',
    agility: 'Agility',
    speed: 'Speed',
    attackPotency: 'Attack Potency'
  };

  const statEntries = Object.entries(stats).map(([key, value]) => ({
    name: statNames[key],
    value
  })).sort((a, b) => b.value - a.value);

  const strongest = statEntries[0];
  const weakest = statEntries[statEntries.length - 1];

  return {
    overall: avg,
    condition,
    description,
    strongest: strongest.name,
    weakest: weakest.name
  };
}

// Get personalized exercise recommendations based on stat weaknesses
function getStatRecommendations(statName, statValue) {
  const recommendations = {
    'Raw Strength': {
      icon: '??',
      analysis: statValue < 40
        ? 'Your raw strength foundation needs development. Focus on building basic strength capacity.'
        : statValue < 70
          ? 'You have decent strength, but there\'s room for significant improvement.'
          : 'Good strength levels! Keep challenging yourself with harder variations.',
      exercises: [
        { name: 'Standard Pullups', why: 'Best compound upper body strength builder', target: 'Work up to 10+ max reps' },
        { name: 'Chin Pullups', why: 'Bicep-focused pulling strength', target: 'Build to 8+ max reps' },
        { name: 'Diamond Pushups', why: 'Builds tricep and chest strength intensely', target: 'Aim for 20+ total reps' },
        { name: 'Pike Pushups', why: 'Develops shoulder strength and power', target: 'Build to 15+ max reps' },
        { name: 'Pistol Squats', why: 'Ultimate single-leg strength exercise', target: 'Master 5+ reps per leg' }
      ],
      tips: [
        'Focus on progressive overload - add 1-2 reps per week',
        'Prioritize compound exercises like pullups and diamond pushups',
        'Rest 2-3 minutes between strength sets for full recovery',
        'Train in the 5-12 rep range for optimal strength gains',
        'Master pullups before moving to advanced variations'
      ]
    },
    'Muscular Endurance': {
      icon: '??',
      analysis: statValue < 40
        ? 'Your muscles fatigue quickly. Build work capacity with higher volume training.'
        : statValue < 70
          ? 'Moderate endurance. Increase total training volume gradually.'
          : 'Strong endurance! You can handle high-volume workouts.',
      exercises: [
        { name: 'Standard Pushups', why: 'Classic endurance builder for chest and triceps', target: 'Sets of 30-50 reps' },
        { name: 'Wide Pushups', why: 'Chest endurance with increased range', target: 'Sets of 25-40 reps' },
        { name: 'Squats', why: 'Build leg endurance and conditioning', target: '100+ total daily reps' },
        { name: 'Lunges', why: 'Unilateral leg endurance', target: 'Sets of 20+ per leg' },
        { name: 'Planks', why: 'Isometric core endurance', target: '90+ second holds' },
        { name: 'Leg Raises', why: 'Dynamic core endurance', target: 'Multiple sets of 20+' }
      ],
      tips: [
        'Gradually increase total weekly volume by 10-15%',
        'Use shorter rest periods (30-60 seconds) between sets',
        'Perform AMRAP (as many reps as possible) sets regularly',
        'Track your total reps per week to measure progress'
      ]
    },
    'Explosive Power': {
      icon: '?',
      analysis: statValue < 40
        ? 'Limited explosive capability. Start with basic power movements.'
        : statValue < 70
          ? 'Decent power output. Add more dynamic and explosive exercises.'
          : 'Excellent explosive power! Maintain with advanced techniques.',
      exercises: [
        { name: 'Jump Squats', why: 'Lower body explosive strength', target: '20+ consecutive reps' },
        { name: 'Standard Pullups', why: 'Upper body explosive pulling power', target: 'Fast, explosive reps' },
        { name: 'Spinning kicks (720Hook, 360Round)', why: 'Rotational power and speed', target: 'Clean technique, 10+ reps' },
        { name: 'Hook Kicks', why: 'Dynamic kicking power', target: '15+ balanced reps per side' },
        { name: 'Knee Pushups (fast tempo)', why: 'Build explosive pressing foundation', target: 'Explosive tempo, 30+ reps' }
      ],
      tips: [
        'Focus on SPEED of movement, not just completing reps',
        'Rest fully between explosive sets (2-3 minutes)',
        'Perform explosive work when fresh (start of workout)',
        'Jump squats are your primary lower body power builder'
      ]
    },
    'Muscular Control': {
      icon: '??',
      analysis: statValue < 40
        ? 'Limited body control. Focus on balance and unilateral exercises.'
        : statValue < 70
          ? 'Good control, but mastering advanced variations will help.'
          : 'Excellent control! You have great movement precision.',
      exercises: [
        { name: 'Pike Pushups', why: 'Shoulder control and stability', target: 'Slow, controlled reps' },
        { name: 'Pistol Squats', why: 'Ultimate single-leg balance test', target: 'Full ROM, 5+ reps per leg' },
        { name: 'Side Squats', why: 'Lateral control and stability', target: '20+ balanced reps each side' },
        { name: 'Hanging Leg Raises', why: 'Core control without momentum', target: 'Strict form, 15+ reps' },
        { name: 'All kick variations', why: 'Balance left and right sides equally', target: 'Keep imbalance under 10%' }
      ],
      tips: [
        'Train multiple exercise variations to improve coordination',
        'Practice unilateral (single-limb) movements regularly',
        'Focus on FORM over volume - quality beats quantity',
        'For kicks and pistol squats: balance left/right to avoid penalties',
        'Imbalance over 15% reduces this stat significantly'
      ]
    },
    'Recovery Management': {
      icon: '??',
      analysis: statValue < 40
        ? 'Your recovery capacity is limited. Focus on balanced training volume.'
        : statValue < 70
          ? 'Moderate recovery. Distribute your workload more evenly.'
          : 'Excellent recovery! You handle training volume efficiently.',
      exercises: [
        { name: 'Balanced training (pushups, pullups, legs, abs, kicks)', why: 'Prevent overuse injuries', target: 'Train all categories weekly' },
        { name: 'Standard Pushups', why: 'Build volume tolerance', target: '200+ total weekly reps' },
        { name: 'Squats', why: 'High-volume leg conditioning', target: '300+ total weekly reps' },
        { name: 'Planks', why: 'Low-impact core endurance', target: '5+ minutes weekly' },
        { name: 'Light kick practice', why: 'Active recovery movement', target: '2-3x per week' }
      ],
      tips: [
        'Don\'t neglect any muscle group - train all 5 categories',
        'Gradually increase weekly volume by 10-15%',
        'Take at least 1-2 rest days per week',
        'Get 7-9 hours of sleep for optimal recovery',
        'Balanced training across categories boosts this stat'
      ]
    },
    'Mental Resilience': {
      icon: '??',
      analysis: statValue < 40
        ? 'Building mental toughness takes time. Stay consistent and challenge yourself.'
        : statValue < 70
          ? 'Good dedication. Push through plateaus to strengthen your mindset.'
          : 'Exceptional mental fortitude! You have elite consistency.',
      exercises: [
        { name: 'Weekly Challenges', why: 'Tests commitment and focus', target: 'Complete every week' },
        { name: 'Max rep sets', why: 'Pushes mental limits', target: 'Go to failure safely' },
        { name: 'Advancement goals', why: 'Long-term motivation', target: 'Complete all tiers' },
        { name: 'Early morning workouts', why: 'Builds discipline', target: '3-5x per week' },
        { name: 'Difficult progressions', why: 'Embrace the challenge', target: 'Master hard variations' }
      ],
      tips: [
        'Set specific, measurable goals and track progress',
        'Maintain consistency even when motivation is low',
        'Celebrate small wins to build positive momentum',
        'Join a community or find an accountability partner',
        'Remember: discipline beats motivation long-term'
      ]
    },
    'Agility': {
      icon: '??',
      analysis: statValue < 40
        ? 'Limited agility and coordination. Start with basic dynamic movements.'
        : statValue < 70
          ? 'Decent agility. Add more varied and complex movement patterns.'
          : 'Great agility! You move with speed and coordination.',
      exercises: [
        { name: 'Basic kicks (Front, Roundhouse, Side, Groin)', why: 'Foundation of all striking', target: 'Master all basic kicks' },
        { name: 'Spinning kicks (360Round, 720Hook)', why: 'Advanced rotational agility', target: '10+ clean reps each side' },
        { name: 'Jump Squats', why: 'Lower body explosive quickness', target: '25+ consecutive reps' },
        { name: 'Side Squats', why: 'Lateral movement control', target: '30+ reps' },
        { name: 'Lunges', why: 'Dynamic leg coordination', target: '20+ per leg' }
      ],
      tips: [
        'Practice multi-directional kicks (forward, side, spinning)',
        'Work on quick direction changes with lunges and side squats',
        'Include rotational exercises (spinning kicks)',
        'Train kicks and dynamic leg movements regularly',
        'Kick variety directly boosts this stat'
      ]
    },
    'Speed': {
      icon: '??',
      analysis: statValue < 40
        ? 'Speed development needed. Focus on explosive exercises.'
        : statValue < 70
          ? 'Good speed foundation. Add more explosive training.'
          : 'Excellent speed! Your fast-twitch fibers are well-developed.',
      exercises: [
        { name: 'Jump Squats', why: 'Lower body explosive speed', target: '30+ consecutive reps' },
        { name: 'Standard Pullups (fast tempo)', why: 'Upper body speed-strength', target: 'Explosive tempo, 10+ reps' },
        { name: 'Fast kicks (all variations)', why: 'Fast leg turnover and speed', target: 'Maximum velocity' },
        { name: 'Knee Pushups (explosive)', why: 'Build speed foundation', target: 'Fast tempo, 40+ reps' },
        { name: 'Spinning kicks (720Hook, 360Round)', why: 'Rotational speed', target: '15+ reps each side' }
      ],
      tips: [
        'Perform explosive exercises with MAXIMUM SPEED',
        'Rest fully between speed sets (2-3 minutes minimum)',
        'Train speed when you\'re fresh, not fatigued',
        'Focus on rate of force development, not endurance',
        'Jump squats are essential for speed development'
      ]
    },
    'Attack Potency': {
      icon: '??',
      analysis: statValue < 40
        ? 'Your kick technique needs significant refinement. Focus on balance and variety.'
        : statValue < 70
          ? 'Decent striking ability. Improve left/right balance and add advanced techniques.'
          : 'Elite martial artist! Your kicks are balanced, varied, and precise.',
      exercises: [
        { name: 'Basic kicks (Front, Roundhouse, Side, Groin)', why: 'Foundation of all striking', target: '50+ balanced reps each side' },
        { name: 'Advanced kicks (Hook, Axe, Back Side)', why: 'Develops technique precision', target: '30+ balanced reps each side' },
        { name: 'Spinning kicks (360, 720)', why: 'Elite rotational control', target: '20+ clean reps each side' },
        { name: 'Left leg focus drills', why: 'Fix imbalances (if right-dominant)', target: 'Match weak side to strong side' },
        { name: 'Slow-motion technique practice', why: 'Perfect form and control', target: '10 reps per kick, both sides' }
      ],
      tips: [
        'ALWAYS train both legs equally - balance is critical',
        'If one side is weaker, do extra sets on that side only',
        'Practice all kick variations, not just your favorites',
        'Focus on clean technique over speed/power initially',
        'Track left vs right reps to identify imbalances early',
        'Imbalance over 20% significantly reduces Attack Potency'
      ]
    }
  };

  return recommendations[statName] || null;
}

function showStatRecommendations(statName, statValue) {
  const rec = getStatRecommendations(statName, statValue);
  if (!rec) return;

  const exerciseList = rec.exercises.map(ex => `
        <div class="p-3 mb-2 rounded" style="background: rgba(16, 185, 129, 0.1); border-left: 3px solid #10b981;">
            <div class="font-bold text-green-400">${ex.name}</div>
            <div class="text-sm text-gray-300 mt-1">?? ${ex.why}</div>
            <div class="text-xs text-gray-400 mt-1">?? ${ex.target}</div>
        </div>
    `).join('');

  const tipsList = rec.tips.map(tip => `
        <li class="text-sm text-gray-300 mb-2">? ${tip}</li>
    `).join('');

  const message = `
        <div class="text-left">
            <div class="text-2xl mb-3">${rec.icon} ${statName}</div>
            <div class="p-3 mb-4 rounded" style="background: rgba(59, 130, 246, 0.1); border-left: 3px solid #3b82f6;">
                <div class="text-sm text-gray-300">${rec.analysis}</div>
            </div>
            
            <h4 class="font-bold text-lg mb-2" style="color: var(--color-accent-main);">Recommended Exercises:</h4>
            ${exerciseList}
            
            <h4 class="font-bold text-lg mt-4 mb-2" style="color: var(--color-accent-main);">Training Tips:</h4>
            <ul class="list-none">
                ${tipsList}
            </ul>
        </div>
    `;

  showModalMessage(`${rec.icon} Improve Your ${statName}`, message);
}
/* ---------- STORAGE (EMBEDDED IN HTML FILE) ---------- */
function loadData() {
  // Try to load from localStorage first, then fall back to embedded data
  const localStorageData = localStorage.getItem(STORAGE_KEY);
  const embeddedLogData = EMBEDDED_DATA.logData;
  const rawData = localStorageData || (embeddedLogData ? JSON.stringify(embeddedLogData) : null);

  if (!rawData) {
    logData = JSON.parse(JSON.stringify(INITIAL_STATE));
    setupChallenge();
    saveData();
  } else {
    try {
      logData = JSON.parse(rawData);

      // Ensure XP exists (for backward compatibility)
      if (logData.xp === undefined) logData.xp = 0;

      // Ensure userProfile exists (for backward compatibility)
      if (logData.userProfile === undefined) logData.userProfile = { weight: null, height: null, age: null };

      // Ensure PistolSquat exists in legs and convert to left/right format
      if (logData.legs && !logData.legs.PistolSquat) {
        logData.legs.PistolSquat = { maxLeft: 0, maxRight: 0, totalLeft: 0, totalRight: 0, total: 0 };
      } else if (logData.legs && logData.legs.PistolSquat && logData.legs.PistolSquat.maxLeft === undefined) {
        // Convert old format to new format (split evenly)
        const oldTotal = logData.legs.PistolSquat.total || 0;
        const oldMax = logData.legs.PistolSquat.max || 0;
        logData.legs.PistolSquat = {
          maxLeft: Math.floor(oldMax / 2),
          maxRight: Math.floor(oldMax / 2),
          totalLeft: Math.floor(oldTotal / 2),
          totalRight: Math.floor(oldTotal / 2),
          total: oldTotal
        };
      }

      // Convert all kicks to left/right format
      if (logData.kicks) {
        const kickVariations = ['Groin', 'Front', 'Roundhouse', 'UchiRoundhouse', 'Side', 'BackSide', 'Hook', 'BackHook', 'Axe', 'Mikkazuk', '360Round', '720Hook', 'DoubleRound'];
        kickVariations.forEach(kick => {
          if (logData.kicks[kick] && logData.kicks[kick].maxLeft === undefined) {
            const oldTotal = logData.kicks[kick].total || 0;
            const oldMax = logData.kicks[kick].max || 0;
            logData.kicks[kick] = {
              maxLeft: Math.floor(oldMax / 2),
              maxRight: Math.floor(oldMax / 2),
              totalLeft: Math.floor(oldTotal / 2),
              totalRight: Math.floor(oldTotal / 2),
              total: oldTotal
            };
          }
        });
      }

      // Use existing setupChallenge but don't save data to avoid notification
      setupChallengeWithoutSave();
    } catch (e) { localStorage.removeItem(STORAGE_KEY); loadData(); }
  }

  // Load Settings
  const localStorageSettings = localStorage.getItem(SETTINGS_KEY);
  const embeddedSettings = EMBEDDED_DATA.settings;
  const rawSettings = localStorageSettings || (embeddedSettings ? JSON.stringify(embeddedSettings) : null);
  if (!rawSettings) { settings = INITIAL_SETTINGS; saveSettings(); }
  else { try { settings = JSON.parse(rawSettings); } catch (e) { settings = INITIAL_SETTINGS; saveSettings(); } }
  // Load Advancements
  const localStorageAdvancements = localStorage.getItem(ADVANCEMENTS_KEY);
  const embeddedAdvancements = EMBEDDED_DATA.completedDifficulties;
  const rawAdvancements = localStorageAdvancements || (embeddedAdvancements && Object.keys(embeddedAdvancements).length > 0 ? JSON.stringify(embeddedAdvancements) : null);
  if (!rawAdvancements) {
    completedDifficulties = {};
    // Pre-unlock Pistol Squat Easy difficulty (since it has no Beginner)
    completedDifficulties['legs-PistolSquat-Beginner'] = true;
    saveAdvancements();
  }
  else {
    try {
      completedDifficulties = JSON.parse(rawAdvancements);
      // Pre-unlock Pistol Squat Easy if not already set
      if (!completedDifficulties['legs-PistolSquat-Beginner']) {
        completedDifficulties['legs-PistolSquat-Beginner'] = true;
        saveAdvancements();
      }
    } catch (e) {
      completedDifficulties = {};
      completedDifficulties['legs-PistolSquat-Beginner'] = true;
      saveAdvancements();
    }
  }

  // Load Advancement Baselines
  const localStorageBaselines = localStorage.getItem(ADVANCEMENT_BASELINES_KEY);
  const embeddedBaselines = EMBEDDED_DATA.advancementBaselines;
  const rawBaselines = localStorageBaselines || (embeddedBaselines && Object.keys(embeddedBaselines).length > 0 ? JSON.stringify(embeddedBaselines) : null);
  if (!rawBaselines) { advancementBaselines = {}; saveAdvancementBaselines(); }
  else { try { advancementBaselines = JSON.parse(rawBaselines); } catch (e) { advancementBaselines = {}; saveAdvancementBaselines(); } }
}

// Create a silent version of setupChallenge that doesn't save data
function setupChallengeSilently() {
  const wkKey = getCurrentWeekKey();
  const previousWeekKey = logData.weeklyChallenge.weekKey;
  const isNewWeek = previousWeekKey !== wkKey;

  if (isNewWeek && previousWeekKey) {

    if (!logData.weeklyChallenge.isComplete) {

      const totalRepsBeforePenalty = calculateGrandTotalReps();
      const intendedPenalty = Math.round(totalRepsBeforePenalty * 0.10);

      if (intendedPenalty > 0) {
        let actualRemainingPenalty = intendedPenalty;
        const sectionsToDeduct = ['pushups', 'pullups', 'legs', 'abs', 'kicks'];

        for (const sec of sectionsToDeduct) {
          for (const variation in logData[sec]) {
            const currentTotal = logData[sec][variation].total || 0;
            const fraction = currentTotal / totalRepsBeforePenalty;
            let deductionForVar = Math.floor(intendedPenalty * fraction);

            if (deductionForVar > currentTotal) {
              deductionForVar = currentTotal;
            }

            if (deductionForVar > 0) {
              logData[sec][variation].total = Math.max(0, currentTotal - deductionForVar);
              actualRemainingPenalty -= deductionForVar;

              console.log(`[CHALLENGE] Applied penalty to ${sec}/${variation}: -${deductionForVar} reps (new total: ${logData[sec][variation].total})`);
            }

            if (actualRemainingPenalty <= 0) break;
          }
          if (actualRemainingPenalty <= 0) break;
        }
      }
    }

    // Reset challenge for new week (without saving data)
    logData.weeklyChallenge = {
      weekKey: wkKey,
      challenge: null,
      progress: 0,
      isComplete: false,
      baseline: 0,
      completionNotified: false
    };

    // Select a new challenge from the pool
    const eligibleChallenges = CHALLENGE_POOL.filter(ch => {
      // Ensure the exercise exists in logData
      return logData[ch.type] && logData[ch.type][ch.variation];
    });

    if (eligibleChallenges.length > 0) {
      const randomIndex = Math.floor(Math.random() * eligibleChallenges.length);
      logData.weeklyChallenge.challenge = eligibleChallenges[randomIndex];
      logData.weeklyChallenge.baseline = logData[logData.weeklyChallenge.challenge.type][logData.weeklyChallenge.challenge.variation].total || 0;
    }

    console.log('[CHALLENGE] New weekly challenge assigned:', logData.weeklyChallenge.challenge ? logData.weeklyChallenge.challenge.name : 'None');
  } else if (!logData.weeklyChallenge.weekKey) {
    // First time setup
    logData.weeklyChallenge = {
      weekKey: wkKey,
      challenge: null,
      progress: 0,
      isComplete: false,
      baseline: 0,
      completionNotified: false
    };

    // Select initial challenge
    const eligibleChallenges = CHALLENGE_POOL.filter(ch => {
      return logData[ch.type] && logData[ch.type][ch.variation];
    });

    if (eligibleChallenges.length > 0) {
      const randomIndex = Math.floor(Math.random() * eligibleChallenges.length);
      logData.weeklyChallenge.challenge = eligibleChallenges[randomIndex];
      logData.weeklyChallenge.baseline = logData[logData.weeklyChallenge.challenge.type][logData.weeklyChallenge.challenge.variation].total || 0;
    }

    console.log('[CHALLENGE] Initial challenge assigned:', logData.weeklyChallenge.challenge ? logData.weeklyChallenge.challenge.name : 'None');
  }

  // Don't save data here to avoid showing notification
  console.log('[CHALLENGE] Challenge setup completed silently');
}

function saveData() {
  try {
    // Save to both embedded data and localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logData));
    updateEmbeddedData();

    console.log('[AUTOSAVE] Data saved to localStorage');

    // Sync with Firebase if user is logged in
    if (currentUser && currentUser.uid) {
      console.log('[AUTOSAVE] Attempting to sync with Firebase for user:', currentUser.uid);
      // Use a more robust approach to Firebase sync
      saveUserDataToFirebase(currentUser.uid)
        .then((result) => {
          if (result && result.result === 'success') {
            console.log('[AUTOSAVE] Data automatically synced with Firebase');
          } else {
            console.log('[AUTOSAVE] Firebase sync skipped or not needed:', result);
          }
        })
        .catch(error => {
          console.error('[AUTOSAVE] Failed to sync with Firebase:', error);
          // Try to show a more user-friendly error message
          let errorMessage = 'Unknown error';
          if (error.code === 'PERMISSION_DENIED') {
            errorMessage = 'Permission denied. Please check your Firebase security rules.';
          } else if (error.message) {
            errorMessage = error.message;
          }
          console.log('[AUTOSAVE] Firebase sync error details:', errorMessage);
        });
    } else {
      console.log('[AUTOSAVE] User not logged in, skipping Firebase sync');
    }
  } catch (error) {
    console.error('[AUTOSAVE] Error saving data:', error);
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    updateEmbeddedData();

    console.log('[AUTOSAVE] Settings saved to localStorage');

    // Sync with Firebase if user is logged in
    if (currentUser && currentUser.uid) {
      console.log('[AUTOSAVE] Attempting to sync settings with Firebase for user:', currentUser.uid);
      // Use a more robust approach to Firebase sync
      saveUserDataToFirebase(currentUser.uid)
        .then((result) => {
          if (result && result.result === 'success') {
            console.log('[AUTOSAVE] Settings automatically synced with Firebase');
          } else {
            console.log('[AUTOSAVE] Firebase sync skipped or not needed:', result);
          }
        })
        .catch(error => {
          console.error('[AUTOSAVE] Failed to sync settings with Firebase:', error);
          // Try to show a more user-friendly error message
          let errorMessage = 'Unknown error';
          if (error.code === 'PERMISSION_DENIED') {
            errorMessage = 'Permission denied. Please check your Firebase security rules.';
          } else if (error.message) {
            errorMessage = error.message;
          }
          console.log('[AUTOSAVE] Firebase sync error details:', errorMessage);
        });
    } else {
      console.log('[AUTOSAVE] User not logged in, skipping Firebase sync for settings');
    }
  } catch (error) {
    console.error('[AUTOSAVE] Error saving settings:', error);
  }
}

function saveAdvancements() {
  try {
    localStorage.setItem(ADVANCEMENTS_KEY, JSON.stringify(completedDifficulties));
    updateEmbeddedData();

    console.log('[AUTOSAVE] Advancements saved to localStorage');

    // Sync with Firebase if user is logged in
    if (currentUser && currentUser.uid) {
      console.log('[AUTOSAVE] Attempting to sync advancements with Firebase for user:', currentUser.uid);
      // Use a more robust approach to Firebase sync
      saveUserDataToFirebase(currentUser.uid)
        .then((result) => {
          if (result && result.result === 'success') {
            console.log('[AUTOSAVE] Advancements automatically synced with Firebase');
          } else {
            console.log('[AUTOSAVE] Firebase sync skipped or not needed:', result);
          }
        })
        .catch(error => {
          console.error('[AUTOSAVE] Failed to sync advancements with Firebase:', error);
          // Try to show a more user-friendly error message
          let errorMessage = 'Unknown error';
          if (error.code === 'PERMISSION_DENIED') {
            errorMessage = 'Permission denied. Please check your Firebase security rules.';
          } else if (error.message) {
            errorMessage = error.message;
          }
          console.log('[AUTOSAVE] Firebase sync error details:', errorMessage);
        });
    } else {
      console.log('[AUTOSAVE] User not logged in, skipping Firebase sync for advancements');
    }
  } catch (error) {
    console.error('[AUTOSAVE] Error saving advancements:', error);
  }
}

function saveAdvancementBaselines() {
  try {
    localStorage.setItem(ADVANCEMENT_BASELINES_KEY, JSON.stringify(advancementBaselines));
    updateEmbeddedData();

    console.log('[AUTOSAVE] Advancement baselines saved to localStorage');

    // Sync with Firebase if user is logged in
    if (currentUser && currentUser.uid) {
      console.log('[AUTOSAVE] Attempting to sync advancement baselines with Firebase for user:', currentUser.uid);
      // Use a more robust approach to Firebase sync
      saveUserDataToFirebase(currentUser.uid)
        .then((result) => {
          if (result && result.result === 'success') {
            console.log('[AUTOSAVE] Advancement baselines automatically synced with Firebase');
          } else {
            console.log('[AUTOSAVE] Firebase sync skipped or not needed:', result);
          }
        })
        .catch(error => {
          console.error('[AUTOSAVE] Failed to sync advancement baselines with Firebase:', error);
          // Try to show a more user-friendly error message
          let errorMessage = 'Unknown error';
          if (error.code === 'PERMISSION_DENIED') {
            errorMessage = 'Permission denied. Please check your Firebase security rules.';
          } else if (error.message) {
            errorMessage = error.message;
          }
          console.log('[AUTOSAVE] Firebase sync error details:', errorMessage);
        });
    } else {
      console.log('[AUTOSAVE] User not logged in, skipping Firebase sync for advancement baselines');
    }
  } catch (error) {
    console.error('[AUTOSAVE] Error saving advancement baselines:', error);
  }
}



function testFirebaseConnection() {
  console.log('[FIREBASE] Testing connection...');

  // Check if Firebase is initialized
  if (!app) {
    console.log('[FIREBASE] Firebase app not initialized');
    showModalMessage('? Firebase Error', 'Firebase app not initialized');
    return Promise.reject(new Error('Firebase app not initialized'));
  }

  if (!auth) {
    console.log('[FIREBASE] Firebase auth not initialized');
    showModalMessage('? Firebase Error', 'Firebase auth not initialized');
    return Promise.reject(new Error('Firebase auth not initialized'));
  }

  if (!database) {
    console.log('[FIREBASE] Firebase database not initialized');
    showModalMessage('? Firebase Error', 'Firebase database not initialized');
    return Promise.reject(new Error('Firebase database not initialized'));
  }

  // Check if user is logged in
  const user = auth.currentUser;
  if (!user) {
    console.log('[FIREBASE] No user logged in');
    showModalMessage('?? Not Logged In', 'You must be logged in to test Firebase connection.');
    return Promise.reject(new Error('No user logged in'));
  }

  console.log('[FIREBASE] User logged in:', user.email);

  // Test writing to database
  const testRef = database.ref('test/' + user.uid);
  return testRef.set({
    test: true,
    timestamp: new Date().toISOString(),
    userId: user.uid,
    email: user.email
  })
    .then(() => {
      console.log('[FIREBASE] Test write successful');
      showModalMessage('? Test Successful', 'Firebase connection is working correctly!');
      // Clean up test data after a delay
      setTimeout(() => {
        testRef.remove()
          .then(() => console.log('[FIREBASE] Test data cleaned up'))
          .catch(error => console.error('[FIREBASE] Error cleaning up test data:', error));
      }, 5000);
      return { success: true };
    })
    .catch(error => {
      console.error('[FIREBASE] Test failed:', error);
      let errorMessage = error.message;
      if (error.code === 'PERMISSION_DENIED') {
        errorMessage = 'Permission denied. Please check your Firebase security rules at https://console.firebase.google.com/';
      }
      showModalMessage('? Test Failed', `Firebase test failed: ${errorMessage}`);
      return Promise.reject(error);
    });
}

// Function to manually trigger a save to Firebase for testing
function manualFirebaseSave() {
  if (currentUser && currentUser.uid) {
    showModalMessage('?? Saving Data', 'Manually saving data to Firebase...');
    saveUserDataToFirebase(currentUser.uid)
      .then((result) => {
        if (result && result.result === 'success') {
          showModalMessage('? Save Complete', 'Data successfully saved to Firebase!');
        } else {
          showModalMessage('?? Save Complete', 'Save function completed but may not have saved data. Check console for details.');
        }
      })
      .catch(error => {
        console.error('[MANUAL SAVE] Error:', error);
        let errorMessage = error.message;
        if (error.code === 'PERMISSION_DENIED') {
          errorMessage = 'Permission denied. Please check your Firebase security rules at https://console.firebase.google.com/';
        }
        showModalMessage('? Save Failed', `Failed to save data: ${errorMessage}`);
      });
  } else {
    showModalMessage('?? Not Logged In', 'You must be logged in to save data to Firebase.');
  }
}

// Function to check Firebase auth status
function checkFirebaseAuthStatus() {
  console.log('[FIREBASE] Checking auth status...');

  if (!auth) {
    console.log('[FIREBASE] Auth not initialized');
    return { initialized: false, user: null };
  }

  const user = auth.currentUser;
  console.log('[FIREBASE] Current user:', user ? user.email : 'None');

  if (user) {
    return {
      initialized: true,
      user: {
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified
      }
    };
  } else {
    return {
      initialized: true,
      user: null
    };
  }
}

// Function to debug Firebase saving issues
function debugFirebaseSave() {
  console.log('[FIREBASE] Debugging save issues...');

  // Check auth status
  const authStatus = checkFirebaseAuthStatus();
  console.log('[FIREBASE] Auth status:', authStatus);

  if (!authStatus.initialized) {
    showModalMessage('? Firebase Error', 'Firebase authentication not initialized');
    return;
  }

  if (!authStatus.user) {
    showModalMessage('?? Not Logged In', 'You must be logged in to save data to Firebase.');
    return;
  }

  // Check database connection
  if (!database) {
    showModalMessage('? Firebase Error', 'Firebase database not initialized');
    return;
  }

  // Check if we have data to save
  if (!logData) {
    showModalMessage('?? No Data', 'No workout data found to save.');
    return;
  }

  // Try to save data
  showModalMessage('?? Debugging', 'Testing Firebase save operation...');

  // Log the data that will be sent
  console.log('[FIREBASE] Data to be saved:', {
    logData: logData,
    settings: settings,
    completedDifficulties: completedDifficulties,
    advancementBaselines: advancementBaselines
  });

  saveUserDataToFirebase(authStatus.user.uid)
    .then(result => {
      console.log('[FIREBASE] Debug save result:', result);
      if (result && result.result === 'success') {
        showModalMessage('? Debug Complete', 'Firebase save test completed successfully!');
      } else {
        showModalMessage('?? Debug Complete', 'Firebase function completed but may not have saved data. Check console for details.');
      }
    })
    .catch(error => {
      console.error('[FIREBASE] Debug save error:', error);
      let errorMessage = error.message;
      if (error.code === 'PERMISSION_DENIED') {
        errorMessage = 'Permission denied. Please check your Firebase security rules at https://console.firebase.google.com/';
      }
      showModalMessage('? Debug Failed', `Firebase save test failed: ${errorMessage}`);
    });
}

// New function to test Firebase connectivity and authentication
function testFirebaseConnectivity() {
  console.log('[FIREBASE] Testing connectivity...');

  // Check if Firebase is initialized
  if (!app) {
    console.log('[FIREBASE] Firebase app not initialized');
    showModalMessage('? Firebase Error', 'Firebase app not initialized');
    return Promise.reject(new Error('Firebase app not initialized'));
  }

  if (!auth) {
    console.log('[FIREBASE] Firebase auth not initialized');
    showModalMessage('? Firebase Error', 'Firebase auth not initialized');
    return Promise.reject(new Error('Firebase auth not initialized'));
  }

  if (!database) {
    console.log('[FIREBASE] Firebase database not initialized');
    showModalMessage('? Firebase Error', 'Firebase database not initialized');
    return Promise.reject(new Error('Firebase database not initialized'));
  }

  // Check if user is logged in
  const user = auth.currentUser;
  if (!user) {
    console.log('[FIREBASE] No user logged in');
    showModalMessage('?? Not Logged In', 'You must be logged in to test Firebase connection.');
    return Promise.reject(new Error('No user logged in'));
  }

  console.log('[FIREBASE] User logged in:', user.email);

  // Test database connectivity with a simple read operation
  const testRef = database.ref('.info/connected');
  return testRef.once('value')
    .then(snapshot => {
      const connected = snapshot.val();
      console.log('[FIREBASE] Database connection status:', connected);

      if (connected) {
        // Test writing to database
        const userTestRef = database.ref('test/' + user.uid);
        return userTestRef.set({
          test: true,
          timestamp: new Date().toISOString(),
          userId: user.uid,
          email: user.email
        })
          .then(() => {
            console.log('[FIREBASE] Test write successful');

            // Clean up test data after a delay
            setTimeout(() => {
              userTestRef.remove()
                .then(() => console.log('[FIREBASE] Test data cleaned up'))
                .catch(error => console.error('[FIREBASE] Error cleaning up test data:', error));
            }, 5000);

            return { success: true, message: 'Firebase connection is working correctly!' };
          });
      } else {
        return Promise.reject(new Error('Not connected to Firebase database'));
      }
    })
    .catch(error => {
      console.error('[FIREBASE] Connectivity test failed:', error);
      let errorMessage = error.message;
      if (error.code === 'PERMISSION_DENIED') {
        errorMessage = 'Permission denied. Please check your Firebase security rules at https://console.firebase.google.com/';
      }
      return Promise.reject(error);
    });
}

// NEW: Update the embedded data in the HTML file itself
function updateEmbeddedData() {
  // This function will trigger a download of the updated HTML file
  const htmlContent = document.documentElement.outerHTML;

  // Create the embedded data object
  const embeddedDataString = JSON.stringify({
    logData: logData,
    settings: settings,
    completedDifficulties: completedDifficulties,
    advancementBaselines: advancementBaselines
  });

  // Replace the EMBEDDED_DATA constant in the HTML
  const pattern = /const EMBEDDED_DATA = \{[^}]*\};/;
  const replacement = `const EMBEDDED_DATA = ${embeddedDataString};`;
  const updatedHTML = htmlContent.replace(pattern, replacement);

  // Create a blob and download link
  const blob = new Blob([updatedHTML], { type: 'text/html' });
  const url = URL.createObjectURL(blob);

  // Store the download URL for manual saving
  window.harbingerDownloadURL = url;
  window.harbingerUpdatedHTML = updatedHTML;

  console.log('[AUTOSAVE] Data embedded in file. Use "Save Progress" button to download updated file.');
}
/* ---------- UTILS (unchanged, but relying on variables) ---------- */
function msToTime(duration) {
  let seconds = Math.floor((duration / 1000) % 60);
  let minutes = Math.floor((duration / (1000 * 60)) % 60);
  let hours = Math.floor((duration / (1000 * 60 * 60)) % 24);
  let days = Math.floor(duration / (1000 * 60 * 60 * 24));

  // Convert days to hours and add to existing hours
  hours = hours + days * 24;

  const h = String(hours).padStart(2, '0');
  const m = String(minutes).padStart(2, '0');
  const s = String(seconds).padStart(2, '0');

  // Always return in hours:minutes:seconds format
  return `${h}:${m}:${s}`;
}
function calculateGrandTotalReps() {
  let total = 0;
  ['pushups', 'pullups', 'legs', 'abs', 'kicks'].forEach(sec => {
    // Add null check to prevent "Cannot read properties of null" error
    if (logData && logData[sec]) {
      Object.values(logData[sec]).forEach(v => {
        total += v.total || 0;
      });
    }
  });
  return total;
}
function calculateTotalAdvancements() {
  let totalAdvancements = 0;
  for (const section in TIERS) {
    for (const variation in TIERS[section]) {
      for (const difficulty in TIERS[section][variation]) {
        if (TIERS[section][variation][difficulty].length > 0) {
          totalAdvancements++;
        }
      }
    }
  }
  return totalAdvancements;
}

function calculateCompletedAdvancements() {
  let achievedAdvancements = 0;
  for (const section in TIERS) {
    for (const variation in TIERS[section]) {
      for (const difficulty in TIERS[section][variation]) {
        const tiers = TIERS[section][variation][difficulty];
        if (tiers && tiers.length > 0) {
          const requiredGoal = tiers[0].goal;
          // Safely access currentTotal, defaulting to 0 if data is missing
          const currentTotal = (logData[section] && logData[section][variation])
            ? logData[section][variation].total || 0 : 0;
          if (currentTotal >= requiredGoal) {
            achievedAdvancements++;
          }
        }
      }
    }
  }
  return achievedAdvancements;
}

function currentRank(totalReps, currentXP, bodyStatAvg) {
  const total = totalReps !== undefined ? totalReps : calculateGrandTotalReps();
  const xp = currentXP !== undefined ? currentXP : (logData && logData.xp || 0);
  const bodyStat = bodyStatAvg !== undefined ? bodyStatAvg : calculateBodyStats().overall || 0;

  let rank = RANKS[0];
  for (let r of RANKS) {
    // All three conditions must be met: total reps, XP, and body stat average
    if (total >= r.req && xp >= r.xpReq && bodyStat >= r.bodyStatReq) {
      rank = r;
    } else {
      break;
    }
  }
  return rank;
}
function updateHeaderRankingDisplay() {
  console.log('[HEADER] Updating header ranking display');
  const total = calculateGrandTotalReps();
  // Add null check to prevent "Cannot read properties of null" error
  const xp = (logData && logData.xp) || 0;
  const bodyStat = getBodyConditionSummary(calculateBodyStats()).overall || 0;
  const rank = currentRank(total, xp, bodyStat);
  // Find the next rank that requires ALL conditions to be met
  const nextRank = RANKS.find(r => r.req > rank.req || r.xpReq > rank.xpReq || r.bodyStatReq > rank.bodyStatReq);

  // Debug logging
  console.log(`[HEADER] Current stats - Total: ${total}, XP: ${xp}, Body: ${bodyStat}`);
  console.log(`[HEADER] Current rank: ${rank.name} (req: ${rank.req}, xpReq: ${rank.xpReq}, bodyStatReq: ${rank.bodyStatReq})`);
  console.log(`[HEADER] Next rank: ${nextRank ? nextRank.name : 'None'} (req: ${nextRank ? nextRank.req : 'N/A'}, xpReq: ${nextRank ? nextRank.xpReq : 'N/A'}, bodyStatReq: ${nextRank ? nextRank.bodyStatReq : 'N/A'})`);

  // Additional debugging for rank progression
  RANKS.forEach((r, index) => {
    const meetsReps = total >= r.req;
    const meetsXP = xp >= r.xpReq;
    const meetsBody = bodyStat >= r.bodyStatReq;
    const allMet = meetsReps && meetsXP && meetsBody;
    console.log(`[HEADER] Rank ${index}: ${r.name} - Reps: ${meetsReps}, XP: ${meetsXP}, Body: ${meetsBody}, All: ${allMet}`);
  });

  // Update the new header stats bar
  updateHeaderStatsBar(total, xp);
  const container = document.getElementById('rank-display-container');
  if (container) {
    // Check if rank has changed (level up)
    const previousRankName = container.dataset.rankName || '';
    const rankChanged = previousRankName !== rank.name;

    // Store current rank name for next comparison
    container.dataset.rankName = rank.name;

    // Calculate progress percentages for reps and XP
    let repsProgressPercent = 0;
    let xpProgressPercent = 0;

    if (nextRank) {
      const currentRankStartReps = rank.req || 0;
      const repsRequiredForNext = nextRank.req;
      const repsRange = repsRequiredForNext - currentRankStartReps;
      if (repsRange > 0) {
        repsProgressPercent = Math.min(100, Math.max(0, Math.floor(((total - currentRankStartReps) / repsRange) * 100)));
      }

      const currentRankStartXP = rank.xpReq || 0;
      const xpRequiredForNext = nextRank.xpReq;
      const xpRange = xpRequiredForNext - currentRankStartXP;
      if (xpRange > 0) {
        xpProgressPercent = Math.min(100, Math.max(0, Math.floor(((xp - currentRankStartXP) / xpRange) * 100)));
      }
    }

    container.innerHTML = `
          <div class="flex justify-between items-center mb-1">
              <div class="text-lg font-semibold flex items-center ${rankChanged ? 'level-up-flash' : ''}" style="color: var(--color-accent-main);">
                  <i class="fas fa-star mr-2 ${rankChanged ? 'badge-glow' : ''}"></i> Rank: ${rank.name}
              </div>
          </div>

      `;
  }

  console.log('[HEADER] Rank display updated successfully');
}

// NEW FUNCTION TO UPDATE HEADER STATS BAR
function updateHeaderStatsBar(totalReps, totalXP) {
  // Get current rank and next rank
  const bodyStat = getBodyConditionSummary(calculateBodyStats()).overall || 0;
  // Add null check to prevent "Cannot read properties of null" error
  const xp = (logData && logData.xp) || 0;
  const rank = currentRank(totalReps, totalXP, bodyStat);
  const nextRank = RANKS.find(r => r.req > rank.req || r.xpReq > rank.xpReq || r.bodyStatReq > rank.bodyStatReq);

  const repsBar = document.getElementById('reps-progress-bar');
  const xpBar = document.getElementById('xp-progress-bar');

  if (nextRank) {
    // Calculate progress percentages based on current rank requirements
    if (repsBar) {
      const currentRankStartReps = rank.req || 0;
      const repsRequiredForNext = nextRank.req;
      const repsRange = repsRequiredForNext - currentRankStartReps;
      if (repsRange > 0) {
        const repsProgressPercent = Math.min(100, Math.max(0, Math.floor(((totalReps - currentRankStartReps) / repsRange) * 100)));
        repsBar.style.width = repsProgressPercent + '%';
      } else {
        repsBar.style.width = '100%';
      }
    }

    if (xpBar) {
      const currentRankStartXP = rank.xpReq || 0;
      const xpRequiredForNext = nextRank.xpReq;
      const xpRange = xpRequiredForNext - currentRankStartXP;
      if (xpRange > 0) {
        const xpProgressPercent = Math.min(100, Math.max(0, Math.floor(((totalXP - currentRankStartXP) / xpRange) * 100)));
        xpBar.style.width = xpProgressPercent + '%';
      } else {
        xpBar.style.width = '100%';
      }
    }
  } else {
    // At max rank
    if (repsBar) repsBar.style.width = '100%';
    if (xpBar) xpBar.style.width = '100%';
  }
}

/* ---------- UI RENDERING (UPDATED) ---------- */

// Keep track of the previous page for animation direction
let previousPage = 'home';

function renderUI() {
  console.log(`[UI] Rendering UI for page: ${currentPage}`);

  // Add a small delay for mobile devices to ensure proper rendering
  setTimeout(() => {
    updateHeaderRankingDisplay();
    // renderChallenge(); // Moved inside renderHome

    // Use the new tab system with directional animations
    showTab(currentPage);

    // Update previous page
    previousPage = currentPage;

    // Ensure navigation items are properly activated
    document.querySelectorAll('.nav-item').forEach(b => {
      b.classList.remove('active');
      if (b.dataset.page === currentPage) {
        b.classList.add('active');
      }
    });

    // Use SPA routing system to render content
    const route = routes[currentPage];
    if (route && typeof route.render === 'function') {
      route.render();
    } else {
      console.error(`[UI] No render function found for page: ${currentPage}`);
      // Fallback to home page
      if (currentPage !== 'home') {
        changePage('home');
      }
    }
  }, navigator.userAgent.match(/Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i) ? 50 : 20);
}

// NEW FUNCTION TO CHANGE ADVANCEMENT DIFFICULTY
function changeAdvancementDifficulty(difficulty) {
  currentAdvancementDifficulty = difficulty;
  renderAdvancements();
}
window.changeAdvancementDifficulty = changeAdvancementDifficulty;
// MODIFIED renderAdvancements to show sub-tabs
function renderAdvancements() {
  const el = document.getElementById('advancements');
  if (!el) return;

  const difficulties = ['Beginner', 'Easy', 'Medium', 'Hard', 'Insane'];
  const sections = ['pushups', 'pullups', 'legs', 'abs', 'kicks'];

  // 1. Difficulty Tabs/Selector
  const difficultyTabs = difficulties.map(d => {
    const isActive = d === currentAdvancementDifficulty;
    const activeClass = isActive
      ? 'shadow-xl'
      : 'bg-gray-700/50 text-gray-400 hover:opacity-80';

    // Style to use accent color for active tab
    const style = isActive
      ? `background: var(--color-accent-main); color: var(--color-bg-primary); border: 1px solid var(--color-accent-main);`
      : `background: var(--color-bg-card); color: var(--color-text-primary); border: 1px solid var(--color-border);`;

    return `<button 
            onclick="changeAdvancementDifficulty('${d}')" 
            class="flex-1 min-w-[50px] px-3 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${activeClass}"
            style="${style}"
            >
            ${d}
        </button>`;
  }).join('');
  // 2. Content for selected difficulty
  const content = sections.map(section => {
    const variations = Object.keys(logData[section] || {});

    // Filter variations that have tiers defined for the current difficulty
    const validVariations = variations.filter(v =>
      TIERS[section] &&
      TIERS[section][v] &&
      TIERS[section][v][currentAdvancementDifficulty] &&
      TIERS[section][v][currentAdvancementDifficulty].length > 0
    );

    if (validVariations.length === 0) return ''; // Skip section if no variations apply

    const variHTML = validVariations.map(v => {
      const isUnlocked = isVariationDifficultyUnlocked(section, v, currentAdvancementDifficulty);
      const tiers = TIERS[section][v][currentAdvancementDifficulty];
      const currentTotal = logData[section][v].total || 0;

      // NEW: Use reps earned for THIS difficulty level only
      const currentProgress = getRepsForCurrentDifficulty(section, v, currentAdvancementDifficulty);
      const unit = (section === 'abs' && v === 'Planks') ? 's' : 'reps';

      const tierRows = tiers.map((tier) => {
        const status = currentProgress >= tier.goal;
        const progressPercent = Math.min(100, Math.floor((currentProgress / tier.goal) * 100));
        const tierDesc = tier.desc || '';
        const unitLabel = (section === 'abs' && v === 'Planks') ? 'seconds' : 'reps';

        // Show baseline info if not Beginner
        let baselineInfo = '';
        if (currentAdvancementDifficulty !== 'Beginner') {
          const prevDiffKey = `${section}-${v}-${getPreviousDifficulty(currentAdvancementDifficulty)}`;
          const baseline = advancementBaselines[prevDiffKey] || 0;
          baselineInfo = `<div class="text-xs text-gray-500 mt-1">Starting from: ${baseline.toLocaleString()} ${unitLabel} | Current total: ${currentTotal.toLocaleString()} ${unitLabel}</div>`;
        }

        return `
                    <div class="flex flex-col gap-2 py-2 text-sm">
                        <div class="font-medium flex flex-col gap-1 mb-1">
                            <span>${tierDesc}</span>
                            <span class="text-gray-400 text-xs">Target: ${tier.goal.toLocaleString()} ${unitLabel} needed</span>
                        </div>
                        <div class="w-full mb-1">
                            <div class="progress-bar-container h-2 rounded chart-heartbeat">
                                <div class="progress-accent rounded" style="width:${progressPercent}%; min-width:2%;"></div>
                            </div>
                            <div class="flex justify-between text-xs mt-1">
                                <span class="text-gray-400">${currentProgress.toLocaleString()} ${unitLabel} earned</span>
                                <span class="${status ? 'text-green-500' : 'text-red-500'} font-bold">${progressPercent}%</span>
                            </div>
                            ${baselineInfo}
                        </div>
                        <div class="text-xs ${status ? 'text-green-400' : 'text-yellow-400'} font-semibold mt-1">
                            ${status ? 'Goal achieved.' : `${(tier.goal - currentProgress).toLocaleString()} ${unitLabel} more needed!`}
                        </div>
                    </div>
                `;
      }).join('<div style="border-bottom: 1px dashed var(--color-border); margin: 0 0.5rem;"></div>');

      // Using the hyphenated key for consistency with other parts of the system
      const difficultyKey = `${section}-${v}-${currentAdvancementDifficulty}`;
      const isCompleted = completedDifficulties[difficultyKey] === true;

      // Check if all goals are met for the current difficulty (now there is only 1 goal per difficulty)
      const allGoalsMet = tiers.length > 0 && currentProgress >= tiers[0].goal;
      // Calculate XP reward for this difficulty based on exercise type, goal, and difficulty
      let baseXPPerRep = 1; // Default base XP
      if (BASE_XP[section] && BASE_XP[section][v]) {
        baseXPPerRep = BASE_XP[section][v];
      }

      // Apply difficulty multiplier
      const difficultyMultiplier = DIFFICULTY_MULTIPLIER[currentAdvancementDifficulty] || 1;

      // Calculate XP based on the goal requirement (not actual reps)
      const xpReward = Math.round(tiers[0].goal * baseXPPerRep * difficultyMultiplier);

      // XP badge - show if completed or can be claimed
      let xpBadge = '';
      if (isCompleted) {
        xpBadge = `<span class="text-xs px-2 py-1 rounded" style="background: rgba(34, 197, 94, 0.2); color: #22c55e;">? +${xpReward} XP Earned</span>`;
      } else if (allGoalsMet) {
        xpBadge = `<span class="text-xs px-2 py-1 rounded" style="background: rgba(234, 179, 8, 0.2); color: #eab308;">? ${xpReward} XP Available</span>`;
      } else {
        xpBadge = `<span class="text-xs px-2 py-1 rounded" style="background: rgba(107, 114, 128, 0.2); color: #9ca3af;">?? ${xpReward} XP Reward</span>`;
      }

      const completionIcon = (isCompleted || allGoalsMet)
        ? '' // No icon if completed OR all goals met
        : '';

      const completionText = isCompleted
        ? '<span class="text-green-400 font-bold">Advance Complete!</span>'
        : (allGoalsMet ? '' : '<span class="text-gray-400">Not yet completed.</span>');

      // Button to mark complete - only visible if all goals are met AND it's not already completed
      const completeButton = (!isCompleted && allGoalsMet) ? `
                <button 
                    onclick="handleMarkComplete('${section}', '${v}', '${currentAdvancementDifficulty}')"
                    class="mt-3 w-full py-2 rounded-lg font-bold transition duration-200"
                    style="background-color: #10b981; color: var(--color-text-primary); box-shadow: 0 4px 0 #059669;"
                >
                    ?? Claim +${xpReward} XP
                </button>
            ` : '';

      // Locked overlay content
      const lockedOverlay = isUnlocked ? '' : `
                <div class="absolute inset-0 flex flex-col items-center justify-center p-4 bg-black/80 rounded-lg text-center">
                    <i class="fas fa-lock text-4xl text-gray-500 mb-2"></i>
                    <p class="text-lg font-bold text-gray-400">Locked: Master ${getPreviousDifficulty(currentAdvancementDifficulty)}</p>
                    <p class="text-sm text-gray-500">You must complete the previous difficulty for this specific exercise to unlock this level.</p>
                </div>
            `;

      const cardClasses = isUnlocked ? '' : 'locked-quest relative overflow-hidden';

      // Add tier aura effect based on difficulty
      let tierAuraClass = '';
      switch (currentAdvancementDifficulty) {
        case 'Beginner':
          tierAuraClass = 'tier-aura-beginner';
          break;
        case 'Easy':
          tierAuraClass = 'tier-aura-easy';
          break;
        case 'Medium':
          tierAuraClass = 'tier-aura-medium';
          break;
        case 'Hard':
          tierAuraClass = 'tier-aura-hard';
          break;
        case 'Insane':
          tierAuraClass = 'tier-aura-insane';
          break;
        default:
          tierAuraClass = '';
      }

      return `
                <div class="card p-4 ${cardClasses} ${tierAuraClass} tier-aura-pulse" style="border-left-color: ${isCompleted ? '#10b981' : 'var(--color-accent-main)'};">
                    ${lockedOverlay}
                    <div class="flex items-center justify-between mb-2 border-b pb-2" style="border-color:var(--color-border);">
                        <div class="font-bold text-lg" style="color:var(--color-accent-main);">${v}</div>
                        <div class="text-sm font-semibold flex items-center gap-2">
                            ${completionIcon}
                        </div>
                    </div>
                    <!-- XP Badge -->
                    <div class="mb-3">
                        ${xpBadge}
                    </div>
                    <!-- Completion Status -->
                    <div class="mb-3">
                        ${completionText}
                    </div>
                    ${tierRows}
                    ${completeButton}
                </div>
            `;

    }).join('');

    return `<div class="mb-6"><h3 class="text-xl font-extrabold mb-3" style="color:var(--color-accent-main);">${section.toUpperCase()}</h3><div class="grid grid-cols-1 sm:grid-cols-2 gap-4">${variHTML}</div></div>`;
  }).join('');
  el.innerHTML = `
        <h2 class="text-2xl font-bold mb-2" style="color:var(--color-accent-main);">Advancement Tiers</h2>
        
        <!-- Difficulty Selector Tabs -->
        <div class="flex flex-wrap gap-2 p-2 rounded-xl mb-3 shadow-inner justify-center" style="background: var(--color-bg-card); border: 1px solid var(--color-border);">
            ${difficultyTabs}
        </div>
        
        <p class="text-sm text-gray-400 mb-2">Viewing goals and progress for the <strong style="color: var(--color-accent-main);">${currentAdvancementDifficulty}</strong> difficulty level. Achieve the goal and mark it complete to unlock the next difficulty level for this exercise.</p>
        
        <!-- Content for Selected Difficulty -->
        <div id="advancement-tier-content">
            ${content}
        </div>
    `;
}

// Define page order for determining navigation direction
const pageOrder = ['home', 'pushups', 'pullups', 'legs', 'abs', 'kicks', 'advancements', 'bodystats', 'grand-total', 'ranking', 'settings'];

// Helper function to determine navigation direction
function getNavigationDirection(fromPage, toPage) {
  const fromIndex = pageOrder.indexOf(fromPage);
  const toIndex = pageOrder.indexOf(toPage);

  if (fromIndex === -1 || toIndex === -1) return 'forward';

  return toIndex > fromIndex ? 'forward' : 'backward';
}

function changePage(page) {
  console.log(`[NAV] Changing to page: ${page}`);

  // Validate page exists
  if (!routes[page]) {
    console.warn(`[NAV] Page ${page} not found, redirecting to home`);
    page = 'home';
  }

  currentPage = page;

  // Update active navigation item
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');

  // Update URL and browser history
  updateURL(page);

  // Render the page content
  renderUI();
}

function renderTab(section) {
  const el = document.getElementById(section);
  if (!el) return;

  // Ensure logData is not null
  if (!logData) {
    logData = JSON.parse(JSON.stringify(INITIAL_STATE));
  }

  const variationsHTML = Object.entries(logData[section]).map(([variationName, stats]) => {

    const isPlanks = (section === 'abs' && variationName === 'Planks');
    const isUnilateral = (section === 'kicks') || (section === 'legs' && variationName === 'PistolSquat');
    const label = isPlanks ? 'seconds' : 'reps';

    // For unilateral exercises, show separate left/right inputs
    if (isUnilateral) {
      const totalLeft = stats.totalLeft || 0;
      const totalRight = stats.totalRight || 0;
      const maxLeft = stats.maxLeft || 0;
      const maxRight = stats.maxRight || 0;
      const combinedTotal = stats.total || 0;

      // Calculate balance status
      const imbalance = Math.abs(totalLeft - totalRight);
      const combined = totalLeft + totalRight;
      const imbalancePercent = combined > 0 ? Math.round((imbalance / combined) * 100) : 0;

      let balanceIndicator = '';
      if (combined > 30) {
        if (imbalancePercent <= 5) {
          balanceIndicator = '<span class="text-xs text-green-400 ml-2">?? Perfect Balance</span>';
        } else if (imbalancePercent <= 10) {
          balanceIndicator = '<span class="text-xs text-blue-400 ml-2">?? Good Balance</span>';
        } else if (imbalancePercent <= 20) {
          balanceIndicator = '<span class="text-xs text-yellow-400 ml-2">?? Minor Imbalance</span>';
        } else {
          balanceIndicator = '<span class="text-xs text-red-400 ml-2">? Poor Balance</span>';
        }
      }

      return `<div class="card p-2">
        <div class="text-xl font-semibold mb-2 flex items-center" style="color: var(--color-accent-main);">
          ${variationName}
          ${balanceIndicator}
        </div>
        
        <!-- Total Reps Row -->
        <div class="mb-2 p-2 rounded" style="background: rgba(59, 130, 246, 0.1);">
          <div class="text-sm font-bold text-gray-300 mb-1">Total Reps:</div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-xs text-gray-400 block mb-1">Left Leg</label>
              <input 
                type="number" 
                value="${totalLeft}" 
                readonly
                onchange="handleStatUpdate('${section}', '${variationName}', 'totalLeft', this.value)" 
                oninput="handleStatUpdate('${section}', '${variationName}', 'totalLeft', this.value)"
                onclick="this.readOnly=false; this.focus();"
                onblur="this.readOnly=true; handleStatUpdate('${section}', '${variationName}', 'totalLeft', this.value)"
                class="text-white w-full text-center rounded px-2 py-1 editable-stat"
                min="0"
              />
            </div>
            <div>
              <label class="text-xs text-gray-400 block mb-1">Right Leg</label>
              <input 
                type="number" 
                value="${totalRight}" 
                readonly
                onchange="handleStatUpdate('${section}', '${variationName}', 'totalRight', this.value)" 
                oninput="handleStatUpdate('${section}', '${variationName}', 'totalRight', this.value)"
                onclick="this.readOnly=false; this.focus();"
                onblur="this.readOnly=true; handleStatUpdate('${section}', '${variationName}', 'totalRight', this.value)"
                class="text-white w-full text-center rounded px-2 py-1 editable-stat"
                min="0"
              />
            </div>
          </div>
          <div class="text-xs text-gray-400 mt-1 text-center">
            Combined: <span class="text-white font-bold">${combinedTotal}</span>
          </div>
        </div>
      </div>`;
    }

    // Standard bilateral exercises (original code)
    const totalInput = `<input 
        type="number" 
        value="${stats.total}" 
        readonly
        onchange="handleStatUpdate('${section}', '${variationName}', 'total', this.value)" 
        oninput="handleStatUpdate('${section}', '${variationName}', 'total', this.value)"
        onclick="this.readOnly=false; this.focus();"
        onblur="this.readOnly=true; handleStatUpdate('${section}', '${variationName}', 'total', this.value)"
        class="text-white w-24 text-left rounded px-2 py-1 editable-stat"
        min="0"
    />`;

    let maxInputHTML = '';

    // Hide max reps for legs exercises and abs exercises
    if (stats.max !== undefined && section !== 'legs' && section !== 'abs') {
      maxInputHTML = `
            <div class="text-sm text-gray-200 mt-2 flex items-center justify-between">
                <span>Max ${isPlanks ? 'Time (s)' : 'Reps'}:</span>
                <input 
                    type="number" 
                    value="${stats.max}" 
                    readonly
                    onchange="handleStatUpdate('${section}', '${variationName}', 'max', this.value)" 
                    oninput="handleStatUpdate('${section}', '${variationName}', 'max', this.value)"
                    onclick="this.readOnly=false; this.focus();"
                    onblur="this.readOnly=true; handleStatUpdate('${section}', '${variationName}', 'max', this.value)"
                    class="text-white w-24 text-left rounded px-2 py-1 editable-stat"
                    min="0"
                />
            </div>`;
    }

    return `<div class="card p-2">
      <div class="text-xl font-semibold mb-2" style="color: var(--color-accent-main);">${variationName}</div>
      <div class="text-sm text-gray-200 flex items-center justify-between">
          <span>Total ${isPlanks ? 'Time (s)' : 'Reps'}:</span>
          ${totalInput}
      </div>
      ${maxInputHTML}
    </div>`;
  }).join('');

  el.innerHTML = `
    <h2 class="text-2xl font-bold mb-2" style="color: var(--color-accent-main);">${section.toUpperCase()} LOG</h2>
    <p class="text-sm text-gray-400 mb-2">Update your <strong>Total</strong> ${section === 'abs' ? 'reps/time' : 'reps'} directly below. ${section === 'abs' ? '<strong>Note:</strong> Planks are tracked in seconds.' : ''} ${(section === 'kicks' || section === 'legs') ? '<strong>Tip:</strong> Track left and right legs separately for balanced development!' : ''} Changes are saved automatically.</p>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">${variationsHTML}</div>
  `;
}
function renderGrandTotal() {
  const el = document.getElementById('grand-total');
  const total = calculateGrandTotalReps();
  const rank = currentRank(total);
  const isMaxRank = rank.name === "Harbinger of Death";
  const rankTextColor = isMaxRank ? 'text-blood-red' : '';

  const categories = ['pushups', 'pullups', 'legs', 'abs', 'kicks'];
  const categoryTotals = categories.map(section => {
    let sectionTotal = 0;
    // Add null check to prevent "Cannot read properties of null" error
    if (logData && logData[section]) {
      Object.values(logData[section]).forEach(v => { sectionTotal += v.total || 0; });
    }
    return { name: section.charAt(0).toUpperCase() + section.slice(1), total: sectionTotal.toLocaleString(), sectionId: section };
  });

  const exerciseBreakdowns = categories.reduce((exAll, section) => {
    let sectionTotal = 0;
    // Add null check to prevent "Cannot read properties of null" error
    if (logData && logData[section]) {
      Object.values(logData[section]).forEach(v => { sectionTotal += v.total || 0; });
      const entries = Object.entries(logData[section]).map(([vari, obj]) => {
        const reps = obj.total || 0;
        const isPlanks = (section === 'abs' && vari === 'Planks');
        return {
          variation: vari,
          reps,
          unit: isPlanks ? 's' : 'reps',
          pctOfCategory: sectionTotal > 0 ? ((reps / sectionTotal) * 100).toFixed(1) : '0.0',
          pctOfGrand: total > 0 ? ((reps / total) * 100).toFixed(1) : '0.0'
        };
      });
      exAll[section] = { sectionTotal, entries };
    } else {
      exAll[section] = { sectionTotal: 0, entries: [] };
    }
    return exAll;
  }, {});

  // Get user profile data
  // Add null check to prevent "Cannot read properties of null" error
  const { weight, height, age } = (logData && logData.userProfile) || { weight: null, height: null, age: null };

  // Build the HTML content
  let content = `
    <h2 class="text-2xl font-bold mb-4" style="color: var(--color-accent-main);">Combat Overview</h2>

    <!-- Grand Total Reps -->
    <div class="card p-4 mb-2 text-center" style="border-left-color: var(--color-accent-main);">
      <div class="text-xl font-extrabold" style="color: var(--color-accent-main);">Total Reps Logged:</div>
      <div class="text-6xl font-extrabold mt-1 ${rankTextColor}" style="color: ${isMaxRank ? 'var(--color-error)' : 'var(--color-text-primary)'};">${total.toLocaleString()}</div>
      <div class="text-sm text-gray-400 mt-2">Current Rank: <strong class="${rankTextColor}" style="color: ${isMaxRank ? 'var(--color-error)' : 'var(--color-accent-main)'};">${rank.name}</strong></div>
    </div>

    <h3 class="text-xl font-bold mb-2 text-gray-300 flex items-center"><i class="fas fa-chart-simple mr-2"></i> Category Breakdown</h3>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-1" id="category-breakdown">
  `;
  // Add category breakdown
  categoryTotals.forEach(cat => {
    content += `
      <div class="card p-3 border-blue-500/50 hover:opacity-80 cursor-pointer transition duration-150 category-card mb-2" data-section="${cat.sectionId}" style="border-left-color: var(--color-accent-main);">
        <div class="font-semibold text-lg mb-1" style="color: var(--color-accent-main);">${cat.name}</div>
        <div class="text-3xl font-bold text-white mb-1">${cat.total}</div>
        <div class="text-xs text-gray-400 mb-2">${(exerciseBreakdowns[cat.sectionId].sectionTotal / total * 100).toFixed(1)}% of grand total</div>
        <div class="w-full space-y-1">
    `;

    exerciseBreakdowns[cat.sectionId].entries
      .filter(e => e.reps > 0)
      .forEach(e => {
        content += `
          <div class="flex flex-col gap-1 p-1 rounded" style="background: var(--color-bg-primary);">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-gray-200">${e.variation}</span>
              <span class="text-sm font-bold text-white">${e.reps} ${e.unit}</span>
            </div>
            <div class="w-full h-2 bg-gray-700 rounded overflow-hidden">
              <div class="h-2 bg-[var(--color-accent-main)]" style="width:${e.pctOfCategory}%; min-width:2px"></div>
            </div>
            <div class="flex items-center justify-between text-xs">
              <span class="text-green-400">${e.pctOfCategory}% of category</span>
              <span class="text-yellow-400">${e.pctOfGrand}% of total</span>
            </div>
          </div>
        `;
      });

    content += `
        </div>
        <div class="text-xs text-gray-500 mt-1 text-center">Click to view log</div>
      </div>
    `;
  });

  content += `
    </div>
    
  `;

  el.innerHTML = content;

  // Add event listeners for category cards
  setTimeout(() => {
    const categoryCards = document.querySelectorAll('.category-card');
    categoryCards.forEach(card => {
      card.addEventListener('click', () => {
        const section = card.getAttribute('data-section');
        if (section) {
          changePage(section);
        }
      });
    });
  }, 100);
}
// Updated renderChallenge to be reusable inside Home
function renderChallenge(container) {
  // Check if container exists
  if (!container) {
    console.warn('[CHALLENGE] Challenge container not found');
    return;
  }

  const ch = logData.weeklyChallenge.challenge;
  const tagHidden = logData.weeklyChallenge.isComplete ? '' : 'hidden';

  if (!ch) {
    container.innerHTML = `
      <div class="card p-4">
        <div class="text-sm text-gray-400">No active challenge assigned this cycle.</div>
        <div class="text-xs text-gray-500 mt-2">Complete exercises to unlock your first challenge!</div>
      </div>
    `;
    return;
  }

  let progress = 0;
  const currentTotal = logData[ch.type][ch.variation]?.total || 0;
  const challengeBaseline = logData.weeklyChallenge.baseline || 0;
  const challengeProgress = Math.max(0, currentTotal - challengeBaseline);

  if (ch.progressType === 'total') { progress = Math.min(100, Math.floor(challengeProgress / ch.goal * 100)); }
  if (progress >= 100) logData.weeklyChallenge.isComplete = true;

  // Only save data if there's an actual change to the challenge status
  if (logData.weeklyChallenge.isComplete && !logData.weeklyChallenge.completionNotified) {
    saveData();
    logData.weeklyChallenge.completionNotified = true;
  } else if (progress > logData.weeklyChallenge.progress) {
    // Only save if progress has actually increased
    saveData();
  }

  const unit = (ch.type === 'abs' && ch.variation === 'Planks') ? 'seconds' : 'reps';
  const progressText = logData.weeklyChallenge.isComplete ? 'Objective Complete' : `Progress: ${progress}%`;
  const progressBarColor = logData.weeklyChallenge.isComplete ? '#10b981' : 'var(--color-accent-main)'; // Use green if complete
  const displayProgress = challengeProgress;

  container.innerHTML = `
    <div class="p-4 rounded-xl shadow-2xl" style="background: color-mix(in srgb, var(--color-accent-main) 15%, transparent); border: 1px solid var(--color-accent-main);">
        <h3 class="text-xl font-bold mb-3 flex items-center" style="color: var(--color-accent-main);">
            <i class="fas fa-hourglass-start mr-2" style="color: var(--color-accent-main);"></i> Challenge of the Week
            <span class="ml-auto px-3 py-1 text-sm font-bold bg-green-700 rounded-full ${tagHidden}">COMPLETE!</span>
        </h3>
        <div id="challenge-timer-home" class="text-sm font-mono text-yellow-400 mb-3 flex items-center justify-between">
            <span>Time until reset: <strong id="remaining-time-home">Calculating...</strong></span>
            <i class="fas fa-clock"></i>
        </div>
        <div class="text-sm text-gray-200 font-semibold">${ch.name}</div>
        <div class="text-xs text-gray-400 mb-2">${ch.desc} (Goal: ${ch.goal.toLocaleString()} ${unit} | Progress: ${displayProgress.toLocaleString()} / ${ch.goal.toLocaleString()} ${unit})</div>
        <div class="w-full rounded-md overflow-hidden border p-2 mb-2" style="border-color: var(--color-accent-main); background: var(--color-bg-card);">
            <div class="text-sm text-gray-200">${progressText}</div>
            <div class="progress-bar-container mt-2" style="height: 20px; background-color: #374151; border-radius: 0.375rem;">
                <div style="background:${progressBarColor}; width:${Math.max(2, progress)}%; height:100%; transition:width .5s ease-in-out; border-radius: 0.375rem;"></div>
            </div>
        </div>
    </div>
  `;

  // Update the remaining time display in the new container
  renderRemainingTime(document.getElementById('remaining-time-home'));

  // Debug: Log that challenge was rendered
  console.log('[CHALLENGE] Challenge rendered successfully');
}

// Silent version of renderChallenge that doesn't save data or show notifications
function renderChallengeSilently(container) {
  // Check if container exists
  if (!container) {
    console.warn('[CHALLENGE] Challenge container not found');
    return;
  }

  const ch = logData.weeklyChallenge.challenge;
  const tagHidden = logData.weeklyChallenge.isComplete ? '' : 'hidden';

  if (!ch) {
    container.innerHTML = `
      <div class="card p-4">
        <div class="text-sm text-gray-400">No active challenge assigned this cycle.</div>
        <div class="text-xs text-gray-500 mt-2">Complete exercises to unlock your first challenge!</div>
      </div>
    `;
    return;
  }

  let progress = 0;
  const currentTotal = logData[ch.type][ch.variation]?.total || 0;
  const challengeBaseline = logData.weeklyChallenge.baseline || 0;
  const challengeProgress = Math.max(0, currentTotal - challengeBaseline);

  if (ch.progressType === 'total') { progress = Math.min(100, Math.floor(challengeProgress / ch.goal * 100)); }
  if (progress >= 100) logData.weeklyChallenge.isComplete = true;

  // Don't save data in the silent version to avoid notifications
  // Just update the progress in memory without persisting changes

  const unit = (ch.type === 'abs' && ch.variation === 'Planks') ? 'seconds' : 'reps';
  const progressText = logData.weeklyChallenge.isComplete ? 'Objective Complete' : `Progress: ${progress}%`;
  const progressBarColor = logData.weeklyChallenge.isComplete ? '#10b981' : 'var(--color-accent-main)'; // Use green if complete
  const displayProgress = challengeProgress;

  container.innerHTML = `
    <div class="p-4 rounded-xl shadow-2xl" style="background: color-mix(in srgb, var(--color-accent-main) 15%, transparent); border: 1px solid var(--color-accent-main);">
        <h3 class="text-xl font-bold mb-3 flex items-center" style="color: var(--color-accent-main);">
            <i class="fas fa-hourglass-start mr-2" style="color: var(--color-accent-main);"></i> Challenge of the Week
            <span class="ml-auto px-3 py-1 text-sm font-bold bg-green-700 rounded-full ${tagHidden}">COMPLETE!</span>
        </h3>
        <div id="challenge-timer-home" class="text-sm font-mono text-yellow-400 mb-3 flex items-center justify-between">
            <span>Time until reset: <strong id="remaining-time-home">Calculating...</strong></span>
            <i class="fas fa-clock"></i>
        </div>
        <div class="text-sm text-gray-200 font-semibold">${ch.name}</div>
        <div class="text-xs text-gray-400 mb-2">${ch.desc} (Goal: ${ch.goal.toLocaleString()} ${unit} | Progress: ${displayProgress.toLocaleString()} / ${ch.goal.toLocaleString()} ${unit})</div>
        <div class="w-full rounded-md overflow-hidden border p-2 mb-2" style="border-color: var(--color-accent-main); background: var(--color-bg-card);">
            <div class="text-sm text-gray-200">${progressText}</div>
            <div class="progress-bar-container mt-2" style="height: 20px; background-color: #374151; border-radius: 0.375rem;">
                <div style="background:${progressBarColor}; width:${Math.max(2, progress)}%; height:100%; transition:width .5s ease-in-out; border-radius: 0.375rem;"></div>
            </div>
        </div>
    </div>
  `;

  // Update the remaining time display in the new container
  renderRemainingTime(document.getElementById('remaining-time-home'));

  // Debug: Log that challenge was rendered silently
  console.log('[CHALLENGE] Challenge rendered silently');
}
// Updated renderRemainingTime to take an optional element
function renderRemainingTime(el) {
  const timerElement = el || document.getElementById('remaining-time');
  if (!timerElement) return;

  const now = new Date();
  const daysUntilSunday = (0 - now.getDay() + 7) % 7;
  let nextSunday = new Date(now.getTime());
  nextSunday.setDate(now.getDate() + daysUntilSunday);

  nextSunday.setHours(0, 0, 0, 0);

  // If it's Sunday and after midnight, challenge resets next Sunday
  if (daysUntilSunday === 0 && now.getHours() >= 0) {
    nextSunday.setDate(now.getDate() + 7);
  }

  const remainingMs = Math.max(0, nextSunday.getTime() - now.getTime());
  timerElement.textContent = msToTime(remainingMs);
}
function renderHome() {
  const el = document.getElementById('home');
  if (!el) return;

  // Ensure logData is not null
  if (!logData) {
    logData = JSON.parse(JSON.stringify(INITIAL_STATE));
  }

  // Check if we're on a mobile device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  console.log('[HOME] Is mobile device:', isMobile);

  const total = calculateGrandTotalReps();
  const xp = logData.xp || 0;
  const bodyStat = getBodyConditionSummary(calculateBodyStats()).overall || 0;
  const rank = currentRank(total, xp, bodyStat);
  const isMaxRank = rank.name === "Harbinger of Death";
  const rankTextColor = isMaxRank ? 'text-blood-red' : '';

  el.innerHTML = `
        <!-- Challenge Section -->
        <h3 class="text-xl font-bold mb-2 flex items-center" style="color: var(--color-accent-main);"><i class="fas fa-target mr-2"></i> Current Assignment Status</h3>
        <div id="home-challenge-container"></div>
        
        <h2 class="text-2xl font-bold mb-3 flex items-center" style="color: var(--color-accent-main);"><i class="fas fa-chart-line mr-2"></i> Command Center</h2>
        
        <!-- Grand Total Reps - Clickable to Total Tab -->
        <div class="card p-3 mb-2 cursor-pointer hover:opacity-80 transition" 
             style="border-left-color: var(--color-accent-main);" 
             onclick="changePage('grand-total')">
            <div class="text-xs text-gray-400 flex items-center">
                <span>Grand Total Reps</span>
                <i class="fas fa-external-link-alt ml-2 text-xs"></i>
            </div>
            <div class="text-2xl font-bold ${rankTextColor}">${total.toLocaleString()}</div>
            <div class="text-xs text-gray-500 mt-1">Click to view breakdown</div>
        </div>

        <!-- XP Card -->
        <div class="card p-3 mb-2" style="border-left-color: #f59e0b;">
            <div class="text-xs text-gray-400">Total Experience Points</div>
            <div class="text-2xl font-bold text-yellow-400 mt-1">? ${xp.toLocaleString()} XP</div>
            <div class="text-sm text-gray-400 mt-1">Complete advancements to earn more XP!</div>
        </div>

        <!-- Body Condition Card - Clickable to Stats Tab -->
        <div class="card p-3 mb-2 cursor-pointer hover:opacity-80 transition" 
             style="border-left-color: #8b5cf6;" 
             onclick="changePage('bodystats')">
            <div class="text-xs text-gray-400 flex items-center">
                <span>Overall Body Condition</span>
                <i class="fas fa-external-link-alt ml-2 text-xs"></i>
            </div>
            <div class="text-2xl font-bold text-purple-400 mt-1">?? ${bodyStat}/100</div>
            <div class="text-xs text-gray-500 mt-1">Click to view detailed stats</div>
        </div>

        <!-- Advancements Summary - Clickable to Advancements Tab -->
        <div class="card p-3 mb-2 cursor-pointer hover:opacity-80 transition" 
             style="border-left-color: #10b981;" 
             onclick="changePage('advancements')">
            <div class="text-xs text-gray-400 flex items-center">
                <span>Advancements Progress</span>
                <i class="fas fa-external-link-alt ml-2 text-xs"></i>
            </div>
            <div class="text-2xl font-bold text-green-400 mt-1">${calculateCompletedAdvancements().toLocaleString()} / 138</div>
            <div class="text-xs text-gray-500 mt-1">Click to view advancement tiers</div>
        </div>
    `;

  // Render the challenge into its container using the silent version to avoid notifications
  setTimeout(() => {
    const challengeContainer = document.getElementById('home-challenge-container');
    if (challengeContainer) {
      renderChallengeSilently(challengeContainer);
    }
  }, 100);

  // Debug: Log that home page was rendered
  console.log('[HOME] Home page rendered successfully');

  ;
}


function getPreviousDifficulty(currentDifficultyId) {
  const difficultyIds = ['Beginner', 'Easy', 'Medium', 'Hard', 'Insane'];
  const index = difficultyIds.findIndex(d => d === currentDifficultyId);
  return index > 0 ? difficultyIds[index - 1] : null;
}

// Helper function to check if an exercise is unilateral (tracks left/right separately)
function isUnilateralExercise(section, variation) {
  if (section === 'legs' && variation === 'PistolSquat') return true;
  if (section === 'kicks') return true;
  return false;
}

// Helper function to get balanced total for unilateral exercises
function getBalancedTotal(section, variation) {
  // Ensure logData is not null
  if (!logData) {
    logData = JSON.parse(JSON.stringify(INITIAL_STATE));
  }

  const exercise = logData[section][variation];
  if (!isUnilateralExercise(section, variation)) {
    return exercise.total || 0;
  }
  const leftTotal = exercise.totalLeft || 0;
  const rightTotal = exercise.totalRight || 0;
  return Math.min(leftTotal, rightTotal) * 2;
}

// Helper function to get balance status
function getBalanceStatus(section, variation) {
  // Ensure logData is not null
  if (!logData) {
    logData = JSON.parse(JSON.stringify(INITIAL_STATE));
  }

  if (!isUnilateralExercise(section, variation)) {
    return { balanced: true, imbalance: 0, imbalancePercent: 0 };
  }
  const exercise = logData[section][variation];
  const leftTotal = exercise.totalLeft || 0;
  const rightTotal = exercise.totalRight || 0;
  const combined = leftTotal + rightTotal;
  const imbalance = Math.abs(leftTotal - rightTotal);
  const imbalancePercent = combined > 0 ? Math.round((imbalance / combined) * 100) : 0;
  return {
    balanced: imbalancePercent <= 10,
    imbalance,
    imbalancePercent
  };
}
// NEW: Get available reps AFTER subtracting all previously claimed difficulty requirements
function getRepsForCurrentDifficulty(section, variation, currentDifficultyId) {
  // Check if this advancement is unlocked
  if (!isVariationDifficultyUnlocked(section, variation, currentDifficultyId)) {
    // If advancement is locked, return 0 progress
    return 0;
  }

  // Ensure logData is not null
  if (!logData) {
    logData = JSON.parse(JSON.stringify(INITIAL_STATE));
  }

  // Use balanced total for unilateral exercises (minimum of left/right * 2)
  let currentTotal;
  if (isUnilateralExercise(section, variation)) {
    currentTotal = getBalancedTotal(section, variation);
  } else {
    currentTotal = logData[section][variation].total || 0;
  }

  const difficultyIds = ['Beginner', 'Easy', 'Medium', 'Hard', 'Insane'];
  const currentIndex = difficultyIds.findIndex(d => d === currentDifficultyId);

  // Calculate total reps "consumed" by all COMPLETED previous difficulties
  let consumedReps = 0;

  for (let i = 0; i < currentIndex; i++) {
    const previousDifficultyId = difficultyIds[i];
    const previousKey = `${section}-${variation}-${previousDifficultyId}`;

    // If this previous difficulty was completed, subtract its requirement
    if (completedDifficulties[previousKey] === true) {
      const previousTiers = TIERS[section][variation][previousDifficultyId];
      if (previousTiers && previousTiers.length > 0) {
        consumedReps += previousTiers[0].goal;
      }
    }
  }

  // Available reps = Total reps - Reps consumed by completed difficulties
  const availableReps = Math.max(0, currentTotal - consumedReps);

  console.log(`[ADVANCEMENT PROGRESS] ${section}-${variation}-${currentDifficultyId}: Total=${currentTotal}, Consumed=${consumedReps}, Available=${availableReps}`);

  return availableReps;
}
// MODIFIED: Simplified to check if the immediate preceding difficulty for the same variation is completed.
function isVariationDifficultyUnlocked(section, variation, difficultyId) {
  const difficultyIds = ['Beginner', 'Easy', 'Medium', 'Hard', 'Insane'];
  const index = difficultyIds.findIndex(d => d === difficultyId);

  // 1. Beginner is always unlocked (index 0)
  if (index === 0) return true;

  // 2. Check if the previous difficulty for this specific variation is completed.
  const prevDifficultyId = difficultyIds[index - 1];
  if (prevDifficultyId) {
    const prevKey = `${section}-${variation}-${prevDifficultyId}`;
    const isUnlocked = completedDifficulties[prevKey] === true;
    console.log(`[UNLOCK CHECK] ${section}-${variation}-${difficultyId}: previous (${prevKey}) completed? ${isUnlocked}`);
    return isUnlocked;
  }

  return false; // Should not happen for valid IDs > 0
}
async function handleMarkComplete(section, variation, currentDifficultyId) {
  if (!isVariationDifficultyUnlocked(section, variation, currentDifficultyId)) {
    const prevDifficultyId = getPreviousDifficulty(currentDifficultyId);
    showModalMessage("ACCESS DENIED", `The command is locked. You must first complete the **${prevDifficultyId}** difficulty for **${variation}** before validating this one.`);
    return;
  }

  // Ensure logData is not null
  if (!logData) {
    logData = JSON.parse(JSON.stringify(INITIAL_STATE));
  }

  // Check if the goal is actually met (using available reps for THIS difficulty level)
  const tiers = TIERS[section][variation][currentDifficultyId];
  const availableReps = getRepsForCurrentDifficulty(section, variation, currentDifficultyId);
  const currentTotal = logData[section][variation].total || 0;

  if (tiers.length === 0 || availableReps < tiers[0].goal) {
    const needed = tiers[0].goal - availableReps;
    showModalMessage("OBJECTIVE NOT MET", `You need ${needed.toLocaleString()} more reps/s for ${variation} at ${currentDifficultyId} difficulty. Current progress: ${availableReps.toLocaleString()} / ${tiers[0].goal.toLocaleString()}`);
    return;
  }

  // Using the hyphenated key for consistency
  const currentKey = `${section}-${variation}-${currentDifficultyId}`;

  // Check if already completed
  if (completedDifficulties[currentKey] === true) {
    showModalMessage("ALREADY COMPLETED", `You have already completed ${variation} at ${currentDifficultyId} difficulty.`);
    return;
  }

  completedDifficulties[currentKey] = true;

  // Calculate XP reward based on exercise type, reps completed, and difficulty
  let baseXPPerRep = 1; // Default base XP
  if (BASE_XP[section] && BASE_XP[section][variation]) {
    baseXPPerRep = BASE_XP[section][variation];
  }

  // Apply difficulty multiplier
  const difficultyMultiplier = DIFFICULTY_MULTIPLIER[currentDifficultyId] || 1;

  // Calculate XP based on the goal requirement (not actual reps)
  const xpReward = Math.round(tiers[0].goal * baseXPPerRep * difficultyMultiplier);

  logData.xp = (logData.xp || 0) + xpReward;

  console.log(`[ADVANCEMENT] Marked ${currentKey} as complete. Awarded ${xpReward} XP. Total XP: ${logData.xp}`);
  saveData();
  saveAdvancements();
  saveAdvancementBaselines(); // Keep for backward compatibility

  // Get next difficulty info
  const difficultyIds = ['Beginner', 'Easy', 'Medium', 'Hard', 'Insane'];
  const currentIndex = difficultyIds.findIndex(d => d === currentDifficultyId);
  const nextDifficultyId = currentIndex < difficultyIds.length - 1 ? difficultyIds[currentIndex + 1] : null;

  // Calculate remaining reps after this completion
  const consumedByThis = tiers[0].goal;
  const remainingReps = Math.max(0, availableReps - consumedByThis);

  let message = `Congrats! <strong>${currentDifficultyId}</strong> difficulty for <strong>${variation}</strong> is completed!<br><br>? <strong>+${xpReward} XP</strong> earned! (Total: ${logData.xp.toLocaleString()} XP)`;
  if (nextDifficultyId) {
    message += `<br><br>?? <strong>${nextDifficultyId}</strong> difficulty for <strong>${variation}</strong> is now unlocked!<br><small class="text-gray-400">Remaining reps available: ${remainingReps.toLocaleString()}</small>`;
  } else {
    message += `<br><br>?? You've mastered all difficulties for <strong>${variation}</strong>!`;
  }

  // Show toast notification for quick feedback
  showAdvancementToast(variation, currentDifficultyId, xpReward);

  showModalMessage("?? CONGRATULATIONS!", message);
  renderUI();
}


// MODIFIED: Once completed, advancements remain completed forever (one-time XP reward)
function updateAdvancementProgress(section, variation) {
  if (!TIERS[section] || !TIERS[section][variation]) {
    return;
  }

  const tiersForVariation = TIERS[section][variation];

  // Check each difficulty level
  for (const difficulty in tiersForVariation) {
    const tiers = tiersForVariation[difficulty];
    if (!tiers || tiers.length === 0) continue;

    const completionKey = `${section}-${variation}-${difficulty}`;
    const requiredGoal = tiers[0].goal; // Only check the single remaining goal

    // Get progress for THIS difficulty level
    const currentProgress = getRepsForCurrentDifficulty(section, variation, difficulty);

    // Once an advancement is completed, it stays completed forever
    // This ensures XP is awarded only ONCE, regardless of future rep changes
    // Users cannot lose progress or re-earn XP by manipulating rep counts
  }
}
function renderBodyStats() {
  const el = document.getElementById('bodystats');
  if (!el) return;

  const stats = calculateBodyStats();
  const summary = getBodyConditionSummary(stats);

  // Helper function for stat bar color
  const getStatColor = (value) => {
    if (value >= 90) return '#10b981'; // Green
    if (value >= 75) return '#3b82f6'; // Blue
    if (value >= 60) return '#f59e0b'; // Yellow
    if (value >= 40) return '#f97316'; // Orange
    return '#ef4444'; // Red
  };

  // Helper function for stat rating
  const getStatRating = (value) => {
    if (value >= 90) return 'Elite';
    if (value >= 75) return 'Advanced';
    if (value >= 60) return 'Intermediate';
    if (value >= 40) return 'Developing';
    return 'Beginner';
  };

  el.innerHTML = `
        <h2 class="text-2xl font-bold mb-2 flex items-center" style="color: var(--color-accent-main);">
            <i class="fas fa-heart-pulse mr-2"></i> Body Stats Analysis
        </h2>

        <!-- Overall Condition Card -->
        <div class="card p-4 mb-3 text-center" style="border-left-color: ${getStatColor(summary.overall)};">
            <div class="text-xl font-extrabold" style="color: var(--color-accent-main);">Overall Body Condition</div>
            <div class="text-5xl font-extrabold mt-3 mb-2" style="color: ${getStatColor(summary.overall)};">${summary.overall}/100</div>
            <div class="text-2xl font-bold mb-3" style="color: ${getStatColor(summary.overall)};">${summary.condition}</div>
            <div class="text-sm text-gray-300 mb-4">${summary.description}</div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <div class="text-sm">
                    <span class="text-gray-400">Strongest:</span>
                    <span class="font-bold text-green-400 ml-2">${summary.strongest}</span>
                </div>
                <div class="text-sm">
                    <span class="text-gray-400">Needs Work:</span>
                    <span class="font-bold text-yellow-400 ml-2">${summary.weakest}</span>
                </div>
            </div>
        </div>

        <!-- Individual Stats -->
        <h3 class="text-xl font-bold mb-2 text-gray-300 flex items-center">
            <i class="fas fa-chart-bar mr-2"></i> Detailed Breakdown
        </h3>
        <div class="grid grid-cols-1 gap-2">
            <!-- Raw Strength -->
            <div class="card p-4 cursor-pointer hover:opacity-80 transition" 
                 style="border-left-color: ${getStatColor(stats.rawStrength)};" 
                 onclick="showStatRecommendations('Raw Strength', ${stats.rawStrength})">
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                        <i class="fas fa-dumbbell text-xl" style="color: ${getStatColor(stats.rawStrength)};"></i>
                        <span class="text-lg font-bold">Raw Strength</span>
                        <i class="fas fa-info-circle text-xs text-gray-500 ml-1"></i>
                    </div>
                    <div class="text-right">
                        <div class="text-2xl font-bold" style="color: ${getStatColor(stats.rawStrength)};">${stats.rawStrength}</div>
                        <div class="text-xs text-gray-400">${getStatRating(stats.rawStrength)}</div>
                    </div>
                </div>
                <div class="progress-bar-container h-3 rounded-full mb-2">
                    <div class="h-3 rounded-full stat-bar-animated" style="width: ${stats.rawStrength}%; background: ${getStatColor(stats.rawStrength)}; min-width: 2%;"></div>
                </div>
                <div class="text-xs text-gray-400">Maximum force output and compound lift capability</div>
            </div>

            <!-- Muscular Endurance -->
            <div class="card p-4 cursor-pointer hover:opacity-80 transition" 
                 style="border-left-color: ${getStatColor(stats.muscularEndurance)};" 
                 onclick="showStatRecommendations('Muscular Endurance', ${stats.muscularEndurance})">
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                        <i class="fas fa-running text-xl" style="color: ${getStatColor(stats.muscularEndurance)};"></i>
                        <span class="text-lg font-bold">Muscular Endurance</span>
                        <i class="fas fa-info-circle text-xs text-gray-500 ml-1"></i>
                    </div>
                    <div class="text-right">
                        <div class="text-2xl font-bold" style="color: ${getStatColor(stats.muscularEndurance)};">${stats.muscularEndurance}</div>
                        <div class="text-xs text-gray-400">${getStatRating(stats.muscularEndurance)}</div>
                    </div>
                </div>
                <div class="progress-bar-container h-3 rounded-full mb-2">
                    <div class="h-3 rounded-full stat-bar-animated" style="width: ${stats.muscularEndurance}%; background: ${getStatColor(stats.muscularEndurance)}; min-width: 2%;"></div>
                </div>
                <div class="text-xs text-gray-400">Sustained performance and high-volume capacity</div>
            </div>

            <!-- Explosive Power -->
            <div class="card p-4 cursor-pointer hover:opacity-80 transition" 
                 style="border-left-color: ${getStatColor(stats.explosivePower)};" 
                 onclick="showStatRecommendations('Explosive Power', ${stats.explosivePower})">
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                        <i class="fas fa-bolt text-xl" style="color: ${getStatColor(stats.explosivePower)};"></i>
                        <span class="text-lg font-bold">Explosive Power</span>
                        <i class="fas fa-info-circle text-xs text-gray-500 ml-1"></i>
                    </div>
                    <div class="text-right">
                        <div class="text-2xl font-bold" style="color: ${getStatColor(stats.explosivePower)};">${stats.explosivePower}</div>
                        <div class="text-xs text-gray-400">${getStatRating(stats.explosivePower)}</div>
                    </div>
                </div>
                <div class="progress-bar-container h-3 rounded-full mb-2">
                    <div class="h-3 rounded-full stat-bar-animated" style="width: ${stats.explosivePower}%; background: ${getStatColor(stats.explosivePower)}; min-width: 2%;"></div>
                </div>
                <div class="text-xs text-gray-400">Speed, rapid force generation, and dynamic movements</div>
            </div>

            <!-- Muscular Control -->
            <div class="card p-4 cursor-pointer hover:opacity-80 transition" 
                 style="border-left-color: ${getStatColor(stats.muscularControl)};" 
                 onclick="showStatRecommendations('Muscular Control', ${stats.muscularControl})">
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                        <i class="fas fa-crosshairs text-xl" style="color: ${getStatColor(stats.muscularControl)};"></i>
                        <span class="text-lg font-bold">Muscular Control</span>
                        <i class="fas fa-info-circle text-xs text-gray-500 ml-1"></i>
                    </div>
                    <div class="text-right">
                        <div class="text-2xl font-bold" style="color: ${getStatColor(stats.muscularControl)};">${stats.muscularControl}</div>
                        <div class="text-xs text-gray-400">${getStatRating(stats.muscularControl)}</div>
                    </div>
                </div>
                <div class="progress-bar-container h-3 rounded-full mb-2">
                    <div class="h-3 rounded-full stat-bar-animated" style="width: ${stats.muscularControl}%; background: ${getStatColor(stats.muscularControl)}; min-width: 2%;"></div>
                </div>
                <div class="text-xs text-gray-400">Coordination, balance, and movement precision</div>
            </div>

            <!-- Recovery Management -->
            <div class="card p-4 cursor-pointer hover:opacity-80 transition" 
                 style="border-left-color: ${getStatColor(stats.recoveryManagement)};" 
                 onclick="showStatRecommendations('Recovery Management', ${stats.recoveryManagement})">
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                        <i class="fas fa-heart text-xl" style="color: ${getStatColor(stats.recoveryManagement)};"></i>
                        <span class="text-lg font-bold">Recovery Management</span>
                        <i class="fas fa-info-circle text-xs text-gray-500 ml-1"></i>
                    </div>
                    <div class="text-right">
                        <div class="text-2xl font-bold" style="color: ${getStatColor(stats.recoveryManagement)};">${stats.recoveryManagement}</div>
                        <div class="text-xs text-gray-400">${getStatRating(stats.recoveryManagement)}</div>
                    </div>
                </div>
                <div class="progress-bar-container h-3 rounded-full mb-2">
                    <div class="h-3 rounded-full stat-bar-animated" style="width: ${stats.recoveryManagement}%; background: ${getStatColor(stats.recoveryManagement)}; min-width: 2%;"></div>
                </div>
                <div class="text-xs text-gray-400">Adaptation rate, volume tolerance, and injury prevention</div>
            </div>

            <!-- Mental Resilience -->
            <div class="card p-4 cursor-pointer hover:opacity-80 transition" 
                 style="border-left-color: ${getStatColor(stats.mentalResilience)};" 
                 onclick="showStatRecommendations('Mental Resilience', ${stats.mentalResilience})">
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                        <i class="fas fa-brain text-xl" style="color: ${getStatColor(stats.mentalResilience)};"></i>
                        <span class="text-lg font-bold">Mental Resilience</span>
                        <i class="fas fa-info-circle text-xs text-gray-500 ml-1"></i>
                    </div>
                    <div class="text-right">
                        <div class="text-2xl font-bold" style="color: ${getStatColor(stats.mentalResilience)};">${stats.mentalResilience}</div>
                        <div class="text-xs text-gray-400">${getStatRating(stats.mentalResilience)}</div>
                    </div>
                </div>
                <div class="progress-bar-container h-3 rounded-full mb-2">
                    <div class="h-3 rounded-full stat-bar-animated" style="width: ${stats.mentalResilience}%; background: ${getStatColor(stats.mentalResilience)}; min-width: 2%;"></div>
                </div>
                <div class="text-xs text-gray-400">Consistency, dedication, and mental fortitude</div>
            </div>
            <!-- Agility -->
            <div class="card p-4 cursor-pointer hover:opacity-80 transition" 
                 style="border-left-color: ${getStatColor(stats.agility)};" 
                 onclick="showStatRecommendations('Agility', ${stats.agility})">
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                        <i class="fas fa-person-running text-xl" style="color: ${getStatColor(stats.agility)};"></i>
                        <span class="text-lg font-bold">Agility</span>
                        <i class="fas fa-info-circle text-xs text-gray-500 ml-1"></i>
                    </div>
                    <div class="text-right">
                        <div class="text-2xl font-bold" style="color: ${getStatColor(stats.agility)};">${stats.agility}</div>
                        <div class="text-xs text-gray-400">${getStatRating(stats.agility)}</div>
                    </div>
                </div>
                <div class="progress-bar-container h-3 rounded-full mb-2">
                    <div class="h-3 rounded-full stat-bar-animated" style="width: ${stats.agility}%; background: ${getStatColor(stats.agility)}; min-width: 2%;"></div>
                </div>
                <div class="text-xs text-gray-400">Quick direction changes, coordination, and body control</div>
            </div>

            <!-- Speed -->
            <div class="card p-4 cursor-pointer hover:opacity-80 transition" 
                 style="border-left-color: ${getStatColor(stats.speed)};" 
                 onclick="showStatRecommendations('Speed', ${stats.speed})">
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                        <i class="fas fa-gauge-high text-xl" style="color: ${getStatColor(stats.speed)};"></i>
                        <span class="text-lg font-bold">Speed</span>
                        <i class="fas fa-info-circle text-xs text-gray-500 ml-1"></i>
                    </div>
                    <div class="text-right">
                        <div class="text-2xl font-bold" style="color: ${getStatColor(stats.speed)};">${stats.speed}</div>
                        <div class="text-xs text-gray-400">${getStatRating(stats.speed)}</div>
                    </div>
                </div>
                <div class="progress-bar-container h-3 rounded-full mb-2">
                    <div class="h-3 rounded-full stat-bar-animated" style="width: ${stats.speed}%; background: ${getStatColor(stats.speed)}; min-width: 2%;"></div>
                </div>
                <div class="text-xs text-gray-400">Fast-twitch muscle activation and movement velocity</div>
            </div>

            <!-- Attack Potency -->
            <div class="card p-4 cursor-pointer hover:opacity-80 transition" 
                 style="border-left-color: ${getStatColor(stats.attackPotency)};" 
                 onclick="showStatRecommendations('Attack Potency', ${stats.attackPotency})">
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                        <i class="fas fa-person-military-pointing text-xl" style="color: ${getStatColor(stats.attackPotency)};"></i>
                        <span class="text-lg font-bold">Attack Potency</span>
                        <i class="fas fa-info-circle text-xs text-gray-500 ml-1"></i>
                    </div>
                    <div class="text-right">
                        <div class="text-2xl font-bold" style="color: ${getStatColor(stats.attackPotency)};">${stats.attackPotency}</div>
                        <div class="text-xs text-gray-400">${getStatRating(stats.attackPotency)}</div>
                    </div>
                </div>
                <div class="progress-bar-container h-3 rounded-full mb-2">
                    <div class="h-3 rounded-full stat-bar-animated" style="width: ${stats.attackPotency}%; background: ${getStatColor(stats.attackPotency)}; min-width: 2%;"></div>
                </div>
                <div class="text-xs text-gray-400">Kick technique, accuracy, balance, and form precision</div>
            </div>
        </div>
        <!-- Quick Stats Summary -->
        <div class="card p-4 mt-6" style="border-left-color: var(--color-accent-main);">
            <h4 class="text-lg font-bold mb-3" style="color: var(--color-accent-main);">Quick Summary</h4>
            <div class="text-sm text-gray-300 leading-relaxed">
                <strong>Strength: ${stats.rawStrength}</strong> / 
                <strong>Endurance: ${stats.muscularEndurance}</strong> / 
                <strong>Explosive: ${stats.explosivePower}</strong> / 
                <strong>Control: ${stats.muscularControl}</strong> / 
                <strong>Recovery: ${stats.recoveryManagement}</strong> / 
                <strong>Mental: ${stats.mentalResilience}</strong> / 
                <strong>Agility: ${stats.agility}</strong> / 
                <strong>Speed: ${stats.speed}</strong> / 
                <strong>Attack: ${stats.attackPotency}</strong>
            </div>
        </div>

    </div>`;
}

function renderRanking() {
  const el = document.getElementById('ranking');
  const total = calculateGrandTotalReps();
  // Add null check to prevent "Cannot read properties of null" error
  const xp = (logData && logData.xp) || 0;
  const bodyStat = getBodyConditionSummary(calculateBodyStats()).overall || 0;
  const rank = currentRank(total, xp, bodyStat);

  const tableRows = RANKS.map((r) => {
    const isCurrent = r.name === rank.name;
    const isMaxRank = r.name === "Harbinger of Death";
    const rowClass = isCurrent ? 'current-rank' : 'bg-gray-800 hover:opacity-90';

    // Check all three requirements
    const repsReqMet = total >= r.req;
    const xpReqMet = xp >= r.xpReq;
    const bodyReqMet = bodyStat >= r.bodyStatReq;
    const allReqsMet = repsReqMet && xpReqMet && bodyReqMet;

    // Check if this rank has been completed (user has achieved a higher rank)
    const currentRankIndex = RANKS.findIndex(r => r.name === rank.name);
    const thisRankIndex = RANKS.findIndex(r => r.name === r.name);
    const isCompleted = !isCurrent && allReqsMet && thisRankIndex < currentRankIndex;

    const statusIcon = isCurrent
      ? `<i class="fas fa-arrow-right mr-2" style="color: var(--color-text-primary);"></i> Current`
      : (isCompleted
        ? '<i class="fas fa-trophy text-yellow-500 mr-2"></i> Completed'
        : (allReqsMet
          ? '<i class="fas fa-check-circle text-green-500 mr-2"></i> Unlocked'
          : '<i class="fas fa-lock text-red-500 mr-2"></i> Locked'));

    const nameClass = isMaxRank ? 'text-blood-red font-extrabold' : 'font-semibold';

    // Determine text color based on theme for better visibility
    // For current rank, use theme-appropriate text color instead of always white
    let textColorStyle = '';
    if (isCurrent) {
      // Use theme's primary text color for better visibility
      textColorStyle = 'color: var(--color-text-primary) !important;';
    }

    return `
          <tr class="${rowClass}" style="background: ${isCurrent ? 'var(--color-accent-main)' : 'var(--color-bg-card)'};">
              <td class="text-lg ${nameClass}" style="${textColorStyle}">${r.name}</td>
              <td class="text-sm font-mono" style="${textColorStyle}">${r.req.toLocaleString()}</td>
              <td class="text-sm font-mono" style="${textColorStyle}">${r.xpReq.toLocaleString()}</td>
              <td class="text-sm font-mono" style="${textColorStyle}">${r.bodyStatReq}</td>
              <td class="text-sm hidden sm:table-cell" style="${textColorStyle}">${statusIcon}</td>
          </tr>
      `;
  }).join('');

  const isMaxRank = rank.name === "Harbinger of Death";
  const rankTextColor = isMaxRank ? 'text-blood-red' : '';
  el.innerHTML = `
    <h2 class="text-2xl font-bold mb-4 flex items-center" style="color: var(--color-accent-main);"><i class="fas fa-chart-line mr-2"></i> Global Ranking System</h2>
    
    <!-- Current Rank Status Card -->
    <div class="card p-6 mb-6 text-center" style="border-left-color: var(--color-accent-main);">
      <div class="text-xl font-extrabold" style="color: var(--color-accent-main);">Your Stats:</div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
        <div>
          <div class="text-xs text-gray-400">Total Reps</div>
          <div class="text-2xl font-bold ${rankTextColor}" style="color: ${isMaxRank ? 'var(--color-error)' : 'var(--color-text-primary)'};">${total.toLocaleString()}</div>
        </div>
        <div>
          <div class="text-xs text-gray-400">Total XP</div>
          <div class="text-2xl font-bold text-yellow-400">? ${xp.toLocaleString()}</div>
        </div>
        <div>
          <div class="text-xs text-gray-400">Body Condition</div>
          <div class="text-2xl font-bold text-purple-400">?? ${bodyStat}/100</div>
        </div>
      </div>
      <div class="text-lg text-gray-400 mt-4">Current Rank: 
          <strong class="${rankTextColor}" style="color: ${isMaxRank ? 'var(--color-error)' : 'var(--color-accent-main)'};">${rank.name}</strong>
      </div>
    </div>

    <!-- Rank Requirements Table -->
    <h3 class="text-xl font-bold mb-3 text-gray-300 flex items-center"><i class="fas fa-list-ol mr-2"></i> Requirement Tiers</h3>
    <p class="text-sm text-gray-400 mb-3">?? All three requirements must be met to unlock each rank!</p>
    <div class="overflow-x-auto rounded-lg shadow-xl border" style="border-color: var(--color-border);">
        <table class="w-full text-left rank-table">
            <thead>
                <tr>
                    <th>Rank Name</th>
                    <th>Reps</th>
                    <th>XP</th>
                    <th>Body</th>
                    <th class="hidden sm:table-cell">Status</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
    </div>
  </div>`;
}

function renderSettings() {
  const el = document.getElementById('settings');
  if (!el) return;

  // Get current user info
  const user = auth ? auth.currentUser : null;

  // Ensure settings is not null
  if (!settings) {
    settings = INITIAL_SETTINGS;
  }

  // Theme options - use consistent text colors that work on all backgrounds
  const themeOptions = Object.entries(THEMES).map(([key, theme]) => `
    <div class="flex items-center p-3 rounded-lg cursor-pointer hover:opacity-80 transition ${settings.theme === key ? 'bg-blue-900/30 border border-blue-500' : 'bg-gray-800'} theme-option" 
         onclick="changeTheme('${key}')">
      <div class="w-4 h-4 rounded-full mr-3 border border-gray-400" style="background: ${key === 'Dark' ? '#0f172a' : key === 'Grave' ? '#000000' : '#ffffff'};"></div>
      <div class="font-medium" style="color: #f1f5f9;">${theme.label}</div>
      ${settings.theme === key ? '<i class="fas fa-check text-green-500 ml-auto"></i>' : ''}
    </div>
  `).join('');

  // Standard accent color options
  const accentOptions = Object.keys(ACCENT_COLORS).map(color => {
    // Skip white accent for light theme
    if (color === 'White' && settings.theme === 'Light') return '';

    // Special handling for Custom accent
    if (color === 'Custom') {
      const customColor = settings.customAccent ? settings.customAccent.primary : ACCENT_COLORS.Custom.primary;
      return `
        <div class="flex flex-col items-center p-2 rounded-lg cursor-pointer hover:opacity-80 transition ${settings.accent === color && !settings.rgbAnimation ? 'bg-blue-900/30 border border-blue-500' : 'bg-gray-800'} accent-option" 
             onclick="changeAccent('${color}')">
          <div class="w-8 h-8 rounded-full mb-2 border-2 border-gray-400" style="background: ${customColor};"></div>
          <div class="text-xs" style="color: #f1f5f9;">Custom</div>
          ${settings.accent === color && !settings.rgbAnimation ? '<i class="fas fa-check text-green-500 text-xs"></i>' : ''}
        </div>
      `;
    }

    const colorData = ACCENT_COLORS[color];
    return `
      <div class="flex flex-col items-center p-2 rounded-lg cursor-pointer hover:opacity-80 transition ${settings.accent === color && !settings.rgbAnimation ? 'bg-blue-900/30 border border-blue-500' : 'bg-gray-800'} accent-option" 
           onclick="changeAccent('${color}')">
        <div class="w-8 h-8 rounded-full mb-2 border-2 border-gray-400" style="background: ${colorData.primary};"></div>
        <div class="text-xs" style="color: #f1f5f9;">${color}</div>
        ${settings.accent === color && !settings.rgbAnimation ? '<i class="fas fa-check text-green-500 text-xs"></i>' : ''}
      </div>
    `;
  }).join('');

  // Custom accent color controls (only show if Custom is selected)
  let customAccentControls = '';
  if (settings.accent === 'Custom' && !settings.rgbAnimation) {
    // Get current custom color or default
    const currentCustomColor = settings.customAccent ? settings.customAccent.primary : ACCENT_COLORS.Custom.primary;

    // Extract RGB values
    let r = 100, g = 100, b = 100;
    const match = currentCustomColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      r = parseInt(match[1]);
      g = parseInt(match[2]);
      b = parseInt(match[3]);
    }

    customAccentControls = `
      <div class="mt-4 p-4 rounded-lg bg-gray-800">
        <div class="font-medium mb-3" style="color: var(--color-text-primary);">Custom Accent Color</div>
        <div class="grid grid-cols-1 gap-4">
          <div>
            <label class="block text-sm mb-2" style="color: #9ca3af;">Red: <span id="custom-r-value">${r}</span></label>
            <input type="range" id="custom-r" min="0" max="255" value="${r}" class="w-full" oninput="updateCustomColorPreview()">
          </div>
          <div>
            <label class="block text-sm mb-2" style="color: #9ca3af;">Green: <span id="custom-g-value">${g}</span></label>
            <input type="range" id="custom-g" min="0" max="255" value="${g}" class="w-full" oninput="updateCustomColorPreview()">
          </div>
          <div>
            <label class="block text-sm mb-2" style="color: #9ca3af;">Blue: <span id="custom-b-value">${b}</span></label>
            <input type="range" id="custom-b" min="0" max="255" value="${b}" class="w-full" oninput="updateCustomColorPreview()">
          </div>
          <div class="flex items-center justify-between mt-2">
            <div class="w-12 h-12 rounded-full border-2 border-gray-400" 
                 id="custom-color-preview" 
                 style="background: rgb(${r}, ${g}, ${b});"></div>
            <button onclick="applyCustomColor()" class="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 transition">
              Apply Custom Color
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // RGB Animation options
  const rgbAnimationOptions = Object.entries(RGB_ANIMATIONS).map(([key, animation]) => `
    <div class="flex flex-col items-center p-2 rounded-lg cursor-pointer hover:opacity-80 transition ${settings.rgbAnimation === key ? 'bg-blue-900/30 border border-blue-500' : 'bg-gray-800'} rgb-option" 
         onclick="changeRgbAnimation('${key}')">
      <div class="w-8 h-8 rounded-full mb-2 border-2 border-gray-400 flex items-center justify-center">
        <i class="fas fa-play text-xs"></i>
      </div>
      <div class="text-xs text-center" style="color: #f1f5f9;">${animation.name}</div>
      ${settings.rgbAnimation === key ? '<i class="fas fa-check text-green-500 text-xs"></i>' : ''}
    </div>
  `).join('');

  // Auth status display
  let authStatusDisplay = '';
  if (user) {
    authStatusDisplay = `
      <div class="card p-4 mb-4">
        <div class="font-medium" style="color: var(--color-text-primary);">Authentication Status</div>
        <div class="text-sm" style="color: #9ca3af;">Logged in as <span style="color: var(--color-text-primary); font-weight: bold;">${user.email}</span></div>
      </div>
    `;
  } else {
    authStatusDisplay = `
      <div class="card p-4 mb-4">
        <div class="font-medium" style="color: var(--color-text-primary);">Authentication Status</div>
        <div class="text-sm" style="color: #9ca3af;">Not logged in</div>
      </div>
    `;
  }

  // Firebase status
  let firebaseStatus = '';
  if (user) {
    firebaseStatus = `
      <div class="card p-4 mb-4">
        <div class="flex items-center justify-between">
          <div>
            <div class="font-medium" style="color: var(--color-text-primary);">Firebase Status</div>
            <div class="text-sm" style="color: #9ca3af;">Logged in as <span style="color: var(--color-text-primary);">${user.email}</span></div>
          </div>
          <button onclick="handleLogout()" class="px-4 py-2 rounded bg-red-600 hover:bg-red-700 transition">
            Logout
          </button>
        </div>
      </div>
    `;
  } else {
    firebaseStatus = `
      <div class="card p-4 mb-4">
        <div class="font-medium mb-3" style="color: var(--color-text-primary);">Firebase Login</div>
        <div class="grid grid-cols-1 gap-3">
          <input type="email" id="login-email" placeholder="Email" class="px-3 py-2 rounded bg-gray-700 text-white">
          <div class="relative">
            <input type="password" id="login-password" placeholder="Password" class="w-full px-3 py-2 rounded bg-gray-700 text-white">
            <button type="button" id="toggle-password" class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              <i class="fas fa-eye"></i>
            </button>
          </div>
          <button id="login-button" class="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 transition flex items-center justify-center">
            <i class="fas fa-sign-in-alt mr-2"></i> Login
          </button>
        </div>
        <div class="text-xs mt-3" style="color: #9ca3af;">Don't have an account? Register in the Firebase console.</div>
      </div>
    `;
  }

  // Data management buttons
  let dataManagementButtons = '';
  if (user) {
    dataManagementButtons = `
      <button onclick="window.saveUserDataToFirebase && window.saveUserDataToFirebase('${user.uid}')" class="px-4 py-3 rounded bg-green-600 hover:bg-green-700 transition flex flex-col items-center">
        <i class="fas fa-cloud-upload-alt text-xl mb-1"></i>
        <span style="color: white;">Update to Firebase</span>
        <span class="text-xs mt-1" style="color: #d1d5db;">Save data to cloud</span>
      </button>
    `;
  } else {
    dataManagementButtons = `
      <button onclick="showModalMessage('?? Login Required', 'You must be logged in to Firebase to save your data to the cloud. Please login first.')" class="px-4 py-3 rounded bg-gray-600 transition flex flex-col items-center cursor-not-allowed">
        <i class="fas fa-cloud-upload-alt text-xl mb-1"></i>
        <span style="color: #9ca3af;">Update to Firebase</span>
        <span class="text-xs mt-1" style="color: #6b7280;">Login required</span>
      </button>
    `;
  }

  // Video background selection (only show if Video theme is selected)
  let videoBackgroundSelection = '';
  if (settings.theme === 'Video') {
    const videoThemes = [
      // Additional video backgrounds
      { name: 'Anime Girl Next to Car', path: 'anime-girl-next-to-car.1920x1080.mp4' },
      { name: 'Blue Moonlight Lake', path: 'blue-moonlight-lake.1920x1080.mp4' },
      { name: 'BMW F80 M3 Blue', path: 'bmw-f80-m3-blue.1920x1080.mp4' },
      { name: 'BMW M3 Black at Night', path: 'bmw-m3-black-at-night.1920x1080.mp4' },
      { name: 'Bridge Crossing Autumn Colors', path: 'bridge-crossing-autumn-colors.1920x1080.mp4' },
      { name: 'Cat Cloud', path: 'cat-cloud.1920x1080.mp4' },
      { name: 'Fallen Knight Blossom Field', path: 'fallen-knight-blossom-field.1920x1080.mp4' },
      { name: 'Full Moon Elden Ring', path: 'full-moon-elden-ring.1920x1080.mp4' },
      { name: 'Inzoi', path: 'inzoi.1920x1080.mp4' },
      { name: 'Minecraft Sunset', path: 'minecraft-sunset.1920x1080.mp4' },
      { name: 'Orange Train at Sunset', path: 'orange-train-at-sunset.1920x1080.mp4' },
      { name: 'Rainy Forest', path: 'rainy-forest.1920x1080.mp4' },
      { name: 'Rainy Night City View', path: 'rainy-night-city-view.1920x1080.mp4' },
      { name: 'Rainy Pine Forest', path: 'rainy-pine-forest.1920x1080.mp4' },
      { name: 'Sport Classic Porsche', path: 'sport-classic-porsche.1920x1080.mp4' },
      { name: 'Starlight Over Flooded Fields', path: 'starlight-over-the-flooded-fields.1920x1080.mp4' },
      { name: 'Sunset Over Silent Horizon', path: 'sunset-over-silent-horizon.1920x1080.mp4' },
      { name: 'Yellow BMW M4', path: 'yellow-bmw-m4.1920x1080.mp4' }
    ];

    const videoOptions = videoThemes.map(video => `
      <div class="flex items-center p-3 rounded-lg cursor-pointer hover:opacity-80 transition ${settings.videoBackground === video.path ? 'bg-blue-900/30 border border-blue-500' : 'bg-gray-800'} video-option" 
           onclick="changeVideoBackground('${video.path}')">
        <div class="font-medium" style="color: #f1f5f9;">${video.name}</div>
        ${settings.videoBackground === video.path ? '<i class="fas fa-check text-green-500 ml-auto"></i>' : ''}
      </div>
    `).join('');

    videoBackgroundSelection = `
      <div class="card p-4 mb-2">
        <div class="font-medium mb-2" style="color: var(--color-text-primary);">Video Background Selection</div>
        <div class="grid grid-cols-1 gap-2">
          ${videoOptions}
        </div>
        <div class="text-xs mt-3" style="color: #9ca3af;">Select a video background to use with the Video theme</div>
        <div class="text-xs mt-2" style="color: #facc15;">Videos are loaded from local files</div>
      </div>
    `;
  }

  el.innerHTML = `
    <h2 class="text-2xl font-bold mb-4 flex items-center" style="color: var(--color-accent-main);">
      <i class="fas fa-gear mr-2"></i> Settings
    </h2>
    
    ${authStatusDisplay}
    
    ${firebaseStatus}
    
    <div class="card p-4 mb-2">
      <div class="font-medium mb-2" style="color: var(--color-text-primary);">Theme</div>
      <div class="grid grid-cols-1 gap-2">
        ${themeOptions}
      </div>
    </div>
    
    <div class="card p-4 mb-2">
      <div class="font-medium mb-2" style="color: var(--color-text-primary);">Static Accent Colors</div>
      <div class="grid grid-cols-4 sm:grid-cols-5 gap-2">
        ${accentOptions}
      </div>
      ${customAccentControls}
    </div>
    
    <div class="card p-4 mb-2">
      <div class="font-medium mb-2" style="color: var(--color-text-primary);">RGB Animations</div>
      <div class="text-sm text-gray-400 mb-3">Gaming-style animated accent colors</div>
      <div class="grid grid-cols-3 sm:grid-cols-5 gap-2">
        ${rgbAnimationOptions}
      </div>
      ${settings.rgbAnimation ? `
        <div class="mt-3 text-xs text-gray-400 flex items-center">
          <i class="fas fa-circle-info mr-2"></i>
          Currently using: ${RGB_ANIMATIONS[settings.rgbAnimation].name}
          <button onclick="stopRgbAnimation(); delete settings.rgbAnimation; saveSettingsSilently(); renderSettings();" class="ml-auto text-red-400 hover:text-red-300">
            <i class="fas fa-stop"></i> Stop Animation
          </button>
        </div>
      ` : ''}
    </div>
    
    ${videoBackgroundSelection}
    
    <!-- Admin video upload section (only visible to admins) -->
    <div class="card p-4 mb-2" id="video-upload-section" style="display: none;">
      <div class="font-medium mb-2" style="color: var(--color-text-primary);">Upload Video Background</div>
      <div class="text-sm mb-3" style="color: #9ca3af;">Upload new video backgrounds to Firebase Storage</div>
      <input type="file" id="video-upload-input" accept="video/mp4,video/webm,video/ogg" class="mb-3 w-full px-3 py-2 rounded bg-gray-700 text-white">
      <button onclick="uploadVideoBackground()" class="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 transition">
        Upload Video
      </button>
      <div id="upload-progress" class="mt-2" style="display: none;">
        <div class="w-full bg-gray-700 rounded-full h-2">
          <div id="upload-progress-bar" class="bg-blue-600 h-2 rounded-full" style="width: 0%;"></div>
        </div>
        <div id="upload-progress-text" class="text-xs mt-1" style="color: #9ca3af;">Uploading... 0%</div>
      </div>
    </div>
    
    <div class="card p-4 mb-2">
      <div class="font-medium mb-2" style="color: var(--color-text-primary);">Data Management</div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        ${dataManagementButtons}
        <button onclick="testFirebaseConnection()" class="px-4 py-3 rounded bg-blue-600 hover:bg-blue-700 transition flex flex-col items-center">
          <i class="fas fa-vial text-xl mb-1"></i>
          <span style="color: white;">Test Connection</span>
          <span class="text-xs mt-1" style="color: #d1d5db;">Firebase sync test</span>
        </button>
      </div>
    </div>
  `;

  // Re-attach event listeners for login form
  setTimeout(() => {
    const loginButton = document.getElementById('login-button');
    if (loginButton) {
      // Remove existing listeners first
      const newLoginButton = loginButton.cloneNode(true);
      loginButton.parentNode.replaceChild(newLoginButton, loginButton);

      // Get reference to the new button
      const finalLoginButton = document.getElementById('login-button');

      // Add comprehensive event listeners
      finalLoginButton.addEventListener('click', handleLoginWrapper);
      finalLoginButton.addEventListener('touchstart', handleLoginWrapper);
      finalLoginButton.addEventListener('mousedown', handleLoginWrapper);
    }

    // Add Enter key support for login fields
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const togglePasswordButton = document.getElementById('toggle-password');

    if (emailInput) {
      emailInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleLoginWrapper(e);
        }
      });
    }

    if (passwordInput) {
      passwordInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleLoginWrapper(e);
        }
      });
    }

    // Add password visibility toggle
    if (togglePasswordButton && passwordInput) {
      togglePasswordButton.addEventListener('click', function () {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        this.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
      });
    }

    // Check if user is admin and show upload section
    checkAdminAndShowUploadSection();
  }, 100);
}

// Custom color functions
function updateCustomColorPreview() {
  const r = document.getElementById('custom-r').value;
  const g = document.getElementById('custom-g').value;
  const b = document.getElementById('custom-b').value;

  // Update value displays
  document.getElementById('custom-r-value').textContent = r;
  document.getElementById('custom-g-value').textContent = g;
  document.getElementById('custom-b-value').textContent = b;

  // Update preview
  const preview = document.getElementById('custom-color-preview');
  if (preview) {
    preview.style.background = `rgb(${r}, ${g}, ${b})`;
  }
}

function applyCustomColor() {
  const r = document.getElementById('custom-r').value;
  const g = document.getElementById('custom-g').value;
  const b = document.getElementById('custom-b').value;

  const primaryColor = `rgb(${r}, ${g}, ${b})`;
  saveCustomAccent(primaryColor);
}

// Debug: Check if login elements are in the DOM after rendering
setTimeout(() => {
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const loginButton = document.getElementById('login-button');

  console.log('[AUTH] Login form elements after render:', {
    emailInput: !!emailInput,
    passwordInput: !!passwordInput,
    loginButton: !!loginButton
  });

  // Apply mobile authentication fixes
  if (loginButton) {
    applyMobileAuthFixes();
  }

  // Add Enter key support for both email and password fields
  if (emailInput) {
    emailInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        console.log('[AUTH] Enter key pressed in email field');
        handleLogin();
      }
    });
  }

  if (passwordInput) {
    passwordInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        console.log('[AUTH] Enter key pressed in password field');
        handleLogin();
      }
    });
  }
}, 100);

// Settings change functions

function changeTheme(themeName) {
  settings.theme = themeName;
  saveSettingsSilently();  // Use silent save to avoid notification
  applyTheme(themeName);
  renderSettings();
}

function changeVideoBackground(videoPath) {
  settings.videoBackground = videoPath;
  saveSettingsSilently();  // Use silent save to avoid notification

  // If video theme is currently active, reapply it to show the new video
  if (settings.theme === 'Video') {
    // Add fade out effect to current video
    const currentVideo = document.getElementById('video-background');
    if (currentVideo) {
      currentVideo.style.transition = 'opacity 0.5s ease-out';
      currentVideo.style.opacity = '0';

      // Wait for fade out to complete before removing and adding new video
      setTimeout(() => {
        // Remove only the video elements, not the video-theme class
        removeVideoBackground(true); // Preserve the video-theme class

        // Apply new video background while keeping the video-theme class
        applyVideoBackground();

        // Add fade in effect to new video
        const newVideo = document.getElementById('video-background');
        if (newVideo) {
          newVideo.style.opacity = '0';
          setTimeout(() => {
            newVideo.style.transition = 'opacity 0.5s ease-in';
            newVideo.style.opacity = '1';
          }, 50);
        }
      }, 500);
    } else {
      // Fallback if no current video
      removeVideoBackground(true);
      applyVideoBackground();
    }
  }

  renderSettings();
}

// Function to upload video backgrounds to Firebase Storage
function uploadVideoBackground() {
  const fileInput = document.getElementById('video-upload-input');
  const file = fileInput.files[0];

  if (!file) {
    showModalMessage('?? No File Selected', 'Please select a video file to upload.');
    return;
  }

  // Check if user is admin
  if (!currentUser || !currentUser.getIdToken) {
    showModalMessage('?? Access Denied', 'You must be logged in as an admin to upload videos.');
    return;
  }

  // Get ID token to check admin status
  currentUser.getIdTokenResult().then((idTokenResult) => {
    if (!idTokenResult.claims.admin) {
      showModalMessage('?? Access Denied', 'You must be an admin to upload videos.');
      return;
    }

    // Show progress
    const progressContainer = document.getElementById('upload-progress');
    const progressBar = document.getElementById('upload-progress-bar');
    const progressText = document.getElementById('upload-progress-text');

    progressContainer.style.display = 'block';

    // Upload file to Firebase Storage
    const storageRef = storage.ref();
    const videoRef = storageRef.child('videoBackgrounds/' + file.name);

    const uploadTask = videoRef.put(file);

    uploadTask.on('state_changed',
      (snapshot) => {
        // Progress updates
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        progressBar.style.width = progress + '%';
        progressText.textContent = `Uploading... ${Math.round(progress)}%`;
      },
      (error) => {
        // Handle errors
        console.error('[FIREBASE] Upload error:', error);
        progressContainer.style.display = 'none';
        showModalMessage('? Upload Failed', `Error uploading video: ${error.message}`);
      },
      () => {
        // Upload complete
        progressContainer.style.display = 'none';
        fileInput.value = '';
        showModalMessage('? Upload Complete', `Video '${file.name}' uploaded successfully!`);
      }
    );
  }).catch((error) => {
    console.error('[FIREBASE] Error getting ID token:', error);
    showModalMessage('? Authentication Error', `Error verifying admin status: ${error.message}`);
  });
}

// Function to check if user is admin and show upload section
function checkAdminAndShowUploadSection() {
  const uploadSection = document.getElementById('video-upload-section');

  if (!uploadSection) return;

  if (currentUser && currentUser.getIdToken) {
    currentUser.getIdTokenResult().then((idTokenResult) => {
      if (idTokenResult.claims.admin) {
        uploadSection.style.display = 'block';
      } else {
        uploadSection.style.display = 'none';
      }
    }).catch((error) => {
      console.error('[FIREBASE] Error checking admin status:', error);
      uploadSection.style.display = 'none';
    });
  } else {
    uploadSection.style.display = 'none';
  }
}

function changeAccent(colorName) {
  // Prevent white accent on light theme
  if (colorName === 'White' && settings.theme === 'Light') {
    showModalMessage('?? Invalid Selection', 'White accent color is not available with the Light theme as it would be invisible. Please choose a different accent color or switch to a different theme.');
    return;
  }

  // Stop any RGB animation if we're switching to a static color
  if (settings.rgbAnimation) {
    stopRgbAnimation();
    delete settings.rgbAnimation;
  }

  settings.accent = colorName;
  saveSettingsSilently();  // Use silent save to avoid notification

  if (colorName === 'Custom') {
    applyCustomAccent();
  } else {
    applyAccent(colorName);
  }

  renderSettings();
}

function changeRgbAnimation(animationName) {
  console.log('[RGB] Changing to animation:', animationName);
  // Stop any existing animation
  stopRgbAnimation();

  // Set the animation in settings
  settings.rgbAnimation = animationName;
  saveSettingsSilently();  // Use silent save to avoid notification

  // Start the animation
  startRgbAnimation(animationName);

  // Update the settings display
  renderSettings();
}

function applyAccent(accentName) {
  const root = document.documentElement;
  const color = ACCENT_COLORS[accentName];

  if (!color) {
    console.warn('[THEME] Invalid accent color:', accentName);
    return;
  }

  root.style.setProperty('--color-accent-main', color.primary);
  root.style.setProperty('--color-accent-shadow', color.secondary);
}

// Custom Accent Color Functions
function applyCustomAccent() {
  // If user has a custom color saved, use it; otherwise use default
  if (settings.customAccent) {
    document.documentElement.style.setProperty('--color-accent-main', settings.customAccent.primary);
    document.documentElement.style.setProperty('--color-accent-shadow', settings.customAccent.secondary);
  } else {
    // Use default custom color
    const defaultCustom = ACCENT_COLORS.Custom;
    document.documentElement.style.setProperty('--color-accent-main', defaultCustom.primary);
    document.documentElement.style.setProperty('--color-accent-shadow', defaultCustom.secondary);
  }
}

function saveCustomAccent(primaryColor) {
  // Generate a slightly darker secondary color
  const rgbMatch = primaryColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch) {
    const r = Math.max(0, parseInt(rgbMatch[1]) - 20);
    const g = Math.max(0, parseInt(rgbMatch[2]) - 20);
    const b = Math.max(0, parseInt(rgbMatch[3]) - 20);
    const secondaryColor = `rgb(${r}, ${g}, ${b})`;

    // Save custom accent in settings
    settings.customAccent = {
      primary: primaryColor,
      secondary: secondaryColor
    };

    saveSettingsSilently();

    // Apply the custom accent
    applyCustomAccent();

    // Update settings display
    renderSettings();
  }
}

// Expose custom color functions to global scope for HTML event handlers
window.updateCustomColorPreview = updateCustomColorPreview;
window.applyCustomColor = applyCustomColor;

// Expose RGB animation functions to global scope
window.changeRgbAnimation = changeRgbAnimation;
window.startRgbAnimation = startRgbAnimation;
window.stopRgbAnimation = stopRgbAnimation;

// RGB Animation Functions
let rgbAnimationInterval = null;

function startRgbAnimation(animationType) {
  console.log('[RGB] Starting animation:', animationType);

  // Stop any existing animation
  stopRgbAnimation();

  // Set the animation type in settings
  settings.rgbAnimation = animationType;
  saveSettingsSilently();

  // Start the appropriate animation with optimized intervals for smoother transitions
  switch (animationType) {
    case 'Rainbow':
      console.log('[RGB] Starting Rainbow animation');
      rgbAnimationInterval = setInterval(animateRainbow, 50); // Faster for smooth HSL transition
      break;
    case 'Fire':
      console.log('[RGB] Starting Fire animation');
      rgbAnimationInterval = setInterval(animateFire, 100); // More frequent updates
      break;
    case 'Ocean':
      console.log('[RGB] Starting Ocean animation');
      rgbAnimationInterval = setInterval(animateOcean, 100); // More frequent updates
      break;
    case 'Forest':
      console.log('[RGB] Starting Forest animation');
      rgbAnimationInterval = setInterval(animateForest, 100); // More frequent updates
      break;
    case 'Sunset':
      console.log('[RGB] Starting Sunset animation');
      rgbAnimationInterval = setInterval(animateSunset, 80); // Faster for vibrant colors
      break;
    default:
      console.log('[RGB] Unknown animation type, using static color');
      // If no valid animation type, use static color
      applyAccent(settings.accent);
      return;
  }

  console.log(`[RGB] Started ${animationType} animation`);
}

function stopRgbAnimation() {
  console.log('[RGB] Stopping animation, interval:', rgbAnimationInterval);
  if (rgbAnimationInterval) {
    clearInterval(rgbAnimationInterval);
    rgbAnimationInterval = null;
    console.log('[RGB] Stopped animation');
  }
}

// Animation functions for different effects
let hue = 0;
function animateRainbow() {
  console.log('[RGB] Rainbow animation frame');
  hue = (hue + 2) % 360; // Faster transition
  const color = `hsl(${hue}, 100%, 50%)`;
  const shadowColor = `hsl(${hue}, 100%, 40%)`;
  document.documentElement.style.setProperty('--color-accent-main', color);
  document.documentElement.style.setProperty('--color-accent-shadow', shadowColor);
}

let fireIndex = 0;
const fireColors = [
  'rgb(255, 0, 0)',      // Red
  'rgb(255, 30, 0)',     // Darker Red-Orange
  'rgb(255, 69, 0)',     // Red-Orange
  'rgb(255, 95, 31)',    // Orange
  'rgb(255, 120, 0)',    // Light Orange
  'rgb(255, 140, 0)',    // Dark Orange
  'rgb(255, 165, 0)',    // Orange
  'rgb(255, 180, 0)',    // Light Orange
  'rgb(255, 200, 0)',    // Yellow-Orange
  'rgb(255, 220, 0)',    // Bright Yellow-Orange
  'rgb(255, 237, 41)',   // Yellow
  'rgb(255, 245, 100)'   // Light Yellow
];
function animateFire() {
  console.log('[RGB] Fire animation frame, index:', fireIndex);
  fireIndex = (fireIndex + 1) % fireColors.length;
  const color = fireColors[fireIndex];
  // Darken the color for shadow
  const r = parseInt(color.match(/\d+/)[0]);
  const g = parseInt(color.match(/\d+/g)[1]);
  const b = parseInt(color.match(/\d+/g)[2]);
  const shadowColor = `rgb(${Math.max(0, r - 30)}, ${Math.max(0, g - 30)}, ${Math.max(0, b - 30)})`;
  document.documentElement.style.setProperty('--color-accent-main', color);
  document.documentElement.style.setProperty('--color-accent-shadow', shadowColor);
}

let oceanIndex = 0;
const oceanColors = [
  'rgb(0, 0, 255)',      // Blue
  'rgb(0, 50, 255)',     // Deep Blue
  'rgb(0, 100, 255)',    // Light Blue
  'rgb(0, 125, 255)',    // Soft Blue
  'rgb(0, 150, 255)',    // Sky Blue
  'rgb(0, 175, 255)',    // Light Sky Blue
  'rgb(0, 200, 255)',    // Bright Blue
  'rgb(0, 225, 255)',    // Very Bright Blue
  'rgb(0, 255, 255)',    // Cyan
  'rgb(50, 255, 255)',   // Light Cyan
  'rgb(100, 255, 255)',  // Light Cyan
  'rgb(125, 255, 255)',  // Soft Cyan
  'rgb(150, 255, 255)',  // Pale Cyan
  'rgb(175, 255, 255)',  // Light Pale Cyan
  'rgb(200, 255, 255)',  // Very Light Cyan
  'rgb(175, 255, 255)',  // Light Pale Cyan
  'rgb(150, 255, 255)',  // Pale Cyan
  'rgb(125, 255, 255)',  // Soft Cyan
  'rgb(100, 255, 255)',  // Light Cyan
  'rgb(50, 255, 255)',   // Light Cyan
  'rgb(0, 255, 255)',    // Cyan
  'rgb(0, 225, 255)',    // Very Bright Blue
  'rgb(0, 200, 255)',    // Bright Blue
  'rgb(0, 175, 255)',    // Light Sky Blue
  'rgb(0, 150, 255)',    // Sky Blue
  'rgb(0, 125, 255)',    // Soft Blue
  'rgb(0, 100, 255)',    // Light Blue
  'rgb(0, 50, 255)',     // Deep Blue
  'rgb(0, 0, 255)'       // Blue
];
function animateOcean() {
  oceanIndex = (oceanIndex + 1) % oceanColors.length;
  const color = oceanColors[oceanIndex];
  // Darken the color for shadow
  const r = parseInt(color.match(/\d+/)[0]);
  const g = parseInt(color.match(/\d+/g)[1]);
  const b = parseInt(color.match(/\d+/g)[2]);
  const shadowColor = `rgb(${Math.max(0, r - 30)}, ${Math.max(0, g - 30)}, ${Math.max(0, b - 30)})`;
  document.documentElement.style.setProperty('--color-accent-main', color);
  document.documentElement.style.setProperty('--color-accent-shadow', shadowColor);
}

let forestIndex = 0;
const forestColors = [
  'rgb(0, 100, 0)',      // Dark Green
  'rgb(0, 125, 0)',      // Medium Dark Green
  'rgb(0, 150, 0)',      // Green
  'rgb(0, 175, 0)',      // Medium Green
  'rgb(0, 200, 0)',      // Light Green
  'rgb(0, 225, 0)',      // Bright Light Green
  'rgb(0, 255, 0)',      // Bright Green
  'rgb(30, 255, 30)',    // Soft Bright Green
  'rgb(57, 255, 20)',    // Neon Green
  'rgb(80, 255, 50)',    // Light Neon Green
  'rgb(100, 255, 100)',  // Pale Green
  'rgb(125, 255, 125)',  // Soft Pale Green
  'rgb(150, 255, 150)',  // Very Pale Green
  'rgb(175, 255, 175)',  // Light Very Pale Green
  'rgb(125, 255, 125)',  // Soft Pale Green
  'rgb(100, 255, 100)',  // Pale Green
  'rgb(80, 255, 50)',    // Light Neon Green
  'rgb(57, 255, 20)',    // Neon Green
  'rgb(30, 255, 30)',    // Soft Bright Green
  'rgb(0, 255, 0)',      // Bright Green
  'rgb(0, 225, 0)',      // Bright Light Green
  'rgb(0, 200, 0)',      // Light Green
  'rgb(0, 175, 0)',      // Medium Green
  'rgb(0, 150, 0)',      // Green
  'rgb(0, 125, 0)',      // Medium Dark Green
  'rgb(0, 100, 0)'       // Dark Green
];
function animateForest() {
  forestIndex = (forestIndex + 1) % forestColors.length;
  const color = forestColors[forestIndex];
  // Darken the color for shadow
  const r = parseInt(color.match(/\d+/)[0]);
  const g = parseInt(color.match(/\d+/g)[1]);
  const b = parseInt(color.match(/\d+/g)[2]);
  const shadowColor = `rgb(${Math.max(0, r - 30)}, ${Math.max(0, g - 30)}, ${Math.max(0, b - 30)})`;
  document.documentElement.style.setProperty('--color-accent-main', color);
  document.documentElement.style.setProperty('--color-accent-shadow', shadowColor);
}

let sunsetIndex = 0;
const sunsetColors = [
  'rgb(255, 105, 180)',  // Hot Pink
  'rgb(255, 80, 160)',   // Light Hot Pink
  'rgb(255, 20, 147)',   // Deep Pink
  'rgb(220, 20, 140)',   // Medium Deep Pink
  'rgb(199, 21, 133)',   // Medium Violet Red
  'rgb(219, 112, 147)',  // Pale Violet Red
  'rgb(230, 120, 160)',  // Light Pale Violet Red
  'rgb(255, 0, 255)',    // Magenta
  'rgb(200, 0, 200)',    // Dark Magenta
  'rgb(127, 0, 255)',    // Purple
  'rgb(138, 43, 226)',   // Blue Violet
  'rgb(147, 112, 219)',  // Medium Purple
  'rgb(160, 130, 230)',  // Light Medium Purple
  'rgb(218, 112, 214)',  // Orchid
  'rgb(230, 130, 220)',  // Light Orchid
  'rgb(255, 0, 0)',      // Red
  'rgb(255, 30, 0)',     // Dark Red-Orange
  'rgb(255, 69, 0)',     // Red-Orange
  'rgb(255, 80, 10)',    // Medium Red-Orange
  'rgb(255, 95, 31)',    // Orange
  'rgb(255, 120, 50)',   // Light Orange
  'rgb(255, 140, 0)',    // Dark Orange
  'rgb(255, 150, 20)',   // Medium Dark Orange
  'rgb(255, 165, 0)',    // Orange
  'rgb(255, 180, 30)',   // Light Orange
  'rgb(255, 215, 0)',    // Gold
  'rgb(255, 225, 50)',   // Light Gold
  'rgb(255, 237, 41)',   // Yellow
  'rgb(255, 245, 100)',  // Light Yellow
  'rgb(255, 225, 50)',   // Light Gold
  'rgb(255, 215, 0)',    // Gold
  'rgb(255, 180, 30)',   // Light Orange
  'rgb(255, 165, 0)',    // Orange
  'rgb(255, 150, 20)',   // Medium Dark Orange
  'rgb(255, 140, 0)',    // Dark Orange
  'rgb(255, 120, 50)',   // Light Orange
  'rgb(255, 95, 31)',    // Orange
  'rgb(255, 80, 10)',    // Medium Red-Orange
  'rgb(255, 69, 0)',     // Red-Orange
  'rgb(255, 30, 0)',     // Dark Red-Orange
  'rgb(255, 0, 0)',      // Red
  'rgb(230, 130, 220)',  // Light Orchid
  'rgb(218, 112, 214)',  // Orchid
  'rgb(160, 130, 230)',  // Light Medium Purple
  'rgb(147, 112, 219)',  // Medium Purple
  'rgb(138, 43, 226)',   // Blue Violet
  'rgb(200, 0, 200)',    // Dark Magenta
  'rgb(255, 0, 255)',    // Magenta
  'rgb(230, 120, 160)',  // Light Pale Violet Red
  'rgb(219, 112, 147)',  // Pale Violet Red
  'rgb(220, 20, 140)',   // Medium Deep Pink
  'rgb(199, 21, 133)',   // Medium Violet Red
  'rgb(255, 20, 147)',   // Deep Pink
  'rgb(255, 80, 160)',   // Light Hot Pink
  'rgb(255, 105, 180)'   // Hot Pink
];
function animateSunset() {
  sunsetIndex = (sunsetIndex + 1) % sunsetColors.length;
  const color = sunsetColors[sunsetIndex];
  // Darken the color for shadow
  const r = parseInt(color.match(/\d+/)[0]);
  const g = parseInt(color.match(/\d+/g)[1]);
  const b = parseInt(color.match(/\d+/g)[2]);
  const shadowColor = `rgb(${Math.max(0, r - 30)}, ${Math.max(0, g - 30)}, ${Math.max(0, b - 30)})`;
  document.documentElement.style.setProperty('--color-accent-main', color);
  document.documentElement.style.setProperty('--color-accent-shadow', shadowColor);
}

function applyTheme(themeName) {
  const root = document.documentElement;
  const body = document.body;

  // If applying Light theme and current accent is White, switch to Blue
  if (themeName === 'Light' && settings.accent === 'White') {
    settings.accent = 'Blue';
    saveSettings();
    applyAccent('Blue');
    showModalMessage('?? Theme Updated', 'Switched from White to Blue accent color to maintain visibility with the Light theme.');
  }

  // Remove any existing video background
  removeVideoBackground();

  switch (themeName) {
    case 'Grave':
      root.style.setProperty('--color-bg-primary', '#000000');
      root.style.setProperty('--color-bg-card', '#0a0a0a');
      root.style.setProperty('--color-text-primary', '#e5e5e5');
      root.style.setProperty('--color-text-secondary', '#9ca3af');
      root.style.setProperty('--color-border', '#1a1a1a');
      body.classList.remove('light-theme');
      body.style.background = 'var(--color-bg-primary)';
      break;
    case 'Light':
      root.style.setProperty('--color-bg-primary', '#ffffff');
      root.style.setProperty('--color-bg-card', '#f5f5f5');
      root.style.setProperty('--color-text-primary', '#1a1a1a');
      root.style.setProperty('--color-text-secondary', '#4b5563');
      root.style.setProperty('--color-border', '#d1d5db');
      body.classList.add('light-theme');
      body.style.background = 'var(--color-bg-primary)';
      break;
    case 'Video':
      // For video theme, we'll use a dark background as fallback
      root.style.setProperty('--color-bg-primary', '#000000');
      root.style.setProperty('--color-bg-card', '#1e293b');
      root.style.setProperty('--color-text-primary', '#f1f5f9');
      root.style.setProperty('--color-text-secondary', '#9ca3af');
      root.style.setProperty('--color-border', '#334155');
      body.classList.remove('light-theme');
      body.style.background = 'var(--color-bg-primary)';
      // Add video theme class immediately to ensure cards render with blur
      body.classList.add('video-theme');
      // Apply video background
      applyVideoBackground();
      break;
    default: // Dark
      root.style.setProperty('--color-bg-primary', '#0f172a');
      root.style.setProperty('--color-bg-card', '#1e293b');
      root.style.setProperty('--color-text-primary', '#f1f5f9');
      root.style.setProperty('--color-text-secondary', '#9ca3af');
      root.style.setProperty('--color-border', '#334155');
      body.classList.remove('light-theme');
      body.style.background = 'var(--color-bg-primary)';
  }
}

// Video background functions
function applyVideoBackground() {
  // Create video element
  const video = document.createElement('video');
  video.id = 'video-background';
  video.autoplay = true;
  video.loop = true;
  video.muted = true;
  video.playsInline = true;

  // Create overlay element
  const overlay = document.createElement('div');
  overlay.id = 'video-overlay';

  // List of available video themes in same directory
  const videoThemes = [
    'anime-girl-next-to-car.1920x1080.mp4',
    'blue-moonlight-lake.1920x1080.mp4',
    'bmw-f80-m3-blue.1920x1080.mp4',
    'bmw-m3-black-at-night.1920x1080.mp4',
    'bridge-crossing-autumn-colors.1920x1080.mp4',
    'cat-cloud.1920x1080.mp4',
    'fallen-knight-blossom-field.1920x1080.mp4',
    'full-moon-elden-ring.1920x1080.mp4',
    'inzoi.1920x1080.mp4',
    'minecraft-sunset.1920x1080.mp4',
    'orange-train-at-sunset.1920x1080.mp4',
    'rainy-forest.1920x1080.mp4',
    'rainy-night-city-view.1920x1080.mp4',
    'rainy-pine-forest.1920x1080.mp4',
    'sport-classic-porsche.1920x1080.mp4',
    'starlight-over-the-flooded-fields.1920x1080.mp4',
    'sunset-over-silent-horizon.1920x1080.mp4',
    'yellow-bmw-m4.1920x1080.mp4'
  ];

  // Select video based on user preference or random if not set
  let selectedVideoPath;
  if (settings.videoBackground && videoThemes.includes(settings.videoBackground)) {
    selectedVideoPath = settings.videoBackground;
  } else {
    // Select a random video
    selectedVideoPath = videoThemes[Math.floor(Math.random() * videoThemes.length)];
    // Save the selection to settings
    settings.videoBackground = selectedVideoPath;
    saveSettings();
  }

  // Use local video files
  const source = document.createElement('source');
  source.src = selectedVideoPath;
  source.type = 'video/mp4';
  video.appendChild(source);

  // Add to body
  document.body.appendChild(video);
  document.body.appendChild(overlay);

  // Ensure body background is transparent to show video
  document.body.style.backgroundColor = 'transparent';
}

function removeVideoBackground(preserveThemeClass = false) {
  const video = document.getElementById('video-background');
  const overlay = document.getElementById('video-overlay');

  if (video) {
    video.remove();
  }

  if (overlay) {
    overlay.remove();
  }

  // Remove video theme class only if not preserving
  if (!preserveThemeClass) {
    document.body.classList.remove('video-theme');
  }

  // Restore body background color when video is removed
  document.body.style.backgroundColor = '';
}

// MOBILE-SPECIFIC FIXES
function applyMobileFixes() {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  if (isMobile) {
    console.log('[MOBILE] Applying mobile-specific fixes');

    // Force visibility of critical elements
    const elementsToFix = [
      'home-content',
      'rank-display-container',
      'home-challenge-container'
    ];

    elementsToFix.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.style.display = 'block';
        el.style.visibility = 'visible';
        el.style.opacity = '1';
        console.log(`[MOBILE] Fixed visibility for ${id}`);
      }
    });

    // Ensure all cards are visible
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
      card.style.display = 'block';
      card.style.visibility = 'visible';
      card.style.opacity = '1';
    });

    // Add extra padding for mobile
    const mainContent = document.querySelector('main');
    if (mainContent) {
      mainContent.style.padding = '1rem';
    }

    // Apply mobile-specific authentication fixes
    applyMobileAuthFixes();
  }
}

// MOBILE AUTHENTICATION FIXES
function applyMobileAuthFixes() {
  console.log('[MOBILE] Applying mobile authentication fixes');

  // Check if we're on a mobile device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (!isMobile) {
    console.log('[MOBILE] Not a mobile device, skipping mobile fixes');
    return;
  }

  // Ensure login form elements are properly sized for touch
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const loginButton = document.getElementById('login-button');

  if (emailInput) {
    emailInput.style.minHeight = '44px'; // Minimum touch target size
    emailInput.style.fontSize = '16px'; // Prevent zoom on iOS
    emailInput.style.padding = '12px';
  }

  if (passwordInput) {
    passwordInput.style.minHeight = '44px'; // Minimum touch target size
    passwordInput.style.fontSize = '16px'; // Prevent zoom on iOS
    passwordInput.style.padding = '12px';
  }

  if (loginButton) {
    loginButton.style.minHeight = '44px'; // Minimum touch target size
    loginButton.style.fontSize = '16px'; // Consistent font size
    loginButton.style.padding = '12px';
  }

  // Re-attach event listeners specifically for mobile with better error handling
  if (loginButton) {
    console.log('[MOBILE] Re-attaching event listeners for login button');

    try {
      // Remove all existing listeners by cloning the element
      const newLoginButton = loginButton.cloneNode(true);
      loginButton.parentNode.replaceChild(newLoginButton, loginButton);

      // Get reference to the new button
      const finalLoginButton = document.getElementById('login-button');

      // Add comprehensive event listeners for mobile
      finalLoginButton.addEventListener('click', function (e) {
        console.log('[MOBILE] Login button click event triggered');
        handleLoginWrapper(e);
      }, { passive: false });

      finalLoginButton.addEventListener('touchstart', function (e) {
        console.log('[MOBILE] Login button touchstart event triggered');
        handleLoginWrapper(e);
      }, { passive: false });

      finalLoginButton.addEventListener('touchend', function (e) {
        console.log('[MOBILE] Login button touchend event triggered');
        e.preventDefault();
        e.stopPropagation();
      }, { passive: false });

      // Add direct touch event handler as fallback
      finalLoginButton.addEventListener('touch', function (e) {
        console.log('[MOBILE] Login button touch event triggered');
        e.preventDefault();
        e.stopPropagation();
        handleLoginWrapper(e);
      });
    } catch (error) {
      console.error('[MOBILE] Error re-attaching event listeners:', error);
    }
  }
}

// Add event listener for Enter key in login form
document.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && (e.target.id === 'login-email' || e.target.id === 'login-password')) {
    e.preventDefault();
    e.stopPropagation();
    handleLoginWrapper(e);
  }
});

// Add event listener for login button after DOM is ready
document.addEventListener('DOMContentLoaded', function () {
  setTimeout(() => {
    const loginButton = document.getElementById('login-button');
    if (loginButton) {
      // Remove existing listeners first
      const newLoginButton = loginButton.cloneNode(true);
      loginButton.parentNode.replaceChild(newLoginButton, loginButton);

      // Get reference to the new button
      const finalLoginButton = document.getElementById('login-button');

      // Add comprehensive event listeners
      finalLoginButton.addEventListener('click', handleLoginWrapper);
      finalLoginButton.addEventListener('touchstart', handleLoginWrapper);
      finalLoginButton.addEventListener('mousedown', handleLoginWrapper);

      // Add direct handler as fallback
      finalLoginButton.onclick = function (e) {
        console.log('[GLOBAL] Login button onclick fallback');
        handleLoginWrapper(e);
      };
    }
  }, 500);
});

// Removed global event listeners to prevent conflicts
// Function to ensure authentication status is properly displayed
// Function to ensure authentication status is properly displayed
function updateAuthStatusDisplay() {
  const statusElement = document.getElementById('auth-status');
  if (statusElement) {
    // Add a small delay to ensure Firebase auth state is properly initialized
    setTimeout(() => {
      if (auth && auth.currentUser) {
        statusElement.textContent = `Logged in as ${auth.currentUser.email}`;
        console.log('[AUTH] Status updated to logged in for:', auth.currentUser.email);
      } else if (auth) {
        statusElement.textContent = 'Not logged in';
        console.log('[AUTH] Status updated to not logged in');
      } else {
        statusElement.textContent = 'Firebase Ready';
        console.log('[AUTH] Status updated to Firebase Ready');
      }
    }, 300);
  }

  // MOBILE AUTHENTICATION FIX: Check sessionStorage for mobile auth state
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobile && !auth?.currentUser) {
    const storedAuthState = sessionStorage.getItem('mobileAuthState');
    if (storedAuthState) {
      try {
        const authData = JSON.parse(storedAuthState);
        // If we have stored auth data but no current user, restore the display
        if (statusElement && authData.email) {
          statusElement.textContent = `Logged in as ${authData.email}`;
        }
      } catch (e) {
        console.error('[MOBILE] Error parsing stored auth state:', e);
      }
    }
  }
}
// Function to check Firebase authentication status
function checkAuthStatus() {
  console.log('[AUTH] Checking authentication status');

  // Check if Firebase is initialized
  if (!app) {
    console.log('[AUTH] Firebase app not initialized');
    return;
  }

  if (!auth) {
    console.log('[AUTH] Firebase auth not initialized');
    return;
  }

  // Check current user
  const user = auth.currentUser;
  console.log('[AUTH] Current user:', user ? user.email : 'None');

  // Update UI
  updateAuthStatusDisplay();

  return user;
}

// Function to force re-authentication if needed
function forceReauth() {
  console.log('[AUTH] Forcing re-authentication check');

  if (auth) {
    auth.onAuthStateChanged(user => {
      console.log('[AUTH] Forced auth state check:', user ? user.email : 'No user');
      if (user) {
        currentUser = user;
        document.getElementById('auth-status').textContent = `Logged in as ${user.email}`;
        // Load user data from Firebase
        loadUserDataFromFirebase(user.uid);
      } else {
        currentUser = null;
        document.getElementById('auth-status').textContent = 'Not logged in';
        // Clear user-specific data
        clearUserData();
      }
      isAuthReady = true;
      renderSettings(); // Update settings UI
    });
  }
}

// Apply mobile fixes when DOM is loaded
setTimeout(() => {
  applyMobileFixes();
  // Also apply when page changes
  const originalRenderUI = renderUI;
  renderUI = function () {
    originalRenderUI();
    setTimeout(applyMobileFixes, 100);
  };
}, 1000);
// Expose settings functions globally
window.changeTheme = changeTheme;
window.changeAccent = changeAccent;
window.confirmLogout = confirmLogout;
window.applyVideoBackground = applyVideoBackground;
window.removeVideoBackground = removeVideoBackground;
window.changeVideoBackground = changeVideoBackground;
window.uploadVideoBackground = uploadVideoBackground;
window.checkAdminAndShowUploadSection = checkAdminAndShowUploadSection;

// Expose Firebase functions globally
window.testFirebaseConnection = testFirebaseConnection;
window.debugFirebaseSave = debugFirebaseSave;
window.syncDataWithFirebase = syncDataWithFirebase;
window.loadUserDataFromFirebase = loadUserDataFromFirebase;

// Expose authentication functions globally
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;

/* ---------- DATA EDITING UTILITY ---------- */
function handleStatUpdate(section, variation, field, newValue) {
  try {
    let numericValue = parseInt(newValue, 10);

    if (isNaN(numericValue) || numericValue < 0) {
      numericValue = 0;
    }

    // Handle userProfile updates
    if (section === 'userProfile') {
      if (!logData.userProfile) {
        logData.userProfile = { weight: null, height: null, age: null };
      }

      // For userProfile, the variation is the field name (weight, height, age)
      logData.userProfile[variation] = numericValue || null;
      saveData();
      console.log(`[LOG] Updated userProfile / ${variation} to ${numericValue}. Data saved locally.`);

      // Refresh UI to show Combat Identity Analyzer if all data is entered
      renderGrandTotal();
      return;
    }

    if (logData[section] && logData[section][variation]) {
      logData[section][variation][field] = numericValue;

      // For unilateral exercises, recalculate the combined total when left/right values change
      const isUnilateral = (section === 'kicks') || (section === 'legs' && variation === 'PistolSquat');
      if (isUnilateral && (field === 'totalLeft' || field === 'totalRight')) {
        const totalLeft = logData[section][variation].totalLeft || 0;
        const totalRight = logData[section][variation].totalRight || 0;
        logData[section][variation].total = totalLeft + totalRight;
        console.log(`[LOG] Recalculated combined total for ${section}/${variation}: ${logData[section][variation].total}`);
      }

      saveData();
      console.log(`[LOG] Updated ${section} / ${variation} / ${field} to ${numericValue}. Data saved locally.`);

      // This handles the deduction/achievement check
      if (field === 'total' || field === 'totalLeft' || field === 'totalRight') {
        updateAdvancementProgress(section, variation);
      }

      // REAL-TIME UPDATES: Refresh the entire UI to update all stats, rankings, and displays
      renderUI();
    } else {
      console.error("Invalid data path for update:", section, variation, field);
    }
  } catch (error) {
    console.error("[LOG] Error updating stat:", error);
    showModalMessage('? Error', `Failed to update stat: ${error.message}`);
  }
}

// Expose function globally
window.handleStatUpdate = handleStatUpdate;

// Function to show a custom modal message instead of alert()
function showModalMessage(title, message) {
  const container = document.getElementById('custom-modal-container');
  container.innerHTML = `
        <div class="modal-overlay">
            <div class="modal-content">
                <h3 class="text-2xl font-bold mb-3" style="color: var(--color-error);">${title}</h3>
                <p class="text-gray-200 mb-6">${message}</p>
                <button onclick="closeModal()" class="px-5 py-2 rounded font-semibold transition duration-200" style="background-color: var(--color-accent-main); color: var(--color-bg-primary);">
                    Acknowledge
                </button>
            </div>
        </div>
    `;
  // Add event listener to close on overlay click
  container.querySelector('.modal-overlay').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeModal();
    }
  });
}

window.showModalMessage = showModalMessage;

// Function to show a custom modal message without an acknowledge button
function showModalMessageNoAcknowledge(title, message, autoCloseTime) {
  const container = document.getElementById('custom-modal-container');
  container.innerHTML = `
        <div class="modal-overlay">
            <div class="modal-content">
                <h3 class="text-2xl font-bold mb-3" style="color: var(--color-error);">${title}</h3>
                <p class="text-gray-200 mb-6">${message}</p>
            </div>
        </div>
    `;
  // Add event listener to close on overlay click
  container.querySelector('.modal-overlay').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeModal();
    }
  });

  // Auto-close if specified
  if (autoCloseTime) {
    setTimeout(() => {
      closeModal();
    }, autoCloseTime);
  }
}

window.showModalMessageNoAcknowledge = showModalMessageNoAcknowledge;

// Expose settings functions globally
window.changeTheme = changeTheme;
window.applyVideoBackground = applyVideoBackground;
window.removeVideoBackground = removeVideoBackground;
window.changeVideoBackground = changeVideoBackground;
window.uploadVideoBackground = uploadVideoBackground;
window.checkAdminAndShowUploadSection = checkAdminAndShowUploadSection;

// Add scroll restriction functionality
window.restrictScrolling = restrictScrolling;
window.checkScrollRestriction = checkScrollRestriction;

// Proper implementation of authentication functions
function closeModal() {
  const container = document.getElementById('custom-modal-container');
  container.innerHTML = '';
}

// Expose function globally
window.closeModal = closeModal;

// Scroll restriction functions
// Store scroll restriction state for each tab
const scrollRestrictions = {};

// Function to restrict scrolling when last card is visible
function restrictScrolling(tabId) {
  // Clean up previous event listeners for this tab if they exist
  if (scrollRestrictions[tabId]) {
    // Remove previous event listener
    window.removeEventListener('scroll', scrollRestrictions[tabId].handler);
  }

  // Function to set up scroll restriction after a delay to ensure DOM is rendered
  function setupScrollRestriction() {
    // Get the tab element
    const tabElement = document.getElementById(tabId);
    if (!tabElement) return;

    // Get all cards in this tab
    const cards = tabElement.querySelectorAll('.card');
    if (cards.length === 0) return;

    // Get the last card
    const lastCard = cards[cards.length - 1];

    // Store the restriction state
    scrollRestrictions[tabId] = {
      lastCard: lastCard,
      lastScrollTop: window.pageYOffset || document.documentElement.scrollTop
    };

    // Function to handle scroll restriction
    function handleScrollRestriction() {
      if (!lastCard) return;

      const rect = lastCard.getBoundingClientRect();
      const windowHeight = window.innerHeight || document.documentElement.clientHeight;

      // Check if the last card is fully visible in the viewport with a small buffer
      const isLastCardVisible = rect.top >= 0 && rect.bottom <= (windowHeight + 10);

      // Get current scroll position
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

      // If last card is visible and user is trying to scroll down, prevent scrolling
      if (isLastCardVisible && scrollTop > scrollRestrictions[tabId].lastScrollTop) {
        // Prevent scrolling down by setting scroll position back to previous position
        window.scrollTo(0, scrollRestrictions[tabId].lastScrollTop);
        return;
      }

      // Update last scroll position
      scrollRestrictions[tabId].lastScrollTop = scrollTop;
    }

    // Store the handler for cleanup
    scrollRestrictions[tabId].handler = handleScrollRestriction;

    // Add scroll event listener
    window.addEventListener('scroll', handleScrollRestriction);
  }

  // Set up scroll restriction after a small delay to ensure DOM is rendered
  setTimeout(setupScrollRestriction, 100);
}

// Function to check scroll restriction for current tab
function checkScrollRestriction() {
  // Find the active tab
  const activeTab = document.querySelector('.tab.active');
  if (!activeTab) return;

  const tabId = activeTab.id;

  // If we have scroll restrictions for this tab, update the last scroll position
  if (scrollRestrictions[tabId]) {
    scrollRestrictions[tabId].lastScrollTop = window.pageYOffset || document.documentElement.scrollTop;
  }
}

// Add scroll event listener for continuous checking
window.addEventListener('scroll', checkScrollRestriction);

// Add resize event listener to handle window resizing
function handleResize() {
  checkScrollRestriction();
  // Also update scroll positions for all tabs
  Object.keys(scrollRestrictions).forEach(tabId => {
    if (scrollRestrictions[tabId]) {
      scrollRestrictions[tabId].lastScrollTop = window.pageYOffset || document.documentElement.scrollTop;
      // Re-check scroll restriction after resize
      if (scrollRestrictions[tabId].handler) {
        scrollRestrictions[tabId].handler();
      }
    }
  });
}
window.addEventListener('resize', handleResize);

// Clean up event listeners when page unloads
window.addEventListener('beforeunload', () => {
  // Remove all scroll event listeners
  Object.keys(scrollRestrictions).forEach(tabId => {
    if (scrollRestrictions[tabId] && scrollRestrictions[tabId].handler) {
      window.removeEventListener('scroll', scrollRestrictions[tabId].handler);
    }
  });
  // Remove resize listener
  window.removeEventListener('resize', handleResize);
});

// REMOVED: Duplicate handleLogin() function with modal implementation
// function handleLogin() {
//   // Show login dialog
//   showModalMessage('Login', `
//     <div class="text-center">
//       <p class="mb-4">Please enter your email and password to log in.</p>
//       <input id="login-email" type="email" placeholder="Email" class="w-full px-4 py-2 mb-3 rounded bg-gray-700" />
//       <input id="login-password" type="password" placeholder="Password" class="w-full px-4 py-2 mb-3 rounded bg-gray-700" />
//       <div class="flex justify-center gap-3">
//         <button onclick="closeModal()" class="px-4 py-2 rounded bg-gray-600 hover:bg-gray-700 transition">
//           Cancel
//         </button>
//         <button onclick="confirmLogin()" class="px-4 py-2 rounded bg-green-600 hover:bg-green-700 transition">
//           Login
//         </button>
//       </div>
//     </div>
//   `);
// }

function confirmLogin() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  auth.signInWithEmailAndPassword(email, password)
    .then((userCredential) => {
      console.log('[AUTH] User logged in:', userCredential.user.email);
      closeModal();
      renderSettings(); // Update UI
    })
    .catch((error) => {
      console.error('[AUTH] Login error:', error);
      showModalMessage('? Login Failed', `Error: ${error.message}`);
    });
}

// REMOVED: Duplicate handleLogout() function
// function handleLogout() {
//   // Show confirmation dialog before logging out
//   showModalMessage('Confirm Logout', `
//     <div class="text-center">
//       <p class="mb-4">Are you sure you want to log out?</p>
//       <p class="text-sm text-gray-400 mb-6">You'll need to log back in to access your saved data.</p>
//       <div class="flex justify-center gap-3">
//         <button onclick="closeModal()" class="px-4 py-2 rounded bg-gray-600 hover:bg-gray-700 transition">
//           Cancel
//         </button>
//         <button onclick="confirmLogout()" class="px-4 py-2 rounded bg-red-600 hover:bg-red-700 transition">
//           Logout
//         </button>
//       </div>
//     </div>
//   `);
// }

// REMOVED: Duplicate confirmLogout() function
// function confirmLogout() {
//   auth.signOut()
//     .then(() => {
//       console.log('[AUTH] User logged out');
//       
//       // Check if we're on a mobile device
//       const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
//       
//       // Clear mobile auth state if on mobile
//       if (isMobile) {
//         sessionStorage.removeItem('mobileAuthState');
//       }
//       
//       closeModal();
//       // Show a simple message without an acknowledge button
//       const container = document.getElementById('custom-modal-container');
//       container.innerHTML = `
//         <div class="modal-overlay">
//           <div class="modal-content">
//             <h3 class="text-2xl font-bold mb-3" style="color: var(--color-error);">?? Logged Out</h3>
//             <p class="text-gray-200 mb-6">You have been successfully logged out.</p>
//           </div>
//         </div>
//       `;
//       
//       // Auto-close the modal after 2 seconds
//       setTimeout(() => {
//         closeModal();
//         renderSettings(); // Update UI
//       }, 2000);
//     })
//     .catch((error) => {
//       console.error('[AUTH] Logout error:', error);
//       
//       // Show error message without an acknowledge button
//       const container = document.getElementById('custom-modal-container');
//       container.innerHTML = `
//         <div class="modal-overlay">
//           <div class="modal-content">
//             <h3 class="text-2xl font-bold mb-3" style="color: var(--color-error);">? Logout Failed</h3>
//             <p class="text-gray-200 mb-6">Error: ${error.message}</p>
//           </div>
//         </div>
//       `;
//       
//       // Auto-close the modal after 3 seconds
//       setTimeout(() => {
//         closeModal();
//       }, 3000);
//     });
// }

function showAdvancementToast(variation, difficulty, xpReward) {
  const container = document.body;
  const toast = document.createElement('div');
  toast.className = 'toast-notification celebration';
  toast.innerHTML = `
        <i class="fas fa-star" style="color: #fbbf24;"></i>
        <strong>${variation}</strong> (${difficulty}) Complete!
        <br><small>+${xpReward} XP</small>
    `;
  container.appendChild(toast);

  // Add exit animation before removing
  setTimeout(() => {
    toast.classList.add('exiting');
    setTimeout(() => {
      toast.remove();
    }, 500); // Match the animation duration
  }, 4000);
}

window.showAdvancementToast = showAdvancementToast;


// Function to show a badass notification for rank level up
function showBadassRankUpNotification(rankName) {
  const container = document.body;
  const notification = document.createElement('div');
  notification.className = 'badass-rank-notification';
  notification.innerHTML = `
        <div class="rank-up-container">
            <i class="fas fa-crown rank-icon"></i>
            <div class="rank-text">
                <strong>NEW RANK ACHIEVED!</strong>
                <br><span class="rank-name">${rankName}</span>
            </div>
            <i class="fas fa-fire-alt rank-icon fire-icon"></i>
        </div>
    `;
  container.appendChild(notification);

  // Add exit animation before removing
  setTimeout(() => {
    notification.classList.add('exiting');
    setTimeout(() => {
      notification.remove();
    }, 500); // Match the animation duration
  }, 2000);
}
window.showBadassRankUpNotification = showBadassRankUpNotification;


/* ---------- CHALLENGE & PENALTY SYSTEM (unchanged) ---------- */
function getCurrentWeekKey() {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const year = startOfWeek.getFullYear();
  return `${year}-${String(startOfWeek.getMonth() + 1).padStart(2, '0')}-${String(startOfWeek.getDate()).padStart(2, '0')}`;
}

function setupChallenge() {
  const wkKey = getCurrentWeekKey();
  const previousWeekKey = logData.weeklyChallenge.weekKey;
  const isNewWeek = previousWeekKey !== wkKey;

  if (isNewWeek && previousWeekKey) {

    if (!logData.weeklyChallenge.isComplete) {

      const totalRepsBeforePenalty = calculateGrandTotalReps();
      const intendedPenalty = Math.round(totalRepsBeforePenalty * 0.10);

      if (intendedPenalty > 0) {
        let actualRemainingPenalty = intendedPenalty;
        const sectionsToDeduct = ['pushups', 'pullups', 'legs', 'abs', 'kicks'];

        for (const sec of sectionsToDeduct) {
          for (const variation in logData[sec]) {
            const currentTotal = logData[sec][variation].total || 0;
            const fraction = currentTotal / totalRepsBeforePenalty;
            let deductionForVar = Math.floor(intendedPenalty * fraction);

            if (actualRemainingPenalty > 0) {
              deductionForVar = Math.min(deductionForVar, currentTotal, actualRemainingPenalty);

              logData[sec][variation].total -= deductionForVar;
              actualRemainingPenalty -= deductionForVar;
            }
          }
        }

        if (actualRemainingPenalty > 0) {
          logData.pushups.Standard.total = Math.max(0, (logData.pushups.Standard.total || 0) - actualRemainingPenalty);
        }

        saveData();

        showModalMessage("FATALITY: CHALLENGE FAILED",
          `You failed the weekly objective. Your lack of discipline cost you ${intendedPenalty.toLocaleString()} reps (10% penalty). ` +
          `The deduction was distributed across all your logged exercises. **A new mission has been assigned.**`);

      } else {
        showModalMessage("MISSED OBJECTIVE",
          "You missed the weekly objective, but your total volume is too low for a deduction. Start logging immediately. **A new mission has been assigned.**");
      }

    } else {
      showModalMessage("CHALLENGE COMPLETE", "Objective Secured. Your discipline is noted. You retain your current score. Proceed to the next mission.");
    }

    logData.weeklyChallenge.weekKey = wkKey;
    logData.weeklyChallenge.challenge = CHALLENGE_POOL[Math.floor(Math.random() * CHALLENGE_POOL.length)];
    logData.weeklyChallenge.progress = 0;
    logData.weeklyChallenge.isComplete = false;

    // Set baseline progress for the newly assigned challenge
    if (logData.weeklyChallenge.challenge) {
      const ch = logData.weeklyChallenge.challenge;
      logData.weeklyChallenge.baseline = logData[ch.type][ch.variation]?.total || 0;
    }

  } else if (!previousWeekKey) {
    logData.weeklyChallenge.weekKey = wkKey;
    logData.weeklyChallenge.challenge = CHALLENGE_POOL[Math.floor(Math.random() * CHALLENGE_POOL.length)];
    logData.weeklyChallenge.progress = 0;
    logData.weeklyChallenge.isComplete = false;

    // Set baseline progress for the newly assigned challenge
    if (logData.weeklyChallenge.challenge) {
      const ch = logData.weeklyChallenge.challenge;
      logData.weeklyChallenge.baseline = logData[ch.type][ch.variation]?.total || 0;
    }
  }
}

// Silent version of setupChallenge that doesn't save data or show notifications
function setupChallengeWithoutSave() {
  const wkKey = getCurrentWeekKey();
  const previousWeekKey = logData.weeklyChallenge.weekKey;
  const isNewWeek = previousWeekKey !== wkKey;

  if (isNewWeek && previousWeekKey) {

    if (!logData.weeklyChallenge.isComplete) {

      const totalRepsBeforePenalty = calculateGrandTotalReps();
      const intendedPenalty = Math.round(totalRepsBeforePenalty * 0.10);

      if (intendedPenalty > 0) {
        let actualRemainingPenalty = intendedPenalty;
        const sectionsToDeduct = ['pushups', 'pullups', 'legs', 'abs', 'kicks'];

        for (const sec of sectionsToDeduct) {
          for (const variation in logData[sec]) {
            const currentTotal = logData[sec][variation].total || 0;
            const fraction = currentTotal / totalRepsBeforePenalty;
            let deductionForVar = Math.floor(intendedPenalty * fraction);

            if (actualRemainingPenalty > 0) {
              deductionForVar = Math.min(deductionForVar, currentTotal, actualRemainingPenalty);

              logData[sec][variation].total -= deductionForVar;
              actualRemainingPenalty -= deductionForVar;
            }
          }
        }

        if (actualRemainingPenalty > 0) {
          logData.pushups.Standard.total = Math.max(0, (logData.pushups.Standard.total || 0) - actualRemainingPenalty);
        }

        // Don't save data to avoid showing notification
        console.log('[CHALLENGE] Penalty applied silently');

      } else {
        console.log('[CHALLENGE] No penalty applied - volume too low');
      }

    } else {
      console.log('[CHALLENGE] Previous challenge was completed');
    }

    logData.weeklyChallenge.weekKey = wkKey;
    logData.weeklyChallenge.challenge = CHALLENGE_POOL[Math.floor(Math.random() * CHALLENGE_POOL.length)];
    logData.weeklyChallenge.progress = 0;
    logData.weeklyChallenge.isComplete = false;

    // Set baseline progress for the newly assigned challenge
    if (logData.weeklyChallenge.challenge) {
      const ch = logData.weeklyChallenge.challenge;
      logData.weeklyChallenge.baseline = logData[ch.type][ch.variation]?.total || 0;
    }

  } else if (!previousWeekKey) {
    logData.weeklyChallenge.weekKey = wkKey;
    logData.weeklyChallenge.challenge = CHALLENGE_POOL[Math.floor(Math.random() * CHALLENGE_POOL.length)];
    logData.weeklyChallenge.progress = 0;
    logData.weeklyChallenge.isComplete = false;

    // Set baseline progress for the newly assigned challenge
    if (logData.weeklyChallenge.challenge) {
      const ch = logData.weeklyChallenge.challenge;
      logData.weeklyChallenge.baseline = logData[ch.type][ch.variation]?.total || 0;
    }
  }

  // Don't save data here to avoid showing notification
  console.log('[CHALLENGE] Challenge setup completed silently');
}

/* ---------- EVENTS & INIT ---------- */

// NEW: Download function to save progress as HTML file
function downloadProgressFile() {
  // Update embedded data one final time
  updateEmbeddedData();

  // Get the latest HTML with embedded data
  const htmlContent = window.harbingerUpdatedHTML || document.documentElement.outerHTML;

  // Create a blob and download link
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);

  // Create download link
  const a = document.createElement('a');
  a.href = url;

  // Generate filename with date
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  a.download = `HarbingerLog_${dateStr}_${timeStr}.html`;

  // Trigger download
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Clean up
  URL.revokeObjectURL(url);

  // Show success message
  let successMessage = `Your progress has been saved to <strong>HarbingerLog_${dateStr}_${timeStr}.html</strong><br><br>` +
    `?? All your reps, XP, advancements, and settings are embedded in the file.<br><br>` +
    `?? Keep this file safe - it contains all your progress!<br><br>` +
    `?? To restore: Simply open the downloaded file in your browser.`;

  showModalMessage('?? PROGRESS SAVED!', successMessage);
}

window.downloadProgressFile = downloadProgressFile;

/* ---------- AUTHENTICATION FUNCTIONS ---------- */

// Wrapper function to handle login from any event
function handleLoginWrapper(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  // For touch events, prevent default behavior
  if (e && e.type) {
    if (e.type === 'touchstart') {
      console.log('[AUTH] Login triggered by touch event');
    } else if (e.type === 'click') {
      console.log('[AUTH] Login triggered by click event');
    } else if (e.type === 'mousedown') {
      console.log('[AUTH] Login triggered by mouse down event');
    }
  }

  // Add a small delay to ensure touch events are properly handled
  setTimeout(handleLogin, 50);
}
// Enhanced login function with better mobile support and reliable redirects
function handleLogin() {
  try {
    console.log('[AUTH] Login function started');

    // Add visual feedback that login is in progress
    const loginButton = document.getElementById('login-button');
    if (loginButton) {
      loginButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Logging in...';
      loginButton.disabled = true;
    }

    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');

    const email = emailInput ? emailInput.value : null;
    const password = passwordInput ? passwordInput.value : null;

    console.log('[AUTH] Login attempt with email:', email);

    if (!email || !password) {
      console.log('[AUTH] Missing email or password');
      showModalMessage('?? Login Failed', 'Please enter both email and password.');
      // Restore login button state
      if (loginButton) {
        loginButton.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
        loginButton.disabled = false;
      }
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('[AUTH] Invalid email format');
      showModalMessage('?? Login Failed', 'Please enter a valid email address.');
      // Restore login button state
      if (loginButton) {
        loginButton.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
        loginButton.disabled = false;
      }
      return;
    }

    // Check if auth is initialized
    if (!auth) {
      console.error('[AUTH] Firebase auth not initialized');
      showModalMessage('? Login Failed', 'Authentication system not ready. Please try again.');
      // Restore login button state
      if (loginButton) {
        loginButton.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
        loginButton.disabled = false;
      }
      return;
    }

    // Check if we're on a mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    console.log('[AUTH] Device type:', isMobile ? 'Mobile' : 'Desktop');
    // Firebase login
    console.log('[AUTH] Attempting Firebase login');
    auth.signInWithEmailAndPassword(email, password)
      .then((userCredential) => {
        // Signed in
        const user = userCredential.user;
        console.log('[AUTH] User logged in successfully:', user.email);

        // Show success message
        showModalMessage('? Login Successful', `Welcome back, <strong>${user.email}</strong>!`);

        // Update UI elements
        const statusElement = document.getElementById('auth-status');
        if (statusElement) {
          statusElement.textContent = `Logged in as ${user.email}`;
        }

        // Render settings to update UI
        renderSettings();

        // Clear form inputs
        if (emailInput) emailInput.value = '';
        if (passwordInput) passwordInput.value = '';

        // Handle redirect/reload after successful login
        console.log('[AUTH] Handling post-login redirect');
        handlePostLoginRedirect();
      })
      .catch((error) => {
        const errorCode = error.code;
        const errorMessage = error.message;
        console.error('[AUTH] Login error:', errorCode, errorMessage);

        // Provide more user-friendly error messages
        let userMessage = errorMessage;
        if (errorCode === 'auth/user-not-found') {
          userMessage = 'No account found with this email address.';
        } else if (errorCode === 'auth/wrong-password') {
          userMessage = 'Incorrect password. Please try again.';
        } else if (errorCode === 'auth/invalid-email') {
          userMessage = 'Invalid email address format.';
        } else if (errorCode === 'auth/too-many-requests') {
          userMessage = 'Too many failed login attempts. Please try again later.';
        } else if (errorCode === 'auth/network-request-failed') {
          userMessage = 'Network error. Please check your connection and try again.';
        }

        showModalMessage('? Login Failed', `Error: ${userMessage}`);
      })
      .finally(() => {
        // Restore login button state
        if (loginButton) {
          loginButton.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
          loginButton.disabled = false;
        }
      });
  } catch (e) {
    console.error('[AUTH] Unexpected error in handleLogin:', e);
    showModalMessage('? Login Failed', `Unexpected error: ${e.message}`);

    // Restore login button state on error
    const loginButton = document.getElementById('login-button');
    if (loginButton) {
      loginButton.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
      loginButton.disabled = false;
    }
  }
}
// Function to handle post-login redirect or page refresh
function handlePostLoginRedirect() {
  try {
    console.log('[AUTH] Handling post-login redirect');

    // Update UI immediately
    renderSettings();

    // Small delay before refresh to allow UI updates
    setTimeout(() => {
      // For mobile devices, we need to handle the redirect differently
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      console.log('[AUTH] Device type for redirect:', isMobile ? 'Mobile' : 'Desktop');

      if (isMobile) {
        // For mobile, try a gentler approach to avoid session loss
        console.log('[AUTH] Mobile device detected, using gentle redirect');

        // Store auth state in sessionStorage to persist across page changes
        if (auth && auth.currentUser) {
          sessionStorage.setItem('mobileAuthState', JSON.stringify({
            uid: auth.currentUser.uid,
            email: auth.currentUser.email,
            timestamp: Date.now()
          }));
        }

        // Update the UI first
        renderSettings();
        updateHeaderRankingDisplay();

        // Then try to refresh just the auth status
        setTimeout(() => {
          updateAuthStatusDisplay();
          forceReauth();
        }, 300);
      } else {
        // For desktop, use the standard redirect methods
        console.log('[AUTH] Desktop device detected, using standard redirect');

        // Try multiple redirect methods for better compatibility
        try {
          // Method 1: location.reload()
          console.log('[AUTH] Trying location.reload()');
          location.reload();
        } catch (reloadError) {
          console.log('[AUTH] location.reload() failed:', reloadError);

          try {
            // Method 2: Assign to location.href
            console.log('[AUTH] Trying location.assign()');
            location.assign(location.href);
          } catch (assignError) {
            console.log('[AUTH] location.assign() failed:', assignError);

            try {
              // Method 3: Replace location
              console.log('[AUTH] Trying location.replace()');
              location.replace(location.href);
            } catch (replaceError) {
              console.log('[AUTH] location.replace() failed:', replaceError);

              // Method 4: Force UI update without redirect
              console.log('[AUTH] Falling back to UI update only');
              renderSettings();
              updateHeaderRankingDisplay();
            }
          }
        }
      }
    }, 500);
  } catch (e) {
    console.error('[AUTH] Error in handlePostLoginRedirect:', e);
    // Fallback to UI update
    renderSettings();
    updateHeaderRankingDisplay();
  }
}


function handleLogout() {
  // Show confirmation dialog before logging out (without acknowledge button)
  const container = document.getElementById('custom-modal-container');
  container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-content">
        <h3 class="text-2xl font-bold mb-3" style="color: var(--color-error);">Confirm Logout</h3>
        <p class="text-gray-200 mb-4">Are you sure you want to log out?</p>
        <p class="text-sm text-gray-400 mb-6">You'll need to log back in to access your saved data.</p>
        <div class="flex justify-center gap-3">
          <button onclick="closeModal()" class="px-4 py-2 rounded bg-gray-600 hover:bg-gray-700 transition">
            Cancel
          </button>
          <button onclick="confirmLogout()" class="px-4 py-2 rounded bg-red-600 hover:bg-red-700 transition">
            Logout
          </button>
        </div>
      </div>
    </div>
  `;
  // Add event listener to close on overlay click
  container.querySelector('.modal-overlay').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeModal();
    }
  });
}

function confirmLogout() {
  auth.signOut()
    .then(() => {
      console.log('[AUTH] User logged out');

      // Check if we're on a mobile device
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      // Clear mobile auth state if on mobile
      if (isMobile) {
        sessionStorage.removeItem('mobileAuthState');
      }

      closeModal();
      // Show a simple message without an acknowledge button
      const container = document.getElementById('custom-modal-container');
      container.innerHTML = `
        <div class="modal-overlay">
          <div class="modal-content">
            <h3 class="text-2xl font-bold mb-3" style="color: var(--color-error);">?? Logged Out</h3>
            <p class="text-gray-200 mb-6">You have been successfully logged out.</p>
          </div>
        </div>
      `;

      // Auto-close the modal after 2 seconds
      setTimeout(() => {
        closeModal();
        renderSettings(); // Update UI
      }, 2000);
    })
    .catch((error) => {
      console.error('[AUTH] Logout error:', error);

      // Show error message without an acknowledge button
      const container = document.getElementById('custom-modal-container');
      container.innerHTML = `
        <div class="modal-overlay">
          <div class="modal-content">
            <h3 class="text-2xl font-bold mb-3" style="color: var(--color-error);">? Logout Failed</h3>
            <p class="text-gray-200 mb-6">Error: ${error.message}</p>
          </div>
        </div>
      `;

      // Auto-close the modal after 3 seconds
      setTimeout(() => {
        closeModal();
      }, 3000);
    });
}

function showRegisterForm() {
  const email = prompt('Enter your email address:');
  if (email) {
    setTimeout(() => {
      alert('Registration successful!');
    }, 3000);
  }

  if (!emailRegex.test(email)) {
    showModalMessage('?? Registration Failed', 'Please enter a valid email address.');
    return;
  }

  const password = prompt('Enter a password:');
  if (!password) return;

  const confirmPassword = prompt('Confirm your password:');
  if (password !== confirmPassword) {
    showModalMessage('? Registration Failed', 'Passwords do not match!');
    return;
  }

  // Firebase registration
  auth.createUserWithEmailAndPassword(email, password)
    .then((userCredential) => {
      // Signed up
      const user = userCredential.user;
      console.log('[AUTH] User registered:', user.email);
      showModalMessage('? Registration Successful', `Account created for <strong>${user.email}</strong>! You are now logged in.`);
      renderSettings(); // Update UI
    })
    .catch((error) => {
      const errorCode = error.code;
      const errorMessage = error.message;
      console.error('[AUTH] Registration error:', errorCode, errorMessage);
      showModalMessage('? Registration Failed', `Error: ${errorMessage}`);
    });
}

/* ---------- GOOGLE SHEETS INTEGRATION ---------- */
function initializeGoogleSheets() {
  // Initialize the Google Sheets API
  // This would typically involve loading the Google API client
  // and authenticating the user
  // For this implementation, we'll simulate initialization
  googleSheetsReady = true;
  console.log('[GOOGLE SHEETS] Initialized');
}

function loadUserDataFromSheets(userId) {
  // Load user data from Google Sheets (this would require a separate endpoint)
  // For now, we'll just log that this functionality needs to be implemented
  console.log(`[GOOGLE SHEETS] Loading data for user ${userId} - Not yet implemented`);
  return Promise.resolve();
}

/* ---------- FIREBASE REALTIME DATABASE FUNCTIONS ---------- */
// Load user data from Firebase Realtime Database
function loadUserDataFromFirebase(userId) {
  if (!userId || !database) {
    console.log('[FIREBASE] No user ID or database connection');
    return Promise.resolve();
  }

  console.log(`[FIREBASE] Loading data for user ${userId}`);

  // Load from Realtime Database
  return database.ref('users/' + userId).once('value')
    .then(snapshot => {
      const userData = snapshot.val();
      if (userData) {
        logData = userData.logData || JSON.parse(JSON.stringify(INITIAL_STATE));
        settings = userData.settings || {};
        completedDifficulties = userData.completedDifficulties || {};
        advancementBaselines = userData.advancementBaselines || {};

        // Load AI body condition data if available
        if (userData.aiBodyCondition) {
          logData.aiBodyCondition = userData.aiBodyCondition;
        }

        console.log('[FIREBASE] Data loaded successfully');
        return userData;
      } else {
        console.log('[FIREBASE] No data found for user');
        return {};
      }
    })
    .catch(error => {
      console.error('[FIREBASE] Error loading data:', error);
      // Provide more detailed error information
      let errorMessage = error.message;
      if (error.code === 'PERMISSION_DENIED') {
        errorMessage = 'Permission denied. Please check your Firebase security rules.';
      }
      console.error('[FIREBASE] Detailed error:', errorMessage);
      return Promise.reject(error);
    });
}

function saveUserDataToSheets(userId) {
  // Save user data to Google Sheets via Apps Script
  if (!userId) {
    console.log('[GOOGLE SHEETS] No user ID');
    return Promise.resolve();
  }

  console.log(`[GOOGLE SHEETS] Saving data for user ${userId}`);

  // Prepare data for saving
  const userData = {
    logData: logData,
    settings: settings,
    completedDifficulties: completedDifficulties,
    advancementBaselines: advancementBaselines,
    email: currentUser ? currentUser.email : ''
  };

  // Web app URL from Google Apps Script
  // Google Apps Script Web App URL for Google Sheets integration
  // Google Apps Script Web App URL for Google Sheets integration
  const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbx0JeKMig0FXBZkYqzOsOzrsgM8Z8UIpZ8FbIGr9sewwmyunHz9j-_sOWRM3mmraoM/exec';

  // Send data to Google Apps Script
  return fetch(WEB_APP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId: userId,
      userData: userData
    })
  })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.result === 'success') {
        console.log('[GOOGLE SHEETS] Data saved successfully');
      } else {
        console.error('[GOOGLE SHEETS] Error saving data:', data.message);
      }
      return data;
    })
    .catch(error => {
      console.error('[GOOGLE SHEETS] Network error:', error);
      // Show more user-friendly error message
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        showModalMessage('? Sync Failed', 'Unable to connect to Google Sheets. This may be due to CORS restrictions. Please check that your Google Apps Script is deployed correctly and allows requests from localhost.');
      } else {
        showModalMessage('? Sync Failed', `Error syncing with Google Sheets: ${error.message}`);
      }
      return Promise.reject(error);
    });
}

// Save user data to Firebase Realtime Database
function saveUserDataToFirebase(userId) {
  console.log('[FIREBASE] saveUserDataToFirebase called with userId:', userId);

  // Check if we have all the required Firebase components
  if (!userId) {
    console.log('[FIREBASE] No user ID provided');
    return Promise.resolve({ result: 'skipped', message: 'No user ID provided' });
  }

  if (!database) {
    console.log('[FIREBASE] No database connection');
    return Promise.resolve({ result: 'skipped', message: 'No database connection' });
  }

  // Check if user is properly authenticated
  if (!currentUser || currentUser.uid !== userId) {
    console.log('[FIREBASE] User not properly authenticated. Current user:', currentUser, 'Expected userId:', userId);
    return Promise.resolve({ result: 'skipped', message: 'User not properly authenticated' });
  }

  console.log(`[FIREBASE] Saving data for user ${userId}`);

  // Prepare data for saving
  const userData = {
    logData: logData || {},
    settings: settings || {},
    completedDifficulties: completedDifficulties || {},
    advancementBaselines: advancementBaselines || {},
    email: currentUser ? currentUser.email : '',
    lastUpdated: new Date().toISOString(),
    // Include AI body condition data if available
    aiBodyCondition: logData && logData.aiBodyCondition ? logData.aiBodyCondition : null
  };

  console.log('[FIREBASE] Prepared user data:', {
    hasLogData: !!logData,
    logDataKeys: logData ? Object.keys(logData) : [],
    hasSettings: !!settings,
    hasCompletedDifficulties: !!completedDifficulties,
    hasAdvancementBaselines: !!advancementBaselines,
    email: currentUser ? currentUser.email : '',
  });

  // Save to Realtime Database
  console.log('[FIREBASE] Attempting to save to database path: users/' + userId);
  return database.ref('users/' + userId).set(userData)
    .then(() => {
      console.log('[FIREBASE] Data saved successfully');
      // Show a subtle notification that data was saved
      showSaveConfirmation();
      return { result: 'success', message: 'Data saved successfully' };
    })
    .catch(error => {
      console.error('[FIREBASE] Error saving data:', error);
      // Provide more detailed error information
      let errorMessage = error.message;
      if (error.code === 'PERMISSION_DENIED') {
        errorMessage = 'Permission denied. Please check your Firebase security rules at https://console.firebase.google.com/';
      }
      showModalMessage('? Sync Failed', `Error syncing with Firebase: ${errorMessage}`);
      return Promise.reject(error);
    });
}

// Save user data to Firebase without showing notification
function saveUserDataToFirebaseSilently(userId) {
  console.log('[FIREBASE] saveUserDataToFirebaseSilently called with userId:', userId);

  // Check if we have all the required Firebase components
  if (!userId) {
    console.log('[FIREBASE] No user ID provided');
    return Promise.resolve({ result: 'skipped', message: 'No user ID provided' });
  }

  if (!database) {
    console.log('[FIREBASE] No database connection');
    return Promise.resolve({ result: 'skipped', message: 'No database connection' });
  }

  // Check if user is properly authenticated
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== userId) {
    console.log('[FIREBASE] User not properly authenticated. Current user:', currentUser, 'Expected userId:', userId);
    return Promise.resolve({ result: 'skipped', message: 'User not properly authenticated' });
  }

  console.log(`[FIREBASE] Saving data for user ${userId}`);

  // Prepare data for saving
  const userData = {
    logData: logData || {},
    settings: settings || {},
    completedDifficulties: completedDifficulties || {},
    advancementBaselines: advancementBaselines || {},
    email: currentUser ? currentUser.email : '',
    lastUpdated: new Date().toISOString(),
    // Include AI body condition data if available
    aiBodyCondition: logData && logData.aiBodyCondition ? logData.aiBodyCondition : null
  };

  console.log('[FIREBASE] Prepared user data:', {
    hasLogData: !!logData,
    logDataKeys: logData ? Object.keys(logData) : [],
    hasSettings: !!settings,
    hasCompletedDifficulties: !!completedDifficulties,
    hasAdvancementBaselines: !!advancementBaselines,
    email: currentUser ? currentUser.email : '',
  });

  // Save to Realtime Database
  console.log('[FIREBASE] Attempting to save to database path: users/' + userId);
  return database.ref('users/' + userId).set(userData)
    .then(() => {
      console.log('[FIREBASE] Data saved successfully');
      return { result: 'success', message: 'Data saved successfully' };
    })
    .catch(error => {
      console.error('[FIREBASE] Error saving data:', error);
      // Provide more detailed error information
      let errorMessage = error.message;
      if (error.code === 'PERMISSION_DENIED') {
        errorMessage = 'Permission denied. Please check your Firebase security rules at https://console.firebase.google.com/';
      }
      return Promise.reject(error);
    });
}


function syncDataWithSheets() {
  if (!currentUser) {
    showModalMessage('?? Sync Failed', 'You must be logged in to sync data.');
    return;
  }

  showModalMessage('?? Syncing Data', 'Syncing your progress with Google Sheets...');

  // Save current data to localStorage first
  saveData();
  saveSettings();
  saveAdvancements();
  saveAdvancementBaselines();

  // Then sync with Google Sheets
  saveUserDataToSheets(currentUser.uid)
    .then(() => {
      showModalMessage('? Sync Complete', 'Your progress has been synced with Google Sheets.');
    })
    .catch(error => {
      console.error('[GOOGLE SHEETS] Sync error:', error);
      showModalMessage('? Sync Failed', `Error syncing with Google Sheets:  ${error.message}`);
    });
}
// Sync data with Firebase Realtime Database
function syncDataWithFirebase() {
  if (!currentUser) {
    showModalMessage('?? Sync Failed', 'You must be logged in to sync data.');
    return;
  }

  showModalMessage('?? Syncing Data', 'Syncing your progress with Firebase...');

  // Save current data to localStorage first
  saveData();
  saveSettings();
  saveAdvancements();
  saveAdvancementBaselines();

  // Log what we're about to sync
  console.log('[FIREBASE] About to sync data for user:', currentUser.uid);
  console.log('[FIREBASE] Data to sync:', {
    logDataKeys: logData ? Object.keys(logData) : [],
    hasSettings: !!settings,
    completedDifficultiesCount: completedDifficulties ? Object.keys(completedDifficulties).length : 0,
    advancementBaselinesCount: advancementBaselines ? Object.keys(advancementBaselines).length : 0
  });

  // Then sync with Firebase
  saveUserDataToFirebase(currentUser.uid)
    .then((result) => {
      if (result && result.result === 'success') {
        showModalMessage('? Sync Complete', 'Your progress has been synced with Firebase successfully!');
      } else {
        showModalMessage('?? Sync Complete', 'Sync function completed but may not have saved data. Check console for details.');
      }
    })
    .catch(error => {
      console.error('[FIREBASE] Sync error:', error);
      // Provide more detailed error information
      let errorMessage = error.message;
      if (error.code === 'PERMISSION_DENIED') {
        errorMessage = 'Permission denied. Please check your Firebase security rules at https://console.firebase.google.com/';
      }
      showModalMessage('? Sync Failed', `Error syncing with Firebase: ${errorMessage}`);
    });
}

// Settings change functions

// Save settings without showing notification
function saveSettingsSilently() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    updateEmbeddedData();

    console.log('[AUTOSAVE] Settings saved to localStorage');

    // Sync with Firebase if user is logged in
    if (currentUser && currentUser.uid) {
      console.log('[AUTOSAVE] Attempting to sync settings with Firebase for user:', currentUser.uid);
      saveUserDataToFirebaseSilently(currentUser.uid)
        .then(() => {
          console.log('[AUTOSAVE] Settings automatically synced with Firebase');
        })
        .catch(error => {
          console.error('[AUTOSAVE] Error syncing settings with Firebase:', error);
        });
    }
  } catch (error) {
    console.error('[AUTOSAVE] Error saving settings:', error);
  }
}





function clearUserData() {
  // Clear user-specific data when logging out
  console.log('[AUTH] Clearing user data');
}

// --- Expose functions globally for inline HTML event handlers ---
window.handleStatUpdate = handleStatUpdate;
window.changePage = changePage;
window.navigateToPage = changePage; // Alias for better clarity
window.goToPage = function (page) {
  // Validate page exists before navigating
  if (routes[page]) {
    changePage(page);
    return true;
  } else {
    console.warn(`[NAV] Attempted to navigate to invalid page: ${page}`);
    return false;
  }
};
window.handleMarkComplete = handleMarkComplete; // Expose new function
window.showStatRecommendations = showStatRecommendations; // Expose for stat cards
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.showRegisterForm = showRegisterForm;
window.syncDataWithSheets = syncDataWithSheets;
window.syncDataWithFirebase = syncDataWithFirebase; // Add Firebase sync function
window.saveUserDataToFirebase = saveUserDataToFirebase; // Expose Firebase save function

// Expose SPA routing functions
window.updateURL = updateURL;
window.routes = routes;
// -------------------------------------------------------------------

function init() {
  loadData();

  // Check for stored mobile auth state
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobile) {
    const storedAuthState = sessionStorage.getItem('mobileAuthState');
    if (storedAuthState) {
      try {
        const authData = JSON.parse(storedAuthState);
        // Check if stored data is recent (within 24 hours)
        if (Date.now() - authData.timestamp < 24 * 60 * 60 * 1000) {
          console.log('[MOBILE] Restored auth state from sessionStorage');
          // Update UI with stored auth state while waiting for Firebase
          const statusElement = document.getElementById('auth-status');
          if (statusElement) {
            statusElement.textContent = `Logged in as ${authData.email}`;
          }
        } else {
          // Clear expired auth state
          sessionStorage.removeItem('mobileAuthState');
        }
      } catch (e) {
        console.error('[MOBILE] Error parsing stored auth state:', e);
        sessionStorage.removeItem('mobileAuthState');
      }
    }
  }

  // Initialize Firebase Authentication listener
  if (auth) {
    auth.onAuthStateChanged(user => {
      console.log('[AUTH] Auth state changed:', user ? user.email : 'No user');
      if (user) {
        currentUser = user;
        // Try to update auth status in header (may not exist after move to settings)
        try {
          const authStatusElement = document.getElementById('auth-status');
          if (authStatusElement) {
            authStatusElement.textContent = `Logged in as ${user.email}`;
          }
        } catch (e) {
          console.log('[AUTH] Auth status element not found in header (expected after move to settings)');
        }
        // Store auth state for mobile
        if (isMobile) {
          sessionStorage.setItem('mobileAuthState', JSON.stringify({
            uid: user.uid,
            email: user.email,
            timestamp: Date.now()
          }));
        }
        // Load user data from Firebase and then render UI
        loadUserDataFromFirebase(user.uid).then(() => {
          // Update UI after data is loaded
          renderUI();
          updateHeaderRankingDisplay();
        }).catch(error => {
          console.error('[FIREBASE] Error loading user data:', error);
          // Still render UI even if data loading fails
          renderUI();
          updateHeaderRankingDisplay();
        });
      } else {
        currentUser = null;
        // Try to update auth status in header (may not exist after move to settings)
        try {
          const authStatusElement = document.getElementById('auth-status');
          if (authStatusElement) {
            authStatusElement.textContent = 'Not logged in';
          }
        } catch (e) {
          console.log('[AUTH] Auth status element not found in header (expected after move to settings)');
        }
        // Clear mobile auth state
        if (isMobile) {
          sessionStorage.removeItem('mobileAuthState');
        }
        // Clear user-specific data
        clearUserData();
        // Render UI for logged out state
        renderUI();
        updateHeaderRankingDisplay();
      }
      isAuthReady = true;
      renderSettings(); // Update settings UI

      // Apply mobile fixes after auth state change
      setTimeout(applyMobileFixes, 200);

      // Ensure status is updated on all devices
      setTimeout(() => {
        try {
          const statusElement = document.getElementById('auth-status');
          if (statusElement) {
            if (user) {
              statusElement.textContent = `Logged in as ${user.email}`;
            } else {
              statusElement.textContent = 'Not logged in';
            }
          }
        } catch (e) {
          console.log('[AUTH] Auth status element not found in header (expected after move to settings)');
        }
      }, 500);
    });
  } else {
    // If Firebase is not initialized, still render the UI
    renderUI();
    updateHeaderRankingDisplay();
  }

  // Apply theme and accent from settings
  console.log('[INIT] Applying theme and accent, settings:', settings);
  applyTheme(settings.theme || 'Dark');

  // Start RGB animation if it was previously selected
  if (settings.rgbAnimation) {
    console.log('[INIT] Starting RGB animation:', settings.rgbAnimation);
    startRgbAnimation(settings.rgbAnimation);
  } else {
    console.log('[INIT] Applying static accent:', settings.accent || 'Blue');
    applyAccent(settings.accent || 'Blue');
  }

  // Check if there's a hash in the URL to determine initial page
  const initialPage = window.location.hash.substring(1);
  if (initialPage && routes[initialPage]) {
    currentPage = initialPage;
    console.log(`[INIT] Starting on page: ${initialPage}`);
  } else {
    currentPage = 'home';
    console.log('[INIT] Starting on home page');
  }

  // Render the initial page content
  // Add a small delay to ensure proper rendering on mobile
  setTimeout(() => {
    renderUI();
    updateHeaderRankingDisplay();

    // Update browser history with initial state
    const route = routes[currentPage];
    if (route) {
      history.replaceState({ page: currentPage }, route.title, `#${currentPage}`);
      document.title = `${route.title} - Harbinger Log`;
    }
  }, 100);

  // Update the global interval to check if we are on the home page for the timer
  setInterval(() => {
    if (currentPage === 'home') {
      const homeTimer = document.getElementById('remaining-time-home');
      if (homeTimer) {
        renderRemainingTime(homeTimer);
      }
    }
  }, 1000);

  // Ensure authentication status is properly displayed
  setTimeout(updateAuthStatusDisplay, 500);
} // This is the correct closing brace for the init function

document.querySelectorAll('.nav-item').forEach(b => b.addEventListener('click', () => changePage(b.dataset.page)));

// Add event listener for Enter key in login form
document.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && (e.target.id === 'login-email' || e.target.id === 'login-password')) {
    e.preventDefault();
    handleLogin();
  }
});
// Add event listener for login button after DOM is ready
document.addEventListener('DOMContentLoaded', function () {
  setTimeout(() => {
    const loginButton = document.getElementById('login-button');
    if (loginButton) {
      // Remove existing listeners first
      const newLoginButton = loginButton.cloneNode(true);
      loginButton.parentNode.replaceChild(newLoginButton, loginButton);

      // Get reference to the new button
      const finalLoginButton = document.getElementById('login-button');

      // Add comprehensive event listeners
      finalLoginButton.addEventListener('click', handleLoginWrapper);
      finalLoginButton.addEventListener('touchstart', handleLoginWrapper);
      finalLoginButton.addEventListener('mousedown', handleLoginWrapper);
    }
  }, 500);
});
// Initialize back to top button when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
  setTimeout(initBackToTopButton, 100);
});

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', init);


function initBackToTopButton() {
  // Check if button already exists
  let backToTopButton = document.getElementById('back-to-top');
  if (!backToTopButton) {
    // Create back to top button
    backToTopButton = document.createElement('button');
    backToTopButton.id = 'back-to-top';
    backToTopButton.innerHTML = '<i class="fas fa-arrow-up"></i>';
    backToTopButton.setAttribute('title', 'Back to Top');
    backToTopButton.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
    document.body.appendChild(backToTopButton);
  }

  // Show/hide button based on scroll position
  window.addEventListener('scroll', () => {
    if (window.pageYOffset > 300) {
      backToTopButton.classList.add('visible');
    } else {
      backToTopButton.classList.remove('visible');
    }
  });

  // Insert after the input
  if (input.parentNode) {
    input.parentNode.style.position = 'relative';
    input.parentNode.insertBefore(container, input.nextSibling);

    // Add event listeners
    const incrementBtn = container.querySelector('.touch-increment');
    const decrementBtn = container.querySelector('.touch-decrement');

    if (incrementBtn) {
      incrementBtn.addEventListener('click', () => {
        const currentValue = parseInt(input.value) || 0;
        input.value = currentValue + 1;
        const event = new Event('change', { bubbles: true });
        input.dispatchEvent(event);
      });
    }

    if (decrementBtn) {
      decrementBtn.addEventListener('click', () => {
        const currentValue = parseInt(input.value) || 0;
        input.value = Math.max(0, currentValue - 1);
        const event = new Event('change', { bubbles: true });
        input.dispatchEvent(event);
      });
    }
  }
} catch (e) {
  console.warn('Failed to add touch controls:', e);
}
    });
  }

// Call addTouchControls when DOM is loaded and when switching tabs
document.addEventListener('DOMContentLoaded', () => {
  // Add a small delay to ensure DOM is fully ready
  setTimeout(addTouchControls, 100);
});

// Register service worker for offline capability
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(registration => {
        console.log('SW registered: ', registration);
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}
// Restore input state when switching tabs
function preserveInputState(oldPage, newPage) {
  const inputs = document.querySelectorAll('.editable-stat');
  inputs.forEach(input => {
    if (input._lastValue !== undefined) {
      input.value = input._lastValue;
    }
  });

  // Re-add touch controls after tab switch
  setTimeout(() => {
    try {
      addTouchControls();
    } catch (e) {
      console.warn('Failed to re-add touch controls:', e);
    }
  }, 100);
}
// Show save button when a field is clicked for editing
function showSaveButton(cardElement) {
  const saveButtonContainer = cardElement.querySelector('.save-button-container');
  if (saveButtonContainer) {
    saveButtonContainer.style.display = 'block';
  }
}

// Save changes and hide save button
function saveChanges(cardElement, section, variationName) {
  // Find all editable fields in this card and trigger their change event to save changes
  const editableFields = cardElement.querySelectorAll('.editable-stat');
  editableFields.forEach(field => {
    if (!field.readOnly) {
      // Trigger the onchange event to save the value
      const event = new Event('change', { bubbles: true });
      field.dispatchEvent(event);

      // Set field back to readonly
      field.readOnly = true;
    }
  });

  // Hide the save button
  const saveButtonContainer = cardElement.querySelector('.save-button-container');
  if (saveButtonContainer) {
    saveButtonContainer.style.display = 'none';
  }

  // Show confirmation message
  showSaveConfirmation();
}
// Show confirmation message when changes are saved
function showSaveConfirmation() {
  // Create a temporary notification
  const notification = document.createElement('div');
  notification.className = 'toast-notification';
  notification.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <strong>Changes Saved!</strong>
        <br><small>Your changes have been saved successfully.</small>
      `;
  document.body.appendChild(notification);

  // Add exit animation before removing
  setTimeout(() => {
    notification.classList.add('exiting');
    setTimeout(() => {
      notification.remove();
    }, 500); // Match the animation duration
  }, 2000);
}

// Custom Modal Placeholder for alerts/messages

window.addTouchControls = addTouchControls;
window.preserveInputState = preserveInputState;
window.showSaveButton = showSaveButton;
window.saveChanges = saveChanges;
window.showSaveConfirmation = showSaveConfirmation;